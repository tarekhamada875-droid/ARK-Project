import React, { memo } from 'react';
import { Smartphone } from 'lucide-react';
import { Garage } from '../../types';

interface LandscapeMobileViewProps {
  garage: Garage | null;
}

export const LandscapeMobileView: React.FC<LandscapeMobileViewProps> = memo(({ garage }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col w-full h-full select-none overflow-hidden" dir="rtl">
      {garage ? (
        <div className="flex-1 flex flex-row w-full h-full bg-[#ffd43b] dark:bg-slate-950 transition-colors">
          
          {/* Right Pane: Hourly Rate - Renders on the right when dir="rtl" */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
              <h3 className="flex flex-col items-center gap-1 select-none text-slate-950 dark:text-[#ffd43b]">
                <span className="text-2xl md:text-3xl font-black tracking-wider uppercase leading-tight">
                  HOURLY RATE
                </span>
                <span className="text-lg md:text-xl font-bold opacity-90 leading-tight">
                  سعر الساعة
                </span>
              </h3>
              
              {/* Price Display */}
              <div className="flex flex-col items-center justify-center select-none mt-2 w-full">
                <span className="text-[52vh] font-extrabold font-mono tracking-tighter text-slate-950 dark:text-[#ffd43b] leading-none select-none">
                  {garage.hourlyRate}
                </span>
                <span className="text-xl md:text-2xl font-black font-mono uppercase tracking-widest text-slate-950 dark:text-[#ffd43b] opacity-80 mt-1">
                  EGP
                </span>
              </div>
            </div>
          </div>

          {/* Left Pane: Overnight Stay - Renders on the left when dir="rtl" with a thick and prominent divider */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden border-r-[6px] border-slate-950 dark:border-[#ffd43b]">
            <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
              <h3 className="flex flex-col items-center gap-1 select-none text-slate-950 dark:text-[#ffd43b]">
                <span className="text-2xl md:text-3xl font-black tracking-wider uppercase leading-tight">
                  OVERNIGHT STAY
                </span>
                <span className="text-lg md:text-xl font-bold opacity-90 leading-tight">
                  سعر المبيت
                </span>
              </h3>
              
              {/* Price Display */}
              <div className="flex flex-col items-center justify-center select-none mt-2 w-full">
                <span className="text-[52vh] font-extrabold font-mono tracking-tighter text-slate-950 dark:text-[#ffd43b] leading-none select-none">
                  {garage.overnightRate}
                </span>
                <span className="text-xl md:text-2xl font-black font-mono uppercase tracking-widest text-slate-950 dark:text-[#ffd43b] opacity-80 mt-1">
                  EGP
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Fallback if rotated before logging in */
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#ffd43b] dark:bg-slate-950 text-slate-950 dark:text-[#ffd43b] text-center">
          <Smartphone className="w-16 h-16 mb-4 animate-bounce opacity-80" />
          <h2 className="text-2xl font-black mb-2">
            يرجى تدوير الهاتف للوضع الرأسي
          </h2>
          <p className="text-sm opacity-80 max-w-xs">
            قم بتسجيل الدخول أولاً لعرض لوحة الأسعار الكبيرة
          </p>
        </div>
      )}
    </div>
  );
});

LandscapeMobileView.displayName = 'LandscapeMobileView';
