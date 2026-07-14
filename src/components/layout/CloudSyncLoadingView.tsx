import React from 'react';

export const CloudSyncLoadingView: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-500" dir="rtl">
      <style>{`
        @keyframes fillUp {
          0% {
            clip-path: inset(100% 0 0 0);
          }
          100% {
            clip-path: inset(0% 0 0 0);
          }
        }
        .liquid-fill {
          clip-path: inset(100% 0 0 0);
          animation: fillUp 2s cubic-bezier(0.4, 0, 0.2, 1) 0.8s forwards;
        }
      `}</style>

      <div className="flex flex-col items-center justify-center select-none animate-fade-in">
        {/* Dynamic Filling Text Container */}
        <div className="relative flex items-center justify-center w-64 h-32 md:w-80 md:h-40">
          {/* Background Text (Empty/Muted) */}
          <span className="absolute text-8xl md:text-9xl font-black tracking-wider text-slate-200 dark:text-slate-900 font-mono">
            RQ
          </span>
          
          {/* Foreground Text (Filling Up) */}
          <span className="absolute text-8xl md:text-9xl font-black tracking-wider text-emerald-500 dark:text-white font-mono liquid-fill">
            RQ
          </span>
        </div>

        <span className="text-xs md:text-sm font-black text-slate-400 dark:text-slate-600 tracking-[0.25em] uppercase mr-1 mt-2">
          SYSTEM
        </span>
      </div>
    </div>
  );
};


