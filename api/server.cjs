var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
__export(server_exports, {
  default: () => server_default
});
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
var import_auth = require("firebase-admin/auth");
var import_app2 = require("firebase/app");
var import_firestore2 = require("firebase/firestore");
var import_auth2 = require("firebase/auth");

// firebase-applet-config.json
var firebase_applet_config_default = {
  projectId: "gen-lang-client-0091669619",
  appId: "1:841039846471:web:2499d21dd43c7af2652562",
  apiKey: "AIzaSyAlX0k1nFD1E53_Y8EVJCyEByD1pz92XdE",
  authDomain: "gen-lang-client-0091669619.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-b470b79a-6ebe-4e99-9d28-d7bc08d72759",
  storageBucket: "gen-lang-client-0091669619.firebasestorage.app",
  messagingSenderId: "841039846471",
  measurementId: ""
};

// server.ts
var import_vite = require("vite");
function normalizeDigits(str) {
  if (!str) return "";
  return String(str).replace(/[٠۰]/g, "0").replace(/[١۱]/g, "1").replace(/[٢۲]/g, "2").replace(/[٣۳]/g, "3").replace(/[٤۴]/g, "4").replace(/[٥۵]/g, "5").replace(/[٦۶]/g, "6").replace(/[٧۷]/g, "7").replace(/[٨۸]/g, "8").replace(/[٩۹]/g, "9");
}
function cleanPin(raw) {
  return normalizeDigits(String(raw || "")).replace(/\D/g, "");
}
var LEGACY_PIN_SALT = "ark_garage_secure_pin_salt_2026";
var PIN_LOOKUP_SALT = "ark_garage_secure_pin_lookup_salt_v2";
function hashPinWithUniqueSalt(cleanPinStr, saltHex) {
  if (!cleanPinStr) return "";
  const salt = saltHex ? Buffer.from(saltHex, "hex") : import_crypto.default.randomBytes(16);
  const actualSaltHex = salt.toString("hex");
  const N = 16384;
  const r = 8;
  const p = 1;
  const derived = import_crypto.default.scryptSync(cleanPinStr, salt, 32, { N, r, p }).toString("hex");
  return `$scrypt$N=${N},r=${r},p=${p}$${actualSaltHex}$${derived}`;
}
function computeLookupHash(cleanPinStr) {
  if (!cleanPinStr) return "";
  return import_crypto.default.scryptSync(cleanPinStr, PIN_LOOKUP_SALT, 32).toString("hex");
}
function legacyHashPin(cleanPinStr) {
  if (!cleanPinStr) return "";
  return import_crypto.default.scryptSync(cleanPinStr, LEGACY_PIN_SALT, 32).toString("hex");
}
function isHashedPin(pin) {
  if (!pin) return false;
  return typeof pin === "string" && pin.length === 64 && /^[0-9a-f]{64}$/i.test(pin);
}
function verifyScryptHash(inputCleanPin, scryptStr) {
  try {
    const parts = scryptStr.split("$");
    if (parts.length >= 5 && parts[1] === "scrypt") {
      const paramStr = parts[2];
      const saltHex = parts[3];
      const expectedHash = parts[4];
      const params = {};
      paramStr.split(",").forEach((p2) => {
        const [k, v] = p2.split("=");
        if (k && v) params[k] = parseInt(v, 10);
      });
      const N = params.N || 16384;
      const r = params.r || 8;
      const p = params.p || 1;
      const salt = Buffer.from(saltHex, "hex");
      const derived = import_crypto.default.scryptSync(inputCleanPin, salt, 32, { N, r, p }).toString("hex");
      return derived.toLowerCase() === expectedHash.toLowerCase();
    }
  } catch (e) {
    console.error("[Server Auth] Error verifying scrypt hash:", e);
  }
  return false;
}
function verifySingleFieldValue(inputCleanPin, storedVal) {
  if (!inputCleanPin || storedVal === void 0 || storedVal === null) return { matches: false, isLegacy: false };
  const strVal = String(storedVal).trim();
  if (!strVal) return { matches: false, isLegacy: false };
  if (strVal.startsWith("$scrypt$")) {
    if (verifyScryptHash(inputCleanPin, strVal)) {
      return { matches: true, isLegacy: false };
    }
  }
  if (isHashedPin(strVal)) {
    const inputLegacyHash = legacyHashPin(inputCleanPin);
    if (inputLegacyHash.toLowerCase() === strVal.toLowerCase()) {
      return { matches: true, isLegacy: true };
    }
  }
  const cleanStored = cleanPin(strVal);
  if (cleanStored && cleanStored === inputCleanPin) {
    return { matches: true, isLegacy: true };
  }
  return { matches: false, isLegacy: false };
}
function verifyPinMatch(inputCleanPin, storedPin) {
  return verifySingleFieldValue(inputCleanPin, storedPin);
}
function verifyDocMatch(inputCleanPin, docData) {
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
async function migratePinToHash(collName, docId, cleanInputPin) {
  const newScrypt = hashPinWithUniqueSalt(cleanInputPin);
  const lookupHash = computeLookupHash(cleanInputPin);
  const updatePayload = {
    pin: newScrypt,
    pinLookupHash: lookupHash
  };
  try {
    if (collName === "admin_settings") {
      if (adminDb) {
        await adminDb.doc("admin_settings/auth_pin").set(updatePayload, { merge: true });
      } else {
        await ensureAuth();
        const docRef = (0, import_firestore2.doc)(db, "admin_settings", "auth_pin");
        await (0, import_firestore2.setDoc)(docRef, updatePayload, { merge: true });
      }
    } else if (adminDb) {
      await adminDb.collection(collName).doc(docId).update(updatePayload);
    } else {
      await ensureAuth();
      const docRef = (0, import_firestore2.doc)(db, collName, docId);
      await (0, import_firestore2.setDoc)(docRef, updatePayload, { merge: true });
    }
    console.log(`[Server Auth] Auto-migrated legacy PIN to unique-salt $scrypt$ hash for ${collName}/${docId}`);
  } catch (e) {
    console.error(`[Server Auth] Error auto-migrating PIN for ${collName}/${docId}:`, e);
  }
}
var failedAttemptsByIp = /* @__PURE__ */ new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const entry = failedAttemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    failedAttemptsByIp.set(ip, { count: 1, resetAt: now + 6e4 });
    return true;
  }
  if (entry.count >= 20) {
    return false;
  }
  entry.count += 1;
  return true;
}
function resetRateLimit(ip) {
  failedAttemptsByIp.delete(ip);
}
var adminDb = null;
var adminAuth = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const existingApps = (0, import_app.getApps)();
    const adminApp = existingApps.find((a) => a.name === "admin-app") || (0, import_app.initializeApp)({
      credential: (0, import_app.cert)(sa),
      projectId: firebase_applet_config_default.projectId
    }, "admin-app");
    adminDb = (0, import_firestore.getFirestore)(adminApp, firebase_applet_config_default.firestoreDatabaseId);
    adminAuth = (0, import_auth.getAuth)(adminApp);
    console.log("[Server Auth] Initialized Firebase Admin SDK with service account credentials");
  }
} catch (e) {
  console.warn("[Server Auth] Could not initialize Firebase Admin SDK:", e);
}
var firebaseApp = (0, import_app2.initializeApp)(firebase_applet_config_default, "server-app");
var db = (0, import_firestore2.initializeFirestore)(firebaseApp, {
  experimentalAutoDetectLongPolling: true,
  localCache: (0, import_firestore2.memoryLocalCache)()
}, firebase_applet_config_default.firestoreDatabaseId);
var serverAuth = (0, import_auth2.getAuth)(firebaseApp);
async function ensureAuth() {
  try {
    if (!serverAuth.currentUser) {
      await (0, import_auth2.signInAnonymously)(serverAuth);
    }
  } catch (e) {
    console.error("[Server Auth] Anonymous auth error:", e);
  }
}
async function getAdminPin() {
  try {
    if (adminDb) {
      const snap = await adminDb.doc("admin_settings/auth_pin").get();
      return snap.exists ? String(snap.data()?.pin || "") : "";
    }
    await ensureAuth();
    const adminDoc = await (0, import_firestore2.getDoc)((0, import_firestore2.doc)(db, "admin_settings", "auth_pin"));
    return adminDoc.exists() ? String(adminDoc.data()?.pin || "") : "";
  } catch (e) {
    console.error("[Server Auth] Error reading admin pin:", e);
    return "";
  }
}
async function queryAccountWherePin(collName, normPin) {
  const lookupHash = computeLookupHash(normPin);
  const legacyHash = legacyHashPin(normPin);
  const matches = [];
  const seenIds = /* @__PURE__ */ new Set();
  const candidateQueries = [
    { field: "pinLookupHash", value: lookupHash },
    { field: "pin", value: legacyHash },
    { field: "pin", value: normPin }
  ];
  if (collName === "garages") {
    candidateQueries.push(
      { field: "ownerPin", value: normPin },
      { field: "adminPin", value: normPin }
    );
  }
  try {
    if (adminDb) {
      for (const { field, value } of candidateQueries) {
        if (!value) continue;
        try {
          const snap = await adminDb.collection(collName).where(field, "==", value).limit(5).get();
          for (const d of snap.docs) {
            if (!seenIds.has(d.id)) {
              const check = verifyDocMatch(normPin, d.data());
              if (check.matches) {
                seenIds.add(d.id);
                matches.push({ id: d.id, data: d.data(), isLegacyMatch: check.isLegacy });
              }
            }
          }
        } catch (e) {
        }
      }
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
        } catch (e) {
        }
      }
    } else {
      await ensureAuth();
      for (const { field, value } of candidateQueries) {
        if (!value) continue;
        try {
          const q = (0, import_firestore2.query)((0, import_firestore2.collection)(db, collName), (0, import_firestore2.where)(field, "==", value), (0, import_firestore2.limit)(5));
          const snap = await (0, import_firestore2.getDocs)(q);
          for (const d of snap.docs) {
            if (!seenIds.has(d.id)) {
              const check = verifyDocMatch(normPin, d.data());
              if (check.matches) {
                seenIds.add(d.id);
                matches.push({ id: d.id, data: d.data(), isLegacyMatch: check.isLegacy });
              }
            }
          }
        } catch (e) {
        }
      }
      if (matches.length === 0) {
        try {
          const fallbackQ = (0, import_firestore2.query)((0, import_firestore2.collection)(db, collName), (0, import_firestore2.limit)(50));
          const fallbackSnap = await (0, import_firestore2.getDocs)(fallbackQ);
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
async function queryDelegatesWherePhone(normPhone) {
  try {
    if (adminDb) {
      const snap = await adminDb.collection("delegates").where("phone", "==", normPhone).limit(5).get();
      return snap.docs.map((d) => ({ id: d.id, data: d.data() }));
    }
    await ensureAuth();
    const qPhone = (0, import_firestore2.query)((0, import_firestore2.collection)(db, "delegates"), (0, import_firestore2.where)("phone", "==", normPhone), (0, import_firestore2.limit)(5));
    const snapPhone = await (0, import_firestore2.getDocs)(qPhone);
    return snapPhone.docs.map((d) => ({ id: d.id, data: d.data() }));
  } catch (e) {
    console.error("[Server Auth] Error querying delegates where phone:", e);
    return [];
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  const requireAuth = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      let token = "";
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split("Bearer ")[1];
      } else if (req.body && req.body.firebaseIdToken) {
        token = req.body.firebaseIdToken;
      }
      if (!token) {
        return res.status(401).json({ success: false, error: "UNAUTHORIZED: Missing Firebase ID Token" });
      }
      if (!adminAuth || !adminDb) {
        return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      }
      const decoded = await adminAuth.verifyIdToken(token);
      const uid = decoded.uid;
      let foundRole = "";
      let assignedGarageId = "";
      const secCollMap = [
        { role: "admin", coll: "admin_sessions" },
        { role: "supervisor", coll: "supervisor_sessions" },
        { role: "delegate", coll: "delegate_sessions" },
        { role: "garage", coll: "garage_sessions" },
        { role: "staff", coll: "staff_sessions" }
      ];
      for (const { role, coll } of secCollMap) {
        const secSnap = await adminDb.doc(`${coll}/${uid}`).get();
        if (secSnap.exists) {
          const secData = secSnap.data() || {};
          if (secData.isActive) {
            foundRole = role;
            if (role === "garage") {
              assignedGarageId = secData.garageId || secData.entityId || "";
            } else if (role === "staff") {
              assignedGarageId = secData.garageId || "";
              if (!assignedGarageId && secData.entityId) {
                const staffSnap = await adminDb.doc(`staff/${secData.entityId}`).get();
                if (staffSnap.exists) {
                  assignedGarageId = staffSnap.data()?.garageId || "";
                }
              }
            }
            break;
          }
        }
      }
      if (!foundRole) {
        return res.status(403).json({ success: false, error: "FORBIDDEN: No active session found" });
      }
      req.user = { uid, role: foundRole, garageId: assignedGarageId };
      next();
    } catch (e) {
      console.warn("[Server Auth] Middleware validation failed:", e);
      return res.status(401).json({ success: false, error: "UNAUTHORIZED: Invalid token or session" });
    }
  };
  app.get("/api/health", (_req, res) => {
    const ready = Boolean(adminAuth && adminDb);
    res.status(ready ? 200 : 503).json({
      status: ready ? "ok" : "not_ready",
      adminSdk: ready,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.post("/api/auth/verify-pin", async (req, res) => {
    try {
      const clientIp = req.ip || req.headers["x-forwarded-for"]?.toString() || "unknown";
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
          success: false,
          error: "\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627\u060C \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u0645\u062F\u0629 \u062F\u0642\u064A\u0642\u0629 \u0648\u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B"
        });
      }
      const credentials = req.body || {};
      const rawInput = credentials.pin || credentials.input;
      let verifiedUid = "";
      if (credentials.firebaseIdToken) {
        if (adminAuth) {
          try {
            const decoded = await adminAuth.verifyIdToken(credentials.firebaseIdToken);
            verifiedUid = decoded.uid;
          } catch (tokenErr) {
            console.warn("[Server Auth] Invalid Firebase ID token:", tokenErr);
            return res.status(401).json({ success: false, error: "INVALID_ID_TOKEN" });
          }
        }
      }
      if (verifiedUid && credentials.uid && credentials.uid.trim() !== verifiedUid) {
        return res.status(401).json({ success: false, error: "UID_MISMATCH" });
      }
      const effectiveUid = verifiedUid || (typeof credentials.uid === "string" ? credentials.uid.trim() : "");
      const sessionId = typeof credentials.sessionId === "string" ? credentials.sessionId.trim() : "";
      if (rawInput) {
        const normInputPin = cleanPin(rawInput);
        if (!normInputPin) {
          return res.json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
        }
        const matches = [];
        let adminPinStored = await getAdminPin();
        const adminCheck = verifyPinMatch(normInputPin, adminPinStored);
        if (adminCheck.matches) {
          matches.push({ role: "admin", id: "admin", isLegacyMatch: adminCheck.isLegacy });
          if (adminCheck.isLegacy) {
            migratePinToHash("admin_settings", "auth_pin", normInputPin);
          }
        }
        const collectionsToCheck = [
          { name: "garages", role: "garage" },
          { name: "staff", role: "staff" },
          { name: "delegates", role: "delegate" },
          { name: "supervisors", role: "supervisor" }
        ];
        for (const coll of collectionsToCheck) {
          try {
            const docs = await queryAccountWherePin(coll.name, normInputPin);
            for (const docSnap of docs) {
              const data = { ...docSnap.data };
              if (docSnap.isLegacyMatch) {
                migratePinToHash(coll.name, docSnap.id, normInputPin);
              }
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
          return res.json({ success: false, error: "PIN_NOT_UNIQUE" });
        }
        if (matches.length === 1) {
          const match = matches[0];
          if (effectiveUid && sessionId && adminDb) {
            try {
              const entityCollMap = {
                admin: "admin_settings",
                supervisor: "supervisors",
                delegate: "delegates",
                garage: "garages",
                staff: "staff"
              };
              const secCollMap = {
                admin: "admin_sessions",
                supervisor: "supervisor_sessions",
                delegate: "delegate_sessions",
                garage: "garage_sessions",
                staff: "staff_sessions"
              };
              const entityColl = entityCollMap[match.role];
              const secColl = secCollMap[match.role];
              const entityDocId = match.role === "admin" ? "auth_pin" : match.id;
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
                    const SESSION_TIMEOUT_MS = 15 * 60 * 1e3;
                    const isAlive = activeSessionId && activeSessionId !== sessionId && lastActive > 0 && Date.now() - lastActive < SESSION_TIMEOUT_MS;
                    if (isAlive) {
                      throw new Error("SESSION_OCCUPIED");
                    }
                  }
                  transaction.set(entityDocRef, {
                    currentSessionId: sessionId,
                    lastActive: /* @__PURE__ */ new Date()
                  }, { merge: true });
                  const resolvedGarageId = match.role === "staff" ? snap.data()?.garageId || "" : match.role === "garage" ? entityDocId : "";
                  transaction.set(secDocRef, {
                    uid: effectiveUid,
                    role: match.role,
                    entityId: entityDocId,
                    garageId: resolvedGarageId,
                    sessionId,
                    isActive: true,
                    lastActive: /* @__PURE__ */ new Date(),
                    createdAt: /* @__PURE__ */ new Date()
                  }, { merge: true });
                });
                console.log(`[Server Auth] Successfully provisioned atomic ${match.role} session for UID: ${effectiveUid}`);
              }
            } catch (claimErr) {
              if (claimErr?.message === "SESSION_OCCUPIED") {
                return res.json({ success: false, error: "SESSION_OCCUPIED" });
              }
              console.error(`[Server Auth] Failed to provision ${match.role} session:`, claimErr);
              return res.status(500).json({ success: false, error: "\u062A\u0639\u0630\u0631 \u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0622\u0645\u0646\u0629\u060C \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629" });
            }
          }
          resetRateLimit(clientIp);
          return res.json({
            success: true,
            role: match.role,
            accountId: match.id,
            account: match.account,
            sessionClaimed: true
          });
        }
        return res.json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      const normPin = cleanPin(credentials.pin);
      const normPhone = cleanPin(credentials.phone);
      if (!normPin || !normPhone) {
        return res.json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
      }
      try {
        const delegateDocs = await queryDelegatesWherePhone(normPhone);
        for (const dDoc of delegateDocs) {
          const d = { ...dDoc.data };
          const { matches, isLegacy } = verifyDocMatch(normPin, d);
          if (matches) {
            if (isLegacy) {
              migratePinToHash("delegates", dDoc.id, normPin);
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
                  const SESSION_TIMEOUT_MS = 15 * 60 * 1e3;
                  const isAlive = activeSessionId && activeSessionId !== sessionId && lastActive > 0 && Date.now() - lastActive < SESSION_TIMEOUT_MS;
                  if (isAlive) {
                    return res.json({ success: false, error: "SESSION_OCCUPIED" });
                  }
                }
                await entityDocRef.set({
                  currentSessionId: sessionId,
                  lastActive: /* @__PURE__ */ new Date()
                }, { merge: true });
                await adminDb.doc(`delegate_sessions/${effectiveUid}`).set({
                  uid: effectiveUid,
                  role: "delegate",
                  entityId: dDoc.id,
                  sessionId,
                  isActive: true,
                  lastActive: /* @__PURE__ */ new Date(),
                  createdAt: /* @__PURE__ */ new Date()
                }, { merge: true });
              } catch (sessErr) {
                console.error("[Server Auth] Error claiming delegate session during phone verification:", sessErr);
                return res.status(500).json({ success: false, error: "\u062A\u0639\u0630\u0631 \u062A\u0647\u064A\u0626\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u0622\u0645\u0646\u0629\u060C \u064A\u0631\u062C\u0649 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629" });
              }
            }
            resetRateLimit(clientIp);
            return res.json({
              success: true,
              role: "delegate",
              accountId: dDoc.id,
              account: { id: dDoc.id, ...d },
              sessionClaimed: true
            });
          }
        }
      } catch (e) {
        console.error("[Server Auth] Error searching delegates by phone:", e);
      }
      return res.json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629" });
    } catch (error) {
      console.error("[Server Auth] Unexpected error in verify-pin:", error);
      return res.status(500).json({ success: false, error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app.post("/api/auth/check-pin-availability", async (req, res) => {
    try {
      const { pin, excludeId } = req.body || {};
      const normPin = cleanPin(pin);
      if (!normPin) {
        return res.json({ taken: false });
      }
      let adminPinStored = await getAdminPin();
      if (adminPinStored && verifyPinMatch(normPin, adminPinStored).matches) {
        return res.json({ taken: true, role: "\u0645\u0633\u0624\u0648\u0644 \u0627\u0644\u0646\u0638\u0627\u0645 (\u0627\u0644\u0622\u062F\u0645\u0646 \u0627\u0644\u0631\u0626\u064A\u0633\u064A)", name: "\u0627\u0644\u0622\u062F\u0645\u0646" });
      }
      const collectionsToCheck = [
        { name: "supervisors", label: "\u0645\u0634\u0631\u0641 \u0646\u0638\u0627\u0645" },
        { name: "delegates", label: "\u0645\u0646\u062F\u0648\u0628 \u0634\u062D\u0646" },
        { name: "staff", label: "\u0645\u0648\u0638\u0641 \u062C\u0631\u0627\u062C" },
        { name: "garages", label: "\u0635\u0627\u062D\u0628 \u062C\u0631\u0627\u062C" }
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
              name: docData.name || docData.ownerName || docData.garageName || "\u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631"
            });
          }
        } catch (e) {
        }
      }
      return res.json({ taken: false });
    } catch (error) {
      console.error("[Server Auth] Error in check-pin-availability:", error);
      return res.status(500).json({ taken: false });
    }
  });
  app.post("/api/auth/verify-admin-pin", async (req, res) => {
    try {
      const { pin } = req.body || {};
      const normInput = cleanPin(pin);
      if (!normInput) {
        return res.json({ valid: false });
      }
      let activeAdminPin = await getAdminPin();
      const { matches, isLegacy } = verifyPinMatch(normInput, activeAdminPin);
      if (matches && isLegacy) {
        migratePinToHash("admin_settings", "auth_pin", normInput);
      }
      return res.json({ valid: matches });
    } catch (error) {
      return res.status(500).json({ valid: false });
    }
  });
  app.post("/api/auth/claim-admin-session", async (req, res) => {
    try {
      const { uid, sessionId, pin, firebaseIdToken } = req.body || {};
      if (!uid || !sessionId || typeof uid !== "string" || typeof sessionId !== "string") {
        return res.status(400).json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629" });
      }
      if (!adminDb) {
        return res.status(500).json({ success: false, error: "Admin DB \u063A\u064A\u0631 \u0645\u0647\u064A\u0623" });
      }
      const authorization = req.headers.authorization;
      const headerToken = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
      if (!headerToken || !adminAuth) {
        return res.status(401).json({ success: false, error: "AUTHORIZATION_REQUIRED" });
      }
      let verifiedUid = "";
      if (adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(headerToken);
          verifiedUid = decoded.uid;
        } catch (tokenErr) {
          console.warn("[Server Auth] Invalid Firebase ID token during claim-admin-session:", tokenErr);
          return res.status(401).json({ success: false, error: "INVALID_ID_TOKEN" });
        }
      }
      if (!verifiedUid || uid.trim() !== verifiedUid) {
        return res.status(401).json({ success: false, error: "UID_MISMATCH" });
      }
      const effectiveUid = verifiedUid;
      let isAuthorized = false;
      const cleanInputPin = pin ? cleanPin(pin) : "";
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
        return res.status(403).json({ success: false, error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D: \u064A\u062A\u0637\u0644\u0628 \u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0633\u0631\u064A" });
      }
      await adminDb.runTransaction(async (transaction) => {
        const entityDocRef = adminDb.doc("admin_settings/auth_pin");
        const secDocRef = adminDb.doc(`admin_sessions/${effectiveUid}`);
        const snap = await transaction.get(entityDocRef);
        if (snap.exists) {
          const data = snap.data() || {};
          const activeSessionId = data.currentSessionId;
          const rawLastActive = data.lastActive;
          const lastActive = rawLastActive ? new Date(rawLastActive.toDate ? rawLastActive.toDate() : rawLastActive).getTime() : 0;
          const SESSION_TIMEOUT_MS = 15 * 60 * 1e3;
          const isAlive = activeSessionId && activeSessionId !== sessionId && lastActive > 0 && Date.now() - lastActive < SESSION_TIMEOUT_MS;
          if (isAlive) {
            throw new Error("SESSION_OCCUPIED");
          }
        }
        transaction.set(entityDocRef, {
          currentSessionId: sessionId,
          lastActive: /* @__PURE__ */ new Date()
        }, { merge: true });
        transaction.set(secDocRef, {
          uid: effectiveUid,
          role: "admin",
          entityId: "auth_pin",
          sessionId,
          isActive: true,
          lastActive: /* @__PURE__ */ new Date(),
          createdAt: /* @__PURE__ */ new Date()
        }, { merge: true });
      });
      return res.json({ success: true, sessionClaimed: true });
    } catch (e) {
      if (e?.message === "SESSION_OCCUPIED") {
        return res.json({ success: false, error: "SESSION_OCCUPIED" });
      }
      console.error("[Server Auth] Error in claim-admin-session:", e);
      return res.status(500).json({ success: false, error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645" });
    }
  });
  app.post("/api/auth/validate-or-refresh-session", async (req, res) => {
    try {
      const { uid, sessionId, role, entityId, firebaseIdToken } = req.body || {};
      if (!uid || !sessionId || !role) {
        return res.status(400).json({ valid: false, error: "INVALID_PARAMS" });
      }
      if (!adminDb) {
        return res.status(503).json({ valid: false, error: "DATABASE_UNAVAILABLE" });
      }
      let verifiedUid = "";
      if (firebaseIdToken && adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
          verifiedUid = decoded.uid;
        } catch (tokenErr) {
          return res.status(401).json({ valid: false, error: "INVALID_ID_TOKEN" });
        }
      }
      if (verifiedUid && typeof uid === "string" && uid.trim() !== verifiedUid) {
        return res.status(401).json({ valid: false, error: "UID_MISMATCH" });
      }
      const effectiveUid = verifiedUid || (typeof uid === "string" ? uid.trim() : "");
      const secCollMap = {
        admin: "admin_sessions",
        supervisor: "supervisor_sessions",
        delegate: "delegate_sessions",
        garage: "garage_sessions",
        staff: "staff_sessions"
      };
      const entityCollMap = {
        admin: "admin_settings",
        supervisor: "supervisors",
        delegate: "delegates",
        garage: "garages",
        staff: "staff"
      };
      const secColl = secCollMap[role];
      const entityColl = entityCollMap[role];
      if (!secColl || !entityColl) {
        return res.json({ valid: false, error: "INVALID_ROLE" });
      }
      const secSnap = await adminDb.doc(`${secColl}/${effectiveUid}`).get();
      if (!secSnap.exists) {
        return res.json({ valid: false, error: "SESSION_NOT_FOUND" });
      }
      const secData = secSnap.data() || {};
      if (!secData.isActive || secData.sessionId !== sessionId) {
        return res.json({ valid: false, error: "SESSION_INVALID" });
      }
      const rawLastActive = secData.lastActive;
      const lastActive = rawLastActive ? new Date(rawLastActive.toDate ? rawLastActive.toDate() : rawLastActive).getTime() : 0;
      const SESSION_TIMEOUT_MS = 15 * 60 * 1e3;
      if (lastActive > 0 && Date.now() - lastActive > SESSION_TIMEOUT_MS) {
        await adminDb.doc(`${secColl}/${effectiveUid}`).update({ isActive: false }).catch(() => {
        });
        return res.json({ valid: false, error: "SESSION_EXPIRED" });
      }
      const targetEntityId = role === "admin" ? "auth_pin" : entityId;
      if (targetEntityId) {
        const entitySnap = await adminDb.doc(`${entityColl}/${targetEntityId}`).get();
        if (entitySnap.exists) {
          const entityData = entitySnap.data() || {};
          if (entityData.currentSessionId && entityData.currentSessionId !== sessionId) {
            await adminDb.doc(`${secColl}/${effectiveUid}`).update({ isActive: false }).catch(() => {
            });
            return res.json({ valid: false, error: "SESSION_REVOKED" });
          }
        }
      }
      const now = /* @__PURE__ */ new Date();
      await adminDb.doc(`${secColl}/${effectiveUid}`).set({ lastActive: now }, { merge: true });
      if (targetEntityId) {
        await adminDb.doc(`${entityColl}/${targetEntityId}`).set({ lastActive: now }, { merge: true });
      }
      return res.json({ valid: true });
    } catch (error) {
      console.error("[Server Auth] Error validating session:", error);
      return res.status(500).json({ valid: false, error: "SERVER_ERROR" });
    }
  });
  app.post("/api/auth/release-session", async (req, res) => {
    try {
      const { uid, sessionId, role, entityId, firebaseIdToken } = req.body || {};
      if (!uid || !sessionId || !role) {
        return res.json({ success: true });
      }
      if (adminDb) {
        let verifiedUid = "";
        if (firebaseIdToken && adminAuth) {
          try {
            const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
            verifiedUid = decoded.uid;
          } catch (tokenErr) {
            console.warn("[Server Auth] Token verification warning during release-session:", tokenErr);
          }
        }
        const effectiveUid = verifiedUid || (typeof uid === "string" ? uid.trim() : "");
        const secCollMap = {
          admin: "admin_sessions",
          supervisor: "supervisor_sessions",
          delegate: "delegate_sessions",
          garage: "garage_sessions",
          staff: "staff_sessions"
        };
        const entityCollMap = {
          admin: "admin_settings",
          supervisor: "supervisors",
          delegate: "delegates",
          garage: "garages",
          staff: "staff"
        };
        const secColl = secCollMap[role];
        const entityColl = entityCollMap[role];
        const targetEntityId = role === "admin" ? "auth_pin" : entityId;
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
              lastActive: /* @__PURE__ */ new Date()
            });
          }
        }
      }
      return res.json({ success: true });
    } catch (e) {
      console.error("[Server Auth] Error in release-session:", e);
      return res.json({ success: false });
    }
  });
  app.post("/api/auth/release-admin-session", async (req, res) => {
    try {
      const { uid, sessionId } = req.body || {};
      if (!uid || !sessionId) {
        return res.json({ success: true });
      }
      if (adminDb) {
        const snap = await adminDb.doc("admin_settings/auth_pin").get();
        if (snap.exists && snap.data()?.currentSessionId === sessionId) {
          await adminDb.doc("admin_settings/auth_pin").update({
            currentSessionId: null
          });
        }
        const secSnap = await adminDb.doc(`admin_sessions/${uid}`).get();
        if (secSnap.exists && secSnap.data()?.sessionId === sessionId) {
          await adminDb.doc(`admin_sessions/${uid}`).update({
            isActive: false,
            lastActive: /* @__PURE__ */ new Date()
          });
        }
      }
      return res.json({ success: true });
    } catch (e) {
      console.error("[Server Auth] Error in release-admin-session:", e);
      return res.json({ success: false });
    }
  });
  app.post("/api/transactions/recharge-garage", requireAuth, async (req, res) => {
    if (req.user?.role === "garage") return res.status(403).json({ success: false, error: "GARAGE_CANNOT_RECHARGE_OTHERS" });
    try {
      const { garageId, packageId, adminDetails } = req.body || {};
      const callerUid = req.user?.uid;
      const callerRole = req.user?.role;
      if (!garageId) {
        return res.status(400).json({ success: false, error: "GARAGE_ID_REQUIRED" });
      }
      if (adminDb && callerUid) {
        const secCollMap = {
          admin: "admin_sessions",
          supervisor: "supervisor_sessions",
          delegate: "delegate_sessions",
          garage: "garage_sessions",
          staff: "staff_sessions"
        };
        const secColl = secCollMap[callerRole];
        if (secColl) {
          const secSnap = await adminDb.doc(`${secColl}/${callerUid}`).get();
          if (secSnap.exists) {
            const secData = secSnap.data() || {};
            if (!secData.isActive) {
              return res.status(403).json({ success: false, error: "SESSION_INACTIVE" });
            }
          }
        }
      }
      let packageObj = {};
      if (packageId) {
        const pkgSnap = await adminDb.doc(`packages/${packageId}`).get();
        if (pkgSnap.exists) packageObj = { id: pkgSnap.id, ...pkgSnap.data() };
      }
      if (!packageObj.id) return res.status(400).json({ success: false, error: "PACKAGE_NOT_FOUND" });
      const rawDays = Number(packageObj.durationDays || packageObj.vehiclesCount || 30);
      const durationDays = Math.max(1, Math.min(365, isNaN(rawDays) ? 30 : rawDays));
      const price = Math.max(0, Number(packageObj.price || packageObj.priceAmount || 0));
      const packageName = String(packageObj.name || packageObj.packageName || "\u0628\u0627\u0642\u0629 \u0627\u0644\u0627\u0634\u062A\u0631\u0627\u0643");
      const isUnlimited = Boolean(
        packageObj.isUnlimited || packageName.includes("\u0645\u0641\u062A\u0648\u062D") || packageName.includes("\u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F") || packageName.includes("\u0628\u062F\u0648\u0646 \u062D\u062F\u0648\u062F")
      );
      const effCapacity = isUnlimited ? 0 : Math.max(1, Number(packageObj.dailyCapacity || packageObj.carsCount || 40));
      let resultData = null;
      if (adminDb) {
        await adminDb.runTransaction(async (t) => {
          const garageRef = adminDb.doc(`garages/${garageId}`);
          const garageSnap = await t.get(garageRef);
          if (!garageSnap.exists) {
            throw new Error("GARAGE_NOT_FOUND");
          }
          const garageData = garageSnap.data() || {};
          if (garageData.hasMonthlySubscribers === true && durationDays < 15) {
            throw new Error("MONTHLY_SUBSCRIBERS_PACKAGE_RESTRICTION");
          }
          let baseDate = /* @__PURE__ */ new Date();
          const currentExpiry = garageData.balanceExpiry;
          if (currentExpiry) {
            const currentExpDate = new Date(currentExpiry.toDate ? currentExpiry.toDate() : currentExpiry);
            if (!isNaN(currentExpDate.getTime()) && currentExpDate.getTime() > baseDate.getTime()) {
              baseDate = currentExpDate;
            }
          }
          baseDate.setDate(baseDate.getDate() + durationDays);
          const referrerGarageId = garageData.referredByGarageId;
          let referrerRef = null;
          let referrerSnap = null;
          const isEligibleForReferral = Boolean(referrerGarageId) && referrerGarageId !== garageId && price > 0 && durationDays > 1;
          if (isEligibleForReferral && referrerGarageId) {
            referrerRef = adminDb.doc(`garages/${referrerGarageId}`);
            referrerSnap = await t.get(referrerRef);
          }
          const newRevenue = Number(((garageData.totalAdminRevenue || 0) + price).toFixed(2));
          const updateData = {
            totalAdminRevenue: newRevenue,
            isLocked: false,
            isTrial: false,
            dailyCapacity: effCapacity,
            activePackageName: packageName,
            packageName,
            lastRechargeDate: /* @__PURE__ */ new Date(),
            lastRechargeAmount: price,
            lastRechargePackageName: packageName,
            balanceExpiry: baseDate,
            billingModel: "subscription"
          };
          t.set(garageRef, updateData, { merge: true });
          const logRef = adminDb.collection("activity_logs").doc();
          const staffNameText = adminDetails && adminDetails.staffName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 (Admin)";
          t.set(logRef, {
            garageId,
            garageName: garageData.name || "",
            staffId: adminDetails && adminDetails.staffId || callerUid || "admin",
            staffName: staffNameText,
            actionType: "recharge",
            plateNumber: `\u062A\u062C\u062F\u064A\u062F \u0627\u0634\u062A\u0631\u0627\u0643: ${packageName} (${durationDays} \u064A\u0648\u0645) - ${price} \u062C`,
            timestamp: /* @__PURE__ */ new Date(),
            amount: price,
            packageId: packageId || packageObj.id || "direct_recharge",
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
          if (isEligibleForReferral && referrerRef && referrerSnap && referrerSnap.exists) {
            const referrerData = referrerSnap.data() || {};
            t.set(referrerRef, {
              totalReferralRewardDays: (referrerData.totalReferralRewardDays || 0) + 1,
              totalGaragesReferredCount: (referrerData.totalGaragesReferredCount || 0) + 1,
              lastReferralRewardAt: /* @__PURE__ */ new Date()
            }, { merge: true });
            const rewardLogRef = adminDb.collection("activity_logs").doc();
            t.set(rewardLogRef, {
              garageId: referrerGarageId,
              garageName: referrerData.name || "",
              staffId: null,
              staffName: "\u0627\u0644\u0646\u0638\u0627\u0645 \u2014 \u0645\u0643\u0627\u0641\u0623\u0629 \u0625\u062D\u0627\u0644\u0629",
              actionType: "recharge",
              plateNumber: `\u0645\u0643\u0627\u0641\u0623\u0629 \u0625\u062D\u0627\u0644\u0629 \u0645\u0646 ${garageData.name || ""} \u2014 \u0625\u0636\u0627\u0641\u0629 \u064A\u0648\u0645 \u0645\u062C\u0627\u0646\u064A \u0628\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u0643\u0627\u0641\u0622\u062A`,
              timestamp: /* @__PURE__ */ new Date(),
              amount: 0,
              packageId: referrerData.packageId || "referral_reward",
              details: {
                type: "referral_reward",
                referrerGarageId,
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
        return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      }
      return res.json({
        success: true,
        data: resultData
      });
    } catch (error) {
      console.error("[Server Transaction] Error in recharge-garage:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "TRANSACTION_FAILED"
      });
    }
  });
  app.post("/api/transactions/approve-recharge-request", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin" && req.user?.role !== "supervisor") return res.status(403).json({ success: false, error: "ADMIN_OR_SUPERVISOR_ONLY" });
    const callerUid = req.user?.uid;
    const callerRole = req.user?.role;
    try {
      const { requestId, request, firebaseIdToken, uid, role } = req.body || {};
      const reqId = requestId || request && request.id;
      if (!reqId) {
        return res.status(400).json({ success: false, error: "REQUEST_ID_REQUIRED" });
      }
      let verifiedUid = "";
      if (firebaseIdToken && adminAuth) {
        try {
          const decoded = await adminAuth.verifyIdToken(firebaseIdToken);
          verifiedUid = decoded.uid;
        } catch (tokenErr) {
          console.warn("[Server Transaction] Token verification failed:", tokenErr);
          return res.status(401).json({ success: false, error: "INVALID_ID_TOKEN" });
        }
      }
      const callerUid2 = verifiedUid || (typeof uid === "string" ? uid.trim() : "");
      const callerRole2 = role || "admin";
      if (adminDb && callerUid2) {
        const secCollMap = {
          admin: "admin_sessions",
          supervisor: "supervisor_sessions",
          delegate: "delegate_sessions",
          garage: "garage_sessions",
          staff: "staff_sessions"
        };
        const secColl = secCollMap[callerRole2];
        if (secColl) {
          const secSnap = await adminDb.doc(`${secColl}/${callerUid2}`).get();
          if (secSnap.exists) {
            const secData = secSnap.data() || {};
            if (!secData.isActive) {
              return res.status(403).json({ success: false, error: "SESSION_INACTIVE" });
            }
          }
        }
      }
      if (!adminDb) {
        return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      }
      let resultData = null;
      await adminDb.runTransaction(async (t) => {
        const requestRef = adminDb.doc(`recharge_requests/${reqId}`);
        const requestSnap = await t.get(requestRef);
        if (!requestSnap.exists) {
          throw new Error("REQUEST_NOT_FOUND");
        }
        const requestData = requestSnap.data() || {};
        if (requestData.status && requestData.status !== "pending") {
          throw new Error("REQUEST_ALREADY_PROCESSED");
        }
        const targetGarageId = requestData.garageId || request && request.garageId;
        if (!targetGarageId) {
          throw new Error("GARAGE_ID_MISSING");
        }
        const garageRef = adminDb.doc(`garages/${targetGarageId}`);
        const garageSnap = await t.get(garageRef);
        if (!garageSnap.exists) {
          throw new Error("GARAGE_NOT_FOUND");
        }
        const garageData = garageSnap.data() || {};
        const settingsSnap = await t.get(adminDb.doc("admin_settings/general"));
        const systemConfig = settingsSnap.exists ? settingsSnap.data() : {};
        const delegateCommissions = systemConfig?.delegatePackageCommissions || {
          daily: 5,
          weekly: 15,
          biweekly: 25,
          monthly: systemConfig?.referralFeePerRenewal !== void 0 ? Number(systemConfig.referralFeePerRenewal) : 50
        };
        const subscriberFlatFee = systemConfig?.subscriberFlatFee !== void 0 ? Math.max(0, Number(systemConfig.subscriberFlatFee)) : systemConfig?.monthlySubscribersFlatFee !== void 0 ? Number(systemConfig.monthlySubscribersFlatFee) : 500;
        const delegateReferrerId = garageData.referrerId || garageData.createdByDelegateId || null;
        const referredByDelegate = Boolean(delegateReferrerId);
        const isBalanceTopup = requestData.requestType === "balance_topup" || requestData.packageId === "balance_topup";
        if (isBalanceTopup) {
          const topupAmount = Number(requestData.amount || requestData.revenueAmount || 0);
          const currentBalance = Number(garageData.balance || 0);
          const newGarageBalance = currentBalance + topupAmount;
          const targetDelegateId = delegateReferrerId || requestData.delegateId || null;
          let delegateRef = null;
          let delegateSnap = null;
          if (targetDelegateId) {
            delegateRef = adminDb.doc(`delegates/${targetDelegateId}`);
            delegateSnap = await t.get(delegateRef);
          }
          t.set(garageRef, {
            balance: newGarageBalance,
            totalAdminRevenue: (garageData.totalAdminRevenue || 0) + topupAmount,
            lastRechargeDate: /* @__PURE__ */ new Date(),
            lastRechargeAmount: topupAmount,
            lastRechargePackageName: `\u0634\u062D\u0646 \u0631\u0635\u064A\u062F \u0645\u062D\u0641\u0638\u0629 (${topupAmount} \u062C.\u0645)`
          }, { merge: true });
          t.set(requestRef, {
            status: "approved",
            amount: topupAmount,
            revenueAmount: topupAmount,
            originalRevenueAmount: topupAmount,
            resolvedAt: /* @__PURE__ */ new Date()
          }, { merge: true });
          if (delegateRef && delegateSnap && delegateSnap.exists) {
            const delData = delegateSnap.data() || {};
            t.set(delegateRef, {
              totalRechargedAmount: (delData.totalRechargedAmount || 0) + topupAmount
            }, { merge: true });
          }
          const logRef = adminDb.collection("activity_logs").doc();
          t.set(logRef, {
            garageId: targetGarageId,
            garageName: requestData.garageName || garageData.name || "",
            staffId: delegateReferrerId || requestData.delegateId || null,
            staffName: requestData.delegateName || null,
            actionType: "balance_topup",
            plateNumber: `\u0634\u062D\u0646 \u0631\u0635\u064A\u062F \u0645\u062D\u0641\u0638\u0629 (${topupAmount} \u062C.\u0645)`,
            timestamp: /* @__PURE__ */ new Date(),
            amount: topupAmount,
            details: {
              action: "balance_topup",
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
            status: "approved",
            newBalance: newGarageBalance,
            revenue: topupAmount
          };
        } else {
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
          const targetDelegateId = delegateReferrerId || requestData.delegateId || null;
          let delegateRef = null;
          let delegateSnap = null;
          if (targetDelegateId) {
            delegateRef = adminDb.doc(`delegates/${targetDelegateId}`);
            delegateSnap = await t.get(delegateRef);
          }
          let baseDate = /* @__PURE__ */ new Date();
          const currentExpiry = garageData.balanceExpiry;
          if (currentExpiry) {
            const expDate = new Date(currentExpiry.toDate ? currentExpiry.toDate() : currentExpiry);
            if (!isNaN(expDate.getTime()) && expDate.getTime() > baseDate.getTime()) {
              baseDate = expDate;
            }
          }
          baseDate.setDate(baseDate.getDate() + durationDays);
          const pkgName = String(requestData.packageName || "");
          const isUnlimitedPkg = pkgName.includes("\u0645\u0641\u062A\u0648\u062D") || pkgName.includes("\u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F") || pkgName.includes("\u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u0629") || pkgName.includes("\u0628\u062F\u0648\u0646 \u062D\u062F\u0648\u062F") || pkgName.includes("\u0633\u0639\u0629 \u0645\u0641\u062A\u0648\u062D\u0629");
          const effCapacity = isUnlimitedPkg ? 0 : Math.max(1, Number(requestData.dailyCapacity || 40));
          t.set(garageRef, {
            balanceExpiry: baseDate,
            dailyCapacity: effCapacity,
            activePackageName: requestData.packageName || "\u0627\u0644\u0628\u0627\u0642\u0629",
            packageName: requestData.packageName || "\u0627\u0644\u0628\u0627\u0642\u0629",
            billingModel: "subscription",
            isLocked: false,
            isTrial: false,
            totalAdminRevenue: (garageData.totalAdminRevenue || 0) + effectiveRevenue,
            lastRechargeDate: /* @__PURE__ */ new Date(),
            lastRechargeAmount: effectiveRevenue,
            lastRechargePackageName: requestData.packageName || null
          }, { merge: true });
          t.set(requestRef, {
            status: "approved",
            commission,
            referrerId: delegateReferrerId,
            amount: effectiveRevenue,
            revenueAmount: effectiveRevenue,
            originalRevenueAmount: effectiveOriginalRevenue,
            resolvedAt: /* @__PURE__ */ new Date()
          }, { merge: true });
          if (delegateRef && delegateSnap && delegateSnap.exists) {
            const delData = delegateSnap.data() || {};
            t.set(delegateRef, {
              totalRechargedAmount: (delData.totalRechargedAmount || 0) + effectiveRevenue,
              totalCommissionEarned: (delData.totalCommissionEarned || 0) + commission
            }, { merge: true });
          }
          const logRef = adminDb.collection("activity_logs").doc();
          t.set(logRef, {
            garageId: targetGarageId,
            garageName: requestData.garageName || garageData.name || "",
            staffId: delegateReferrerId || requestData.delegateId || null,
            staffName: requestData.delegateName || null,
            actionType: "recharge",
            plateNumber: `\u0634\u062D\u0646 ${requestData.packageName || "\u0627\u0644\u0628\u0627\u0642\u0629"} (${durationDays} \u064A\u0648\u0645 - ${effCapacity === 0 ? "\u0645\u0641\u062A\u0648\u062D" : `${effCapacity} \u0633\u064A\u0627\u0631\u0629`})`,
            timestamp: /* @__PURE__ */ new Date(),
            amount: effectiveRevenue,
            packageId: requestData.packageId || null,
            details: {
              packageName: requestData.packageName,
              durationDays,
              carsCount: effCapacity,
              revenueAmount: effectiveRevenue,
              commission,
              requestId: reqId
            }
          });
          resultData = {
            requestId: reqId,
            status: "approved",
            newExpiry: baseDate.toISOString(),
            revenue: effectiveRevenue,
            commission
          };
        }
      });
      return res.json({ success: true, data: resultData });
    } catch (error) {
      console.error("[Server Transaction] Error in approve-recharge-request:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "TRANSACTION_FAILED"
      });
    }
  });
  app.post("/api/transactions/reject-recharge-request", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin" && req.user?.role !== "supervisor") return res.status(403).json({ success: false, error: "ADMIN_OR_SUPERVISOR_ONLY" });
    const callerUid = req.user?.uid;
    const callerRole = req.user?.role;
    try {
      const { requestId } = req.body || {};
      if (!requestId) {
        return res.status(400).json({ success: false, error: "REQUEST_ID_REQUIRED" });
      }
      if (!adminDb) {
        return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      }
      const requestRef = adminDb.doc(`recharge_requests/${requestId}`);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        return res.status(404).json({ success: false, error: "REQUEST_NOT_FOUND" });
      }
      const currentStatus = requestSnap.data()?.status;
      if (currentStatus && currentStatus !== "pending") {
        return res.status(400).json({ success: false, error: "REQUEST_ALREADY_PROCESSED" });
      }
      await requestRef.set({
        status: "rejected",
        resolvedAt: /* @__PURE__ */ new Date()
      }, { merge: true });
      return res.json({ success: true });
    } catch (error) {
      console.error("[Server Transaction] Error in reject-recharge-request:", error);
      return res.status(500).json({ success: false, error: error?.message || "REJECT_FAILED" });
    }
  });
  app.post("/api/transactions/admin-topup-balance", requireAuth, async (req, res) => {
    if (req.user?.role !== "admin") return res.status(403).json({ success: false, error: "ADMIN_ONLY" });
    try {
      const { garageId, amount, firebaseIdToken } = req.body || {};
      if (!garageId || !amount || Number(amount) <= 0) {
        return res.status(400).json({ success: false, error: "INVALID_PARAMETERS" });
      }
      if (!adminDb) {
        return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      }
      const numAmount = Math.round(Number(amount));
      let resultData = null;
      await adminDb.runTransaction(async (t) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const garageSnap = await t.get(garageRef);
        if (!garageSnap.exists) {
          throw new Error("GARAGE_NOT_FOUND");
        }
        const garageData = garageSnap.data() || {};
        const currentBalance = Number(garageData.balance || 0);
        const newBalance = currentBalance + numAmount;
        t.set(garageRef, {
          balance: newBalance,
          totalAdminRevenue: (garageData.totalAdminRevenue || 0) + numAmount,
          lastRechargeDate: /* @__PURE__ */ new Date(),
          lastRechargeAmount: numAmount,
          lastRechargePackageName: `\u0634\u062D\u0646 \u0631\u0635\u064A\u062F \u0645\u0628\u0627\u0634\u0631 (${numAmount} \u062C.\u0645)`
        }, { merge: true });
        const logRef = adminDb.collection("activity_logs").doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || "",
          staffId: "admin",
          staffName: "\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 (Admin)",
          actionType: "balance_topup",
          plateNumber: `\u0634\u062D\u0646 \u0631\u0635\u064A\u062F \u0645\u0628\u0627\u0634\u0631 (${numAmount} \u062C.\u0645)`,
          timestamp: /* @__PURE__ */ new Date(),
          amount: numAmount,
          details: {
            action: "admin_balance_topup",
            amount: numAmount,
            previousBalance: currentBalance,
            newBalance
          }
        });
        resultData = { garageId, newBalance, addedAmount: numAmount };
      });
      return res.json({ success: true, data: resultData });
    } catch (error) {
      console.error("[Server Transaction] Error in admin-topup-balance:", error);
      return res.status(500).json({ success: false, error: error?.message || "TRANSACTION_FAILED" });
    }
  });
  app.post("/api/transactions/garage-self-subscribe", requireAuth, async (req, res) => {
    const userRole = req.user?.role;
    const userGarageId = req.user?.garageId;
    try {
      const { garageId: bodyGarageId, packageId } = req.body || {};
      const garageId = userRole === "garage" ? userGarageId : bodyGarageId;
      if (userRole === "garage" && userGarageId !== bodyGarageId) return res.status(403).json({ success: false, error: "UNAUTHORIZED_GARAGE_ACCESS" });
      if (!garageId) {
        return res.status(400).json({ success: false, error: "GARAGE_ID_REQUIRED" });
      }
      if (!adminDb) {
        return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      }
      let resultData = null;
      await adminDb.runTransaction(async (t) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const garageSnap = await t.get(garageRef);
        if (!garageSnap.exists) {
          throw new Error("GARAGE_NOT_FOUND");
        }
        const garageData = garageSnap.data() || {};
        const currentBalance = Number(garageData.balance || 0);
        const settingsSnap = await t.get(adminDb.doc("system_config/global"));
        const systemConfig = settingsSnap.exists ? settingsSnap.data() : {};
        const subscriberFlatFee = systemConfig?.subscriberFlatFee !== void 0 ? Math.max(0, Number(systemConfig.subscriberFlatFee)) : systemConfig?.monthlySubscribersFlatFee !== void 0 ? Number(systemConfig.monthlySubscribersFlatFee) : 500;
        let pkg = null;
        if (packageId) {
          const pkgRef = adminDb.doc(`packages/${packageId}`);
          const pkgSnap = await t.get(pkgRef);
          if (pkgSnap.exists) {
            pkg = { id: pkgSnap.id, ...pkgSnap.data() };
          }
        }
        if (!pkg) {
          throw new Error("PACKAGE_NOT_FOUND");
        }
        const durationDays = Number(pkg.durationDays || pkg.vehiclesCount || 30);
        let basePrice = Number(pkg.price || 0);
        let discountAmount = 0;
        if (pkg.discountType === "percentage" && pkg.discountValue > 0) {
          discountAmount = Math.round(basePrice * Number(pkg.discountValue) / 100);
        } else if (pkg.discountType === "fixed" && pkg.discountValue > 0) {
          discountAmount = Math.min(basePrice, Number(pkg.discountValue));
        }
        let effectivePrice = Math.max(0, basePrice - discountAmount);
        if (garageData.hasMonthlySubscribers === true) {
          effectivePrice += subscriberFlatFee;
        }
        if (currentBalance < effectivePrice) {
          throw new Error(`INSUFFICIENT_BALANCE: \u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D (${currentBalance} \u062C.\u0645) \u063A\u064A\u0631 \u0643\u0627\u0641\u064D \u0644\u0644\u0627\u0634\u062A\u0631\u0627\u0643 \u0641\u064A \u0647\u0630\u0647 \u0627\u0644\u0628\u0627\u0642\u0629 (${effectivePrice} \u062C.\u0645)`);
        }
        const newBalance = currentBalance - effectivePrice;
        let baseDate = /* @__PURE__ */ new Date();
        const currentExpiry = garageData.balanceExpiry;
        if (currentExpiry) {
          const expDate = new Date(currentExpiry.toDate ? currentExpiry.toDate() : currentExpiry);
          if (!isNaN(expDate.getTime()) && expDate.getTime() > baseDate.getTime()) {
            baseDate = expDate;
          }
        }
        baseDate.setDate(baseDate.getDate() + durationDays);
        const pkgName = String(pkg.name || "\u0628\u0627\u0642\u0629 \u0627\u0634\u062A\u0631\u0627\u0643");
        const isUnlimitedPkg = pkgName.includes("\u0645\u0641\u062A\u0648\u062D") || pkgName.includes("\u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F") || pkgName.includes("\u063A\u064A\u0631 \u0645\u062D\u062F\u0648\u062F\u0629") || pkgName.includes("\u0628\u062F\u0648\u0646 \u062D\u062F\u0648\u062F") || pkgName.includes("\u0633\u0639\u0629 \u0645\u0641\u062A\u0648\u062D\u0629") || pkg.dailyCapacity === 0;
        const effCapacity = isUnlimitedPkg ? 0 : Math.max(1, Number(pkg.dailyCapacity || 40));
        t.set(garageRef, {
          balance: newBalance,
          balanceExpiry: baseDate,
          dailyCapacity: effCapacity,
          activePackageName: pkgName,
          packageName: pkgName,
          billingModel: "subscription",
          isLocked: false,
          isTrial: false,
          lastRechargeDate: /* @__PURE__ */ new Date(),
          lastRechargeAmount: effectivePrice,
          lastRechargePackageName: pkgName
        }, { merge: true });
        const logRef = adminDb.collection("activity_logs").doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || "",
          staffId: "owner",
          staffName: garageData.ownerName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u062C\u0631\u0627\u062C",
          actionType: "self_subscribe",
          plateNumber: `\u062A\u0641\u0639\u064A\u0644 \u0628\u0627\u0642\u0629 \u0628\u0627\u0644\u0631\u0635\u064A\u062F: ${pkgName} (${durationDays} \u064A\u0648\u0645)`,
          timestamp: /* @__PURE__ */ new Date(),
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
    } catch (error) {
      console.error("[Server Transaction] Error in garage-self-subscribe:", error);
      return res.status(500).json({ success: false, error: error?.message || "TRANSACTION_FAILED" });
    }
  });
  app.post("/api/vehicles/check-in", requireAuth, async (req, res) => {
    try {
      const { garageId: bodyGarageId, plateNumber, plateRaw, type, isSubscriber, staffName } = req.body || {};
      const callerRole = req.user?.role;
      let garageId = "";
      if (callerRole === "garage" || callerRole === "staff") {
        if (!req.user?.garageId) {
          return res.status(403).json({ success: false, error: "FORBIDDEN: Garage ID missing in session" });
        }
        if (bodyGarageId && bodyGarageId !== req.user.garageId) {
          return res.status(403).json({ success: false, error: "GARAGE_SCOPE_MISMATCH" });
        }
        garageId = req.user.garageId;
      } else if (callerRole === "admin") {
        garageId = bodyGarageId;
      } else {
        return res.status(403).json({ success: false, error: "FORBIDDEN: Role not authorized for vehicle operations" });
      }
      const staffId = req.user?.uid;
      if (!garageId || !plateNumber || !plateRaw) {
        return res.status(400).json({ success: false, error: "MISSING_PARAMETERS" });
      }
      if (!adminDb) return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      const getCairoDateKey = () => {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
      };
      await adminDb.runTransaction(async (t) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const vehicleRef = adminDb.doc(`garages/${garageId}/vehicles/${plateRaw}`);
        const today = getCairoDateKey();
        const dailyStatsRef = adminDb.doc(`garages/${garageId}/daily_stats/${today}`);
        const [garageSnap, vehicleSnap, dailyStatsSnap] = await Promise.all([
          t.get(garageRef),
          t.get(vehicleRef),
          t.get(dailyStatsRef)
        ]);
        if (!garageSnap.exists) throw new Error("GARAGE_NOT_FOUND");
        const garageData = garageSnap.data() || {};
        const expDateRaw = garageData.balanceExpiry;
        if (!expDateRaw) throw new Error("SUBSCRIPTION_EXPIRED");
        const expDate = expDateRaw.toDate ? expDateRaw.toDate() : new Date(expDateRaw);
        if (isNaN(expDate.getTime()) || expDate.getTime() < Date.now()) {
          throw new Error("SUBSCRIPTION_EXPIRED");
        }
        const capacity = Number(garageData.dailyCapacity || 0);
        const used = Number(garageData.todayCount || 0);
        const isUnlimited = capacity === 0 || String(garageData.activePackageName || "").includes("\u0645\u0641\u062A\u0648\u062D");
        if (!isUnlimited && used >= capacity) {
          throw new Error("CAPACITY_LIMIT_REACHED");
        }
        if (vehicleSnap.exists && vehicleSnap.data()?.status === "inside") {
          throw new Error("VEHICLE_ALREADY_INSIDE");
        }
        const isNewDay = garageData.lastTransactionDate !== today;
        t.set(vehicleRef, {
          id: plateRaw,
          plate: plateNumber,
          plateNumber,
          plateNumberRaw: plateRaw,
          type: type || "hourly",
          isSubscriber: !!isSubscriber,
          entryTime: /* @__PURE__ */ new Date(),
          status: "inside",
          staffId: staffId || null,
          staffName: staffName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u062C\u0631\u0627\u062C"
        }, { merge: true });
        t.set(garageRef, {
          carsInside: (garageData.carsInside || 0) + 1,
          todayCount: isNewDay ? 1 : used + 1,
          todayRevenue: isNewDay ? 0 : garageData.todayRevenue || 0,
          lastTransactionDate: today
        }, { merge: true });
        if (!dailyStatsSnap.exists) {
          t.set(dailyStatsRef, {
            dateId: today,
            count: 1,
            limit: isUnlimited ? 0 : capacity,
            revenue: 0,
            createdAt: /* @__PURE__ */ new Date()
          });
        } else {
          t.set(dailyStatsRef, { count: (dailyStatsSnap.data()?.count || 0) + 1 }, { merge: true });
        }
        const logRef = adminDb.collection("activity_logs").doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || "",
          staffId: staffId || null,
          staffName: staffName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u062C\u0631\u0627\u062C",
          actionType: "check_in",
          plateNumber,
          timestamp: /* @__PURE__ */ new Date(),
          amount: 0
        });
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("[Server] Check-in error:", err);
      return res.status(500).json({ success: false, error: err.message || "CHECK_IN_FAILED" });
    }
  });
  app.post("/api/vehicles/check-out", requireAuth, async (req, res) => {
    try {
      const { garageId: bodyGarageId, vehicleId, staffName } = req.body || {};
      const callerRole = req.user?.role;
      let garageId = "";
      if (callerRole === "garage" || callerRole === "staff") {
        if (!req.user?.garageId) {
          return res.status(403).json({ success: false, error: "FORBIDDEN: Garage ID missing in session" });
        }
        if (bodyGarageId && bodyGarageId !== req.user.garageId) {
          return res.status(403).json({ success: false, error: "GARAGE_SCOPE_MISMATCH" });
        }
        garageId = req.user.garageId;
      } else if (callerRole === "admin") {
        garageId = bodyGarageId;
      } else {
        return res.status(403).json({ success: false, error: "FORBIDDEN: Role not authorized for vehicle operations" });
      }
      const staffId = req.user?.uid;
      if (!garageId || !vehicleId) {
        return res.status(400).json({ success: false, error: "MISSING_PARAMETERS" });
      }
      if (!adminDb) return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      const getCairoDateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
      let finalCost = 0;
      await adminDb.runTransaction(async (t) => {
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const vehicleRef = adminDb.doc(`garages/${garageId}/vehicles/${vehicleId}`);
        const today = getCairoDateKey();
        const dailyStatsRef = adminDb.doc(`garages/${garageId}/daily_stats/${today}`);
        const [garageSnap, vehicleSnap, dailyStatsSnap] = await Promise.all([
          t.get(garageRef),
          t.get(vehicleRef),
          t.get(dailyStatsRef)
        ]);
        if (!garageSnap.exists) throw new Error("GARAGE_NOT_FOUND");
        if (!vehicleSnap.exists) throw new Error("VEHICLE_NOT_FOUND");
        const garageData = garageSnap.data() || {};
        const vehicleData = vehicleSnap.data() || {};
        if (vehicleData.status === "outside") {
          throw new Error("VEHICLE_ALREADY_OUTSIDE");
        }
        let cost = 0;
        if (!vehicleData.isSubscriber) {
          const entryTime = vehicleData.entryTime?.toDate ? vehicleData.entryTime.toDate() : new Date(vehicleData.entryTime);
          if (entryTime && !isNaN(entryTime.getTime())) {
            const diffMs = Date.now() - entryTime.getTime();
            let hours = Math.ceil(diffMs / (1e3 * 60 * 60));
            if (hours < 1) hours = 1;
            const rate = Number(garageData.hourlyRate || 0);
            cost = hours * rate;
          }
        }
        finalCost = cost;
        t.set(vehicleRef, {
          status: "outside",
          exitTime: /* @__PURE__ */ new Date(),
          totalCost: cost
        }, { merge: true });
        const isNewDay = garageData.lastTransactionDate !== today;
        t.set(garageRef, {
          totalRevenue: (garageData.totalRevenue || 0) + cost,
          totalVehiclesOut: (garageData.totalVehiclesOut || 0) + 1,
          todayRevenue: isNewDay ? cost : (garageData.todayRevenue || 0) + cost,
          todayCount: isNewDay ? 0 : garageData.todayCount || 0,
          lastTransactionDate: today,
          carsInside: Math.max(0, (garageData.carsInside || 0) - 1)
        }, { merge: true });
        if (!dailyStatsSnap.exists) {
          t.set(dailyStatsRef, {
            dateId: today,
            count: 0,
            revenue: cost,
            createdAt: /* @__PURE__ */ new Date()
          });
        } else {
          t.set(dailyStatsRef, { revenue: (dailyStatsSnap.data()?.revenue || 0) + cost }, { merge: true });
        }
        const logRef = adminDb.collection("activity_logs").doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || "",
          staffId: staffId || null,
          staffName: staffName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u062C\u0631\u0627\u062C",
          actionType: "check_out",
          plateNumber: vehicleData.plateNumber,
          plateNumberRaw: vehicleData.plateNumberRaw || vehicleId,
          entryTime: vehicleData.entryTime,
          type: vehicleData.type || "hourly",
          isSubscriber: !!vehicleData.isSubscriber,
          timestamp: /* @__PURE__ */ new Date(),
          amount: cost
        });
      });
      return res.json({ success: true, data: { cost: finalCost } });
    } catch (err) {
      console.error("[Server] Check-out error:", err);
      return res.status(500).json({ success: false, error: err.message || "CHECK_OUT_FAILED" });
    }
  });
  app.post("/api/vehicles/delete", requireAuth, async (req, res) => {
    try {
      const { garageId: bodyGarageId, vehicleId, refundAmount, staffName } = req.body || {};
      const callerRole = req.user?.role;
      let garageId = "";
      if (callerRole === "garage" || callerRole === "staff") {
        if (!req.user?.garageId) {
          return res.status(403).json({ success: false, error: "FORBIDDEN: Garage ID missing in session" });
        }
        if (bodyGarageId && bodyGarageId !== req.user.garageId) {
          return res.status(403).json({ success: false, error: "GARAGE_SCOPE_MISMATCH" });
        }
        garageId = req.user.garageId;
      } else if (callerRole === "admin") {
        garageId = bodyGarageId;
      } else {
        return res.status(403).json({ success: false, error: "FORBIDDEN: Role not authorized for vehicle operations" });
      }
      const staffId = req.user?.uid;
      if (!garageId || !vehicleId) {
        return res.status(400).json({ success: false, error: "MISSING_PARAMETERS" });
      }
      if (!adminDb) return res.status(500).json({ success: false, error: "ADMIN_SDK_NOT_INITIALIZED" });
      const getCairoDateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
      await adminDb.runTransaction(async (t) => {
        const todayYMD = getCairoDateKey();
        const garageRef = adminDb.doc(`garages/${garageId}`);
        const vehicleRef = adminDb.doc(`garages/${garageId}/vehicles/${vehicleId}`);
        const dailyStatsRef = adminDb.doc(`garages/${garageId}/daily_stats/${todayYMD}`);
        const [garageDoc, vehicleDoc, dailyStatsDoc] = await Promise.all([
          t.get(garageRef),
          t.get(vehicleRef),
          t.get(dailyStatsRef)
        ]);
        if (!garageDoc.exists || !vehicleDoc.exists) throw new Error("NOT_FOUND");
        const garageData = garageDoc.data() || {};
        const vehicleData = vehicleDoc.data() || {};
        const todayDeletions = garageData.lastDeletionDate === todayYMD ? garageData.dailyDeletionCount || 0 : 0;
        if (todayDeletions >= 3) {
          throw new Error("reached_daily_deletion_limit");
        }
        const isSameRefundDay = garageData.lastRefundDate === todayYMD;
        const refundAmt = Math.max(0, Number(refundAmount || 0));
        let enteredToday = false;
        if (vehicleData.status === "inside" && vehicleData.entryTime) {
          const entryTime = vehicleData.entryTime.toDate ? vehicleData.entryTime.toDate() : new Date(vehicleData.entryTime);
          if (!isNaN(entryTime.getTime())) {
            const entryDateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(entryTime);
            enteredToday = entryDateKey === todayYMD;
          }
        }
        t.delete(vehicleRef);
        const updates = {
          isLocked: false,
          dailyDeletionCount: todayDeletions + 1,
          lastDeletionDate: todayYMD,
          dailyRefundCount: isSameRefundDay ? (garageData.dailyRefundCount || 0) + 1 : 1,
          lastRefundDate: todayYMD
        };
        if (refundAmt > 0) updates.balance = (garageData.balance || 0) + refundAmt;
        if (vehicleData.status === "inside") updates.carsInside = Math.max(0, (garageData.carsInside || 0) - 1);
        if (enteredToday) updates.todayCount = Math.max(0, (garageData.todayCount || 0) - 1);
        t.set(garageRef, updates, { merge: true });
        if (enteredToday && dailyStatsDoc.exists) {
          const prevCount = dailyStatsDoc.data()?.count || 0;
          if (prevCount > 0) t.set(dailyStatsRef, { count: prevCount - 1 }, { merge: true });
        }
        const logRef = adminDb.collection("activity_logs").doc();
        t.set(logRef, {
          garageId,
          garageName: garageData.name || "",
          staffId: staffId || vehicleData.staffId || null,
          staffName: staffName || vehicleData.staffName || "\u0645\u062F\u064A\u0631 \u0627\u0644\u062C\u0631\u0627\u062C",
          actionType: "delete_refund",
          plateNumber: `\u0645\u0633\u062D \u0644\u0648\u062D\u0629: ${vehicleData.plateNumber || vehicleId}`,
          timestamp: /* @__PURE__ */ new Date(),
          amount: refundAmt
        });
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("[Server] Delete error:", err);
      return res.status(500).json({ success: false, error: err.message || "DELETE_FAILED" });
    }
  });
  app.use("/api", (req, res) => {
    res.status(404).json({ success: false, error: "API route not found" });
  });
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.use((err, _req, res, _next) => {
    console.error("[Express Global Error]:", err);
    res.status(500).json({ success: false, error: err.message || "INTERNAL_SERVER_ERROR" });
  });
  if (process.env.VERCEL) {
    console.log("[ARK Express Server] Exported for Vercel Serverless");
  } else {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[ARK Express Server] Running on http://0.0.0.0:${PORT}`);
    });
  }
  return app;
}
var appPromise = startServer();
var server_default = appPromise;
//# sourceMappingURL=server.cjs.map
