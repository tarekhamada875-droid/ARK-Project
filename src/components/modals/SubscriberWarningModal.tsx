import React, { memo } from 'react';
import { AlertCircle } from 'lucide-react';
import { EgyptianPlate } from '../ui/EgyptianPlate';

interface SubscriberWarningModalProps {
  plateNumber: string;
  onConfirm: () => void;
}

export const SubscriberWarningModal: React.FC<SubscriberWarningModalProps> = memo(({
  plateNumber,
  onConfirm
}) => {
  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        onClick={onConfirm}
        className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80"
      />
      <div className="relative bg-[#faf9f6] dark:bg-slate-900 w-full max-w-sm rounded-2xl p-8 text-center border border-transparent dark:border-slate-800" dir="rtl">
        <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-400/10 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white dark:border-slate-800">
          <AlertCircle className="w-10 h-10 text-emerald-500 dark:text-emerald-400 animate-pulse" />
        </div>
        
        <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter transition-colors">تنبيه: مشترك شهري</h3>
        
        <p className="text-slate-500 dark:text-slate-400 font-bold mb-6 text-sm sm:text-base leading-relaxed transition-colors">
          رقم اللوحة ينتمي إلى مشترك شهري فعال ونشط حالياً.
          <br/>
          <span className="text-emerald-600 dark:text-emerald-400 font-black">لن يتم تسجيله</span> في قائمة السيارات المتواجدة بالداخل.
        </p>

        {/* Plate Mockup in Warning Modal */}
        <div className="flex items-center justify-center mb-6 text-center scale-100 origin-center shrink-0">
          <EgyptianPlate 
            plateNumber={plateNumber} 
            size="md" 
          />
        </div>
        
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-4 rounded-2xl font-black text-lg hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all outline-none active:scale-[0.98]"
          >
            حسنًا، فهمت
          </button>
        </div>
      </div>
    </div>
  );
});
