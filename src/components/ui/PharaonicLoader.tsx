/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Hourglass } from 'lucide-react';

interface PharaonicLoaderProps {
  targetView: string;
  onComplete: () => void;
}

export const PharaonicLoader: React.FC<PharaonicLoaderProps> = ({ targetView, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(5);

  // Define role-based friendly and completely normal messages
  const getMessages = () => {
    switch (targetView) {
      case 'general_manager_dashboard':
        return [
          'مرحباً بك يا فندم! جاري تسجيل الدخول بأمان...',
          'جاري تحميل بيانات الجراجات وتحديث التقارير العامة لمالك النظام...',
          'ثوانٍ معدودة... وستكون لوحة التحكم بالكامل جاهزة لبدء العمل.'
        ];
      case 'admin_dashboard':
        return [
          'أهلاً بك! جاري تهيئة لوحة التحكم الإدارية...',
          'جاري الاتصال الآمن بقاعدة البيانات وتحميل قائمة الجراجات والمشرفين...',
          'لحظات بسيطة... وتكون لوحة الإشراف جاهزة بالكامل للعمل الآن.'
        ];
      case 'delegate_dashboard':
        return [
          'أهلاً بك! جاري تهيئة نظام المندوبين وتجهيز الحساب...',
          'جاري ربط المحفظة وتحميل سجل الشحن والعمليات المتاحة اليوم...',
          'تم تأمين الاتصال بنجاح... جاهزون لبدء يوم عمل موفق ومليء بالخير.'
        ];
      default: // garage or staff
        return [
          'سعداء بوجودك معنا! جاري تسجيل الدخول إلى جراجك بأمان...',
          'جاري تحميل سجلات الجراج والسيارات النشطة والعمليات الحالية...',
          'تم تفعيل الاتصال بنجاح... الجراج جاهز تماماً لبدء استقبال المركبات.'
        ];
    }
  };

  const messages = getMessages();

  // Determine current active message index based on progress
  const getActiveMessageIndex = () => {
    if (progress < 33) return 0;
    if (progress < 66) return 1;
    return 2;
  };

  const activeMessageIndex = getActiveMessageIndex();

  useEffect(() => {
    // Smooth progress interval (50ms per tick over 5000ms total)
    const tickTime = 50;
    const totalDuration = 5000;
    const increment = (tickTime / totalDuration) * 100;

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return next;
      });
    }, tickTime);

    // Seconds countdown
    const secondsInterval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(secondsInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Call onComplete after 5 seconds
    const timeout = setTimeout(() => {
      onComplete();
    }, totalDuration);

    return () => {
      clearInterval(progressInterval);
      clearInterval(secondsInterval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none"
      dir="rtl"
    >
      {/* Background elegant shade */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950 to-slate-900 pointer-events-none" />

      {/* Main Content Card */}
      <div className="relative max-w-lg w-full flex flex-col items-center px-4 sm:px-8 z-10">

        {/* Dynamic, friendly message box */}
        <div className="min-h-[4.5rem] flex items-center justify-center mb-8 px-4 w-full">
          <AnimatePresence mode="wait">
            <motion.p
              key={activeMessageIndex}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="text-slate-300 font-bold text-base sm:text-lg leading-relaxed text-center max-w-sm"
            >
              {messages[activeMessageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Gold style Progress Bar */}
        <div className="w-full bg-slate-900 border border-amber-500/10 h-3 sm:h-4 rounded-full overflow-hidden mb-6 relative p-[2px]">
          <motion.div 
            className="h-full bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 rounded-full relative"
            style={{ width: `${progress}%` }}
            initial={{ width: '0%' }}
            animate={{ width: `${progress}%` }}
            transition={{ ease: 'linear' }}
          >
            {/* Glossy overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent" />
          </motion.div>
        </div>

        {/* Status indicator and countdown */}
        <div className="flex items-center justify-between w-full text-xs sm:text-sm font-bold text-slate-500 dark:text-slate-400 border-t border-slate-900 pt-4 mt-2">
          <div className="flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-amber-500/70 animate-spin" />
            <span>جاري تهيئة الاتصال...</span>
          </div>
          <div className="flex items-center gap-1 font-mono">
            <span>سيتم فتح النظام خلال</span>
            <span className="text-amber-400 font-black text-sm px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/20">{secondsLeft}</span>
            <span>ثوانِ</span>
          </div>
        </div>

      </div>

      {/* Footer Branding */}
      <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-3 pointer-events-none text-slate-600 font-bold text-[10px] tracking-wider uppercase">
        <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-amber-500/10" />
        <span className="tracking-widest opacity-40 font-mono">ARQ FOR SOFTWARE DEVELOPMENT</span>
        <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-amber-500/10" />
      </div>
    </div>
  );
};
