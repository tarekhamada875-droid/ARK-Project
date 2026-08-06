import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Timestamp, serverTimestamp, onSnapshot, doc, collection, query, where, limit, getDocs, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { APP_TEXT, ADMIN_PIN } from '../constants';
import { firestoreService } from '../services/firestoreService';
import { Garage, Vehicle, Package, Staff, RechargeRequest, Supervisor, GeneralManager } from '../types';
import { 
  safeDate, 
  getRawPlate, 
  formatPlateNumber, 
  calculateCost,
  normalizeDigits, 
  normalizePhone,
  getStorage,
  isSessionActive
} from '../utils';
import { useLocalStorageState } from './useLocalStorage';
import { useOnlineStatus } from './useOnlineStatus';
import { useServerTime } from './useServerTime';
import { soundManager } from '../utils/sounds';

const CURRENT_VERSION = '1.0.4';

export function useGarageApp() {
  // Clear App Cache upon Version Updates
  useEffect(() => {
    try {
      const savedVersion = localStorage.getItem('app_version');
      if (savedVersion && savedVersion !== CURRENT_VERSION) {
        console.log('Version mismatch, updating...');
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
  const [view, setView] = useLocalStorageState<'login' | 'garage' | 'admin_login' | 'admin_dashboard' | 'admin_garage_details' | 'admin_delegate_details' | 'delegate_login' | 'delegate_dashboard' | 'packages' | 'staff_stats' | 'general_manager_dashboard'>('app_view', 'login');
  const [garage, setGarage] = useLocalStorageState<Garage | null>('app_garage', null);
  const [delegate, setDelegate] = useLocalStorageState<any | null>('app_delegate', null);
  const [delegates, setDelegates] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [todayTransactions, setTodayTransactions] = useState<Vehicle[]>([]);
  const [allGarages, setAllGarages] = useState<Garage[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [adminPin, setAdminPin] = useLocalStorageState<string>('app_admin_pin', '');
  const [activeAdminPin, setActiveAdminPin] = useState<string>(ADMIN_PIN);
  const [walletNumber, setWalletNumber] = useLocalStorageState<string>('app_wallet_number', '015 - 524 - 113 - 23');
  const [subscriptionPrices, setSubscriptionPrices] = useState<{ weekly: number; monthly: number; weeklyDiscount?: number; monthlyDiscount?: number }>({ weekly: 800, monthly: 3000 });
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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showPackages, setShowPackages] = useLocalStorageState<boolean>('app_show_packages', false);
  const [showStaffStats, setShowStaffStats] = useLocalStorageState<boolean>('app_show_staff_stats', false);
  const [showSubscribers, setShowSubscribers] = useLocalStorageState<boolean>('app_show_subscribers', false);
  
  const [currentSupervisor, setCurrentSupervisor] = useLocalStorageState<Supervisor | null>('app_supervisor', null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [currentGeneralManager, setCurrentGeneralManager] = useLocalStorageState<GeneralManager | null>('app_general_manager', null);
  const [generalManagers, setGeneralManagers] = useState<GeneralManager[]>([]);

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showRecentExitWarning, setShowRecentExitWarning] = useState(false);
  const [recentVehicle, setRecentVehicle] = useState<Vehicle | null>(null);
  const [showSubscriberWarning, setShowSubscriberWarning] = useState(false);
  const [subscriberWarningPlate, setSubscriberWarningPlate] = useState('');
  const [pendingCheckInType, setPendingCheckInType] = useState<'hourly' | 'overnight' | null>(null);

  const [isWaitingForApproval, setIsWaitingForApproval] = useState<boolean>(false);
  const [pendingApprovalRequest, setPendingApprovalRequest] = useState<{
    id: string;
    collection: 'garages' | 'staff' | 'delegates' | 'supervisors' | 'general_managers';
    pendingSessionId: string;
    name: string;
  } | null>(null);

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
    });
    return () => unsub();
  }, [isSessionReady, garage?.id]);

  const loadGarageData = useCallback(async (garageId: string) => {
    try {
      const staff = await firestoreService.getStaffByGarageOnce(garageId);
      setStaffList(staff);
    } catch (err) {
      console.error('Failed to load garage data:', err);
    }
  }, [setStaffList]);

  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => a.price - b.price);
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

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success', silent: boolean = false) => {
    if (type === 'error' && !silent) soundManager.play('error');
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const handleLogout = useCallback(async (isRemoteKicked: boolean = false) => {
    try {
      if (auth.currentUser) {
        const myUid = auth.currentUser.uid;
        await Promise.all([
          deleteDoc(doc(db, 'admin_sessions', myUid)),
          deleteDoc(doc(db, 'supervisor_sessions', myUid)),
          deleteDoc(doc(db, 'general_manager_sessions', myUid)),
          deleteDoc(doc(db, 'delegate_sessions', myUid)),
          deleteDoc(doc(db, 'garage_sessions', myUid)),
          deleteDoc(doc(db, 'staff_sessions', myUid)),
        ]).catch(err => console.warn('Clean security sessions failed:', err));
      }
      if (!isRemoteKicked) {
        if (garage) firestoreService.updateSession('garages', garage.id, null);
        if (currentStaff) firestoreService.updateSession('staff', currentStaff.id, null);
        if (delegate) firestoreService.updateSession('delegates', delegate.id, null);
        if (currentSupervisor) firestoreService.updateSession('supervisors', currentSupervisor.id, null);
        if (currentGeneralManager) firestoreService.updateSession('general_managers', currentGeneralManager.id, null);
      }
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('app_')) {
          localStorage.removeItem(key);
        }
      });
      setGarage(null);
      setDelegate(null);
      setCurrentStaff(null);
      setCurrentSupervisor(null);
      setCurrentGeneralManager(null);
      setVehicles([]);
      setTodayTransactions([]);
      setStaffList([]);
      setLoginPhone('');
      setAdminPin('');
      setPendingApprovalRequest(null);
      setIsWaitingForApproval(false);
      setView('login');
      setShowLogoutConfirm(false);
    }
  }, [garage?.id, currentStaff?.id, delegate?.id, currentSupervisor?.id, currentGeneralManager?.id]);

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

  // Auth States Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
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
          await setDoc(doc(db, 'admin_sessions', user.uid), { pin: activeAdminPin, createdAt: serverTimestamp() });
          if (adminPin !== activeAdminPin) {
            setAdminPin(activeAdminPin);
          }
          try {
            await getDoc(doc(db, 'admin_sessions', user.uid));
          } catch (tempErr: any) {
            console.error('Failed to read back admin session:', tempErr);
            showToast('تنبيه: فشل قراءة جلسة المدير النشطة. التفاصيل: ' + (tempErr?.message || tempErr), 'error');
          }
        } else if (view.startsWith('admin_') && currentSupervisor) {
          await setDoc(doc(db, 'supervisor_sessions', user.uid), { supervisorId: currentSupervisor.id, pin: currentSupervisor.pin, createdAt: serverTimestamp() });
        } else if (view === 'general_manager_dashboard' && currentGeneralManager) {
          await setDoc(doc(db, 'general_manager_sessions', user.uid), { generalManagerId: currentGeneralManager.id, pin: currentGeneralManager.pin, createdAt: serverTimestamp() });
        } else if (view === 'delegate_dashboard' && delegate) {
          await setDoc(doc(db, 'delegate_sessions', user.uid), { delegateId: delegate.id, pin: delegate.pin, createdAt: serverTimestamp() });
        } else if (view === 'garage') {
          if (currentStaff) {
            await setDoc(doc(db, 'staff_sessions', user.uid), { staffId: currentStaff.id, pin: currentStaff.pin, garageId: currentStaff.garageId, createdAt: serverTimestamp() });
          } else if (garage) {
            await setDoc(doc(db, 'garage_sessions', user.uid), { garageId: garage.id, pin: garage.pin || '', phone: garage.phone || '', createdAt: serverTimestamp() });
          }
        }
        setIsSessionReady(true);
      } catch (err: any) {
        console.warn('Silent security session recovery deferred:', err);
        if (normalizeDigits(adminPin) === activeAdminPin) {
          showToast('تنبيه أمني: فشل مزامنة جلسة المدير، يرجى إعادة الدخول. التفاصيل: ' + (err?.message || err), 'error');
        }
        setIsSessionReady(true);
      }
    };

    syncSecuritySession();
  }, [isAuthReady, user, view, adminPin, activeAdminPin, delegate, garage, currentStaff, currentSupervisor, currentGeneralManager, showToast]);

  // Sync global collections
  useEffect(() => {
    if (!isSessionReady || !isAuthReady || !user || (view !== 'admin_dashboard' && view !== 'admin_garage_details' && view !== 'admin_delegate_details' && view !== 'garage' && view !== 'delegate_dashboard' && view !== 'general_manager_dashboard')) return;

    const unsubGarages = (view === 'admin_dashboard' || view === 'admin_garage_details' || view === 'delegate_dashboard' || view === 'general_manager_dashboard') 
      ? firestoreService.subscribeToGarages(setAllGarages)
      : () => {};
    
    const unsubDelegates = (view === 'admin_dashboard' || view === 'admin_delegate_details')
      ? firestoreService.subscribeToDelegates(setDelegates)
      : () => {};

    const unsubSupervisors = (view === 'admin_dashboard')
      ? firestoreService.subscribeToSupervisors(setSupervisors)
      : () => {};

    const unsubGeneralManagers = (view === 'admin_dashboard')
      ? firestoreService.subscribeToGeneralManagers(setGeneralManagers)
      : () => {};

    const unsubPackages = firestoreService.subscribeToPackages(setPackages);
    
    return () => {
      unsubGarages();
      unsubDelegates();
      unsubSupervisors();
      unsubGeneralManagers();
      unsubPackages();
    };
  }, [isSessionReady, isAuthReady, user, view]);

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
            
            if (data.isMonthlyGiftEnabled && data.monthlyGiftAmount && data.monthlyGiftAmount > 0) {
              const currentMonth = new Date().toISOString().slice(0, 7);
              if (data.lastGiftMonth !== currentMonth) {
                firestoreService.awardMonthlyGift(data.id, currentMonth, data.monthlyGiftAmount);
              }
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
    const isDashboardView = view === 'garage' || view === 'delegate_dashboard' || view === 'general_manager_dashboard' || (view.startsWith('admin_') && currentSupervisor);
    if (!isDashboardView) return;

    let id: string | null = null;
    let collectionName: 'garages' | 'staff' | 'delegates' | 'supervisors' | 'general_managers' | null = null;

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
    } else if (view === 'general_manager_dashboard' && currentGeneralManager) {
      id = currentGeneralManager.id;
      collectionName = 'general_managers';
    }

    if (!id || !collectionName) return;
    let heartbeatTimer: any;

    const syncSession = async () => {
      try {
        if (collectionName) await firestoreService.updateSession(collectionName, id!, sessionId);
      } catch (err) {
        console.error('Session sync failed:', err);
      }
    };

    const unsubscribe = onSnapshot(doc(db, collectionName, id), (snapshot) => {
      if (!snapshot.exists()) {
        showToast('عذراً، تم حذف أو تعطيل هذا الحساب من قبل مدير النظام.', 'error');
        handleLogout(true);
        return;
      }
      const data = snapshot.data();

      if (data.currentSessionId && data.currentSessionId !== sessionId) {
        showToast('تم تسجيل الدخول من جهاز آخر وإغلاق الجلسة هنا.', 'error');
        handleLogout(true);
        return;
      }
      
      let currentOffset = serverTimeOffset;
      if (!snapshot.metadata.hasPendingWrites && data.lastActive) {
        const d = safeDate(data.lastActive);
        const serverTime = d.getTime();
        const localTime = Date.now();
        currentOffset = serverTime - localTime;
        setServerTimeOffset(currentOffset);
      }
    });

    const unsubRequests = onSnapshot(doc(db, 'login_requests', id), (snapshot) => {
      if (snapshot.exists()) {
        const reqData = snapshot.data();
        if (reqData.status === 'pending' && reqData.pendingSessionId !== sessionId) {
          setPendingApprovalRequest({
            id: id!,
            collection: collectionName!,
            pendingSessionId: reqData.pendingSessionId,
            name: reqData.pendingSessionName || 'مستخدم جديد'
          });
          return;
        }
      }
      setPendingApprovalRequest(null);
    });

    syncSession();
    heartbeatTimer = setInterval(syncSession, 120000);

    return () => {
      unsubscribe();
      unsubRequests();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [view, garage?.id, currentStaff?.id, delegate?.id, currentSupervisor?.id, currentGeneralManager?.id, sessionId]);

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

  const initiateSessionRequest = useCallback(async (
    collectionName: 'garages' | 'staff' | 'delegates' | 'supervisors' | 'general_managers',
    id: string,
    _targetData: any,
    onSuccess: () => Promise<void> | void
  ) => {
    try {
      setIsWaitingForApproval(true);
      
      await setDoc(doc(db, 'login_requests', id), {
        pendingSessionId: sessionId,
        status: 'pending',
        timestamp: serverTimestamp(),
        pendingSessionName: _targetData.name || 'مستخدم جديد',
        collectionName
      });

      let timeoutTimer: any = null;

      const unsub = onSnapshot(doc(db, 'login_requests', id), async (snapshot) => {
        if (!snapshot.exists()) return;
        const data = snapshot.data();
        if (data.pendingSessionId !== sessionId) return;

        if (data.status === 'approved') {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          unsub();
          setIsWaitingForApproval(false);
          await deleteDoc(doc(db, 'login_requests', id)).catch(err => console.error(err));
          await onSuccess();
        } else if (data.status === 'rejected') {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          unsub();
          setIsWaitingForApproval(false);
          showToast('تم رفض طلب تسجيل الدخول من الجهاز النشط حالياً.', 'error');
          await deleteDoc(doc(db, 'login_requests', id)).catch(err => console.error(err));
        }
      });

      timeoutTimer = setTimeout(async () => {
        unsub();
        setIsWaitingForApproval(false);
        showToast('انتهت مهلة الانتظار. يرجى المحاولة لاحقاً أو التأكد من استجابة الجهاز المعني.', 'error');
        try {
          const docRef = doc(db, 'login_requests', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().pendingSessionId === sessionId) {
            await deleteDoc(docRef).catch(err => console.error(err));
          }
        } catch (err) {
          console.error(err);
        }
      }, 45000);

      (window as any)._cancelSessionRequest = async () => {
        clearTimeout(timeoutTimer);
        unsub();
        setIsWaitingForApproval(false);
        try {
          const docRef = doc(db, 'login_requests', id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists() && docSnap.data().pendingSessionId === sessionId) {
            await deleteDoc(docRef).catch(err => console.error(err));
          }
        } catch (err) {
          console.error(err);
        }
      };

      (window as any)._forceTakeoverSession = async () => {
        clearTimeout(timeoutTimer);
        unsub();
        setIsWaitingForApproval(false);
        setIsLoading(true);
        try {
          await setDoc(doc(db, 'login_requests', id), {
            status: 'approved'
          }, { merge: true }).catch(err => console.warn(err));
          await deleteDoc(doc(db, 'login_requests', id)).catch(err => console.warn(err));
          await onSuccess();
        } catch (err) {
          console.error('Failed to force takeover:', err);
          showToast('فشل سحب الجلسة. يرجى إعادة المحاولة.', 'error');
        } finally {
          setIsLoading(false);
        }
      };

    } catch (err) {
      console.error('Failed to initiate request:', err);
      setIsWaitingForApproval(false);
      showToast('عفواً، فشل إرسال طلب تسجيل الدخول إلى الجهاز المعني.', 'error');
    }
  }, [sessionId, showToast]);

  const handleAcceptApprovalRequest = useCallback(async () => {
    if (!pendingApprovalRequest) return;
    const { id, collection: col, pendingSessionId } = pendingApprovalRequest;
    try {
      await setDoc(doc(db, 'login_requests', id), {
        status: 'approved'
      }, { merge: true });

      await updateDoc(doc(db, col, id), {
        currentSessionId: pendingSessionId
      });

      showToast('تم قبول طلب الدخول بنجاح.', 'success');
      setPendingApprovalRequest(null);
      await handleLogout(true);
    } catch (err) {
      console.error('Failed to accept session request:', err);
      showToast('حدث خطأ أثناء الموافقة على الدخول الجديد.', 'error');
    }
  }, [pendingApprovalRequest, showToast, handleLogout]);

  const handleRejectApprovalRequest = useCallback(async () => {
    if (!pendingApprovalRequest) return;
    const { id } = pendingApprovalRequest;
    try {
      await setDoc(doc(db, 'login_requests', id), {
        status: 'rejected'
      }, { merge: true });

      setPendingApprovalRequest(null);
      showToast('تم رفض محاولة الدخول وإبقاء الحساب نشطاً هنا.', 'success');
    } catch (err) {
      console.error('Failed to reject session request:', err);
      showToast('حدث خطأ أثناء رفض الدخول الجديد.', 'error');
    }
  }, [pendingApprovalRequest, showToast]);

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
          await setDoc(doc(db, 'admin_sessions', auth.currentUser.uid), { pin: activeAdminPin, createdAt: serverTimestamp() });
        } catch (err) {
          console.error("Failed to write admin security session:", err);
        }
      }
      setAdminPin(activeAdminPin);
      setView('admin_dashboard');
      return;
    }

    setIsLoading(true);
    const minLoadingDelay = new Promise(resolve => setTimeout(resolve, 5000));
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
        // General Manager check
        const gmSnap = await getDocs(query(collection(db, 'general_managers'), where('pin', '==', normalizedInput), limit(1)));
        if (!gmSnap.empty) {
          const gmData = { id: gmSnap.docs[0].id, ...gmSnap.docs[0].data() } as GeneralManager;

          const proceed = async () => {
            if (auth.currentUser) {
              await setDoc(doc(db, 'general_manager_sessions', auth.currentUser.uid), { generalManagerId: gmData.id, pin: gmData.pin, createdAt: serverTimestamp() });
            }
            await firestoreService.updateGeneralManagerSession(gmData.id, sessionId);
            await minLoadingDelay;
            setCurrentGeneralManager(gmData);
            setView('general_manager_dashboard');
            showToast(`مرحباً بك يا ${gmData.name} (مالك النظام)`);
          };

          if (gmData.currentSessionId && gmData.currentSessionId !== sessionId && isSessionActive(gmData.lastActive, currentOffset)) {
            await initiateSessionRequest('general_managers', gmData.id, gmData, proceed);
            return 'blocked';
          }

          await proceed();
          return true;
        }

        // Supervisor check
        const supervisorSnap = await getDocs(query(collection(db, 'supervisors'), where('pin', '==', normalizedInput), limit(1)));
        if (!supervisorSnap.empty) {
          const supervisorData = { id: supervisorSnap.docs[0].id, ...supervisorSnap.docs[0].data() } as Supervisor;

          const proceed = async () => {
            if (auth.currentUser) {
              await setDoc(doc(db, 'supervisor_sessions', auth.currentUser.uid), { supervisorId: supervisorData.id, pin: supervisorData.pin, createdAt: serverTimestamp() });
            }
            await firestoreService.updateSupervisorSession(supervisorData.id, sessionId);
            await minLoadingDelay;
            setCurrentSupervisor(supervisorData);
            setView('admin_dashboard');
            showToast(`مرحباً بك يا ${supervisorData.name} (مشرف)`);
          };

          if (supervisorData.currentSessionId && supervisorData.currentSessionId !== sessionId && isSessionActive(supervisorData.lastActive, currentOffset)) {
            await initiateSessionRequest('supervisors', supervisorData.id, supervisorData, proceed);
            return 'blocked';
          }

          await proceed();
          return true;
        }

        // Delegate check
        const delegateSnap = await getDocs(query(collection(db, 'delegates'), where('pin', '==', normalizedInput), limit(1)));
        if (!delegateSnap.empty) {
          const delegateData = { id: delegateSnap.docs[0].id, ...delegateSnap.docs[0].data() } as any;

          const proceed = async () => {
            if (auth.currentUser) {
              await setDoc(doc(db, 'delegate_sessions', auth.currentUser.uid), { delegateId: delegateData.id, pin: delegateData.pin, createdAt: serverTimestamp() });
            }
            await firestoreService.updateDelegateSession(delegateData.id, sessionId);
            await minLoadingDelay;
            setDelegate(delegateData);
            setView('delegate_dashboard');
            showToast(`مرحباً بك يا ${delegateData.name}`);
          };

          if (delegateData.currentSessionId && delegateData.currentSessionId !== sessionId && isSessionActive(delegateData.lastActive, currentOffset)) {
            await initiateSessionRequest('delegates', delegateData.id, delegateData, proceed);
            return 'blocked';
          }

          await proceed();
          return true;
        }

        // Staff check
        const staffSnap = await getDocs(query(collection(db, 'staff'), where('pin', '==', normalizedInput), limit(1)));
        if (!staffSnap.empty) {
          const staffData = { id: staffSnap.docs[0].id, ...staffSnap.docs[0].data() } as any;

          const proceed = async () => {
            const gSnap = await getDoc(doc(db, 'garages', staffData.garageId));
            if (gSnap.exists()) {
              const linkedGarage = { id: gSnap.id, ...gSnap.data() } as Garage;
              if (linkedGarage.status === 'pending' || linkedGarage.status === 'rejected') {
                showToast('عذراً، هذا الجراج قيد المراجعة والإنشاء من قبل الإدارة. يرجى الانتظار حتى تتم الموافقة عليه.', 'error');
                return;
              }

              if (auth.currentUser) {
                await setDoc(doc(db, 'staff_sessions', auth.currentUser.uid), { staffId: staffData.id, pin: staffData.pin, garageId: staffData.garageId, createdAt: serverTimestamp() });
              }
              await firestoreService.updateStaffSession(staffData.id, sessionId);

              // Fetch fresh server data & wait for min 5s loading delay
              const [activeV, todayT, sList] = await Promise.all([
                firestoreService.getVehiclesInsideOnce(linkedGarage.id),
                firestoreService.getTodayTransactionsOnce(linkedGarage.id),
                firestoreService.getStaffByGarageOnce(linkedGarage.id),
                minLoadingDelay
              ]);

              setVehicles(activeV);
              setTodayTransactions(todayT);
              setStaffList(sList);
              setGarage(linkedGarage);
              setCurrentStaff(staffData);
              setView('garage');
              showToast(`مرحباً بك يا ${staffData.name}`);
            }
          };

          if (staffData.currentSessionId && staffData.currentSessionId !== sessionId && isSessionActive(staffData.lastActive, currentOffset)) {
            await initiateSessionRequest('staff', staffData.id, staffData, proceed);
            return 'blocked';
          }

          await proceed();
          return true;
        }

        // Owner PIN check
        const garageSnapByPin = await getDocs(query(collection(db, 'garages'), where('pin', '==', normalizedInput), limit(1)));
        if (!garageSnapByPin.empty) {
          const garageData = { id: garageSnapByPin.docs[0].id, ...garageSnapByPin.docs[0].data() } as any;
          if (garageData.status === 'pending' || garageData.status === 'rejected') {
            showToast('عذراً، هذا الجراج قيد المراجعة والإنشاء من قبل الإدارة. يرجى الانتظار حتى تتم الموافقة عليه.', 'error');
            return 'blocked';
          }

          const proceed = async () => {
            if (auth.currentUser) {
              await setDoc(doc(db, 'garage_sessions', auth.currentUser.uid), { garageId: garageData.id, pin: garageData.pin, phone: garageData.phone || '', createdAt: serverTimestamp() });
            }
            await firestoreService.updateGarageSession(garageData.id, sessionId);

            // Fetch fresh server data & wait for min 5s loading delay
            const [activeV, todayT, sList] = await Promise.all([
              firestoreService.getVehiclesInsideOnce(garageData.id),
              firestoreService.getTodayTransactionsOnce(garageData.id),
              firestoreService.getStaffByGarageOnce(garageData.id),
              minLoadingDelay
            ]);

            setVehicles(activeV);
            setTodayTransactions(todayT);
            setStaffList(sList);
            setGarage(garageData);
            setCurrentStaff(null);
            setView('garage');
          };

          if (garageData.currentSessionId && garageData.currentSessionId !== sessionId && isSessionActive(garageData.lastActive, currentOffset)) {
            await initiateSessionRequest('garages', garageData.id, garageData, proceed);
            return 'blocked';
          }

          await proceed();
          return true;
        }

        // Owner Phone check
        const normalizedPhoneInput = normalizePhone(normalizedInput);
        const garageSnapByPhone = await getDocs(query(collection(db, 'garages'), where('phone', '==', normalizedPhoneInput || normalizedInput), limit(1)));
        if (!garageSnapByPhone.empty) {
          const garageData = { id: garageSnapByPhone.docs[0].id, ...garageSnapByPhone.docs[0].data() } as any;
          if (garageData.status === 'pending' || garageData.status === 'rejected') {
            showToast('عذراً، هذا الجراج قيد المراجعة والإنشاء من قبل الإدارة. يرجى الانتظار حتى تتم الموافقة عليه.', 'error');
            return 'blocked';
          }

          const proceed = async () => {
            if (auth.currentUser) {
              await setDoc(doc(db, 'garage_sessions', auth.currentUser.uid), { garageId: garageData.id, pin: garageData.pin, phone: garageData.phone || '', createdAt: serverTimestamp() });
            }
            await firestoreService.updateGarageSession(garageData.id, sessionId);

            // Fetch fresh server data & wait for min 5s loading delay
            const [activeV, todayT, sList] = await Promise.all([
              firestoreService.getVehiclesInsideOnce(garageData.id),
              firestoreService.getTodayTransactionsOnce(garageData.id),
              firestoreService.getStaffByGarageOnce(garageData.id),
              minLoadingDelay
            ]);

            setVehicles(activeV);
            setTodayTransactions(todayT);
            setStaffList(sList);
            setGarage(garageData);
            setCurrentStaff(null);
            setView('garage');
          };

          if (garageData.currentSessionId && garageData.currentSessionId !== sessionId && isSessionActive(garageData.lastActive, currentOffset)) {
            await initiateSessionRequest('garages', garageData.id, garageData, proceed);
            return 'blocked';
          }

          await proceed();
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
      const delegateData = await firestoreService.getDelegateByPhone(normalizedPhone);
      if (!delegateData) {
        showToast('رقم الموبايل غير مسجل كمندوب', 'error');
      } else if (delegateData.pin !== pin) {
        showToast('رمز الدخول غير صحيح', 'error');
      } else {
        const proceed = async () => {
          if (auth.currentUser) {
            await setDoc(doc(db, 'delegate_sessions', auth.currentUser.uid), { delegateId: delegateData.id, pin: delegateData.pin, createdAt: serverTimestamp() });
          }
          await firestoreService.updateDelegateSession(delegateData.id, sessionId);
          setDelegate(delegateData);
          setView('delegate_dashboard');
          showToast(`مرحباً بك يا ${delegateData.name}`);
        };

        if (delegateData.currentSessionId && delegateData.currentSessionId !== sessionId && isSessionActive(delegateData.lastActive, currentOffset)) {
          await initiateSessionRequest('delegates', delegateData.id, delegateData, proceed);
          setIsLoading(false);
          return;
        }

        await proceed();
      }
    } catch (error) {
      // Handled
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, sessionId, showToast, fetchServerTimeOffset]);

  const handleDelegateRecharge = useCallback(async (garageId: string, amount: number, pkg?: Package, discountInfo?: { couponCode?: string; discountAmount?: number; originalRevenueAmount?: number }) => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    try {
      const g = allGarages.find(gar => gar.id === garageId);
      if (!g || !delegate) return;

      const pendingRequests = await firestoreService.getPendingRechargeRequestsForGarage(garageId);
      if (pendingRequests.length > 0) {
        showToast('يوجد طلب شحن معلق بالفعل لهذا الجراج', 'error');
        return;
      }
      
      const commission = Math.max(g.commissionPerVehicle || 1, 1);
      const carsToMove = pkg ? pkg.vehiclesCount : Math.floor(amount / commission);
      const balanceIncrement = pkg ? (pkg.vehiclesCount * commission) : amount;
      let revenueIncrement = pkg ? pkg.price : amount;
      const originalRev = discountInfo?.originalRevenueAmount !== undefined ? discountInfo.originalRevenueAmount : revenueIncrement;

      if (discountInfo?.discountAmount && discountInfo.discountAmount > 0) {
        revenueIncrement = Math.max(0, revenueIncrement - discountInfo.discountAmount);
      }

      if (g.hasMonthlySubscribers) {
        revenueIncrement = Math.round(revenueIncrement * 1.25);
      }

      const rechargePayload: any = {
        garageId: garageId,
        garageName: g.name,
        delegateId: delegate.id,
        delegateName: delegate.name,
        packageId: pkg?.id || 'custom',
        packageName: pkg?.name || 'مبلغ مخصص',
        amount: balanceIncrement,
        carsCount: carsToMove,
        revenueAmount: revenueIncrement,
        originalRevenueAmount: originalRev,
        discountAmount: discountInfo?.discountAmount || 0
      };
      if (discountInfo?.couponCode) {
        rechargePayload.couponCode = discountInfo.couponCode;
      }

      await firestoreService.createRechargeRequest(rechargePayload);
    } catch (error) {
      showToast('فشل في إرسال طلب الشحن', 'error');
      throw error;
    }
  }, [isOnline, allGarages, delegate, showToast]);

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

    const commissionVal = (garage.commissionPerVehicle !== undefined) ? garage.commissionPerVehicle : 1;
    let isSubscriber = false;
    
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

    if (isSubscriber) {
      setSubscriberWarningPlate(formatted);
      setShowSubscriberWarning(true);
      setShowCheckInModal(false);
      setNewPlateNumber('');
      soundManager.play('error');
      return;
    }

    const isGarageSubscription = garage.billingModel === 'subscription';
    let isGarageSubscriptionExpired = false;
    if (isGarageSubscription) {
      if (!garage.balanceExpiry) {
        isGarageSubscriptionExpired = true;
      } else {
        const expiryDate = garage.balanceExpiry.toDate ? garage.balanceExpiry.toDate() : new Date(garage.balanceExpiry);
        isGarageSubscriptionExpired = expiryDate < new Date();
      }
    }

    if (isGarageSubscription && isGarageSubscriptionExpired) {
      showToast('عفواً، انتهى اشتراك الجراج. يرجى تجديد الاشتراك.', 'error');
      return;
    }

    if (!isGarageSubscription && !isSubscriber && (garage.balance || 0) < commissionVal) {
      showToast('عفواً، الرصيد لا يكفي. يرجى الشحن.', 'error');
      return;
    }

    setIsLoading(true);
    setLoadingType(type);
    setNewPlateNumber('');
    soundManager.play('checkIn');
    
    try {
      await firestoreService.checkInVehicle(garage.id, {
        plateNumber: formatted,
        plateNumberRaw: raw,
        entryTime: serverTimestamp() as any,
        type: type,
        garageId: garage.id,
        status: 'inside',
        staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
        isSubscriber: isSubscriber
      }, (isGarageSubscription || isSubscriber) ? 0 : commissionVal);

      firestoreService.addActivityLog({
        garageId: garage.id,
        staffId: currentStaff ? currentStaff.id : null,
        staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
        actionType: 'check_in',
        plateNumber: formatted,
        timestamp: serverTimestamp() as any
      }).catch(err => console.warn('CheckIn activity log error:', err));

      const newVehicleObj: Vehicle = {
        id: raw,
        plateNumber: formatted,
        plateNumberRaw: raw,
        entryTime: new Date() as any,
        type: type,
        garageId: garage.id,
        status: 'inside',
        staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
        isSubscriber: isSubscriber
      };
      setVehicles(prev => [newVehicleObj, ...prev.filter(v => v.id !== raw)]);

      // showToast('تم تسجيل دخول السيارة بنجاح', 'success');
      setShowCheckInModal(false);
    } catch (error: any) {
      let message = error?.message || '';
      if (message.startsWith('{') && message.endsWith('}')) {
        try {
          const detailed = JSON.parse(message);
          message = detailed.error || message;
        } catch (e) {}
      }

      if (message === 'ALREADY_INSIDE') {
        showToast('هذه السيارة موجودة بالفعل بالداخل (تم رصدها من جهاز آخر)', 'error');
      } else {
        setNewPlateNumber(formatted);
        showToast('حدث خطأ أثناء الدخول، تأكد من الاتصال بالإنترنت', 'error');
      }
    } finally {
      setIsLoading(false);
      setLoadingType(null);
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

    setIsLoading(true);
    setLoadingType('checkout');
    soundManager.play('checkOut');
    
    try {
      const cost = calculateCost(vehicleToOut, garage, now);

      await firestoreService.checkOutVehicle(garage.id, vehicleToOut.id, cost);
      
      firestoreService.addActivityLog({
        garageId: garage.id,
        staffId: currentStaff ? currentStaff.id : null,
        staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
        actionType: 'check_out',
        plateNumber: vehicleToOut.plateNumber,
        timestamp: serverTimestamp() as any
      }).catch(err => console.warn('CheckOut activity log error:', err));

      setVehicles(prev => prev.filter(v => v.id !== vehicleToOut.id));
      setShowCheckOutModal(false);
      setSelectedVehicle(null);
      setNewPlateNumber('');
      // showToast('تم تسجيل خروج السيارة بنجاح', 'success');
    } catch (error: any) {
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
  }, [isOnline, garage, selectedVehicle, isLoading, closeKeyboard, currentStaff, showToast]);

  const handleDeleteVehicle = useCallback(async () => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى إعادة المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!garage || !selectedVehicle) return;

    if (isLoading || deletingVehicleRef.current === selectedVehicle.id) {
      return;
    }

    deletingVehicleRef.current = selectedVehicle.id;
    setIsLoading(true);
    setLoadingType('delete');
    soundManager.play('checkOut');

    const entryDate = selectedVehicle.entryTime ? safeDate(selectedVehicle.entryTime) : new Date();
    const diffMs = Date.now() - entryDate.getTime();
    const isWithinFiveMinutes = diffMs <= 300000;
    const isOverOneDay = diffMs > 86400000;

    setShowCheckOutModal(false);
    setShowDeleteConfirm(false);

    try {
      const isGarageSubscription = garage.billingModel === 'subscription';
      if (isGarageSubscription) {
        const success = await firestoreService.deleteVehicleWithRefund(garage.id, selectedVehicle.id, 0, garage.lastRefundDate || '');
        if (success) {
          await firestoreService.addActivityLog({
            garageId: garage.id,
            staffId: currentStaff ? currentStaff.id : null,
            staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
            actionType: 'delete_refund',
            plateNumber: `مسح لوحة: ${selectedVehicle.plateNumber}`,
            timestamp: serverTimestamp() as any
          });
          showToast('اللوحة اتمسحت بنجاح');
        }
      } else if (isWithinFiveMinutes && !isOverOneDay && garage.balance !== undefined) {
        const todayYMD = new Date().toISOString().split('T')[0];
        const hasLimit = (garage.dailyRefundCount || 0) < 5 || garage.lastRefundDate !== todayYMD;
        
        if (hasLimit) {
          const refundAmount = garage.commissionPerVehicle || 1;
          const newRefundCount = garage.lastRefundDate === todayYMD ? (garage.dailyRefundCount || 0) + 1 : 1;
          
          const success = await firestoreService.deleteVehicleWithRefund(
            garage.id, 
            selectedVehicle.id, 
            refundAmount, 
            todayYMD
          );
          
          if (success) {
            await firestoreService.addActivityLog({
              garageId: garage.id,
              staffId: currentStaff ? currentStaff.id : null,
              staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
              actionType: 'delete_refund',
              plateNumber: `استرداد عمولة: ${selectedVehicle.plateNumber} (محاولة ${newRefundCount}/5)`,
              timestamp: serverTimestamp() as any
            });

            const remaining = 5 - newRefundCount;
            showToast(`اللوحة الغلط اتمسحت ورصيدك رجعلك تانى\nباقى ليك ${remaining} أخطاء`);
          }
        } else {
          const success = await firestoreService.deleteVehicleWithRefund(garage.id, selectedVehicle.id, 0, todayYMD);
          
          if (success) {
            await firestoreService.addActivityLog({
              garageId: garage.id,
              staffId: currentStaff ? currentStaff.id : null,
              staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
              actionType: 'delete_refund',
              plateNumber: `حذف بدون استرداد (تجاوز الحد): ${selectedVehicle.plateNumber}`,
              timestamp: serverTimestamp() as any
            });
            
            showToast('تم الحذف بدون استرداد (وصلت للحد اليومي 5 أخطاء)', 'error', true);
          }
        }
      } else {
        if (diffMs > 300000 && diffMs < 3600000) {
          showToast('تم الحذف بدون استرداد (مر أكثر من 5 دقائق على الدخول)', 'error', true);
        }
        await firestoreService.deleteVehicleWithRefund(garage.id, selectedVehicle.id, 0, garage.lastRefundDate || '');
      }
    } catch (err) {
      console.error('Delete Vehicle Error:', err);
      showToast('فشل في حذف السيارة برصيد، جرب تانى', 'error');
    } finally {
      if (selectedVehicle) {
        setVehicles(prev => prev.filter(v => v.id !== selectedVehicle.id));
      }
      deletingVehicleRef.current = null;
      setSelectedVehicle(null);
      setNewPlateNumber('');
      setLoadingType(null);
      setIsLoading(false);
    }
  }, [isOnline, garage, selectedVehicle, currentStaff, showToast, isLoading]);

  const deleteGarage = useCallback(async (g: Garage | null) => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!g) return;
    const garageId = g.id;
    closeKeyboard();
    setIsLoading(true);
    
    setShowDeleteConfirm(false);
    setSelectedGarageForDetails(null);
    setView('admin_dashboard');

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      await firestoreService.deleteGarage(garageId);
      showToast(APP_TEXT.ADMIN.DELETE_CONFIRM);
    } catch (error) {
      showToast('فشل في حذف الجراج', 'error');
      setView('admin_dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, closeKeyboard, showToast]);

  const updateGarageRate = useCallback(async (g: Garage, field: 'hourlyRate' | 'overnightRate', value: number) => {
    try {
      await firestoreService.updateGarage(g.id, { [field]: value });
    } catch (error) {}
  }, []);

  const createNewGarage = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const name = (formData.get('name') as string || '').trim();
    const phone = normalizePhone(formData.get('phone') as string || '');
    const pin = (formData.get('pin') as string || '').trim();
    const hourlyRate = Number(normalizeDigits(formData.get('hourlyRate') as string || '0'));
    const overnightRate = Number(normalizeDigits(formData.get('overnightRate') as string || '0'));
    const initialPackageId = formData.get('initialPackageId') as string;
    const commissionPerVehicle = 1;
    const billingModel = formData.get('billingModel') as 'subscription' | 'commission' || 'commission';
    const subscriptionType = formData.get('subscriptionType') as 'weekly' | 'monthly' || 'weekly';
    const hasMonthlySubscribersRaw = formData.get('hasMonthlySubscribers');
    const hasMonthlySubscribers = hasMonthlySubscribersRaw === 'true' || hasMonthlySubscribersRaw === 'on' || hasMonthlySubscribersRaw === '1';
    const referredByGarageId = (formData.get('referredByGarageId') as string || '').trim();
    const referringGarage = referredByGarageId ? allGarages.find(g => g.id === referredByGarageId) : null;
    const referredByGarageName = referringGarage ? referringGarage.name : null;

    let initialBalance = 0;
    let initialCars = 0;
    let initialRevenue = 0;
    const expiryDate = new Date();

    if (billingModel === 'subscription') {
      const days = subscriptionType === 'weekly' ? 7 : 30;
      expiryDate.setDate(expiryDate.getDate() + days);
      let baseSubPrice = subscriptionType === 'weekly' ? subscriptionPrices.weekly : subscriptionPrices.monthly;
      const subDiscount = subscriptionType === 'weekly' ? subscriptionPrices.weeklyDiscount : subscriptionPrices.monthlyDiscount;
      if (subDiscount && subDiscount > 0) {
        baseSubPrice = Math.round(baseSubPrice * (1 - subDiscount / 100));
      }
      initialRevenue = hasMonthlySubscribers ? Math.round(baseSubPrice * 1.25) : baseSubPrice;
      initialCars = 9999;
    } else {
      expiryDate.setFullYear(expiryDate.getFullYear() + 10);
      const selectedPkg = packages.find(p => p.id === initialPackageId);
      initialBalance = selectedPkg ? (selectedPkg.vehiclesCount * commissionPerVehicle) : 0;
      initialCars = selectedPkg ? selectedPkg.vehiclesCount : 0;
      if (selectedPkg) {
        let basePkgPrice = selectedPkg.price;
        if (selectedPkg.discountValue && selectedPkg.discountValue > 0) {
          basePkgPrice = selectedPkg.discountType === 'percentage'
            ? Math.round(selectedPkg.price * (1 - selectedPkg.discountValue / 100))
            : Math.max(0, selectedPkg.price - selectedPkg.discountValue);
        }
        initialRevenue = hasMonthlySubscribers ? Math.round(basePkgPrice * 1.25) : basePkgPrice;
      } else {
        initialRevenue = 0;
      }
    }

    if (phone && (phone.length < 3 || phone.length > 20)) {
      showToast('يرجى إدخال رقم هاتف صحيح يتكون من 3 أرقام على الأقل', 'error');
      return;
    }

    setIsLoading(true);
    try {
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
      }

      const pinCheck = await firestoreService.isPinTaken(pin);
      if (pinCheck.taken) {
        showToast(`هذا الرمز السري (PIN) مستخدم بالفعل في حساب آخر: (${pinCheck.name} - ${pinCheck.role})`, 'error');
        setIsLoading(false);
        return;
      }

      const existing = allGarages.find(g => (phone && g.phone === phone) || g.name === name);
      if (existing) {
        showToast(APP_TEXT.ADMIN.DUPLICATE_ERROR, 'error');
        setIsLoading(false);
        return;
      }

      const isPending = delegate !== null;
      const actualBalance = isPending ? 0 : initialBalance;
      const actualCars = isPending ? 0 : initialCars;
      const actualRevenue = isPending ? 0 : initialRevenue;

      const newGarageDoc = await firestoreService.createGarage({
        name,
        phone,
        pin,
        hourlyRate,
        overnightRate,
        balanceExpiry: Timestamp.fromDate(expiryDate),
        createdAt: serverTimestamp(),
        balanceDays: billingModel === 'subscription' ? (subscriptionType === 'weekly' ? 7 : 30) : 3650,
        billingModel: billingModel,
        commissionPerVehicle: commissionPerVehicle,
        balance: actualBalance,
        totalRechargedCars: actualCars,
        totalAdminRevenue: actualRevenue,
        isLocked: false,
        lastBalanceDeduction: serverTimestamp(),
        createdByDelegateId: delegate?.id || null,
        createdByDelegateName: delegate?.name || null,
        referredByGarageId: referredByGarageId || null,
        referredByGarageName: referredByGarageName || null,
        hasMonthlySubscribers: hasMonthlySubscribers,
        status: isPending ? 'pending' : 'approved'
      });

      if (!isPending && newGarageDoc && newGarageDoc.id && (actualBalance > 0 || actualRevenue > 0)) {
        try {
          await firestoreService.processReferralRewardForRecharge(newGarageDoc.id);
        } catch (e) {
          console.error('Failed to award initial referral reward:', e);
        }
      }

      if (!isPending && delegate && delegate.id) {
        await firestoreService.updateDelegate(delegate.id, {
          totalRechargedAmount: (delegate.totalRechargedAmount || 0) + actualRevenue
        });
      }

      showToast(isPending ? 'تم إرسال طلب إنشاء الجراج بنجاح بانتظار موافقة الإدارة' : APP_TEXT.ADMIN.ADD_SUCCESS);
      form.reset();
      closeKeyboard();
    } catch (error) {
      console.error('Failed to create garage:', error);
      showToast('عذراً، حدث خطأ أثناء حفظ الجراج. يرجى التأكد من البيانات والمحاولة مرة أخرى.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, packages, allGarages, closeKeyboard, showToast, delegate]);

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
    currentGeneralManager,
    setCurrentGeneralManager,
    generalManagers,
    setGeneralManagers,
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
    isWaitingForApproval,
    setIsWaitingForApproval,
    pendingApprovalRequest,
    setPendingApprovalRequest,
    now,
    serverTimeOffset,
    setServerTimeOffset,
    fetchServerTimeOffset,
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
    removeDelegate,
    handleAcceptApprovalRequest,
    handleRejectApprovalRequest
  };
}
