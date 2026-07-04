/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ChevronRight, Delete } from 'lucide-react';
import { Spinner } from '../ui/Spinner';
import { normalizeDigits } from '../../utils';

interface LoginViewProps {
  loginPhone: string;
  setLoginPhone: (phone: string) => void;
  handleGarageLogin: () => Promise<void>;
  isLoading: boolean;
  closeKeyboard: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  loginPhone,
  setLoginPhone,
  handleGarageLogin,
  isLoading,
  closeKeyboard,
}) => {
  const handleKeyPress = (key: string) => {
    if (isLoading) return;
    if (loginPhone.length < 11) {
      setLoginPhone(loginPhone + key);
    }
  };

  const handleDelete = () => {
    if (isLoading) return;
    setLoginPhone(loginPhone.slice(0, -1));
  };

  const handleClearAll = () => {
    if (isLoading) return;
    setLoginPhone('');
  };

  // Calculate dynamic size based on length for the phone number
  const getBoxSize = () => {
    if (loginPhone.length <= 4) return 'w-12 h-16 sm:w-16 sm:h-22 md:w-20 md:h-26 text-2xl sm:text-4xl md:text-5xl';
    if (loginPhone.length <= 6) return 'w-10 h-14 sm:w-14 sm:h-18 md:w-17 md:h-22 text-xl sm:text-3xl md:text-4xl';
    if (loginPhone.length <= 8) return 'w-8 h-12 sm:w-11 sm:h-15 md:w-14 md:h-18 text-lg sm:text-2xl md:text-3xl';
    if (loginPhone.length <= 10) return 'w-7.5 h-11 sm:w-9.5 sm:h-13 md:w-12 md:h-16 text-base sm:text-xl md:text-2xl';
    return 'w-[24px] h-9 sm:w-8 sm:h-12 md:w-10 md:h-14 text-sm sm:text-lg md:text-xl';
  };

  const getGapClass = () => {
    if (loginPhone.length <= 6) return 'gap-1.5 sm:gap-2.5';
    if (loginPhone.length <= 9) return 'gap-1 sm:gap-1.5';
    return 'gap-[3px] sm:gap-[5px]';
  };

  return (
    <div 
      className="h-screen w-full bg-[#faf9f6] dark:bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-10 md:p-16 font-sans relative overflow-hidden" 
      dir="rtl"
      onClick={closeKeyboard}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white dark:bg-slate-900/60 backdrop-blur-xl w-full max-w-sm sm:max-w-lg md:max-w-xl rounded-xl pt-10 pb-10 sm:pt-14 sm:pb-14 px-6 sm:px-10 border border-slate-100 dark:border-slate-800/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] dark:shadow-none overflow-hidden"
      >
        {/* Upper Header Accent */}
        <div className="flex flex-col items-center justify-center mb-6 sm:mb-8 select-none text-center">
          <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 font-sans">بوابة الدخول</h2>
        </div>

        {/* Display Area */}
        <div className={`flex justify-center ${getGapClass()} mb-6 sm:mb-8 min-h-[4rem] sm:min-h-[5.5rem] md:min-h-[7rem] items-center transition-all duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`} dir="ltr">
          {Array.from({ length: Math.max(4, loginPhone.length) }).map((_, i) => (
            <div 
              key={i}
              className={`${getBoxSize()} rounded-xl sm:rounded-2xl border-2 flex items-center justify-center font-bold font-mono shrink-0 relative overflow-hidden transition-all duration-200 ${
                loginPhone[i] 
                  ? 'border-emerald-600 dark:border-emerald-500 text-white bg-emerald-600 dark:bg-emerald-500 dark:text-slate-950 shadow-sm shadow-emerald-500/10' 
                  : 'border-slate-200 dark:border-slate-800 text-transparent bg-slate-50/50 dark:bg-slate-900/50'
              }`}
            >
              <span className="relative z-10">{loginPhone[i] ? normalizeDigits(loginPhone[i]) : ''}</span>
            </div>
          ))}
        </div>

        {/* Numeric Keypad - Premium Minimalist Style */}
        <div className={`grid grid-cols-3 gap-2 sm:gap-4 transition-all duration-300 ${isLoading ? 'opacity-40 pointer-events-none' : ''}`} dir="ltr">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              disabled={isLoading}
              onClick={() => handleKeyPress(num.toString())}
              className="h-14 sm:h-18 md:h-22 rounded-2xl bg-slate-50/40 hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800/60 text-xl sm:text-2xl md:text-3xl font-bold font-mono text-slate-800 dark:text-slate-200 active:bg-slate-200 dark:active:bg-slate-700 outline-none transition-all active:scale-[0.98] disabled:pointer-events-none flex items-center justify-center hover:shadow-[0_4px_12px_rgba(0,0,0,0.01)] hover:border-amber-500/30 dark:hover:border-amber-400/20"
            >
              {num}
            </button>
          ))}
          <button
            disabled={isLoading}
            onClick={handleClearAll}
            className="h-14 sm:h-18 md:h-22 rounded-2xl bg-[#faf9f6] dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold text-xs sm:text-sm outline-none uppercase tracking-wider disabled:pointer-events-none flex items-center justify-center transition-all active:scale-[0.98] active:bg-slate-100 dark:active:bg-slate-950"
          >
            مسح الكل
          </button>
          <button
            disabled={isLoading}
            onClick={() => handleKeyPress('0')}
            className="h-14 sm:h-18 md:h-22 rounded-2xl bg-slate-50/40 hover:bg-slate-50 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-100 dark:border-slate-800/60 text-xl sm:text-2xl md:text-3xl font-bold font-mono text-slate-800 dark:text-slate-200 active:bg-slate-200 dark:active:bg-slate-700 outline-none transition-all active:scale-[0.98] disabled:pointer-events-none flex items-center justify-center hover:shadow-[0_4px_12px_rgba(0,0,0,0.01)] hover:border-amber-500/30 dark:hover:border-amber-400/20"
          >
            0
          </button>
          <button
            disabled={isLoading}
            onClick={handleDelete}
            className="h-14 sm:h-18 md:h-22 rounded-2xl bg-slate-100/30 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center active:bg-slate-200 dark:active:bg-slate-700 active:scale-[0.98] outline-none disabled:pointer-events-none"
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Action Button */}
        <button 
          onClick={handleGarageLogin}
          disabled={isLoading || !loginPhone}
          className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-white dark:text-slate-950 py-4 sm:py-5 rounded-2xl font-bold text-base sm:text-xl disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center mt-6 sm:mt-8 outline-none shadow-sm hover:shadow-md active:scale-[0.99]"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Spinner className="w-5 h-5 border-current" />
              <span className="text-sm sm:text-base font-bold">جاري التحميل...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>تسجيل الدخول</span>
              <ChevronRight className="w-5 h-5 rotate-180" />
            </div>
          )}
         </button>
      </div>

      {/* Brand Footer */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 select-none text-slate-400 dark:text-slate-500 font-bold text-[10px] tracking-wider uppercase">
        <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-slate-200 dark:to-slate-800" />
        <span className="brand-shimmer-text">ARQ FOR SOFTWARE DEVELOPMENT</span>
        <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" />
      </div>
    </div>
  );
};
