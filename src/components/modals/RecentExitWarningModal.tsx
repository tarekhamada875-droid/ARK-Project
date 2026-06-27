import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Vehicle } from '../../types';
import { getDuration } from '../../utils';

interface RecentExitWarningModalProps {
  vehicle: Vehicle;
  now: Date;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RecentExitWarningModal: React.FC<RecentExitWarningModalProps> = ({
  vehicle,
  now,
  onConfirm,
  onCancel
}) => {
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
      />
      <div className="relative bg-[#faf9f6] dark:bg-slate-900 w-full max-w-sm rounded-2xl p-8 text-center border border-transparent dark:border-slate-800" dir="rtl">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white dark:border-slate-800">
          <AlertTriangle className="w-10 h-10 text-emerald-500 dark:text-emerald-400" />
        </div>
        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter transition-colors">تنبيه: دخول متكرر</h3>
        <p className="text-slate-500 dark:text-slate-400 font-bold mb-6 text-base leading-relaxed transition-colors">
          هذه السيارة <span className="text-slate-900 dark:text-slate-100">{vehicle.plateNumber}</span> خرجت منذ 
          <span className="text-emerald-600 dark:text-emerald-400 mx-1">{getDuration(vehicle.exitTime, now)}</span> فقط.
          <br/>
          هل أنت متأكد من إعادة إدخالها؟
        </p>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all outline-none"
          >
            نعم، تأكيد الدخول
          </button>
          <button 
            onClick={onCancel}
            className="w-full bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-100 dark:hover:bg-slate-700 transition-all outline-none"
          >
            لا، إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
