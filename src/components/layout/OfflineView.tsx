import React from 'react';
import { WifiOff } from 'lucide-react';

export const OfflineView: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-slate-900 z-[10000] flex items-center justify-center p-6 text-center" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-10 max-w-sm w-full flex flex-col items-center gap-8 border-4 border-white/10 dark:border-slate-800 transition-colors">
        <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl flex items-center justify-center transition-colors">
          <WifiOff className="w-12 h-12" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">عفواً، لا يوجد نت</h2>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-4">
            توقف النظام تلقائياً لحماية بياناتك. بمجرد عودة الاتصال، ستتمكن من مواصلة العمل فوراً.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 w-full">
          <div className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-900/20 px-6 py-3 rounded-2xl text-xs font-black transition-colors">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>جاري محاولة الاتصال...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
