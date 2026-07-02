/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Shield,
  WifiOff,
  Smartphone,
  RefreshCw,
} from 'lucide-react';
import { APP_TEXT, ADMIN_PIN } from './constants';
import { firestoreService } from './services/firestoreService';
import { Garage, Vehicle, Package, Staff, RechargeRequest, Supervisor } from './types';
import { 
  safeDate, 
  getRawPlate, 
  formatPlateNumber, 
  calculateCost,
  normalizeDigits, 
  normalizePhone,
  getStorage,
  isSessionActive
} from './utils';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { Timestamp, serverTimestamp, onSnapshot, doc, collection, query, where, limit, getDocs, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, User, signOut, signInAnonymously } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

import { useLocalStorageState } from './hooks/useLocalStorage';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useServerTime } from './hooks/useServerTime';
import { useBackTrapping } from './hooks/useBackTrapping';

import { AdminDashboard } from './components/admin/AdminDashboard';
import { LoginView } from './components/auth/LoginView';
import { AdminLoginView } from './components/auth/AdminLoginView';
import { DelegateLoginView } from './components/auth/DelegateLoginView';
import { DelegateDashboardView } from './components/delegate/DelegateDashboardView';
import { AdminGarageDetailsView } from './components/admin/AdminGarageDetailsView';
import { AdminDelegateDetailsView } from './components/admin/AdminDelegateDetailsView';
import { GarageDashboardView } from './components/garage/GarageDashboardView';
import { CheckInModal } from './components/modals/CheckInModal';
import { CheckOutModal } from './components/modals/CheckOutModal';
import { PackagesModal } from './components/modals/PackagesModal';
import { DeleteGarageConfirmModal } from './components/modals/DeleteGarageConfirmModal';
import { DeleteVehicleConfirmModal } from './components/modals/DeleteVehicleConfirmModal';
import { RecentExitWarningModal } from './components/modals/RecentExitWarningModal';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { SubscriberWarningModal } from './components/modals/SubscriberWarningModal';
import { soundManager } from './utils/sounds';


const CURRENT_VERSION = '1.0.4'; // زيادة رقم الإصدار عند الحاجة لتطهير الكاش

export default function App() {
  // آلية تطهير الكاش التلقائي عند تحديث الإصدار
  useEffect(() => {
    try {
      const savedVersion = localStorage.getItem('app_version');
      if (savedVersion && savedVersion !== CURRENT_VERSION) {
        console.log('Version mismatch, updating...');
        localStorage.setItem('app_version', CURRENT_VERSION);
        // Wipe specific potentially corrupted UI state items, but keep auth
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

  // كشف الوضع الأفقي على الهواتف المحمولة
  useEffect(() => {
    const checkOrientation = () => {
      // إذا كان العرض أكبر من الارتفاع وعرض الشاشة أقل من 1024 بكسل (أجهزة التابلت والهواتف)
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

  // useLocalStorageState for Persisted States
  const [view, setView] = useLocalStorageState<'login' | 'garage' | 'admin_login' | 'admin_dashboard' | 'admin_garage_details' | 'admin_delegate_details' | 'delegate_login' | 'delegate_dashboard' | 'packages' | 'staff_stats'>('app_view', 'login');
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
  const [loginPhone, setLoginPhone] = useLocalStorageState<string>('app_login_phone', '');
  const [showCheckInModal, setShowCheckInModal] = useLocalStorageState<boolean>('app_show_checkin', false);
  const [showCheckOutModal, setShowCheckOutModal] = useLocalStorageState<boolean>('app_show_checkout', false);
  const [selectedVehicle, setSelectedVehicle] = useLocalStorageState<Vehicle | null>('app_selected_vehicle', null);
  const [newPlateNumber, setNewPlateNumber] = useLocalStorageState<string>('app_new_plate', '');
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
  
  // Dashboard states
  const [adminActiveTab, setAdminActiveTab] = useLocalStorageState<'menu' | 'garages' | 'packages' | 'delegates' | 'requests' | 'reports' | 'supervisors' | 'wallet' | 'admin-pin'>('app_admin_tab', 'menu');
  const [showAdminPlansModal, setShowAdminPlansModal] = useLocalStorageState<boolean>('app_admin_plans_modal', false);
  const [showAdminOverview, setShowAdminOverview] = useLocalStorageState<boolean>('app_admin_overview', false);
  const [adminPinInput, setAdminPinInput] = useLocalStorageState<string>('app_admin_pin_input', '');
  const [adminSearch, setAdminSearch] = useLocalStorageState<string>('app_admin_search', '');
  const [adminDelegateForm, setAdminDelegateForm] = useLocalStorageState<{ name: string; phone: string; pin: string; canCreateGarage: boolean }>('app_admin_delegate_form', { 
    name: '', 
    phone: '', 
    pin: '', 
    canCreateGarage: false 
  });
  const [currentSupervisor, setCurrentSupervisor] = useLocalStorageState<Supervisor | null>('app_supervisor', null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [adminSupervisorForm, setAdminSupervisorForm] = useLocalStorageState<{ name: string; phone: string; pin: string }>('app_admin_supervisor_form', {
    name: '',
    phone: '',
    pin: ''
  });
  const [adminGarageForm, setAdminGarageForm] = useLocalStorageState<{ name: string; hourlyRate: string; overnightRate: string; phone: string; initialPackageId: string }>('app_admin_garage_form', {
    name: '',
    hourlyRate: '',
    overnightRate: '',
    phone: '',
    initialPackageId: ''
  });

  const [isInputFocused, setIsInputFocused] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [delegateRequests, setDelegateRequests] = useState<RechargeRequest[]>([]);

  // Subscribe to active vehicles directly from subcollection (Solution 5: Scalable Active Plates)
  useEffect(() => {
    if (!garage?.id) {
      setVehicles([]);
      return;
    }
    const unsub = firestoreService.subscribeToActiveVehicles(garage.id, (activeVehicles) => {
      setVehicles(activeVehicles);
    });
    return () => unsub();
  }, [garage?.id]);

  // Subscribe to today's completed transactions directly from subcollection (Solution 4: Scalable Completed Transactions)
  useEffect(() => {
    if (!garage?.id) {
      setTodayTransactions([]);
      return;
    }
    const unsub = firestoreService.subscribeToTodayTransactions(garage.id, (completedTransactions) => {
      setTodayTransactions(completedTransactions);
    });
    return () => unsub();
  }, [garage?.id]);

  const loadGarageData = useCallback(async (garageId: string) => {
    try {
      const staff = await firestoreService.getStaffByGarageOnce(garageId);
      setStaffList(staff);
    } catch (err) {
      console.error('Failed to load garage data:', err);
    }
  }, [setStaffList]);

  const [currentStaff, setCurrentStaff] = useLocalStorageState<Staff | null>('app_staff', null);
  const [sessionId] = useState(() => {
    const saved = getStorage<string>('app_session_id', '');
    if (saved) return saved;
    const newId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('app_session_id', newId);
    return newId;
  });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showRecentExitWarning, setShowRecentExitWarning] = useState(false);
  const [recentVehicle, setRecentVehicle] = useState<Vehicle | null>(null);
  const [showSubscriberWarning, setShowSubscriberWarning] = useState(false);
  const [subscriberWarningPlate, setSubscriberWarningPlate] = useState('');
  const [pendingCheckInType, setPendingCheckInType] = useState<'hourly' | 'overnight' | null>(null);

  // States for cooperative session conflict management
  const [isWaitingForApproval, setIsWaitingForApproval] = useState<boolean>(false);
  const [pendingApprovalRequest, setPendingApprovalRequest] = useState<{
    id: string;
    collection: 'garages' | 'staff' | 'delegates' | 'supervisors';
    pendingSessionId: string;
    name: string;
  } | null>(null);

  // useServerTime and useOnlineStatus hooks
  const { now, serverTimeOffset, setServerTimeOffset, fetchServerTimeOffset } = useServerTime();
  const { isOnline, showOfflineScreen } = useOnlineStatus();
  
  const inputRef = React.useRef<HTMLDivElement>(null);



  const sortedPackages = useMemo(() => {
    return [...packages].sort((a, b) => a.price - b.price);
  }, [packages]);

  const delegateGarages = useMemo(() => {
    if (!delegate) return [];
    return allGarages.filter(g => g.createdByDelegateId === delegate.id);
  }, [allGarages, delegate]);

  // Sync Recharge Requests for BOTH Admin (to approve) and Delegate (to see status)
  useEffect(() => {
    if (!isAuthReady || !user) return;
    if (view !== 'admin_dashboard' && view !== 'delegate_dashboard' && view !== 'admin_garage_details') return;

    const unsub = firestoreService.subscribeToPendingRechargeRequests((requests) => {
      setRechargeRequests(requests);
    });
    return () => unsub();
  }, [isAuthReady, user, view]);

  // Sync ALL Recharge Requests specifically for the currently logged-in Delegate (for performance reporting)
  useEffect(() => {
    if (!isAuthReady || !user || !delegate || view !== 'delegate_dashboard') return;

    const unsub = firestoreService.subscribeToDelegateRechargeRequests(delegate.id, (requests) => {
      setDelegateRequests(requests);
    });
    return () => unsub();
  }, [isAuthReady, user, delegate, view]);

  // Call useBackTrapping hook to handle browser navigation / Android popstate
  useBackTrapping({
    view,
    setView,
    showCheckInModal,
    setShowCheckInModal,
    showCheckOutModal,
    setShowCheckOutModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showLogoutConfirm,
    setShowLogoutConfirm,
    showRecentExitWarning,
    setShowRecentExitWarning,
    showSubscriberWarning,
    setShowSubscriberWarning,
    showPackages,
    setShowPackages,
    showStaffStats,
    setShowStaffStats,
    showSubscribers,
    setShowSubscribers,
    setSelectedVehicle,
    setSelectedGarageForDetails,
    setSelectedDelegateForDetails,
    setRecentVehicle,
    setSubscriberWarningPlate,
  });

  useEffect(() => {
    // Body overflow is handled by index.css (locked to hidden for app container performance)
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Warm up AudioContext on first interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      // Warm up the context without playing sound
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

  const handleLogout = useCallback(async () => {
    try {
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
      if (garage) firestoreService.updateSession('garages', garage.id, null);
      if (currentStaff) firestoreService.updateSession('staff', currentStaff.id, null);
      if (delegate) firestoreService.updateSession('delegates', delegate.id, null);
      if (currentSupervisor) firestoreService.updateSession('supervisors', currentSupervisor.id, null);
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      // Clear only app state, preserve theme and other user preferences
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('app_')) {
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
        // Lockout expired, clear both
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

  // --- Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to dynamic admin PIN
  useEffect(() => {
    if (!user) return;
    const unsub = firestoreService.subscribeToAdminPin((pin) => {
      setActiveAdminPin(pin);
    });
    return () => unsub();
  }, [user]);

  // Subscribe to dynamic wallet number
  useEffect(() => {
    if (!user) return;
    const unsub = firestoreService.subscribeToWalletNumber((wallet) => {
      setWalletNumber(wallet);
    });
    return () => unsub();
  }, [user]);

  // Silent anonymous auth if needed
  useEffect(() => {
    if (isAuthReady && !user) {
      import('firebase/auth').then(({ signInAnonymously }) => {
        signInAnonymously(auth).catch((err: any) => {
          console.error("Anonymous authentication failed:", err);
          showToast(`فشل كود المصادقة (أو الدخول المجهول غير مفعل): ${err.message || err}`, 'error');
        });
      });
    }
  }, [isAuthReady, user, showToast]);

  // Synchronize dynamic security sessions on warm launch / reload
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const syncSecuritySession = async () => {
      try {
        const normalizedPin = normalizeDigits(adminPin);
        if (normalizedPin === activeAdminPin && view.startsWith('admin_')) {
          await setDoc(doc(db, 'admin_sessions', user.uid), { pin: activeAdminPin, createdAt: serverTimestamp() });
          if (adminPin !== activeAdminPin) {
            setAdminPin(activeAdminPin);
          }
          // Verification check to confirm session existence and readability
          try {
            const tempSnap = await getDoc(doc(db, 'admin_sessions', user.uid));
            console.log('Admin session validation verified:', tempSnap.exists(), tempSnap.data());
          } catch (tempErr: any) {
            console.error('Failed to read back admin session:', tempErr);
            showToast('تنبيه: فشل قراءة جلسة المدير النشطة. التفاصيل: ' + (tempErr?.message || tempErr), 'error');
          }
        } else if (view.startsWith('admin_') && currentSupervisor) {
          await setDoc(doc(db, 'supervisor_sessions', user.uid), { supervisorId: currentSupervisor.id, pin: currentSupervisor.pin, createdAt: serverTimestamp() });
        } else if (view === 'delegate_dashboard' && delegate) {
          await setDoc(doc(db, 'delegate_sessions', user.uid), { delegateId: delegate.id, pin: delegate.pin, createdAt: serverTimestamp() });
        } else if (view === 'garage') {
          if (currentStaff) {
            await setDoc(doc(db, 'staff_sessions', user.uid), { staffId: currentStaff.id, pin: currentStaff.pin, garageId: currentStaff.garageId, createdAt: serverTimestamp() });
          } else if (garage) {
            await setDoc(doc(db, 'garage_sessions', user.uid), { garageId: garage.id, pin: garage.pin || '', phone: garage.phone || '', createdAt: serverTimestamp() });
          }
        }
      } catch (err: any) {
        console.warn('Silent security session recovery deferred:', err);
        // Show non-blocking visual feedback for admins to ensure secure write permission
        if (normalizeDigits(adminPin) === activeAdminPin) {
          showToast('تنبيه أمني: فشل مزامنة جلسة المدير، يرجى إعادة الدخول. التفاصيل: ' + (err?.message || err), 'error');
        }
      }
    };

    syncSecuritySession();
  }, [isAuthReady, user, view, adminPin, activeAdminPin, delegate, garage, currentStaff, currentSupervisor, showToast]);

  // --- Data Fetching ---

  // Admin Global Data (Garages, Delegates, Packages)
  useEffect(() => {
    if (!isAuthReady || !user || (view !== 'admin_dashboard' && view !== 'admin_garage_details' && view !== 'admin_delegate_details' && view !== 'garage' && view !== 'delegate_dashboard')) return;

    // Use real-time subscriptions for admin data and packages for garage owners
    const unsubGarages = (view === 'admin_dashboard' || view === 'admin_garage_details' || view === 'delegate_dashboard') 
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
  }, [isAuthReady, user, view, isOnline]);

  // Admin Specific Garage Details
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
  }, [isAuthReady, user, view, selectedGarageForDetails?.id, isOnline]);

  // Legacy/Other Views Data Fetching
  useEffect(() => {
    if (!isAuthReady || !user) return;

    // Garage subscription (Real-time updates)
    const isGarageView = view === 'garage' || view === 'delegate_dashboard' || view === 'admin_garage_details';
    if (isGarageView) {
      const targetId = view === 'admin_garage_details' ? selectedGarageForDetails?.id : garage?.id;
      
      if (targetId) {
        const unsubGarage = onSnapshot(doc(db, 'garages', targetId), { includeMetadataChanges: true }, (snapshot) => {
          if (snapshot.exists()) {
            const data = { id: snapshot.id, ...snapshot.data() } as Garage;
            
            // --- Monthly Gift Automatic Awarding ---
            if (data.isMonthlyGiftEnabled && data.monthlyGiftAmount && data.monthlyGiftAmount > 0) {
              const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
              if (data.lastGiftMonth !== currentMonth) {
                firestoreService.awardMonthlyGift(data.id, currentMonth, data.monthlyGiftAmount);
                // The update will trigger another snapshot, so we don't need to manually update state here
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

        return () => {
          unsubGarage();
        };
      }
    }
  }, [user?.uid, isAuthReady, garage?.id, selectedGarageForDetails?.id, view, delegate?.id, isOnline, loadGarageData]);

  useEffect(() => {
    // Session collision check - scoped to current account
    const isDashboardView = view === 'garage' || view === 'delegate_dashboard' || (view.startsWith('admin_') && currentSupervisor);
    if (!isDashboardView) return;

    let id: string | null = null;
    let collection: 'garages' | 'staff' | 'delegates' | 'supervisors' | null = null;

    if (view === 'garage') {
      if (currentStaff) {
        id = currentStaff.id;
        collection = 'staff';
      } else if (garage) {
        id = garage.id;
        collection = 'garages';
      }
    } else if (view === 'delegate_dashboard' && delegate) {
      id = delegate.id;
      collection = 'delegates';
    } else if (view.startsWith('admin_') && currentSupervisor) {
      id = currentSupervisor.id;
      collection = 'supervisors';
    }

    if (!id || !collection) return;

    let heartbeatTimer: any;

    const syncSession = async () => {
      try {
        if (collection) await firestoreService.updateSession(collection, id!, sessionId);
      } catch (err) {
        console.error('Session sync failed:', err);
      }
    };

    const unsubscribe = onSnapshot(doc(db, collection, id), (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();

      // Auto-kick if currentSessionId is overwritten by another session ID
      if (data.currentSessionId && data.currentSessionId !== sessionId) {
        showToast('تم تسجيل الدخول من جهاز آخر أو انتهت الجلسة', 'error');
        handleLogout();
        return;
      }
      
      let currentOffset = serverTimeOffset;
      // Calculate server time offset if snapshot is from server
      if (!snapshot.metadata.hasPendingWrites && data.lastActive) {
        const serverTime = (data.lastActive as Timestamp).toMillis();
        const localTime = Date.now();
        currentOffset = serverTime - localTime;
        setServerTimeOffset(currentOffset);
      }
    });

    // Listen to login_requests for incoming approval requests
    const unsubRequests = onSnapshot(doc(db, 'login_requests', id), (snapshot) => {
      if (snapshot.exists()) {
        const reqData = snapshot.data();
        if (reqData.status === 'pending' && reqData.pendingSessionId !== sessionId) {
          setPendingApprovalRequest({
            id,
            collection: collection!,
            pendingSessionId: reqData.pendingSessionId,
            name: reqData.pendingSessionName || 'مستخدم جديد'
          });
          return;
        }
      }
      setPendingApprovalRequest(null);
    });

    // Sync session initially to claim it cleanly and setup 2-minute heartbeat
    syncSession();
    heartbeatTimer = setInterval(syncSession, 120000);

    return () => {
      unsubscribe();
      unsubRequests();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
    };
  }, [view, garage?.id, currentStaff?.id, delegate?.id, currentSupervisor?.id, sessionId]);

  // Strict Online Requirement
  // Sync selection if list updates (handled via separate dedicated subscription now for better performance)
  
  // --- Actions ---

  useEffect(() => {
    if (!garage || !newPlateNumber || view !== 'garage' || showCheckOutModal || isLoading) return;
    
    const raw = getRawPlate(newPlateNumber);
    const letters = raw.replace(/[0-9]/g, '');
    const numbers = raw.replace(/[^0-9]/g, '');
    const isValid = letters.length >= 1 && numbers.length >= 1;

    if (isValid) {
      // البحث فقط في العربيات الموجودة حالياً داخل الجراج (لأن البرنامج أصبح يسحب هؤلاء فقط)
      const existing = vehicles.find(v => v.plateNumberRaw === raw && v.status === 'inside');
      if (existing) {
        // Delay slightly for better UX (optional but feels smoother)
        const timer = setTimeout(() => {
          closeKeyboard();
          setSelectedVehicle(existing);
          setShowCheckOutModal(true);
          setNewPlateNumber(''); // Clear input to prevent re-trigger and prepare for next entry
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [newPlateNumber, vehicles, garage, view, showCheckOutModal]);

  const initiateSessionRequest = useCallback(async (
    collectionName: 'garages' | 'staff' | 'delegates' | 'supervisors',
    id: string,
    _targetData: any,
    onSuccess: () => Promise<void> | void
  ) => {
    try {
      setIsWaitingForApproval(true);
      
      // Update pending fields on login_requests document
      await setDoc(doc(db, 'login_requests', id), {
        pendingSessionId: sessionId,
        status: 'pending',
        timestamp: serverTimestamp(),
        pendingSessionName: _targetData.name || 'مستخدم جديد',
        collectionName
      });

      let timeoutTimer: any = null;

      // Setup raw real-time listener to wait for decision on login_requests doc
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

      // Setup 45-second timeout
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

      // Store function to cancel manually
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
      // 1. Approve on request document
      await setDoc(doc(db, 'login_requests', id), {
        status: 'approved'
      }, { merge: true });

      // 2. Set active on the target document to trigger auto-kick on this device
      await updateDoc(doc(db, col, id), {
        currentSessionId: pendingSessionId
      });

      showToast('تم قبول طلب الدخول بنجاح.', 'success');
      setPendingApprovalRequest(null);
    } catch (err) {
      console.error('Failed to accept session request:', err);
      showToast('حدث خطأ أثناء الموافقة على الدخول الجديد.', 'error');
    }
  }, [pendingApprovalRequest, showToast]);

  const handleRejectApprovalRequest = useCallback(async () => {
    if (!pendingApprovalRequest) return;
    const { id } = pendingApprovalRequest;
    try {
      // Reject on request document
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

    // 1. Admin Shortcut
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
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10 * 1000));

    try {
      // Ensure the user is fully signed in and authenticated to Firebase before making database queries
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
        // Supervisor check
        const supervisorSnap = await getDocs(query(collection(db, 'supervisors'), where('pin', '==', normalizedInput), limit(1)));
        if (!supervisorSnap.empty) {
          const supervisorData = { id: supervisorSnap.docs[0].id, ...supervisorSnap.docs[0].data() } as Supervisor;

          const proceed = async () => {
            if (auth.currentUser) {
              await setDoc(doc(db, 'supervisor_sessions', auth.currentUser.uid), { supervisorId: supervisorData.id, pin: supervisorData.pin, createdAt: serverTimestamp() });
            }
            await firestoreService.updateSupervisorSession(supervisorData.id, sessionId);
            setCurrentSupervisor(supervisorData);
            setView('admin_dashboard');
            showToast(`مرحباً بك يا ${supervisorData.name} (مشرف)`);
          };

          // Check if there is an active session on another device
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
            setDelegate(delegateData);
            setView('delegate_dashboard');
            showToast(`مرحباً بك يا ${delegateData.name}`);
          };

          // Check if there is an active session on another device
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
              setGarage(linkedGarage);
              setCurrentStaff(staffData);
              setView('garage');
              showToast(`مرحباً بك يا ${staffData.name}`);
            }
          };

          // Check if there is an active session on another device
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
            setGarage(garageData);
            setCurrentStaff(null);
            setView('garage');
          };

          // Check if there is an active session on another device
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
            setGarage(garageData);
            setCurrentStaff(null);
            setView('garage');
          };

          // Check if there is an active session on another device
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

        // Check if there is an active session on another device
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

  const handleDelegateRecharge = useCallback(async (garageId: string, amount: number, pkg?: Package) => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى المحاولة عند عودة النت.', 'error');
      return;
    }
    try {
      const g = allGarages.find(gar => gar.id === garageId);
      if (!g || !delegate) return;

      // Check if there's already a pending request for this garage
      const pendingRequests = await firestoreService.getPendingRechargeRequestsForGarage(garageId);
      if (pendingRequests.length > 0) {
        showToast('يوجد طلب شحن معلق بالفعل لهذا الجراج', 'error');
        return;
      }
      
      const commission = Math.max(g.commissionPerVehicle || 1, 1);
      
      const carsToMove = pkg ? pkg.vehiclesCount : Math.floor(amount / commission);
      const balanceIncrement = pkg ? (pkg.vehiclesCount * commission) : amount;
      const revenueIncrement = pkg ? pkg.price : amount;

      // Create a recharge request instead of direct recharge
      await firestoreService.createRechargeRequest({
        garageId: garageId,
        garageName: g.name,
        delegateId: delegate.id,
        delegateName: delegate.name,
        packageId: pkg?.id || 'custom',
        packageName: pkg?.name || 'مبلغ مخصص',
        amount: balanceIncrement,
        carsCount: carsToMove,
        revenueAmount: revenueIncrement
      });
    } catch (error) {
      showToast('فشل في إرسال طلب الشحن', 'error');
      throw error;
    }
  }, [isOnline, allGarages, delegate, showToast]);

  const handleCheckIn = useCallback(async (type: 'hourly' | 'overnight') => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى إعادة المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!garage || !newPlateNumber || isLoading) return;
    closeKeyboard();

    const raw = getRawPlate(newPlateNumber);
    const formatted = formatPlateNumber(newPlateNumber);
    
    // 1. FINAL FAST LOCAL CHECK: Already inside?
    const existing = vehicles.find(v => v.plateNumberRaw === raw);
    if (existing) {
      showToast('هذه السيارة موجودة بالفعل بالداخل', 'error');
      setShowCheckInModal(false);
      return;
    }

    // 2. RECENT EXIT CHECK (Within 1 hour) 
    const recentlyExited = todayTransactions
      .filter(v => v.plateNumberRaw === raw)
      .sort((a, b) => {
        const timeA = a.exitTime ? safeDate(a.exitTime).getTime() : Date.now();
        const timeB = b.exitTime ? safeDate(b.exitTime).getTime() : Date.now();
        return timeB - timeA;
      })[0];

    if (recentlyExited && !showRecentExitWarning) {
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
    
    // 3. SUBSCRIBER CHECK
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

    if (!isSubscriber && (garage.balance || 0) < commissionVal) {
      showToast('عفواً، الرصيد لا يكفي. يرجى الشحن.', 'error');
      return;
    }

    setIsLoading(true);
    setLoadingType(type);
    setNewPlateNumber(''); // Clear immediately to avoid race conditions
    soundManager.play('checkIn'); // Instant audio feedback
    
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
      }, isSubscriber ? 0 : commissionVal);

      await firestoreService.addActivityLog({
        garageId: garage.id,
        staffId: currentStaff ? currentStaff.id : null,
        staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
        actionType: 'check_in',
        plateNumber: formatted,
        timestamp: serverTimestamp() as any
      });

      setShowCheckInModal(false);
      // No manual refresh needed - onSnapshot on garage doc handles it!
      
    } catch (error: any) {
      let message = error?.message || '';
      
      // Handle JSON-encoded errors from handleFirestoreError
      if (message.startsWith('{') && message.endsWith('}')) {
        try {
          const detailed = JSON.parse(message);
          message = detailed.error || message;
        } catch (e) {
          // Fallback to original message
        }
      }

      if (message === 'ALREADY_INSIDE') {
        showToast('هذه السيارة موجودة بالفعل بالداخل (تم رصدها من جهاز آخر)', 'error');
      } else {
        setNewPlateNumber(formatted); // Restore on error
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
    if (!garage || !selectedVehicle) return;
    closeKeyboard();
    setIsLoading(true);
    setLoadingType('checkout');
    soundManager.play('checkOut'); // Instant audio feedback
    
    try {
      const cost = calculateCost(selectedVehicle, garage, now);

      await firestoreService.checkOutVehicle(garage.id, selectedVehicle.id, cost, garage);
      
      await firestoreService.addActivityLog({
        garageId: garage.id,
        staffId: currentStaff ? currentStaff.id : null,
        staffName: currentStaff ? currentStaff.name : 'مدير الجراج',
        actionType: 'check_out',
        plateNumber: selectedVehicle.plateNumber,
        timestamp: serverTimestamp() as any
      });

      setShowCheckOutModal(false);
      setSelectedVehicle(null);
      setNewPlateNumber('');
      // No manual refresh needed - onSnapshot on garage doc handles it!
    } catch (error: any) {
      console.error('CheckOut Error:', error);
      const errorMsg = error?.message?.includes('{') 
        ? 'مشكلة في البيانات، حاول مرة أخرى' 
        : (error?.message || 'حدث خطأ أثناء الخروج');
      showToast(errorMsg === 'Vehicle not found' ? 'لم يتم العثور على بيانات السيارة' : errorMsg, 'error');
    } finally {
      setIsLoading(false);
      setLoadingType(null);
    }
  }, [isOnline, garage, selectedVehicle, closeKeyboard, currentStaff, showToast]);

  const handleDeleteVehicle = useCallback(async () => {
    if (!isOnline) {
      showToast('لا يوجد اتصال بالإنترنت. يرجى إعادة المحاولة عند عودة النت.', 'error');
      return;
    }
    if (!garage || !selectedVehicle) return;

    // Prevent duplicate triggers using both the state check and the ref lock
    if (isLoading || deletingVehicleRef.current === selectedVehicle.id) {
      return;
    }

    deletingVehicleRef.current = selectedVehicle.id;
    setIsLoading(true);
    setLoadingType('delete');
    soundManager.play('checkOut'); // Instant audio feedback

    // 1. Calculate time since entry to check if refund is applicable
    const entryDate = selectedVehicle.entryTime ? safeDate(selectedVehicle.entryTime) : new Date();
    const diffMs = Date.now() - entryDate.getTime();
    const isWithinFiveMinutes = diffMs <= 300000; // Increased to 5 minutes for "errors"
    const isOverOneDay = diffMs > 86400000; // Safety check for very old records

    // 2. IMMEDIATE UI FEEDBACK (Close modals first, keep state till final result)
    setShowCheckOutModal(false);
    setShowDeleteConfirm(false);

    try {
      if (isWithinFiveMinutes && !isOverOneDay && garage.balance !== undefined) {
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
          // Limit reached - Delete without refund
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
    
    // Optimistically update UI to unmount listeners before document deletion
    setShowDeleteConfirm(false);
    setSelectedGarageForDetails(null);
    setView('admin_dashboard');

    // Add a small delay to let React cycle finish unmounting components/listeners
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
    } catch (error) {
      // Error handled in service
    }
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
    
    // Always use commission model now

    const selectedPkg = packages.find(p => p.id === initialPackageId);
    const initialBalance = selectedPkg ? (selectedPkg.vehiclesCount * commissionPerVehicle) : 0;
    const initialCars = selectedPkg ? selectedPkg.vehiclesCount : 0;
    const initialRevenue = selectedPkg ? selectedPkg.price : 0;

    // Phone number is optional now. If they entered a phone, we check if it is of reasonable length.
    if (phone && (phone.length < 3 || phone.length > 20)) {
      showToast('يرجى إدخال رقم هاتف صحيح يتكون من 3 أرقام على الأقل', 'error');
      return;
    }

    setIsLoading(true);
    try {
      // Enforce 3 garages per day limit for delegates
      if (delegate && delegate.id) {
        const today = new Date();
        const delegateGaragesCreatedToday = allGarages.filter(g => {
          if (g.createdByDelegateId !== delegate.id) return false;
          if (!g.createdAt) return false;
          
          let createdDate: Date;
          if (typeof g.createdAt.toDate === 'function') {
            createdDate = g.createdAt.toDate();
          } else if (g.createdAt.seconds !== undefined) {
            createdDate = new Date(g.createdAt.seconds * 1000);
          } else {
            createdDate = new Date(g.createdAt);
          }

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

      // Check for duplicates
      const existing = allGarages.find(g => (phone && g.phone === phone) || g.name === name);
      if (existing) {
        showToast(APP_TEXT.ADMIN.DUPLICATE_ERROR, 'error');
        setIsLoading(false);
        return;
      }

      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 10); // 10 years for commission garages

      const isPending = delegate !== null;
      const actualBalance = isPending ? 0 : initialBalance;
      const actualCars = isPending ? 0 : initialCars;
      const actualRevenue = isPending ? 0 : initialRevenue;

      await firestoreService.createGarage({
        name,
        phone,
        pin,
        hourlyRate,
        overnightRate,
        balanceExpiry: Timestamp.fromDate(expiryDate),
        createdAt: serverTimestamp(),
        balanceDays: 3650,
        billingModel: 'commission',
        commissionPerVehicle: commissionPerVehicle,
        balance: actualBalance,
        totalRechargedCars: actualCars,
        totalAdminRevenue: actualRevenue,
        isLocked: false,
        lastBalanceDeduction: serverTimestamp(),
        createdByDelegateId: delegate?.id || null,
        createdByDelegateName: delegate?.name || null,
        status: isPending ? 'pending' : 'approved'
      });

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

  const renderView = () => {
    // Balance/Lock Block
    if (garage && view !== 'admin_dashboard') {
      const expiry = garage.balanceExpiry ? safeDate(garage.balanceExpiry) : null;
      if (expiry && expiry.getTime() > 0 && expiry.getTime() < Date.now()) {
        return (
          <div className="h-full w-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans overflow-y-auto" dir="rtl">
            <div className="bg-white p-10 rounded-2xl max-w-md w-full">
              <div className="w-32 h-32 bg-slate-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <Shield className="w-16 h-16 stroke-[3]" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">نفذ الرصيد</h2>
              <p className="text-slate-500 font-bold text-lg mb-8 leading-relaxed">
                عذراً، لقد نفذ رصيد الجراج الخاص بك. يرجى التواصل مع الإدارة لشحن الرصيد ومتابعة العمل.
              </p>
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm mb-8">
                تاريخ الانتهاء: {expiry.toLocaleDateString('ar-EG')}
              </div>
              <button 
                onClick={() => {
                  setGarage(null);
                  setView('login');
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        );
      }
    }

    if (view === 'login') {
      return (
        <LoginView 
          loginPhone={loginPhone}
          setLoginPhone={setLoginPhone}
          handleGarageLogin={handleGarageLogin}
          isLoading={isLoading}
          closeKeyboard={closeKeyboard}
        />
      );
    }

    if (view === 'admin_login') {
      return (
        <AdminLoginView 
          adminPin={adminPin}
          setAdminPin={setAdminPin}
          setView={setView}
          showToast={showToast}
          closeKeyboard={closeKeyboard}
          correctAdminPin={activeAdminPin}
        />
      );
    }

    if (view === 'admin_dashboard') {
      return (
        <AdminDashboard 
          allGarages={allGarages}
          adminSearch={adminSearch}
          setAdminSearch={setAdminSearch}
          isLoading={isLoading}
          createNewGarage={createNewGarage}
          setView={setView}
          setSelectedGarageForDetails={setSelectedGarageForDetails}
          setSelectedDelegateForDetails={setSelectedDelegateForDetails}
          delegates={delegates}
          addDelegate={addDelegate}
          packages={sortedPackages}
          onLogout={handleLogout}
          rechargeRequests={rechargeRequests}
          showToast={showToast}
          // Persisted states
          activeTab={adminActiveTab}
          setActiveTab={setAdminActiveTab}
          showPlansModal={showAdminPlansModal}
          setShowPlansModal={setShowAdminPlansModal}
          showOverview={showAdminOverview}
          setShowOverview={setShowAdminOverview}
          pinInput={adminPinInput}
          setPinInput={setAdminPinInput}
          delegateForm={adminDelegateForm}
          setDelegateForm={setAdminDelegateForm}
          garageForm={adminGarageForm}
          setGarageForm={setAdminGarageForm}
          currentSupervisor={currentSupervisor}
          supervisors={supervisors}
          adminSupervisorForm={adminSupervisorForm}
          setAdminSupervisorForm={setAdminSupervisorForm}
          currentAdminPin={activeAdminPin}
          currentWalletNumber={walletNumber}
          onUpdateWalletNumber={firestoreService.updateWalletNumber}
        />
      );
    }

    if (view === 'delegate_login') {
      return (
        <DelegateLoginView 
          onLogin={handleDelegateLogin}
          isLoading={isLoading}
          onBack={() => setView('login')}
        />
      );
    }

    if (view === 'delegate_dashboard' && delegate) {
      return (
        <DelegateDashboardView 
          delegate={delegate}
          allGarages={delegateGarages}
          onLogout={handleInitiateLogout}
          onRecharge={handleDelegateRecharge}
          onCreateGarage={createNewGarage}
          isLoading={isLoading}
          packages={sortedPackages}
          pendingRequests={rechargeRequests}
          delegateRequests={delegateRequests}
          showToast={showToast}
        />
      );
    }

    if (view === 'admin_garage_details' && selectedGarageForDetails) {
      return (
        <AdminGarageDetailsView 
          selectedGarageForDetails={selectedGarageForDetails}
          setView={setView}
          setSelectedGarageForDetails={setSelectedGarageForDetails}
          setShowDeleteConfirm={setShowDeleteConfirm}
          updateGarageRate={updateGarageRate}
          showToast={showToast}
          staffList={staffList}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          packages={sortedPackages}
        />
      );
    }
    if (view === 'admin_delegate_details' && selectedDelegateForDetails) {
      // Find the most up-to-date delegate data from our synced delegates list
      const liveDelegate = delegates.find(d => d.id === selectedDelegateForDetails.id) || selectedDelegateForDetails;
      if (!liveDelegate) return <div className="p-8 text-center">جاري التحميل...</div>;
      
      return (
        <AdminDelegateDetailsView 
          delegate={liveDelegate}
          setView={setView}
          setSelectedDelegate={setSelectedDelegateForDetails}
          removeDelegate={removeDelegate}
        />
      );
    }
    if (view === 'garage' && garage) {
      return (
        <GarageDashboardView 
          garage={garage}
          currentStaff={currentStaff}
          isInputFocused={isInputFocused}
          now={now}
          vehicles={vehicles}
          todayTransactions={todayTransactions}
          setSelectedVehicle={setSelectedVehicle}
          setShowCheckOutModal={setShowCheckOutModal}
          closeKeyboard={closeKeyboard}
          newPlateNumber={newPlateNumber}
          setNewPlateNumber={setNewPlateNumber}
          setIsInputFocused={setIsInputFocused}
          plateInputRef={plateInputRef}
          handleCheckIn={handleCheckIn}
          inputRef={inputRef}
          onLogout={handleInitiateLogout}
          showToast={showToast}
          packages={sortedPackages}
          staffList={staffList}
          showPackages={showPackages}
          setShowPackages={setShowPackages}
          showStaffStats={showStaffStats}
          setShowStaffStats={setShowStaffStats}
          showSubscribers={showSubscribers}
          setShowSubscribers={setShowSubscribers}
          walletNumber={walletNumber}
        />
      );
    }

    if (view === 'packages' && garage) {
      return (
        <PackagesModal 
          packages={sortedPackages}
          onClose={() => setView('garage')}
          garageHourlyRate={garage.hourlyRate}
          walletNumber={walletNumber}
        />
      );
    }

    // Safe fallback to login if state is inconsistent
    return <LoginView 
      loginPhone={loginPhone}
      setLoginPhone={setLoginPhone}
      handleGarageLogin={handleGarageLogin}
      isLoading={isLoading}
      closeKeyboard={closeKeyboard}
    />;
  };



  // --- Landscape Orientation Check for Mobiles ---
  if (isLandscapeMobile) {
    if (garage) {
      return (
        <div className="fixed inset-0 h-screen w-screen flex bg-slate-900 text-white font-sans select-none z-[20000] overflow-hidden" dir="rtl">
          {/* Dual Screen Split Solid Contrast Board */}
          <div className="flex w-full h-full overflow-hidden">
            
            {/* Right Pane: Hourly Rate (Soft Emerald Green) - Renders on the right when dir="rtl" */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-emerald-600 dark:bg-emerald-700 text-center relative overflow-hidden transition-colors">
              <div className="relative z-10 flex flex-col items-center max-w-sm">
                <h3 className="flex flex-col items-center gap-1.5 select-none text-white">
                  <span className="text-3xl md:text-4xl font-black tracking-tight leading-none text-white">
                    سعر الساعة
                  </span>
                  <span className="text-sm md:text-base font-extrabold text-emerald-100 uppercase font-mono tracking-widest opacity-90">
                    Hourly Rate
                  </span>
                </h3>
                
                {/* Price Display */}
                <div className="flex flex-col items-center justify-center select-none mt-2">
                  <span className="text-[57vh] font-extrabold font-mono tracking-tighter text-white leading-none">
                    {garage.hourlyRate}
                  </span>
                  <span className="text-xl md:text-2xl font-black font-mono uppercase tracking-widest text-emerald-100 opacity-90">
                    EGP
                  </span>
                </div>
              </div>
            </div>

            {/* Left Pane: Overnight Stay (Indigo Navy) - Renders on the left when dir="rtl" */}
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-indigo-900 dark:bg-indigo-950 text-center relative overflow-hidden border-r border-white/10 transition-colors">
              <div className="relative z-10 flex flex-col items-center max-w-sm">
                <h3 className="flex flex-col items-center gap-1.5 select-none text-white">
                  <span className="text-3xl md:text-4xl font-black tracking-tight leading-none text-white">
                    سعر المبيت
                  </span>
                  <span className="text-sm md:text-base font-extrabold text-indigo-100 uppercase font-mono tracking-widest opacity-90">
                    Overnight Stay
                  </span>
                </h3>
                
                {/* Price Display */}
                <div className="flex flex-col items-center justify-center select-none mt-2">
                  <span className="text-[57vh] font-extrabold font-mono tracking-tighter text-white leading-none">
                    {garage.overnightRate}
                  </span>
                  <span className="text-xl md:text-2xl font-black font-mono uppercase tracking-widest text-indigo-100 opacity-90">
                    EGP
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      );
    }

    // Default Fallback when no active garage is logged in (e.g. general login screens)
    return (
      <div className="fixed inset-0 bg-slate-900/95 dark:bg-slate-950/98 backdrop-blur-md z-[20000] flex flex-col items-center justify-center p-6 text-center select-none" dir="rtl">
        <style>{`
          @keyframes phone-rotate-hint {
            0% { transform: rotate(90deg); }
            30% { transform: rotate(90deg); }
            70% { transform: rotate(0deg); }
            100% { transform: rotate(0deg); }
          }
          .animate-phone-rotate-hint {
            animation: phone-rotate-hint 3s cubic-bezier(0.77, 0, 0.175, 1) infinite;
          }
        `}</style>
        
        <div className="space-y-8 max-w-sm flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {/* Glowing active field */}
            <div className="absolute inset-0 bg-emerald-500/10 blur-3xl rounded-full scale-150" />
            
            {/* Main Phone frame */}
            <div className="relative w-28 h-28 bg-slate-800/90 dark:bg-slate-900/90 rounded-[2.5rem] border-2 border-slate-700/60 flex items-center justify-center shadow-2xl">
              <div className="animate-phone-rotate-hint flex items-center justify-center">
                <Smartphone className="w-14 h-14 text-emerald-400 stroke-[1.5]" />
              </div>
              <div className="absolute top-2 w-10 h-1 bg-slate-700 rounded-full" />
              <div className="absolute bottom-2 w-3 h-3 rounded-full border border-slate-700" />
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-2xl font-black text-slate-100 mb-2 tracking-tight">يرجى تدوير الهاتف للوضع الرأسي 📱</h2>
            <p className="text-slate-400 font-bold text-sm leading-relaxed px-4">
              التطبيق ومصمم رخص السيارات مصممان خصيصاً للتصفح بالوضع الرأسي (Portrait) لضمان أفضل تجربة استخدام للوحة وباقي القوائم.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Offline Mode (Gatekeeper) ---
  if (showOfflineScreen) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[10000] flex items-center justify-center p-6 text-center" dir="rtl">
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 max-w-sm w-full flex flex-col items-center gap-8 border-4 border-white/10 dark:border-slate-800 transition-colors">
          <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl flex items-center justify-center transition-colors">
            <WifiOff className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">عفواً، لا يوجد نت</h2>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-4">
              توقف النظام تلقائياً لحماية بياناتك. بمجرد عودة الاتصال، ستتمكن من مواصلة العمل فوراً.
            </p>
          </div>
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-900/20 px-6 py-3 rounded-2xl text-xs font-black transition-colors">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>جاري محاولة الاتصال...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthReady) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 gap-5" dir="rtl">
        <div className="flex flex-col items-center">
          <div className="w-28 h-28 flex items-center justify-center bg-black rounded-[2rem] p-6 mb-6 shadow-2xl border border-slate-900 transition-all duration-300">
            <img 
              src="https://cdn-icons-png.flaticon.com/512/2993/2993685.png" 
              alt="PARQ Logo" 
              className="w-16 h-16 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="w-8 h-8 rounded-full border-3 border-slate-800 border-t-emerald-500 animate-spin mb-3" />
          <p className="text-slate-400 font-bold text-base tracking-wide">جاري الاتصال بالسيرفر السحابي...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-[#faf9f6] dark:bg-slate-950 transition-colors">
      <ErrorBoundary>
        {toast && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-6 py-4 rounded-2xl font-bold text-white flex items-center gap-3 min-w-[280px] justify-center transition-all ${
            toast.type === 'error' ? 'bg-red-500' : 'bg-slate-900 dark:bg-slate-800'
          }`}>
            {toast.type === 'error' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5 text-green-400" />}
            <span>{toast.message}</span>
          </div>
        )}

        {showCheckInModal && garage && (
          <CheckInModal 
            newPlateNumber={newPlateNumber}
            garage={garage}
            isLoading={isLoading}
            loadingType={loadingType}
            onCheckIn={handleCheckIn}
            onCancel={() => setShowCheckInModal(false)}
          />
        )}

        {showCheckOutModal && selectedVehicle && garage && (
          <CheckOutModal 
            selectedVehicle={selectedVehicle}
            garage={garage}
            isLoading={isLoading}
            loadingType={loadingType}
            now={now}
            onConfirm={confirmCheckOut}
            onDelete={handleDeleteVehicle}
            onCancel={() => { setShowCheckOutModal(false); setSelectedVehicle(null); }}
          />
        )}

        {showDeleteConfirm && view === 'admin_garage_details' && selectedGarageForDetails && (
          <DeleteGarageConfirmModal 
            garage={selectedGarageForDetails}
            isLoading={isLoading}
            onConfirm={() => deleteGarage(selectedGarageForDetails)}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}

        {showDeleteConfirm && selectedVehicle && (
          <DeleteVehicleConfirmModal 
            vehicle={selectedVehicle}
            isLoading={isLoading}
            onConfirm={handleDeleteVehicle}
            onCancel={() => { setShowDeleteConfirm(false); setSelectedVehicle(null); }}
          />
        )}

        {showRecentExitWarning && recentVehicle && (
          <RecentExitWarningModal 
            vehicle={recentVehicle}
            now={now}
            onConfirm={() => {
              if (pendingCheckInType) {
                setShowRecentExitWarning(false);
                handleCheckIn(pendingCheckInType);
              }
            }}
            onCancel={() => {
              setShowRecentExitWarning(false);
              setRecentVehicle(null);
              setNewPlateNumber('');
            }}
          />
        )}

        {showSubscriberWarning && subscriberWarningPlate && (
          <SubscriberWarningModal 
            plateNumber={subscriberWarningPlate}
            onConfirm={() => {
              setShowSubscriberWarning(false);
              setSubscriberWarningPlate('');
            }}
          />
        )}

        {showLogoutConfirm && (
          <LogoutConfirmModal 
            onConfirm={handleLogout}
            onCancel={() => setShowLogoutConfirm(false)}
            correctPin={activeAdminPin}
          />
        )}

        {isWaitingForApproval && (
          <div className="fixed inset-0 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-sm z-[20002] flex items-center justify-center p-6 text-center" dir="rtl">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-sm w-full flex flex-col items-center gap-6 border-4 border-white/10 dark:border-slate-800 shadow-2xl transition-all">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl flex items-center justify-center animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">جاري طلب الإذن...</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-4">
                  الحساب مفتوح على جهاز آخر. جاري إرسال طلب للموافقة على تبديل الخدمة إلى هذا الجهاز.
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold animate-pulse">
                  برجاء إبقاء هذه الشاشة مفتوحة...
                </p>
              </div>
              <button 
                onClick={() => {
                  if (typeof (window as any)._cancelSessionRequest === 'function') {
                    (window as any)._cancelSessionRequest();
                  } else {
                    setIsWaitingForApproval(false);
                  }
                }}
                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3.5 rounded-2xl font-bold text-base transition-all"
              >
                إلغاء الطلب
              </button>
            </div>
          </div>
        )}

        {pendingApprovalRequest && (
          <div className="fixed inset-0 bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-sm z-[20003] flex items-center justify-center p-6 text-center" dir="rtl">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 max-w-sm w-full flex flex-col items-center gap-6 border border-slate-100 dark:border-slate-800 shadow-2xl transition-all relative overflow-hidden pt-10">
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-sans">تنبيه دخول جديد! ⚠️</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-4">
                  هناك جهاز جديد يحاول تسجيل الدخول إلى هذا الحساب حالياً.
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 text-right">
                  <p className="text-xs font-black text-amber-800 dark:text-amber-400 flex items-center gap-2">
                    <span>📱 جهاز جديد يحتاج لموافقتك</span>
                  </p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
                    إذا قبلت، فسيتم تسجيل الخروج من هذا الجهاز ونقل العمل للجهاز الجديد فوراً.
                  </p>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-4">
                  هل تريد السماح للجهاز الجديد بالدخول وتكملة العمل هناك؟
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button 
                  onClick={handleAcceptApprovalRequest}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
                >
                  نعم، قبول
                </button>
                <button 
                  onClick={handleRejectApprovalRequest}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all"
                >
                  رفض
                </button>
              </div>
            </div>
          </div>
        )}

      {renderView()}
      </ErrorBoundary>
    </div>
  );
}
