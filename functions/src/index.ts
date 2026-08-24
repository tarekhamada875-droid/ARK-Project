import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// ============================================
// GARAGE CREATION VALIDATION
// ============================================
export const validateGarageOnCreate = functions.firestore
  .document('garages/{garageId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const garageId = context.params.garageId;
    const garageRef = db.collection('garages').doc(garageId);
    
    // Fix: Ensure balanceExpiry is always set
    if (!data.balanceExpiry) {
      if (data.isTrial === true) {
        // Set 15-day trial expiry
        const expiry = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
        await garageRef.update({ 
          balanceExpiry: admin.firestore.Timestamp.fromDate(expiry),
          dailyCapacity: 0
        });
      } else {
        // No expiry and not trial — delete this invalid document
        await garageRef.delete();
        console.error(`Deleted invalid garage ${garageId}: no balanceExpiry`);
        return;
      }
    }
    
    // Fix: Ensure dailyCapacity is always a number
    if (data.dailyCapacity === undefined || data.dailyCapacity === null) {
      await garageRef.update({ dailyCapacity: 0 });
    }
    
    // Fix: Ensure billingModel is set
    if (!data.billingModel) {
      await garageRef.update({ billingModel: 'subscription' });
    }
    
    // Fix: Ensure status is set
    if (!data.status) {
      await garageRef.update({ status: 'active' });
    }
    
    // Fix: Ensure trial garages always have dailyCapacity = 0
    if (data.isTrial === true && data.dailyCapacity > 0) {
      await garageRef.update({ dailyCapacity: 0 });
    }
    
    console.log(`Garage ${garageId} validated successfully`);
  });

// ============================================
// RECHARGE REQUEST VALIDATION
// ============================================
export const validateRechargeRequestOnCreate = functions.firestore
  .document('recharge_requests/{requestId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const requestId = context.params.requestId;
    const requestRef = db.collection('recharge_requests').doc(requestId);
    
    // Ensure durationDays is set
    if (!data.durationDays || data.durationDays <= 0) {
      // Try to derive from package name
      const pkgName = data.packageName || '';
      let days = 30;
      if (pkgName.includes('أسبوع') || pkgName.includes('7')) days = 7;
      else if (pkgName.includes('15') || pkgName.includes('نصف')) days = 15;
      else if (pkgName.includes('30') || pkgName.includes('شهر')) days = 30;
      await requestRef.update({ durationDays: days });
    }
    
    // Ensure dailyCapacity is set (this is carsCount in old format)
    if (data.dailyCapacity === undefined) {
      await requestRef.update({ dailyCapacity: data.carsCount || 0 });
    }
    
    // Ensure revenueAmount is positive
    if (!data.revenueAmount || data.revenueAmount <= 0) {
      await requestRef.delete();
      console.error(`Deleted invalid recharge request ${requestId}: no valid amount`);
      return;
    }
    
    // Ensure originalRevenueAmount is set (for discount display)
    if (data.originalRevenueAmount === undefined) {
      await requestRef.update({ originalRevenueAmount: data.revenueAmount || 0 });
    }
    
    // Ensure discountAmount is set
    if (data.discountAmount === undefined) {
      await requestRef.update({ discountAmount: 0 });
    }
    
    console.log(`Recharge request ${requestId} validated successfully`);
  });

// ============================================
// RECHARGE REQUEST APPROVAL VALIDATION
// ============================================
export const validateRechargeRequestOnUpdate = functions.firestore
  .document('recharge_requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // If status changed from pending to approved
    if (before.status === 'pending' && after.status === 'approved') {
      const requestId = context.params.requestId;
      
      // Verify required fields exist before processing
      if (!after.garageId || !after.durationDays || !after.revenueAmount) {
        // Revert to pending
        await change.after.ref.update({ status: 'pending' });
        console.error(`Reverted invalid approval for request ${requestId}: missing required fields`);
        return;
      }
    }
  });

// ============================================
// VEHICLE ENTRY VALIDATION
// ============================================
export const validateVehicleOnCreate = functions.firestore
  .document('garages/{garageId}/vehicles/{vehicleId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    const garageId = context.params.garageId;
    const vehicleId = context.params.vehicleId;
    
    // Basic validation
    if (!data.plateNumber || !data.plateNumberRaw) {
      await snapshot.ref.delete();
      console.error(`Deleted invalid vehicle ${vehicleId} in garage ${garageId}: no plate`);
      return;
    }
    
    // Ensure entryTime is set
    if (!data.entryTime) {
      await snapshot.ref.update({ entryTime: admin.firestore.FieldValue.serverTimestamp() });
    }
    
    // Ensure status is set
    if (!data.status) {
      await snapshot.ref.update({ status: 'inside' });
    }
  });

// ============================================
// SECURE CALLABLE AUTHENTICATION (v159)
// ============================================
export const authenticateUser = functions.https.onCall(async (data, context) => {
  const pin = data?.pin ? String(data.pin).trim() : (data?.input ? String(data.input).trim() : '');
  const phone = data?.phone ? String(data.phone).trim() : (data?.input ? String(data.input).trim() : '');
  const normalizedPin = pin.replace(/\D/g, '');
  const normalizedPhone = phone.replace(/\D/g, '');

  if (!normalizedPin && !normalizedPhone) {
    return { success: false, error: 'بيانات الدخول غير صحيحة' };
  }

  // Helper to fetch PIN from private_pins or doc
  async function getDocPin(col: string, id: string, docData: any): Promise<string | null> {
    try {
      const pDoc = await db.collection('private_pins').doc(id).get();
      if (pDoc.exists && pDoc.data()?.pin) {
        return String(pDoc.data()?.pin);
      }
    } catch (e) {
      // fallback
    }
    return docData?.pin ? String(docData.pin) : null;
  }

  // 1. Check Admin PIN
  if (normalizedPin) {
    const adminPinDoc = await db.collection('admin_settings').doc('auth_pin').get();
    const activeAdminPin = adminPinDoc.exists ? adminPinDoc.data()?.pin : '8899';
    if (normalizedPin === String(activeAdminPin)) {
      return { success: true, role: 'admin' };
    }
  }

  // 2. Check Supervisors
  if (normalizedPin) {
    const supSnap = await db.collection('supervisors').get();
    for (const doc of supSnap.docs) {
      const d = doc.data();
      const docPin = await getDocPin('supervisors', doc.id, d);
      if (docPin === normalizedPin) {
        const { pin: _, ...cleanData } = d;
        return {
          success: true,
          role: 'supervisor',
          accountId: doc.id,
          account: { id: doc.id, ...cleanData }
        };
      }
    }
  }

  // 4. Check Delegates
  const delSnap = await db.collection('delegates').get();
  for (const doc of delSnap.docs) {
    const d = doc.data();
    const docPin = await getDocPin('delegates', doc.id, d);
    const docPhone = d.phone ? String(d.phone).replace(/\D/g, '') : '';

    const pinMatch = normalizedPin && docPin === normalizedPin;
    const phoneMatch = normalizedPhone && docPhone === normalizedPhone;

    if (pinMatch || (phoneMatch && docPin === normalizedPin)) {
      const { pin: _, ...cleanData } = d;
      return {
        success: true,
        role: 'delegate',
        accountId: doc.id,
        account: { id: doc.id, ...cleanData }
      };
    }
  }

  // 5. Check Staff
  if (normalizedPin) {
    const staffSnap = await db.collection('staff').get();
    for (const doc of staffSnap.docs) {
      const d = doc.data();
      const docPin = await getDocPin('staff', doc.id, d);
      if (docPin === normalizedPin) {
        const { pin: _, ...cleanData } = d;
        return {
          success: true,
          role: 'staff',
          accountId: doc.id,
          account: { id: doc.id, ...cleanData }
        };
      }
    }
  }

  // 6. Check Garages
  const garageSnap = await db.collection('garages').get();
  for (const doc of garageSnap.docs) {
    const d = doc.data();
    const docPin = await getDocPin('garages', doc.id, d);
    const docPhone = d.phone ? String(d.phone).replace(/\D/g, '') : '';

    const pinMatch = normalizedPin && docPin === normalizedPin;
    const phoneMatch = normalizedPhone && docPhone === normalizedPhone;

    if (pinMatch || phoneMatch) {
      const { pin: _, ...cleanData } = d;
      return {
        success: true,
        role: 'garage',
        accountId: doc.id,
        account: { id: doc.id, ...cleanData }
      };
    }
  }

  return { success: false, error: 'بيانات الدخول غير صحيحة' };
});

export const checkPinAvailability = functions.https.onCall(async (data, context) => {
  const pin = data?.pin ? String(data.pin).trim().replace(/\D/g, '') : '';
  const excludeId = data?.excludeId;
  if (!pin) return { taken: false };

  const adminPinDoc = await db.collection('admin_settings').doc('auth_pin').get();
  const activeAdminPin = adminPinDoc.exists ? adminPinDoc.data()?.pin : '8899';
  if (pin === String(activeAdminPin)) return { taken: true, role: 'رمز الإدارة' };

  const collections = [
    { name: 'supervisors', label: 'مشرف' },
    { name: 'delegates', label: 'مندوب' },
    { name: 'staff', label: 'موظف' },
    { name: 'garages', label: 'جراج' },
  ];

  for (const c of collections) {
    const snap = await db.collection(c.name).get();
    for (const doc of snap.docs) {
      if (excludeId && doc.id === excludeId) continue;
      const d = doc.data();
      let docPin = d.pin ? String(d.pin) : null;
      try {
        const pDoc = await db.collection('private_pins').doc(doc.id).get();
        if (pDoc.exists && pDoc.data()?.pin) docPin = String(pDoc.data()?.pin);
      } catch (e) {}

      if (docPin === pin) {
        return { taken: true, role: c.label, name: d.name || d.ownerName || 'مستخدم آخر' };
      }
    }
  }
  return { taken: false };
});

