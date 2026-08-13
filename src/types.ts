/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Package {
  id: string;
  name: string;
  price: number;
  vehiclesCount: number; // duration in days (e.g. 15 or 30)
  dailyCapacity?: number; // daily car capacity limit (50, 100, 150, or 0/undefined for unlimited)
  durationDays?: number; // duration in days (15 or 30)
  description?: string;
  isActive?: boolean;
  createdAt?: any;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isActive: boolean;
  createdAt?: any;
}

export interface Garage {
  id: string;
  name: string;
  phone: string;
  pin?: string;
  ownerName?: string;
  ownerPin?: string;
  hourlyRate: number;
  overnightRate: number;
  balanceExpiry?: any; // Timestamp
  createdAt: any; // Timestamp
  balanceDays?: number;
  ownerUid?: string;
  currentSessionId?: string | null;
  lastActive?: any; // Timestamp
  billingModel?: 'subscription';
  commissionPerVehicle?: number;
  monthlySubscriptionFee?: number;
  balance?: number;
  isLocked?: boolean;
  lockReason?: string;
  lastBalanceDeduction?: any; // Timestamp
  lastPaidFriday?: string; // YYYY-MM-DD
  totalAdminRevenue?: number;
  totalRevenue?: number;
  totalVehiclesOut?: number;
  totalRechargedCars?: number;
  dailyRefundCount?: number;
  lastRefundDate?: string; // YYYY-MM-DD
  todayRevenue?: number;
  todayCount?: number;
  lastTransactionDate?: string; // YYYY-MM-DD
  checkInSound?: string;
  checkOutSound?: string;
  monthlyGiftAmount?: number;
  isMonthlyGiftEnabled?: boolean;
  referralBonusBalance?: number; // Cash bonus balance in EGP earned from referring other garages
  referredByGarageId?: string | null; // ID of referring garage
  referredByGarageName?: string | null; // Name of referring garage
  lastReferralRewardMonth?: string; // YYYY-MM format of last month bonus was awarded
  referralRewardMonthsCount?: number; // Number of months bonus has been awarded (up to 6)
  lastGiftMonth?: string; // YYYY-MM
  shimmerColor?: string;
  lastGiftAwardedAt?: any; // Timestamp
  activePlates?: Record<string, any>;
  carsInside?: number;
  recentExits?: any[];
  createdByDelegateId?: string | null;
  createdByDelegateName?: string | null;
  hasMonthlySubscribers?: boolean;
  dailyCapacity?: number; // Daily car limit (50, 100, 150, or 0/undefined for unlimited)
  activePackageName?: string; // Current package name
  status?: 'pending' | 'approved' | 'rejected';
}

export interface Staff {
  id: string;
  name: string;
  pin: string;
  garageId: string;
  role: 'staff';
  currentSessionId?: string | null;
  lastActive?: any; // Timestamp
}

export interface Delegate {
  id: string;
  name: string;
  phone: string;
  pin: string;
  role: 'delegate';
  currentSessionId?: string | null;
  lastActive?: any; // Timestamp
  createdAt: any;
  canCreateGarage?: boolean;
  commissionRate?: number;
  totalRechargedAmount?: number;
  lastSettledAt?: any; // Timestamp
}

export interface Supervisor {
  id: string;
  name: string;
  phone: string;
  pin: string;
  role: 'supervisor';
  currentSessionId?: string | null;
  lastActive?: any; // Timestamp
  createdAt: any;
}

export interface GeneralManager {
  id: string;
  name: string;
  phone: string;
  pin: string;
  garageIds: string[];
  role: 'general_manager';
  currentSessionId?: string | null;
  lastActive?: any; // Timestamp
  createdAt: any;
}

export interface ActivityLog {
  id: string;
  garageId: string;
  staffId: string | null;
  staffName: string;
  actionType: 'check_in' | 'check_out' | 'recharge' | 'delete_refund' | 'commission_payment';
  plateNumber: string;
  timestamp: any;
  amount?: number;
  packageId?: string;
  garageName?: string;
  operatorId?: string;
  operatorName?: string;
  details?: {
    packageName?: string;
    carsCount?: number;
    revenueAmount?: number;
    requestId?: string;
  };
}

export interface Subscriber {
  id: string;
  plateNumber: string;
  plateNumberRaw: string;
  ownerName: string;
  phone: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  garageId: string;
  createdAt: any;
}

export interface Vehicle {
  id: string;
  plateNumber: string;
  plateNumberRaw: string;
  entryTime: any;
  exitTime?: any;
  type: 'hourly' | 'overnight';
  garageId: string;
  status: 'inside' | 'outside';
  totalCost?: number;
  staffName?: string;
  isSubscriber?: boolean;
}

export interface RechargeRequest {
  id: string;
  garageId: string;
  garageName: string;
  delegateId: string;
  delegateName: string;
  packageId: string;
  packageName: string;
  amount: number;
  price?: number;
  carsCount: number;
  revenueAmount: number;
  durationDays?: number;
  dailyCapacity?: number;
  originalRevenueAmount?: number;
  couponCode?: string;
  discountAmount?: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  resolvedAt?: any;
}
