import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { initializeApp as initAdminApp, cert, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  memoryLocalCache,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  limit
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';
import { createServer as createViteServer } from 'vite';

// Helper for digit normalization
function normalizeDigits(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/[٠۰]/g, '0')
    .replace(/[١۱]/g, '1')
    .replace(/[٢۲]/g, '2')
    .replace(/[٣۳]/g, '3')
    .replace(/[٤۴]/g, '4')
    .replace(/[٥۵]/g, '5')
    .replace(/[٦۶]/g, '6')
    .replace(/[٧۷]/g, '7')
    .replace(/[٨۸]/g, '8')
    .replace(/[٩۹]/g, '9');
}

function cleanPin(raw: any): string {
  return normalizeDigits(String(raw || '')).replace(/\D/g, '');
}

// Cryptographic PIN Hashing Helpers
const LEGACY_PIN_SALT = 'ark_garage_secure_pin_salt_2026';
const PIN_LOOKUP_SALT = 'ark_garage_secure_pin_lookup_salt_v2';

// Modern per-account unique-salt scrypt hash ($scrypt$N=16384,r=8,p=1$<16_byte_salt_hex>$<derived_hex>)
function hashPinWithUniqueSalt(cleanPinStr: string, saltHex?: string): string {
  if (!cleanPinStr) return '';
  const salt = saltHex ? Buffer.from(saltHex, 'hex') : crypto.randomBytes(16);
  const actualSaltHex = salt.toString('hex');
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = crypto.scryptSync(cleanPinStr, salt, 32, { N, r, p }).toString('hex');
  return `$scrypt$N=${N},r=${r},p=${p}$${actualSaltHex}$${derived}`;
}

// System-wide deterministic lookup hash for indexed Firestore queries
function computeLookupHash(cleanPinStr: string): string {
  if (!cleanPinStr) return '';
  return crypto.scryptSync(cleanPinStr, PIN_LOOKUP_SALT, 32).toString('hex');
}

// Legacy single-salt hash calculation for backward compatibility
function legacyHashPin(cleanPinStr: string): string {
  if (!cleanPinStr) return '';
  return crypto.scryptSync(cleanPinStr, LEGACY_PIN_SALT, 32).toString('hex');
}

function hashPin(cleanPinStr: string): string {
  return hashPinWithUniqueSalt(cleanPinStr);
}

function isHashedPin(pin: string): boolean {
  if (!pin) return false;
  return typeof pin === 'string' && pin.length === 64 && /^[0-9a-f]{64}$/i.test(pin);
}

function verifyScryptHash(inputCleanPin: string, scryptStr: string): boolean {
  try {
    const parts = scryptStr.split('$');
    if (parts.length >= 5 && parts[1] === 'scrypt') {
      const paramStr = parts[2];
      const saltHex = parts[3];
      const expectedHash = parts[4];
      const params: Record<string, number> = {};
      paramStr.split(',').forEach(p => {
        const [k, v] = p.split('=');
        if (k && v) params[k] = parseInt(v, 10);
      });
      const N = params.N || 16384;
      const r = params.r || 8;
      const p = params.p || 1;
      const salt = Buffer.from(saltHex, 'hex');
      const derived = crypto.scryptSync(inputCleanPin, salt, 32, { N, r, p }).toString('hex');
      return derived.toLowerCase() === expectedHash.toLowerCase();
    }
  } catch (e) {
    console.error('[Server Auth] Error verifying scrypt hash:', e);
  }
  return false;
}

function verifySingleFieldValue(inputCleanPin: string, storedVal: any): { matches: boolean; isLegacy: boolean } {
  if (!inputCleanPin || storedVal === undefined || storedVal === null) return { matches: false, isLegacy: false };
  const strVal = String(storedVal).trim();
  if (!strVal) return { matches: false, isLegacy: false };

  // Format 1: Unique-salt $scrypt$... (Modern)
  if (strVal.startsWith('$scrypt$')) {
    if (verifyScryptHash(inputCleanPin, strVal)) {
      return { matches: true, isLegacy: false };
    }
  }

  // Format 2: Old 64-character single-salt hex hash (Legacy)
  if (isHashedPin(strVal)) {
    const inputLegacyHash = legacyHashPin(inputCleanPin);
    if (inputLegacyHash.toLowerCase() === strVal.toLowerCase()) {
      return { matches: true, isLegacy: true };
    }
  }

  // Format 3: Plaintext PIN string (Legacy)
  const cleanStored = cleanPin(strVal);
  if (cleanStored && cleanStored === inputCleanPin) {
    return { matches: true, isLegacy: true };
  }

  return { matches: false, isLegacy: false };
}

function verifyPinMatch(inputCleanPin: string, storedPin: any): { matches: boolean; isLegacy: boolean } {
  return verifySingleFieldValue(inputCleanPin, storedPin);
}

function verifyDocMatch(inputCleanPin: string, docData: any): { matches: boolean; isLegacy: boolean } {
  if (!docData) return { matches: false, isLegacy: false };
  const candidateFields = [docData.pin, docData.ownerPin, docData.adminPin, docData.pinLookupHash];
  for (const fieldVal of candidateFields) {
    const check = verifySingleFieldValue(inputCleanPin, fieldVal);
    if (check.matches) {
      return check;
    }
  }
  return { matches: false, isLegacy: false };
}

async function migratePinToHash(collName: string, docId: string, cleanInputPin: string): Promise<void> {
  const newScrypt = hashPinWithUniqueSalt(cleanInputPin);
  const lookupHash = computeLookupHash(cleanInputPin);
  const updatePayload = {
    pin: newScrypt,
    pinLookupHash: lookupHash
  };

  try {
    if (collName === 'admin_settings') {
      if (adminDb) {
        await adminDb.doc('admin_settings/auth_pin').set(updatePayload, { merge: true });
      } else {
        await ensureAuth();
        const docRef = doc(db, 'admin_settings', 'auth_pin');
        await setDoc(docRef, updatePayload, { merge: true });
      }
    } else if (adminDb) {
      await adminDb.collection(collName).doc(docId).update(updatePayload);
    } else {
      await ensureAuth();
      const docRef = doc(db, collName, docId);
      await setDoc(docRef, updatePayload, { merge: true });
    }
    console.log(`[Server Auth] Auto-migrated legacy PIN to unique-salt $scrypt$ hash for ${collName}/${docId}`);
  } catch (e) {
    console.error(`[Server Auth] Error auto-migrating PIN for ${collName}/${docId}:`, e);
  }
}

// Simple In-Memory Rate Limiter for Authentication Endpoints
const failedAttemptsByIp = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = failedAttemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    failedAttemptsByIp.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (entry.count >= 20) {
    return false;
  }
  entry.count += 1;
  return true;
}

function resetRateLimit(ip: string): void {
  failedAttemptsByIp.delete(ip);
}

// 1. Initialize Firebase Admin SDK if credentials exist
let adminDb: any = null;
let adminAuth: any = null;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const existingApps = getAdminApps();
    const adminApp = existingApps.find(a => a.name === 'admin-app') || initAdminApp({
      credential: cert(sa),
      projectId: firebaseConfig.projectId
    }, 'admin-app');
    
    adminDb = getAdminFirestore(adminApp, (firebaseConfig as any).firestoreDatabaseId);
    adminAuth = getAdminAuth(adminApp);
    console.log('[Server Auth] Initialized Firebase Admin SDK with service account credentials');
  }
} catch (e) {
  console.warn('[Server Auth] Could not initialize Firebase Admin SDK:', e);
}

// 2. Initialize server-side fallback client Firebase instance
const firebaseApp = initializeApp(firebaseConfig, 'server-app');
const db = initializeFirestore(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
  localCache: memoryLocalCache(),
}, firebaseConfig.firestoreDatabaseId);
const serverAuth = getAuth(firebaseApp);

async function ensureAuth() {
  try {
    if (!serverAuth.currentUser) {
      await signInAnonymously(serverAuth);
    }
  } catch (e) {
    console.error('[Server Auth] Anonymous auth error:', e);
  }
}

// Server Database Access Abstractions
async function getAdminPin(): Promise<string> {
  try {
    if (adminDb) {
      const snap = await adminDb.doc('admin_settings/auth_pin').get();
      return snap.exists ? String(snap.data()?.pin || '') : '';
    }
    await ensureAuth();
    const adminDoc = await getDoc(doc(db, 'admin_settings', 'auth_pin'));
    return adminDoc.exists() ? String(adminDoc.data()?.pin || '') : '';
  } catch (e) {
    console.error('[Server Auth] Error reading admin pin:', e);
    return '';
  }
}

async function queryAccountWherePin(collName: string, normPin: string): Promise<Array<{ id: string; data: any; isLegacyMatch: boolean }>> {
  const lookupHash = computeLookupHash(normPin);
  const legacyHash = legacyHashPin(normPin);
  const matches: Array<{ id: string; data: any; isLegacyMatch: boolean }> = [];
  const seenIds = new Set<string>();

  // Deterministic candidate queries to test (field and matching value)
  const candidateQueries: Array<{ field: string; value: string }> = [
    { field: 'pinLookupHash', value: lookupHash },
    { field: 'pin', value: legacyHash },
    { field: 'pin', value: normPin }
  ];
  if (collName === 'garages') {
    candidateQueries.push(
      { field: 'ownerPin', value: normPin },
      { field: 'adminPin', value: normPin }
    );
  }

  try {
    if (adminDb) {
      for (const { field, value } of candidateQueries) {
        if (!value) continue;
        try {
          const snap = await adminDb.collection(collName).where(field, '==', value).limit(5).get();
          for (const d of snap.docs) {
            if (!seenIds.has(d.id)) {
              const check = verifyDocMatch(normPin, d.data());
              if (check.matches) {
                seenIds.add(d.id);
                matches.push({ id: d.id, data: d.data(), isLegacyMatch: check.isLegacy });
              }
            }
          }
        } catch (e) {}
      }

      // Legacy fallback: bounded collection scan for unmigrated accounts (prevents lockout)
      if (matches.length === 0) {
        try {
          const fallbackSnap = await adminDb.collection(collName).limit(50).get();
          for (const d of fallbackSnap.docs) {
            if (!seenIds.has(d.id)) {
              const check = verifyDocMatch(normPin, d.data());
              if (check.matches) {
                seenIds.add(d.id);
                matches.push({ id: d.id, data: d.data(), isLegacyMatch: check.isLegacy });
              }
            }
          }
        } catch (e) {}
      }
    } else {
      await ensureAuth();
      for (const { field, value } of candidateQueries) {
        if (!value) continue;
        try {
          const q = query(collection(db, collName), where(field, '==', value), limit(5));
          const snap = await getDocs(q);
          for (const d of snap.docs) {
            if (!seenIds.has(d.id)) {
              const check = verifyDocMatch(normPin, d.data());
              if (check.matches) {
                seenIds.add(d.id);
                matches.push({ id: d.id, data: d.data(), isLegacyMatch: check.isLegacy });
              }
            }
          }
        } catch (e) {}
      }

      // Legacy fallback: bounded collection scan for unmigrated accounts (prevents lockout)
      if (matches.length === 0) {
        try {
          const fallbackQ = query(collection(db, collName), limit(50));
          const fallbackSnap = await getDocs(fallbackQ);
          for (const d of fallbackSnap.docs) {
            if (!seenIds.has(d.id)) {
              const check = verifyDocMatch(normPin, d.data());
              if (check.matches) {
                seenIds.add(d.id);
                matches.push({ id: d.id, data: d.data(), isLegacyMatch: check.isLegacy });
              }
            }
          }
        } catch (e) {
          console.error(`[Server Auth] Error in fallback scan for ${collName}:`, e);
        }
      }
    }
  } catch (e) {
    console.error(`[Server Auth] Error querying collection ${collName} where pin:`, e);
  }
  return matches;
}

async function queryDelegatesWherePhone(normPhone: string): Promise<Array<{ id: string; data: any }>> {
  try {
    if (adminDb) {
      const snap = await adminDb.collection('delegates').where('phone', '==', normPhone).limit(5).get();
      return snap.docs.map(d => ({ id: d.id, data: d.data() }));
    }
    await ensureAuth();
    const qPhone = query(collection(db, 'delegates'), where('phone', '==', normPhone), limit(5));
    const snapPhone = await getDocs(qPhone);
    return snapPhone.docs.map(d => ({ id: d.id, data: d.data() }));
  } catch (e) {
    console.error('[Server Auth] Error querying delegates where phone:', e);
    return [];
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Extends Express Request
  interface AuthRequest extends express.Request { user?: { uid: string; role: string; garageId?: string; } }

  // Mandatory Authentication Middleware
  const requireAuth = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      let token = '';

      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split('Bearer ')[1];
      } else if (req.body && req.body.firebaseIdToken) {
        token = req.body.firebaseIdToken;
      }

      if (!token) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED: Missing Firebase ID Token' });
      }

      if (!adminAuth || !adminDb) {
        return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });
      }

      const decoded = await adminAuth.verifyIdToken(token);
      const uid = decoded.uid;

      // Determine Role based on Active Session
      let foundRole = '';
      let assignedGarageId = '';

      const secCollMap = [
        { role: 'admin', coll: 'admin_sessions' },
        { role: 'supervisor', coll: 'supervisor_sessions' },
        { role: 'delegate', coll: 'delegate_sessions' },
        { role: 'garage', coll: 'garage_sessions' },
        { role: 'staff', coll: 'staff_sessions' }
      ];

      for (const { role, coll } of secCollMap) {
        const secSnap = await adminDb.doc(`${coll}/${uid}`).get();
        if (secSnap.exists) {
          const secData = secSnap.data() || {};
          if (secData.isActive) {
            foundRole = role;
            if (role === 'garage') {
              assignedGarageId = secData.garageId || secData.entityId || '';
            } else if (role === 'staff') {
              assignedGarageId = secData.garageId || '';
              if (!assignedGarageId && secData.entityId) {
                const staffSnap = await adminDb.doc(`staff/${secData.entityId}`).get();
                if (staffSnap.exists) {
                  assignedGarageId = staffSnap.data()?.garageId || '';
                }
              }
            }
            break; // Found active session
          }
        }
      }

      if (!foundRole) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN: No active session found' });
      }

      req.user = { uid, role: foundRole, garageId: assignedGarageId };
      next();
    } catch (e: any) {
      console.warn('[Server Auth] Middleware validation failed:', e);
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED: Invalid token or session' });
    }
  };

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Secure Server API: Verify User Credentials (PIN or Phone+PIN)
  app.post('/api/auth/verify-pin', async (req, res) => {
    try {
      const clientIp = req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
          success: false,
          error: 'تم تجاوز عدد المحاولات المسموح بها، يرجى الانتظار لمدة دقيقة والمحاولة مجدداً'
        });
      }

      const credentials = req.body || {};
      const rawInput = credentials.pin || credentials.input;

      // Token verification trust boundary
      let verifiedUid = '';
      if (credentials.firebaseIdToken) {
        if (adminAuth) {
          try {
            const decoded = await adminAuth.verifyIdToken(credentials.firebaseIdToken);
            verifiedUid = decoded.uid;
          } catch (tokenErr) {
            console.warn('[Server Auth] Invalid Firebase ID token:', tokenErr);
            return res.status(401).json({ success: false, error: 'INVALID_ID_TOKEN' });
          }
        }
      }

      // Check for UID mismatch if body.uid is supplied alongside verified token
      if (verifiedUid && credentials.uid && credentials.uid.trim() !== verifiedUid) {
        return res.status(401).json({ success: false, error: 'UID_MISMATCH' });
      }

      const effectiveUid = verifiedUid || (typeof credentials.uid === 'string' ? credentials.uid.trim() : '');
      const sessionId = typeof credentials.sessionId === 'string' ? credentials.sessionId.trim() : '';

      // 1. Single Input PIN Verification (Canonical Path)
      if (rawInput) {
        const normInputPin = cleanPin(rawInput);
        if (!normInputPin) {
          return res.json({ success: false, error: 'بيانات الدخول غير صحيحة' });
        }

        const matches: Array<{
          role: 'admin' | 'supervisor' | 'delegate' | 'staff' | 'garage';
          id: string;
          account?: any;
          isLegacyMatch?: boolean;
        }> = [];

        // Check Admin PIN
        let adminPinStored = await getAdminPin();
        const adminCheck = verifyPinMatch(normInputPin, adminPinStored);
        if (adminCheck.matches) {
          matches.push({ role: 'admin', id: 'admin', isLegacyMatch: adminCheck.isLegacy });
          if (adminCheck.isLegacy) {
            migratePinToHash('admin_settings', 'auth_pin', normInputPin);
          }
        }

        // Search collections
        const collectionsToCheck: Array<{ name: string; role: 'supervisor' | 'delegate' | 'staff' | 'garage' }> = [
          { name: 'garages', role: 'garage' },
          { name: 'staff', role: 'staff' },
          { name: 'delegates', role: 'delegate' },
          { name: 'supervisors', role: 'supervisor' }
        ];

        for (const coll of collectionsToCheck) {
          try {
            const docs = await queryAccountWherePin(coll.name, normInputPin);
            for (const docSnap of docs) {
              const data = { ...docSnap.data };
              if (docSnap.isLegacyMatch) {
                migratePinToHash(coll.name, docSnap.id, normInputPin);
              }
              // Sanitize: never return plaintext PIN, legacy hash, or lookup hash to client
              delete data.pin;
              delete data.ownerPin;
              delete data.adminPin;
              delete data.pinLookupHash;

              matches.push({
                role: coll.role,
                id: docSnap.id,
                account: { id: docSnap.id, ...data },
                isLegacyMatch: docSnap.isLegacyMatch
              });
            }
          } catch (e) {
            console.error(`[Server Auth] Query error in ${coll.name}:`, e);
          }
        }

        if (matches.length > 1) {
          return res.json({ success: false, error: 'PIN_NOT_UNIQUE' });
        }

        if (matches.length === 1) {
          const match = matches[0];

          if (effectiveUid && sessionId && adminDb) {
            try {
              const entityCollMap: Record<string, string> = {
                admin: 'admin_settings',
                supervisor: 'supervisors',
                delegate: 'delegates',
                garage: 'garages',
                staff: 'staff'
              };
              const secCollMap: Record<string, string> = {
                admin: 'admin_sessions',
                supervisor: 'supervisor_sessions',
                delegate: 'delegate_sessions',
                garage: 'garage_sessions',
                staff: 'staff_sessions'
              };

              const entityColl = entityCollMap[match.role];
              const secColl = secCollMap[match.role];
              const entityDocId = match.role === 'admin' ? 'auth_pin' : match.id;

              if (entityColl && secColl && entityDocId) {
                const entityDocRef = adminDb.doc(`${entityColl}/${entityDocId}`);
                const secDocRef = adminDb.doc(`${secColl}/${effectiveUid}`);

                await adminDb.runTransaction(async (transaction) => {
                  const snap = await transaction.get(entityDocRef);
                  if (snap.exists) {
                    const data = snap.data() || {};
                    const activeSessionId = data.currentSessionId;
                    const rawLastActive = data.lastActive;
                    const lastActive = rawLastActive ? new Date(rawLastActive.toDate ? rawLastActive.toDate() : rawLastActive).getTime() : 0;
                    const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
                    const isAlive = activeSessionId && activeSessionId !== sessionId && lastActive > 0 && (Date.now() - lastActive < SESSION_TIMEOUT_MS);
                    
                    if (isAlive) {
                      throw new Error('SESSION_OCCUPIED');
                    }
                  }

                  // Update entity doc with session lock atomically
                  transaction.set(entityDocRef, {
                    currentSessionId: sessionId,
                    lastActive: new Date()
                  }, { merge: true });

                  // Provision security session doc with Admin SDK bypass atomically
                  const resolvedGarageId = match.role === 'staff'
                    ? (snap.data()?.garageId || '')
                    : (match.role === 'garage' ? entityDocId : '');

                  transaction.set(secDocRef, {
                    uid: effectiveUid,
                    role: match.role,
                    entityId: entityDocId,
                    garageId: resolvedGarageId,
                    sessionId,
                    isActive: true,
                    lastActive: new Date(),
                    createdAt: new Date()
                  }, { merge: true });
                });

                console.log(`[Server Auth] Successfully provisioned atomic ${match.role} session for UID: ${effectiveUid}`);
              }
            } catch (claimErr: any) {
              if (claimErr?.message === 'SESSION_OCCUPIED') {
                return res.json({ success: false, error: 'SESSION_OCCUPIED' });
              }
              console.error(`[Server Auth] Failed to provision ${match.role} session:`, claimErr);
              // Fail closed: do not grant account access if session claim fails
              return res.status(500).json({ success: false, error: 'تعذر تهيئة الجلسة الآمنة، يرجى إعادة المحاولة' });
            }
          }

          // Reset rate limit ONLY when authentication and session claim both succeed
          resetRateLimit(clientIp);

          return res.json({
            success: true,
            role: match.role,
            accountId: match.id,
            account: match.account,
            sessionClaimed: true
          });
        }

        return res.json({ success: false, error: 'بيانات الدخول غير صحيحة' });
      }

      // 2. Legacy Phone + PIN Verification (Migration Compatibility Path)
      const normPin = cleanPin(credentials.pin);
      const normPhone = cleanPin(credentials.phone);

      if (!normPin || !normPhone) {
        return res.json({ success: false, error: 'بيانات الدخول غير صحيحة' });
      }

      try {
        const delegateDocs = await queryDelegatesWherePhone(normPhone);
        for (const dDoc of delegateDocs) {
          const d = { ...dDoc.data };
          const { matches, isLegacy } = verifyDocMatch(normPin, d);
          if (matches) {
            if (isLegacy) {
              migratePinToHash('delegates', dDoc.id, normPin);
            }
            delete d.pin;
            delete d.ownerPin;
            delete d.adminPin;
            delete d.pinLookupHash;

            if (effectiveUid && sessionId && adminDb) {
              try {
                const entityDocRef = adminDb.doc(`delegates/${dDoc.id}`);
                const snap = await entityDocRef.get();
                if (snap.exists) {
                  const data = snap.data() || {};
                  const activeSessionId = data.currentSessionId;
                  const rawLastActive = data.lastActive;
                  const lastActive = rawLastActive ? new Date(rawLastActive.toDate ? rawLastActive.toDate() : rawLastActive).getTime() : 0;
                  const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
                  const isAlive = activeSessionId && activeSessionId !== sessionId && lastActive > 0 && (Date.now() - lastActive < SESSION_TIMEOUT_MS);

                  if (isAlive) {
                    return res.json({ success: false, error: 'SESSION_OCCUPIED' });
                  }
                }

                // Update entity doc with session lock
                await entityDocRef.set({
                  currentSessionId: sessionId,
                  lastActive: new Date()
                }, { merge: true });

                // Provision security session doc with Admin SDK bypass
                await adminDb.doc(`delegate_sessions/${effectiveUid}`).set({
                  uid: effectiveUid,
                  role: 'delegate',
                  entityId: dDoc.id,
                  sessionId,
                  isActive: true,
                  lastActive: new Date(),
                  createdAt: new Date()
                }, { merge: true });
              } catch (sessErr) {
                console.error('[Server Auth] Error claiming delegate session during phone verification:', sessErr);
                // Fail closed
                return res.status(500).json({ success: false, error: 'تعذر تهيئة الجلسة الآمنة، يرجى إعادة المحاولة' });
              }
            }

            // Reset rate limit ONLY when authentication and session claim both succeed
            resetRateLimit(clientIp);

            return res.json({
              success: true,
              role: 'delegate',
              accountId: dDoc.id,
              account: { id: dDoc.id, ...d },
              sessionClaimed: true
            });
          }
        }
      } catch (e) {
        console.error('[Server Auth] Error searching delegates by phone:', e);
      }

      return res.json({ success: false, error: 'بيانات الدخول غير صحيحة' });
    } catch (error) {
      console.error('[Server Auth] Unexpected error in verify-pin:', error);
      return res.status(500).json({ success: false, error: 'حدث خطأ في الاتصال بالخادم' });
    }
  });

  // Secure Server API: Check PIN Availability across all accounts
  app.post('/api/auth/check-pin-availability', async (req, res) => {
    try {
      const { pin, excludeId } = req.body || {};
      const normPin = cleanPin(pin);
      if (!normPin) {
        return res.json({ taken: false });
      }

      // Check Admin PIN
      let adminPinStored = await getAdminPin();
      if (adminPinStored && verifyPinMatch(normPin, adminPinStored).matches) {
        return res.json({ taken: true, role: 'مسؤول النظام (الآدمن الرئيسي)', name: 'الآدمن' });
      }

      const collectionsToCheck = [
        { name: 'supervisors', label: 'مشرف نظام' },
        { name: 'delegates', label: 'مندوب شحن' },
        { name: 'staff', label: 'موظف جراج' },
        { name: 'garages', label: 'صاحب جراج' }
      ];

      for (const coll of collectionsToCheck) {
        try {
          const docs = await queryAccountWherePin(coll.name, normPin);
          for (const dDoc of docs) {
            if (excludeId && dDoc.id === excludeId) continue;
            const docData = dDoc.data;
            return res.json({
              taken: true,
              role: coll.label,
              name: docData.name || docData.ownerName || docData.garageName || 'مستخدم آخر'
            });
          }
        } catch (e) {}
      }

      return res.json({ taken: false });
    } catch (error) {
      console.error('[Server Auth] Error in check-pin-availability:', error);
      return res.status(500).json({ taken: false });
    }
  });

  // Secure Server API: Verify Admin PIN for Admin Logout
  app.post('/api/auth/verify-admin-pin', async (req, res) => {
    try {
      const { pin } = req.body || {};
      const normInput = cleanPin(pin);
      if (!normInput) {
        return res.json({ valid: false });
      }

      let activeAdminPin = await getAdminPin();
      const { matches, isLegacy } = verifyPinMatch(normInput, activeAdminPin);
      if (matches && isLegacy) {
        migratePinToHash('admin_settings', 'auth_pin', normInput);
      }
      return res.json({ valid: matches });
    } catch (error) {
      return res.status(500).json({ valid: false });
    }
  });

  // Secure Server API: Claim / Re-claim Admin Session (Protected against unauthenticated escalation)
  app.post('/api/auth/claim-admin-session', async (req, res) => {
    try {
      const { uid, sessionId, pin, firebaseIdToken } = req.body || {};
      if (!uid || !sessionId || typeof uid !== 'string' || typeof sessionId !== 'string') {
        return res.status(400).json({ success: false, error: 'بيانات غير صالحة' });
      }

      if (!adminDb) {
        return res.status(500).json({ success: false, error: 'Admin DB غير مهيأ' });
      }

      let verifiedUid = '';
      if (firebaseIdToken && adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
          verifiedUid = decoded.uid;
        } catch (tokenErr) {
          console.warn('[Server Auth] Invalid Firebase ID token during claim-admin-session:', tokenErr);
          return res.status(401).json({ success: false, error: 'INVALID_ID_TOKEN' });
        }
      }

      if (verifiedUid && uid.trim() !== verifiedUid) {
        return res.status(401).json({ success: false, error: 'UID_MISMATCH' });
      }

      const effectiveUid = verifiedUid || uid.trim();

      // Check authorization: Must either have valid admin PIN OR already have an active matching session
      let isAuthorized = false;
      const cleanInputPin = pin ? cleanPin(pin) : '';
      if (cleanInputPin) {
        const adminPinStored = await getAdminPin();
        if (verifyPinMatch(cleanInputPin, adminPinStored).matches) {
          isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        const secSnap = await adminDb.doc(`admin_sessions/${effectiveUid}`).get();
        if (secSnap.exists) {
          const sData = secSnap.data() || {};
          if (sData.isActive && sData.sessionId === sessionId) {
            isAuthorized = true;
          }
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ success: false, error: 'غير مصرح: يتطلب إدخال الرقم السري' });
      }

      await adminDb.runTransaction(async (transaction) => {
        const entityDocRef = adminDb.doc('admin_settings/auth_pin');
        const secDocRef = adminDb.doc(`admin_sessions/${effectiveUid}`);

        const snap = await transaction.get(entityDocRef);
        if (snap.exists) {
          const data = snap.data() || {};
          const activeSessionId = data.currentSessionId;
          const rawLastActive = data.lastActive;
          const lastActive = rawLastActive ? new Date(rawLastActive.toDate ? rawLastActive.toDate() : rawLastActive).getTime() : 0;
          const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
          const isAlive = activeSessionId && activeSessionId !== sessionId && lastActive > 0 && (Date.now() - lastActive < SESSION_TIMEOUT_MS);

          if (isAlive) {
            throw new Error('SESSION_OCCUPIED');
          }
        }

        transaction.set(entityDocRef, {
          currentSessionId: sessionId,
          lastActive: new Date()
        }, { merge: true });

        transaction.set(secDocRef, {
          uid: effectiveUid,
          role: 'admin',
          entityId: 'auth_pin',
          sessionId,
          isActive: true,
          lastActive: new Date(),
          createdAt: new Date()
        }, { merge: true });
      });

      return res.json({ success: true, sessionClaimed: true });
    } catch (e: any) {
      if (e?.message === 'SESSION_OCCUPIED') {
        return res.json({ success: false, error: 'SESSION_OCCUPIED' });
      }
      console.error('[Server Auth] Error in claim-admin-session:', e);
      return res.status(500).json({ success: false, error: 'حدث خطأ في الخادم' });
    }
  });

  // Secure Server API: Validate or Refresh an active session across all roles
  app.post('/api/auth/validate-or-refresh-session', async (req, res) => {
    try {
      const { uid, sessionId, role, entityId, firebaseIdToken } = req.body || {};
      if (!uid || !sessionId || !role) {
        return res.status(400).json({ valid: false, error: 'INVALID_PARAMS' });
      }

      if (!adminDb) {
        return res.status(503).json({ valid: false, error: 'DATABASE_UNAVAILABLE' });
      }

      let verifiedUid = '';
      if (firebaseIdToken && adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
          verifiedUid = decoded.uid;
        } catch (tokenErr) {
          return res.status(401).json({ valid: false, error: 'INVALID_ID_TOKEN' });
        }
      }

      if (verifiedUid && typeof uid === 'string' && uid.trim() !== verifiedUid) {
        return res.status(401).json({ valid: false, error: 'UID_MISMATCH' });
      }

      const effectiveUid = verifiedUid || (typeof uid === 'string' ? uid.trim() : '');

      const secCollMap: Record<string, string> = {
        admin: 'admin_sessions',
        supervisor: 'supervisor_sessions',
        delegate: 'delegate_sessions',
        garage: 'garage_sessions',
        staff: 'staff_sessions'
      };
      const entityCollMap: Record<string, string> = {
        admin: 'admin_settings',
        supervisor: 'supervisors',
        delegate: 'delegates',
        garage: 'garages',
        staff: 'staff'
      };

      const secColl = secCollMap[role];
      const entityColl = entityCollMap[role];
      if (!secColl || !entityColl) {
        return res.json({ valid: false, error: 'INVALID_ROLE' });
      }

      const secSnap = await adminDb.doc(`${secColl}/${effectiveUid}`).get();
      if (!secSnap.exists) {
        return res.json({ valid: false, error: 'SESSION_NOT_FOUND' });
      }

      const secData = secSnap.data() || {};
      if (!secData.isActive || secData.sessionId !== sessionId) {
        return res.json({ valid: false, error: 'SESSION_INVALID' });
      }

      // Check session expiration timeout (15 minutes of inactivity)
      const rawLastActive = secData.lastActive;
      const lastActive = rawLastActive ? new Date(rawLastActive.toDate ? rawLastActive.toDate() : rawLastActive).getTime() : 0;
      const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
      if (lastActive > 0 && (Date.now() - lastActive > SESSION_TIMEOUT_MS)) {
        await adminDb.doc(`${secColl}/${effectiveUid}`).update({ isActive: false }).catch(() => {});
        return res.json({ valid: false, error: 'SESSION_EXPIRED' });
      }

      // Check entity level lock: If another session has claimed the entity, this session is revoked
      const targetEntityId = role === 'admin' ? 'auth_pin' : entityId;
      if (targetEntityId) {
        const entitySnap = await adminDb.doc(`${entityColl}/${targetEntityId}`).get();
        if (entitySnap.exists) {
          const entityData = entitySnap.data() || {};
          if (entityData.currentSessionId && entityData.currentSessionId !== sessionId) {
            await adminDb.doc(`${secColl}/${effectiveUid}`).update({ isActive: false }).catch(() => {});
            return res.json({ valid: false, error: 'SESSION_REVOKED' });
          }
        }
      }

      // Refresh timestamps
      const now = new Date();
      await adminDb.doc(`${secColl}/${effectiveUid}`).set({ lastActive: now }, { merge: true });
      if (targetEntityId) {
        await adminDb.doc(`${entityColl}/${targetEntityId}`).set({ lastActive: now }, { merge: true });
      }

      return res.json({ valid: true });
    } catch (error) {
      console.error('[Server Auth] Error validating session:', error);
      return res.status(500).json({ valid: false, error: 'SERVER_ERROR' });
    }
  });

  // Secure Server API: Release Session (Universal across all roles)
  app.post('/api/auth/release-session', async (req, res) => {
    try {
      const { uid, sessionId, role, entityId, firebaseIdToken } = req.body || {};
      if (!uid || !sessionId || !role) {
        return res.json({ success: true });
      }

      if (adminDb) {
        let verifiedUid = '';
        if (firebaseIdToken && adminAuth) {
          try {
            const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
            verifiedUid = decoded.uid;
          } catch (tokenErr) {
            console.warn('[Server Auth] Token verification warning during release-session:', tokenErr);
          }
        }

        const effectiveUid = verifiedUid || (typeof uid === 'string' ? uid.trim() : '');

        const secCollMap: Record<string, string> = {
          admin: 'admin_sessions',
          supervisor: 'supervisor_sessions',
          delegate: 'delegate_sessions',
          garage: 'garage_sessions',
          staff: 'staff_sessions'
        };
        const entityCollMap: Record<string, string> = {
          admin: 'admin_settings',
          supervisor: 'supervisors',
          delegate: 'delegates',
          garage: 'garages',
          staff: 'staff'
        };

        const secColl = secCollMap[role];
        const entityColl = entityCollMap[role];
        const targetEntityId = role === 'admin' ? 'auth_pin' : entityId;

        if (entityColl && targetEntityId) {
          const entitySnap = await adminDb.doc(`${entityColl}/${targetEntityId}`).get();
          if (entitySnap.exists && entitySnap.data()?.currentSessionId === sessionId) {
            await adminDb.doc(`${entityColl}/${targetEntityId}`).update({
              currentSessionId: null
            });
          }
        }

        if (secColl && effectiveUid) {
          const secSnap = await adminDb.doc(`${secColl}/${effectiveUid}`).get();
          if (secSnap.exists && secSnap.data()?.sessionId === sessionId) {
            await adminDb.doc(`${secColl}/${effectiveUid}`).update({
              isActive: false,
              lastActive: new Date()
            });
          }
        }
      }

      return res.json({ success: true });
    } catch (e) {
      console.error('[Server Auth] Error in release-session:', e);
      return res.json({ success: false });
    }
  });

  // Secure Server API: Release Admin Session (Backward compatibility)
  app.post('/api/auth/release-admin-session', async (req, res) => {
    try {
      const { uid, sessionId } = req.body || {};
      if (!uid || !sessionId) {
        return res.json({ success: true });
      }

      if (adminDb) {
        const snap = await adminDb.doc('admin_settings/auth_pin').get();
        if (snap.exists && snap.data()?.currentSessionId === sessionId) {
          await adminDb.doc('admin_settings/auth_pin').update({
            currentSessionId: null
          });
        }

        const secSnap = await adminDb.doc(`admin_sessions/${uid}`).get();
        if (secSnap.exists && secSnap.data()?.sessionId === sessionId) {
          await adminDb.doc(`admin_sessions/${uid}`).update({
            isActive: false,
            lastActive: new Date()
          });
        }
      }

      return res.json({ success: true });
    } catch (e) {
      console.error('[Server Auth] Error in release-admin-session:', e);
      return res.json({ success: false });
    }
  });

  // Secure Server API: Server-Authoritative Garage Package Recharge Engine
  app.post('/api/transactions/recharge-garage', requireAuth, async (req: AuthRequest, res: any) => {
    if (req.user?.role === 'garage') return res.status(403).json({ success: false, error: 'GARAGE_CANNOT_RECHARGE_OTHERS' });
    try {
      const { garageId, packageId, adminDetails } = req.body || {};
      const callerUid = req.user?.uid;
      const callerRole = req.user?.role;
      
      if (!garageId) {
        return res.status(400).json({ success: false, error: 'GARAGE_ID_REQUIRED' });
      }

      // 1. Session & Permission Verification
      // Auth and role verified by requireAuth middleware
      
      // Check caller active session lock
      if (adminDb && callerUid) {
        const secCollMap: Record<string, string> = {
          admin: 'admin_sessions',
          supervisor: 'supervisor_sessions',
          delegate: 'delegate_sessions',
          garage: 'garage_sessions',
          staff: 'staff_sessions'
        };
        const secColl = secCollMap[callerRole];
        if (secColl) {
          const secSnap = await adminDb.doc(`${secColl}/${callerUid}`).get();
          if (secSnap.exists) {
            const secData = secSnap.data() || {};
            if (!secData.isActive) {
              return res.status(403).json({ success: false, error: 'SESSION_INACTIVE' });
            }
          }
        }
      }

      // 2. Package Data Parsing & Sanitization (Server Authoritative)
      let packageObj: any = {};
      if (packageId) {
        const pkgSnap = await adminDb.doc(`packages/${packageId}`).get();
        if (pkgSnap.exists) packageObj = { id: pkgSnap.id, ...pkgSnap.data() };
      }
      if (!packageObj.id) return res.status(400).json({ success: false, error: 'PACKAGE_NOT_FOUND' });
      const rawDays = Number(packageObj.durationDays || packageObj.vehiclesCount || 30);
      const durationDays = Math.max(1, Math.min(365, isNaN(rawDays) ? 30 : rawDays));
      const price = Math.max(0, Number(packageObj.price || packageObj.priceAmount || 0));
      const packageName = String(packageObj.name || packageObj.packageName || 'باقة الاشتراك');
      const isUnlimited = Boolean(
        packageObj.isUnlimited ||
        packageName.includes('مفتوح') ||
        packageName.includes('غير محدود') ||
        packageName.includes('بدون حدود')
      );
      const effCapacity = isUnlimited ? 0 : Math.max(1, Number(packageObj.dailyCapacity || packageObj.carsCount || 40));

      let resultData: any = null;

      if (adminDb) {
        await adminDb.runTransaction(async (t: any) => {
          const garageRef = adminDb.doc(`garages/${garageId}`);
          const garageSnap = await t.get(garageRef);
          if (!garageSnap.exists) {
            throw new Error('GARAGE_NOT_FOUND');
          }

          const garageData = garageSnap.data() || {};

          // Business Guardrail Check: If garage handles monthly subscribers, restrict package duration < 15 days
          if (garageData.hasMonthlySubscribers === true && durationDays < 15) {
            throw new Error('MONTHLY_SUBSCRIBERS_PACKAGE_RESTRICTION');
          }

          let baseDate = new Date();
          const currentExpiry = garageData.balanceExpiry;
          if (currentExpiry) {
            const currentExpDate = new Date(currentExpiry.toDate ? currentExpiry.toDate() : currentExpiry);
            if (!isNaN(currentExpDate.getTime()) && currentExpDate.getTime() > baseDate.getTime()) {
              baseDate = currentExpDate; // Subscription rollover extension
            }
          }
          baseDate.setDate(baseDate.getDate() + durationDays);

          // Referrer Garage reward evaluation
          const referrerGarageId = garageData.referredByGarageId;
          let referrerRef: any = null;
          let referrerSnap: any = null;
          const isEligibleForReferral =
            Boolean(referrerGarageId) &&
            referrerGarageId !== garageId &&
            price > 0 &&
            durationDays > 1;

          if (isEligibleForReferral && referrerGarageId) {
            referrerRef = adminDb.doc(`garages/${referrerGarageId}`);
            referrerSnap = await t.get(referrerRef);
          }

          const newRevenue = Number(((garageData.totalAdminRevenue || 0) + price).toFixed(2));

          const updateData: any = {
            totalAdminRevenue: newRevenue,
            isLocked: false,
            isTrial: false,
            dailyCapacity: effCapacity,
            activePackageName: packageName,
            packageName: packageName,
            lastRechargeDate: new Date(),
            lastRechargeAmount: price,
            lastRechargePackageName: packageName,
            balanceExpiry: baseDate,
            billingModel: 'subscription'
          };

          t.set(garageRef, updateData, { merge: true });

          // Log transaction in activity_logs
          const logRef = adminDb.collection('activity_logs').doc();
          const staffNameText = (adminDetails && adminDetails.staffName) || 'مدير النظام (Admin)';
          t.set(logRef, {
            garageId,
            garageName: garageData.name || '',
            staffId: (adminDetails && adminDetails.staffId) || callerUid || 'admin',
            staffName: staffNameText,
            actionType: 'recharge',
            plateNumber: `تجديد اشتراك: ${packageName} (${durationDays} يوم) - ${price} ج`,
            timestamp: new Date(),
            amount: price,
            packageId: packageId || packageObj.id || 'direct_recharge',
            details: {
              packageName,
              durationDays,
              carsCount: effCapacity,
              revenueAmount: price,
              originalRevenueAmount: price,
              discountAmount: 0,
              rechargedBy: staffNameText
            }
          });

          // Grant Referral Reward if eligible
          if (isEligibleForReferral && referrerRef && referrerSnap && referrerSnap.exists) {
            const referrerData = referrerSnap.data() || {};
            t.set(referrerRef, {
              totalReferralRewardDays: (referrerData.totalReferralRewardDays || 0) + 1,
              totalGaragesReferredCount: (referrerData.totalGaragesReferredCount || 0) + 1,
              lastReferralRewardAt: new Date()
            }, { merge: true });

            const rewardLogRef = adminDb.collection('activity_logs').doc();
            t.set(rewardLogRef, {
              garageId: referrerGarageId,
              garageName: referrerData.name || '',
              staffId: null,
              staffName: 'النظام — مكافأة إحالة',
              actionType: 'recharge',
              plateNumber: `مكافأة إحالة من ${garageData.name || ''} — إضافة يوم مجاني برصيد المكافآت`,
              timestamp: new Date(),
              amount: 0,
              packageId: referrerData.packageId || 'referral_reward',
              details: {
                type: 'referral_reward',
                referrerGarageId: referrerGarageId,
                referredGarageId: garageId
              }
            });
          }

          resultData = {
            newExpiry: baseDate.toISOString(),
            totalAdminRevenue: newRevenue
          };
        });
      } else {
        return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });
      }

      return res.json({
        success: true,
        data: resultData
      });
    } catch (error: any) {
      console.error('[Server Transaction] Error in recharge-garage:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'TRANSACTION_FAILED'
      });
    }
  });

  // Secure Server API: Approve Recharge Request
  app.post('/api/transactions/approve-recharge-request', requireAuth, async (req: AuthRequest, res: any) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'supervisor') return res.status(403).json({ success: false, error: 'ADMIN_OR_SUPERVISOR_ONLY' });
    const callerUid = req.user?.uid;
    const callerRole = req.user?.role;
    try {
      const { requestId, request, firebaseIdToken, uid, role } = req.body || {};
      const reqId = requestId || (request && request.id);

      if (!reqId) {
        return res.status(400).json({ success: false, error: 'REQUEST_ID_REQUIRED' });
      }

      // Session Verification
      let verifiedUid = '';
      if (firebaseIdToken && adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
          verifiedUid = decoded.uid;
        } catch (tokenErr) {
          console.warn('[Server Transaction] Token verification failed:', tokenErr);
          return res.status(401).json({ success: false, error: 'INVALID_ID_TOKEN' });
        }
      }

      const callerUid = verifiedUid || (typeof uid === 'string' ? uid.trim() : '');
      const callerRole = role || 'admin';

      if (adminDb && callerUid) {
        const secCollMap: Record<string, string> = {
          admin: 'admin_sessions',
          supervisor: 'supervisor_sessions',
          delegate: 'delegate_sessions',
          garage: 'garage_sessions',
          staff: 'staff_sessions'
        };
        const secColl = secCollMap[callerRole];
        if (secColl) {
          const secSnap = await adminDb.doc(`${secColl}/${callerUid}`).get();
          if (secSnap.exists) {
            const secData = secSnap.data() || {};
            if (!secData.isActive) {
              return res.status(403).json({ success: false, error: 'SESSION_INACTIVE' });
            }
          }
        }
      }

      if (!adminDb) {
        return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });
      }

      let resultData: any = null;

      await adminDb.runTransaction(async (t: any) => {
        const requestRef = adminDb.doc(`recharge_requests/${reqId}`);
        const requestSnap = await t.get(requestRef);
        if (!requestSnap.exists) {
          throw new Error('REQUEST_NOT_FOUND');
        }

        const requestData = requestSnap.data() || {};
        if (requestData.status && requestData.status !== 'pending') {
          throw new Error('REQUEST_ALREADY_PROCESSED');
        }

        const targetGarageId = requestData.garageId || (request && request.garageId);
        if (!targetGarageId) {
          throw new Error('GARAGE_ID_MISSING');
        }

        const garageRef = adminDb.doc(`garages/${targetGarageId}`);
        const garageSnap = await t.get(garageRef);
        if (!garageSnap.exists) {
          throw new Error('GARAGE_NOT_FOUND');
        }

        const garageData = garageSnap.data() || {};

        // System Settings
        const settingsSnap = await t.get(adminDb.doc('admin_settings/general'));
        const systemConfig = settingsSnap.exists ? settingsSnap.data() : {};

        const delegateCommissions = systemConfig?.delegatePackageCommissions || {
          daily: 5,
          weekly: 15,
          biweekly: 25,
          monthly: systemConfig?.referralFeePerRenewal !== undefined ? Number(systemConfig.referralFeePerRenewal) : 50
        };

        const subscriberFlatFee = systemConfig?.subscriberFlatFee !== undefined
          ? Math.max(0, Number(systemConfig.subscriberFlatFee))
          : (systemConfig?.monthlySubscribersFlatFee !== undefined ? Number(systemConfig.monthlySubscribersFlatFee) : 500);

        const delegateReferrerId = garageData.referrerId || garageData.createdByDelegateId || null;
        const referredByDelegate = Boolean(delegateReferrerId);

        // Check if this is a balance top-up request
        const isBalanceTopup = requestData.requestType === 'balance_topup' || requestData.packageId === 'balance_topup';

        if (isBalanceTopup) {
          const topupAmount = Number(requestData.amount || requestData.revenueAmount || 0);
          const currentBalance = Number(garageData.balance || 0);
          const newGarageBalance = currentBalance + topupAmount;

          const targetDelegateId = delegateReferrerId || requestData.delegateId || null;
          let delegateRef: any = null;
          let delegateSnap: any = null;
          if (targetDelegateId) {
            delegateRef = adminDb.doc(`delegates/${targetDelegateId}`);
            delegateSnap = await t.get(delegateRef);
          }

          // Update Garage balance
          t.set(garageRef, {
            balance: newGarageBalance,
            totalAdminRevenue: (garageData.totalAdminRevenue || 0) + topupAmount,
            lastRechargeDate: new Date(),
            lastRechargeAmount: topupAmount,
            lastRechargePackageName: `شحن رصيد محفظة (${topupAmount} ج.م)`
          }, { merge: true });

          // Update Request
          t.set(requestRef, {
            status: 'approved',
            amount: topupAmount,
            revenueAmount: topupAmount,
            originalRevenueAmount: topupAmount,
            resolvedAt: new Date()
          }, { merge: true });

          // Update Delegate stats
          if (delegateRef && delegateSnap && delegateSnap.exists) {
            const delData = delegateSnap.data() || {};
            t.set(delegateRef, {
              totalRechargedAmount: (delData.totalRechargedAmount || 0) + topupAmount
            }, { merge: true });
          }

          // Log Activity
          const logRef = adminDb.collection('activity_logs').doc();
          t.set(logRef, {
            garageId: targetGarageId,
            garageName: requestData.garageName || garageData.name || '',
            staffId: delegateReferrerId || requestData.delegateId || null,
            staffName: requestData.delegateName || null,
            actionType: 'balance_topup',
            plateNumber: `شحن رصيد محفظة (${topupAmount} ج.م)`,
            timestamp: new Date(),
            amount: topupAmount,
            details: {
              action: 'balance_topup',
              amount: topupAmount,
              previousBalance: currentBalance,
              newBalance: newGarageBalance,
              delegateId: requestData.delegateId || null,
              delegateName: requestData.delegateName || null,
              requestId: reqId
            }
          });

          resultData = {
            requestId: reqId,
            status: 'approved',
            newBalance: newGarageBalance,
            revenue: topupAmount
          };
        } else {
          // Package Price Calculation
          const rawPackageData = requestData.packageData || {};
          const durationDays = Number(requestData.durationDays || requestData.carsCount || 30);
          const basePrice = Number(rawPackageData.price || rawPackageData.priceAmount || requestData.amount || 0);

          let commission = 0;
          if (referredByDelegate) {
            if (durationDays >= 30) commission = Number(delegateCommissions.monthly || 50);
            else if (durationDays >= 14) commission = Number(delegateCommissions.biweekly || 25);
            else if (durationDays >= 7) commission = Number(delegateCommissions.weekly || 15);
            else commission = Number(delegateCommissions.daily || 5);
          }

          const effectiveOriginalRevenue = basePrice;
          const discountAmount = Number(requestData.discountAmount || 0);
          let effectiveRevenue = Math.max(0, basePrice - discountAmount);
          if (garageData.hasMonthlySubscribers === true) {
            effectiveRevenue += subscriberFlatFee;
          }

          // Delegate Doc Check
          const targetDelegateId = delegateReferrerId || requestData.delegateId || null;
          let delegateRef: any = null;
          let delegateSnap: any = null;
          if (targetDelegateId) {
            delegateRef = adminDb.doc(`delegates/${targetDelegateId}`);
            delegateSnap = await t.get(delegateRef);
          }

          // Expiry Calculation
          let baseDate = new Date();
          const currentExpiry = garageData.balanceExpiry;
          if (currentExpiry) {
            const expDate = new Date(currentExpiry.toDate ? currentExpiry.toDate() : currentExpiry);
            if (!isNaN(expDate.getTime()) && expDate.getTime() > baseDate.getTime()) {
              baseDate = expDate;
            }
          }
          baseDate.setDate(baseDate.getDate() + durationDays);

          // Unlimited capacity check
          const pkgName = String(requestData.packageName || '');
          const isUnlimitedPkg =
            pkgName.includes('مفتوح') ||
            pkgName.includes('غير محدود') ||
            pkgName.includes('غير محدودة') ||
            pkgName.includes('بدون حدود') ||
            pkgName.includes('سعة مفتوحة');

          const effCapacity = isUnlimitedPkg ? 0 : Math.max(1, Number(requestData.dailyCapacity || 40));

          // Update Garage
          t.set(garageRef, {
            balanceExpiry: baseDate,
            dailyCapacity: effCapacity,
            activePackageName: requestData.packageName || 'الباقة',
            packageName: requestData.packageName || 'الباقة',
            billingModel: 'subscription',
            isLocked: false,
            isTrial: false,
            totalAdminRevenue: (garageData.totalAdminRevenue || 0) + effectiveRevenue,
            lastRechargeDate: new Date(),
            lastRechargeAmount: effectiveRevenue,
            lastRechargePackageName: requestData.packageName || null
          }, { merge: true });

          // Update Request
          t.set(requestRef, {
            status: 'approved',
            commission: commission,
            referrerId: delegateReferrerId,
            amount: effectiveRevenue,
            revenueAmount: effectiveRevenue,
            originalRevenueAmount: effectiveOriginalRevenue,
            resolvedAt: new Date()
          }, { merge: true });

          // Update Delegate
          if (delegateRef && delegateSnap && delegateSnap.exists) {
            const delData = delegateSnap.data() || {};
            t.set(delegateRef, {
              totalRechargedAmount: (delData.totalRechargedAmount || 0) + effectiveRevenue,
              totalCommissionEarned: (delData.totalCommissionEarned || 0) + commission
            }, { merge: true });
          }

          // Log Activity
          const logRef = adminDb.collection('activity_logs').doc();
          t.set(logRef, {
            garageId: targetGarageId,
            garageName: requestData.garageName || garageData.name || '',
            staffId: delegateReferrerId || requestData.delegateId || null,
            staffName: requestData.delegateName || null,
            actionType: 'recharge',
            plateNumber: `شحن ${requestData.packageName || 'الباقة'} (${durationDays} يوم - ${effCapacity === 0 ? 'مفتوح' : `${effCapacity} سيارة`})`,
            timestamp: new Date(),
            amount: effectiveRevenue,
            packageId: requestData.packageId || null,
            details: {
              packageName: requestData.packageName,
              durationDays,
              carsCount: effCapacity,
              revenueAmount: effectiveRevenue,
              commission: commission,
              requestId: reqId
            }
          });

          resultData = {
            requestId: reqId,
            status: 'approved',
            newExpiry: baseDate.toISOString(),
            revenue: effectiveRevenue,
            commission
          };
        }
      });

      return res.json({ success: true, data: resultData });
    } catch (error: any) {
      console.error('[Server Transaction] Error in approve-recharge-request:', error);
      return res.status(500).json({
        success: false,
        error: error?.message || 'TRANSACTION_FAILED'
      });
    }
  });

  // Secure Server API: Reject Recharge Request
  app.post('/api/transactions/reject-recharge-request', requireAuth, async (req: AuthRequest, res: any) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'supervisor') return res.status(403).json({ success: false, error: 'ADMIN_OR_SUPERVISOR_ONLY' });
    const callerUid = req.user?.uid;
    const callerRole = req.user?.role;
    try {
      const { requestId } = req.body || {};
      if (!requestId) {
        return res.status(400).json({ success: false, error: 'REQUEST_ID_REQUIRED' });
      }

      if (!adminDb) {
        return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });
      }

      const requestRef = adminDb.doc(`recharge_requests/${requestId}`);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        return res.status(404).json({ success: false, error: 'REQUEST_NOT_FOUND' });
      }

      const currentStatus = requestSnap.data()?.status;
      if (currentStatus && currentStatus !== 'pending') {
        return res.status(400).json({ success: false, error: 'REQUEST_ALREADY_PROCESSED' });
      }

      await requestRef.set({
        status: 'rejected',
        resolvedAt: new Date()
      }, { merge: true });

      return res.json({ success: true });
    } catch (error: any) {
      console.error('[Server Transaction] Error in reject-recharge-request:', error);
      return res.status(500).json({ success: false, error: error?.message || 'REJECT_FAILED' });
    }
  });

  // Secure Server API: Admin Direct Balance Top-Up
  app.post('/api/transactions/admin-topup-balance', requireAuth, async (req: AuthRequest, res: any) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ success: false, error: 'ADMIN_ONLY' });
    try {
      const { garageId, amount, firebaseIdToken } = req.body || {};
      if (!garageId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: 'INVALID_PARAMETERS' });
      }
      if (!adminDb) {
        return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });
      }

      const numAmount = Math.round(Number(amount));
      let resultData: any = null;

      await adminDb.runTransaction(async (t: any) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const garageSnap = await t.get(garageRef);
        if (!garageSnap.exists) {
          throw new Error('GARAGE_NOT_FOUND');
        }

        const garageData = garageSnap.data() || {};
        const currentBalance = Number(garageData.balance || 0);
        const newBalance = currentBalance + numAmount;

        t.set(garageRef, {
          balance: newBalance,
          totalAdminRevenue: (garageData.totalAdminRevenue || 0) + numAmount,
          lastRechargeDate: new Date(),
          lastRechargeAmount: numAmount,
          lastRechargePackageName: `شحن رصيد مباشر (${numAmount} ج.م)`
        }, { merge: true });

        const logRef = adminDb.collection('activity_logs').doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || '',
          staffId: 'admin',
          staffName: 'مدير النظام (Admin)',
          actionType: 'balance_topup',
          plateNumber: `شحن رصيد مباشر (${numAmount} ج.م)`,
          timestamp: new Date(),
          amount: numAmount,
          details: {
            action: 'admin_balance_topup',
            amount: numAmount,
            previousBalance: currentBalance,
            newBalance
          }
        });

        resultData = { garageId, newBalance, addedAmount: numAmount };
      });

      return res.json({ success: true, data: resultData });
    } catch (error: any) {
      console.error('[Server Transaction] Error in admin-topup-balance:', error);
      return res.status(500).json({ success: false, error: error?.message || 'TRANSACTION_FAILED' });
    }
  });

  // Secure Server API: Garage Self-Service Subscription Using Balance
  app.post('/api/transactions/garage-self-subscribe', requireAuth, async (req: AuthRequest, res: any) => {
    const userRole = req.user?.role;
    const userGarageId = req.user?.garageId;
    try {
      const { garageId: bodyGarageId, packageId } = req.body || {};
      const garageId = userRole === 'garage' ? userGarageId : bodyGarageId;
      if (userRole === 'garage' && userGarageId !== bodyGarageId) return res.status(403).json({ success: false, error: 'UNAUTHORIZED_GARAGE_ACCESS' });
      if (!garageId) {
        return res.status(400).json({ success: false, error: 'GARAGE_ID_REQUIRED' });
      }
      if (!adminDb) {
        return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });
      }

      let resultData: any = null;

      await adminDb.runTransaction(async (t: any) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const garageSnap = await t.get(garageRef);
        if (!garageSnap.exists) {
          throw new Error('GARAGE_NOT_FOUND');
        }

        const garageData = garageSnap.data() || {};
        const currentBalance = Number(garageData.balance || 0);

        // System config for subscriber flat fee
        const settingsSnap = await t.get(adminDb.doc('system_config/global'));
        const systemConfig = settingsSnap.exists ? settingsSnap.data() : {};
        const subscriberFlatFee = systemConfig?.subscriberFlatFee !== undefined
          ? Math.max(0, Number(systemConfig.subscriberFlatFee))
          : (systemConfig?.monthlySubscribersFlatFee !== undefined ? Number(systemConfig.monthlySubscribersFlatFee) : 500);

        // Resolve package info entirely from server
        let pkg = null;
        if (packageId) {
          const pkgRef = adminDb.doc(`packages/${packageId}`);
          const pkgSnap = await t.get(pkgRef);
          if (pkgSnap.exists) {
            pkg = { id: pkgSnap.id, ...pkgSnap.data() };
          }
        }

        if (!pkg) {
          throw new Error('PACKAGE_NOT_FOUND');
        }

        const durationDays = Number(pkg.durationDays || pkg.vehiclesCount || 30);
        let basePrice = Number(pkg.price || 0);

        // Calculate discount if applicable
        let discountAmount = 0;
        if (pkg.discountType === 'percentage' && pkg.discountValue > 0) {
          discountAmount = Math.round((basePrice * Number(pkg.discountValue)) / 100);
        } else if (pkg.discountType === 'fixed' && pkg.discountValue > 0) {
          discountAmount = Math.min(basePrice, Number(pkg.discountValue));
        }

        let effectivePrice = Math.max(0, basePrice - discountAmount);
        if (garageData.hasMonthlySubscribers === true) {
          effectivePrice += subscriberFlatFee;
        }

        if (currentBalance < effectivePrice) {
          throw new Error(`INSUFFICIENT_BALANCE: الرصيد المتاح (${currentBalance} ج.م) غير كافٍ للاشتراك في هذه الباقة (${effectivePrice} ج.م)`);
        }

        const newBalance = currentBalance - effectivePrice;

        // Calculate new expiry
        let baseDate = new Date();
        const currentExpiry = garageData.balanceExpiry;
        if (currentExpiry) {
          const expDate = new Date(currentExpiry.toDate ? currentExpiry.toDate() : currentExpiry);
          if (!isNaN(expDate.getTime()) && expDate.getTime() > baseDate.getTime()) {
            baseDate = expDate;
          }
        }
        baseDate.setDate(baseDate.getDate() + durationDays);

        const pkgName = String(pkg.name || 'باقة اشتراك');
        const isUnlimitedPkg =
          pkgName.includes('مفتوح') ||
          pkgName.includes('غير محدود') ||
          pkgName.includes('غير محدودة') ||
          pkgName.includes('بدون حدود') ||
          pkgName.includes('سعة مفتوحة') ||
          pkg.dailyCapacity === 0;

        const effCapacity = isUnlimitedPkg ? 0 : Math.max(1, Number(pkg.dailyCapacity || 40));

        // Update Garage
        t.set(garageRef, {
          balance: newBalance,
          balanceExpiry: baseDate,
          dailyCapacity: effCapacity,
          activePackageName: pkgName,
          packageName: pkgName,
          billingModel: 'subscription',
          isLocked: false,
          isTrial: false,
          lastRechargeDate: new Date(),
          lastRechargeAmount: effectivePrice,
          lastRechargePackageName: pkgName
        }, { merge: true });

        // Log Activity
        const logRef = adminDb.collection('activity_logs').doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || '',
          staffId: 'owner',
          staffName: garageData.ownerName || 'مدير الجراج',
          actionType: 'self_subscribe',
          plateNumber: `تفعيل باقة بالرصيد: ${pkgName} (${durationDays} يوم)`,
          timestamp: new Date(),
          amount: effectivePrice,
          packageId: pkg.id || packageId,
          details: {
            packageName: pkgName,
            durationDays,
            carsCount: effCapacity,
            cost: effectivePrice,
            previousBalance: currentBalance,
            remainingBalance: newBalance
          }
        });

        resultData = {
          garageId,
          newBalance,
          newExpiry: baseDate.toISOString(),
          packageName: pkgName,
          deductedAmount: effectivePrice
        };
      });

      return res.json({ success: true, data: resultData });
    } catch (error: any) {
      console.error('[Server Transaction] Error in garage-self-subscribe:', error);
      return res.status(500).json({ success: false, error: error?.message || 'TRANSACTION_FAILED' });
    }
  });

  
  // Secure Server API: Vehicle Check-In
  app.post('/api/vehicles/check-in', requireAuth, async (req: AuthRequest, res: any) => {
    try {
      const { garageId: bodyGarageId, plateNumber, plateRaw, type, isSubscriber, staffName } = req.body || {};
      const callerRole = req.user?.role;
      let garageId = '';

      if (callerRole === 'garage' || callerRole === 'staff') {
        if (!req.user?.garageId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN: Garage ID missing in session' });
        }
        if (bodyGarageId && bodyGarageId !== req.user.garageId) {
          return res.status(403).json({ success: false, error: 'GARAGE_SCOPE_MISMATCH' });
        }
        garageId = req.user.garageId;
      } else if (callerRole === 'admin') {
        garageId = bodyGarageId;
      } else {
        return res.status(403).json({ success: false, error: 'FORBIDDEN: Role not authorized for vehicle operations' });
      }

      const staffId = req.user?.uid;
      
      if (!garageId || !plateNumber || !plateRaw) {
        return res.status(400).json({ success: false, error: 'MISSING_PARAMETERS' });
      }
      if (!adminDb) return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });

      // Get Cairo date key helper inline
      const getCairoDateKey = () => {
        return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      };

      await adminDb.runTransaction(async (t: any) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const vehicleRef = adminDb.doc(`garages/${garageId}/vehicles/${plateRaw}`);
        const today = getCairoDateKey();
        const dailyStatsRef = adminDb.doc(`garages/${garageId}/daily_stats/${today}`);

        const [garageSnap, vehicleSnap, dailyStatsSnap] = await Promise.all([
          t.get(garageRef),
          t.get(vehicleRef),
          t.get(dailyStatsRef)
        ]);

        if (!garageSnap.exists) throw new Error('GARAGE_NOT_FOUND');
        const garageData = garageSnap.data() || {};
        
        // Subscription check
        const expDateRaw = garageData.balanceExpiry;
        if (!expDateRaw) throw new Error('SUBSCRIPTION_EXPIRED');
        const expDate = expDateRaw.toDate ? expDateRaw.toDate() : new Date(expDateRaw);
        if (isNaN(expDate.getTime()) || expDate.getTime() < Date.now()) {
           throw new Error('SUBSCRIPTION_EXPIRED');
        }

        // Capacity check
        const capacity = Number(garageData.dailyCapacity || 0);
        const used = Number(garageData.todayCount || 0);
        const isUnlimited = capacity === 0 || String(garageData.activePackageName || '').includes('مفتوح');
        if (!isUnlimited && used >= capacity) {
          throw new Error('CAPACITY_LIMIT_REACHED');
        }

        if (vehicleSnap.exists && vehicleSnap.data()?.status === 'inside') {
          throw new Error('VEHICLE_ALREADY_INSIDE');
        }

        const isNewDay = garageData.lastTransactionDate !== today;
        
        t.set(vehicleRef, {
          id: plateRaw,
          plate: plateNumber,
          plateNumber,
          plateNumberRaw: plateRaw,
          type: type || 'hourly',
          isSubscriber: !!isSubscriber,
          entryTime: new Date(),
          status: 'inside',
          staffId: staffId || null,
          staffName: staffName || 'مدير الجراج'
        }, { merge: true });

        t.set(garageRef, {
          carsInside: (garageData.carsInside || 0) + 1,
          todayCount: isNewDay ? 1 : used + 1,
          todayRevenue: isNewDay ? 0 : (garageData.todayRevenue || 0),
          lastTransactionDate: today
        }, { merge: true });

        if (!dailyStatsSnap.exists) {
          t.set(dailyStatsRef, {
            dateId: today,
            count: 1,
            limit: isUnlimited ? 0 : capacity,
            revenue: 0,
            createdAt: new Date()
          });
        } else {
          t.set(dailyStatsRef, { count: (dailyStatsSnap.data()?.count || 0) + 1 }, { merge: true });
        }

        const logRef = adminDb.collection('activity_logs').doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || '',
          staffId: staffId || null,
          staffName: staffName || 'مدير الجراج',
          actionType: 'check_in',
          plateNumber,
          timestamp: new Date(),
          amount: 0
        });
      });

      return res.json({ success: true });
    } catch (err: any) {
      console.error('[Server] Check-in error:', err);
      return res.status(500).json({ success: false, error: err.message || 'CHECK_IN_FAILED' });
    }
  });

  // Secure Server API: Vehicle Check-Out
  app.post('/api/vehicles/check-out', requireAuth, async (req: AuthRequest, res: any) => {
    try {
      const { garageId: bodyGarageId, vehicleId, staffName } = req.body || {};
      const callerRole = req.user?.role;
      let garageId = '';

      if (callerRole === 'garage' || callerRole === 'staff') {
        if (!req.user?.garageId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN: Garage ID missing in session' });
        }
        if (bodyGarageId && bodyGarageId !== req.user.garageId) {
          return res.status(403).json({ success: false, error: 'GARAGE_SCOPE_MISMATCH' });
        }
        garageId = req.user.garageId;
      } else if (callerRole === 'admin') {
        garageId = bodyGarageId;
      } else {
        return res.status(403).json({ success: false, error: 'FORBIDDEN: Role not authorized for vehicle operations' });
      }

      const staffId = req.user?.uid;
      
      if (!garageId || !vehicleId) {
        return res.status(400).json({ success: false, error: 'MISSING_PARAMETERS' });
      }
      if (!adminDb) return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });

      const getCairoDateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

      let finalCost = 0;

      await adminDb.runTransaction(async (t: any) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const vehicleRef = adminDb.doc(`garages/${garageId}/vehicles/${vehicleId}`);
        const today = getCairoDateKey();
        const dailyStatsRef = adminDb.doc(`garages/${garageId}/daily_stats/${today}`);

        const [garageSnap, vehicleSnap, dailyStatsSnap] = await Promise.all([
          t.get(garageRef),
          t.get(vehicleRef),
          t.get(dailyStatsRef)
        ]);

        if (!garageSnap.exists) throw new Error('GARAGE_NOT_FOUND');
        if (!vehicleSnap.exists) throw new Error('VEHICLE_NOT_FOUND');

        const garageData = garageSnap.data() || {};
        const vehicleData = vehicleSnap.data() || {};

        if (vehicleData.status === 'outside') {
          throw new Error('VEHICLE_ALREADY_OUTSIDE');
        }

        // Server-authoritative cost calculation
        let cost = 0;
        if (!vehicleData.isSubscriber) {
          const entryTime = vehicleData.entryTime?.toDate ? vehicleData.entryTime.toDate() : new Date(vehicleData.entryTime);
          if (entryTime && !isNaN(entryTime.getTime())) {
            const diffMs = Date.now() - entryTime.getTime();
            let hours = Math.ceil(diffMs / (1000 * 60 * 60));
            if (hours < 1) hours = 1;
            const rate = Number(garageData.hourlyRate || 0);
            cost = hours * rate;
          }
        }
        finalCost = cost;

        t.set(vehicleRef, {
          status: 'outside',
          exitTime: new Date(),
          totalCost: cost
        }, { merge: true });

        const isNewDay = garageData.lastTransactionDate !== today;
        
        t.set(garageRef, {
          totalRevenue: (garageData.totalRevenue || 0) + cost,
          totalVehiclesOut: (garageData.totalVehiclesOut || 0) + 1,
          todayRevenue: isNewDay ? cost : (garageData.todayRevenue || 0) + cost,
          todayCount: isNewDay ? 0 : (garageData.todayCount || 0),
          lastTransactionDate: today,
          carsInside: Math.max(0, (garageData.carsInside || 0) - 1)
        }, { merge: true });

        if (!dailyStatsSnap.exists) {
          t.set(dailyStatsRef, {
            dateId: today,
            count: 0,
            revenue: cost,
            createdAt: new Date()
          });
        } else {
          t.set(dailyStatsRef, { revenue: (dailyStatsSnap.data()?.revenue || 0) + cost }, { merge: true });
        }

        const logRef = adminDb.collection('activity_logs').doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || '',
          staffId: staffId || null,
          staffName: staffName || 'مدير الجراج',
          actionType: 'check_out',
          plateNumber: vehicleData.plateNumber,
          plateNumberRaw: vehicleData.plateNumberRaw || vehicleId,
          entryTime: vehicleData.entryTime,
          type: vehicleData.type || 'hourly',
          isSubscriber: !!vehicleData.isSubscriber,
          timestamp: new Date(),
          amount: cost
        });
      });

      return res.json({ success: true, data: { cost: finalCost } });
    } catch (err: any) {
      console.error('[Server] Check-out error:', err);
      return res.status(500).json({ success: false, error: err.message || 'CHECK_OUT_FAILED' });
    }
  });

  // Secure Server API: Vehicle Delete
  app.post('/api/vehicles/delete', requireAuth, async (req: AuthRequest, res: any) => {
    try {
      const { garageId: bodyGarageId, vehicleId, refundAmount, staffName } = req.body || {};
      const callerRole = req.user?.role;
      let garageId = '';

      if (callerRole === 'garage' || callerRole === 'staff') {
        if (!req.user?.garageId) {
          return res.status(403).json({ success: false, error: 'FORBIDDEN: Garage ID missing in session' });
        }
        if (bodyGarageId && bodyGarageId !== req.user.garageId) {
          return res.status(403).json({ success: false, error: 'GARAGE_SCOPE_MISMATCH' });
        }
        garageId = req.user.garageId;
      } else if (callerRole === 'admin') {
        garageId = bodyGarageId;
      } else {
        return res.status(403).json({ success: false, error: 'FORBIDDEN: Role not authorized for vehicle operations' });
      }

      const staffId = req.user?.uid;
      
      if (!garageId || !vehicleId) {
        return res.status(400).json({ success: false, error: 'MISSING_PARAMETERS' });
      }
      if (!adminDb) return res.status(500).json({ success: false, error: 'ADMIN_SDK_NOT_INITIALIZED' });

      const getCairoDateKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

      await adminDb.runTransaction(async (t: any) => {
        const todayYMD = getCairoDateKey();
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const vehicleRef = adminDb.doc(`garages/${garageId}/vehicles/${vehicleId}`);
        const dailyStatsRef = adminDb.doc(`garages/${garageId}/daily_stats/${todayYMD}`);

        const [garageDoc, vehicleDoc, dailyStatsDoc] = await Promise.all([
          t.get(garageRef),
          t.get(vehicleRef),
          t.get(dailyStatsRef)
        ]);

        if (!garageDoc.exists || !vehicleDoc.exists) throw new Error('NOT_FOUND');
        
        const garageData = garageDoc.data() || {};
        const vehicleData = vehicleDoc.data() || {};
        
        // Deletion limit logic
        const todayDeletions = garageData.lastDeletionDate === todayYMD ? (garageData.dailyDeletionCount || 0) : 0;
        if (todayDeletions >= 3) {
          throw new Error('reached_daily_deletion_limit');
        }

        const isSameRefundDay = garageData.lastRefundDate === todayYMD;
        const refundAmt = Math.max(0, Number(refundAmount || 0));

        let enteredToday = false;
        if (vehicleData.status === 'inside' && vehicleData.entryTime) {
          const entryTime = vehicleData.entryTime.toDate ? vehicleData.entryTime.toDate() : new Date(vehicleData.entryTime);
          if (!isNaN(entryTime.getTime())) {
            const entryDateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(entryTime);
            enteredToday = entryDateKey === todayYMD;
          }
        }

        t.delete(vehicleRef);

        const updates: any = {
          isLocked: false,
          dailyDeletionCount: todayDeletions + 1,
          lastDeletionDate: todayYMD,
          dailyRefundCount: isSameRefundDay ? ((garageData.dailyRefundCount || 0) + 1) : 1,
          lastRefundDate: todayYMD
        };

        if (refundAmt > 0) updates.balance = (garageData.balance || 0) + refundAmt;
        if (vehicleData.status === 'inside') updates.carsInside = Math.max(0, (garageData.carsInside || 0) - 1);
        if (enteredToday) updates.todayCount = Math.max(0, (garageData.todayCount || 0) - 1);

        t.set(garageRef, updates, { merge: true });

        if (enteredToday && dailyStatsDoc.exists) {
          const prevCount = dailyStatsDoc.data()?.count || 0;
          if (prevCount > 0) t.set(dailyStatsRef, { count: prevCount - 1 }, { merge: true });
        }

        const logRef = adminDb.collection('activity_logs').doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || '',
          staffId: staffId || vehicleData.staffId || null,
          staffName: staffName || vehicleData.staffName || 'مدير الجراج',
          actionType: 'delete_refund',
          plateNumber: `مسح لوحة: ${vehicleData.plateNumber || vehicleId}`,
          timestamp: new Date(),
          amount: refundAmt
        });
      });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('[Server] Delete error:', err);
      return res.status(500).json({ success: false, error: err.message || 'DELETE_FAILED' });
    }
  });

  // Vite development middleware vs Static Production serving
  
  // API 404 handler
  app.use('/api', (req: express.Request, res: express.Response) => {
    res.status(404).json({ success: false, error: 'API route not found' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  
  // Global error handler to prevent HTML stack traces
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Express Global Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'INTERNAL_SERVER_ERROR' });
  });

  if (process.env.VERCEL) {
    console.log('[ARK Express Server] Exported for Vercel Serverless');
  } else {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[ARK Express Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
  
  return app;
}

const appPromise = startServer();
export default appPromise;


