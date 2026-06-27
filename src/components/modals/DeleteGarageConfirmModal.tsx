import React from 'react';
import { Trash2 } from 'lucide-react';
import { Garage } from '../../types';

interface DeleteGarageConfirmModalProps {
  garage: Garage;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteGarageConfirmModal: React.FC<DeleteGarageConfirmModalProps> = ({
  garage,
  isLoading,
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
      <div className="relative bg-[#faf9f6] dark:bg-slate-900 w-full max-w-xs rounded-[2rem] p-6 text-center border border-transparent dark:border-slate-800" dir="rtl">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border-2 border-red-100 dark:border-red-900/30">
          <Trash2 className="w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter transition-colors">حذف الجراج؟</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed transition-colors">
          سيتم حذف جراج <span className="font-bold text-slate-900 dark:text-white">"{garage.name}"</span> وكامل بياناته نهائياً من السيستم.
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full py-4 bg-red-500 dark:bg-red-600 text-white rounded-xl font-black text-lg disabled:opacity-50 transition-all outline-none"
          >
            {isLoading ? 'جاري الحذف...' : 'نعم، حذف الجراج'}
          </button>
          <button 
            onClick={onCancel}
            className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all outline-none"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
