import React, { useState, memo } from 'react';
import { Package } from '../../types';
import { getCleanPackageInfo } from '../../constants/packages';
import { ChevronRight, Clock, Car, Sparkles, Filter } from 'lucide-react';
import { calculateFinalPrice } from '../../utils';
import { useSystemSubscribersFlatFee } from '../../hooks/useSystemSubscribersFlatFee';

interface PackagesModalProps {
  packages: Package[];
  onClose: () => void;
  garageHourlyRate?: number;
  walletNumber?: string;
  onToggleMenu?: () => void;
  subscriptionPrices?: { weekly?: number; biweekly?: number; monthly?: number };
  hasMonthlySubscribers?: boolean;
}

export { getCleanPackageInfo };

export const PackagesModal: React.FC<PackagesModalProps> = memo(({ 
  packages, 
  onClose, 
  walletNumber = "01552411323",
  hasMonthlySubscribers = false
}) => {
  const [selectedDurationFilter, setSelectedDurationFilter] = useState<number>(15);
  const subscriberFlatFee = useSystemSubscribersFlatFee();

  const formatNumber = (num: number | string) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatWalletGroups = (walletStr: string) => {
    const digits = walletStr ? walletStr.replace(/\D/g, '') : '01552411323';
    if (!digits) return ['015', '52', '41', '13', '23'];
    
    const first3 = digits.slice(0, 3);
    const remaining = digits.slice(3);
    const pairs: string[] = [];
    for (let i = 0; i < remaining.length; i += 2) {
      pairs.push(remaining.slice(i, i + 2));
    }
    return [first3, ...pairs].filter(Boolean);
  };

  const walletGroups = formatWalletGroups(walletNumber);

  const rawList = packages || [];

  const displayPackages = rawList
    .map(p => {
      const { finalPrice } = calculateFinalPrice(p, hasMonthlySubscribers, subscriberFlatFee);
      return {
        ...p,
        _sortPrice: finalPrice
      };
    })
    .sort((a, b) => (a as any)._sortPrice - (b as any)._sortPrice);

  const filteredPackages = displayPackages.filter(pkg => {
    const info = getCleanPackageInfo(pkg);
    return info.durationDays === selectedDurationFilter;
  });

  const hasUnlimitedInFiltered = filteredPackages.some(p => getCleanPackageInfo(p).isUnlimited);
  const maxCapInFiltered = Math.max(...filteredPackages.map(p => getCleanPackageInfo(p).dailyCapacity || 0));

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors" dir="rtl">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 bg-white dark:bg-slate-900 shrink-0 transition-colors shadow-sm">
        <button 
          onClick={onClose}
          className="w-10 h-10 bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 rounded-xl flex items-center justify-center hover:bg-slate-800 dark:hover:bg-amber-500 transition-colors shadow-sm outline-none cursor-pointer shrink-0"
          title="رجوع"
        >
          <ChevronRight className="w-5.5 h-5.5 text-amber-400 dark:text-slate-950 stroke-[3.5]" />
        </button>
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1">
            الاشتراكات
          </h3>
        </div>
      </div>

      {/* Main Body */}
      <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar-slate stable-scrollbar flex-1">
        <div className="max-w-2xl mx-auto w-full space-y-6">
          
          {/* Wallet Section (Super Clear & High Contrast) */}
          <div className="p-5 sm:p-6 bg-slate-900 text-white rounded-3xl border-2 border-amber-500 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
            <div className="flex items-center gap-2 text-amber-400 font-black text-sm mb-1">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>رقم المحفظة</span>
            </div>

            {/* Big Wallet Number - Formatted (3 digits then pairs of 2) */}
            <div className="my-2 py-2.5 px-4 bg-slate-800/90 rounded-2xl border border-amber-500/30 flex items-center justify-center gap-1.5 sm:gap-2.5 w-full max-w-md dir-ltr" dir="ltr">
              {walletGroups.map((group, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <span className="text-amber-500/50 text-xl sm:text-3xl font-mono font-bold select-none">-</span>
                  )}
                  <span className="text-2xl sm:text-4xl font-black font-mono text-amber-300 tracking-wider">
                    {group}
                  </span>
                </React.Fragment>
              ))}
            </div>

            <div className="flex items-center gap-2 text-slate-300 text-xs font-bold mt-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>مواعيد الدفع: من 9 الصبح لحد 5 العصر كل يوم</span>
            </div>
          </div>

          {/* Duration Filter Tabs (Low Literacy Friendly) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-base">
                <Filter className="w-5 h-5 text-amber-500" />
                <span>اختار مدة الاشتراك:</span>
              </div>
              <span className="text-xs font-bold text-slate-500">
                ({filteredPackages.length} باقات)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-800/70 rounded-2xl">
              <button
                type="button"
                onClick={() => setSelectedDurationFilter(15)}
                className={`py-2.5 px-2 rounded-xl font-black text-xs sm:text-sm transition-all text-center cursor-pointer ${
                  selectedDurationFilter === 15
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                15 يوم (نصف شهر)
              </button>

              <button
                type="button"
                onClick={() => setSelectedDurationFilter(30)}
                className={`py-2.5 px-2 rounded-xl font-black text-xs sm:text-sm transition-all text-center cursor-pointer ${
                  selectedDurationFilter === 30
                    ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                }`}
              >
                30 يوم (شهر)
              </button>
            </div>
          </div>

          {/* Packages Grid - Ultra Simple & Direct for Low Literacy */}
          <div className="space-y-3">
            {filteredPackages.map((pkg) => {
              const info = getCleanPackageInfo(pkg);
              const { finalPrice: effectivePrice, displayBasePrice, hasDiscount } = calculateFinalPrice(pkg, hasMonthlySubscribers, subscriberFlatFee);

              const packageName = info.displayName;

              const isTopTier = filteredPackages.length > 1 && (
                info.isUnlimited || (!hasUnlimitedInFiltered && info.dailyCapacity !== null && info.dailyCapacity === maxCapInFiltered && maxCapInFiltered > 0)
              );

              return (
                <div 
                  key={pkg.id}
                  className={`p-4 sm:p-5 rounded-3xl border-2 transition-all flex items-center justify-between gap-3 ${
                    info.isUnlimited
                      ? 'bg-slate-900 border-amber-500 text-white shadow-xl'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-sm'
                  }`}
                >
                  {/* Right Side: Package Name & Capacity */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xl sm:text-2xl font-black tracking-tight ${info.isUnlimited ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                        {packageName}
                      </span>

                      {isTopTier && (
                        <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                          <Sparkles className="w-3 h-3" />
                          الأكبر سعة
                        </span>
                      )}
                    </div>

                    <div className={`flex items-center gap-1.5 text-xs font-bold ${info.isUnlimited ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                      <Car className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{info.isUnlimited ? 'عربيات مفتوحة بدون حد أقصى' : `${info.dailyCapacity} عربية فى اليوم بس`}</span>
                    </div>
                  </div>

                  {/* Left Side: Direct Total Price */}
                  <div className="flex flex-col items-end text-left shrink-0">
                    {hasDiscount ? (
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <div className="relative overflow-hidden rounded px-2 py-0.5 flex items-center justify-center shrink-0">
                          {/* Spinning Golden Snake Background */}
                          <div 
                            className="absolute inset-[-250%] bg-[conic-gradient(from_0deg,transparent_75%,#fbbf24_100%)]" 
                            style={{ animation: 'spin 3.5s linear infinite' }} 
                          />
                          
                          {/* Inner Background Mask to create the border effect */}
                          <div className={`absolute inset-[1.5px] rounded-[2.5px] ${info.isUnlimited ? 'bg-slate-900' : 'bg-white dark:bg-slate-900'}`} />
                          
                          {/* Original Emerald Tint */}
                          <div className="absolute inset-[1.5px] rounded-[2.5px] bg-emerald-500/10" />
                          
                          {/* Text Content */}
                          <span className="relative z-10 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                            خصم {pkg.discountType === 'percentage' ? `${pkg.discountValue}%` : `${pkg.discountValue} ج.م`}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 line-through">
                          {formatNumber(displayBasePrice)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-baseline gap-1 font-mono">
                      <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
                        {formatNumber(effectivePrice)}
                      </span>
                      <span className="text-xs font-black text-amber-700 dark:text-amber-400">ج.م</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
});
