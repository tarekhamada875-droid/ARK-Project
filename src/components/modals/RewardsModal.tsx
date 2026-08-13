import React, { memo } from 'react';
import { X, Menu, Gift, Sparkles, HelpCircle } from 'lucide-react';
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
  onClose,
  onToggleMenu,
  referralBonusBalance = 0
}) => {
  const balance = referralBonusBalance || garage?.referralBonusBalance || 0;

  return (
    <div className="fixed inset-0 z-[100] bg-[#faf9f6] dark:bg-slate-950 flex flex-col transition-colors" dir="rtl">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-none mb-1 transition-colors">
              نظام المكافآت
            </h3>
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter transition-colors">
              تابِع رصيد مكافآتك واكسب من ترشيح أصحاب الجراجات
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm outline-none"
            aria-label="إغلاق"
          >
            <X className="w-6 h-6" />
          </button>
          {onToggleMenu && (
            <button 
              type="button"
              onClick={onToggleMenu}
              className="w-10 h-10 bg-slate-900 dark:bg-slate-800 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-sm outline-none"
              aria-label="القائمة"
            >
              <Menu className="w-6 h-6 stroke-[3]" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 overflow-y-auto custom-scrollbar-slate stable-scrollbar flex-1">
        <div className="max-w-xl mx-auto w-full space-y-6">

          {/* Large Reward Balance Banner */}
          <div className="p-6 sm:p-8 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-[2rem] border-2 border-emerald-500/30 text-right shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between gap-4 mb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                  <Gift className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-400 block mb-0.5">رصيد المكافآت الحالي</span>
                  <h2 className="text-lg font-black text-white">فلوس المكافآت بتاعتك</h2>
                </div>
              </div>

              <div className="text-left shrink-0">
                <span className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight leading-none">
                  {balance}
                </span>
                <span className="text-xs font-bold text-slate-300 block text-left mt-1 font-mono">جنيه</span>
              </div>
            </div>

            <div className="pt-4 border-t border-emerald-500/20 flex items-center justify-between text-xs text-slate-300 font-medium relative z-10">
              <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <Sparkles className="w-4 h-4" />
                تقدر تستخدم الرصيد ده في شحن وتجديد اشتراك جراجك
              </span>
            </div>
          </div>

          {/* Referral Instructions Card */}
          <div className="p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-150 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-slate-900 dark:text-white pb-3 border-b border-slate-100 dark:border-slate-800">
              <HelpCircle className="w-5 h-5 text-emerald-500" />
              <h4 className="font-black text-base">ازاي تاخد مكافأة الترشيح؟</h4>
            </div>

            <div className="space-y-3.5 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  1
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">رشّح أي صاحب جراج تاني</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    قول لأي صاحب جراج تاني يسجل باسم جراجك (<span className="font-bold text-emerald-600 dark:text-emerald-400">{garage?.name || ''}</span>) وهو بيشترك معانا.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  2
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">خد 50 جنيه مع أول شحنة</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    أول ما الجراج اللي رشحته يشحن أو يجدد اشتراكه لأول مرة، هينزل في حسابك <strong className="text-emerald-600 dark:text-emerald-400 font-black">50 جنيه مكافأة</strong> على طول!
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                  3
                </div>
                <div>
                  <span className="font-bold text-slate-900 dark:text-slate-100 block">مكافأة كل شهر لمدة 6 شهور</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                    هتاخد <strong className="text-emerald-600 dark:text-emerald-400 font-black">50 جنيه كل شهر</strong> مع كل تجديد للجراج اللي رشحته لمدة 6 شهور ورا بعض!
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
