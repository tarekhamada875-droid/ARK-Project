import React, { useState, useEffect, useMemo, memo } from 'react';
import { 
  LogOut, 
  Moon, 
  Sun,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Check
} from 'lucide-react';
import { Garage, GeneralManager } from '../../types';
import { safeDate } from '../../utils';
import { useTheme } from '../../utils/ThemeContext';
import { firestoreService } from '../../services/firestoreService';

interface GeneralManagerDashboardProps {
  currentGeneralManager: GeneralManager;
  allGarages: Garage[];
  onLogout: () => void;
}

export const GeneralManagerDashboard: React.FC<GeneralManagerDashboardProps> = memo(({
  currentGeneralManager,
  allGarages,
  onLogout
}) => {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const today = new Date().toISOString().split('T')[0];

  // Filter garages that are assigned to this general manager
  const assignedGarages = useMemo(() => {
    return allGarages.filter(g => 
      (currentGeneralManager.garageIds || []).includes(g.id)
    );
  }, [allGarages, currentGeneralManager.garageIds]);

  // Keep track of currently selected garage id
  const [selectedGarageId, setSelectedGarageId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Background auto-sync when a garage is selected
  useEffect(() => {
    if (selectedGarageId) {
      firestoreService.recalculateCarsInside(selectedGarageId).catch(console.error);
    }
  }, [selectedGarageId]);

  const handleManualSync = async () => {
    if (!selectedGarageId || isSyncing) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      await firestoreService.recalculateCarsInside(selectedGarageId);
      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const selectedGarage = selectedGarageId ? assignedGarages.find(g => g.id === selectedGarageId) : null;

  return (
    <div className="h-screen w-full bg-[#faf9f6] dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans flex flex-col overflow-hidden" dir="rtl">
      {/* Upper Navigation Bar */}
      <header className="border-b border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-slate-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Manager Info or Back Button */}
          {selectedGarage ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedGarageId(null)}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 text-slate-700 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-white transition-all font-bold text-xs sm:text-sm shadow-sm outline-none cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                <span>العودة لقائمة الجراجات</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-2xl flex items-center justify-center font-black text-lg border border-purple-100 dark:border-purple-900/30">
                {currentGeneralManager.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-none">
                    {currentGeneralManager.name}
                  </h1>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/20">
                    مالك النظام
                  </span>
                </div>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-wider">شاشة الإحصائيات الحية</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-3 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl outline-none border border-slate-200/40 dark:border-slate-800/40"
              title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
            >
              {isDarkMode ? <Sun className="w-5 h-5 stroke-[2.5]" /> : <Moon className="w-5 h-5 stroke-[2.5]" />}
            </button>

            {/* Logout */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs sm:text-sm border border-red-150 dark:border-red-900/30 outline-none"
            >
              <LogOut className="w-4.5 h-4.5 stroke-[2.5]" />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-y-auto custom-scrollbar-slate">
        
          {/* Check if general manager has assigned garages */}
        {assignedGarages.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-[2rem] p-8 mt-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-slate-300 dark:text-slate-700" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">لم يتم تخصيص جراجات بعد</h2>
            <p className="text-slate-400 dark:text-slate-500 text-sm font-semibold">
              يرجى التواصل مع مدير النظام طارق لتعيين جراج أو أكثر لحسابك لتتمكن من متابعة إحصائياته.
            </p>
          </div>
        ) : !selectedGarage ? (
          /* Garages Grid View */
          <div className="space-y-6">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <MapPin className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                <span>الجراجات المخصصة لك</span>
              </h2>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500">اختر جراجاً لاستعراض إحصائياته وتفاصيله الحية</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignedGarages.map((g) => {
                const activeCarsCount = typeof g.carsInside === 'number' ? Math.max(0, g.carsInside) : (g.activePlates ? Object.keys(g.activePlates).length : 0);
                return (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGarageId(g.id)}
                    className="w-full text-right bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-6 rounded-3xl shadow-sm hover:shadow-md hover:border-purple-500/40 dark:hover:border-purple-500/30 transition-all duration-200 group flex flex-col gap-4 outline-none relative overflow-hidden cursor-pointer"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between w-full">
                      <div className="space-y-1">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {g.name}
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono" dir="ltr">
                          {g.phone}
                        </p>
                      </div>

                      {g.isLocked ? (
                        <span className="text-[10px] font-black px-2.5 py-1 bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/30 rounded-lg">
                          مغلق مؤقتاً
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/30 rounded-lg flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                          <span>نشط</span>
                        </span>
                      )}
                    </div>

                    {/* Stats summary inside card */}
                    <div className="grid grid-cols-2 gap-3 mt-1.5 w-full">
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">إيرادات اليوم</p>
                        <p className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                          {g.lastTransactionDate === today ? (g.todayRevenue || 0) : 0} <span className="text-[10px] font-bold">ج.م</span>
                        </p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500">السيارات بالداخل</p>
                        <p className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                          {activeCarsCount} <span className="text-[10px] font-bold">سيارة</span>
                        </p>
                      </div>
                    </div>

                    {/* Action footer inside card */}
                    <div className="flex items-center justify-between mt-1 w-full border-t border-slate-100 dark:border-slate-800/60 pt-3 text-xs font-bold text-purple-600 dark:text-purple-400">
                      <span>دخول واستعراض التفاصيل</span>
                      <ArrowLeft className="w-4 h-4 transform group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Detailed Garage Statistics Display */
          <div className="space-y-6">
            <div className="space-y-8">
              
              {/* Active Indicator Header Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-6 sm:p-8 rounded-[2rem] flex justify-between items-center gap-6 shadow-sm shadow-slate-200/5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-none">
                      {selectedGarage.name}
                    </h2>
                    {selectedGarage.isLocked ? (
                      <span className="text-[10px] font-black px-2.5 py-1 bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/30 rounded-lg">
                        مغلق مؤقتاً
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2.5 py-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200/30 rounded-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>نشط حالياً</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>تاريخ الإنشاء: {selectedGarage.createdAt ? new Date(selectedGarage.createdAt.seconds * 1000).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' }) : 'غير محدد'}</span>
                  </p>
                </div>

                <div className="text-left shrink-0">
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1">
                    {selectedGarage.billingModel === 'subscription' ? 'الاشتراك المتبقي' : 'الرصيد الحالي'}
                  </p>
                  <p className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {selectedGarage.billingModel === 'subscription' ? (
                      (() => {
                        if (!selectedGarage.balanceExpiry) return `${selectedGarage.balanceDays || 0} يوم`;
                        const expiry = selectedGarage.balanceExpiry;
                        const expiryDate = safeDate(expiry);
                        const diff = expiryDate.getTime() - Date.now();
                        const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                        return `${days} يوم`;
                      })()
                    ) : (
                      <>{selectedGarage.balance || 0} <span className="text-[11px] font-bold text-slate-500">ج.م</span></>
                    )}
                  </p>
                </div>
              </div>

              {/* Grid of Bento Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                
                {/* Card 1: Today's Revenue */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-3xl flex items-center justify-between shadow-sm">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-300">إيرادات اليوم</p>
                  <div className="flex items-baseline gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30">
                    <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {selectedGarage.lastTransactionDate === today ? (selectedGarage.todayRevenue || 0) : 0}
                    </span>
                    <span className="text-xs font-bold text-emerald-500">ج.م</span>
                  </div>
                </div>

                {/* Card 2: Cars Currently Inside */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-3xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">السيارات بالداخل حالياً</p>
                    <button
                      onClick={handleManualSync}
                      disabled={isSyncing}
                      className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-500 dark:text-slate-400 transition-all outline-none cursor-pointer"
                      title="مزامنة العداد الفعلي"
                    >
                      {isSyncing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                      ) : syncSuccess ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-baseline gap-1 bg-indigo-50 dark:bg-indigo-950/30 px-4 py-2 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                    <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
                      {typeof selectedGarage.carsInside === 'number' ? Math.max(0, selectedGarage.carsInside) : (selectedGarage.activePlates ? Object.keys(selectedGarage.activePlates).length : 0)}
                    </span>
                    <span className="text-xs font-bold text-indigo-500">سيارة</span>
                  </div>
                </div>

                {/* Card 3: Today's Checked out Vehicles count */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-3xl flex items-center justify-between shadow-sm">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-300">السيارات المغادرة اليوم</p>
                  <div className="flex items-baseline gap-1 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-2xl border border-blue-100/50 dark:border-blue-900/30">
                    <span className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                      {selectedGarage.lastTransactionDate === today ? (selectedGarage.todayCount || 0) : 0}
                    </span>
                    <span className="text-xs font-bold text-blue-500">سيارة</span>
                  </div>
                </div>

                {/* Card 4: Total Cumulative Revenue */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-3xl flex items-center justify-between shadow-sm">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-300">إجمالي إيرادات الجراج</p>
                  <div className="flex items-baseline gap-1 bg-purple-50 dark:bg-purple-950/30 px-4 py-2 rounded-2xl border border-purple-100/50 dark:border-purple-900/30">
                    <span className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 font-mono">
                      {selectedGarage.totalRevenue || 0}
                    </span>
                    <span className="text-xs font-bold text-purple-500">ج.م</span>
                  </div>
                </div>

                {/* Card 5: Current Rate Matrix */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 p-5 rounded-3xl flex items-center justify-between shadow-sm">
                  <p className="text-sm font-black text-slate-700 dark:text-slate-300">سعر التعريفة الحالية</p>
                  <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-2xl border border-amber-100/50 dark:border-amber-900/30">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                        {selectedGarage.hourlyRate || 0}
                      </span>
                      <span className="text-[10px] font-bold text-amber-500 mr-0.5">ساعة</span>
                    </div>
                    <div className="border-r border-amber-200/40 dark:border-amber-800/40 my-0.5" />
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">
                        {selectedGarage.overnightRate || 0}
                      </span>
                      <span className="text-[10px] font-bold text-amber-500 mr-0.5">مبيت</span>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
});
