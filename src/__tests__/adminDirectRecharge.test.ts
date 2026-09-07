import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from '../services/adminService';
import { runTransaction } from 'firebase/firestore';
import type { Package } from '../types';

vi.mock('firebase/firestore', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    doc: vi.fn((_db, path, id) => `${path}/${id || 'unknown'}`),
    collection: vi.fn((_db, path) => path),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    Timestamp: {
      fromDate: vi.fn((date) => date),
    },
    runTransaction: vi.fn(),
  };
});

vi.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: null },
  handleFirestoreError: vi.fn(),
  OperationType: { UPDATE: 'UPDATE' }
}));

describe('adminDirectRechargeGarage atomic transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPkg: Package = {
    id: 'pkg_1',
    name: 'باقة شهرية',
    price: 300,
    vehiclesCount: 30,
    durationDays: 30,
    dailyCapacity: 50,
    isActive: true
  };

  it('atomically updates garage balance expiry, total revenue, and logs activity in a single transaction', async () => {
    const mockGarage = {
      id: 'garage_123',
      name: 'جراج الأمل',
      balanceExpiry: new Date('2026-08-01T00:00:00Z'),
      totalAdminRevenue: 600,
      isTrial: true,
      isLocked: true
    };

    let updatedGarageData: any = null;
    let loggedActivityData: any = null;

    const mockTransaction = {
      get: vi.fn(async (_ref: string) => {
        return {
          exists: () => true,
          data: () => mockGarage
        };
      }),
      update: vi.fn((_ref: any, data: any) => {
        updatedGarageData = data;
      }),
      set: vi.fn((_ref: any, data: any) => {
        loggedActivityData = data;
      })
    };

    (runTransaction as any).mockImplementation(async (_db: any, callback: any) => {
      return callback(mockTransaction);
    });

    await adminService.adminDirectRechargeGarage('garage_123', mockPkg, {
      staffId: 'admin',
      staffName: 'مدير النظام (Admin)',
      isEnglish: false
    });

    expect(mockTransaction.get).toHaveBeenCalled();
    expect(mockTransaction.update).toHaveBeenCalled();
    expect(mockTransaction.set).toHaveBeenCalled();

    expect(updatedGarageData).not.toBeNull();
    expect(updatedGarageData.totalAdminRevenue).toBe(900); // 600 + 300
    expect(updatedGarageData.isLocked).toBe(false);
    expect(updatedGarageData.isTrial).toBe(false);
    expect(updatedGarageData.packageName).toBe('باقة شهرية');

    expect(loggedActivityData).not.toBeNull();
    expect(loggedActivityData.garageId).toBe('garage_123');
    expect(loggedActivityData.amount).toBe(300);
    expect(loggedActivityData.actionType).toBe('recharge');
    expect(loggedActivityData.plateNumber).toContain('تجديد اشتراك: باقة شهرية');
  });

  it('throws error if garage does not exist during recharge transaction', async () => {
    const mockTransaction = {
      get: vi.fn(async () => ({ exists: () => false, data: () => null })),
      update: vi.fn(),
      set: vi.fn()
    };

    (runTransaction as any).mockImplementation(async (_db: any, callback: any) => {
      return callback(mockTransaction);
    });

    await expect(
      adminService.adminDirectRechargeGarage('non_existent', mockPkg)
    ).rejects.toThrow('GARAGE_NOT_FOUND');
  });
});
