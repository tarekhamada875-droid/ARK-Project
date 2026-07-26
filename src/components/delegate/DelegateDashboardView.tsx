import React, { useState, memo } from 'react';
import { 
  Building2, 
  Search, 
  PlusCircle, 
  LogOut, 
  Users,
  CheckCircle2,
  X,
  Loader2,
  Sun,
  Moon,
  MoreVertical,
  RefreshCw,
  BarChart3,
  Coins,
  TrendingUp,
  XCircle,
  AlertCircle,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Garage, Delegate, Package, RechargeRequest } from '../../types';
import { useTheme } from '../../utils/ThemeContext';
import { generateSafePin, safeDate } from '../../utils';
import { AnimatedCounter } from '../AnimatedCounter';

interface DelegateDashboardViewProps {
  delegate: Delegate;
  allGarages: Garage[];
  onLogout: () => void;
  onRecharge: (garageId: string, amount: number, pkg?: Package) => Promise<void>;
  onCreateGarage: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  isLoading: boolean;
  packages: Package[];
  pendingRequests: RechargeRequest[];
  delegateRequests?: RechargeRequest[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  subscriptionPrices?: { weekly: number; monthly: number };
}

export const DelegateDashboardView = memo(({ 
  delegate, 
  allGarages, 
  onLogout,
  onRecharge,
  onCreateGarage,
  isLoading,
  packages,
  pendingRequests,
  delegateRequests = [],
  showToast,
  subscriptionPrices = { weekly: 800, monthly: 3000 }
}: DelegateDashboardViewProps) => {
  const [activeTab, setActiveTab] = useState<'garages' | 'performance'>('garages');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);
  const [pendingPackage, setPendingPackage] = useState<Package | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showAddGarage, setShowAddGarage] = useState(false);
  const [newGaragePin, setNewGaragePin] = useState('');
  const [pinGenerationsRemaining, setPinGenerationsRemaining] = useState(3);
  const [showMenu, setShowMenu] = useState(false);
  const [delegateBillingModel, setDelegateBillingModel] = useState<'commission' | 'subscription'>('commission');
  const [delegateSubscriptionType, setDelegateSubscriptionType] = useState<'weekly' | 'monthly'>('weekly');
  const { theme, toggleTheme } = useTheme();

  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (showAddGarage || selectedGarage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddGarage, selectedGarage]);

  const filteredGarages = allGarages.filter(g => 
    g.name.includes(searchTerm) || (g.phone || '').includes(searchTerm)
  );

  const handleRechargeSubmit = async (customAmount?: number, pkg?: Package) => {
    if (!selectedGarage) return;
    
    // Determine amount and package
    let amount = customAmount || 0;
    
    if (isNaN(amount) || (amount <= 0 && !pkg)) return;

    setIsProcessing(true);
    try {
      await onRecharge(selectedGarage.id, amount, pkg);
      setSuccess(true);
      setPendingPackage(null);
      setTimeout(() => {
        setSuccess(false);
        setSelectedGarage(null);
      }, 2000);
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Performance and statistics calculations
  const totalRechargedAmount = delegate.totalRechargedAmount || 0;
  const commissionRate = delegate.commissionRate || 0;
  const commissionValue = (totalRechargedAmount * commissionRate) / 100;

  const sortedRequests = React.useMemo(() => {
    return [...delegateRequests].sort((a, b) => {
      const timeA = a.createdAt?.seconds 
        ? a.createdAt.seconds * 1000 
        : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.seconds 
        ? b.createdAt.seconds * 1000 
        : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
  }, [delegateRequests]);

  const formatRequestDate = (createdAt: any) => {
    if (!createdAt) return 'مؤخراً';
    const d = safeDate(createdAt);
    if (isNaN(d.getTime())) return 'مؤخراً';
    return d.toLocaleString('ar-EG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={`h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors overflow-x-hidden ${showAddGarage || selectedGarage ? 'overflow-hidden' : 'overflow-y-auto'}`} dir="rtl">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 sticky top-0 z-40 transition-colors">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white overflow-hidden transform rotate-3">
              <Users className="w-4 h-4 -rotate-3" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-white leading-tight">لوحة المندوب</h1>
              <p className="text-[10px] font-medium text-slate-400">{delegate.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all outline-none border-2 ${showMenu ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
            >
              <MoreVertical className="w-5 h-5 text-slate-600 dark:text-slate-400 stroke-[3]" />
            </button>

            {showMenu && (
              <>
                {/* Backdrop to prevent the menu from melting into the background */}
                <div 
                  className="fixed inset-0 z-40 bg-slate-900/10 dark:bg-black/35 backdrop-blur-[2px]" 
                  onClick={() => setShowMenu(false)}
                />
                
                <div className="absolute top-14 left-0 w-64 bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-emerald-500/40 shadow-2xl shadow-slate-300 dark:shadow-slate-950/80 rounded-[2rem] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 flex flex-col gap-2">
                    <span className="font-bold text-xs text-slate-400 dark:text-slate-500 pr-1 select-none text-right">وضع الشاشة:</span>
                    <div className="flex gap-2">
                      {/* النهارى (Light Mode) Button */}
                      <button 
                        type="button"
                        onClick={() => {
                          if (theme !== 'light') toggleTheme();
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border transition-all outline-none font-bold text-xs ${
                          theme === 'light'
                            ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border transition-all outline-none font-bold text-xs ${
                          theme === 'dark'
                            ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'stroke-[2.5px]' : ''}`} />
                        <span>الليلي</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2 space-y-1 border-t border-slate-100 dark:border-slate-800/60">

                    <button 
                      onClick={() => {
                        onLogout();
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-right hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-2xl transition-colors group"
                    >
                      <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform rotate-180" />
                      <span className="font-bold text-sm">تسجيل الخروج</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 w-full flex-1 flex flex-col gap-6">
        {/* Tab Switcher */}
        <div className="flex bg-slate-105 dark:bg-slate-900/60 p-1 rounded-2xl max-w-sm w-full border border-slate-200/40 dark:border-slate-800/40 self-start shrink-0">
          <button
            onClick={() => setActiveTab('garages')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all focus:outline-none ${
              activeTab === 'garages'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>جراجاتي</span>
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all focus:outline-none ${
              activeTab === 'performance'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/30'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>تقرير الأداء</span>
          </button>
        </div>

        {activeTab === 'garages' ? (
          <>
            {/* Search */}
            <div className="relative group shrink-0 w-full max-w-sm sm:max-w-md md:max-w-xl transition-all">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-300 dark:text-slate-600 group-focus-within:text-emerald-500 transition-colors" />
              <input
                type="text"
                placeholder="ابحث باسم الجراج أو رقم الموبايل..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl py-3 sm:py-5 pr-11 sm:pr-14 pl-4 text-sm sm:text-base md:text-lg font-medium text-slate-900 dark:text-white placeholder:text-slate-200 dark:placeholder:text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-bold"
              />
            </div>

            {/* Garage List */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
              {filteredGarages.map(g => {
                const isPending = g.status === 'pending';
                const hasPending = pendingRequests.some(r => r.garageId === g.id);
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      if (isPending) {
                        showToast('عذراً، هذا الجراج قيد المراجعة والإنشاء من قبل الإدارة. يرجى الانتظار حتى تتم الموافقة عليه.', 'error');
                        return;
                      }
                      if (hasPending) {
                        showToast('هناك طلب شحن معلق بالفعل لم يتم تفعيله بعد من قبل الإدارة', 'error');
                        return;
                      }
                      setSelectedGarage(g);
                    }}
                    className={`bg-white dark:bg-slate-900/40 border-2 rounded-2xl sm:rounded-[2rem] cursor-pointer group flex flex-col justify-between h-36 sm:h-48 md:h-56 overflow-hidden transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 relative text-right w-full ${
                      isPending 
                        ? 'border-dashed border-slate-200 dark:border-slate-800 opacity-75' 
                        : 'border-slate-105 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500'
                    } ${hasPending ? 'opacity-95' : ''}`}
                  >
                    {/* Header */}
                    <div className={`px-4 py-3.5 sm:py-5 text-center border-b border-emerald-600/10 shadow-sm shrink-0 flex items-center justify-center w-full ${
                      isPending 
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' 
                        : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                    }`}>
                      <h3 className={`font-black text-center text-xs sm:text-base md:text-lg lg:text-xl truncate leading-none w-full ${isPending ? 'text-slate-500 dark:text-slate-400' : 'text-white'}`}>
                        {g.name}
                      </h3>
                    </div>

                    {/* Card Body */}
                    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 relative bg-slate-50/25 dark:bg-slate-900/15 w-full">
                      <Building2 className={`w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 transition-all duration-300 ${
                        isPending 
                          ? 'text-slate-300 dark:text-slate-700' 
                          : 'text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400'
                      }`} />
                      
                      {isPending ? (
                        <div className="absolute bottom-2 sm:bottom-4 inset-x-2 text-center">
                          <span className="inline-block text-[8.5px] sm:text-xs font-black px-2.5 py-1 sm:py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60 uppercase tracking-widest leading-none">
                            قيد مراجعة الإنشاء
                          </span>
                        </div>
                      ) : hasPending && (
                        <div className="absolute bottom-2 sm:bottom-4 inset-x-2 text-center">
                          <span className="inline-block text-[8px] sm:text-xs font-black px-2.5 py-0.5 sm:py-1.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest leading-none">
                            طلب معلق
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredGarages.length === 0 && (
              <div className="text-center py-20 bg-white dark:bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                </div>
                <p className="text-slate-400 dark:text-slate-600 font-bold">لا توجد جراجات مطابقة للبحث</p>
              </div>
            )}
          </>
        ) : (
          /* Performance Report View */
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-200">
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              
              {/* Total Recharges Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group transition-all hover:shadow-md">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-400/5 rounded-full -translate-x-12 -translate-y-12 group-hover:scale-110 transition-transform duration-300" />
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-400/10 dark:bg-emerald-400/20 flex items-center justify-center text-emerald-500">
                    <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">شحن الرصيد</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 leading-none">إجمالي مبيعات الشحن</p>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none tracking-tight">
                    {totalRechargedAmount.toLocaleString('en-US')} <span className="text-xs font-bold text-slate-400 mr-1">ج.م</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-3 font-semibold">مجموع المبيعات التي قمت بإجرائها لكل الجراجات الخاصة بك</p>
                </div>
              </div>

              {/* Commission Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group transition-all hover:shadow-md">
                <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-x-12 -translate-y-12 group-hover:scale-110 transition-transform duration-300" />
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-500">
                    <Coins className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10">الأرباح</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 leading-none">أرباح العمولات المستحقة</p>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none tracking-tight">
                    {commissionValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-slate-400 mr-1">ج.م</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-3 font-semibold">
                    محسوبة بناءً على نسبة عمولاتك المحددة وهي <span className="font-bold text-emerald-500 font-mono text-xs">{commissionRate}%</span>
                  </p>
                </div>
              </div>

              {/* Registered Garages Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group transition-all hover:shadow-md">
                <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-x-12 -translate-y-12 group-hover:scale-110 transition-transform duration-300" />
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                    <Building2 className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                  </div>
                  <span className="text-[9px] sm:text-[10px] font-black px-2.5 py-1 rounded-full bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 border border-indigo-500/10">الشبكة</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mb-1 leading-none">مجموع الجراجات</p>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono leading-none tracking-tight">
                    {allGarages.length} <span className="text-xs font-bold text-slate-400 mr-1">موقع</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-3 font-semibold">عدد الجراجات النشطة التي قمت بإنشائها وتفعيلها</p>
                </div>
              </div>

            </div>

            {/* Performance Summary Banner */}
            <div className="bg-gradient-to-r from-emerald-600/10 via-emerald-600/5 to-transparent border border-emerald-600/20 rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center text-white shrink-0">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-950 dark:text-white text-sm sm:text-base">إحصائيات فريدة يا {delegate.name}!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">تقوم بإدارة جراجاتك بكل ثقة ومتابعة مستمرة لعمولاتك ومبيعاتك.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="bg-white/50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800 rounded-xl px-4 py-2 text-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">طلبات معلقة</span>
                  <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-550 font-mono tracking-tight">
                    {sortedRequests.filter(r => r.status === 'pending').length}
                  </span>
                </div>
                <div className="bg-white/50 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800 rounded-xl px-4 py-2 text-center shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">طلبات مقبولة</span>
                  <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight">
                    {sortedRequests.filter(r => r.status === 'approved').length}
                  </span>
                </div>
              </div>
            </div>

            {/* History Table/List Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-[2rem] p-5 sm:p-6 shadow-sm overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">سجل العمليات الأخير</h3>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500">حالة وتفاصيل آخر طلبات الشحن المقدمة لجراجاتك</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-55 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-600">
                  <Calendar className="w-5 h-5" />
                </div>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {sortedRequests.map((req) => (
                  <div 
                    key={req.id} 
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl sm:rounded-2xl gap-3 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 font-black text-sm shrink-0">
                        <Coins className="w-5 h-5 text-emerald-550" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm">{req.garageName}</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span>باقة {req.packageName}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                          <span className="font-mono text-[9px]">{formatRequestDate(req.createdAt)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto mt-2 sm:mt-0 border-t border-dashed border-slate-200/50 dark:border-slate-850 pt-2 sm:pt-0">
                      <div className="text-right pl-4">
                        <span className="text-[9px] font-bold text-slate-400 block leading-none">مبلغ الشحن</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{req.revenueAmount} ج.م</span>
                      </div>

                      {/* Status badge */}
                      {req.status === 'pending' && (
                        <div className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black leading-none">في الانتظار</span>
                        </div>
                      )}
                      {req.status === 'approved' && (
                        <div className="flex items-center gap-1.5 py-1.5 px-3 bg-emerald-500/10 border border-emerald-500/15 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black leading-none">تم القبول</span>
                        </div>
                      )}
                      {req.status === 'rejected' && (
                        <div className="flex items-center gap-1.5 py-1.5 px-3 bg-red-500/10 border border-red-500/15 rounded-xl text-red-600 dark:text-red-400 shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black leading-none">مرفوض</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {sortedRequests.length === 0 && (
                  <div className="text-center py-12">
                    <Calendar className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-3" />
                    <p className="text-sm text-slate-400 font-bold">لا توجد عمليات شحن سابقة مسجلة لك بعد</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Add Garage Button (Floating) */}
      {delegate.canCreateGarage && (
        <button
          onClick={() => {
            const initialPin = generateSafePin(allGarages.map(g => g.pin));
            setNewGaragePin(initialPin);
            setPinGenerationsRemaining(3);
            setShowAddGarage(true);
          }}
          className="fixed bottom-6 left-6 w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center hover:bg-emerald-700 transition-all z-40"
        >
          <PlusCircle className="w-8 h-8" />
        </button>
      )}

      {/* Add Garage Modal */}
      {showAddGarage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm overflow-y-auto" onClick={() => setShowAddGarage(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-xl p-8 relative my-auto border border-slate-200 dark:border-slate-800 transition-colors" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                  <PlusCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">إضافة جراج جديد</h2>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">تسجيل جراج جديد وتحديد التعريفة</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddGarage(false)}
                className="w-10 h-10 bg-red-500 dark:bg-red-600 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form 
              onSubmit={async (e) => {
                await onCreateGarage(e);
                setShowAddGarage(false);
              }}
              className="space-y-5"
            >
              {/* Step 1: Identity */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest">اسم الجراج</label>
                <input name="name" placeholder="جراج التوفيق" required className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700" dir="rtl" />
              </div>

              {/* Step 2: Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 text-center">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">سعر الساعة</label>
                  <div className="relative">
                    <input name="hourlyRate" type="text" inputMode="numeric" placeholder="10" required className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold text-center outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 font-mono text-xl" dir="ltr" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 dark:text-slate-600 font-bold">ج.م</span>
                  </div>
                </div>
                <div className="space-y-2 text-center">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">سعر المبيت</label>
                  <div className="relative">
                    <input name="overnightRate" type="text" inputMode="numeric" placeholder="50" required className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold text-center outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 font-mono text-xl" dir="ltr" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 dark:text-slate-600 font-bold">ج.م</span>
                  </div>
                </div>
              </div>

              {/* طريقة الحساب */}
              <div className="space-y-2 text-right">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest">طريقة الحساب بالجراج</label>
                <select 
                  name="billingModel" 
                  value={delegateBillingModel}
                  onChange={(e) => setDelegateBillingModel(e.target.value as any)}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 appearance-none transition-all" 
                  dir="rtl"
                >
                  <option value="commission">بالعمولة (شحن سيارات)</option>
                  <option value="subscription">بالاشتراك (أسبوعي/شهري)</option>
                </select>
              </div>

              {/* Subscription Type (Only if Subscription is selected) */}
              {delegateBillingModel === 'subscription' && (
                <div className="space-y-2 text-right animate-in fade-in duration-200">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest">نوع الاشتراك الابتدائي</label>
                  <select 
                    name="subscriptionType" 
                    value={delegateSubscriptionType}
                    onChange={(e) => setDelegateSubscriptionType(e.target.value as any)}
                    className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 appearance-none transition-all" 
                    dir="rtl"
                  >
                    <option value="weekly">اشتراك أسبوعي - {subscriptionPrices.weekly} ج.م</option>
                    <option value="monthly">اشتراك شهري - {subscriptionPrices.monthly} ج.م</option>
                  </select>
                </div>
              )}

              {/* Step 4: Contact */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest">رقم الموبايل (اختياري)</label>
                <input name="phone" placeholder="01xxxxxxxxx" className="w-full p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold font-mono tracking-wider outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700" dir="ltr" />
              </div>

              {/* Step 4.5: PIN */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest">رمز الدخول (PIN)</label>
                <div className="relative">
                  <input 
                    name="pin" 
                    type="text" 
                    value={newGaragePin}
                    readOnly
                    required 
                    className="w-full p-4 bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-bold font-mono tracking-wider outline-none cursor-not-allowed text-center pl-14" 
                    dir="ltr" 
                  />
                  {pinGenerationsRemaining > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextPin = generateSafePin(allGarages.map(g => g.pin));
                        setNewGaragePin(nextPin);
                        setPinGenerationsRemaining(prev => prev - 1);
                      }}
                      className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
                      title="توليد رقم سري عشوائي"
                    >
                      <RefreshCw className="w-5 h-5 mx-auto" strokeWidth={2} />
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between px-2 gap-1">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 text-right leading-relaxed">
                    * هذا الرمز يتم توليده تلقائياً لحماية الحساب من التكرار والتداخل.
                  </span>
                  {pinGenerationsRemaining > 0 ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap text-left sm:text-right">
                      متبقي {pinGenerationsRemaining} {pinGenerationsRemaining === 1 ? 'محاولة' : 'محاولات'} لتغييره تلقائياً.
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-red-500 dark:text-red-400 whitespace-nowrap text-left sm:text-right">
                      استنفدت محاولات التغيير.
                    </span>
                  )}
                </div>
              </div>



              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white rounded-xl py-5 font-bold text-lg hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all disabled:opacity-50 mt-4 flex items-center justify-center gap-3 uppercase tracking-widest"
              >
                {isLoading ? <Loader2 className="w-7 h-7 animate-spin" /> : (
                  <>
                    <PlusCircle className="w-5 h-5" />
                    <span>تأكيد الإضافة</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Recharge Modal */}
      {selectedGarage && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
          onClick={() => !isProcessing && setSelectedGarage(null)}
        >
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl p-8 relative overflow-hidden border border-transparent dark:border-slate-800 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            {success ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center text-white mb-6 animate-bounce">
                  <CheckCircle2 className="w-14 h-14" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">تم إرسال الطلب!</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold mt-2">سيتم شحن رصيد {selectedGarage.name} فور موافقة المدير</p>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">شحن رصيد الجراج</h2>
                    <p className="text-sm font-bold text-slate-400 dark:text-slate-500">{selectedGarage.name}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedGarage(null)}
                    className="w-10 h-10 bg-red-500 dark:bg-red-600 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Simplified Garage Info */}
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-6 mb-8 border border-slate-100 dark:border-slate-800 flex flex-col items-center text-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    {selectedGarage.billingModel === 'subscription' ? 'الاشتراك المتبقي للجراج' : 'الرصيد المتاح'}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-5xl font-black text-slate-950 dark:text-white font-mono tracking-tighter">
                      {selectedGarage.billingModel === 'subscription' ? (
                        (() => {
                          const expiry = selectedGarage.balanceExpiry;
                          if (!expiry) return 0;
                          const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
                          const diff = expiryDate.getTime() - Date.now();
                          return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                        })()
                      ) : (
                        <AnimatedCounter value={Math.floor((selectedGarage.balance || 0) / (selectedGarage.commissionPerVehicle || 1))} />
                      )}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {selectedGarage.billingModel === 'subscription' ? 'يوم' : 'وحدة'}
                    </span>
                  </div>
                  {selectedGarage.billingModel === 'subscription' && selectedGarage.balanceExpiry && (
                    <span className="text-[10px] font-bold text-slate-400 mt-2">
                      تاريخ الانتهاء: {(() => {
                        const expiry = selectedGarage.balanceExpiry;
                        const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
                        return expiryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                      })()}
                    </span>
                  )}
                  <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 w-full justify-center">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ساعة</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{selectedGarage.hourlyRate}ج.م</span>
                    </div>
                    <div className="w-px h-6 bg-slate-100 dark:bg-slate-800 self-center" />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">مبيت</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">{selectedGarage.overnightRate}ج.م</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-900 dark:text-white text-base">باقات الشحن</h3>
                </div>

                {/* Package Slider */}
                <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory scrollbar-hide -mx-2 px-2">
                  {(() => {
                    const isSub = selectedGarage.billingModel === 'subscription';
                    const subPackages: Package[] = [
                      { id: 'weekly_sub', name: 'اشتراك أسبوعي', price: subscriptionPrices.weekly, vehiclesCount: 7 },
                      { id: 'monthly_sub', name: 'اشتراك شهري', price: subscriptionPrices.monthly, vehiclesCount: 30 }
                    ];
                    const list = isSub ? subPackages : (packages.length > 0 ? packages.slice(0, 6) : []);
                    
                    return list.map((pkg) => (
                      <button
                        key={pkg.id}
                        onClick={() => {
                          if (isProcessing) return;
                          setPendingPackage(pkg);
                        }}
                        className="flex-none w-[160px] snap-center bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-5 flex flex-col items-center justify-between hover:border-emerald-500 transition-all group"
                      >
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                          {isSub ? pkg.name : `باقة ${pkg.name.split(' ')[1] || pkg.name}`}
                        </span>
                        
                        <div className="flex flex-col items-center">
                          <span className="text-4xl font-black text-slate-950 dark:text-white font-mono tracking-tighter leading-none">{pkg.vehiclesCount}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {isSub ? 'يوم' : 'وحدة'}
                          </span>
                        </div>

                        <div className="mt-6 bg-emerald-600 text-white w-full py-2.5 rounded-2xl font-black text-sm font-mono">
                          {pkg.price} ج.م
                        </div>
                      </button>
                    ));
                  })()}
                  {packages.length === 0 && selectedGarage.billingModel !== 'subscription' && (
                    <div className="w-full py-8 text-center text-slate-400 dark:text-slate-600 text-xs font-bold">لا توجد باقات حالية</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Package Confirmation Overlay */}
          {pendingPackage && !success && (
            <div className="absolute inset-x-4 bottom-4 z-20" onClick={e => e.stopPropagation()}>
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border-2 border-emerald-500 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
                <div className="text-center mb-6">
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {selectedGarage.billingModel === 'subscription' ? 'تأكيد طلب تجديد الاشتراك؟' : 'تأكيد شحن الباقة؟'}
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1">
                    {selectedGarage.billingModel === 'subscription' 
                      ? `أنت على وشك طلب تجديد الاشتراك لمدة ${pendingPackage.vehiclesCount} يوم للجراج`
                      : `أنت على وشك شحن ${pendingPackage.vehiclesCount} وحدة للجراج`}
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center">
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">السعر المطلوب</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{pendingPackage.price} ج.م</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {selectedGarage.billingModel === 'subscription' ? 'المدة' : 'عدد العربيات'}
                    </p>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                      {pendingPackage.vehiclesCount} {selectedGarage.billingModel === 'subscription' ? 'يوم' : 'وحدة'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={isProcessing || pendingRequests.some(r => r.garageId === selectedGarage.id)}
                    onClick={() => handleRechargeSubmit(undefined, pendingPackage)}
                    className="flex-1 bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-4 rounded-xl font-black text-base hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <span>{pendingRequests.some(r => r.garageId === selectedGarage.id) ? 'طلب معلق...' : 'تأكيد الشحن'}</span>
                    )}
                  </button>
                  <button
                    disabled={isProcessing}
                    onClick={() => setPendingPackage(null)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-4 rounded-xl font-black text-base hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
