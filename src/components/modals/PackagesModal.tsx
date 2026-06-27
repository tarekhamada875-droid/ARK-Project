import React, { useState } from 'react';
import { Package } from '../../types';
import { X } from 'lucide-react';

interface PackagesModalProps {
  packages: Package[];
  onClose: () => void;
  garageHourlyRate: number;
  walletNumber?: string;
}

export const PackagesModal: React.FC<PackagesModalProps> = ({ packages, onClose, garageHourlyRate, walletNumber = "015 - 524 - 113 - 23" }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const formatNumber = (num: number | string) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#faf9f6] dark:bg-slate-950 flex flex-col transition-colors" dir="rtl">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 transition-colors">باقات الرصيد</h3>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter transition-colors">اختر الباقة المناسبة لشحن جراجك</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-red-500 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 transition-colors outline-none"
          >
            <X className="w-6 h-6" />
          </button>
      </div>

      {/* Content */}
      <div className="p-6 overflow-y-auto custom-scrollbar-slate stable-scrollbar flex-1">
        <div className="max-w-xl mx-auto w-full">
          <div className="mb-8 p-4 sm:p-8 bg-slate-900 dark:bg-slate-900 rounded-[2rem] border-4 border-amber-500 dark:border-amber-500/50 flex flex-col items-center text-center gap-4 relative overflow-hidden">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-400/10 via-transparent to-transparent opacity-50" />
             <div className="relative z-10 w-full">
                <p className="text-sm font-black text-amber-500 uppercase tracking-[0.2em] mb-4">رقم المحفظة</p>
                <div className="flex items-center justify-center" dir="ltr">
                   <span className="text-[9vw] sm:text-7xl font-black text-white font-mono tracking-tighter whitespace-nowrap leading-none transition-all">
                      {walletNumber}
                   </span>
                </div>
             </div>
          </div>

          <div className="flex flex-col">
            {(() => {
              const sortedPackages = [...packages].sort((a, b) => a.price - b.price);
              const basePackage = sortedPackages[0];
              const baseRate = basePackage ? basePackage.price / basePackage.vehiclesCount : 0;

              return sortedPackages.map((pkg, index) => {
                
                // Calculate savings based on the previous package rate
                const prevPkg = index > 0 ? sortedPackages[index - 1] : null;
                const comparisonRate = prevPkg ? (prevPkg.price / prevPkg.vehiclesCount) : baseRate;
                
                const expectedPrice = pkg.vehiclesCount * comparisonRate;
                const savings = Math.round(expectedPrice - pkg.price);
                const ratePerVehicle = (pkg.price / pkg.vehiclesCount).toFixed(2);
                const expectedRevenue = pkg.vehiclesCount * garageHourlyRate;
                const isExpanded = expandedId === pkg.id;
                const isLast = index === sortedPackages.length - 1;
                
                return (
                  <div key={pkg.id} className={`flex flex-col gap-2 relative py-12 ${!isLast ? 'border-b-2 border-dashed border-slate-200 dark:border-slate-800' : ''} transition-colors`}>
                    {/* Package Name Badge */}
                    <div className="absolute top-9 left-1/2 -translate-x-1/2 z-10 bg-[#faf9f6] dark:bg-slate-800 px-4 py-1 rounded-full border-2 border-slate-100 dark:border-slate-800 transition-colors">
                      <span className="text-[11px] font-black uppercase tracking-widest leading-none text-slate-900 dark:text-slate-100">
                        {pkg.name || 'باقة توفير'}
                      </span>
                    </div>

                    <div 
                      onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                      className={`relative p-4 rounded-2xl border-2 flex flex-col gap-4 cursor-pointer transition-colors duration-200 ${isExpanded ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-500 dark:border-amber-500/50' : 'bg-[#faf9f6] dark:bg-slate-900 border-slate-100 dark:border-slate-800'} text-slate-900 dark:text-white`}
                    >
                      <div className="grid grid-cols-2 gap-3 w-full">
                        <div className="px-5 py-3 rounded-xl flex flex-col items-center justify-center border-2 bg-amber-600 border-amber-600 dark:bg-amber-600 dark:border-amber-600 text-white font-bold transition-all select-none">
                          <span className="text-xl font-black font-mono leading-none">{formatNumber(pkg.vehiclesCount)}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest mt-1.5 opacity-60">سيارة</span>
                        </div>
                        
                        <div className="px-5 py-3 rounded-xl flex flex-col items-center justify-center border-2 bg-slate-900 dark:bg-slate-800 text-white border-slate-900 dark:border-slate-700 tracking-tight transition-all select-none">
                          <span className="text-xl font-black font-mono tracking-tight leading-none">{formatNumber(pkg.price)}</span>
                          <span className="text-[9px] font-black uppercase tracking-widest mt-1.5 opacity-40">جنية مصري</span>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 flex flex-col gap-2 mt-2">
                        {/* Card 1: Pricing Details & Savings */}
                        <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-4 border-2 border-amber-500 dark:border-amber-500/30 flex items-center justify-around transition-colors">
                          <div className="text-center">
                            <p className="text-[8px] font-black text-white uppercase tracking-widest mb-1 opacity-70">سعر السيارة</p>
                            <div className="flex items-baseline justify-center gap-1">
                              <span className="text-lg font-black text-amber-500 font-mono">{ratePerVehicle}</span>
                              <span className="text-[10px] font-bold text-white/40">ج.م</span>
                            </div>
                          </div>
                          
                          {savings > 0 && (
                            <>
                              <div className="w-[1px] h-8 bg-white/10" />
                              <div className="text-center">
                                <p className="text-[8px] font-black text-white uppercase tracking-widest mb-1 opacity-70">هتوفر</p>
                                <div className="flex items-baseline justify-center gap-1">
                                  <span className="text-lg font-black text-amber-500 font-mono">{formatNumber(savings)}</span>
                                  <span className="text-[10px] font-bold text-white/40">ج.م</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Card 2: Expected Revenue (The Big Goal) */}
                        <div className="bg-slate-900 dark:bg-slate-800 rounded-2xl p-5 border-2 border-amber-500 dark:border-amber-500/30 relative overflow-hidden group transition-colors">
                           <div className="relative z-10 flex flex-col items-center">
                              <p className="text-[10px] font-black text-white uppercase tracking-[0.3em] mb-2 opacity-90">العائد المتوقع للباقة</p>
                              <div className="flex items-center gap-2">
                                <span className="text-4xl font-black text-amber-500 font-mono tracking-tighter tabular-nums">
                                   {formatNumber(expectedRevenue)}
                                </span>
                                <span className="text-xs font-bold text-white/40 mt-3">ج.م</span>
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="w-1 h-1 rounded-full bg-amber-400/40"></div>
                                <p className="text-[9px] font-bold text-white/50 tracking-wide">بناءاً على سعر الساعة {formatNumber(garageHourlyRate)} ج.م</p>
                                <div className="w-1 h-1 rounded-full bg-amber-400/40"></div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};
