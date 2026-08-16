import { Timestamp } from 'firebase/firestore';

const safeDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date.toDate === 'function') return date.toDate();
  if (typeof date === 'object' && date.seconds !== undefined) {
    try {
      return new Timestamp(date.seconds, date.nanoseconds || 0).toDate();
    } catch (e) {
      return new Date();
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime()) || d.getTime() < 31536000000) {
    return new Date();
  }
  return d;
};

export const isSubscriptionExpired = (garage: any): boolean => {
  if (!garage) return true;
  
  // Trial garages
  if (garage.isTrial === true) {
    if (!garage.balanceExpiry) return false; // No expiry = still in trial
    return safeDate(garage.balanceExpiry) < new Date();
  }
  
  // Regular garages — always require balanceExpiry
  if (!garage.balanceExpiry) {
    // Grace period for newly created garages (5 minutes)
    if (garage.createdAt) {
      const created = safeDate(garage.createdAt);
      if (Date.now() - created.getTime() < 5 * 60 * 1000) {
        return false;
      }
    }
    return true;
  }
  
  return safeDate(garage.balanceExpiry) < new Date();
};

export const getRemainingDays = (garage: any): number => {
  if (!garage) return 0;
  
  if (garage.isTrial === true) {
    if (!garage.balanceExpiry) {
      if (garage.createdAt) {
        const created = safeDate(garage.createdAt);
        const trialExpiry = new Date(created.getTime() + 15 * 24 * 60 * 60 * 1000);
        const diff = trialExpiry.getTime() - Date.now();
        return Math.max(0, Math.min(15, Math.ceil(diff / (1000 * 60 * 60 * 24))));
      }
      return 15;
    }
    const expiry = safeDate(garage.balanceExpiry);
    const diff = expiry.getTime() - Date.now();
    const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    return Math.min(days, 15);
  }

  if (!garage.balanceExpiry) return 0;
  
  const expiry = safeDate(garage.balanceExpiry);
  const diff = expiry.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const isTrialActive = (garage: any): boolean => {
  return garage.isTrial === true && !isSubscriptionExpired(garage);
};

export const isUnlimitedCapacity = (garage: any): boolean => {
  return !garage.dailyCapacity || garage.dailyCapacity <= 0;
};

export const calculateCapacityUsed = (garage: any): { used: number; limit: number; isUnlimited: boolean } => {
  const used = garage.todayCount || 0;
  const limit = garage.dailyCapacity || 0;
  return {
    used,
    limit,
    isUnlimited: limit <= 0
  };
};
