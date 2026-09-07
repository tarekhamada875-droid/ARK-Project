import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  or,
  onSnapshot, 
  updateDoc, 
  doc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  writeBatch, 
  runTransaction, 
  orderBy, 
  limit, 
  serverTimestamp, 
  Timestamp, 
  startAfter,
  getCountFromServer
} from 'firebase/firestore';
import type { Garage } from '../types';
import { getCleanPackageInfo } from '../constants/packages';
import { withRetry, normalizeDigits, safeDate } from '../utils';
import { validateGarageCreation } from '../domain/garage/validation';

export type GarageDeletionProgress = {
  phase: 'preparing' | 'deleting' | 'finalizing' | 'complete';
  total: number;
  processed: number;
  percentage: number;
};

export const garageService = {
  subscribeToGarages: (callback: (garages: Garage[]) => void) => {
    let timeoutId: any = null;
    let latestGarages: Garage[] | null = null;
    let isFirst = true;

    const emit = () => {
      if (latestGarages) {
        callback(latestGarages);
      }
    };

    const q = query(collection(db, 'garages'));
    const unsub = onSnapshot(q, (snapshot) => {
      latestGarages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Garage));
      if (isFirst) {
        isFirst = false;
        emit();
      } else {
        // Throttle high-frequency updates (e.g. 10-30 transactions/sec across 1000 garages) to prevent UI thread lockup
        if (!timeoutId) {
          timeoutId = setTimeout(() => {
            timeoutId = null;
            emit();
          }, 2000);
        }
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'garages'));

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      unsub();
    };
  },

  subscribeToDelegateGarages: (delegateId: string, callback: (garages: Garage[]) => void) => {
    if (!delegateId) {
      callback([]);
      return () => {};
    }
    const q = query(
      collection(db, 'garages'),
      or(
        where('createdByDelegateId', '==', delegateId),
        where('referrerId', '==', delegateId)
      )
    );
    return onSnapshot(q, (snapshot) => {
      const garages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Garage));
      callback(garages);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'garages/delegate'));
  },

  getAdminGaragesPage: async (pageSize = 50, lastDocRef: any = null) => {
    try {
      let q = query(
        collection(db, 'garages'),
        orderBy('name'),
        limit(pageSize)
      );

      if (lastDocRef) {
        q = query(
          collection(db, 'garages'),
          orderBy('name'),
          startAfter(lastDocRef),
          limit(pageSize)
        );
      }

      const snapshot = await getDocs(q);
      const garages = snapshot.docs.map(garageDoc => ({
        id: garageDoc.id,
        ...garageDoc.data()
      } as Garage));

      return {
        garages,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
        hasMore: snapshot.docs.length === pageSize
      };
    } catch (error) {
      try {
        let fallbackQ = query(
          collection(db, 'garages'),
          limit(pageSize)
        );
        if (lastDocRef) {
          fallbackQ = query(
            collection(db, 'garages'),
            startAfter(lastDocRef),
            limit(pageSize)
          );
        }
        const snapshot = await getDocs(fallbackQ);
        const garages = snapshot.docs.map(garageDoc => ({
          id: garageDoc.id,
          ...garageDoc.data()
        } as Garage));

        return {
          garages,
          lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
          hasMore: snapshot.docs.length === pageSize
        };
      } catch (fallbackErr) {
        console.warn('Failed to load admin garage page:', fallbackErr);
        handleFirestoreError(fallbackErr, OperationType.LIST, 'garages/admin-page');
        throw fallbackErr;
      }
    }
  },

  subscribeToGarage: (garageId: string, callback: (garage: Garage) => void) => {
    return onSnapshot(doc(db, 'garages', garageId), (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as Garage);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `garages/${garageId}`));
  },

  createGarage: async (data: any): Promise<{ success: boolean; id?: string; error?: string }> => {
    const validation = validateGarageCreation(data);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(' — ') };
    }
    
    const isTrial = data.isTrial === true || data.isTrial === 'true';
    const cleanPin = normalizeDigits(String(data.pin || '')).replace(/\D/g, '');
    const cleanPhone = normalizeDigits(String(data.phone || '')).replace(/\D/g, '');
    
    const garageData: any = {
      name: data.name.trim(),
      pin: cleanPin || String(data.pin || '').trim(),
      ownerName: data.ownerName || '',
      phone: cleanPhone || String(data.phone || '').trim(),
      hourlyRate: parseFloat(data.hourlyRate),
      overnightRate: parseFloat(data.overnightRate),
      billingModel: 'subscription',
      status: data.isPending ? 'pending' : 'active',
      isTrial: isTrial,
      dailyCapacity: isTrial ? 0 : (data.dailyCapacity || 0),
      hasMonthlySubscribers: data.hasMonthlySubscribers === true,
      referredByGarageId: data.referredByGarageId || null,
      referredByGarageName: data.referredByGarageName || null,
      referrerId: data.referrerId || data.createdByDelegateId || null,
      createdByDelegateId: data.createdByDelegateId || data.referrerId || null,
      createdByDelegateName: data.createdByDelegateName || null,
      referralRewardClaimed: false,
      totalReferralRewardDays: 0,
      totalGaragesReferredCount: 0,
      carsInside: 0,
      todayCount: 0,
      todayRevenue: 0,
      totalRevenue: 0,
      totalVehiclesOut: 0,
      isLocked: false,
      shimmerColor: data.shimmerColor || '#10b981',
      createdAt: serverTimestamp(),
    };
    
    if (isTrial) {
      const trialDays = Number(data.trialDays || data.defaultTrialDays) > 0 ? Number(data.trialDays || data.defaultTrialDays) : 15;
      const trialExpiry = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
      garageData.balanceExpiry = Timestamp.fromDate(trialExpiry);
    } else if (data.initialPackageId && data.packages) {
      const pkg = data.packages.find((p: any) => p.id === data.initialPackageId);
      if (pkg) {
        const cleanPkg = getCleanPackageInfo(pkg);
        const durationDays = cleanPkg.durationDays || 30;
        const dailyCapacity = cleanPkg.isUnlimited ? 0 : (cleanPkg.dailyCapacity || 40);
        const expiryDate = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
        garageData.balanceExpiry = Timestamp.fromDate(expiryDate);
        garageData.dailyCapacity = dailyCapacity;
        garageData.activePackageName = pkg.name;
        garageData.packageName = pkg.name;
      }
    }
    
    try {
      const garageRef = doc(collection(db, 'garages'));
      const currentUserId = auth.currentUser?.uid;
      const trialDays = Number(data.trialDays || data.defaultTrialDays) > 0 ? Number(data.trialDays || data.defaultTrialDays) : 15;
      await runTransaction(db, async (transaction) => {
        const adminSessionRef = currentUserId ? doc(db, 'admin_sessions', currentUserId) : null;
        const isCurrentUserAdmin = adminSessionRef ? (await transaction.get(adminSessionRef)).exists() : false;

        transaction.set(garageRef, garageData);
        if (isCurrentUserAdmin && currentUserId) {
          transaction.set(doc(db, 'admin_rate_limits', currentUserId, 'operations', 'garage_create'), {
            lastOperationAt: serverTimestamp()
          });
        }

        const logRef = doc(collection(db, 'activity_logs'));
        const activePkgName = garageData.activePackageName || garageData.packageName;
        transaction.set(logRef, {
          garageId: garageRef.id,
          garageName: garageData.name,
          staffId: currentUserId || null,
          staffName: garageData.createdByDelegateName || (isTrial ? 'النظام (تفعيل تجريبي)' : 'الإدارة (تفعيل الاشتراك)'),
          actionType: 'recharge',
          plateNumber: isTrial
            ? `تفعيل الباقة التجريبية (${trialDays} يوم)`
            : `تفعيل اشتراك: ${activePkgName || 'باقة الاشتراك'}`,
          timestamp: serverTimestamp(),
          amount: 0,
          details: {
            packageName: isTrial ? `الباقة التجريبية (${trialDays} يوم)` : (activePkgName || 'باقة الاشتراك'),
            durationDays: isTrial ? trialDays : 30,
            carsCount: garageData.dailyCapacity || 0,
            revenueAmount: 0,
          }
        });
      });
      
      return { success: true, id: garageRef.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء إنشاء الجراج' };
    }
  },

  useReferralRewardDays: async (garageId: string): Promise<{ success: boolean; daysClaimed?: number; error?: string }> => {
    try {
      const garageRef = doc(db, 'garages', garageId);
      let claimedDays = 0;
      
      await runTransaction(db, async (transaction) => {
        const garageSnap = await transaction.get(garageRef);
        if (!garageSnap.exists()) throw new Error('الجراج غير موجود');
        const garageData = garageSnap.data() || {};
        
        const rewardDays = Math.max(0, Number(garageData.totalReferralRewardDays || 0));
        if (rewardDays <= 0) {
          throw new Error('لا يوجد رصيد أيّام مجانيّة للاستخدام');
        }
        
        claimedDays = rewardDays;
        
        let baseDate = new Date();
        const currentExpiry = garageData.balanceExpiry;
        if (currentExpiry) {
          const expDate = safeDate(currentExpiry);
          if (expDate > baseDate) {
            throw new Error('لا يمكن استخدام المكافأة والاشتراك ساري');
          }
        }
        
        baseDate.setDate(baseDate.getDate() + rewardDays);
        
        transaction.update(garageRef, {
          balanceExpiry: Timestamp.fromDate(baseDate),
          totalReferralRewardDays: 0,
          isLocked: false,
          lastReferralClaimAt: serverTimestamp()
        });
        
        const logRef = doc(collection(db, 'activity_logs'));
        transaction.set(logRef, {
          garageId: garageId,
          garageName: garageData.name || '',
          staffId: auth.currentUser?.uid || null,
          staffName: 'صاحب الجراج (استخدام رصيد المكافآت)',
          actionType: 'recharge',
          plateNumber: `استخدام مكافأة إحالة — تمديد الاشتراك +${rewardDays} ${rewardDays === 1 ? 'يوم مجاني' : rewardDays === 2 ? 'يومان مجانيان' : 'أيام مجانية'}`,
          timestamp: serverTimestamp(),
          amount: 0,
          details: {
            type: 'use_referral_reward',
            claimedDays: rewardDays,
            newExpiry: baseDate.toISOString()
          }
        });
      });
      
      return { success: true, daysClaimed: claimedDays };
    } catch (err: any) {
      const rawMsg = String(err?.message || '');
      let friendlyError = 'حدث خطأ أثناء استخدام أيام المكافأة';
      if (rawMsg.includes('permission') || rawMsg.includes('insufficient')) {
        friendlyError = 'عفواً، تعذر إتمام العملية بسبب قيود الصلاحيات. يرجى تحديث الصفحة والمحاولة مرة أخرى.';
      } else if (rawMsg) {
        friendlyError = rawMsg;
      }
      return { success: false, error: friendlyError };
    }
  },

  updateGarage: async (id: string, data: Partial<Garage>) => {
    try {
      if ('balanceExpiry' in data && data.balanceExpiry === null && data.status === 'approved') {
        throw new Error('لا يمكن حذف تاريخ انتهاء الاشتراك لجراج مفعل');
      }
      const payload: any = { ...data };
      if (data.pin || (data as any).ownerPin) {
        payload.currentSessionId = null;
      }
      return await withRetry(() => updateDoc(doc(db, 'garages', id), payload));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${id}`);
      throw error;
    }
  },

  getGarageById: async (id: string) => {
    try {
      const snapshot = await getDoc(doc(db, 'garages', id));
      if (!snapshot.exists()) return null;
      return { id: snapshot.id, ...snapshot.data() } as Garage;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `garages/${id}`);
      throw error;
    }
  },

  claimOrRefreshGarageSession: async (
    garageId: string,
    sessionId: string,
    _serverTimeOffset = 0
  ) => {
    const garageRef = doc(db, 'garages', garageId);
    const sessionRef = doc(db, 'garage_sessions', garageId);

    return withRetry(() => runTransaction(db, async (transaction) => {
      const garageSnap = await transaction.get(garageRef);
      if (!garageSnap.exists()) throw new Error('GARAGE_NOT_FOUND');

      const data = garageSnap.data();

      transaction.update(garageRef, {
        currentSessionId: sessionId,
        lastActive: serverTimestamp(),
      });
      transaction.set(sessionRef, {
        garageId,
        sessionId,
        uid: auth.currentUser?.uid || null,
        lastActive: serverTimestamp(),
      }, { merge: true });

      return { ...data, id: garageSnap.id, currentSessionId: sessionId };
    }));
  },

  recalculateCarsInside: async (garageId: string): Promise<number> => {
    try {
      return await withRetry(async () => {
        const q = query(
          collection(db, `garages/${garageId}/vehicles`),
          where('status', '==', 'inside')
        );
        const snapshot = await getDocs(q);
        const actualCount = snapshot.size;

        await updateDoc(doc(db, 'garages', garageId), {
          carsInside: actualCount
        });

        return actualCount;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/recalculateCarsInside`);
      throw error;
    }
  },

  deleteGarage: async (
    id: string,
    onProgress?: (progress: GarageDeletionProgress) => void
  ) => {
    try {
      return await withRetry(async () => {
        const pageSize = 400;
        const sources = [
          { countQuery: query(collection(db, 'garage_sessions'), where('garageId', '==', id)), pageQuery: query(collection(db, 'garage_sessions'), where('garageId', '==', id), limit(pageSize)) },
          { countQuery: query(collection(db, 'staff_sessions'), where('garageId', '==', id)), pageQuery: query(collection(db, 'staff_sessions'), where('garageId', '==', id), limit(pageSize)) },
          { countQuery: query(collection(db, `garages/${id}/vehicles`)), pageQuery: query(collection(db, `garages/${id}/vehicles`), limit(pageSize)) },
          { countQuery: query(collection(db, `garages/${id}/daily_stats`)), pageQuery: query(collection(db, `garages/${id}/daily_stats`), limit(pageSize)) },
          { countQuery: query(collection(db, `garages/${id}/daily_counts`)), pageQuery: query(collection(db, `garages/${id}/daily_counts`), limit(pageSize)) },
          { countQuery: query(collection(db, `garages/${id}/subscribers`)), pageQuery: query(collection(db, `garages/${id}/subscribers`), limit(pageSize)) },
          { countQuery: query(collection(db, 'activity_logs'), where('garageId', '==', id)), pageQuery: query(collection(db, 'activity_logs'), where('garageId', '==', id), limit(pageSize)) },
          { countQuery: query(collection(db, 'staff'), where('garageId', '==', id)), pageQuery: query(collection(db, 'staff'), where('garageId', '==', id), limit(pageSize)) },
          { countQuery: query(collection(db, 'topup_requests'), where('garageId', '==', id)), pageQuery: query(collection(db, 'topup_requests'), where('garageId', '==', id), limit(pageSize)) },
          { countQuery: query(collection(db, 'recharge_requests'), where('garageId', '==', id)), pageQuery: query(collection(db, 'recharge_requests'), where('garageId', '==', id), limit(pageSize)) },
          { countQuery: query(collection(db, 'announcements'), where('targetGarageId', '==', id)), pageQuery: query(collection(db, 'announcements'), where('targetGarageId', '==', id), limit(pageSize)) },
          { countQuery: query(collection(db, 'garages'), where('referredByGarageId', '==', id)), pageQuery: query(collection(db, 'garages'), where('referredByGarageId', '==', id), limit(pageSize)) }
        ];

        const total = (await Promise.all(
          sources.map(async ({ countQuery }) => (await getCountFromServer(countQuery)).data().count)
        )).reduce((sum, count) => sum + count, 0);

        let processed = 0;
        const reportProgress = (phase: GarageDeletionProgress['phase']) => {
          const percentage = phase === 'complete'
            ? 100
            : phase === 'preparing'
              ? 1
              : phase === 'finalizing' || total === 0
                ? 99
                : Math.min(98, 1 + Math.floor((processed / total) * 97));
          onProgress?.({ total, processed, percentage, phase });
        };

        await updateDoc(doc(db, 'garages', id), { isDeleting: true, isLocked: true });
        reportProgress('preparing');

        const deleteAllMatching = async (sourceQuery: any) => {
          while (true) {
            const snapshot = await getDocs(sourceQuery);
            if (snapshot.empty) return;
            const batch = writeBatch(db);
            snapshot.docs.forEach((snapshotDoc: any) => batch.delete(snapshotDoc.ref));
            await batch.commit();
            processed += snapshot.size;
            reportProgress('deleting');
          }
        };

        const updateAllMatching = async (sourceQuery: any, changes: Record<string, unknown>) => {
          while (true) {
            const snapshot = await getDocs(sourceQuery);
            if (snapshot.empty) return;
            const batch = writeBatch(db);
            snapshot.docs.forEach((snapshotDoc: any) => batch.update(snapshotDoc.ref, changes));
            await batch.commit();
            processed += snapshot.size;
            reportProgress('deleting');
          }
        };

        for (let index = 0; index <= 10; index += 1) {
          await deleteAllMatching(sources[index].pageQuery);
        }
        await updateAllMatching(sources[11].pageQuery, {
          referredByGarageId: null,
          referredByGarageName: null,
        });

        reportProgress('finalizing');
        await deleteDoc(doc(db, 'garages', id));
        reportProgress('complete');
        return true;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `garages/${id}`);
      throw error;
    }
  },

  adminTopupGarageBalance: async (garageId: string, amount: number) => {
    try {
      const response = await fetch('/api/transactions/admin-topup-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garageId, amount })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'فشل شحن الرصيد');
      }
      return data.data;
    } catch (error) {
      console.error('[GarageService] adminTopupGarageBalance error:', error);
      throw error;
    }
  },

  garageSelfSubscribe: async (garageId: string, packageId: string, packageData?: any) => {
    try {
      const response = await fetch('/api/transactions/garage-self-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garageId, packageId, packageData })
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'فشل تفعيل الاشتراك من الرصيد');
      }
      return data.data;
    } catch (error) {
      console.error('[GarageService] garageSelfSubscribe error:', error);
      throw error;
    }
  }
};
