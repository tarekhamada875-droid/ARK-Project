/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
  deleteField,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { Garage, Staff, ActivityLog, Vehicle, Delegate, Package, RechargeRequest, Supervisor, GeneralManager } from '../types';
import { ADMIN_PIN } from '../constants';

export type { Garage, Staff, ActivityLog, Vehicle, Delegate, Package, RechargeRequest, Supervisor, GeneralManager };

export const firestoreService = {
  // Garages
  subscribeToGarages: (callback: (garages: Garage[]) => void) => {
    // Only fetch once for the list to save reads in high-traffic scenarios
    const q = query(collection(db, 'garages'), limit(100));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Garage));
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'garages'));
  },

  subscribeToGarage: (garageId: string, callback: (garage: Garage) => void) => {
    return onSnapshot(doc(db, 'garages', garageId), (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as Garage);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `garages/${garageId}`));
  },

  createGarage: async (data: Omit<Garage, 'id'>) => {
    try {
      return await addDoc(collection(db, 'garages'), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'garages');
      throw error;
    }
  },

  updateGarage: async (id: string, data: Partial<Garage>) => {
    try {
      return await updateDoc(doc(db, 'garages', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${id}`);
      throw error;
    }
  },

  rechargeGarage: async (garageId: string, amount: number, carsCount: number, revenueAmount: number) => {
    try {
      const batch = writeBatch(db);
      const garageRef = doc(db, 'garages', garageId);
      
      batch.update(garageRef, {
        balance: increment(amount),
        totalAdminRevenue: increment(revenueAmount),
        totalRechargedCars: increment(carsCount),
        isLocked: false,
        lastRechargeDate: serverTimestamp()
      });

      return await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/recharge`);
      throw error;
    }
  },

  awardMonthlyGift: async (garageId: string, month: string, carsCount: number) => {
    try {
      await runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const garageDoc = await transaction.get(garageRef);
        
        if (!garageDoc.exists()) return;
        
        const garageData = garageDoc.data() as Garage;
        
        // Final double-check to prevent double awarding
        if (garageData.lastGiftMonth === month) return;

        const commission = garageData.commissionPerVehicle || 1;
        const balanceIncrement = carsCount * commission;

        transaction.update(garageRef, {
          balance: increment(balanceIncrement),
          totalRechargedCars: increment(carsCount),
          lastGiftMonth: month,
          lastGiftAwardedAt: serverTimestamp(),
          isLocked: false // Gifts can unlock a garage
        });
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/gift`);
    }
  },

  deleteGarage: async (id: string) => {
    try {
      // Helper to fetch snaps safely (returns empty snap on error like missing index)
      const fetchSnapSafe = async (q: any) => {
        try {
          return await getDocs(q);
        } catch (e) {
          console.warn('Subcollection fetch failed during garage deletion (likely missing index):', e);
          return { forEach: () => {} } as any; 
        }
      };

      // 1. Get subcollections and associated docs (limiting to stay under 500 batch limit)
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
      
      // Add the main garage document
      refsToDelete.push(doc(db, 'garages', id));

      // 2. Commit in chunks of 400 to stay safely below Firestore's 500 limit
      const chunkSize = 400;
      for (let i = 0; i < refsToDelete.length; i += chunkSize) {
        const chunk = refsToDelete.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      return true;
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

  updateSession: async (collectionName: 'garages' | 'staff' | 'delegates' | 'supervisors' | 'general_managers', id: string, sessionId: string | null) => {
    try {
      await updateDoc(doc(db, collectionName, id), { 
          currentSessionId: sessionId,
          lastActive: sessionId ? serverTimestamp() : null
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
      }
    },

  // Legacy wrappers for compatibility
  updateGarageSession: async (garageId: string, sessionId: string | null) => {
    return firestoreService.updateSession('garages', garageId, sessionId);
  },

  updateStaffSession: async (staffId: string, sessionId: string | null) => {
    return firestoreService.updateSession('staff', staffId, sessionId);
  },

  updateDelegateSession: async (delegateId: string, sessionId: string | null) => {
    return firestoreService.updateSession('delegates', delegateId, sessionId);
  },

  updateSupervisorSession: async (supervisorId: string, sessionId: string | null) => {
    return firestoreService.updateSession('supervisors', supervisorId, sessionId);
  },

  updateGeneralManagerSession: async (generalManagerId: string, sessionId: string | null) => {
    return firestoreService.updateSession('general_managers', generalManagerId, sessionId);
  },

  subscribeToSession: (collectionName: 'garages' | 'staff' | 'delegates' | 'supervisors' | 'general_managers', id: string, callback: (sessionId: string | undefined) => void) => {
    return onSnapshot(doc(db, collectionName, id), (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data().currentSessionId);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `${collectionName}/${id}`));
  },

  // Logs
  addActivityLog: async (data: Omit<ActivityLog, 'id'>) => {
    try {
      return await addDoc(collection(db, 'activity_logs'), {
        ...data,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activity_logs');
    }
  },

  // Staff
  addStaff: async (data: Omit<Staff, 'id'>) => {
    try {
      return await addDoc(collection(db, 'staff'), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'staff');
      throw error;
    }
  },

  removeStaff: async (id: string) => {
    try {
      return await deleteDoc(doc(db, 'staff', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${id}`);
      throw error;
    }
  },

  updateStaff: async (id: string, data: Partial<Staff>) => {
    try {
      return await updateDoc(doc(db, 'staff', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${id}`);
      throw error;
    }
  },

  getStaffByGarageOnce: async (garageId: string) => {
    try {
      const q = query(collection(db, 'staff'), where('garageId', '==', garageId));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff));
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
      return await setDoc(doc(db, 'admin_settings', 'auth_pin'), { 
        pin: newPin,
        updatedAt: serverTimestamp()
      }, { merge: true });
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
      return await setDoc(doc(db, 'admin_settings', 'wallet_number'), { 
        number: newWallet,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'admin_settings/wallet_number');
      throw error;
    }
  },

  // Vehicles
  subscribeToActiveVehicles: (garageId: string, callback: (vehicles: Vehicle[]) => void) => {
    const q = query(
      collection(db, `garages/${garageId}/vehicles`),
      where('status', '==', 'inside')
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      // Sort descending by entryTime in-memory to avoid needing a composite index
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
    
    // Querying only by exitTime >= startOfDay.
    // This only uses a single field for filtering, so it doesn't require composite indexes.
    const q = query(
      collection(db, `garages/${garageId}/vehicles`),
      where('exitTime', '>=', Timestamp.fromDate(startOfDay))
    );
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Vehicle))
        .filter(v => v.status === 'outside');

      // Sort descending by exitTime
      data.sort((a, b) => {
        const timeA = a.exitTime?.toMillis ? a.exitTime.toMillis() : (a.exitTime?.seconds ? a.exitTime.seconds * 1000 : (a.exitTime ? new Date(a.exitTime).getTime() : 0));
        const timeB = b.exitTime?.toMillis ? b.exitTime.toMillis() : (b.exitTime?.seconds ? b.exitTime.seconds * 1000 : (b.exitTime ? new Date(b.exitTime).getTime() : 0));
        return timeB - timeA;
      });

      callback(data.slice(0, 100));
    }, (err) => handleFirestoreError(err, OperationType.LIST, `garages/${garageId}/vehicles`));
  },

  checkInVehicle: async (garageId: string, vehicleData: Omit<Vehicle, 'id'>, commission: number) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const garageDoc = await transaction.get(garageRef);
        
        if (!garageDoc.exists()) throw new Error('GARAGE_NOT_FOUND');
        
        const plateRaw = vehicleData.plateNumberRaw;
        
        // Final guard inside transaction using deterministic active vehicle ID in the subcollection
        const vehicleRef = doc(db, `garages/${garageId}/vehicles`, plateRaw);
        const vehicleDoc = await transaction.get(vehicleRef);
        
        if (vehicleDoc.exists() && vehicleDoc.data()?.status === 'inside') {
          throw new Error('ALREADY_INSIDE');
        }

        // 1. Create/Update vehicle record using plateRaw as the deterministic active ID
        transaction.set(vehicleRef, {
          ...vehicleData,
          id: plateRaw,
          entryTime: serverTimestamp()
        });

        // 2. Update garage balance (completely free of the activePlates map update)
        transaction.update(garageRef, {
          balance: increment(-commission),
          carsInside: increment(1)
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `garages/${garageId}/vehicles/checkin`);
      throw error;
    }
  },


  checkOutVehicle: async (garageId: string, vehicleId: string, cost: number) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const vehicleRef = doc(db, `garages/${garageId}/vehicles`, vehicleId);
        const today = new Date().toISOString().split('T')[0];

        const [vehicleDoc, garageDoc] = await Promise.all([
          transaction.get(vehicleRef),
          transaction.get(garageRef)
        ]);

        if (!vehicleDoc.exists()) throw new Error('VEHICLE_NOT_FOUND');
        if (!garageDoc.exists()) throw new Error('GARAGE_NOT_FOUND');

        const vehicleData = vehicleDoc.data();
        if (vehicleData.status === 'outside') {
          throw new Error('ALREADY_OUTSIDE');
        }

        // 1. Update vehicle record status to outside, set exitTime and totalCost
        transaction.update(vehicleRef, {
          status: 'outside',
          exitTime: serverTimestamp(),
          totalCost: cost
        });

        const garageDocData = garageDoc.data();
        const isNewDay = garageDocData.lastTransactionDate !== today;

        // 2. Update garage stats and remove the deprecated recentExits array
        const updateData: any = {
          totalRevenue: increment(cost),
          totalVehiclesOut: increment(1),
          todayRevenue: isNewDay ? cost : increment(cost),
          todayCount: isNewDay ? 1 : increment(1),
          lastTransactionDate: today,
          carsInside: increment(-1),
          recentExits: deleteField() // Completely free the garage document from the list limit
        };

        transaction.update(garageRef, updateData);
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/vehicles/${vehicleId}/checkout`);
      throw error;
    }
  },

  deleteVehicleWithRefund: async (garageId: string, vehicleId: string, refundAmount: number, todayYMD: string) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const vehicleRef = doc(db, `garages/${garageId}/vehicles`, vehicleId);
        const garageRef = doc(db, 'garages', garageId);
        
        const [vehicleDoc, garageDoc] = await Promise.all([
          transaction.get(vehicleRef),
          transaction.get(garageRef)
        ]);
        
        if (!vehicleDoc.exists() || !garageDoc.exists()) return false; 
        
        // 1. Delete the record
        transaction.delete(vehicleRef);

        // 2. Refund balance and remove lock if active
        const isSameDay = garageDoc.data()?.lastRefundDate === todayYMD;
        const updates: any = {
          balance: increment(refundAmount),
          isLocked: false,
          dailyRefundCount: isSameDay ? increment(1) : 1,
          lastRefundDate: todayYMD,
          carsInside: increment(-1)
        };

        transaction.update(garageRef, updates);
        return true;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `garages/${garageId}/vehicles/${vehicleId}`);
      throw error;
    }
  },

  // Supervisors
  addSupervisor: async (data: Omit<Supervisor, 'id'>) => {
    try {
      return await addDoc(collection(db, 'supervisors'), {
        ...data,
        adminPin: ADMIN_PIN,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'supervisors');
      throw error;
    }
  },

  removeSupervisor: async (id: string) => {
    try {
      return await deleteDoc(doc(db, 'supervisors', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `supervisors/${id}`);
      throw error;
    }
  },

  getSupervisors: async () => {
    try {
      const q = query(collection(db, 'supervisors'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supervisor));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'supervisors');
      throw error;
    }
  },

  subscribeToSupervisors: (callback: (supervisors: Supervisor[]) => void) => {
    const q = query(collection(db, 'supervisors'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supervisor));
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'supervisors'));
  },

  updateSupervisor: async (id: string, data: Partial<Supervisor>) => {
    try {
      return await updateDoc(doc(db, 'supervisors', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `supervisors/${id}`);
      throw error;
    }
  },

  // General Managers
  addGeneralManager: async (data: Omit<GeneralManager, 'id'>) => {
    try {
      return await addDoc(collection(db, 'general_managers'), {
        ...data,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'general_managers');
      throw error;
    }
  },

  removeGeneralManager: async (id: string) => {
    try {
      return await deleteDoc(doc(db, 'general_managers', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `general_managers/${id}`);
      throw error;
    }
  },

  updateGeneralManager: async (id: string, data: Partial<GeneralManager>) => {
    try {
      return await updateDoc(doc(db, 'general_managers', id), data);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `general_managers/${id}`);
      throw error;
    }
  },

  subscribeToGeneralManagers: (callback: (generalManagers: GeneralManager[]) => void) => {
    const q = query(collection(db, 'general_managers'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneralManager));
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'general_managers'));
  },

  // Delegates
  addDelegate: async (data: Omit<Delegate, 'id'>) => {
    try {
      return await addDoc(collection(db, 'delegates'), {
        ...data,
        adminPin: ADMIN_PIN,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'delegates');
      throw error;
    }
  },

  removeDelegate: async (id: string) => {
    try {
      return await deleteDoc(doc(db, 'delegates', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `delegates/${id}`);
      throw error;
    }
  },

  getDelegates: async () => {
    try {
      const q = query(collection(db, 'delegates'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delegate));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'delegates');
      throw error;
    }
  },

  subscribeToDelegates: (callback: (delegates: Delegate[]) => void) => {
    const q = query(collection(db, 'delegates'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Delegate));
      callback(data);
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
      return await updateDoc(doc(db, 'delegates', id), data);
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
      // In-memory sorting to prevent the need for a composite Firestore index
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
  getPackages: async (): Promise<Package[]> => {
    const q = query(collection(db, 'packages'), where('isActive', '==', true));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package));
  },

  addPackage: async (pkg: Omit<Package, 'id' | 'createdAt' | 'isActive'>): Promise<void> => {
    await addDoc(collection(db, 'packages'), {
      ...pkg,
      isActive: true,
      createdAt: serverTimestamp()
    });
  },

  deletePackage: async (id: string): Promise<void> => {
    const docRef = doc(db, 'packages', id);
    await updateDoc(docRef, { isActive: false });
  },

  subscribeToPackages: (callback: (packages: Package[]) => void) => {
    const q = query(collection(db, 'packages'), where('isActive', '==', true));
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Package)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'packages'));
  },

  resetTotalAdminRevenue: async (garages: Garage[]) => {
    try {
      const batch = writeBatch(db);
      garages.forEach(g => {
        batch.update(doc(db, 'garages', g.id), {
          totalAdminRevenue: 0
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'garages/all');
      throw error;
    }
  },

  // Subscribers
  subscribeToSubscribers: (garageId: string, callback: (subscribers: any[]) => void) => {
    const q = query(
      collection(db, `garages/${garageId}/subscribers`),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, `garages/${garageId}/subscribers`));
  },

  addSubscriber: async (garageId: string, subscriberData: any) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const garageDoc = await transaction.get(garageRef);
        
        if (!garageDoc.exists()) {
          throw new Error('GARAGE_NOT_FOUND');
        }
        
        const garageData = garageDoc.data() as Garage;
        const commissionVal = (garageData.commissionPerVehicle !== undefined) ? garageData.commissionPerVehicle : 1;
        const requiredDeduction = 5 * commissionVal;
        const currentBalance = garageData.balance || 0;
        
        if (currentBalance < requiredDeduction) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        const subscribersCol = collection(db, `garages/${garageId}/subscribers`);
        const subscriberRef = doc(subscribersCol);
        
        transaction.set(subscriberRef, {
          ...subscriberData,
          id: subscriberRef.id,
          createdAt: serverTimestamp()
        });

        transaction.update(garageRef, {
          balance: increment(-requiredDeduction)
        });

        return subscriberRef.id;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `garages/${garageId}/subscribers`);
      throw error;
    }
  },

  renewSubscriber: async (garageId: string, subscriberId: string, costUnits: number, newDates: { startDate: string, endDate: string }) => {
    try {
      return await runTransaction(db, async (transaction) => {
        const garageRef = doc(db, 'garages', garageId);
        const garageDoc = await transaction.get(garageRef);
        
        if (!garageDoc.exists()) {
          throw new Error('GARAGE_NOT_FOUND');
        }
        
        const garageData = garageDoc.data() as Garage;
        const commissionVal = (garageData.commissionPerVehicle !== undefined) ? garageData.commissionPerVehicle : 1;
        const requiredDeduction = costUnits * commissionVal;
        const currentBalance = garageData.balance || 0;
        
        if (currentBalance < requiredDeduction) {
          throw new Error('INSUFFICIENT_BALANCE');
        }

        const subscriberRef = doc(db, `garages/${garageId}/subscribers`, subscriberId);
        
        transaction.update(subscriberRef, {
          startDate: newDates.startDate,
          endDate: newDates.endDate
        });

        transaction.update(garageRef, {
          balance: increment(-requiredDeduction)
        });

        return true;
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/subscribers/${subscriberId}/renew`);
      throw error;
    }
  },

  updateSubscriber: async (garageId: string, subscriberId: string, subscriberData: any) => {
    try {
      return await updateDoc(doc(db, `garages/${garageId}/subscribers`, subscriberId), subscriberData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/subscribers`);
      throw error;
    }
  },

  deleteSubscriber: async (garageId: string, subscriberId: string) => {
    try {
      return await deleteDoc(doc(db, `garages/${garageId}/subscribers`, subscriberId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `garages/${garageId}/subscribers`);
      throw error;
    }
  },

  // Recharge Requests
  createRechargeRequest: async (data: Omit<RechargeRequest, 'id' | 'status' | 'createdAt'>) => {
    try {
      return await addDoc(collection(db, 'recharge_requests'), {
        ...data,
        status: 'pending',
        createdAt: serverTimestamp()
      });
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
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
      // In-memory sorting to prevent the need for a composite Firestore index
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
      where('delegateId', '==', delegateId)
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RechargeRequest));
      callback(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'recharge_requests'));
  },

  approveRechargeRequest: async (request: RechargeRequest) => {
    try {
      const batch = writeBatch(db);
      const requestRef = doc(db, 'recharge_requests', request.id);
      const garageRef = doc(db, 'garages', request.garageId);
      const delegateRef = doc(db, 'delegates', request.delegateId);
      
      // 1. Update Garage
      batch.update(garageRef, {
        balance: increment(request.amount),
        totalAdminRevenue: increment(request.revenueAmount),
        totalRechargedCars: increment(request.carsCount),
        isLocked: false,
        lastRechargeDate: serverTimestamp()
      });

      // 2. Update Delegate
      batch.update(delegateRef, {
        totalRechargedAmount: increment(request.revenueAmount)
      });

      // 3. Update Request Status
      batch.update(requestRef, {
        status: 'approved',
        resolvedAt: serverTimestamp()
      });

      // 4. Add Activity Log
      const logRef = doc(collection(db, 'activity_logs'));
      batch.set(logRef, {
        garageId: request.garageId,
        garageName: request.garageName,
        staffId: request.delegateId,
        staffName: request.delegateName,
        actionType: 'recharge',
        plateNumber: `شحن ${request.packageName} (${request.carsCount} سيارة) - ${request.revenueAmount} ج`,
        timestamp: serverTimestamp(),
        amount: request.revenueAmount,
        packageId: request.packageId
      });

      return await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recharge_requests/${request.id}/approve`);
      throw error;
    }
  },

  rejectRechargeRequest: async (requestId: string) => {
    try {
      return await updateDoc(doc(db, 'recharge_requests', requestId), {
        status: 'rejected',
        resolvedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recharge_requests/${requestId}/reject`);
      throw error;
    }
  },

  // System logs
  subscribeToActivityLogs: (callback: (logs: ActivityLog[]) => void, limitCount = 50) => {
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs'));
  },

  subscribeToGarageActivityLogs: (garageId: string, callback: (logs: ActivityLog[]) => void, limitCount = 100) => {
    const q = query(
      collection(db, 'activity_logs'),
      where('garageId', '==', garageId)
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      // Sort descending by timestamp
      data.sort((a, b) => {
        const timeA = a.timestamp?.toMillis ? a.timestamp.toMillis() : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0));
        const timeB = b.timestamp?.toMillis ? b.timestamp.toMillis() : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0));
        return timeB - timeA;
      });
      callback(data.slice(0, limitCount));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'activity_logs'));
  },

  subscribeToGarageRechargeLogs: (garageId: string, callback: (logs: ActivityLog[]) => void, limitCount = 100) => {
    const q = query(
      collection(db, 'activity_logs'),
      where('garageId', '==', garageId),
      where('actionType', '==', 'recharge')
    );
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLog));
      // Sort descending by timestamp
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
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `garages/${garageId}/recalculateCarsInside`);
      throw error;
    }
  }
};
