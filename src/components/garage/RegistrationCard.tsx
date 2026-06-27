import React, { memo } from 'react';
import { Delete } from 'lucide-react';
import { getCleanPlate, getRawPlate, getPlateParts, isPlateValid, formatPlateLetters } from '../../utils';
import { Garage, Vehicle } from '../../types';
import { LicensePlateKeyboard } from './LicensePlateKeyboard';

interface RegistrationCardProps {
  newPlateNumber: string;
  setNewPlateNumber: (val: string) => void;
  isInputFocused: boolean;
  setIsInputFocused: (val: boolean) => void;
  plateInputRef: React.RefObject<HTMLInputElement>;
  vehicles: Vehicle[];
  garage: Garage;
  handleCheckIn: (type: 'hourly' | 'overnight') => void;
  onCheckOut: (vehicle: Vehicle) => void;
  closeKeyboard: () => void;
  inputRef: React.RefObject<HTMLDivElement>;
}

export const RegistrationCard = memo(({
  newPlateNumber,
  setNewPlateNumber,
  isInputFocused,
  setIsInputFocused,
  plateInputRef,
  vehicles,
  garage,
  handleCheckIn,
  onCheckOut,
  closeKeyboard,
  inputRef
}: RegistrationCardProps) => {
  // Force input value to stay in sync with state
  // even when getCleanPlate results in no state change (e.g. typing a space)
  React.useEffect(() => {
    if (plateInputRef.current && plateInputRef.current.value !== newPlateNumber) {
      plateInputRef.current.value = newPlateNumber;
    }
  }, [newPlateNumber]);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      // Don't close if they click inside the card containing the keyboard
      if (
        isInputFocused && 
        inputRef.current && 
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsInputFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isInputFocused, setIsInputFocused, inputRef]);

  const handleVirtualKeyPress = (key: string) => {
    const raw = getRawPlate(newPlateNumber + key);
    const clean = getCleanPlate(raw);
    setNewPlateNumber(clean);
  };

  return (
    <div 
      ref={inputRef}
      className={`bg-[#faf9f6] dark:bg-slate-900 rounded-[2rem] border relative shrink-0 p-4 md:p-8 max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl mx-auto w-full transition-all duration-150 ${
        isInputFocused 
          ? 'border-slate-900 dark:border-slate-700' 
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
        <div className="relative">
          <div className="flex flex-col gap-3 relative z-10">
            {newPlateNumber && (
              <button 
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setNewPlateNumber(newPlateNumber.slice(0, -1));
                  plateInputRef.current?.focus();
                }}
                className="absolute bg-red-500 text-white rounded-2xl flex items-center justify-center hover:bg-red-600 transition-colors outline-none -top-3 -left-3 w-10 h-10 md:w-16 md:h-16 md:-top-6 md:-left-6 z-50 shadow-md"
              >
                <Delete className="w-6 h-6 md:w-8 md:h-8" />
              </button>
            )}
            
            <div className="relative h-28 sm:h-36 md:h-52 lg:h-60 overflow-hidden" onClick={() => { setIsInputFocused(true); plateInputRef.current?.focus(); }}>
              <input 
                ref={plateInputRef}
                type="text" 
                inputMode="none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                value={newPlateNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  const clean = getCleanPlate(val);
                  
                  // Force state update even if same to ensure input sync
                  setNewPlateNumber(clean);
                }}
                onFocus={(e) => {
                  setIsInputFocused(true);
                  const len = e.target.value.length;
                  e.target.setSelectionRange(len, len);
                }}
                onBlur={() => {
                  // Small delay to allow other interactions
                  setTimeout(() => setIsInputFocused(false), 200);
                }}
                className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-text"
                dir="rtl"
              />
              
              <div className={`absolute inset-0 w-full h-full bg-white dark:bg-slate-200 border-slate-900 rounded-3xl overflow-hidden flex flex-col z-10 ${
                isInputFocused ? 'border-[4px]' : 'border-2 md:border-[3px]'
              }`} dir="ltr">
                {/* Plate Header */}
                <div className={`flex items-center justify-between px-6 font-black border-b border-slate-900/10 shrink-0 h-10 sm:h-14 md:h-20 ${
                  newPlateNumber 
                    ? 'bg-[#0057b7] text-white' 
                    : 'bg-slate-200 dark:bg-slate-300 text-slate-400 dark:text-slate-500'
                }`}>
                  <span className="tracking-tight antialiased text-[12px] sm:text-[16px] md:text-2xl">EGYPT</span>
                  <span className="font-sans antialiased text-[12px] sm:text-[16px] md:text-2xl" dir="rtl">مصر</span>
                </div>
 
                {/* Plate Content */}
                <div className="flex-1 flex items-center justify-between bg-[#fcfcfc] dark:bg-slate-200 overflow-hidden">
                  {/* Numbers Section */}
                  <div className={`flex-1 h-full flex justify-center items-center font-black text-slate-900 tracking-tighter truncate px-2 ${
                    newPlateNumber 
                      ? (getPlateParts(newPlateNumber).numbers.length >= 4
                          ? 'text-3xl sm:text-6xl md:text-7xl lg:text-8xl'
                          : 'text-4xl sm:text-7xl md:text-8xl lg:text-9xl') 
                      : 'text-xl sm:text-3xl md:text-5xl text-slate-200 dark:text-slate-400'
                  }`}>
                    {getPlateParts(newPlateNumber).numbers}
                  </div>
 
                  {/* Vertical Divider */}
                  <div className="w-[1.5px] md:w-[3px] h-[60%] bg-slate-200 dark:bg-slate-400" />
 
                  {/* Letters Section */}
                  <div className={`flex-1 h-full flex justify-center items-center font-black text-slate-800 truncate px-2 transition-all duration-150 ${
                    newPlateNumber 
                      ? (getPlateParts(newPlateNumber).letters.length >= 4
                          ? 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl tracking-normal'
                          : 'text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-[0.1em]') 
                      : 'text-xl sm:text-3xl md:text-5xl text-slate-200 dark:text-slate-400'
                  }`} dir="rtl">
                    {formatPlateLetters(getPlateParts(newPlateNumber).letters)}
                  </div>
                </div>
 
                {/* Fixed Cursor Line */}
                {isInputFocused && (
                  <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 w-12 md:w-20 h-1.5 md:h-2.5 bg-slate-900 rounded-full animate-pulse" />
                )}
              </div>
            </div>
 
            {(() => {
              const raw = getRawPlate(newPlateNumber);
              const isValid = isPlateValid(newPlateNumber);
 
              if (isInputFocused || (newPlateNumber && isValid)) {
                const existing = vehicles.find(v => getRawPlate(v.plateNumberRaw) === raw && v.status === 'inside');
                
                return (
                  <div className="overflow-hidden">
                    {existing ? (
                      <div className="mt-2">
                        <button 
                          onClick={() => {
                            closeKeyboard();
                            setNewPlateNumber('');
                            onCheckOut(existing);
                          }}
                          className="w-full py-4 md:py-8 bg-red-500 text-white rounded-2xl md:rounded-[2rem] flex flex-col items-center justify-center gap-1 md:gap-2 transition-all outline-none md:scale-[1.01] hover:bg-red-600 active:scale-[0.99] shadow-sm"
                        >
                          <div className="text-lg md:text-2xl font-black tracking-tight">إصدار فاتورة خروج</div>
                          <span className="text-[10px] md:text-sm opacity-90 font-bold uppercase tracking-widest">السيارة موجودة حالياً بالداخل</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-4 mt-1">
                          <button 
                            disabled={!isValid}
                            onClick={() => {
                              closeKeyboard();
                              handleCheckIn('hourly');
                            }}
                            className={`flex-1 py-4 md:py-8 rounded-2xl md:rounded-[2rem] flex flex-col items-center justify-center gap-1 md:gap-2 outline-none transition-all duration-150 ${
                              isValid 
                                ? 'bg-white dark:bg-slate-900 border-2 md:border-3 border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:scale-[0.98]' 
                                : 'bg-slate-100 dark:bg-slate-800/40 border-2 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <div className="text-base md:text-2xl uppercase tracking-tight font-black">ساعة</div>
                            <span className={`text-[10px] md:text-xs font-black tracking-widest ${
                              isValid ? 'text-slate-500 dark:text-slate-300' : 'text-slate-400/70 dark:text-slate-700'
                            }`}>{garage.hourlyRate} ج.م / ساعة</span>
                          </button>
                          <button 
                            disabled={!isValid}
                            onClick={() => {
                              closeKeyboard();
                              handleCheckIn('overnight');
                            }}
                            className={`flex-1 py-4 md:py-8 rounded-2xl md:rounded-[2rem] flex flex-col items-center justify-center gap-1 md:gap-2 outline-none transition-all duration-150 ${
                              isValid 
                                ? 'bg-emerald-600 dark:bg-emerald-600 border-2 md:border-3 border-emerald-700 dark:border-emerald-500 text-white font-black hover:bg-emerald-700 dark:hover:bg-emerald-600/90 active:scale-[0.98]' 
                                : 'bg-slate-100 dark:bg-slate-800/40 border-2 border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                            }`}
                          >
                            <div className="text-base md:text-2xl uppercase tracking-tight font-black">مبيت</div>
                            <span className={`text-[10px] md:text-xs font-black tracking-widest ${
                              isValid ? 'text-slate-950/80 dark:text-slate-950/85' : 'text-slate-400/70 dark:text-slate-700'
                            }`}> {garage.overnightRate} ج.م مبيت</span>
                          </button>
                        </div>
 
                        {isInputFocused && (
                          <div className="mt-4 md:mt-8">
                            <LicensePlateKeyboard 
                              onKeyPress={handleVirtualKeyPress}
                              currentValue={newPlateNumber}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
    </div>
  );
});
