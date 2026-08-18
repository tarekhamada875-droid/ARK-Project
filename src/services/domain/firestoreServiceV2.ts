import { db, handleFirestoreError, OperationType } from '../../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
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
  increment, 
  startAfter 
} from 'firebase/firestore';
import type { 
  Garage, 
  Staff, 
  ActivityLog, 
  Vehicle, 
  Delegate, 
  Package, 
  RechargeRequest, 
  Supervisor, 
  GeneralManager, 
  Coupon, 
  Subscriber, 
  Announcement, 
  SystemConfig 
} from '../../types';
import { ADMIN_PIN } from '../../constants';
import { getCleanPackageInfo } from '../../constants/packages';
import { packageIdToDays, withRetry } from '../../utils';
import { validateGarageCreation, validateRechargeRequest } from '../../domain/garage/validation';
import { isSubscriptionExpired, calculateCapacityUsed } from '../../domain/garage/subscription';

export type { 
  Garage, 
  Staff, 
  ActivityLog, 
  Vehicle, 
  Delegate, 
  Package, 
  RechargeRequest, 
  Supervisor, 
  GeneralManager, 
  Coupon, 
  Subscriber, 
  Announcement, 
  SystemConfig 
};

export const firestoreServiceV2 = {
  // Garages (Subscriptions & Management)
  subscribeToGarages: (callback: (garages: Garage[]) => void) => {
    const q = query(collection(db, 'garages'), limit(100));
    let cachedData: Garage[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as Garage;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      callback([...cachedData]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'garages'));
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
    
    const garageData: any = {
      name: data.name.trim(),
      pin: data.pin.trim(),
      ownerName: data.ownerName || '',
      phone: data.phone || '',
      hourlyRate: parseFloat(data.hourlyRate),
      overnightRate: parseFloat(data.overnightRate),
      billingModel: 'subscription',
      status: data.isPending ? 'pending' : 'active',
      isTrial: isTrial,
      dailyCapacity: isTrial ? 0 : (data.dailyCapacity || 0),
      hasMonthlySubscribers: data.hasMonthlySubscribers === true,
      referredByGarageId: data.referredByGarageId || null,
      referredByGarageName: data.referredByGarageName || null,
      referralRewardClaimed: false,
      totalReferralRewardDays: 0,
      totalGaragesReferredCount: 0,
      carsInside: 0,
      todayCount: 0,
      todayRevenue: 0,
      totalRevenue: 0,
      totalVehiclesOut: 0,
      isLocked: false,
      createdAt: serverTimestamp(),
    };
    
    if (isTrial) {
      const trialExpiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
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
      await runTransaction(db, async (transaction) => {
        transaction.set(garageRef, garageData);
      });
      
      return { success: true, id: garageRef.id };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء إنشاء الجراج' };
    }
  },

  updateGarage: async (id: string, data: Partial<Garage>) => {
    try {
      // Validate that balanceExpiry is not mistakenly set to null if garage is active
      if ('balanceExpiry' in data && data.balanceExpiry === null && data.status === 'approved') {
        throw new Error('لا يمكن حذف تاريخ انتهاء الاشتراك لجراج مفعل');
      }
      return await withRetry(() => updateDoc(doc(db, 'garages', id), data));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${id}`);
      throw error;
    }
  },

  processReferralRewardForRecharge: async (garageId: string) => {
    try {
      await withRetry(async () => {
        const garageRef = doc(db, 'garages', garageId);
        const garageSnap = await getDoc(garageRef);
        if (!garageSnap.exists()) return;
        const garageData = garageSnap.data() as Garage;

        // Must have been referred by another garage
        if (!garageData.referredByGarageId) return;

        // Reward is granted ONCE with the first successful recharge of the referred garage
        if (garageData.referralRewardClaimed) return;

        const referrerRef = doc(db, 'garages', garageData.referredByGarageId);
        const referrerSnap = await getDoc(referrerRef);
        if (!referrerSnap.exists()) return;
        const referrerData = referrerSnap.data() as Garage;

        // Calculate 15 days addition for referrer
        let baseDate = new Date();
        const currentExpiry = referrerData.balanceExpiry;
        if (currentExpiry) {
          const expDate = currentExpiry.toDate ? currentExpiry.toDate() : new Date(currentExpiry);
          if (expDate > baseDate) {
            baseDate = expDate;
          }
        }
        baseDate.setDate(baseDate.getDate() + 15);

        const batch = writeBatch(db);

        // Update Referrer garage: Add 15 days, unlock if locked, set capacity to at least 40
        const referrerUpdates: any = {
          balanceExpiry: Timestamp.fromDate(baseDate),
          isLocked: false,
          totalReferralRewardDays: increment(15),
          totalGaragesReferredCount: increment(1)
        };

        if (!referrerData.dailyCapacity || referrerData.dailyCapacity <= 0) {
          referrerUpdates.dailyCapacity = 40;
        }

        batch.update(referrerRef, referrerUpdates);

        // Update the referred garage so reward is only claimed once
        batch.update(garageRef, {
          referralRewardClaimed: true,
          referralRewardAwardedAt: serverTimestamp()
        });

        // Add activity log for referrer
        const logRef = doc(collection(db, 'activity_logs'));
        batch.set(logRef, {
          garageId: referrerData.id,
          garageName: referrerData.name,
          staffId: null,
          staffName: 'النظام (مكافأة ترشيح تلقائية)',
          actionType: 'recharge',
          plateNumber: `مكافأة ترشيح جراج (${garageData.name}) - إضافة 15 يوم اشتراك مجاناً (سعة 40 سيارة)`,
          timestamp: serverTimestamp(),
          amount: 0
        });

        await batch.commit();
      });
    } catch (error) {
      console.error('Error in processReferralRewardForRecharge:', error);
    }
  },

  deleteGarage: async (id: string) => {
    try {
      return await withRetry(async () => {
        const fetchSnapSafe = async (q: any) => {
          try {
            return await getDocs(q);
          } catch (e) {
            console.warn('Subcollection fetch failed during garage deletion:', e);
            return { forEach: () => {} } as any; 
          }
        };

        const [vehiclesSnap, dailyStatsSnap, logsSnap, staffSnap, subscribersSnap, topupsSnap] = await Promise.all([
          fetchSnapSafe(query(collection(db, `garages/${id}/vehicles`), limit(300))),
          fetchSnapSafe(query(collection(db, `garages/${id}/daily_stats`), limit(30))),
          fetchSnapSafe(query(collection(db, 'activity_logs'), where('garageId', '==', id), limit(40))),
          fetchSnapSafe(query(collection(db, 'staff'), where('garageId', '==', id), limit(40))),
          fetchSnapSafe(query(collection(db, `garages/${id}/subscribers`), limit(40))),
          fetchSnapSafe(query(collection(db, 'topup_requests'), where('garageId', '==', id), limit(40)))
        ]);

        const refsToDelete: any[] = [];
        if (vehiclesSnap.docs) vehiclesSnap.forEach(doc => refsToDelete.push(doc.ref));
        if (dailyStatsSnap.docs) dailyStatsSnap.forEach(doc => refsToDelete.push(doc.ref));
        if (logsSnap.docs) logsSnap.forEach(doc => refsToDelete.push(doc.ref));
        if (staffSnap.docs) staffSnap.forEach(doc => refsToDelete.push(doc.ref));
        if (subscribersSnap.docs) subscribersSnap.forEach(doc => refsToDelete.push(doc.ref));
        if (topupsSnap.docs) topupsSnap.forEach(doc => refsToDelete.push(doc.ref));
        
        refsToDelete.push(doc(db, 'garages', id));

        const chunkSize = 400;
        for (let i = 0; i < refsToDelete.length; i += chunkSize) {
          const chunk = refsToDelete.slice(i, i + chunkSize);
          const batch = writeBatch(db);
          chunk.forEach(ref => batch.delete(ref));
          await batch.commit();
        }

        return true;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `garages/${id}`);
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

  // Session Management
  updateSession: async (collectionName: 'garages' | 'staff' | 'delegates' | 'supervisors' | 'general_managers', id: string, sessionId: string | null) => {
    try {
      await withRetry(() => updateDoc(doc(db, collectionName, id), { 
        currentSessionId: sessionId,
        lastActive: sessionId ? serverTimestamp() : null
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  },

  updateGarageSession: async (garageId: string, sessionId: string | null) => {
    return firestoreServiceV2.updateSession('garages', garageId, sessionId);
  },

  updateStaffSession: async (staffId: string, sessionId: string | null) => {
    return firestoreServiceV2.updateSession('staff', staffId, sessionId);
  },

  updateDelegateSession: async (delegateId: string, sessionId: string | null) => {
    return firestoreServiceV2.updateSession('delegates', delegateId, sessionId);
  },

  updateSupervisorSession: async (supervisorId: string, sessionId: string | null) => {
    return firestoreServiceV2.updateSession('supervisors', supervisorId, sessionId);
  },

  updateGeneralManagerSession: async (generalManagerId: string, sessionId: string | null) => {
    return firestoreServiceV2.updateSession('general_managers', generalManagerId, sessionId);
  },

  // Logs
  addActivityLog: async (data: Omit<ActivityLog, 'id'>) => {
    try {
      return await withRetry(() => addDoc(collection(db, 'activity_logs'), {
        ...data,
        timestamp: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activity_logs');
    }
  },

  // Staff
  addStaff: async (data: Omit<Staff, 'id'>) => {
    try {
      if (!data.pin || data.pin.trim().length < 4) {
        throw new Error('الرمز السري للموظف يجب أن يتكون من 4 أرقام على الأقل');
      }
      return await withRetry(() => addDoc(collection(db, 'staff'), data));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff');
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

  updateStaff: async (id: string, data: Partial<Staff>) => {
    try {
      return await withRetry(() => updateDoc(doc(db, 'staff', id), data));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${id}`);
      throw error;
    }
  },

  getStaffByGarageOnce: async (garageId: string) => {
    try {
      const cacheKey = `garage_${garageId}_staff`;
      const cached = localStorage.getItem(cacheKey);
      const isFresh = cached && (Date.now() - parseInt(cached.split('|')[0])) < 300000;
      if (isFresh) {
        try {
          return JSON.parse(cached.substring(cached.indexOf('|') + 1)) as Staff[];
        } catch (e) {}
      }

      const q = query(collection(db, 'staff'), where('garageId', '==', garageId), limit(20));
      const snapshot = await getDocs(q);
      const staff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
      if (staff && staff.length > 0) {
        try {
          localStorage.setItem(cacheKey, `${Date.now()}|${JSON.stringify(staff)}`);
        } catch (e) {}
      }
      return staff;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'staff');
      throw error;
    }
  },

  subscribeToAdminPin: (callback: (pin: string) => void) => {
    return onSnapshot(doc(db, 'admin_settings', 'auth_pin'), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data().pin as string);
      } else {
        callback(ADMIN_PIN);
      }
    }, (err) => {
      console.warn("Admin PIN observer failed or unsubscribed:", err);
      callback(ADMIN_PIN);
    });
  },

  updateAdminPin: async (newPin: string) => {
    try {
      if (!newPin || newPin.trim().length < 6) {
        throw new Error('رمز الآدمن يجب أن يتكون من 6 خانات على الأقل');
      }
      return await withRetry(() => setDoc(doc(db, 'admin_settings', 'auth_pin'), { 
        pin: newPin.trim(),
        updatedAt: serverTimestamp()
      }, { merge: true }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'admin_settings/auth_pin');
      throw error;
    }
  },

  subscribeToWalletNumber: (callback: (wallet: string) => void) => {
    return onSnapshot(doc(db, 'admin_settings', 'wallet_number'), (snapshot) => {
      if (snapshot.exists() && snapshot.data().number) {
        callback(snapshot.data().number as string);
      } else {
        callback("015 - 524 - 113 - 23");
      }
    }, (err) => {
      console.warn("Wallet observer failed or unsubscribed:", err);
      callback("015 - 524 - 113 - 23");
    });
  },

  updateWalletNumber: async (newWallet: string) => {
    try {
      return await withRetry(() => setDoc(doc(db, 'admin_settings', 'wallet_number'), { 
        number: newWallet,
        updatedAt: serverTimestamp()
      }, { merge: true }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'admin_settings/wallet_number');
      throw error;
    }
  },

  subscribeToSubscriptionPrices: (callback: (prices: { weekly: number; biweekly?: number; monthly: number; weeklyDiscount?: number; biweeklyDiscount?: number; monthlyDiscount?: number }) => void) => {
    return onSnapshot(doc(db, 'admin_settings', 'subscription_prices'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        callback({
          weekly: typeof data.weekly === 'number' && data.weekly > 0 ? data.weekly : 800,
          biweekly: typeof data.biweekly === 'number' && data.biweekly > 0 ? data.biweekly : 1500,
          monthly: typeof data.monthly === 'number' && data.monthly > 0 ? data.monthly : 3000,
          weeklyDiscount: typeof data.weeklyDiscount === 'number' && data.weeklyDiscount >= 10 && data.weeklyDiscount <= 50 ? data.weeklyDiscount : undefined,
          biweeklyDiscount: typeof data.biweeklyDiscount === 'number' && data.biweeklyDiscount >= 10 && data.biweeklyDiscount <= 50 ? data.biweeklyDiscount : undefined,
          monthlyDiscount: typeof data.monthlyDiscount === 'number' && data.monthlyDiscount >= 10 && data.monthlyDiscount <= 50 ? data.monthlyDiscount : undefined
        });
      } else {
        callback({ weekly: 800, biweekly: 1500, monthly: 3000 });
      }
    }, (err) => {
      console.warn("Subscription prices observer failed or unsubscribed:", err);
      callback({ weekly: 800, biweekly: 1500, monthly: 3000 });
    });
  },

  isPinTaken: async (pin: string, excludeId?: string): Promise<{ taken: boolean; role?: string; name?: string }> => {
    const normalizedPin = pin.trim();
    if (!normalizedPin) return { taken: false };

    try {
      const settingsSnap = await getDoc(doc(db, 'admin_settings', 'auth_pin'));
      const activeAdminPin = settingsSnap.exists() ? settingsSnap.data()?.pin : ADMIN_PIN;
      if (normalizedPin === activeAdminPin) {
        return { taken: true, role: 'مسؤول النظام (الآدمن الرئيسي)', name: 'الآدمن' };
      }
    } catch (err) {
      console.warn("Failed to check admin pin during uniqueness verification:", err);
    }

    const collectionsToCheck = [
      { name: 'general_managers', label: 'مدير عام / مالك نظام' },
      { name: 'supervisors', label: 'مشرف نظام' },
      { name: 'delegates', label: 'مندوب شحن' },
      { name: 'staff', label: 'موظف جراج' },
      { name: 'garages', label: 'صاحب جراج' }
    ];

    for (const coll of collectionsToCheck) {
      const q = query(collection(db, coll.name), where('pin', '==', normalizedPin), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docFound = snap.docs[0];
        if (excludeId && docFound.id === excludeId) {
          continue;
        }
        const docData = docFound.data();
        return { 
          taken: true, 
          role: coll.label, 
          name: docData.name || docData.ownerName || docData.garageName || 'مستخدم آخر'
        };
      }
    }

    return { taken: false };
  },

  // Vehicles
  getVehiclesInsideOnce: async (garageId: string): Promise<Vehicle[]> => {
    try {
      const q = query(
        collection(db, `garages/${garageId}/vehicles`),
        where('status', '==', 'inside')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      data.sort((a, b) => {
        const timeA = a.entryTime?.toMillis ? a.entryTime.toMillis() : (a.entryTime?.seconds ? a.entryTime.seconds * 1000 : (a.entryTime ? new Date(a.entryTime).getTime() : 0));
        const timeB = b.entryTime?.toMillis ? b.entryTime.toMillis() : (b.entryTime?.seconds ? b.entryTime.seconds * 1000 : (b.entryTime ? new Date(b.entryTime).getTime() : 0));
        return timeB - timeA;
      });
      return data;
    } catch (err) {
      console.error('Error fetching vehicles inside once:', err);
      return [];
    }
  },

  getTodayTransactionsOnce: async (garageId: string): Promise<Vehicle[]> => {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const q = query(
        collection(db, `garages/${garageId}/vehicles`),
        where('exitTime', '>=', Timestamp.fromDate(startOfDay))
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Vehicle))
        .filter(v => v.status === 'outside');
      data.sort((a, b) => {
        const timeA = a.exitTime?.toMillis ? a.exitTime.toMillis() : (a.exitTime?.seconds ? a.exitTime.seconds * 1000 : (a.exitTime ? new Date(a.exitTime).getTime() : 0));
        const timeB = b.exitTime?.toMillis ? b.exitTime.toMillis() : (b.exitTime?.seconds ? b.exitTime.seconds * 1000 : (b.exitTime ? new Date(b.exitTime).getTime() : 0));
        return timeB - timeA;
      });
      return data.slice(0, 100);
    } catch (err) {
      console.error('Error fetching today transactions once:', err);
      return [];
    }
  },

  subscribeToActiveVehicles: (garageId: string, callback: (vehicles: Vehicle[]) => void) => {
    const q = query(
      collection(db, `garages/${garageId}/vehicles`),
      where('status', '==', 'inside'),
      limit(100)
    );
    let cachedData: Vehicle[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as Vehicle;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      const data = [...cachedData];
      data.sort((a, b) => {
        const timeA = a.entryTime?.toMillis ? a.entryTime.toMillis() : (a.entryTime?.seconds ? a.entryTime.seconds * 1000 : (a.entryTime ? new Date(a.entryTime).getTime() : 0));
        const timeB = b.entryTime?.toMillis ? b.entryTime.toMillis() : (b.entryTime?.seconds ? b.entryTime.seconds * 1000 : (b.entryTime ? new Date(b.entryTime).getTime() : 0));
        return timeB - timeA;
      });
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `garages/${garageId}/vehicles`));
  },

  subscribeToTodayTransactions: (garageId: string, callback: (vehicles: Vehicle[]) => void) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const q = query(
      collection(db, `garages/${garageId}/vehicles`),
      where('exitTime', '>=', Timestamp.fromDate(startOfDay))
    );
    let cachedData: Vehicle[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as Vehicle;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      const data = cachedData.filter(v => v.status === 'outside');

      data.sort((a, b) => {
        const timeA = a.exitTime?.toMillis ? a.exitTime.toMillis() : (a.exitTime?.seconds ? a.exitTime.seconds * 1000 : (a.exitTime ? new Date(a.exitTime).getTime() : 0));
        const timeB = b.exitTime?.toMillis ? b.exitTime.toMillis() : (b.exitTime?.seconds ? b.exitTime.seconds * 1000 : (b.exitTime ? new Date(b.exitTime).getTime() : 0));
        return timeB - timeA;
      });

      callback(data.slice(0, 100));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `garages/${garageId}/vehicles`));
  },

  checkInVehicle: async (garageId: string, vehicleData: any): Promise<{ success: boolean; error?: string }> => {
    try {
      await runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const plateRaw = vehicleData.plateNumberRaw;
        const vehicleRef = doc(db, `garages/${garageId}/vehicles`, plateRaw);

        // === DAILY COUNTER LOGIC (Phase 1) ===
        const todayCounter = new Date();
        const dateId = `${todayCounter.getFullYear()}-${String(todayCounter.getMonth() + 1).padStart(2, '0')}-${String(todayCounter.getDate()).padStart(2, '0')}`;
        const countRef = doc(db, `garages/${garageId}/daily_counts/${dateId}`);

        const today = new Date().toISOString().split('T')[0];
        const dailyStatsRef = doc(db, `garages/${garageId}/daily_stats`, today);

        // Read all documents FIRST before executing any writes
        const [garageSnap, countSnap, vehicleSnap, dailyStatsSnap] = await Promise.all([
          transaction.get(garageRef),
          transaction.get(countRef),
          transaction.get(vehicleRef),
          transaction.get(dailyStatsRef)
        ]);
        
        if (!garageSnap.exists()) throw new Error('الجراج غير موجود');
        const garageData = garageSnap.data() || {};
        
        if (isSubscriptionExpired(garageData)) {
          throw new Error('اشتراك الجراج منتهي');
        }
        
        const { used, limit, isUnlimited } = calculateCapacityUsed(garageData);
        if (!isUnlimited && used >= limit) {
          throw new Error('تم الوصول للحد الأقصى اليومي');
        }
        
        if (vehicleSnap.exists() && vehicleSnap.data()?.status === 'inside') {
          throw new Error('العربية مسجلة بالفعل داخل الجراج');
        }
        
        // Execute all writes after all reads complete
        if (!countSnap.exists()) {
          transaction.set(countRef, {
            dateId,
            count: 1,
            limit: isUnlimited ? 0 : limit,
            createdAt: serverTimestamp()
          });
        } else {
          transaction.update(countRef, { count: increment(1) });
        }
        
        transaction.set(vehicleRef, {
          ...vehicleData,
          id: plateRaw,
          plate: vehicleData.plateNumber,
          entryTime: serverTimestamp(),
          status: 'inside',
          staffId: vehicleData.staffId ?? null,
          staffName: vehicleData.staffName || 'مدير الجراج',
        });
        
        const isNewDay = garageData.lastTransactionDate !== today;
        
        transaction.update(garageRef, {
          carsInside: increment(1),
          todayCount: isNewDay ? 1 : increment(1),
          lastTransactionDate: today
        });

        // Update daily_stats subcollection (authoritative backup)
        if (!dailyStatsSnap.exists()) {
          transaction.set(dailyStatsRef, {
            dateId: today,
            count: 1,
            revenue: 0,
            createdAt: serverTimestamp()
          });
        } else {
          transaction.update(dailyStatsRef, { count: increment(1) });
        }

        // Write activity log INSIDE the transaction
        const logRef = doc(collection(db, 'activity_logs'));
        transaction.set(logRef, {
          garageId: garageId,
          garageName: garageData.name || '',
          staffId: vehicleData.staffId || null,
          staffName: vehicleData.staffName || 'مدير الجراج',
          actionType: 'check_in',
          plateNumber: vehicleData.plateNumber,
          timestamp: serverTimestamp(),
          amount: 0
        });
      });
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ' };
    }
  },

  checkOutVehicle: async (garageId: string, vehicleId: string, cost: number, staffName?: string, staffId?: string): Promise<{ success: boolean; error?: string }> => {
    if (cost < 0) return { success: false, error: 'المبلغ غير صالح' };
    
    try {
      await runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const vehicleRef = doc(db, `garages/${garageId}/vehicles`, vehicleId);
        const today = new Date().toISOString().split('T')[0];
        const dailyStatsRef = doc(db, `garages/${garageId}/daily_stats`, today);
        
        const [vehicleSnap, garageSnap, dailyStatsSnap] = await Promise.all([
          transaction.get(vehicleRef),
          transaction.get(garageRef),
          transaction.get(dailyStatsRef)
        ]);
        
        if (!vehicleSnap.exists()) throw new Error('العربية غير موجودة');
        if (!garageSnap.exists()) throw new Error('الجراج غير موجود');
        
        const vehicleData = vehicleSnap.data() || {};
        if (vehicleData.status === 'outside') throw new Error('العربية خرجت بالفعل');
        
        transaction.update(vehicleRef, {
          status: 'outside',
          exitTime: serverTimestamp(),
          totalCost: cost
        });
        
        const garageData = garageSnap.data() || {};
        const isNewDay = garageData.lastTransactionDate !== today;
        
        transaction.update(garageRef, {
          totalRevenue: increment(cost),
          totalVehiclesOut: increment(1),
          todayRevenue: isNewDay ? cost : increment(cost),
          lastTransactionDate: today,
          carsInside: increment(-1)
        });

        // Update daily_stats revenue
        if (!dailyStatsSnap.exists()) {
          transaction.set(dailyStatsRef, {
            dateId: today,
            count: 0,
            revenue: cost,
            createdAt: serverTimestamp()
          });
        } else {
          transaction.update(dailyStatsRef, { revenue: increment(cost) });
        }

        // Write activity log INSIDE the transaction
        const logRef = doc(collection(db, 'activity_logs'));
        transaction.set(logRef, {
          garageId: garageId,
          garageName: garageData.name || '',
          staffId: staffId || null,
          staffName: staffName || 'مدير الجراج',
          actionType: 'check_out',
          plateNumber: vehicleData.plateNumber,
          timestamp: serverTimestamp(),
          amount: cost
        });
      });
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ' };
    }
  },

  deleteVehicleWithRefund: async (garageId: string, vehicleId: string, refundAmount: number, _passedTodayYMD?: string, staffName?: string, staffId?: string) => {
    try {
      return await withRetry(() => runTransaction(db, async (transaction) => {
        const todayYMD = new Date().toISOString().split('T')[0]; // compute fresh; never use the passed stale date
        const vehicleRef = doc(db, `garages/${garageId}/vehicles`, vehicleId);
        const garageRef = doc(db, 'garages', garageId);
        const countRef = doc(db, `garages/${garageId}/daily_counts/${todayYMD}`);
        const dailyStatsRef = doc(db, `garages/${garageId}/daily_stats/${todayYMD}`);
        
        // Read all documents FIRST before executing any writes
        const [vehicleDoc, garageDoc, countDoc, dailyStatsDoc] = await Promise.all([
          transaction.get(vehicleRef),
          transaction.get(garageRef),
          transaction.get(countRef),
          transaction.get(dailyStatsRef)
        ]);
        
        if (!vehicleDoc.exists() || !garageDoc.exists()) return false; 
        
        const garageData = garageDoc.data() || {};
        const vehicleData = vehicleDoc.data() || {};

        const todayDeletions = garageData.lastDeletionDate === todayYMD ? (garageData.dailyDeletionCount ?? 0) : 0;
        if (todayDeletions >= 3) {
          throw new Error('reached_daily_deletion_limit');
        }

        transaction.delete(vehicleRef);

        const isSameRefundDay = garageData.lastRefundDate === todayYMD;
        const updates: any = {
          isLocked: false,
          dailyDeletionCount: todayDeletions + 1,
          lastDeletionDate: todayYMD,
          dailyRefundCount: isSameRefundDay ? ((garageData.dailyRefundCount ?? 0) + 1) : 1,
          lastRefundDate: todayYMD
        };

        if (refundAmount > 0) {
          updates.balance = increment(refundAmount);
        }

        if (vehicleData.status === 'inside') {
          updates.carsInside = increment(-1);
          updates.todayCount = increment(-1);
        }

        transaction.update(garageRef, updates);

        // Rollback daily counters if the deleted vehicle was still inside
        if (vehicleData.status === 'inside') {
          if (countDoc.exists()) {
            const prevCount = countDoc.data()?.count ?? 0;
            if (prevCount > 0) {
              transaction.update(countRef, { count: prevCount - 1 });
            }
          }
          if (dailyStatsDoc.exists()) {
            const prevCount = dailyStatsDoc.data()?.count ?? 0;
            if (prevCount > 0) {
              transaction.update(dailyStatsRef, { count: prevCount - 1 });
            }
          }
        }

        // Write activity log INSIDE the transaction
        const logRef = doc(collection(db, 'activity_logs'));
        transaction.set(logRef, {
          garageId: garageId,
          garageName: garageData.name || '',
          staffId: staffId || vehicleData.staffId || null,
          staffName: staffName || vehicleData.staffName || 'مدير الجراج',
          actionType: 'delete_refund',
          plateNumber: `مسح لوحة: ${vehicleData.plateNumber || vehicleId}`,
          timestamp: serverTimestamp(),
          amount: refundAmount
        });

        return true;
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `garages/${garageId}/vehicles/${vehicleId}`);
      throw error;
    }
  },

  // Supervisors
  addSupervisor: async (data: Omit<Supervisor, 'id'>) => {
    try {
      if (!data.pin || data.pin.trim().length < 4) {
        throw new Error('الرمز السري للمشرف يجب أن يتكون من 4 أرقام على الأقل');
      }
      return await withRetry(() => addDoc(collection(db, 'supervisors'), {
        ...data,
        adminPin: ADMIN_PIN,
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
    let cachedData: Supervisor[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as Supervisor;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      callback([...cachedData]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'supervisors'));
  },

  updateSupervisor: async (id: string, data: Partial<Supervisor>) => {
    try {
      return await withRetry(() => updateDoc(doc(db, 'supervisors', id), data));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supervisors/${id}`);
      throw error;
    }
  },

  // General Managers
  addGeneralManager: async (data: Omit<GeneralManager, 'id'>) => {
    try {
      return await withRetry(() => addDoc(collection(db, 'general_managers'), {
        ...data,
        createdAt: serverTimestamp()
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'general_managers');
      throw error;
    }
  },

  removeGeneralManager: async (id: string) => {
    try {
      return await withRetry(() => deleteDoc(doc(db, 'general_managers', id)));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `general_managers/${id}`);
      throw error;
    }
  },

  updateGeneralManager: async (id: string, data: Partial<GeneralManager>) => {
    try {
      return await withRetry(() => updateDoc(doc(db, 'general_managers', id), data));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `general_managers/${id}`);
      throw error;
    }
  },

  subscribeToGeneralManagers: (callback: (generalManagers: GeneralManager[]) => void) => {
    const q = query(collection(db, 'general_managers'), orderBy('createdAt', 'desc'));
    let cachedData: GeneralManager[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as GeneralManager;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      callback([...cachedData]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'general_managers'));
  },

  // Delegates
  addDelegate: async (data: Omit<Delegate, 'id'>) => {
    try {
      return await withRetry(() => addDoc(collection(db, 'delegates'), {
        ...data,
        adminPin: ADMIN_PIN,
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
    let cachedData: Delegate[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as Delegate;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      callback([...cachedData]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'delegates'));
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
      return await withRetry(() => updateDoc(doc(db, 'delegates', id), data));
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
        where('actionType', '==', 'recharge')
      );
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      logs.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0));
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0));
        return timeB - timeA;
      });
      return logs.slice(0, 50);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'activity_logs');
      throw error;
    }
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
    let cachedData: any[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() };
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      callback([...cachedData]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `garages/${garageId}/subscribers`));
  },

  addSubscriber: async (garageId: string, subscriberData: any) => {
    try {
      return await withRetry(() => runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const garageDoc = await transaction.get(garageRef);
        
        if (!garageDoc.exists()) {
          throw new Error('GARAGE_NOT_FOUND');
        }
        
        const subscribersCol = collection(db, `garages/${garageId}/subscribers`);
        const subscriberRef = doc(subscribersCol);
        
        transaction.set(subscriberRef, {
          ...subscriberData,
          id: subscriberRef.id,
          createdAt: serverTimestamp()
        });

        return subscriberRef.id;
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `garages/${garageId}/subscribers`);
      throw error;
    }
  },

  renewSubscriber: async (garageId: string, subscriberId: string, _costUnits: number, newDates: { startDate: string, endDate: string }) => {
    try {
      return await withRetry(() => runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const garageDoc = await transaction.get(garageRef);
        
        if (!garageDoc.exists()) {
          throw new Error('GARAGE_NOT_FOUND');
        }

        const subscriberRef = doc(db, `garages/${garageId}/subscribers`, subscriberId);
        
        transaction.update(subscriberRef, {
          startDate: newDates.startDate,
          endDate: newDates.endDate
        });

        return true;
      }));
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

  // Recharge Requests
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

  getPendingRechargeRequestsForGarage: async (garageId: string) => {
    try {
      const q = query(
        collection(db, 'recharge_requests'),
        where('garageId', '==', garageId)
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
    let cachedData: RechargeRequest[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as RechargeRequest;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      const requests = [...cachedData];
      requests.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0));
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0));
        return timeB - timeA;
      });
      callback(requests);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'recharge_requests'));
  },

  subscribeToDelegateRechargeRequests: (delegateId: string, callback: (requests: RechargeRequest[]) => void) => {
    const q = query(
      collection(db, 'recharge_requests'),
      where('delegateId', '==', delegateId),
      limit(20)
    );
    let cachedData: RechargeRequest[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as RechargeRequest;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      callback([...cachedData]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'recharge_requests'));
  },

  approveRechargeRequest: async (request: any): Promise<{ success: boolean; error?: string }> => {
    const validation = validateRechargeRequest(request);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(' — ') };
    }
    
    try {
      await runTransaction(db, async (transaction) => {
        const requestRef = doc(db, 'recharge_requests', request.id);
        const requestSnap = await transaction.get(requestRef);
        
        if (!requestSnap.exists()) throw new Error('الطلب غير موجود');
        const currentStatus = requestSnap.data()?.status;
        if (currentStatus !== 'pending') throw new Error('الطلب تم معالجته مسبقاً');
        
        const garageRef = doc(db, 'garages', request.garageId);
        const garageSnap = await transaction.get(garageRef);
        const garageData = garageSnap.data() || {};
        
        let baseDate = new Date();
        const currentExpiry = garageData.balanceExpiry;
        if (currentExpiry) {
          const expDate = currentExpiry.toDate ? currentExpiry.toDate() : new Date(currentExpiry);
          if (expDate > baseDate) baseDate = expDate;
        }
        
        let days = 30;
        const pkgDays = packageIdToDays(request.packageId, request.packageName);
        days = Math.min(pkgDays, 365);
        if (request.durationDays && typeof request.durationDays === 'number' && request.durationDays > 0 && request.durationDays <= 365) {
          days = request.durationDays;
        } else if (request.carsCount && typeof request.carsCount === 'number' && request.carsCount > 0 && request.carsCount <= 365) {
          days = request.carsCount;
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
          } else if (request.carsCount && request.carsCount > 0 && request.carsCount <= 1000 && ![7, 15, 30].includes(request.carsCount)) {
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
          totalAdminRevenue: increment(request.revenueAmount),
          lastRechargeDate: serverTimestamp()
        });
        
        transaction.update(requestRef, {
          status: 'approved',
          resolvedAt: serverTimestamp()
        });
        
        if (request.delegateId) {
          const delegateRef = doc(db, 'delegates', request.delegateId);
          transaction.update(delegateRef, {
            totalRechargedAmount: increment(request.revenueAmount)
          });
        }

        const logRef = doc(collection(db, 'activity_logs'));
        transaction.set(logRef, {
          garageId: request.garageId,
          garageName: request.garageName,
          staffId: request.delegateId,
          staffName: request.delegateName,
          actionType: 'recharge',
          plateNumber: `شحن ${request.packageName} (${request.durationDays || 30} يوم - ${request.dailyCapacity || request.carsCount || 0} سيارة) - الأصلي ${request.originalRevenueAmount !== undefined ? request.originalRevenueAmount : request.revenueAmount} ج${request.discountAmount ? ` | بعد الخصم ${request.revenueAmount} ج` : ''}`,
          timestamp: serverTimestamp(),
          amount: request.revenueAmount,
          packageId: request.packageId,
          details: {
            packageName: request.packageName,
            durationDays: request.durationDays || 30,
            carsCount: request.dailyCapacity || request.carsCount || 0,
            revenueAmount: request.revenueAmount,
            originalRevenueAmount: request.originalRevenueAmount,
            discountAmount: request.discountAmount,
            couponCode: request.couponCode,
            requestId: request.id
          }
        });
      });
      
      try {
        await firestoreServiceV2.processReferralRewardForRecharge(request.garageId);
      } catch (err) {
        console.error('Failed processing referral reward after recharge approval:', err);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء اعتماد الطلب' };
    }
  },

  rejectRechargeRequest: async (requestId: string) => {
    try {
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
  },

  // System logs
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

  subscribeToGarageRechargeLogs: (garageId: string, callback: (logs: ActivityLog[]) => void, limitCount = 50) => {
    const q = query(
      collection(db, 'activity_logs'),
      where('garageId', '==', garageId),
      where('actionType', '==', 'recharge'),
      limit(limitCount)
    );
    let cachedData: ActivityLog[] = [];
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const id = change.doc.id;
        const data = { id, ...change.doc.data() } as ActivityLog;
        if (change.type === 'added') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'modified') {
          const idx = cachedData.findIndex(d => d.id === id);
          if (idx !== -1) cachedData[idx] = data;
          else cachedData.push(data);
        } else if (change.type === 'removed') {
          cachedData = cachedData.filter(d => d.id !== id);
        }
      });
      const data = [...cachedData];
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0));
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0));
        return timeB - timeA;
      });
      callback(data.slice(0, limitCount));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs'));
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

  subscribeToSystemConfig: (callback: (config: SystemConfig | null) => void) => {
    return onSnapshot(doc(db, 'system_config', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as SystemConfig);
      } else {
        const defaults: SystemConfig = { 
          defaultTrialDays: 15, 
          warningDaysThreshold: 3, 
          supportPhone: '01000000000',
          walletNumber: '01000000000',
          monthlySubscribersSurchargePercent: 25,
          isMaintenanceMode: false,
          maintenanceMessage: ''
        };
        setDoc(doc(db, 'system_config', 'global'), defaults, { merge: true })
          .then(() => callback(defaults))
          .catch(() => callback(null));
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'system_config/global');
      callback(null);
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
        monthlySubscribersSurchargePercent: 25,
        isMaintenanceMode: false,
        maintenanceMessage: ''
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
