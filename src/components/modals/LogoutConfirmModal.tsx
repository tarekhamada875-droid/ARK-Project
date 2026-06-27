import React, { useState, useEffect } from 'react';
import { Delete, Loader2 } from 'lucide-react';
import { normalizeDigits } from '../../utils';

interface LogoutConfirmModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  correctPin: string;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  onConfirm,
  onCancel,
  correctPin
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [attempts, setAttempts] = useState(() => {
    return parseInt(localStorage.getItem('logout_attempts') || '0');
  });

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4 && !isLoggingOut) {
      const newPin = pin + num;
      setPin(newPin);
      setError(false);
    }
  };

  const handleBackspace = () => {
    if (pin.length > 0 && !isLoggingOut) {
      setPin(pin.slice(0, -1));
      setError(false);
    }
  };

  const handleLogoutSubmit = async () => {
    if (pin.length < 4 || isLoggingOut) return;
    setIsLoggingOut(true);
    setError(false);
    
    // Simulate verification delay like the login screen to show the loader
    await new Promise((resolve) => setTimeout(resolve, 800));
    
    if (normalizeDigits(pin) === normalizeDigits(correctPin)) {
      localStorage.setItem('logout_attempts', '0');
      setAttempts(0);
      onConfirm();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('logout_attempts', newAttempts.toString());
      setError(true);
      setIsLoggingOut(false);
      
      if (newAttempts >= 3) {
        const lockoutTime = Date.now() + 7 * 24 * 60 * 60 * 1000;
        localStorage.setItem('logout_lockout_until', lockoutTime.toString());
        setTimeout(() => {
          onCancel(); 
        }, 1000);
      } else {
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 1200);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div 
        onClick={onCancel}
        className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm"
      />
      <div 
        className="relative bg-[#faf9f6] dark:bg-slate-900 w-full max-w-sm rounded-[2rem] p-8 border border-slate-150 dark:border-slate-800 shadow-xl"
        dir="rtl"
      >
        <div className="text-center mb-8">
          <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-4">
            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-black mt-2 block select-none">
              (متبقي لك {3 - attempts} محاولات)
            </span>
          </p>
        </div>

        {/* PIN Display */}
        <div className="flex justify-center gap-3 mb-8" dir="ltr">
          {[0, 1, 2, 3].map((i) => (
            <div 
              key={i}
              className={`w-14 h-18 rounded-2xl border-2 flex items-center justify-center text-4xl font-black relative overflow-hidden transition-all ${
                error 
                  ? 'border-red-500 text-red-500 bg-red-50 dark:bg-red-950/30' 
                  : (pin[i] ? 'border-emerald-500 text-white bg-emerald-600' : 'border-slate-200 dark:border-slate-800 text-transparent bg-slate-50/50 dark:bg-slate-800/50')
              }`}
            >
              <span className="relative z-10">{pin[i] ? '•' : ''}</span>
            </div>
          ))}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3" dir="ltr">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              type="button"
              disabled={isLoggingOut}
              onClick={() => handleKeyPress(num.toString())}
              className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100/50 dark:border-slate-800/50 text-2xl font-black text-slate-900 dark:text-white active:scale-[0.95] dark:active:bg-slate-700 outline-none transition-all disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={onCancel}
            className="h-16 rounded-2xl bg-[#faf9f6] dark:bg-slate-900 border-2 border-slate-150 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 font-extrabold text-sm active:scale-[0.95] outline-none transition-all disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100/50 dark:border-slate-800/50 text-2xl font-black text-slate-900 dark:text-white active:scale-[0.95] dark:active:bg-slate-700 outline-none transition-all disabled:opacity-50"
          >
            0
          </button>
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center active:scale-[0.95] outline-none transition-all disabled:opacity-50"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>

        {/* Submit Logout Button */}
        <div className="mt-6" dir="rtl">
          <button
            type="button"
            onClick={handleLogoutSubmit}
            disabled={pin.length < 4 || isLoggingOut}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] outline-none"
          >
            {isLoggingOut ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <span>تسجيل الخروج</span>
            )}
          </button>
        </div>

        {error && (
          <div 
            className="text-red-500 dark:text-red-400 text-center font-bold mt-4 text-sm animate-pulse"
          >
            الرمز السري غير صحيح
          </div>
        )}
      </div>
    </div>
  );
};
