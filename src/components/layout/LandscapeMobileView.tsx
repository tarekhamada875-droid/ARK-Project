import React from 'react';
import { Smartphone } from 'lucide-react';
import { Garage } from '../../types';

interface LandscapeMobileViewProps {
  garage: Garage | null;
}

export const LandscapeMobileView: React.FC<LandscapeMobileViewProps> = ({ garage }) => {
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
          <div className="relative w-28 h-28 bg-slate-800/90 dark:bg-slate-900/90 rounded-2xl border-2 border-slate-700/60 flex items-center justify-center shadow-2xl">
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
};
