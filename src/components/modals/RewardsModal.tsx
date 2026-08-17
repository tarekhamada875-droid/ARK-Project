import React, { memo } from 'react';
import { ArrowRight, HelpCircle } from 'lucide-react';
import { Garage } from '../../types';

interface RewardsModalProps {
  garage: Garage;
  onClose: () => void;
  onToggleMenu?: () => void;
  referralBonusBalance?: number;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const RewardsModal: React.FC<RewardsModalProps> = memo(({
  garage,
  onClose
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-[#faf9f6] dark:bg-slate-950 flex flex-col transition-colors" dir="rtl">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 transition-colors">
        <button 
          type="button"
          onClick={onClose}
          className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors shadow-sm outline-none cursor-pointer shrink-0"
          aria-label="الرجوع"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none transition-colors">
            المكافآت
          </h3>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar-slate stable-scrollbar flex-1">
        <div className="max-w-xl mx-auto w-full space-y-4 sm:space-y-6">

          {/* Card 1: Reward Days Banner */}
          <div className="p-5 sm:p-6 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-2xl border border-emerald-500/30 text-right shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between gap-4 relative z-10">
              <div>
                <span className="text-xs font-bold text-emerald-400 block mb-1">رصيد الأيام المجانية المكتسبة</span>
                <span className="text-xs text-slate-300 font-medium block">تُضاف تلقائياً لتاريخ انتهاء اشتراكك</span>
              </div>

              <div className="text-left shrink-0">
                <span className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight leading-none">
                  {garage?.totalReferralRewardDays || 0}
                </span>
                <span className="text-xs font-bold text-slate-300 block text-left mt-1 font-mono">يوم مجاناً</span>
              </div>
            </div>
          </div>

          {/* Card 2: Referral Instructions Card */}
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              <HelpCircle className="w-5 h-5 text-emerald-500" />
              <h4 className="font-black text-base">ازاي تكسب 15 يوم مجاناً؟</h4>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  1
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">رشّح جراج جديد</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    يختار اسم جراجك (<span className="font-bold text-emerald-600 dark:text-emerald-400">{garage?.name || ''}</span>) كمرشِّح عند التسجيل.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  2
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">شحنة الجراج الأولى</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    عند موافقة الإدارة على أول شحنة تجديد اشتراك للجراج المرشَّح.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  3
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">إضافة +15 يوماً مجاناً 🎉</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    يتم تمديد اشتراكك فوراً بـ <strong className="text-emerald-600 dark:text-emerald-400 font-black">+15 يوماً مجاناً</strong> وتفعيل الحساب تلقائياً!
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
});

RewardsModal.displayName = 'RewardsModal';
