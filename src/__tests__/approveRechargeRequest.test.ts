import { describe, it, expect, vi, beforeEach } from 'vitest';
import { firestoreServiceV2 } from '../services/domain/firestoreServiceV2';
import { runTransaction } from 'firebase/firestore';

// Mock dependencies
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
    increment: vi.fn((val) => ({ type: 'increment', value: val })),
    runTransaction: vi.fn(),
  };
});

vi.mock('../../firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { UPDATE: 'UPDATE' }
}));

describe('approveRechargeRequest central pricing logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const runMockTransaction = async (mockData: any, requestPayload: any) => {
    const mockTransaction = {
      get: vi.fn(async (ref: string) => {
        if (ref.includes('recharge_requests')) {
          return { exists: () => true, data: () => mockData.request };
        }
        if (ref.includes('garages')) {
          return { exists: () => true, data: () => mockData.garage };
        }
        if (ref.includes('packages')) {
          return { exists: () => !!mockData.package, data: () => mockData.package };
        }
        if (ref.includes('system_config')) {
          return { exists: () => !!mockData.systemConfig, data: () => mockData.systemConfig };
        }
        if (ref.includes('referral_rewards')) {
          return { exists: () => false, data: () => null };
        }
        if (ref.includes('delegates')) {
          return { exists: () => !!mockData.delegate, data: () => mockData.delegate };
        }
        return { exists: () => false, data: () => null };
      }),
      update: vi.fn(),
      set: vi.fn()
    };

    (runTransaction as any).mockImplementation(async (_db: any, callback: any) => {
      return callback(mockTransaction);
    });

    await firestoreServiceV2.approveRechargeRequest(requestPayload);
    return mockTransaction;
  };

  it('باقة أصلها 300، جراج غير مُحال: السعر النهائي 300 والعمولة 0', async () => {
    const t = await runMockTransaction({
      request: { status: 'pending' },
      garage: { id: 'g1', referrerId: null, createdByDelegateId: null },
      package: { price: 300 },
      systemConfig: { referralFeePerRenewal: 30 }
    }, { id: 'req1', garageId: 'g1', packageId: 'pkg1', amount: 300 });

    // request update (arg 1)
    const reqUpdate = t.update.mock.calls.find(c => c[0].includes('recharge_requests'))[1];
    expect(reqUpdate.status).toBe('approved');
    expect(reqUpdate.commission).toBe(0);
    expect(reqUpdate.amount).toBe(300);
    expect(reqUpdate.revenueAmount).toBe(300);

    // garage update
    const garageUpdate = t.update.mock.calls.find(c => c[0].includes('garages/g1'))[1];
    expect(garageUpdate.totalAdminRevenue).toEqual({ type: 'increment', value: 300 });
  });

  it('باقة أصلها 300، جراج مُحال، الإعداد 30: السعر النهائي 330 والعمولة 30', async () => {
    const t = await runMockTransaction({
      request: { status: 'pending' },
      garage: { id: 'g1', referrerId: 'del1' },
      package: { price: 300 },
      systemConfig: { referralFeePerRenewal: 30 },
      delegate: { id: 'del1' }
    }, { id: 'req1', garageId: 'g1', packageId: 'pkg1', amount: 300, delegateId: 'del1' });

    const reqUpdate = t.update.mock.calls.find(c => c[0].includes('recharge_requests'))[1];
    expect(reqUpdate.commission).toBe(30);
    expect(reqUpdate.amount).toBe(330);
    
    const delUpdate = t.update.mock.calls.find(c => c[0].includes('delegates/del1'))[1];
    expect(delUpdate.totalCommissionEarned).toEqual({ type: 'increment', value: 30 });
    expect(delUpdate.totalRechargedAmount).toEqual({ type: 'increment', value: 330 });
  });

  it('تغيير الإعداد إلى 50 يطبق 350 على التجديدات الجديدة فقط', async () => {
    const t = await runMockTransaction({
      request: { status: 'pending' },
      garage: { id: 'g1', referrerId: 'del1' },
      package: { price: 300 },
      systemConfig: { referralFeePerRenewal: 50 },
      delegate: { id: 'del1' }
    }, { id: 'req1', garageId: 'g1', packageId: 'pkg1', amount: 300, delegateId: 'del1' });

    const reqUpdate = t.update.mock.calls.find(c => c[0].includes('recharge_requests'))[1];
    expect(reqUpdate.commission).toBe(50);
    expect(reqUpdate.amount).toBe(350);
  });

  it('إرسال request.revenueAmount = 1 لا يجعل السعر المعتمد 1', async () => {
    const t = await runMockTransaction({
      request: { status: 'pending' },
      garage: { id: 'g1', referrerId: null },
      package: { price: 300 },
      systemConfig: { referralFeePerRenewal: 30 }
    }, { id: 'req1', garageId: 'g1', packageId: 'pkg1', revenueAmount: 1, amount: 1 });

    const reqUpdate = t.update.mock.calls.find(c => c[0].includes('recharge_requests'))[1];
    expect(reqUpdate.amount).toBe(300); // the trusted package price!
  });

  it('الخصم ورسم المشتركين يُطبقان بنفس الترتيب', async () => {
    // 300 (base) + 30 (referred) = 330.
    // Discount 130 -> 200.
    // Flat fee 500 (has subscribers) -> 700.
    const t = await runMockTransaction({
      request: { status: 'pending' },
      garage: { id: 'g1', referrerId: 'del1', hasMonthlySubscribers: true },
      package: { price: 300 },
      systemConfig: { referralFeePerRenewal: 30, subscriberFlatFee: 500 },
      delegate: { id: 'del1' }
    }, { id: 'req1', garageId: 'g1', packageId: 'pkg1', amount: 300, discountAmount: 130 });

    const reqUpdate = t.update.mock.calls.find(c => c[0].includes('recharge_requests'))[1];
    expect(reqUpdate.amount).toBe(700);
    expect(reqUpdate.commission).toBe(30);
  });

  it('الطلب approved أو rejected لا يُعتمد مرة ثانية', async () => {
    await firestoreServiceV2.approveRechargeRequest({ id: 'req1', garageId: 'g1', packageId: 'pkg1', amount: 300 });
    // It should fail in validation if not mocked, but we mocked runTransaction.
    // Let's call runMockTransaction and inspect the return value.
    const mockTransaction = {
      get: vi.fn(async (ref: string) => {
        if (ref.includes('recharge_requests')) {
          return { exists: () => true, data: () => ({ status: 'approved' }) };
        }
        return { exists: () => false, data: () => null };
      }),
      update: vi.fn(),
      set: vi.fn()
    };

    (runTransaction as any).mockImplementation(async (_db: any, callback: any) => {
      return callback(mockTransaction);
    });

    const res = await firestoreServiceV2.approveRechargeRequest({ id: 'req1', garageId: 'g1', packageId: 'pkg1', amount: 300 });
    expect(res.success).toBe(false);
    expect(res.error).toBe('الطلب تم معالجته مسبقاً');
  });

});
