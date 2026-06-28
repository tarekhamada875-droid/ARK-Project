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
  Moon, 
  Sun,
  Bell,
  PieChart
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
import { firestoreService } from '../../services/firestoreService';
import { useTheme } from '../../utils/ThemeContext';
import { soundManager } from '../../utils/sounds';
import { auth } from '../../firebase';

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
  walletNumber = "015 - 524 - 113 - 23"
}: GarageDashboardViewProps) => {
  const [showMenu, setShowMenu] = React.useState(false);
  const [currentView, setCurrentView] = React.useState<'main' | 'active_vehicles'>('main');
  
  const [visibleCount, setVisibleCount] = React.useState(15);
  const [subscribersCount, setSubscribersCount] = React.useState(0);
  const [showRechargeHistory, setShowRechargeHistory] = React.useState(false);
  const [hasNewRecharge, setHasNewRecharge] = React.useState(false);
  const [latestRechargeInfo, setLatestRechargeInfo] = React.useState<any | null>(null);
  const [showRechargePopup, setShowRechargePopup] = React.useState(false);
  const [showGarageReports, setShowGarageReports] = React.useState(false);
  const loadMoreRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const [isAuthResolved, setIsAuthResolved] = React.useState(!!auth.currentUser);

  React.useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setIsAuthResolved(!!u);
    });
    return () => unsubscribe();
  }, []);

  const { theme, toggleTheme } = useTheme();

  const currentBalance = React.useMemo(() => garage.balance || 0, [garage.balance]);
  const commission = React.useMemo(() => garage.commissionPerVehicle || 1, [garage.commissionPerVehicle]);
  const availableVehicles = React.useMemo(() => Math.max(0, Math.floor(currentBalance / commission)), [currentBalance, commission]);

  const [balanceTransition, setBalanceTransition] = React.useState<'increase' | 'decrease' | null>(null);
  const prevVehiclesRef = React.useRef(availableVehicles);

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
    const unsub = firestoreService.subscribeToGarageActivityLogs(garage.id, (allLogs) => {
      const recharges = allLogs
        .filter((l: any) => l.actionType === 'recharge')
        .sort((a: any, b: any) => {
          const tA = a.timestamp?.seconds || 0;
          const tB = b.timestamp?.seconds || 0;
          return tB - tA;
        });
      
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
          
          {/* Dropdown Menu Overlay - Upgraded to Floating Side Sheet Drawer */}
          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowMenu(false)}
                  className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm z-50 pointer-events-auto"
                />
                
                <motion.div 
                  initial={{ x: '-100%', opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: '-100%', opacity: 0 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                  className="fixed top-3 bottom-3 left-3 w-[220px] xs:w-[245px] bg-[#faf9f6] dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800/80 z-50 flex flex-col overflow-hidden pointer-events-auto"
                  dir="rtl"
                >
                  {/* Drawer Header - Clean Profile Box */}
                  <div className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-600 flex items-center justify-center text-white font-extrabold shrink-0">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate max-w-[105px]">
                            {currentStaff ? currentStaff.name : 'المدير'}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
                            {currentStaff ? 'موظف وردية' : 'مسؤول النظام'}
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
                          onClick={() => { setShowMenu(false); setShowSubscribers(true); }}
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
                          onClick={() => { setShowMenu(false); setShowGarageReports(true); }}
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
                        onClick={() => { setShowMenu(false); setShowPackages(true); }}
                        className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-400/10 text-amber-500 flex items-center justify-center">
                            <Zap className="w-4 h-4 fill-current text-amber-500" />
                          </div>
                          <span className="font-bold text-sm">باقات الشحن</span>
                        </div>
                      </button>

                      <button 
                        onClick={() => { setShowMenu(false); setShowRechargeHistory(true); }}
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
                          onClick={() => { setShowMenu(false); setShowStaffStats(true); }}
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
                    </div>

                    {/* Quick Setting / Theme Group */}
                    <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/40">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-bold text-xs text-slate-400 dark:text-slate-500 pr-1 select-none">وضع الشاشة:</span>
                        <div className="flex gap-2">
                          {/* النهارى (Light Mode) Button */}
                          <button 
                            type="button"
                            onClick={() => {
                              if (theme !== 'light') toggleTheme();
                              setShowMenu(false);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border transition-all outline-none font-bold text-sm ${
                              theme === 'light'
                                ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.01]'
                                : 'bg-[#faf9f6] dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'stroke-[2.5px]' : ''}`} />
                            <span>النهاري</span>
                          </button>

                          {/* الليلى (Dark Mode) Button */}
                          <button 
                            type="button"
                            onClick={() => {
                              if (theme !== 'dark') toggleTheme();
                              setShowMenu(false);
                            }}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border transition-all outline-none font-bold text-sm ${
                              theme === 'dark'
                                ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.01]'
                                : 'bg-[#faf9f6] dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800'
                            }`}
                          >
                            <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'stroke-[2.5px]' : ''}`} />
                            <span>الليلي</span>
                          </button>
                        </div>
                      </div>
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
        </header>
      )}

      <main className={`max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto p-4 w-full flex-1 flex flex-col gap-4 md:gap-10 overscroll-contain overflow-y-auto ${isInputFocused ? 'gap-3 pt-3 pb-3' : 'gap-4'}`}>
        {/* Persistent, always mounted Balance Card to prevent unmount navigation glitches */}
        {(!isInputFocused || currentView !== 'main') && (
          <div className="flex gap-4 shrink-0 w-full select-none" id="persistent_balance_card">
            <div className={`flex-1 transition-all duration-300 py-2.5 md:py-6 px-4 md:px-10 rounded-[1.75rem] border flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden bg-[#faf9f6] dark:bg-slate-900 ${
              balanceTransition === 'decrease'
                ? 'border-red-500/50 shadow-[0_4px_24px_rgba(239,68,68,0.12)]'
                : balanceTransition === 'increase'
                ? 'border-emerald-500/50 shadow-[0_4px_24px_rgba(16,185,129,0.12)]'
                : 'border-slate-200 dark:border-slate-800'
            }`}>
              {/* Moving Arrows overlay */}
              <MovingBalanceArrows transitionType={balanceTransition} />

              <div className="py-1 flex items-center justify-center overflow-visible z-10">
                <div className={`text-4xl md:text-7xl font-extrabold font-mono tracking-tight transition-colors duration-300 ${
                  balanceTransition === 'decrease'
                    ? 'text-red-600 dark:text-red-400'
                    : balanceTransition === 'increase'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : availableVehicles < 50
                    ? 'text-red-500'
                    : 'text-slate-900 dark:text-slate-100'
                }`}>
                  <AnimatedCounter value={availableVehicles} disableColorChange={true} />
                </div>
              </div>
              {availableVehicles < 50 && (
                <p className={`text-[10px] md:text-sm font-black uppercase tracking-widest mt-1 transition-colors duration-300 z-10 ${
                  balanceTransition === 'decrease'
                    ? 'text-red-600 dark:text-red-400'
                    : balanceTransition === 'increase'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : availableVehicles <= 0
                    ? 'text-red-500'
                    : 'text-red-400'
                }`}>
                  {availableVehicles <= 0 ? 'الرصيد انتهى تماماً' : 'الرصيد الحالى قرب يخلص'}
                </p>
              )}
            </div>
          </div>
        )}

        {currentView === 'main' ? (
          <>
            {!isBalanceOut ? (
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
              />
            ) : (
              <div className="bg-[#faf9f6] dark:bg-slate-900 border-2 border-red-100 dark:border-red-900/30 rounded-[2rem] p-8 md:p-12 text-center transition-colors w-full">
                <p className="text-base md:text-xl font-bold text-slate-900 dark:text-white leading-relaxed mb-6">
                  رصيدك خلص اختار باقتك من صفحة الباقات و اشحنها مع المندوب الخاص بيك
                </p>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => setShowPackages(true)}
                    className="w-full py-4 md:py-6 bg-slate-900 text-white rounded-2xl font-black text-sm md:text-base uppercase tracking-widest hover:bg-slate-800"
                  >
                    فتح صفحة الباقات
                  </button>
                </div>
              </div>
            )}

            {!isInputFocused && (
              <div className="bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-800 rounded-[2rem] overflow-hidden flex flex-col items-center pt-4 md:pt-10 transition-colors w-full shadow-sm">
                <div 
                  onClick={() => setCurrentView('active_vehicles')}
                  className="mb-4 md:mb-10 scale-100 md:scale-110"
                >
                  <FlipNumber value={vehicles.length} size="lg" />
                </div>
                
                <button 
                  onClick={() => setCurrentView('active_vehicles')}
                  className="w-full h-6 md:h-7 relative overflow-hidden group outline-none select-none flex items-center justify-center shrink-0 bg-[#1e293b] dark:bg-slate-950 transition-colors"
                >
                  <style>{`
                    .stripes-right {
                      width: 100%;
                      background-image: repeating-linear-gradient(
                        -45deg,
                        #ef4444,
                        #ef4444 3.5px,
                        #1e293b 3.5px,
                        #1e293b 7px
                      );
                      background-size: 14px 14px;
                      filter: blur(1.2px);
                    }
                    .stripes-left {
                      width: 100%;
                      background-image: repeating-linear-gradient(
                        45deg,
                        #ef4444,
                        #ef4444 3.5px,
                        #1e293b 3.5px,
                        #1e293b 7px
                      );
                      background-size: 14px 14px;
                      filter: blur(1.2px);
                    }
                  `}</style>
                  
                  {/* Left Half (flowing left-to-right) */}
                  <div 
                    className="absolute top-0 left-0 w-[calc(50%-16px)] h-full overflow-hidden"
                    style={{
                      WebkitMaskImage: 'linear-gradient(to right, black 50%, transparent 100%)',
                      maskImage: 'linear-gradient(to right, black 50%, transparent 100%)'
                    }}
                  >
                    <div className="absolute top-0 left-0 h-full stripes-left" />
                  </div>

                  {/* Right Half (flowing right-to-left) */}
                  <div 
                    className="absolute top-0 right-0 w-[calc(50%-16px)] h-full overflow-hidden"
                    style={{
                      WebkitMaskImage: 'linear-gradient(to left, black 50%, transparent 100%)',
                      maskImage: 'linear-gradient(to left, black 50%, transparent 100%)'
                    }}
                  >
                    <div className="absolute top-0 left-0 h-full stripes-right" />
                  </div>

                  {/* Dark Center Chevron Badge */}
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="w-7 h-7 md:w-8 h-8 bg-slate-900 dark:bg-slate-950 text-white rounded-full flex items-center justify-center border-2 border-slate-800 dark:border-slate-800 shadow-md group-hover:scale-110 transition-all">
                      <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-white group-active:translate-y-0.5 transition-transform" />
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
                      إجمالى العدد {vehicles.length}
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
        />
      )}

      {showPackages && (
        <PackagesModal 
          packages={packages}
          onClose={() => setShowPackages(false)}
          garageHourlyRate={garage.hourlyRate}
          walletNumber={walletNumber}
        />
      )}

      {showStaffStats && !currentStaff && (
        <StaffStatsModal 
          staffList={staffList}
          vehiclesInside={vehicles}
          todayExitedVehicles={todayTransactions}
          onClose={() => setShowStaffStats(false)}
          now={now}
        />
      )}

      {showGarageReports && !currentStaff && (
        <GarageReportsView 
          garage={garage}
          vehiclesInside={vehicles}
          todayExitedVehicles={todayTransactions}
          staffList={staffList}
          onClose={() => setShowGarageReports(false)}
        />
      )}

      {/* Recharge Notification Popup */}
      {showRechargePopup && latestRechargeInfo && (
        <div
          className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-none"
          onClick={handleCloseRechargePopup}
        >
          <div
            className="w-full max-w-md bg-[#faf9f6] dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            {/* Decorative glowing green circle */}
            <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            {/* Close Button inside modal as fallback */}
            <button
              onClick={handleCloseRechargePopup}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors bg-slate-55 dark:bg-slate-800/50 p-2 rounded-xl outline-none"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
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
    </div>
  );
});
