/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, memo } from 'react';
import { 
  BarChart3, 
  DollarSign, 
  Users, 
  Car, 
  Search,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  Phone
} from 'lucide-react';
import { Garage, Delegate, ActivityLog } from '../../types';
import { firestoreServiceV2 as firestoreService } from '../../services/domain/firestoreServiceV2';
import { getRemainingDays, safeDate } from '../../utils';
import { useTheme } from '../../utils/ThemeContext';
import { useAdminTranslation } from '../../utils/adminTranslations';
import { PlateLookupModal } from '../modals/PlateLookupModal';

interface AdminReportsViewProps {
  allGarages: Garage[];
  delegates: Delegate[];
}

export const AdminReportsView = memo(({ allGarages, delegates }: AdminReportsViewProps) => {
  const { adminLang } = useTheme();
  const t = useAdminTranslation(adminLang);

  // Decoupled local state synced with incoming props
  const [localGarages, setLocalGarages] = useState<Garage[]>(() => allGarages);
  const [localDelegates, setLocalDelegates] = useState<Delegate[]>(() => delegates);

  // Keep local state in sync when allGarages or delegates props change
  useEffect(() => {
    setLocalGarages(allGarages);
  }, [allGarages]);

  useEffect(() => {
    setLocalDelegates(delegates);
  }, [delegates]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(() => new Date());
  const [showPlateLookupModal, setShowPlateLookupModal] = useState(false);

  // Paginated Activity Logs State
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [lastLogDoc, setLastLogDoc] = useState<any>(null);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  const loadMoreActivityLogs = async () => {
    if (isLoadingLogs) return;
    setIsLoadingLogs(true);
    try {
      const result = await firestoreService.getPaginatedActivityLogs(20, lastLogDoc);
      setActivityLogs(prev => [...prev, ...result.logs]);
      setLastLogDoc(result.lastDoc);
      setHasMoreLogs(result.hasMore);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadMoreActivityLogs();
  }, []);

  // Manual Trigger to update the reporting view
  const handleRefresh = () => {
    setIsRefreshing(true);
    // Mimic standard, satisfying tactile pull-to-refresh style delay
    setTimeout(() => {
      setLocalGarages(allGarages);
      setLocalDelegates(delegates);
      setLastRefreshed(new Date());
      setIsRefreshing(false);
    }, 600);
  };

  const formatLastRefreshed = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? (adminLang === 'en' ? 'PM' : 'م') : (adminLang === 'en' ? 'AM' : 'ص');
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  // Filtering & Search
  const [garageStatsSearch, setGarageStatsSearch] = useState('');

  // Compute Smart Aggregated Admin Metrics from props (Instant, Zero Firestore reads)
  const systemMetrics = useMemo(() => {
    const totalGarages = localGarages.length;
    const activeGarages = localGarages.filter(g => !g.isLocked).length;
    const lockedGarages = localGarages.filter(g => g.isLocked).length;
    
    // Total cars currently inside ALL garages combined
    const currentCarsInside = localGarages.reduce((sum, g) => {
      const activeCarsCount = typeof g.carsInside === 'number' ? Math.max(0, g.carsInside) : (g.activePlates ? Object.keys(g.activePlates).length : 0);
      return sum + activeCarsCount;
    }, 0);

    // Total vehicle exits
    const today = new Date().toISOString().split('T')[0];
    const totalExitsCount = localGarages.reduce((sum, g) => sum + (g.totalVehiclesOut || 0), 0);
    const todayExitsCount = localGarages.reduce((sum, g) => {
      const isToday = g.lastTransactionDate === today;
      return sum + (isToday ? (g.todayCount || 0) : 0);
    }, 0);

    // Total finance metrics
    const totalGaragesBalance = localGarages.reduce((sum, g) => sum + (g.balance || 0), 0);
    const totalAdminRevenue = localGarages.reduce((sum, g) => sum + (g.totalAdminRevenue || 0), 0);
    const totalRechargedVehicles = localGarages.reduce((sum, g) => sum + (g.totalRechargedCars || 0), 0);
    const todayRevenue = localGarages.reduce((sum, g) => {
      const isToday = g.lastTransactionDate === today;
      return sum + (isToday ? (g.todayRevenue || 0) : 0);
    }, 0);
    const totalGaragesRevenue = localGarages.reduce((sum, g) => sum + (g.totalRevenue || 0), 0);

    return {
      totalGarages,
      activeGarages,
      lockedGarages,
      currentCarsInside,
      totalExitsCount,
      todayExitsCount,
      totalGaragesBalance,
      totalAdminRevenue,
      totalRechargedVehicles,
      todayRevenue,
      totalGaragesRevenue
    };
  }, [localGarages]);

  // Filtered Garages comparison
  const filteredGarageStats = useMemo(() => {
    return localGarages.filter(g => 
      g.name.toLowerCase().includes(garageStatsSearch.toLowerCase()) ||
      (g.phone || '').includes(garageStatsSearch)
    ).sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0)); // Sort by highest revenue generated
  }, [localGarages, garageStatsSearch]);

  // Feature 6: Expiring Soon Garages (<= 7 days)
  const expiringGarages = useMemo(() => {
    return localGarages
      .filter(g => g.status !== 'pending' && g.balanceExpiry)
      .map(g => ({
        ...g,
        remainingDays: getRemainingDays(g)
      }))
      .filter(g => g.remainingDays <= 7)
      .sort((a, b) => a.remainingDays - b.remainingDays);
  }, [localGarages]);

  return (
    <div className="space-y-8 font-sans pb-20 select-none" dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
      
      {/* Grid: High-Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Admin Net Revenue */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-5 rounded-xl relative overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-400/10 to-transparent rounded-full -mr-5 -mt-5" />
          <div className="flex justify-between items-start gap-4">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t('إجمالي شحن السيستم')}</span>
            <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <DollarSign className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight leading-none whitespace-nowrap">
              {Number(systemMetrics.totalAdminRevenue).toFixed(0)} <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-sans">{t('ج.م')}</span>
            </h3>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-2">{t('عائدات من شحن باقات المندوبين')}</p>
          </div>
        </div>

        {/* Card 4: Parked Cars Right Now */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-5 rounded-xl relative overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-blue-400/10 to-transparent rounded-full -mr-5 -mt-5" />
          <div className="flex justify-between items-start gap-4">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t('سيارات داخل الجراجات الآن')}</span>
            <div className="w-8 h-8 bg-blue-50 dark:bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center shrink-0">
              <Car className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight leading-none text-blue-600 dark:text-blue-400 whitespace-nowrap">
              {systemMetrics.currentCarsInside} <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-sans">{t('سيارة')}</span>
            </h3>
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mt-2">{t('المركبات النشطة')}</p>
          </div>
        </div>

        {/* Card 5: Garages Breakdown */}
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 p-5 rounded-xl relative overflow-hidden flex flex-col justify-between hover:shadow-lg transition-all">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-rose-400/5 to-transparent rounded-full -mr-5 -mt-5" />
          <div className="flex justify-between items-start gap-4">
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t('حالة الجراجات')}</span>
            <div className="w-8 h-8 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 stroke-[2.5]" stroke="currentColor" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2 whitespace-nowrap">
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">{systemMetrics.totalGarages}</span>
              <span className="text-[10px] font-bold text-slate-400">{t('جراج')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[9px] font-bold text-slate-400">
              <span className="text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-md shrink-0">{systemMetrics.activeGarages} {t('مفعل')}</span>
              <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-md shrink-0">{systemMetrics.lockedGarages} {t('معطل')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Feature 6: Expiring Subscriptions Alert & Report (<= 7 days) */}
      {expiringGarages.length > 0 && (
        <section className="bg-amber-500/5 dark:bg-amber-500/10 border-2 border-amber-500/20 rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-sm">
                <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>جراجات تقترب من انتهاء الاشتراك</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-mono">
                    {expiringGarages.length} جراج
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t('جراجات متبقي في اشتراكها 7 أيام أو أقل وتتطلب المتابعة أو التجديد')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringGarages.map((g) => {
              const isExpired = g.remainingDays <= 0;
              return (
                <div 
                  key={g.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                    isExpired 
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50' 
                      : 'bg-white dark:bg-slate-900 border-amber-200/80 dark:border-amber-900/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {g.name}
                      </h4>
                      {g.phone && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{g.phone}</span>
                        </div>
                      )}
                    </div>

                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full font-mono shrink-0 ${
                      isExpired 
                        ? 'bg-red-500 text-white' 
                        : g.remainingDays <= 3 
                        ? 'bg-amber-500 text-white' 
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                    }`}>
                      {isExpired ? t('منتهي') : `${t('متبقي')} ${g.remainingDays} ${t('يوم')}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px]">
                    <div className="text-slate-500 dark:text-slate-400">
                      <span>{t('الباقة')}: </span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {g.activePackageName || t('باقة قياسية')}
                      </span>
                      {g.isTrial && (
                        <span className="mr-1 text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold">
                          {t('تجريبي')}
                        </span>
                      )}
                    </div>

                    <div className="text-slate-400 font-mono text-[9px]">
                      {g.balanceExpiry ? safeDate(g.balanceExpiry).toLocaleDateString('ar-EG') : '—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Main Row: Activity Analysis & Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* Left Column: Comparative Performance list of Garages */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                {t('مقارنة أداء الجراجات')}
              </h2>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                  {t('آخر تحديث:')} {formatLastRefreshed(lastRefreshed)}
                </span>
                <button
                  id="btn_open_plate_lookup"
                  onClick={() => setShowPlateLookupModal(true)}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-95 text-slate-950 font-black px-3 py-1.5 rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>{t('استعلام عن لوحة')}</span>
                </button>
                <button
                  id="btn_manual_refresh_reports"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 disabled:opacity-50 px-2.5 py-1.5 rounded-xl text-[10px] font-black text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-amber-500' : 'text-slate-500'}`} />
                  {isRefreshing 
                    ? t('جاري التحديث...') 
                    : t('تحديث يدوي')}
                </button>
              </div>
            </div>
            <div className="relative w-full overflow-visible">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-3.5 h-3.5" />
              <input 
                type="text" 
                placeholder={t('بحث سريع بالجراج...')}
                value={garageStatsSearch}
                onChange={(e) => setGarageStatsSearch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pr-8 pl-4 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-amber-400 transition-all font-sans"
              />
            </div>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar-slate divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
            {filteredGarageStats.map((g, index) => {
              const checkedOutCount = g.totalVehiclesOut || 0;
              const remainingLabel = t('الاشتراك');
              const remainingDisplay = `${getRemainingDays(g)} ${t('يوم')}`;

              const activeCarsCount = typeof g.carsInside === 'number' ? Math.max(0, g.carsInside) : (g.activePlates ? Object.keys(g.activePlates).length : 0);
              
              return (
                <div key={g.id} className="p-4 hover:bg-slate-50/40 dark:hover:bg-slate-800/10 flex items-center justify-between transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                      #{index + 1}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black text-slate-900 dark:text-white block truncate">
                        {g.name}
                      </span>
                      
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1">
                        <span className="text-blue-500 bg-blue-500/10 px-1 py-0.2 rounded">{activeCarsCount} {t('سيارات بالداخل')}</span>
                        <span className="text-slate-500 bg-slate-500/10 px-1 py-0.2 rounded">{checkedOutCount} {t('سيارة مغادرة بالكامل')}</span>
                        {g.isLocked && <span className="text-red-500 bg-red-500/10 px-1 py-0.2 rounded font-sans">{t('معطل')}</span>}
                      </div>
                    </div>
                  </div>

                  <div className={`font-mono shrink-0 ${adminLang === 'en' ? 'text-right' : 'text-left'}`}>
                    <span className="text-xs font-black text-amber-500 block">
                      {remainingDisplay} <span className="text-[10px] font-bold font-sans text-slate-400">{remainingLabel}</span>
                    </span>
                    <span className="text-[9px] font-bold text-slate-400 block mt-1">
                      {t('الأرباح الإجمالية')}: {(g.totalRevenue || 0).toLocaleString(adminLang === 'en' ? 'en-US' : 'ar-EG')} {t('ج.م')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Right Column: Delegate Performance */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-500" />
              {t('مبيعات وأداء المندوبين المعتمدين')}
            </h2>
          </div>
          <div className="p-6 max-h-[400px] overflow-y-auto custom-scrollbar-slate space-y-4 font-sans">
            {localDelegates.map((d) => {
              const delegatedSum = d.totalRechargedAmount || 0;
              
              return (
                <div key={d.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center font-black text-sm">
                      {d.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-xs font-black text-slate-900 dark:text-white block truncate uppercase">{d.name}</span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono block mt-0.5">{d.phone}</span>
                    </div>
                  </div>

                  <div className={`text-left font-mono shrink-0 ${adminLang === 'en' ? 'text-right' : 'text-left'}`}>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                      +{delegatedSum.toLocaleString(adminLang === 'en' ? 'en-US' : 'ar-EG')} <span className="text-[10px] font-bold font-sans text-slate-400">{t('ج.م')}</span>
                    </span>
                    {d.canCreateGarage && (
                      <span className="text-[7px] font-black px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-widest block mt-1">
                        {t('صلاحية إنشاء الجراجات')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {localDelegates.length === 0 && (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600 font-bold">
                {t('لا يوجد بيانات مندوبين لشحن النظام')}
              </div>
            )}
          </div>
        </section>

      </div>

      {/* System Activity Logs (Paginated) */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-amber-500" />
            <span>{t('سجل العمليات والنشاطات الأخير (مفصل)')}</span>
          </h2>
          <span className="text-xs font-bold text-slate-400 font-mono">
            {activityLogs.length} {t('سجل')}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
          {activityLogs.map((log) => (
            <div key={log.id} className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 flex items-center justify-between transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black text-slate-900 dark:text-white">
                    {log.plateNumber || log.actionType}
                  </div>
                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {log.garageName} • {log.staffName || t('السيستم')}
                  </div>
                </div>
              </div>

              <div className="text-left font-mono">
                {log.amount !== undefined && (
                  <div className="text-xs font-black text-emerald-500">
                    +{log.amount} {adminLang === 'en' ? 'EGP' : 'ج.م'}
                  </div>
                )}
                <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                  {safeDate(log.timestamp).toLocaleTimeString(adminLang === 'en' ? 'en-US' : 'ar-EG', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}

          {activityLogs.length === 0 && !isLoadingLogs && (
            <div className="p-8 text-center text-xs font-bold text-slate-400">
              {t('لا توجد سجلات نشاط متاحة حالياً')}
            </div>
          )}
        </div>

        {hasMoreLogs && (
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              onClick={loadMoreActivityLogs}
              disabled={isLoadingLogs}
              className="px-6 py-2.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-black text-xs transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              {isLoadingLogs ? t('جاري التحميل...') : t('تحميل المزيد من السجلات...')}
            </button>
          </div>
        )}
      </section>

      {showPlateLookupModal && (
        <PlateLookupModal
          allGarages={localGarages}
          onClose={() => setShowPlateLookupModal(false)}
        />
      )}

    </div>
  );
});
