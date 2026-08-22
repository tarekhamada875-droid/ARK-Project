import { describe, test, expect } from 'vitest';
import { isSubscriptionExpired, calculateFinalPrice, applyMonthlySubscribersFlatFee, packageIdToDays } from '../utils';

describe('isSubscriptionExpired', () => {
  test('returns true for garage with no balanceExpiry', () => {
    expect(isSubscriptionExpired({})).toBe(true);
    expect(isSubscriptionExpired(null)).toBe(true);
  });

  test('returns false for active subscription', () => {
    const futureDate = new Date(Date.now() + 86400000 * 30); // 30 days from now
    expect(isSubscriptionExpired({ balanceExpiry: futureDate })).toBe(false);
  });

  test('returns true for expired subscription', () => {
    const pastDate = new Date(Date.now() - 86400000); // yesterday
    expect(isSubscriptionExpired({ balanceExpiry: pastDate })).toBe(true);
  });
});

describe('calculateFinalPrice', () => {
  test('returns base price when no discount and no subscribers', () => {
    const result = calculateFinalPrice({ price: 1000 }, false);
    expect(result.finalPrice).toBe(1000);
    expect(result.hasDiscount).toBe(false);
  });

  test('applies 500 EGP flat fee for monthly subscribers by default', () => {
    const result = calculateFinalPrice({ price: 1000 }, true);
    expect(result.finalPrice).toBe(1500);
  });

  test('applies custom configured flat fee for monthly subscribers', () => {
    const result = calculateFinalPrice({ price: 1000 }, true, 300);
    expect(result.finalPrice).toBe(1300);
  });

  test('applies percentage discount correctly', () => {
    const result = calculateFinalPrice({ price: 1000, discountType: 'percentage', discountValue: 20 }, false);
    expect(result.finalPrice).toBe(800);
    expect(result.hasDiscount).toBe(true);
  });

  test('applies fixed discount correctly', () => {
    const result = calculateFinalPrice({ price: 1000, discountType: 'fixed', discountValue: 200 }, false);
    expect(result.finalPrice).toBe(800);
  });

  test('applies discount then flat fee', () => {
    const result = calculateFinalPrice({ price: 1000, discountType: 'percentage', discountValue: 20 }, true);
    // 1000 - 20% = 800, then 800 + 500 = 1300
    expect(result.finalPrice).toBe(1300);
  });
});

describe('applyMonthlySubscribersFlatFee', () => {
  test('returns same price without subscribers', () => {
    expect(applyMonthlySubscribersFlatFee(750, false)).toBe(750);
  });

  test('applies 500 EGP flat fee with subscribers by default', () => {
    expect(applyMonthlySubscribersFlatFee(750, true)).toBe(1250); // 750 + 500 = 1250
  });

  test('applies custom configured flat fee with subscribers', () => {
    expect(applyMonthlySubscribersFlatFee(750, true, 150)).toBe(900); // 750 + 150 = 900
  });
});

describe('packageIdToDays', () => {
  test('weekly = 7 days', () => {
    expect(packageIdToDays('weekly_sub')).toBe(7);
  });

  test('biweekly = 15 days', () => {
    expect(packageIdToDays('biweekly_sub')).toBe(15);
  });

  test('monthly = 30 days', () => {
    expect(packageIdToDays('monthly_sub')).toBe(30);
  });

  test('defaults to 30 for unknown', () => {
    expect(packageIdToDays('unknown')).toBe(30);
  });
});
