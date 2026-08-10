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
  RefreshCw
} from 'lucide-react';
import { Garage, Delegate } from '../../types';
import { safeDate } from '../../utils';
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
              const isSub = g.billingModel === 'subscription';
              let remainingDisplay = '';
              let remainingLabel = t('الرصيد');

              if (isSub) {
                remainingLabel = t('الاشتراك');
                if (g.balanceExpiry) {
                  const expiryDate = safeDate(g.balanceExpiry);
                  const diff = expiryDate.getTime() - Date.now();
                  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                  remainingDisplay = `${days} ${t('يوم')}`;
                } else {
                  remainingDisplay = `${g.balanceDays || 0} ${t('يوم')}`;
                }
              } else {
                remainingDisplay = `${g.balance || 0} ${t('ج.م')}`;
              }

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
                      
                      <div className="flex items-center gap-2 text-[8px] font-bold text-slate-400 mt-1">
                        <span className="text-blue-500 bg-blue-500/10 px-1 py-0.2 rounded">{activeCarsCount} {t('سيارات بالداخل')}</span>
                        <span className="text-slate-500 bg-slate-500/10 px-1 py-0.2 rounded">{checkedOutCount} {t('سيارة مغادرة بالكامل')}</span>
                        {g.isLocked && <span className="text-red-500 bg-red-500/10 px-1 py-0.2 rounded font-sans">{t('معطل')}</span>}
                      </div>
                    </div>
                  </div>

                  <div className={`font-mono shrink-0 ${adminLang === 'en' ? 'text-right' : 'text-left'}`}>
                    <span className="text-xs font-black text-amber-500 block">
                      {remainingDisplay} <span className="text-[8px] font-bold font-sans text-slate-400">{remainingLabel}</span>
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
                      <span className="text-[8px] font-bold text-slate-400 font-mono block mt-0.5">{d.phone}</span>
                    </div>
                  </div>

                  <div className={`text-left font-mono shrink-0 ${adminLang === 'en' ? 'text-right' : 'text-left'}`}>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 block">
                      +{delegatedSum.toLocaleString(adminLang === 'en' ? 'en-US' : 'ar-EG')} <span className="text-[8px] font-bold font-sans text-slate-400">{t('ج.م')}</span>
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
              <div className="text-center py-10 text-slate-350 dark:text-slate-650 font-bold">
                {t('لا يوجد بيانات مندوبين لشحن النظام')}
              </div>
            )}
          </div>
        </section>

      </div>

      {showPlateLookupModal && (
        <PlateLookupModal
          allGarages={localGarages}
          onClose={() => setShowPlateLookupModal(false)}
        />
      )}

    </div>
  );
});
