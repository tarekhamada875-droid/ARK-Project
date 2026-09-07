import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  runTransaction, 
  orderBy, 
  limit, 
  serverTimestamp, 
  Timestamp, 
  increment
} from 'firebase/firestore';
import type { Delegate, RechargeRequest, ActivityLog } from '../types';
import { packageIdToDays, withRetry, calculateFinalPrice, safeDate } from '../utils';
import { validateRechargeRequest } from '../domain/garage/validation';

export const delegateService = {
  addDelegate: async (data: Omit<Delegate, 'id'>) => {
    try {
      return await withRetry(() => addDoc(collection(db, 'delegates'), {
        ...data,
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'delegates');
      throw error;
    }
  },

  removeDelegate: async (id: string) => {
    try {
      return await withRetry(() => deleteDoc(doc(db, 'delegates', id)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `delegates/${id}`);
      throw error;
    }
  },

  subscribeToDelegates: (callback: (delegates: Delegate[]) => void) => {
    const q = query(collection(db, 'delegates'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const delegates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delegate));
      callback(delegates);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'delegates'));
  },

  subscribeToDelegate: (delegateId: string, callback: (delegate: Delegate) => void) => {
    return onSnapshot(doc(db, 'delegates', delegateId), (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as Delegate);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `delegates/${delegateId}`));
  },

  getDelegateByPhone: async (phone: string) => {
    try {
      const q = query(collection(db, 'delegates'), where('phone', '==', phone), limit(1));
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Delegate;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'delegates');
      throw error;
    }
  },

  updateDelegate: async (id: string, data: Partial<Delegate>) => {
    try {
      const payload: any = { ...data };
      if (data.pin) {
        payload.currentSessionId = null;
      }
      return await withRetry(() => updateDoc(doc(db, 'delegates', id), payload));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `delegates/${id}`);
      throw error;
    }
  },

  getDelegateRecharges: async (delegateId: string) => {
    try {
      const q = query(
        collection(db, 'activity_logs'),
        where('staffId', '==', delegateId),
        where('actionType', '==', 'recharge'),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      logs.sort((a, b) => safeDate(b.timestamp).getTime() - safeDate(a.timestamp).getTime());
      return logs;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      throw error;
    }
  },

  getDelegateRechargeRequests: async (delegateId: string): Promise<RechargeRequest[]> => {
    try {
      const q = query(
        collection(db, 'recharge_requests'),
        where('delegateId', '==', delegateId),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
      requests.sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime());
      return requests;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'recharge_requests');
      throw error;
    }
  },

  createRechargeRequest: async (data: Omit<RechargeRequest, 'id' | 'status' | 'createdAt'>) => {
    try {
      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      );
      return await withRetry(() => addDoc(collection(db, 'recharge_requests'), {
        ...cleanData,
        status: 'pending',
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'recharge_requests');
      throw error;
    }
  },

  getPendingRechargeRequestsForGarage: async (garageId: string, delegateId?: string) => {
    try {
      if (delegateId) {
        const q = query(
          collection(db, 'recharge_requests'),
          where('delegateId', '==', delegateId),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
        return requests.filter(r => r.status === 'pending' && r.garageId === garageId);
      }
      const q = query(
        collection(db, 'recharge_requests'),
        where('garageId', '==', garageId),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
      return requests.filter(r => r.status === 'pending');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'recharge_requests');
      throw error;
    }
  },

  subscribeToPendingRechargeRequests: (callback: (requests: RechargeRequest[]) => void) => {
    const q = query(
      collection(db, 'recharge_requests'),
      where('status', '==', 'pending'),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
      requests.sort((a, b) => safeDate(b.createdAt).getTime() - safeDate(a.createdAt).getTime());
      callback(requests);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'recharge_requests'));
  },

  subscribeToDelegateRechargeRequests: (delegateId: string, callback: (requests: RechargeRequest[]) => void) => {
    const q = query(
      collection(db, 'recharge_requests'),
      where('delegateId', '==', delegateId),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
      callback(requests);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'recharge_requests'));
  },

  approveRechargeRequest: async (request: any): Promise<{ success: boolean; error?: string }> => {
    const validation = validateRechargeRequest(request);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(' — ') };
    }

    try {
      // Primary Path: Call Server API
      const currentUser = auth?.currentUser;
      const firebaseIdToken = currentUser ? await currentUser.getIdToken().catch(() => '') : '';

      const res = await fetch('/api/transactions/approve-recharge-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: request.id,
          request,
          firebaseIdToken,
          uid: currentUser?.uid || 'delegate',
          role: 'delegate'
        })
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        if (json.success) {
          return { success: true };
        } else if (json.error === 'REQUEST_ALREADY_PROCESSED') {
          return { success: false, error: 'الطلب تم معالجته مسبقاً' };
        } else if (json.error === 'REQUEST_NOT_FOUND') {
          return { success: false, error: 'الطلب غير موجود' };
        }
      }

      // Secondary Fallback Path: Local Transaction Execution
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'recharge_requests', request.id);
        const requestSnap = await transaction.get(requestRef);

        if (!requestSnap.exists()) throw new Error('الطلب غير موجود');
        const currentStatus = requestSnap.data()?.status;
        if (currentStatus !== 'pending') throw new Error('الطلب تم معالجته مسبقاً');

        const garageRef = doc(db, 'garages', request.garageId);
        const garageSnap = await transaction.get(garageRef);
        const garageData = garageSnap.data() || {};

        const referrerGarageId = garageData.referredByGarageId;
        const delegateReferrerId = garageData.referrerId || garageData.createdByDelegateId || null;

        // Check if this is a balance top-up request
        const isBalanceTopup = request.requestType === 'balance_topup' || request.packageId === 'balance_topup';

        if (isBalanceTopup) {
          const topupAmount = Number(request.amount || request.revenueAmount || 0);
          const targetDelegateId = delegateReferrerId || request.delegateId || null;
          let delegateRef: any = null;
          let delegateSnap: any = null;
          if (targetDelegateId) {
            delegateRef = doc(db, 'delegates', targetDelegateId);
            delegateSnap = await transaction.get(delegateRef);
          }

          transaction.update(garageRef, {
            balance: increment(topupAmount),
            totalAdminRevenue: increment(topupAmount),
            lastRechargeDate: serverTimestamp(),
            lastRechargeAmount: topupAmount,
            lastRechargePackageName: `شحن رصيد محفظة (${topupAmount} ج.م)`
          });

          transaction.update(requestRef, {
            status: 'approved',
            amount: topupAmount,
            revenueAmount: topupAmount,
            originalRevenueAmount: topupAmount,
            resolvedAt: serverTimestamp()
          });

          if (delegateRef && delegateSnap && delegateSnap.exists()) {
            transaction.update(delegateRef, {
              totalRechargedAmount: increment(topupAmount)
            });
          }

          const logRef = doc(collection(db, 'activity_logs'));
          transaction.set(logRef, {
            garageId: request.garageId,
            garageName: request.garageName || garageData.name || '',
            staffId: delegateReferrerId || request.delegateId || null,
            staffName: request.delegateName || null,
            actionType: 'balance_topup',
            plateNumber: `شحن رصيد محفظة (${topupAmount} ج.م)`,
            timestamp: serverTimestamp(),
            amount: topupAmount,
            details: {
              action: 'balance_topup',
              amount: topupAmount,
              requestId: request.id
            }
          });

          return {
            status: 'approved',
            newBalance: (garageData.balance || 0) + topupAmount
          };
        }

        if (!request.packageId || request.packageId === 'custom') {
          throw new Error('لا يمكن اعتماد طلبات غير محددة الباقة من مسار الاعتماد الموحد');
        }

        const packageRef = doc(db, 'packages', request.packageId);
        const packageSnap = await transaction.get(packageRef);

        if (!packageSnap.exists()) {
          throw new Error('الباقة المحددة في الطلب لم تعد متوفرة بالنظام');
        }
        const packageData = packageSnap.data();

        const durationDays = typeof packageData.durationDays === 'number' ? packageData.durationDays : 30;

        let referrerRef: any = null;
        let referrerSnap: any = null;
        let rewardRef: any = null;
        let rewardSnap: any = null;

        const isEligibleForReferral =
          Boolean(referrerGarageId) &&
          referrerGarageId !== request.garageId &&
          (typeof request.revenueAmount === 'number' ? request.revenueAmount > 0 : true) &&
          durationDays > 1;

        if (isEligibleForReferral && referrerGarageId) {
          referrerRef = doc(db, 'garages', referrerGarageId);
          referrerSnap = await transaction.get(referrerRef);

          rewardRef = doc(db, 'referral_rewards', request.id);
          rewardSnap = await transaction.get(rewardRef);
        }

        const settingsRef = doc(db, 'system_config', 'global');
        const settingsSnap = await transaction.get(settingsRef);
        const systemConfig = settingsSnap.exists() ? settingsSnap.data() : null;

        const delegateCommissions = systemConfig?.delegatePackageCommissions || {
          daily: 5,
          weekly: 15,
          biweekly: 25,
          monthly: systemConfig?.referralFeePerRenewal !== undefined ? Number(systemConfig.referralFeePerRenewal) : 50
        };

        const subscriberFlatFee = systemConfig?.subscriberFlatFee !== undefined
          ? Math.max(0, Number(systemConfig.subscriberFlatFee))
          : (systemConfig?.monthlySubscribersFlatFee !== undefined ? Number(systemConfig.monthlySubscribersFlatFee) : 500);

        const referredByDelegate = Boolean(delegateReferrerId);

        const effectivePackage = {
          ...packageData,
          discountValue: packageData.discountValue || request.discountAmount || 0,
          discountType: packageData.discountType || (request.discountAmount ? 'fixed' : undefined)
        };

        const priceCalc = calculateFinalPrice(
          effectivePackage,
          garageData.hasMonthlySubscribers === true,
          subscriberFlatFee,
          referredByDelegate ? delegateCommissions : 0
        );
        const commission = priceCalc.actualReferralFee;
        const effectiveOriginalRevenue = priceCalc.displayBasePrice;
        const effectiveRevenue = priceCalc.finalPrice;

        const targetDelegateId = delegateReferrerId || request.delegateId || null;
        let delegateRef: any = null;
        let delegateSnap: any = null;
        if (targetDelegateId) {
          delegateRef = doc(db, 'delegates', targetDelegateId);
          delegateSnap = await transaction.get(delegateRef);
        }

        let baseDate = new Date();
        const currentExpiry = garageData.balanceExpiry;
        if (currentExpiry) {
          const expDate = safeDate(currentExpiry);
          if (expDate > baseDate) baseDate = expDate;
        }

        let days = 30;
        if (request.durationDays && typeof request.durationDays === 'number' && request.durationDays > 0 && request.durationDays <= 365) {
          days = request.durationDays;
        } else if (request.carsCount && typeof request.carsCount === 'number' && request.carsCount > 0 && request.carsCount <= 365) {
          days = request.carsCount;
        } else if (request.packageId || request.packageName) {
          const pkgDays = packageIdToDays(request.packageId, request.packageName);
          if (pkgDays > 0) days = Math.min(pkgDays, 365);
        }
        baseDate.setDate(baseDate.getDate() + days);

        let effCapacity = request.dailyCapacity;
        const pkgName = String(request.packageName || '');
        const isUnlimitedPkg =
          pkgName.includes('مفتوح') ||
          pkgName.includes('غير محدود') ||
          pkgName.includes('غير محدودة') ||
          pkgName.includes('بدون حدود') ||
          pkgName.includes('سعة مفتوحة');

        if (isUnlimitedPkg) {
          effCapacity = 0;
        } else if (typeof effCapacity !== 'number' || effCapacity <= 0) {
          const match = pkgName.match(/(\d+)\s*سيارة/);
          if (match && match[1]) {
            effCapacity = parseInt(match[1], 10);
          } else if (request.carsCount && request.carsCount > 0 && request.carsCount <= 1000 && ![7, 15, 30, 365].includes(request.carsCount)) {
            effCapacity = request.carsCount;
          } else {
            effCapacity = 40;
          }
        }

        transaction.update(garageRef, {
          balanceExpiry: Timestamp.fromDate(baseDate),
          dailyCapacity: effCapacity,
          activePackageName: request.packageName,
          packageName: request.packageName,
          billingModel: 'subscription',
          isLocked: false,
          isTrial: false,
          totalAdminRevenue: increment(effectiveRevenue),
          lastRechargeDate: serverTimestamp(),
          lastRechargeAmount: effectiveRevenue,
          lastRechargePackageName: request.packageName || null
        });

        transaction.update(requestRef, {
          status: 'approved',
          commission: commission,
          referrerId: delegateReferrerId,
          amount: effectiveRevenue,
          revenueAmount: effectiveRevenue,
          originalRevenueAmount: effectiveOriginalRevenue,
          resolvedAt: serverTimestamp()
        });

        if (delegateRef && delegateSnap && delegateSnap.exists()) {
          const delegateUpdates: any = {
            totalRechargedAmount: increment(effectiveRevenue)
          };
          if (commission > 0) {
            delegateUpdates.totalCommissionEarned = increment(commission);
          }
          transaction.update(delegateRef, delegateUpdates);
        }

        const logRef = doc(collection(db, 'activity_logs'));
        transaction.set(logRef, {
          garageId: request.garageId,
          garageName: request.garageName || garageData.name || '',
          staffId: delegateReferrerId || request.delegateId || null,
          staffName: request.delegateName || null,
          actionType: 'recharge',
          plateNumber: `شحن ${request.packageName || 'الباقة'} (${days} يوم - ${effCapacity === 0 ? 'مفتوح' : `${effCapacity} سيارة`}) - الأصلي ${effectiveOriginalRevenue} ج${request.discountAmount ? ` | بعد الخصم ${effectiveRevenue} ج` : ''}`,
          timestamp: serverTimestamp(),
          amount: effectiveRevenue,
          packageId: request.packageId || null,
          details: {
            packageName: request.packageName,
            durationDays: days,
            carsCount: effCapacity,
            revenueAmount: effectiveRevenue,
            originalRevenueAmount: effectiveOriginalRevenue,
            discountAmount: request.discountAmount || 0,
            couponCode: request.couponCode || null,
            requestId: request.id,
            commission: commission,
            referrerId: delegateReferrerId
          }
        });

        if (referrerSnap && referrerSnap.exists() && rewardRef && rewardSnap && !rewardSnap.exists()) {
          const referrerData = referrerSnap.data() || {};
          const REFERRAL_REWARD_DAYS = 1;

          transaction.update(referrerRef, {
            totalReferralRewardDays: increment(REFERRAL_REWARD_DAYS),
            totalGaragesReferredCount: increment(1),
            lastReferralRewardAt: serverTimestamp()
          });

          transaction.set(rewardRef, {
            requestId: request.id,
            referrerGarageId: referrerGarageId,
            referrerGarageName: referrerData.name || '',
            referredGarageId: request.garageId,
            referredGarageName: request.garageName || garageData.name || '',
            rewardDays: REFERRAL_REWARD_DAYS,
            rewardPackageName: referrerData.activePackageName || referrerData.packageName || '',
            rewardDailyCapacity: referrerData.dailyCapacity ?? 0,
            triggeredByPackageName: request.packageName || '',
            triggeredByPackageId: request.packageId || '',
            createdAt: serverTimestamp(),
            status: 'awarded'
          });

          const rewardLogRef = doc(collection(db, 'activity_logs'));
          transaction.set(rewardLogRef, {
            garageId: referrerData.id || referrerGarageId,
            garageName: referrerData.name || '',
            staffId: null,
            staffName: 'النظام — مكافأة إحالة',
            actionType: 'recharge',
            plateNumber: `مكافأة إحالة من ${garageData.name || request.garageName || ''} — إضافة يوم مجاني برصيد المكافآت`,
            timestamp: serverTimestamp(),
            amount: 0,
            packageId: referrerData.packageId || referrerData.activePackageId || 'referral_reward',
            details: {
              type: 'referral_reward',
              requestId: request.id,
              referrerGarageId: referrerGarageId,
              referredGarageId: request.garageId,
              rewardDays: REFERRAL_REWARD_DAYS,
              rewardPackageName: referrerData.activePackageName || referrerData.packageName || '',
              rewardDailyCapacity: referrerData.dailyCapacity ?? 0
            }
          });
        }
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء اعتماد الطلب' };
    }
  },

  rejectRechargeRequest: async (requestId: string) => {
    try {
      const currentUser = auth?.currentUser;
      const firebaseIdToken = currentUser ? await currentUser.getIdToken().catch(() => '') : '';

      const res = await fetch('/api/transactions/reject-recharge-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          firebaseIdToken,
          uid: currentUser?.uid || 'delegate'
        })
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        if (json.success) return;
      }

      return await withRetry(async () => {
        const requestRef = doc(db, 'recharge_requests', requestId);

        const requestSnap = await getDoc(requestRef);
        if (!requestSnap.exists()) {
          throw new Error("عذراً، هذا طلب الشحن لم يعد موجوداً في النظام.");
        }
        const currentStatus = requestSnap.data()?.status;
        if (currentStatus && currentStatus !== 'pending') {
          throw new Error("عذراً، تم معالجة هذا طلب الشحن مسبقاً (تم قبوله أو رفضه بالفعل).");
        }

        return await updateDoc(requestRef, {
          status: 'rejected',
          resolvedAt: serverTimestamp()
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recharge_requests/${requestId}/reject`);
      throw error;
    }
  }
};
