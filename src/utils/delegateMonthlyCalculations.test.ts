import { describe, it, expect } from 'vitest';
import {
  filterLogsByMonth,
  sumLogs,
  calculateCommission,
  RechargeLog,
} from './delegateMonthlyCalculations';

describe('Delegate Monthly Calculations & Commission Logic', () => {
  const sampleLogs: RechargeLog[] = [
    { amount: 1000, revenueAmount: 1000, timestamp: '2026-08-01T10:00:00Z' },
    { amount: 1500, revenueAmount: 1500, timestamp: '2026-08-03T14:30:00Z' },
    { amount: 2000, revenueAmount: 2000, timestamp: '2026-07-15T09:00:00Z' },
    { amount: 500, revenueAmount: 500, timestamp: '2026-06-20T11:00:00Z' },
  ];

  it('filters recharge logs accurately for a specific month YYYY-MM', () => {
    const augustLogs = filterLogsByMonth(sampleLogs, '2026-08');
    expect(augustLogs).toHaveLength(2);
    expect(sumLogs(augustLogs)).toBe(2500);

    const julyLogs = filterLogsByMonth(sampleLogs, '2026-07');
    expect(julyLogs).toHaveLength(1);
    expect(sumLogs(julyLogs)).toBe(2000);
  });

  it('returns all logs when filter monthKey is "all"', () => {
    const allLogs = filterLogsByMonth(sampleLogs, 'all');
    expect(allLogs).toHaveLength(4);
    expect(sumLogs(allLogs)).toBe(5000);
  });

  it('calculates delegate commission correctly based on commission rate percentage', () => {
    const totalAugust = 2500;
    const rate = 10; // 10%
    expect(calculateCommission(totalAugust, rate)).toBe(250);

    const rateZero = 0;
    expect(calculateCommission(totalAugust, rateZero)).toBe(0);
  });
});
