import React, { memo } from 'react';
import { ChevronRight, Gift, Sparkles, Users } from 'lucide-react';
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
  const rewardDays = garage?.totalReferralRewardDays ?? 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[#faf9f6] dark:bg-slate-950 flex flex-col transition-colors" dir="rtl">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-150 dark:border-slate-800 flex items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 transition-colors">
        <button 
          type="button"
          onClick={onClose}
          className="w-10 h-10 bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 rounded-xl flex items-center justify-center hover:bg-slate-800 dark:hover:bg-amber-500 transition-colors shadow-sm outline-none cursor-pointer shrink-0"
          aria-label="الرجوع"
          title="رجوع"
        >
          <ChevronRight className="w-5.5 h-5.5 text-amber-400 dark:text-slate-950 stroke-[3.5]" />
        </button>
        <div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none transition-colors">
            المكافآت
          </h3>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar-slate stable-scrollbar flex-1">
        <div className="max-w-md mx-auto w-full space-y-4 sm:space-y-6">

          {/* Card 1: Centered Big Number Reward Days */}
          <div className="p-6 sm:p-8 bg-gradient-to-b from-emerald-950/80 via-slate-900 to-slate-950 rounded-2xl border border-emerald-500/30 text-center shadow-lg relative overflow-hidden flex flex-col items-center justify-center">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 flex flex-col items-center">
              <span className="text-6xl sm:text-7xl font-black text-emerald-400 font-mono tracking-tight leading-none mb-3 drop-shadow-sm">
                {rewardDays}
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-300">
                {rewardDays === 0 ? "أيام مجانية برصيدك" : rewardDays === 1 ? "يوم مجاني برصيدك" : rewardDays === 2 ? "يومان مجانيان برصيدك" : `${rewardDays} يوماً مجانياً برصيدك`}
              </span>
              <span className="text-xs text-slate-400 mt-1 font-medium">
                تُضاف تلقائياً لتاريخ انتهاء اشتراكك
              </span>
            </div>
          </div>

          {/* Card 2: Simple 2-Line Gift Logic */}
          <div className="p-5 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 text-right">
            <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400 pb-3 border-b border-slate-100 dark:border-slate-800 font-black text-base">
              <Gift className="w-5 h-5 shrink-0 text-amber-500 dark:text-amber-400" />
              <span>يومان مجانيان عن كل تجديد ناجح لجراج تم ترشيحه 🎁</span>
            </div>

            <div className="space-y-3">
              {/* Row 1 */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80">
                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">رشّح جراج جديد</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">أي صاحب جراج تعرفه وينضم للخدمة</p>
                </div>
              </div>

              {/* Row 2 */}
              <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-500/30">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">عن كل تجديد ناجح له</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                    يومان مجانيان عن كل تجديد ناجح لجراج تم ترشيحه
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

