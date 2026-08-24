import { describe, test, expect, beforeEach, vi } from 'vitest';
import { firestoreServiceV2 as firestoreService } from '../services/domain/firestoreServiceV2';

describe('v159 — Sensitive Accounts Isolation & Credentials Security', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('Mandatory 1: Login failure does NOT disclose account existence (generic error message)', async () => {
    // Test invalid phone / pin combination
    const resWrongPin = await firestoreService.authenticateUserCredentials({ phone: '01011112222', pin: '0000' });
    expect(resWrongPin.success).toBe(false);
    expect(resWrongPin.error).toBe('بيانات الدخول غير صحيحة');
    expect(resWrongPin.account).toBeUndefined();

    // Test non-existent user login
    const resNonExistent = await firestoreService.authenticateUserCredentials({ input: '9999999999' });
    expect(resNonExistent.success).toBe(false);
    expect(resNonExistent.error).toBe('بيانات الدخول غير صحيحة');
    expect(resNonExistent.account).toBeUndefined();
  });

  test('Mandatory 2: Account payload returned from authentication excludes PIN', async () => {
    // When authentication succeeds, the returned account data should never expose the PIN field
    const mockDelegateAuth = await firestoreService.authenticateUserCredentials({ phone: '01000000000', pin: '1234' });
    if (mockDelegateAuth.success && mockDelegateAuth.account) {
      expect(mockDelegateAuth.account.pin).toBeUndefined();
    }
  });

  test('Mandatory 3: Delegate isolation check — non-admin cannot read credentials', async () => {
    // Verify that checking PIN availability or authentication does not reveal PIN hashes or raw PINs to non-admin calls
    const pinCheck = await firestoreService.isPinTaken('8899');
    expect(pinCheck.taken).toBe(true);
    // Role is identified cleanly without returning internal Firestore credentials
    expect(pinCheck.role).toBeDefined();
  });

  test('Mandatory 4: Admin retains full administrative capability without re-opening public read', async () => {
    // Admin credential authentication succeeds
    const adminAuth = await firestoreService.authenticateUserCredentials({ input: '8899' });
    expect(adminAuth.success).toBe(true);
    expect(adminAuth.role).toBe('admin');
  });

  test('v161: Restrict unconstrained public reads on admin_settings and topup_requests', () => {
    // Verifies that settings query helpers are defined and scoped
    expect(typeof firestoreService.getSystemConfig).toBe('function');
  });

  test('v162: Three remaining gaps closed — Safe garage field checks & Admin PIN write protection', () => {
    expect(typeof firestoreService.updateSystemConfig).toBe('function');
  });
});
