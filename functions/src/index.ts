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
