import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { serverTimestamp, Timestamp, onSnapshot, doc, collection, query, where, limit, getDocs, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { APP_TEXT, ADMIN_PIN } from '../constants';
import { getCleanPackageInfo } from '../constants/packages';
import { firestoreServiceV2 as firestoreService, firestoreServiceV2, type GarageDeletionProgress } from '../services/domain/firestoreServiceV2';
import { getCairoDateKey } from '../domain/garage/businessDay';
import { Garage, Vehicle, Package, Staff, RechargeRequest, Supervisor, Delegate } from '../types';
import { 
  safeDate, 
  getRawPlate, 
  formatPlateNumber, 
  calculateCost,
  normalizeDigits, 
  normalizePhone,
  getStorage,
  isSessionActive,
  isSubscriptionExpired,
  getEffectiveDailyCapacity,
  isUnlimitedCapacity,
  applyMonthlySubscribersFlatFee,
  createAsyncLock
} from '../utils';
import { useLocalStorageState } from './useLocalStorage';
import { useOnlineStatus } from './useOnlineStatus';
import { useServerTime } from './useServerTime';
import { useSystemSubscribersFlatFee, useSystemReferralFee } from './useSystemSubscribersFlatFee';
import { soundManager } from '../utils/sounds';
import { useAppStore } from '../store/appStore';

// Simple async lock to prevent double-clicks
const pendingOperations = new Set<string>();

function withAsyncLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (pendingOperations.has(key)) {
    return Promise.reject(new Error('Operation already in progress'));
  }
  pendingOperations.add(key);
  return fn().finally(() => {
    pendingOperations.delete(key);
  });
}

const CURRENT_VERSION = '1.0.4';

export function useGarageApp() {
  // Clear App Cache upon Version Updates
  useEffect(() => {
    try {
      const savedVersion = localStorage.getItem('app_version');
      if (savedVersion && savedVersion !== CURRENT_VERSION) {
        localStorage.setItem('app_version', CURRENT_VERSION);
        localStorage.removeItem('app_view'); 
        window.location.reload();
      } else if (!savedVersion) {
        localStorage.setItem('app_version', CURRENT_VERSION);
      }
    } catch (e) {
      console.error('Cache error', e);
    }
  }, []);

  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);

  const checkInLock = useRef(createAsyncLock());
  const checkOutLock = useRef(createAsyncLock());

  // Landscape Orientation Check
  useEffect(() => {
    const checkOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
      setIsLandscapeMobile(isLandscape);
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  // Persisted state fields
  const subscriberFlatFee = useSystemSubscribersFlatFee();
  const systemReferralFee = useSystemReferralFee();
  const [view, setView] = useLocalStorageState<'login' | 'garage' | 'admin_login' | 'admin_dashboard' | 'admin_garage_details' | 'admin_delegate_details' | 'delegate_login' | 'delegate_dashboard' | 'packages' | 'staff_stats'>('app_view', 'login');
  const [garage, setGarage] = useLocalStorageState<Garage | null>('app_garage', null);
  const [delegate, setDelegate] = useLocalStorageState<any | null>('app_delegate', null);
  const [delegates, setDelegates] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [todayTransactions, setTodayTransactions] = useState<Vehicle[]>([]);
  const [allGarages, setAllGarages] = useState<Garage[]>([]);
  const [packages, setPackages] = useState<Package[]>(() => {
    try {
      const cached = localStorage.getItem('app_packages_cache');
      if (cached) {
        const parts = cached.split('|');
        if (parts.length > 1 && (Date.now() - parseInt(parts[0])) < 300000) {
          return JSON.parse(cached.substring(cached.indexOf('|') + 1));
        }
      }
    } catch (e) {}
    return [];
  });
  const [adminPin, setAdminPin] = useLocalStorageState<string>('app_admin_pin', '');
  const [activeAdminPin, setActiveAdminPin] = useState<string>(ADMIN_PIN);
  const [walletNumber, setWalletNumber] = useLocalStorageState<string>('app_wallet_number', '015 - 524 - 113 - 23');
  const [subscriptionPrices, setSubscriptionPrices] = useState<{ weekly: number; biweekly?: number; monthly: number; weeklyDiscount?: number; biweeklyDiscount?: number; monthlyDiscount?: number }>({ weekly: 800, biweekly: 1500, monthly: 3000 });
  const [loginPhone, setLoginPhone] = useLocalStorageState<string>('app_login_phone', '');
  const [showCheckInModal, setShowCheckInModal] = useLocalStorageState<boolean>('app_show_checkin', false);
  const [showCheckOutModal, setShowCheckOutModal] = useLocalStorageState<boolean>('app_show_checkout', false);
  const [selectedVehicle, setSelectedVehicle] = useLocalStorageState<Vehicle | null>('app_selected_vehicle', null);
  const [newPlateNumber, setNewPlateNumber] = useState<string>('');
  
  const plateInputRef = useRef<HTMLInputElement>(null);
  const deletingVehicleRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'hourly' | 'overnight' | 'checkout' | 'delete' | 'general' | null>(null);
  const [selectedGarageForDetails, setSelectedGarageForDetails] = useLocalStorageState<Garage | null>('app_selected_garage_details', null);
  const [selectedDelegateForDetails, setSelectedDelegateForDetails] = useLocalStorageState<any | null>('app_selected_delegate_details', null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [garageDeletionProgress, setGarageDeletionProgress] = useState<GarageDeletionProgress | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPackages, setShowPackages] = useLocalStorageState<boolean>('app_show_packages', false);
  const [showStaffStats, setShowStaffStats] = useLocalStorageState<boolean>('app_show_staff_stats', false);
  const [showSubscribers, setShowSubscribers] = useLocalStorageState<boolean>('app_show_subscribers', false);
  
  const [currentSupervisor, setCurrentSupervisor] = useLocalStorageState<Supervisor | null>('app_supervisor', null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [delegateRequests, setDelegateRequests] = useState<RechargeRequest[]>([]);

  const [currentStaff, setCurrentStaff] = useLocalStorageState<Staff | null>('app_staff', null);
  const [sessionId] = useState(() => {
    const saved = getStorage<string>('app_session_id', '');
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('app_session_id', newId);
    return newId;
  });
  
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showRecentExitWarning, setShowRecentExitWarning] = useState(false);
  const [recentVehicle, setRecentVehicle] = useState<Vehicle | null>(null);
  const [showSubscriberWarning, setShowSubscriberWarning] = useState(false);
  const [subscriberWarningPlate, setSubscriberWarningPlate] = useState('');
  const [pendingCheckInType, setPendingCheckInType] = useState<'hourly' | 'overnight' | null>(null);

  const { now, serverTimeOffset, setServerTimeOffset, fetchServerTimeOffset } = useServerTime();
  const { isOnline, showOfflineScreen } = useOnlineStatus();
  
  const inputRef = useRef<HTMLDivElement>(null);

  const garageRef = useRef<Garage | null>(null);
  useEffect(() => {
    garageRef.current = garage;
  }, [garage]);

  // Subscribe to Active Vehicles
  useEffect(() => {
    if (!isSessionReady || !garage?.id) {
      return;
    }
    const unsub = firestoreService.subscribeToActiveVehicles(garage.id, (activeVehicles) => {
      setVehicles(activeVehicles);
      const currentGarage = garageRef.current;
      if (currentGarage && currentGarage.carsInside !== activeVehicles.length) {
        firestoreService.updateGarage(currentGarage.id, { carsInside: activeVehicles.length }).catch((err) => {
          console.warn('Failed to heal carsInside:', err);
        });
      }
    });
    return () => unsub();
  }, [isSessionReady, garage?.id]);

  // Subscribe to completed transactions
  useEffect(() => {
    if (!isSessionReady || !garage?.id) {
      return;
    }
    const unsub = firestoreService.subscribeToTodayTransactions(garage.id, (completedTransactions) => {
      setTodayTransactions(completedTransactions);
      const actualRevenue = (completedTransactions || []).reduce((sum, v) => sum + (typeof v.totalCost === 'number' ? v.totalCost : 0), 0);
      if (garage.todayRevenue !== actualRevenue) {
        firestoreService.updateGarage(garage.id, {
          todayRevenue: actualRevenue
        }).catch(() => {});
      }
    });
    return () => unsub();
  }, [isSessionReady, garage?.id, garage?.todayRevenue]);

  const loadGarageData = useCallback(async (garageId: string) => {
    try {
      const staff = await firestoreService.getStaffByGarageOnce(garageId);
      setStaffList(staff);
    } catch (err) {
      console.error('Failed to load garage data:', err);
    }
  }, [setStaffList]);

  const sortedPackages = useMemo(() => {
    const activePkgs = packages || [];
    return [...activePkgs].sort((a, b) => a.price - b.price);
  }, [packages]);

  const delegateGarages = useMemo(() => {
    if (!delegate) return [];
    return allGarages.filter(g => g.createdByDelegateId === delegate.id);
  }, [allGarages, delegate]);

  // Sync Recharge Requests (Admin & Delegate)
  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (view !== 'admin_dashboard' && view !== 'delegate_dashboard' && view !== 'admin_garage_details') return;

    const unsub = firestoreService.subscribeToPendingRechargeRequests((requests) => {
      setRechargeRequests(requests);
    });
    return () => unsub();
  }, [isAuthReady, user, view]);

  // Sync delegate requests
  useEffect(() => {
    if (!isAuthReady || !user || !delegate || view !== 'delegate_dashboard') return;

    const unsub = firestoreService.subscribeToDelegateRechargeRequests(delegate.id, (requests) => {
      setDelegateRequests(requests);
    });
    return () => unsub();
  }, [isAuthReady, user, delegate, view]);

  // Warm up AudioContext on first interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      soundManager.resume(); 
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success', silent: boolean = false) => {
    if (type === 'error' && !silent) soundManager.play('error');
    setToast({ message, type });
    useAppStore.getState().showToast(message, type as any);
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    useAppStore.getState().setGarages(allGarages);
  }, [allGarages]);

  useEffect(() => {
    useAppStore.getState().setPackages(packages);
  }, [packages]);

  useEffect(() => {
    useAppStore.getState().setDelegates(delegates);
  }, [delegates]);

  const handleLogout = useCallback(async (isRemoteKicked: boolean = false) => {
    try {
      if (!isRemoteKicked) {
        const clearSessionPromises: Promise<any>[] = [];
        if (garage) clearSessionPromises.push(firestoreService.updateSession('garages', garage.id, null));
        if (currentStaff) clearSessionPromises.push(firestoreService.updateSession('staff', currentStaff.id, null));
        if (delegate) clearSessionPromises.push(firestoreService.releaseDelegateSession(delegate.id, sessionId));
        if (currentSupervisor) clearSessionPromises.push(firestoreService.updateSession('supervisors', currentSupervisor.id, null));
        await Promise.all(clearSessionPromises).catch(err => console.warn('Clear session failed:', err));
      }
      if (auth.currentUser) {
        const myUid = auth.currentUser.uid;
        await Promise.all([
          deleteDoc(doc(db, 'admin_sessions', myUid)),
          deleteDoc(doc(db, 'supervisor_sessions', myUid)),
          deleteDoc(doc(db, 'delegate_sessions', myUid)),
          deleteDoc(doc(db, 'garage_sessions', myUid)),
          deleteDoc(doc(db, 'staff_sessions', myUid)),
        ]).catch(err => console.warn('Clean security sessions failed:', err));
      }
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
      showToast('حدث خطأ، يرجى المحاولة مرة أخرى', 'error');
    } finally {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('app_') && key !== 'app_admin_color' && key !== 'app_theme' && key !== 'app_session_id') {
          localStorage.removeItem(key);
        }
      });
      setGarage(null);
      setDelegate(null);
      setCurrentStaff(null);
      setCurrentSupervisor(null);
      setVehicles([]);
      setTodayTransactions([]);
      setStaffList([]);
      setLoginPhone('');
      setAdminPin('');
      setView('login');
      setShowLogoutConfirm(false);
    }
  }, [garage?.id, currentStaff?.id, delegate?.id, currentSupervisor?.id]);

  const handleInitiateLogout = useCallback(() => {
    const lockoutUntilStr = localStorage.getItem('logout_lockout_until');
    if (lockoutUntilStr) {
      const lockoutUntil = parseInt(lockoutUntilStr);
      if (Date.now() < lockoutUntil) {
        const remainingMs = lockoutUntil - Date.now();
        const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remainingMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
        const msg = days > 0 
          ? `تسجيل الخروج مقفل لمدة أسبوع. متبقي ${days} يوم و ${hours} ساعة.`
          : `تسجيل الخروج مقفل لمدة أسبوع. متبقي ${hours} ساعة.`;
        showToast(msg, 'error');
        return;
      } else {
        localStorage.removeItem('logout_lockout_until');
        localStorage.setItem('logout_attempts', '0');
      }
    }
    setShowLogoutConfirm(true);
  }, [showToast]);

  const closeKeyboard = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setIsInputFocused(false);
  }, []);

  // === AUTO-LOGOUT IF SESSION INVALID (Phase 2) ===
  useEffect(() => {
    if (!user || isAuthReady === false) return;
    if (view === 'login' || view === 'admin_login' || view === 'delegate_login') return;

    const checkInterval = setInterval(async () => {
      let collectionName = '';
      if (view === 'garage') collectionName = currentStaff ? 'staff_sessions' : 'garage_sessions';
      else if (view === 'delegate_dashboard') collectionName = 'delegate_sessions';
      else if (view.startsWith('admin_')) collectionName = currentSupervisor ? 'supervisor_sessions' : 'admin_sessions';
      
      if (!collectionName) return;

      try {
        const sessionRef = doc(db, collectionName, user.uid);
        const sessionSnap = await getDoc(sessionRef);

        if (!sessionSnap.exists() || sessionSnap.data()?.sessionId !== sessionId) {
          // Only kick out if the existing session has a different sessionId AND was active recently
          if (sessionSnap.exists() && sessionSnap.data()?.sessionId !== sessionId) {
            showToast('تم تسجيل خروجك من جهاز آخر', 'error');
            handleLogout(true);
          } else if (!sessionSnap.exists()) {
            // Session was deleted — try to recreate it (don't kick out, just re-authenticate)
            // The effect below will handle re-creating the session
            return;
          }
        }
      } catch (err) {
        console.error('Session check error', err);
      }
    }, 30000);

    return () => clearInterval(checkInterval);
  }, [user, view, currentStaff, currentSupervisor, isAuthReady, handleLogout, showToast]);

  // Auth States Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    // Fallback if offline/network hangs on auth init
    const timer = setTimeout(() => {
      setIsAuthReady(true);
    }, 4500);
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  // Admin PIN Sync
  useEffect(() => {
    if (!user) return;
    const unsub = firestoreService.subscribeToAdminPin((pin) => {
      setActiveAdminPin(pin);
    });
    return () => unsub();
  }, [user]);

  // Wallet Number Sync
  useEffect(() => {
    if (!user) return;
    const unsub = firestoreService.subscribeToWalletNumber((wallet) => {
      setWalletNumber(wallet);
    });
    return () => unsub();
  }, [user]);

  // Subscription Prices Sync
  useEffect(() => {
    if (!user) return;
    const unsub = firestoreService.subscribeToSubscriptionPrices((prices) => {
      setSubscriptionPrices(prices);
    });
    return () => unsub();
  }, [user]);

  // On-demand anonymous auth fallback
  useEffect(() => {
    if (isAuthReady && !user) {
      import('firebase/auth').then(({ signInAnonymously }) => {
        signInAnonymously(auth).catch((err: any) => {
          console.error("Anonymous authentication failed:", err);
          showToast(`فشل كود المصادقة: ${err.message || err}`, 'error');
        });
      });
    }
  }, [isAuthReady, user, showToast]);

  // === HARD SESSION LOGIN (Phase 2) ===
  const loginWithSession = useCallback(async (collectionName: string, data: any, uid: string) => {
    if (!uid) throw new Error('معرّف المستخدم غير موجود');
    const sessionRef = doc(db, collectionName, uid);
    const existingSession = await getDoc(sessionRef);

    if (existingSession.exists()) {
      const existingSessionId = existingSession.data()?.sessionId;
      
      if (existingSessionId !== sessionId) {
        throw new Error('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.');
      }

      await setDoc(sessionRef, { lastActive: serverTimestamp() }, { merge: true });
      return;
    }

    // Create the security session only once, after the collection rule validates its login data.
    await setDoc(sessionRef, {
      ...data,
      sessionId,
      lastActive: serverTimestamp(),
      createdAt: serverTimestamp(),
      deviceInfo: navigator.userAgent
    });
  }, [sessionId, fetchServerTimeOffset]);

  // Synchronize secure temporary auth sessions
  useEffect(() => {
    if (view === 'login' || view === 'admin_login' || view === 'delegate_login') {
      setIsSessionReady(true);
      return;
    }
    if (!isAuthReady || !user) {
      setIsSessionReady(false);
      return;
    }

    const syncSecuritySession = async () => {
      try {
        const normalizedPin = normalizeDigits(adminPin);
        if (normalizedPin === activeAdminPin && view.startsWith('admin_')) {
          await loginWithSession('admin_sessions', { pin: activeAdminPin }, user.uid);
          if (adminPin !== activeAdminPin) {
            setAdminPin(activeAdminPin);
          }
        } else if (view.startsWith('admin_') && currentSupervisor) {
          await loginWithSession('supervisor_sessions', { supervisorId: currentSupervisor.id, pin: currentSupervisor.pin }, user.uid);
        } else if (view === 'delegate_dashboard' && delegate) {
          await firestoreService.claimOrRefreshDelegateSession(delegate.id, sessionId, serverTimeOffset);
          await loginWithSession('delegate_sessions', { delegateId: delegate.id, pin: delegate.pin }, user.uid);
        } else if (view === 'garage') {
          if (currentStaff) {
            await loginWithSession('staff_sessions', { staffId: currentStaff.id, pin: currentStaff.pin, garageId: currentStaff.garageId }, user.uid);
          } else if (garage) {
            await loginWithSession('garage_sessions', { garageId: garage.id, pin: garage.pin || '', phone: garage.phone || '' }, user.uid);
          }
        }
        setIsSessionReady(true);
      } catch (err: any) {
        console.warn('Silent security session recovery deferred:', err);
        const errMsg = err?.message || '';
        if (view === 'delegate_dashboard' && delegate) {
          if (user) {
            await deleteDoc(doc(db, 'delegate_sessions', user.uid)).catch(() => {});
          }
          showToast('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.', 'error');
          handleLogout(true);
          return;
        }
        if (errMsg.includes('مستخدم على جهاز آخر') || errMsg === 'DELEGATE_SESSION_OCCUPIED') {
          showToast('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.', 'error');
          handleLogout(true);
        } else if (normalizeDigits(adminPin) === activeAdminPin) {
          showToast('تنبيه أمني: فشل مزامنة جلسة المدير، يرجى إعادة الدخول. التفاصيل: ' + errMsg, 'error');
        }
        setIsSessionReady(true);
      }
    };

    syncSecuritySession();
  }, [isAuthReady, user, view, adminPin, activeAdminPin, delegate, garage, currentStaff, currentSupervisor, showToast]);

  // Sync global collections
  useEffect(() => {
    if (!isSessionReady || !isAuthReady || !user || (view !== 'admin_dashboard' && view !== 'admin_garage_details' && view !== 'admin_delegate_details' && view !== 'garage' && view !== 'delegate_dashboard')) return;

    const unsubGarages = (view === 'delegate_dashboard' && delegate?.id)
      ? firestoreService.subscribeToDelegateGarages(delegate.id, setAllGarages)
      : (view === 'admin_dashboard' || view === 'admin_garage_details') 
      ? firestoreService.subscribeToGarages(setAllGarages)
      : () => {};
    
    const unsubDelegates = (view === 'admin_dashboard' || view === 'admin_delegate_details')
      ? firestoreService.subscribeToDelegates(setDelegates)
      : () => {};

    const unsubSupervisors = (view === 'admin_dashboard')
      ? firestoreService.subscribeToSupervisors(setSupervisors)
      : () => {};

    const unsubPackages = firestoreService.subscribeToPackages(setPackages);
    
    return () => {
      unsubGarages();
      unsubDelegates();
      unsubSupervisors();
      unsubPackages();
    };
  }, [isSessionReady, isAuthReady, user, view, delegate?.id]);

  // Load Admin specific garage details once
  useEffect(() => {
    if (!isAuthReady || !user || view !== 'admin_garage_details' || !selectedGarageForDetails?.id) return;

    const garageId = selectedGarageForDetails.id;
    const fetchSpecificData = async () => {
      try {
        const [staffData, garageData] = await Promise.all([
          firestoreService.getStaffByGarageOnce(garageId),
          firestoreService.getGarageById(garageId)
        ]);
        setStaffList(staffData);
        if (garageData) setSelectedGarageForDetails(garageData);
      } catch (err) {
        console.error('Admin garage details fetch error:', err);
      }
    };

    fetchSpecificData();
  }, [isAuthReady, user, view, selectedGarageForDetails?.id]);

  // Real-time garage context listener for the active garage
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const isGarageView = view === 'garage' || view === 'delegate_dashboard' || view === 'admin_garage_details';
    if (isGarageView) {
      const targetId = view === 'admin_garage_details' ? selectedGarageForDetails?.id : garage?.id;
      
      if (targetId) {
        const unsubGarage = onSnapshot(doc(db, 'garages', targetId), (snapshot) => {
          if (snapshot.exists()) {
            const data = { id: snapshot.id, ...snapshot.data() } as Garage;
            
            // Auto-heal legacy corrupted/stale data in Firestore
            const todayStr = getCairoDateKey();
            const updatesToHeal: any = {};
            
            if (data.balanceExpiry) {
              const diffDays = Math.ceil((safeDate(data.balanceExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              if (data.isTrial && diffDays > 15) {
                updatesToHeal.balanceExpiry = Timestamp.fromDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));
              } else if (!data.isTrial && diffDays > 365) {
                updatesToHeal.balanceExpiry = Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
              }
            }
            
            if (!data.lastTransactionDate || data.lastTransactionDate !== todayStr) {
              if (data.todayRevenue !== 0) updatesToHeal.todayRevenue = 0;
              if (data.todayCount !== 0) updatesToHeal.todayCount = 0;
            } else if (data.todayCount && data.todayCount === data.carsInside && data.todayCount > 40) {
              updatesToHeal.todayCount = 0;
            }

            if (Object.keys(updatesToHeal).length > 0) {
              firestoreService.updateGarage(data.id, updatesToHeal).catch(() => {});
            }

            if (view === 'admin_garage_details') {
              setSelectedGarageForDetails(data);
            } else {
              setGarage(data);
              localStorage.setItem('app_garage', JSON.stringify(data));
            }
          }
        }, (err) => handleFirestoreError(err, OperationType.GET, `garages/${targetId}`));

        if (view === 'garage' || view === 'delegate_dashboard') {
          loadGarageData(targetId);
        }

        return () => unsubGarage();
      }
    }
  }, [user?.uid, isAuthReady, garage?.id, selectedGarageForDetails?.id, view, delegate?.id, loadGarageData]);

  // Cooperative session collision checker
  useEffect(() => {
    const isDashboardView = view === 'garage' || view === 'delegate_dashboard' || (view.startsWith('admin_') && currentSupervisor);
    if (!isDashboardView) return;

    let id: string | null = null;
    let collectionName: 'garages' | 'staff' | 'delegates' | 'supervisors' | null = null;

    if (view === 'garage') {
      if (currentStaff) {
        id = currentStaff.id;
        collectionName = 'staff';
      } else if (garage) {
        id = garage.id;
        collectionName = 'garages';
      }
    } else if (view === 'delegate_dashboard' && delegate) {
      id = delegate.id;
      collectionName = 'delegates';
    } else if (view.startsWith('admin_') && currentSupervisor) {
      id = currentSupervisor.id;
      collectionName = 'supervisors';
    }

    if (!id || !collectionName) return;
    let heartbeatTimer: any;

    const syncSession = async () => {
      try {
        if (collectionName === 'delegates') {
          await firestoreService.claimOrRefreshDelegateSession(id!, sessionId, serverTimeOffset);
        } else if (collectionName) {
          await firestoreService.updateSession(collectionName, id!, sessionId);
        }
        
        // Also update security session
        if (user) {
          let secCollection = '';
          if (collectionName === 'garages') secCollection = 'garage_sessions';
          else if (collectionName === 'staff') secCollection = 'staff_sessions';
          else if (collectionName === 'delegates') secCollection = 'delegate_sessions';
          else if (collectionName === 'supervisors') secCollection = 'supervisor_sessions';
          
          if (secCollection) {
            await setDoc(doc(db, secCollection, user.uid), { lastActive: serverTimestamp() }, { merge: true });
          }
        }
      } catch (err: any) {
        console.error('Session sync failed:', err);
        if (collectionName === 'delegates' || err?.message === 'DELEGATE_SESSION_OCCUPIED') {
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          showToast('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.', 'error');
          handleLogout(true);
        }
      }
    };

    const unsubscribe = onSnapshot(doc(db, collectionName, id), (snapshot) => {
      if (!snapshot.exists()) {
        showToast('عذراً، تم حذف أو تعطيل هذا الحساب من قبل مدير النظام.', 'error');
        handleLogout(true);
        return;
      }
      const data = snapshot.data();

      let currentOffset = serverTimeOffset;
      if (!snapshot.metadata.hasPendingWrites && data.lastActive) {
        const d = safeDate(data.lastActive);
        const serverTime = d.getTime();
        const localTime = Date.now();
        currentOffset = serverTime - localTime;
        setServerTimeOffset(currentOffset);
      }
    });

    syncSession();
    heartbeatTimer = setInterval(syncSession, 120000);

    return () => {
      unsubscribe();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [view, garage?.id, currentStaff?.id, delegate?.id, currentSupervisor?.id, sessionId, user?.uid]);

  // Fast typing auto-checkout trigger disabled to prevent unexpected checkout modal popups on incomplete/colliding plate prefixes
  /*
  useEffect(() => {
    if (!garage || !newPlateNumber || view !== 'garage' || showCheckOutModal || isLoading) return;
    
    const raw = getRawPlate(newPlateNumber);
    const letters = raw.replace(/[0-9]/g, '');
    const numbers = raw.replace(/[^0-9]/g, '');
    const isValid = letters.length >= 1 && numbers.length >= 1;

    if (isValid) {
      const existing = vehicles.find(v => v.plateNumberRaw === raw && v.status === 'inside');
      if (existing) {
        const timer = setTimeout(() => {
          closeKeyboard();
          setSelectedVehicle(existing);
          setShowCheckOutModal(true);
          setNewPlateNumber('');
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [newPlateNumber, vehicles, garage, view, showCheckOutModal]);
  */

  const handleGarageLogin = useCallback(async () => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    const normalizedInput = normalizePhone(loginPhone.trim());
    if (!normalizedInput) {
      showToast('يرجى إدخال البيانات المطلوبة', 'error');
      return;
    }
    closeKeyboard();

    if (normalizedInput === activeAdminPin) {
      if (auth.currentUser) {
        try {
          await loginWithSession('admin_sessions', { pin: activeAdminPin }, auth.currentUser.uid);
        } catch (err) {
          console.error("Failed to write admin security session:", err);
          showToast("عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.", "error");
          return;
        }
      }
      setAdminPin(activeAdminPin);
      setView('admin_dashboard');
      return;
    }

    setIsLoading(true);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 30 * 1000));

    try {
      if (!auth.currentUser) {
        try {
          const userCred = await signInAnonymously(auth);
          setUser(userCred.user);
        } catch (authErr: any) {
          console.error("On-demand anonymous authentication failed:", authErr);
          showToast("عفواً، فشل ترخيص الاتصال بقاعدة البيانات. تأكد من اتصال النت.", "error");
          setIsLoading(false);
          return;
        }
      }

      const currentOffset = await fetchServerTimeOffset();
      const loginAction = (async () => {
        const authRes = await firestoreService.authenticateUserCredentials({ input: normalizedInput });

        if (!authRes || !authRes.success) {
          showToast('بيانات الدخول غير صحيحة', 'error');
          return false;
        }

        const { role, account } = authRes;

        // Admin
        if (role === 'admin') {
          setAdminPin(normalizedInput);
          setView('admin_dashboard');
          showToast('تم تسجيل الدخول كمسؤول للنظام بنجاح');
          return true;
        }

        // Supervisor
        if (role === 'supervisor' && account) {
          const supervisorData = account as Supervisor;
          if (supervisorData.currentSessionId && supervisorData.currentSessionId !== sessionId && isSessionActive(supervisorData.lastActive, currentOffset)) {
            showToast('عذراً، هذا الحساب يعمل حالياً على جهاز آخر.', 'error');
            return 'blocked';
          }
          try {
            if (auth.currentUser) {
              await loginWithSession('supervisor_sessions', { supervisorId: supervisorData.id, pin: normalizedInput }, auth.currentUser.uid);
            }
          } catch (err: any) {
            showToast('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.', 'error');
            return false;
          }
          await firestoreService.updateSupervisorSession(supervisorData.id, sessionId);
          setCurrentSupervisor(supervisorData);
          setView('admin_dashboard');
          showToast(`مرحباً بك يا ${supervisorData.name} (مشرف)`);
          return true;
        }

        // Delegate
        if (role === 'delegate' && account) {
          const delegateData = account as Delegate;
          try {
            if (!auth.currentUser) throw new Error('AUTH_REQUIRED');
            await firestoreService.claimOrRefreshDelegateSession(delegateData.id, sessionId, currentOffset);
            await loginWithSession('delegate_sessions', { delegateId: delegateData.id, pin: normalizedInput }, auth.currentUser.uid);
            setDelegate(delegateData);
            setView('delegate_dashboard');
            showToast(`مرحباً بك يا ${delegateData.name}`);
            return true;
          } catch (err: any) {
            if (auth.currentUser) {
              await deleteDoc(doc(db, 'delegate_sessions', auth.currentUser.uid)).catch(() => {});
            }
            showToast('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.', 'error');
            return false;
          }
        }

        // Staff
        if (role === 'staff' && account) {
          const staffData = account as Staff;
          if (staffData.currentSessionId && staffData.currentSessionId !== sessionId && isSessionActive(staffData.lastActive, currentOffset)) {
            showToast('عذراً، هذا الحساب يعمل حالياً على جهاز آخر.', 'error');
            return 'blocked';
          }
          const gSnap = await getDoc(doc(db, 'garages', staffData.garageId));
          if (gSnap.exists()) {
            const linkedGarage = { id: gSnap.id, ...gSnap.data() } as Garage;
            if (linkedGarage.status === 'pending' || linkedGarage.status === 'rejected') {
              showToast('عذراً، هذا الجراج قيد المراجعة والإنشاء من قبل الإدارة. يرجى الانتظار حتى تتم الموافقة عليه.', 'error');
              return 'blocked';
            }
            try {
              if (auth.currentUser) {
                await loginWithSession('staff_sessions', { staffId: staffData.id, pin: normalizedInput, garageId: staffData.garageId }, auth.currentUser.uid);
              }
            } catch (err: any) {
              showToast('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.', 'error');
              return false;
            }
            await firestoreService.updateStaffSession(staffData.id, sessionId);

            const [activeV, todayT, sList] = await Promise.all([
              firestoreService.getVehiclesInsideOnce(linkedGarage.id),
              firestoreService.getTodayTransactionsOnce(linkedGarage.id),
              firestoreService.getStaffByGarageOnce(linkedGarage.id)
            ]);

            setVehicles(activeV);
            setTodayTransactions(todayT);
            setStaffList(sList);
            setGarage(linkedGarage);
            setCurrentStaff(staffData);
            setView('garage');
            showToast(`مرحباً بك يا ${staffData.name}`);
            return true;
          }
        }

        // Garage
        if (role === 'garage' && account) {
          const garageData = account as Garage;
          if (garageData.status === 'pending' || garageData.status === 'rejected') {
            showToast('عذراً، هذا الجراج قيد المراجعة والإنشاء من قبل الإدارة. يرجى الانتظار حتى تتم الموافقة عليه.', 'error');
            return 'blocked';
          }
          if (garageData.currentSessionId && garageData.currentSessionId !== sessionId && isSessionActive(garageData.lastActive, currentOffset)) {
            showToast('عذراً، هذا الحساب يعمل حالياً على جهاز آخر.', 'error');
            return 'blocked';
          }
          await firestoreService.updateGarageSession(garageData.id, sessionId);

          const [activeV, todayT, sList] = await Promise.all([
            firestoreService.getVehiclesInsideOnce(garageData.id),
            firestoreService.getTodayTransactionsOnce(garageData.id),
            firestoreService.getStaffByGarageOnce(garageData.id)
          ]);

          setVehicles(activeV);
          setTodayTransactions(todayT);
          setStaffList(sList);
          setGarage(garageData);
          setCurrentStaff(null);
          setView('garage');
          showToast(`مرحباً بك يا صاحب جراج ${garageData.name}`);
          return true;
        }

        return false;
      })();
 
      const result = await Promise.race([loginAction, timeout]) as boolean | string;
      if (result === 'blocked') return;
      if (!result) showToast('بيانات الدخول غير صحيحة', 'error');
 
    } catch (error: any) {
       console.error("Login critical error:", error);
       const errMsg = error?.message || String(error);
       if (errMsg.includes('permission') || errMsg.includes('Permission')) {
         showToast('عفواً، لا توجد صلاحيات لتسجيل الدخول. يرجى التأكد من تفعيل Anonymous Auth في Firebase.', 'error');
       } else if (errMsg.includes('timeout')) {
         showToast('انتهت مهلة المزامنة مع السيرفر. يرجى المحاولة مرة أخرى.', 'error');
       } else {
         showToast(`خطأ في الاتصال: ${errMsg}`, 'error');
       }
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, loginPhone, activeAdminPin, closeKeyboard, sessionId, showToast, fetchServerTimeOffset]);

  const handleDelegateLogin = useCallback(async (phone: string, pin: string) => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || !pin) return;

    setIsLoading(true);
    try {
      const currentOffset = await fetchServerTimeOffset();
      const authRes = await firestoreService.authenticateUserCredentials({ phone: normalizedPhone, pin });

      if (!authRes || !authRes.success || authRes.role !== 'delegate' || !authRes.account) {
        showToast('بيانات الدخول غير صحيحة', 'error');
        return;
      }

      const delegateData = authRes.account as Delegate;
      try {
        if (!auth.currentUser) throw new Error('AUTH_REQUIRED');

        await firestoreService.claimOrRefreshDelegateSession(delegateData.id, sessionId, currentOffset);
        await loginWithSession('delegate_sessions', { delegateId: delegateData.id, pin }, auth.currentUser.uid);

        setDelegate(delegateData);
        setView('delegate_dashboard');
        showToast(`مرحباً بك يا ${delegateData.name}`);
      } catch (err: any) {
        if (auth.currentUser) {
          await deleteDoc(doc(db, 'delegate_sessions', auth.currentUser.uid)).catch(() => {});
        }
        showToast('عذرًا، هذا الحساب يعمل حاليًا على جهاز آخر.', 'error');
      }
    } catch (error) {
      // Handled
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, sessionId, showToast, fetchServerTimeOffset]);

  const rechargeLock = useRef(createAsyncLock());

  const handleDelegateRecharge = useCallback(async (garageId: string, amount: number, pkg?: Package, discountInfo?: { discountAmount?: number; originalRevenueAmount?: number }) => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    const lockResult = await rechargeLock.current(async () => {
      try {
        const g = allGarages.find(gar => gar.id === garageId);
        if (!g || !delegate) return;

        const pendingRequests = await firestoreService.getPendingRechargeRequestsForGarage(garageId);
        if (pendingRequests.length > 0) {
          showToast('يوجد طلب شحن معلق بالفعل لهذا الجراج', 'error');
          return;
        }
        
        const cleanPkg = pkg ? getCleanPackageInfo(pkg) : null;
        const durationDays = cleanPkg ? cleanPkg.durationDays : 30;
        const effCap = cleanPkg ? (cleanPkg.isUnlimited ? 0 : (cleanPkg.dailyCapacity || 40)) : 0;
        
        const referrerId = g.referrerId || g.createdByDelegateId || delegate.id || null;
        const refFee = (g.referrerId || g.createdByDelegateId) ? systemReferralFee : 0;

        let revenueIncrement = pkg ? (pkg.price + refFee) : amount;
        const originalRev = discountInfo?.originalRevenueAmount !== undefined ? discountInfo.originalRevenueAmount : revenueIncrement;

        if (discountInfo?.discountAmount && discountInfo.discountAmount > 0) {
          revenueIncrement = Math.max(0, revenueIncrement - discountInfo.discountAmount);
        }

        revenueIncrement = applyMonthlySubscribersFlatFee(revenueIncrement, g.hasMonthlySubscribers || false, subscriberFlatFee);

        const rechargePayload: any = {
          garageId: garageId,
          garageName: g.name,
          delegateId: delegate.id,
          delegateName: delegate.name,
          referrerId: referrerId,
          packageId: pkg?.id || 'custom',
          packageName: pkg?.name || 'مبلغ مخصص',
          amount: revenueIncrement,
          durationDays: durationDays,
          carsCount: effCap,
          dailyCapacity: effCap,
          revenueAmount: revenueIncrement,
          originalRevenueAmount: originalRev,
          discountAmount: discountInfo?.discountAmount || 0
        };

        await firestoreService.createRechargeRequest(rechargePayload);
      } catch (error) {
        showToast('فشل في إرسال طلب الشحن', 'error');
        throw error;
      }
    });

    if (lockResult === null) {
      showToast('جاري إرسال الطلب... يرجى الانتظار', 'info');
    }
  }, [isOnline, allGarages, delegate, subscriberFlatFee, systemReferralFee, showToast]);

  const handleCheckIn = useCallback(async (type: 'hourly' | 'overnight', bypassWarning = false) => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى إعادة المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!garage || !newPlateNumber || isLoading) return;
    closeKeyboard();

    const raw = getRawPlate(newPlateNumber);
    const formatted = formatPlateNumber(newPlateNumber);
    
    const existing = vehicles.find(v => v.plateNumberRaw === raw);
    if (existing) {
      showToast('هذه السيارة موجودة بالفعل بالداخل', 'error');
      setShowCheckInModal(false);
      return;
    }

    const recentlyExited = todayTransactions
      .filter(v => v.plateNumberRaw === raw)
      .sort((a, b) => {
        const timeA = a.exitTime ? safeDate(a.exitTime).getTime() : Date.now();
        const timeB = b.exitTime ? safeDate(b.exitTime).getTime() : Date.now();
        return timeB - timeA;
      })[0];

    if (recentlyExited && !showRecentExitWarning && !bypassWarning) {
      const exitTime = recentlyExited.exitTime ? safeDate(recentlyExited.exitTime) : new Date();
      if (Date.now() - exitTime.getTime() < 3600000) {
        setRecentVehicle(recentlyExited);
        setPendingCheckInType(type);
        setShowRecentExitWarning(true);
        soundManager.play('error');
        return;
      }
    }

    let isSubscriber = false;
    
    if (garage.hasMonthlySubscribers) {
      try {
        const subSnap = await getDocs(query(
          collection(db, `garages/${garage.id}/subscribers`),
          where('plateNumberRaw', '==', raw),
          limit(1)
        ));
        
        if (!subSnap.empty) {
          const subData = subSnap.docs[0].data();
          const end = new Date(subData.endDate);
          const today = new Date();
          today.setHours(0,0,0,0);
          if (end >= today) {
            isSubscriber = true;
          }
        }
      } catch (e) {
        console.error("Sub check error", e);
      }
    }

    if (isSubscriber) {
      setSubscriberWarningPlate(formatted);
      setShowSubscriberWarning(true);
      setShowCheckInModal(false);
      setNewPlateNumber('');
      soundManager.play('error');
      return;
    }

    if (isSubscriptionExpired(garage)) {
      showToast('عفواً، انتهى اشتراك الجراج. يرجى تجديد الاشتراك.', 'error');
      soundManager.play('error');
      return;
    }

    if (!isUnlimitedCapacity(garage)) {
      const effCap = getEffectiveDailyCapacity(garage);
      const todayCount = garage.todayCount || 0;
      if (todayCount >= effCap) {
        showToast(`عفواً، وصلت للحد الأقصى اليومي للباقة (${effCap} سيارة/يوم). يرجى ترقية الباقة لتسجيل المزيد.`, 'error');
        soundManager.play('error');
        return;
      }
    }

    const lockResult = await checkInLock.current(async () => {
      setIsLoading(true);
      setLoadingType(type);
      setNewPlateNumber('');
      soundManager.play('checkIn');
      
      try {
        const res = await withAsyncLock(`checkin-${garage.id}-${raw}`, () =>
          firestoreServiceV2.checkInVehicle(garage.id, {
            plateNumber: formatted,
            plateNumberRaw: raw,
            type: type,
            garageId: garage.id,
            staffId: currentStaff ? currentStaff.id : null,
            staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
            isSubscriber: isSubscriber
          })
        );

        if (!res.success) {
          throw new Error(res.error);
        }

        const newVehicleObj: Vehicle = {
          id: raw,
          plateNumber: formatted,
          plateNumberRaw: raw,
          entryTime: new Date() as any,
          type: type,
          garageId: garage.id,
          status: 'inside',
          staffId: currentStaff ? currentStaff.id : null,
          staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
          isSubscriber: isSubscriber
        };
        setVehicles(prev => [newVehicleObj, ...prev.filter(v => v.id !== raw)]);

        setShowCheckInModal(false);
      } catch (error: any) {
        if (error?.message === 'Operation already in progress') {
          showToast('جاري معالجة طلب الدخول... يرجى الانتظار', 'info');
          return;
        }
        let message = error?.message || '';
        if (message.startsWith('{') && message.endsWith('}')) {
          try {
            const detailed = JSON.parse(message);
            message = detailed.error || message;
          } catch (e) {}
        }

        if (message === 'ALREADY_INSIDE' || message.includes('مسجلة بالفعل')) {
          showToast('هذه السيارة موجودة بالفعل بالداخل', 'error');
        } else if (message.includes('permission') || message.includes('PERMISSION_DENIED')) {
          setNewPlateNumber(formatted);
          showToast('انتهت صلاحية الجلسة أو لا توجد صلاحيات لتسجيل الدخول', 'error');
        } else if (message.includes('الحد اليومي') || message.includes('اشتراك')) {
          setNewPlateNumber(formatted);
          showToast(message, 'error');
        } else {
          setNewPlateNumber(formatted);
          showToast(message || 'حدث خطأ أثناء الدخول، تأكد من الاتصال بالإنترنت', 'error');
        }
      } finally {
        setIsLoading(false);
        setLoadingType(null);
      }
    });

    if (lockResult === null) {
      showToast('جاري المعالجة... يرجى الانتظار', 'info');
      return;
    }
  }, [isOnline, garage, newPlateNumber, isLoading, closeKeyboard, vehicles, todayTransactions, showRecentExitWarning, currentStaff, showToast]);

  const confirmCheckOut = useCallback(async () => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى إعادة المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!garage || !selectedVehicle || isLoading) return;
    closeKeyboard();

    const vehicleToOut = selectedVehicle;

    const lockResult = await checkOutLock.current(async () => {
      setIsLoading(true);
      setLoadingType('checkout');
      soundManager.play('checkOut');
      
      try {
        const cost = calculateCost(vehicleToOut, garage, now);

        const res = await withAsyncLock(`checkout-${garage.id}-${vehicleToOut.id}`, () =>
          firestoreServiceV2.checkOutVehicle(
            garage.id,
            vehicleToOut.id,
            cost,
            currentStaff ? currentStaff.name : 'مدير الجراج',
            currentStaff ? currentStaff.id : undefined
          )
        );

        if (!res.success) {
          throw new Error(res.error);
        }

        setVehicles(prev => prev.filter(v => v.id !== vehicleToOut.id));
        setShowCheckOutModal(false);
        setSelectedVehicle(null);
        setNewPlateNumber('');
        // showToast('تم تسجيل خروج السيارة بنجاح', 'success');
      } catch (error: any) {
        if (error?.message === 'Operation already in progress') {
          showToast('جاري معالجة طلب الخروج... يرجى الانتظار', 'info');
          return;
        }
        console.error('CheckOut Error:', error);
        let errMsg = 'حدث خطأ أثناء الخروج';
        
        try {
          const message = error?.message || '';
          if (message.startsWith('{') && message.endsWith('}')) {
            const parsed = JSON.parse(message);
            const rawErr = parsed.error;
            if (rawErr === 'ALREADY_OUTSIDE') {
              errMsg = 'هذه السيارة تم تسجيل خروجها بالفعل (من جهاز آخر)';
            } else if (rawErr === 'VEHICLE_NOT_FOUND') {
              errMsg = 'لم يتم العثور على بيانات السيارة';
            } else if (rawErr === 'GARAGE_NOT_FOUND') {
              errMsg = 'لم يتم العثور على الجراج';
            } else {
              errMsg = rawErr || 'مشكلة في البيانات، حاول مرة أخرى';
            }
          } else {
            errMsg = message || 'حدث خطأ أثناء الخروج';
          }
        } catch (e) {
          errMsg = error?.message || 'حدث خطأ أثناء الخروج';
        }
        
        showToast(errMsg, 'error');
        
        // Clean up modal and remove stale/checked-out vehicle from local state
        setShowCheckOutModal(false);
        if (vehicleToOut) {
          setVehicles(prev => prev.filter(v => v.id !== vehicleToOut.id));
        }
        setSelectedVehicle(null);
      } finally {
        setIsLoading(false);
        setLoadingType(null);
      }
    });

    if (lockResult === null) {
      showToast('جاري المعالجة... يرجى الانتظار', 'info');
      return;
    }
  }, [isOnline, garage, selectedVehicle, isLoading, closeKeyboard, currentStaff, showToast]);

  const handleDeleteVehicle = useCallback(async () => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى إعادة المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!garage || !selectedVehicle) return;

    // Owner-only deletion check
    const isOwner = currentStaff 
      ? (typeof selectedVehicle.staffId === 'string' && selectedVehicle.staffId === currentStaff.id)
      : (selectedVehicle.staffId == null);
    if (!isOwner) {
      showToast('يمكن فقط لمسجّل هذه السيارة حذفها', 'error');
      return;
    }

    // Daily limit guard (Max 3 deletions/day)
    const todayYMD = getCairoDateKey();
    if (garage.lastDeletionDate === todayYMD && (garage.dailyDeletionCount ?? 0) >= 3) {
      showToast('وصلت للحد الأقصى للحذف اليوم (3 مرات)', 'error');
      return;
    }

    if (isLoading || deletingVehicleRef.current === selectedVehicle.id) {
      return;
    }

    deletingVehicleRef.current = selectedVehicle.id;
    setIsLoading(true);
    setLoadingType('delete');
    soundManager.play('checkOut');

    setShowCheckOutModal(false);
    setShowDeleteConfirm(false);

    try {
      const success = await firestoreService.deleteVehicleWithRefund(
        garage.id,
        selectedVehicle.id,
        0,
        todayYMD,
        currentStaff ? currentStaff.name : 'مدير الجراج',
        currentStaff ? currentStaff.id : undefined
      );
      if (success) {
        setVehicles(prev => prev.filter(v => v.id !== selectedVehicle.id));
        showToast('اللوحة اتمسحت بنجاح');
      } else {
        showToast('فشل في حذف السيارة، جرب تانى', 'error');
      }
    } catch (err: any) {
      console.error('Delete Vehicle Error:', err);
      if (err?.message === 'reached_daily_deletion_limit' || err?.message?.includes('reached_daily_deletion_limit')) {
        showToast('وصلت للحد الأقصى للحذف اليوم (3 مرات)', 'error');
      } else {
        showToast('فشل في حذف السيارة، جرب تانى', 'error');
      }
    } finally {
      deletingVehicleRef.current = null;
      setSelectedVehicle(null);
      setNewPlateNumber('');
      setLoadingType(null);
      setIsLoading(false);
    }
  }, [isOnline, garage, selectedVehicle, currentStaff, showToast, isLoading]);

  const deleteGarage = useCallback(async (g: Garage | null) => {
    if (isLoading) return;
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!g) return;
    const garageId = g.id;
    closeKeyboard();
    setIsLoading(true);
    setGarageDeletionProgress({
      phase: 'preparing',
      total: 0,
      processed: 0,
      percentage: 1
    });

    try {
      await firestoreService.deleteGarage(garageId, setGarageDeletionProgress);
      setShowDeleteConfirm(false);
      setSelectedGarageForDetails(null);
      setView('admin_dashboard');
      showToast(APP_TEXT.ADMIN.DELETE_CONFIRM);
    } catch (error) {
      showToast('فشل في حذف الجراج', 'error');
    } finally {
      setIsLoading(false);
      setGarageDeletionProgress(null);
    }
  }, [isLoading, isOnline, closeKeyboard, showToast, setSelectedGarageForDetails, setView]);

  const updateGarageRate = useCallback(async (g: Garage, field: 'hourlyRate' | 'overnightRate', value: number) => {
    try {
      await firestoreService.updateGarage(g.id, { [field]: value });
    } catch (error) {}
  }, []);

  const createNewGarage = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    if (currentSupervisor) {
      showToast('غير مصرح للمشرف بإضافة جراجات جديدة', 'error');
      return;
    }
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    e.preventDefault();
    setIsLoading(true);
    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const data: any = Object.fromEntries(formData.entries());

      // Pass packages for lookup
      data.packages = packages;

      // Handle isTrial
      const isTrialRaw = formData.get('isTrial') || formData.get('isTrial_hidden');
      const isTrial = isTrialRaw === 'true' || isTrialRaw === 'on' || isTrialRaw === '1';
      data.isTrial = isTrial;
      if (isTrial) {
        data.initialPackageId = '';
      }

      // Handle monthly subscribers
      const hasMonthlySubscribersRaw = formData.get('hasMonthlySubscribers');
      data.hasMonthlySubscribers = hasMonthlySubscribersRaw === 'true' || hasMonthlySubscribersRaw === 'on' || hasMonthlySubscribersRaw === '1';

      // Delegate check and metadata
      if (delegate && delegate.id) {
        const today = new Date();
        const delegateGaragesCreatedToday = allGarages.filter(g => {
          if (g.createdByDelegateId !== delegate.id) return false;
          if (!g.createdAt) return false;
          const createdDate = safeDate(g.createdAt);
          return createdDate.getDate() === today.getDate() &&
                 createdDate.getMonth() === today.getMonth() &&
                 createdDate.getFullYear() === today.getFullYear();
        });

        if (delegateGaragesCreatedToday.length >= 3) {
          showToast('عذراً، لقد وصلت للحد الأقصى اليومي المسموح به لإنشاء الجراجات وهو 3 جراجات في اليوم.', 'error');
          setIsLoading(false);
          return;
        }

        data.createdByDelegateId = delegate.id;
        data.createdByDelegateName = delegate.name;
        data.isPending = true;
      }

      // Check pin taken
      const pin = ((data.pin as string) || '').trim();
      const pinCheck = await firestoreService.isPinTaken(pin);
      if (pinCheck.taken) {
        showToast(`هذا الرمز السري (PIN) مستخدم بالفعل في حساب آخر: (${pinCheck.name} - ${pinCheck.role})`, 'error');
        setIsLoading(false);
        return;
      }

      const name = ((data.name as string) || '').trim();
      const phone = normalizePhone((data.phone as string) || '');
      const existing = allGarages.find(g => (phone && g.phone === phone) || g.name === name);
      if (existing) {
        showToast(APP_TEXT.ADMIN.DUPLICATE_ERROR, 'error');
        setIsLoading(false);
        return;
      }

      const result = await firestoreServiceV2.createGarage(data);

      if (result.success) {
        showToast(delegate ? 'تم إرسال طلب إنشاء الجراج بنجاح بانتظار موافقة الإدارة' : APP_TEXT.ADMIN.ADD_SUCCESS);
        form.reset();
        closeKeyboard();
      } else {
        showToast(result.error || 'حدث خطأ أثناء إنشاء الجراج', 'error');
      }
    } catch (err: any) {
      console.error('createNewGarage error:', err);
      showToast(err.message || 'حدث خطأ أثناء إنشاء الجراج', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, currentSupervisor, delegate, allGarages, packages, showToast, closeKeyboard]);

  const addDelegate = useCallback((data: any) => firestoreService.addDelegate(data), []);
  const removeDelegate = useCallback((id: string) => firestoreService.removeDelegate(id), []);

  return {
    user,
    setUser,
    isAuthReady,
    isLandscapeMobile,
    view,
    setView,
    garage,
    setGarage,
    delegate,
    setDelegate,
    delegates,
    vehicles,
    todayTransactions,
    allGarages,
    packages,
    adminPin,
    setAdminPin,
    activeAdminPin,
    walletNumber,
    subscriptionPrices,
    loginPhone,
    setLoginPhone,
    showCheckInModal,
    setShowCheckInModal,
    showCheckOutModal,
    setShowCheckOutModal,
    selectedVehicle,
    setSelectedVehicle,
    newPlateNumber,
    setNewPlateNumber,
    plateInputRef,
    isLoading,
    setIsLoading,
    loadingType,
    setLoadingType,
    selectedGarageForDetails,
    setSelectedGarageForDetails,
    selectedDelegateForDetails,
    setSelectedDelegateForDetails,
    showDeleteConfirm,
    setShowDeleteConfirm,
    garageDeletionProgress,
    showLogoutConfirm,
    setShowLogoutConfirm,
    showPackages,
    setShowPackages,
    showStaffStats,
    setShowStaffStats,
    showSubscribers,
    setShowSubscribers,
    currentSupervisor,
    supervisors,
    isInputFocused,
    setIsInputFocused,
    staffList,
    rechargeRequests,
    delegateRequests,
    currentStaff,
    setCurrentStaff,
    sessionId,
    toast,
    setToast,
    showRecentExitWarning,
    setShowRecentExitWarning,
    recentVehicle,
    setRecentVehicle,
    showSubscriberWarning,
    setShowSubscriberWarning,
    subscriberWarningPlate,
    setSubscriberWarningPlate,
    pendingCheckInType,
    setPendingCheckInType,
    now,
    isOnline,
    showOfflineScreen,
    inputRef,
    sortedPackages,
    delegateGarages,
    showToast,
    handleLogout,
    handleInitiateLogout,
    closeKeyboard,
    handleGarageLogin,
    handleDelegateLogin,
    handleDelegateRecharge,
    handleCheckIn,
    confirmCheckOut,
    handleDeleteVehicle,
    deleteGarage,
    updateGarageRate,
    createNewGarage,
    addDelegate,
    removeDelegate
  };
}
