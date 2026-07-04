import React from 'react';

export const CloudSyncLoadingView: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 gap-5" dir="rtl">
      <div className="flex flex-col items-center">
        <div className="w-28 h-28 flex items-center justify-center bg-black rounded-[2rem] p-6 mb-6 shadow-2xl border border-slate-900 transition-all duration-300">
          <img 
            src="https://cdn-icons-png.flaticon.com/512/2993/2993685.png" 
            alt="PARQ Logo" 
            className="w-16 h-16 object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="w-8 h-8 rounded-full border-3 border-slate-800 border-t-emerald-500 animate-spin mb-3" />
        <p className="text-slate-400 font-bold text-base tracking-wide">جاري الاتصال بالسيرفر السحابي...</p>
      </div>
    </div>
  );
};
