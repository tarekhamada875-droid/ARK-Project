import React, { memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  LogOut, 
  Car, 
  XCircle,
  Menu,
  X,
  Users,
  Zap,
  ChevronDown,
  Bell,
  PieChart,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import { FlipNumber } from '../ui/FlipNumber';
import { AnimatedCounter } from '../AnimatedCounter';
import { MovingBalanceArrows } from './MovingBalanceArrows';
import { RegistrationCard } from './RegistrationCard';
import { VehicleItem } from './VehicleItem';
import { Garage, Vehicle, Package, Staff } from '../../types';
import { SubscribersView } from './SubscribersView';
import { RechargeHistoryView } from './RechargeHistoryView';
import { PackagesModal } from '../modals/PackagesModal';
import { StaffStatsModal } from '../modals/StaffStatsModal';
import { GarageReportsView } from './GarageReportsView';
import { AppearanceSettingsModal } from '../modals/AppearanceSettingsModal';
import { firestoreService } from '../../services/firestoreService';
import { soundManager } from '../../utils/sounds';
import { auth } from '../../firebase';
import { useTheme } from '../../utils/ThemeContext';
import { resolveShimmerColor, isLightColor } from '../../utils';

interface GarageDashboardViewProps {
  garage: Garage;
  currentStaff: Staff | null;
  isInputFocused: boolean;
  now: Date;
  vehicles: Vehicle[];
  todayTransactions: Vehicle[];
  setSelectedVehicle: (v: Vehicle) => void;
  setShowCheckOutModal: (val: boolean) => void;
  closeKeyboard: () => void;
  newPlateNumber: string;
  setNewPlateNumber: (val: string) => void;
  setIsInputFocused: (val: boolean) => void;
  plateInputRef: React.RefObject<HTMLInputElement>;
  handleCheckIn: (type: 'hourly' | 'overnight') => void;
  inputRef: React.RefObject<HTMLDivElement>;
  onLogout: () => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  packages: Package[];
  staffList: Staff[];
  showPackages: boolean;
  setShowPackages: (val: boolean) => void;
  showStaffStats: boolean;
  setShowStaffStats: (val: boolean) => void;
  showSubscribers: boolean;
  setShowSubscribers: (val: boolean) => void;
  walletNumber?: string;
  subscriptionPrices?: { weekly: number; monthly: number; weeklyDiscount?: number; monthlyDiscount?: number };
}

export const GarageDashboardView = memo(({
  garage,
  currentStaff,
  isInputFocused,
  now,
  vehicles,
  todayTransactions,
  setSelectedVehicle,
  setShowCheckOutModal,
  closeKeyboard,
  newPlateNumber,
  setNewPlateNumber,
  setIsInputFocused,
  plateInputRef,
  handleCheckIn,
  inputRef,
  onLogout,
  showToast,
  packages,
  staffList,
  showPackages,
  setShowPackages,
  showStaffStats,
  setShowStaffStats,
  showSubscribers,
  setShowSubscribers,
  walletNumber = "015 - 524 - 113 - 23",
  subscriptionPrices
}: GarageDashboardViewProps) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const { theme } = useTheme();
  const activeShimmerColor = resolveShimmerColor(garage?.shimmerColor, theme);
  const [currentView, setCurrentView] = React.useState<'main' | 'active_vehicles'>('main');
  
  const [visibleCount, setVisibleCount] = React.useState(15);
  const [subscribersCount, setSubscribersCount] = React.useState(0);
  const [showRechargeHistory, setShowRechargeHistory] = React.useState(false);
  const [hasNewRecharge, setHasNewRecharge] = React.useState(false);
  const [latestRechargeInfo, setLatestRechargeInfo] = React.useState<any | null>(null);
  const [showRechargePopup, setShowRechargePopup] = React.useState(false);
  const [showGarageReports, setShowGarageReports] = React.useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = React.useState(false);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const [isAuthResolved, setIsAuthResolved] = React.useState(!!auth.currentUser);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setIsAuthResolved(!!u);
    });
    return () => unsubscribe();
  }, []);

  const isSubscription = garage.billingModel === 'subscription';

  const remainingDays = React.useMemo(() => {
    if (!isSubscription || !garage.balanceExpiry) return 0;
    const expiryDate = garage.balanceExpiry.toDate ? garage.balanceExpiry.toDate() : new Date(garage.balanceExpiry);
    const diff = expiryDate.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [isSubscription, garage.balanceExpiry]);

  const currentBalance = React.useMemo(() => garage.balance || 0, [garage.balance]);
  const commission = React.useMemo(() => garage.commissionPerVehicle || 1, [garage.commissionPerVehicle]);
  const availableVehicles = React.useMemo(() => {
    if (isSubscription) {
      return remainingDays;
    }
    return Math.max(0, Math.floor(currentBalance / commission));
  }, [isSubscription, remainingDays, currentBalance, commission]);

  const activeVehiclesCount = React.useMemo(() => {
    if (vehicles.length > 0) return vehicles.length;
    if (typeof garage.carsInside === 'number') return Math.max(0, garage.carsInside);
    return 0;
  }, [vehicles.length, garage.carsInside]);

  const [balanceTransition, setBalanceTransition] = React.useState<'increase' | 'decrease' | null>(null);
  const prevVehiclesRef = React.useRef(availableVehicles);

  const showBalanceWarning = isSubscription ? (availableVehicles <= 3) : (availableVehicles < 50);
  const warningText = isSubscription 
    ? (availableVehicles <= 0 
        ? 'انتهى اشتراك الجراج' 
        : availableVehicles === 1 
        ? 'ينتهي الاشتراك اليوم! يرجى الشحن قبل 5 مساءً' 
        : availableVehicles === 2 
        ? 'متبقي يومان على انتهاء الاشتراك' 
        : 'باقي أيام قليلة على انتهاء الاشتراك')
    : (availableVehicles <= 0 ? 'الرصيد انتهى تماماً' : 'الرصيد الحالى قرب يخلص');

  // Popup state for subscription ending today
  const [showLastDaySubModal, setShowLastDaySubModal] = React.useState(false);

  React.useEffect(() => {
    if (!isSubscription) return;
    if (availableVehicles > 1) return; // Only trigger for last day (1 day or 0 day before lock)

    const checkPopup = () => {
      const currentHour = new Date().getHours();
      // Charging hours scope: 10 AM (10) to 5 PM (17)
      if (currentHour >= 10 && currentHour < 17) {
        const dateStr = new Date().toISOString().slice(0, 10);
        const storageKey = `last_sub_alert_${garage.id}_${dateStr}`;
        const lastShown = localStorage.getItem(storageKey);
        const twoHoursMs = 2 * 60 * 60 * 1000;
        const now = Date.now();

        if (!lastShown || (now - Number(lastShown) >= twoHoursMs)) {
          setShowLastDaySubModal(true);
        }
      }
    };

    checkPopup();
    const interval = setInterval(checkPopup, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isSubscription, availableVehicles, garage.id]);

  const handleCloseSubModal = () => {
    setShowLastDaySubModal(false);
    const dateStr = new Date().toISOString().slice(0, 10);
    const storageKey = `last_sub_alert_${garage.id}_${dateStr}`;
    localStorage.setItem(storageKey, Date.now().toString());
  };

  React.useEffect(() => {
    const diff = availableVehicles - prevVehiclesRef.current;
    if (diff < 0) {
      setBalanceTransition('decrease');
      const timer = setTimeout(() => {
        setBalanceTransition(null);
      }, 1200);
      prevVehiclesRef.current = availableVehicles;
      return () => clearTimeout(timer);
    } else if (diff > 0) {
      setBalanceTransition('increase');
      const timer = setTimeout(() => {
        setBalanceTransition(null);
      }, 1200);
      prevVehiclesRef.current = availableVehicles;
      return () => clearTimeout(timer);
    }
    prevVehiclesRef.current = availableVehicles;
  }, [availableVehicles]);

  const isBalanceOut = availableVehicles <= 0;
  const isManuallyLocked = garage.isLocked || false;

  React.useEffect(() => {
    if (!isAuthResolved) return;
    const unsub = firestoreService.subscribeToGarageRechargeLogs(garage.id, (recharges) => {
      if (recharges.length > 0) {
        const latestId = recharges[0].id;
        const acknowledgedId = localStorage.getItem(`acknowledged_recharge_${garage.id}`);
        if (acknowledgedId !== latestId) {
          const rechargeTime = recharges[0].timestamp?.toDate ? recharges[0].timestamp.toDate() : new Date();
          const now = new Date();
          const msSinceRecharge = now.getTime() - rechargeTime.getTime();
          
          // Show the green notification dot on the menu if the recharge is within 24 hours
          const isNotificationValid = msSinceRecharge < 24 * 60 * 60 * 1000; // 24 hours
          setHasNewRecharge(isNotificationValid);
          setLatestRechargeInfo(recharges[0]);
 
          // Show the popup and play sound ONLY if it occurred in the last 5 minutes
          const isVeryRecent = msSinceRecharge < 5 * 60 * 1000; // 5 minutes
          if (isVeryRecent) {
            setShowRechargePopup(true);
 
            // Play sound for real-time notifications
            const lastSeenId = localStorage.getItem(`dashboard_seen_recharge_${garage.id}`);
            if (lastSeenId !== latestId) {
              if (msSinceRecharge < 10 * 60 * 1000) { // 10 minutes
                try {
                  soundManager.play('checkIn');
                } catch (e) {
                  console.error(e);
                }
              }
              localStorage.setItem(`dashboard_seen_recharge_${garage.id}`, latestId);
            }
          } else {
            setShowRechargePopup(false);
          }
        } else {
          setHasNewRecharge(false);
          setLatestRechargeInfo(null);
          setShowRechargePopup(false);
        }
      } else {
        setHasNewRecharge(false);
        setLatestRechargeInfo(null);
        setShowRechargePopup(false);
      }
    });
    return () => unsub();
  }, [garage.id, isAuthResolved]);

  React.useEffect(() => {
    // Scroll behavior handled by component logic and index.css
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isManuallyLocked]);

  React.useEffect(() => {
    if (!isAuthResolved) return;
    if (!currentStaff) {
      const unsub = firestoreService.subscribeToSubscribers(garage.id, (subs) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        let alertCount = 0;
        subs.forEach((s: any) => {
          const end = new Date(s.endDate);
          const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 3) {
            alertCount++;
          }
        });
        setSubscribersCount(alertCount);
      });
      return () => unsub();
    }
  }, [garage.id, currentStaff, isAuthResolved]);

  const handleCloseRechargePopup = React.useCallback(() => {
    if (latestRechargeInfo) {
      localStorage.setItem(`acknowledged_recharge_${garage.id}`, latestRechargeInfo.id);
    }
    setHasNewRecharge(false);
    setShowRechargePopup(false);
  }, [garage.id, latestRechargeInfo]);

  const formatDateLocal = React.useCallback((timestamp: any) => {
    if (!timestamp) return 'غير معروف';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const formatTimeLocal = React.useCallback((timestamp: any) => {
    if (!timestamp) return 'غير معروف';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Reset pagination when switching views
  React.useEffect(() => {
    setVisibleCount(15);
  }, [currentView]);

  const displayedVehicles = vehicles.slice(0, visibleCount);
  
  // Infinite scroll observer
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < vehicles.length) {
          setVisibleCount((prev) => prev + 10);
        }
      },
      { 
        threshold: 0.1, 
        root: scrollContainerRef.current,
        rootMargin: '100px' 
      }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [vehicles.length, visibleCount, currentView]);

  const navigateTo = (viewName: 'subscribers' | 'reports' | 'packages' | 'history' | 'staff' | 'appearance') => {
    setShowMenu(false);
    setShowSubscribers(viewName === 'subscribers');
    setShowGarageReports(viewName === 'reports');
    setShowPackages(viewName === 'packages');
    setShowRechargeHistory(viewName === 'history');
    setShowStaffStats(viewName === 'staff');
    setShowAppearanceSettings(viewName === 'appearance');
  };
  
  return (
    <div className="h-[100dvh] bg-[#faf9f6] dark:bg-slate-950 font-sans w-full flex flex-col items-center overflow-hidden relative" dir="rtl">
      {/* Header */}
      {!isInputFocused && (
        <header className="relative bg-[#faf9f6] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 z-40 w-full shrink-0">
          <div className="max-w-4xl mx-auto flex justify-between items-center w-full">
            <div className="flex items-center">
              <div className="h-11 px-4 bg-slate-900 dark:bg-slate-800 border border-slate-900 dark:border-slate-800 text-white rounded-2xl flex items-center justify-center shadow-sm font-black text-xs select-none">
                <span className="text-slate-100 dark:text-slate-200">{garage.name}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className={`relative w-11 h-11 border rounded-2xl flex items-center justify-center transition-all outline-none ${
                  showMenu 
                    ? 'bg-red-600 text-white border-red-700' 
                    : 'bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700'
                }`}
              >
                {(subscribersCount > 0 || hasNewRecharge) && !showMenu && (
                  <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${hasNewRecharge ? 'bg-emerald-500' : 'bg-red-500'}`} />
                )}
                {showMenu ? <X className="w-6 h-6 stroke-[3]" /> : <Menu className="w-6 h-6 stroke-[3]" />}
              </button>
            </div>
          </div>
        </header>
      )}
      
      {/* Dropdown Menu Overlay - Upgraded to Floating Side Sheet Drawer */}
      <AnimatePresence>
        {showMenu && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 z-[150] pointer-events-auto"
              style={{ willChange: 'opacity', transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
            />
            
            <motion.div 
              initial={{ x: '-100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 26, stiffness: 220 }}
              className="fixed top-3 bottom-3 left-3 w-[220px] xs:w-[245px] bg-[#faf9f6] dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800/80 z-[150] flex flex-col overflow-hidden pointer-events-auto"
              style={{ willChange: 'transform, opacity', transform: 'translate3d(0, 0, 0)', backfaceVisibility: 'hidden' }}
              dir="rtl"
            >
              {/* Drawer Header - Clean Profile Box */}
              <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-extrabold shrink-0 ${
                        isLightColor(activeShimmerColor) ? 'text-slate-900' : 'text-white'
                      }`}
                      style={{ backgroundColor: activeShimmerColor }}
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate max-w-[105px]">
                        {currentStaff ? currentStaff.name : 'مدير الجراج'}
                      </span>
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                        {currentStaff ? 'موظف وردية' : 'إدارة الجراج'}
                      </span>
                    </div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={() => setShowMenu(false)}
                    className="w-8 h-8 bg-red-500 dark:bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Drawer Content Area */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar-slate">
                
                {/* Menu Options Group */}
                <div className="space-y-2">
                  {!currentStaff && (
                    <button 
                      onClick={() => navigateTo('subscribers')}
                      className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-400/10 text-blue-500 flex items-center justify-center">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm">الأشتراكات</span>
                      </div>
                      {subscribersCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-red-600 text-white dark:bg-red-500 dark:text-slate-950 text-xs font-black">
                          {subscribersCount}
                        </span>
                      )}
                    </button>
                  )}

                  {!currentStaff && (
                    <button 
                      onClick={() => navigateTo('reports')}
                      className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none animate-fade-in"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-400/10 text-purple-500 flex items-center justify-center">
                          <PieChart className="w-4 h-4 text-purple-500" />
                        </div>
                        <span className="font-bold text-sm">التقارير الذكية</span>
                      </div>
                    </button>
                  )}
                  
                  <button 
                    onClick={() => navigateTo('packages')}
                    className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-400/10 text-amber-500 flex items-center justify-center">
                        <Zap className="w-4 h-4 fill-current text-amber-500" />
                      </div>
                      <span className="font-bold text-sm">{isSubscription ? 'باقات الاشتراكات' : 'باقات الشحن'}</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => navigateTo('history')}
                    className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-400/10 text-rose-500 flex items-center justify-center">
                        <Bell className="w-4 h-4 text-rose-500" />
                      </div>
                      <span className="font-bold text-sm">تاريخ الشحن</span>
                    </div>
                    {hasNewRecharge && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-black flex items-center gap-1">
                        <span className="w-1 h-1 bg-rose-500 rounded-full" />
                        شحن جديد
                      </span>
                    )}
                  </button>

                  {!currentStaff && (
                    <button 
                      onClick={() => navigateTo('staff')}
                      className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-400/10 text-teal-500 flex items-center justify-center">
                          <Users className="w-4 h-4" />
                        </div>
                        <span className="font-bold text-sm">موظفي الوردية</span>
                      </div>
                    </button>
                  )}
                  <button 
                    onClick={() => navigateTo('appearance')}
                    className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-400/10 text-indigo-500 flex items-center justify-center">
                        <Sliders className="w-4 h-4 text-indigo-500" />
                      </div>
                      <span className="font-bold text-sm">إعدادات المظهر</span>
                    </div>
                  </button>
                </div>

              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
                <button 
                  onClick={() => { setShowMenu(false); onLogout(); }}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-black text-sm outline-none"
                >
                  <LogOut className="w-5 h-5 rotate-180" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className={`max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto p-4 w-full flex-1 flex flex-col gap-4 md:gap-10 overscroll-contain overflow-y-auto ${isInputFocused ? 'gap-3 pt-3 pb-3' : 'gap-4'}`}>
        {/* Persistent, always mounted Balance Card to prevent unmount navigation glitches */}
        {(!isInputFocused || currentView !== 'main') && (
          <div className="flex gap-4 shrink-0 w-full select-none" id="persistent_balance_card">
            <div className={`flex-1 transition-all duration-300 py-2.5 md:py-6 px-4 md:px-10 rounded-[1.75rem] border flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden ${
              isSubscription
                ? (availableVehicles <= 1
                    ? 'bg-red-600 dark:bg-red-700 border-red-700 dark:border-red-600 text-white shadow-md shadow-red-500/20'
                    : availableVehicles === 2
                    ? 'bg-red-500/10 dark:bg-red-950/40 border-red-300 dark:border-red-800/80 text-red-600 dark:text-red-400'
                    : balanceTransition === 'decrease'
                    ? 'border-red-500/50 shadow-[0_4px_24px_rgba(239,68,68,0.12)] bg-[#faf9f6] dark:bg-slate-900'
                    : balanceTransition === 'increase'
                    ? 'border-emerald-500/50 shadow-[0_4px_24px_rgba(16,185,129,0.12)] bg-[#faf9f6] dark:bg-slate-900'
                    : 'bg-[#faf9f6] dark:bg-slate-900 border-slate-200 dark:border-slate-800')
                : (balanceTransition === 'decrease'
                    ? 'border-red-500/50 shadow-[0_4px_24px_rgba(239,68,68,0.12)] bg-[#faf9f6] dark:bg-slate-900'
                    : balanceTransition === 'increase'
                    ? 'border-emerald-500/50 shadow-[0_4px_24px_rgba(16,185,129,0.12)] bg-[#faf9f6] dark:bg-slate-900'
                    : 'bg-[#faf9f6] dark:bg-slate-900 border-slate-200 dark:border-slate-800')
            }`}>
              {/* Moving Arrows overlay */}
              <MovingBalanceArrows transitionType={balanceTransition} />

              <div className="py-1 flex items-center justify-center overflow-visible z-10">
                {isSubscription ? (
                  <div className={`text-2xl md:text-4xl font-black transition-colors duration-300 flex items-center gap-2 ${
                    availableVehicles <= 1
                      ? 'text-white'
                      : availableVehicles === 2
                      ? 'text-red-600 dark:text-red-400'
                      : balanceTransition === 'decrease'
                      ? 'text-red-600 dark:text-red-400'
                      : balanceTransition === 'increase'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : showBalanceWarning
                      ? 'text-red-500'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    <span>باقي</span>
                    <span className="text-4xl md:text-7xl font-extrabold font-mono tracking-tight">
                      <AnimatedCounter value={availableVehicles} disableColorChange={true} />
                    </span>
                    <span>{availableVehicles === 1 ? 'يوم' : availableVehicles === 2 ? 'يومين' : availableVehicles >= 3 && availableVehicles <= 10 ? 'أيام' : 'يوم'}</span>
                  </div>
                ) : (
                  <div className={`text-4xl md:text-7xl font-extrabold font-mono tracking-tight transition-colors duration-300 ${
                    balanceTransition === 'decrease'
                      ? 'text-red-600 dark:text-red-400'
                      : balanceTransition === 'increase'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : showBalanceWarning
                      ? 'text-red-500'
                      : 'text-slate-900 dark:text-slate-100'
                  }`}>
                    <AnimatedCounter value={availableVehicles} disableColorChange={true} />
                  </div>
                )}
              </div>
              {showBalanceWarning && (
                <p className={`text-[10px] md:text-sm font-black uppercase tracking-widest mt-1 transition-colors duration-300 z-10 ${
                  isSubscription && availableVehicles <= 1
                    ? 'text-white/90 font-black'
                    : isSubscription && availableVehicles === 2
                    ? 'text-red-600 dark:text-red-400'
                    : balanceTransition === 'decrease'
                    ? 'text-red-600 dark:text-red-400'
                    : balanceTransition === 'increase'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : availableVehicles <= 0
                    ? 'text-red-500'
                    : 'text-red-400'
                }`}>
                  {warningText}
                </p>
              )}
            </div>
          </div>
        )}

        {currentView === 'main' ? (
          <>
            <RegistrationCard 
              newPlateNumber={newPlateNumber}
              setNewPlateNumber={setNewPlateNumber}
              isInputFocused={isInputFocused}
              setIsInputFocused={setIsInputFocused}
              plateInputRef={plateInputRef}
              vehicles={vehicles}
              garage={garage}
              handleCheckIn={handleCheckIn}
              onCheckOut={(v) => {
                setSelectedVehicle(v);
                setShowCheckOutModal(true);
              }}
              closeKeyboard={closeKeyboard}
              inputRef={inputRef}
              shimmerActive={true}
              isBalanceOut={isBalanceOut}
            />

            {!isInputFocused && (
              <div className="bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[2rem] overflow-hidden flex flex-col items-center pt-4 md:pt-10 transition-colors w-full shadow-sm relative">
                <div 
                  onClick={() => setCurrentView('active_vehicles')}
                  className="mb-4 md:mb-10 scale-100 md:scale-110 cursor-pointer"
                >
                  <FlipNumber value={activeVehiclesCount} size="lg" />
                </div>
                
                <button 
                  onClick={() => setCurrentView('active_vehicles')}
                  className="w-full h-6 md:h-7 relative overflow-hidden group outline-none select-none flex items-center justify-center shrink-0 transition-colors"
                  style={{ backgroundColor: activeShimmerColor }}
                >
                  {/* Dark Center Chevron Badge */}
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div 
                      className={`w-7 h-7 md:w-8 h-8 rounded-full flex items-center justify-center border-2 shadow-md group-hover:scale-110 transition-all ${
                        isLightColor(activeShimmerColor) ? 'text-slate-900' : 'text-white'
                      }`}
                      style={{ 
                        backgroundColor: activeShimmerColor,
                        borderColor: `${activeShimmerColor}80`
                      }}
                    >
                      <ChevronDown className={`w-3.5 h-3.5 md:w-4 md:h-4 group-active:translate-y-0.5 transition-transform ${
                        isLightColor(activeShimmerColor) ? 'text-slate-900' : 'text-white'
                      }`} />
                    </div>
                  </div>
                </button>
              </div>
            )}

          </>
        ) : (
          <>
            {/* Live Activity Feed View (Taking Beautiful full width) */}
            <div className="bg-[#faf9f6] dark:bg-slate-900 rounded-[2rem] border border-slate-150 dark:border-slate-800 overflow-hidden flex flex-col flex-1 min-h-[400px] md:min-h-[500px] transition-colors w-full shadow-sm">
              <div className="p-3 md:p-4 px-4 md:px-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-11 md:h-11 bg-slate-900 dark:bg-slate-800 rounded-lg flex items-center justify-center text-white transition-all">
                    <Car className="w-4 h-4 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-sm md:text-lg uppercase tracking-tight">
                      إجمالى العدد {activeVehiclesCount}
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setCurrentView('main')}
                    className="w-8 h-8 md:w-11 md:h-11 bg-red-500 dark:bg-red-600 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none shadow-sm"
                  >
                    <X className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>

            <div ref={scrollContainerRef} className="divide-y divide-slate-100 dark:divide-slate-800 flex-1 overflow-y-auto custom-scrollbar overscroll-contain touch-pan-y bg-[#faf9f6] dark:bg-slate-900 transition-colors">
              {displayedVehicles.map(v => (
                <VehicleItem 
                  key={v.id} 
                  vehicle={v} 
                  onCheckOut={(vh) => {
                    closeKeyboard();
                    setSelectedVehicle(vh);
                    setShowCheckOutModal(true);
                  }} 
                />
              ))}

              {/* Load more sentinel */}
              {visibleCount < vehicles.length && (
                <div ref={loadMoreRef} className="py-8 flex justify-center items-center">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin" />
                </div>
              )}

              {vehicles.length === 0 && (
                <div className="py-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 dark:border-slate-800 transition-colors">
                    <Car className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                  </div>
                  <p className="text-slate-400 dark:text-slate-600 font-bold text-base md:text-lg">لا توجد سيارات حالياً</p>
                  {!isBalanceOut && (
                    <button 
                      onClick={() => setCurrentView('main')}
                      className="mt-6 text-sm md:text-base font-black text-emerald-500 uppercase tracking-widest border-b-2 border-emerald-500/20 pb-0.5"
                    >
                      سجل دخول عربية جديدة
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

        <div className={`mt-auto mb-2 py-4 flex items-center justify-center gap-3 select-none text-slate-400 dark:text-slate-500 font-bold text-[10px] md:text-xs tracking-wider uppercase transition-all duration-300 ${ (isInputFocused || currentView !== 'main') ? 'opacity-0 h-0 overflow-hidden pointer-events-none py-0 my-0' : 'opacity-100' }`}>
          <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" />
          <span className="brand-shimmer-text">ARQ FOR SOFTWARE DEVELOPMENT</span>
          <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" />
        </div>
      </main>

      {/* Lock Overlay - Only for Manual Lock */}
      {isManuallyLocked && (
        <div className="fixed inset-0 z-[90] bg-slate-900/95 flex items-center justify-center p-6 text-center">
          <div className="max-w-sm w-full">
            <div className="w-20 h-20 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-red-500" />
            </div>
            
            <h2 className="text-2xl font-black text-white mb-3">
              الجراج مغلق حالياً
            </h2>
            
            <div className="space-y-4 mb-8">
              <p className="text-slate-400 text-sm font-medium leading-relaxed px-4">
                {garage.lockReason || 'تم تعليق الخدمة مؤقتاً، يرجى التواصل مع الإدارة.'}
              </p>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 inline-block">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">رقم الإدارة</p>
                <p className="text-xl font-black text-white font-mono tracking-widest" dir="ltr">{walletNumber}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSubscribers && (
        <SubscribersView 
          garage={garage}
          onClose={() => setShowSubscribers(false)}
          showToast={showToast}
          onToggleMenu={() => setShowMenu(!showMenu)}
        />
      )}

      {showRechargeHistory && (
        <RechargeHistoryView 
          garage={garage}
          onClose={() => {
            setShowRechargeHistory(false);
            setHasNewRecharge(false);
          }}
          showToast={showToast}
          onToggleMenu={() => setShowMenu(!showMenu)}
        />
      )}

      {showPackages && (
        <PackagesModal 
          packages={packages}
          onClose={() => setShowPackages(false)}
          garageHourlyRate={garage.hourlyRate}
          walletNumber={walletNumber}
          onToggleMenu={() => setShowMenu(!showMenu)}
          billingModel={garage.billingModel}
          subscriptionPrices={subscriptionPrices}
          referralBonusBalance={garage.referralBonusBalance || 0}
          hasMonthlySubscribers={garage.hasMonthlySubscribers}
        />
      )}

      {showStaffStats && !currentStaff && (
        <StaffStatsModal 
          staffList={staffList}
          vehiclesInside={vehicles}
          todayExitedVehicles={todayTransactions}
          onClose={() => setShowStaffStats(false)}
          now={now}
          onToggleMenu={() => setShowMenu(!showMenu)}
        />
      )}

      {showGarageReports && !currentStaff && (
        <GarageReportsView 
          garage={garage}
          vehiclesInside={vehicles}
          todayExitedVehicles={todayTransactions}
          staffList={staffList}
          onClose={() => setShowGarageReports(false)}
          onToggleMenu={() => setShowMenu(!showMenu)}
        />
      )}

      {showAppearanceSettings && (
        <AppearanceSettingsModal
          garage={garage}
          currentStaff={currentStaff}
          onClose={() => setShowAppearanceSettings(false)}
          showToast={showToast}
          onToggleMenu={() => setShowMenu(!showMenu)}
        />
      )}

      {/* Recharge Notification Popup */}
      {showRechargePopup && latestRechargeInfo && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 z-[110] flex items-center justify-center p-4 animate-none"
          onClick={handleCloseRechargePopup}
        >
          <div
            className="w-full max-w-md bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-xl p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Decorative glowing green circle */}
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button inside modal as fallback */}
            <button
              onClick={handleCloseRechargePopup}
              className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm outline-none"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Content */}
            <div className="text-center mt-4">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-500/10">
                <Zap className="w-8 h-8 fill-current" />
              </div>

              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                تم شحن الرصيد بنجاح!
              </h3>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-6">
                رصيد جديد مضاف إلى الحساب الخاص بالجراج
              </p>

              {/* Details Card */}
              <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4.5 text-right space-y-3.5 border border-slate-100 dark:border-slate-800/50 mb-6">
                <div className="flex justify-between items-start gap-4">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 flex-shrink-0">اسم الباقة:</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white leading-tight text-left">
                    {latestRechargeInfo.plateNumber}
                  </span>
                </div>

                <div className="w-full border-t border-slate-200/40 dark:border-slate-850/40" />

                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">القيمة المالية:</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {latestRechargeInfo.amount !== undefined ? `${latestRechargeInfo.amount} ج.م` : 'مجانية'}
                  </span>
                </div>

                <div className="w-full border-t border-slate-200/40 dark:border-slate-850/40" />

                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500">الوقت والتاريخ:</span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                    {formatTimeLocal(latestRechargeInfo.timestamp)} - {formatDateLocal(latestRechargeInfo.timestamp)}
                  </span>
                </div>

                {latestRechargeInfo.staffName && (
                  <>
                    <div className="w-full border-t border-slate-200/40 dark:border-slate-850/40" />
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500">بواسطة:</span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                        {latestRechargeInfo.staffName.includes('مدير النظام') || latestRechargeInfo.staffName.toLowerCase().includes('admin')
                          ? 'مدير النظام'
                          : latestRechargeInfo.staffName}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Close Button */}
              <button
                onClick={handleCloseRechargePopup}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-lg shadow-emerald-600/10 dark:shadow-emerald-600/5 uppercase tracking-wider block"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Expiry Alert Modal (Last Day Alert) */}
      {showLastDaySubModal && (
        <div
          className="fixed inset-0 bg-slate-900/70 dark:bg-slate-950/85 z-[120] flex items-center justify-center p-4 animate-fade-in"
          onClick={handleCloseSubModal}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border-2 border-red-500/30 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden text-right"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Background glow accent */}
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Close button */}
            <button
              onClick={handleCloseSubModal}
              className="absolute top-4 left-4 w-9 h-9 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full flex items-center justify-center transition-colors outline-none"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Content */}
            <div className="text-center mt-2">
              <div className="w-16 h-16 bg-red-500/15 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/20 shadow-sm">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white mb-2">
                تنبيه انتهاء الاشتراك
              </h3>

              <p className="text-sm md:text-base font-black text-red-600 dark:text-red-400 mb-4 leading-relaxed bg-red-50 dark:bg-red-950/40 p-4 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-inner">
                إشتراكك هينتهى النهاردة الحق اشحن قبل الساعة 5 علشان تقدر تكمل شغل
              </p>

              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                يرجى طلب تجديد الاشتراك من باقات الاشتراكات مع المندوب الخاص بك لتجنب توقف الخدمة.
              </p>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    handleCloseSubModal();
                    setShowPackages(true);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3.5 px-6 rounded-2xl font-black text-sm md:text-base transition-all shadow-lg shadow-red-600/20 uppercase tracking-wider block outline-none"
                >
                  طلب تجديد الاشتراك الآن
                </button>

                <button
                  onClick={handleCloseSubModal}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 px-6 rounded-2xl font-bold text-xs transition-all outline-none"
                >
                  تذكيري لاحقاً
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
