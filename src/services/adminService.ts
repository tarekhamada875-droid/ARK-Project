import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, setDoc, updateDoc, doc, getDoc, getDocs, deleteDoc, runTransaction, orderBy, limit, serverTimestamp, Timestamp, startAfter, increment } from 'firebase/firestore';
import type { 
  Garage,
  Supervisor, 
  Staff, 
  Package, 
  Coupon, 
  Announcement, 
  SystemConfig, 
  ActivityLog, 
  Subscriber 
} from '../types';
import { withRetry, safeDate } from '../utils';
import { getCleanPackageInfo } from '../constants/packages';

export const adminService = {
  // Supervisors
  addSupervisor: async (data: Omit<Supervisor, 'id'>) => {
    try {
      return await withRetry(() => addDoc(collection(db, 'supervisors'), {
        ...data,
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'supervisors');
      throw error;
    }
  },

  removeSupervisor: async (id: string) => {
    try {
      return await withRetry(() => deleteDoc(doc(db, 'supervisors', id)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `supervisors/${id}`);
      throw error;
    }
  },

  subscribeToSupervisors: (callback: (supervisors: Supervisor[]) => void) => {
    const q = query(collection(db, 'supervisors'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supervisor));
      callback(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'supervisors'));
  },

  updateSupervisor: async (id: string, data: Partial<Supervisor>) => {
    try {
      const payload: any = { ...data };
      if (data.pin) {
        payload.currentSessionId = null;
      }
      return await withRetry(() => updateDoc(doc(db, 'supervisors', id), payload));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supervisors/${id}`);
      throw error;
    }
  },

  // Staff
  addStaff: async (data: Omit<Staff, 'id'>) => {
    try {
      return await withRetry(() => addDoc(collection(db, 'staff'), {
        ...data,
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff');
      throw error;
    }
  },

  updateStaff: async (id: string, data: Partial<Staff>) => {
    try {
      const payload: any = { ...data };
      if (data.pin) {
        payload.currentSessionId = null;
      }
      return await withRetry(() => updateDoc(doc(db, 'staff', id), payload));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${id}`);
      throw error;
    }
  },

  removeStaff: async (id: string) => {
    try {
      return await withRetry(() => deleteDoc(doc(db, 'staff', id)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${id}`);
      throw error;
    }
  },

  getStaffByGarageOnce: async (garageId: string): Promise<Staff[]> => {
    try {
      const q = query(collection(db, 'staff'), where('garageId', '==', garageId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Staff));
    } catch (e) {
      console.warn('Error in getStaffByGarageOnce:', e);
      return [];
    }
  },

  subscribeToGarageStaff: (garageId: string, callback: (staff: Staff[]) => void) => {
    const q = query(
      collection(db, 'staff'),
      where('garageId', '==', garageId),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      callback(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'staff'));
  },

  subscribeToAdminPin: (callback: (pin: string) => void) => {
    return onSnapshot(doc(db, 'admin_settings', 'auth_pin'), (snapshot) => {
      callback(snapshot.data()?.pin || '');
    }, (err) => {
      console.warn('Admin pin subscription notice:', err);
      callback('');
    });
  },

  updateAdminPin: async (newPin: string): Promise<void> => {
    try {
      await setDoc(doc(db, 'admin_settings', 'auth_pin'), {
        pin: newPin,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'admin_settings/auth_pin');
      throw error;
    }
  },

  subscribeToWalletNumber: (callback: (wallet: string) => void) => {
    return adminService.subscribeToSystemConfig((config) => {
      callback(config?.walletNumber || '01000000000');
    });
  },

  updateWalletNumber: async (walletNumber: string): Promise<void> => {
    try {
      await setDoc(doc(db, 'system_config', 'global'), {
        walletNumber,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'system_config/global');
      throw error;
    }
  },

  subscribeToSubscriptionPrices: (callback: (prices: any) => void) => {
    return adminService.subscribeToSystemConfig((config) => {
      callback(config?.subscriptionPrices || {});
    });
  },

  // Packages Management
  addPackage: async (pkg: Omit<Package, 'id' | 'createdAt' | 'isActive'>): Promise<void> => {
    const pkgData: Record<string, any> = {
      name: pkg.name,
      price: pkg.price,
      vehiclesCount: pkg.vehiclesCount,
      durationDays: pkg.durationDays || 30,
      dailyCapacity: pkg.dailyCapacity !== undefined ? pkg.dailyCapacity : 50,
      isActive: true,
      createdAt: serverTimestamp()
    };
    if (pkg.discountType !== undefined) pkgData.discountType = pkg.discountType;
    if (pkg.discountValue !== undefined) pkgData.discountValue = pkg.discountValue;

    await withRetry(() => addDoc(collection(db, 'packages'), pkgData));
  },

  deletePackage: async (id: string): Promise<void> => {
    const docRef = doc(db, 'packages', id);
    await withRetry(() => setDoc(docRef, { isActive: false }, { merge: true }));
  },

  subscribeToPackages: (callback: (packages: Package[]) => void) => {
    const colRef = collection(db, 'packages');
    return onSnapshot(colRef, async (snapshot) => {
      const activePkgs = snapshot.docs
        .map(doc => {
          const data = doc.data() as Package;
          return {
            id: doc.id,
            ...data,
            durationDays: data.durationDays || data.vehiclesCount || 30,
            dailyCapacity: data.dailyCapacity !== undefined ? data.dailyCapacity : 50
          };
        })
        .filter(p => p.isActive !== false);
      
      try {
        localStorage.setItem('app_packages_cache', `${Date.now()}|${JSON.stringify(activePkgs)}`);
      } catch (e) {}
      callback(activePkgs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'packages'));
  },

  // Subscribers
  subscribeToSubscribers: (garageId: string, callback: (subscribers: any[]) => void) => {
    const q = query(
      collection(db, `garages/${garageId}/subscribers`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `garages/${garageId}/subscribers`));
  },

  addSubscriber: async (garageId: string, subscriberData: any) => {
    try {
      const subscribersCol = collection(db, `garages/${garageId}/subscribers`);
      const subscriberRef = doc(subscribersCol);
      await setDoc(subscriberRef, {
        ...subscriberData,
        id: subscriberRef.id,
        createdAt: serverTimestamp()
      });
      return subscriberRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `garages/${garageId}/subscribers`);
      throw error;
    }
  },

  renewSubscriber: async (garageId: string, subscriberId: string, _costUnits: number, newDates: { startDate: string, endDate: string }) => {
    try {
      const subscriberRef = doc(db, `garages/${garageId}/subscribers`, subscriberId);
      await updateDoc(subscriberRef, {
        startDate: newDates.startDate,
        endDate: newDates.endDate
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/subscribers/${subscriberId}/renew`);
      throw error;
    }
  },

  updateSubscriber: async (garageId: string, subscriberId: string, subscriberData: any) => {
    try {
      return await withRetry(() => updateDoc(doc(db, `garages/${garageId}/subscribers`, subscriberId), subscriberData));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/subscribers`);
      throw error;
    }
  },

  deleteSubscriber: async (garageId: string, subscriberId: string) => {
    try {
      return await withRetry(() => deleteDoc(doc(db, `garages/${garageId}/subscribers`, subscriberId)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `garages/${garageId}/subscribers`);
      throw error;
    }
  },

  getSubscriberByPlateOnce: async (garageId: string, rawPlate: string): Promise<Subscriber | null> => {
    try {
      const q = query(
        collection(db, `garages/${garageId}/subscribers`),
        where('plateNumberRaw', '==', rawPlate),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        return { id: docSnap.id, ...docSnap.data() } as Subscriber;
      }
      return null;
    } catch (err) {
      console.error('Error fetching subscriber by plate:', err);
      return null;
    }
  },

  // Coupons
  addCoupon: async (coupon: Omit<Coupon, 'id' | 'createdAt' | 'usedCount'>) => {
    try {
      return await withRetry(() => addDoc(collection(db, 'coupons'), {
        ...coupon,
        usedCount: 0,
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'coupons');
      throw error;
    }
  },

  updateCoupon: async (id: string, data: Partial<Coupon>) => {
    try {
      return await withRetry(() => updateDoc(doc(db, 'coupons', id), data));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `coupons/${id}`);
      throw error;
    }
  },

  deleteCoupon: async (id: string) => {
    try {
      return await withRetry(() => deleteDoc(doc(db, 'coupons', id)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `coupons/${id}`);
      throw error;
    }
  },

  subscribeToCoupons: (callback: (coupons: Coupon[]) => void) => {
    const q = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Coupon));
      callback(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'coupons'));
  },

  // Activity Logs
  addActivityLog: async (log: Record<string, any>) => {
    try {
      const { id, timestamp, ...rest } = log;
      return await addDoc(collection(db, 'activity_logs'), {
        ...rest,
        timestamp: timestamp || serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activity_logs');
      throw error;
    }
  },

  getActivityLogsSince: async (sinceDate: Date, maxCount = 2000): Promise<ActivityLog[]> => {
    try {
      // Avoid composite index requirement by only ordering and then filtering in memory
      const q = query(
        collection(db, 'activity_logs'),
        orderBy('timestamp', 'desc'),
        limit(maxCount)
      );
      const snap = await getDocs(q);
      const sinceMs = sinceDate.getTime();
      
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      return logs.filter(log => safeDate(log.timestamp).getTime() >= sinceMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      throw error;
    }
  },

  getPaginatedActivityLogs: async (pageSize = 20, lastDocRef?: any) => {
    try {
      let q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), limit(pageSize));
      if (lastDocRef) {
        q = query(collection(db, 'activity_logs'), orderBy('timestamp', 'desc'), startAfter(lastDocRef), limit(pageSize));
      }
      const snap = await getDocs(q);
      const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      return { 
        logs, 
        lastDoc: snap.docs[snap.docs.length - 1] || null,
        hasMore: snap.docs.length === pageSize
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      throw error;
    }
  },

  subscribeToGarageRechargeLogs: (garageId: string, callback: (logs: ActivityLog[]) => void, limitCount = 50, onError?: (err: any) => void) => {
    // Targeted query on actionType == 'recharge' to prevent downloading thousands of car entries/exits
    try {
      const q = query(
        collection(db, 'activity_logs'),
        where('garageId', '==', garageId),
        where('actionType', '==', 'recharge')
      );
      return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
        data.sort((a, b) => safeDate(b.timestamp).getTime() - safeDate(a.timestamp).getTime());
        callback(data.slice(0, limitCount));
      }, (err) => {
        console.warn('Targeted recharge query fallback needed:', err);
        // Graceful fallback to general query if needed
        const fallbackQ = query(
          collection(db, 'activity_logs'),
          where('garageId', '==', garageId)
        );
        return onSnapshot(fallbackQ, (snapshot) => {
          const data = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog))
            .filter(log => log.actionType === 'recharge' || (log.plateNumber && (log.plateNumber.includes('شحن') || log.plateNumber.includes('تفعيل'))));
          data.sort((a, b) => safeDate(b.timestamp).getTime() - safeDate(a.timestamp).getTime());
          callback(data.slice(0, limitCount));
        }, (fallbackErr) => {
          handleFirestoreError(fallbackErr, OperationType.LIST, 'activity_logs');
          if (onError) onError(fallbackErr);
          else callback([]);
        });
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.LIST, 'activity_logs');
      if (onError) onError(err);
      else callback([]);
      return () => {};
    }
  },

  adminDirectRechargeGarage: async (
    garageId: string,
    pkg: Package,
    adminDetails: { staffId?: string; staffName?: string; isEnglish?: boolean } = {}
  ): Promise<void> => {
    try {
      // 1. Primary Path: Call Server-Authoritative Recharge API Route
      const currentUser = auth?.currentUser;
      const firebaseIdToken = currentUser ? await currentUser.getIdToken().catch(() => '') : '';
      const canonicalSessionId = localStorage.getItem('rq_canonical_session_id') || '';

      const res = await fetch('/api/transactions/recharge-garage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garageId,
          packageId: pkg.id,
          pkg,
          adminDetails,
          firebaseIdToken,
          sessionId: canonicalSessionId,
          uid: currentUser?.uid || 'admin',
          role: 'admin'
        })
      }).catch(() => null);

      if (res && res.ok) {
        const json = await res.json();
        if (json.success) {
          return;
        } else if (json.error === 'MONTHLY_SUBSCRIBERS_PACKAGE_RESTRICTION') {
          throw new Error('MONTHLY_SUBSCRIBERS_PACKAGE_RESTRICTION');
        } else if (json.error === 'GARAGE_NOT_FOUND') {
          throw new Error('GARAGE_NOT_FOUND');
        }
      }

      // 2. Secondary Fallback Path: Client-Side Transaction Execution (if server route unavailable)
      await withRetry(() =>
        runTransaction(db, async (transaction) => {
          const garageRef = doc(db, 'garages', garageId);
          const garageSnap = await transaction.get(garageRef);
          if (!garageSnap.exists()) {
            throw new Error('GARAGE_NOT_FOUND');
          }
          const garageData = garageSnap.data() as Garage;
          const cleanPkg = getCleanPackageInfo(pkg);

          if (garageData.hasMonthlySubscribers === true && (cleanPkg.durationDays || 30) < 15) {
            throw new Error('MONTHLY_SUBSCRIBERS_PACKAGE_RESTRICTION');
          }

          // Get Referrer Garage BEFORE any writes if applicable
          const referrerGarageId = garageData.referredByGarageId;
          let referrerRef: any = null;
          let referrerSnap: any = null;
          const isEligibleForReferral =
            Boolean(referrerGarageId) &&
            referrerGarageId !== garageId &&
            pkg.price > 0 &&
            cleanPkg.durationDays > 1;

          if (isEligibleForReferral && referrerGarageId) {
            referrerRef = doc(db, 'garages', referrerGarageId);
            referrerSnap = await transaction.get(referrerRef);
          }

          let baseDate = new Date();
          const currentExpiry = garageData.balanceExpiry;
          if (currentExpiry) {
            const currentExpiryDate = safeDate(currentExpiry);
            if (currentExpiryDate.getTime() > baseDate.getTime()) {
              baseDate = currentExpiryDate;
            }
          }
          const days = cleanPkg.durationDays || 30;
          baseDate.setDate(baseDate.getDate() + days);

          const effCapacity = cleanPkg.isUnlimited ? 0 : (cleanPkg.dailyCapacity || 40);

          const updateData: any = {
            totalAdminRevenue: Number(((garageData.totalAdminRevenue || 0) + pkg.price).toFixed(2)),
            isLocked: false,
            isTrial: false,
            dailyCapacity: effCapacity,
            activePackageName: pkg.name,
            packageName: pkg.name,
            lastRechargeDate: serverTimestamp(),
            lastRechargeAmount: pkg.price,
            lastRechargePackageName: pkg.name,
            balanceExpiry: Timestamp.fromDate(baseDate),
            billingModel: 'subscription'
          };

          transaction.update(garageRef, updateData);

          const logRef = doc(collection(db, 'activity_logs'));
          const isEnglish = !!adminDetails.isEnglish;
          const staffNameText = adminDetails.staffName || (isEnglish ? 'Admin' : 'مدير النظام (Admin)');
          transaction.set(logRef, {
            garageId,
            garageName: garageData.name || '',
            staffId: adminDetails.staffId || 'admin',
            staffName: staffNameText,
            actionType: 'recharge',
            plateNumber: isEnglish
              ? `Recharge Subscription: ${pkg.name} (${pkg.vehiclesCount || days} Days) - ${pkg.price} EGP`
              : `تجديد اشتراك: ${pkg.name} (${pkg.vehiclesCount || days} يوم) - ${pkg.price} ج`,
            timestamp: serverTimestamp(),
            amount: pkg.price,
            packageId: pkg.id,
            details: {
              packageName: pkg.name,
              durationDays: days,
              carsCount: effCapacity,
              revenueAmount: pkg.price,
              originalRevenueAmount: pkg.price,
              discountAmount: 0,
              rechargedBy: staffNameText
            }
          });

          // Process Garage Referral Reward (if applicable)
          if (isEligibleForReferral && referrerRef && referrerSnap && referrerSnap.exists()) {
            const referrerData = referrerSnap.data();
            const REFERRAL_REWARD_DAYS = 1;
            
            transaction.update(referrerRef, {
              totalReferralRewardDays: increment(REFERRAL_REWARD_DAYS),
              totalGaragesReferredCount: increment(1),
              lastReferralRewardAt: serverTimestamp()
            });
            
            const rewardLogRef = doc(collection(db, 'activity_logs'));
            transaction.set(rewardLogRef, {
              garageId: referrerGarageId,
              garageName: referrerData.name || '',
              staffId: null,
              staffName: 'النظام — مكافأة إحالة',
              actionType: 'recharge',
              plateNumber: `مكافأة إحالة من ${garageData.name || ''} — إضافة يوم مجاني برصيد المكافآت`,
              timestamp: serverTimestamp(),
              amount: 0,
              packageId: referrerData.packageId || referrerData.activePackageId || 'referral_reward',
              details: {
                type: 'referral_reward',
                referrerGarageId: referrerGarageId,
                referredGarageId: garageId,
                rewardDays: REFERRAL_REWARD_DAYS,
                rewardPackageName: referrerData.activePackageName || referrerData.packageName || '',
                rewardDailyCapacity: referrerData.dailyCapacity ?? 0
              }
            });
          }
        })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}`);
      throw error;
    }
  },

  getSystemLogsByPlateOnce: async (rawPlate: string): Promise<ActivityLog[]> => {
    try {
      const q = query(
        collection(db, 'activity_logs'),
        where('plateNumber', '==', rawPlate),
        limit(50)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      }
      return [];
    } catch (err) {
      console.error('Error fetching activity logs by plate:', err);
      return [];
    }
  },

  // Announcements
  createAnnouncement: async (announcement: Omit<Announcement, 'id' | 'createdAt'>): Promise<string> => {
    try {
      const docRef = await addDoc(collection(db, 'announcements'), {
        ...announcement,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'announcements');
      throw error;
    }
  },

  deleteAnnouncement: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `announcements/${id}`);
      throw error;
    }
  },

  toggleAnnouncementActive: async (id: string, isActive: boolean): Promise<void> => {
    try {
      await updateDoc(doc(db, 'announcements', id), { isActive });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `announcements/${id}`);
      throw error;
    }
  },

  onAnnouncementsChange: (callback: (announcements: Announcement[]) => void): (() => void) => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'), limit(50));
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Announcement));
      callback(list);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'announcements'));
  },

  // System Config
  subscribeToSystemConfig: (callback: (config: SystemConfig | null) => void) => {
    const defaults: SystemConfig = { 
      defaultTrialDays: 15, 
      warningDaysThreshold: 3, 
      supportPhone: '01000000000',
      walletNumber: '01000000000',
      monthlySubscribersFlatFee: 500,
      monthlySubscribersSurchargePercent: 25,
      referralFeePerRenewal: 50,
      delegatePackageCommissions: {
        daily: 5,
        weekly: 15,
        biweekly: 25,
        monthly: 50
      },
      isMaintenanceMode: false,
      maintenanceMessage: '',
      adminColor: '#10b981'
    };

    return onSnapshot(doc(db, 'system_config', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as SystemConfig);
      } else {
        callback(defaults);
      }
    }, (err) => {
      console.warn('system_config snapshot notice (using defaults):', err?.message || err);
      callback(defaults);
    });
  },

  getSystemConfig: async (): Promise<SystemConfig | null> => {
    try {
      const docSnap = await getDoc(doc(db, 'system_config', 'global'));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as SystemConfig;
      }
      return {
        defaultTrialDays: 15,
        warningDaysThreshold: 3,
        supportPhone: '01000000000',
        walletNumber: '01000000000',
        monthlySubscribersFlatFee: 500,
        monthlySubscribersSurchargePercent: 25,
        referralFeePerRenewal: 50,
        delegatePackageCommissions: {
          daily: 5,
          weekly: 15,
          biweekly: 25,
          monthly: 50
        },
        isMaintenanceMode: false,
        maintenanceMessage: '',
        adminColor: '#10b981'
      };
    } catch (error) {
      console.error('Error fetching system config:', error);
      return null;
    }
  },

  updateSystemConfig: async (config: Partial<SystemConfig>): Promise<void> => {
    try {
      await setDoc(doc(db, 'system_config', 'global'), {
        ...config,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'system_config/global');
      throw error;
    }
  }
};
