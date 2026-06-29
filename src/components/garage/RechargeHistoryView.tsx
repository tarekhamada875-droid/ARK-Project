import { useState, useEffect, useMemo } from 'react';
import { X, Zap, Clock, User } from 'lucide-react';
import { firestoreService } from '../../services/firestoreService';
import { ActivityLog, Garage } from '../../types';

interface RechargeHistoryViewProps {
  garage: Garage;
  onClose: () => void;
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const RechargeHistoryView = ({ garage, onClose, showToast: _showToast }: RechargeHistoryViewProps) => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Subscribe to activity logs for this garage in real-time
  useEffect(() => {
    // Lock body scroll
    document.body.style.overflow = 'hidden';

    // Subscribe to garage recharge logs
    const unsub = firestoreService.subscribeToGarageRechargeLogs(garage.id, (rechargeLogs) => {
      setLogs(rechargeLogs);
      setIsLoading(false);
    });

    return () => {
      unsub();
      // Unlock body scroll
      document.body.style.overflow = 'unset';
    };
  }, [garage.id]);

  const latestRecharge = useMemo(() => {
    return logs[0] || null;
  }, [logs]);

  // Check if there is a "New" recharge that we haven't acknowledged
  useEffect(() => {
    if (latestRecharge && !isLoading) {
      // Mark as acknowledged immediately so the dashboard notification/dot turns off instantly or upon next visit
      localStorage.setItem(`acknowledged_recharge_${garage.id}`, latestRecharge.id);
    }
  }, [latestRecharge, isLoading, garage.id]);

  // When a new recharge is received in real-time, update seen last recharge so we track it
  useEffect(() => {
    if (latestRecharge) {
      const lastSeenId = localStorage.getItem(`seen_last_recharge_${garage.id}`);
      
      if (lastSeenId !== latestRecharge.id) {
        // Update seen last recharge so track state is correct
        localStorage.setItem(`seen_last_recharge_${garage.id}`, latestRecharge.id);
      }
    }
  }, [latestRecharge, garage.id]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'غير معروف';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'غير معروف';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-[#faf9f6] dark:bg-slate-950 z-[100] flex flex-col pt-safe px-safe overflow-hidden transition-colors" dir="rtl">
      {/* Header */}
      <header className="relative bg-[#faf9f6] dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 z-40 w-full shrink-0">
        <div className="max-w-4xl mx-auto flex justify-between items-center w-full">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100 tracking-tight leading-tight">تاريخ شحن الباقات</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-0.5">سجل عمليات الشحن الخاصة بالجراج</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="relative w-11 h-11 bg-red-500 hover:bg-red-600 text-white border border-red-600 rounded-2xl flex items-center justify-center transition-all outline-none active:scale-95"
            >
              <X className="w-6 h-6 stroke-[3]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto p-4 sm:p-6 pb-10 overflow-y-auto custom-scrollbar stable-scrollbar">
        
        {/* Previous History list */}
        <div className="space-y-4">
          <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">سجل العمليات السابقة</h3>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 rounded-full border-4 border-slate-200 border-t-rose-500 animate-spin" />
              <p className="text-sm font-bold text-slate-400">جاري تحميل سجل الشحن...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-[#faf9f6] dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-850">
              <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100 dark:border-slate-800">
                <Zap className="w-8 h-8 text-slate-300 dark:text-slate-700" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">لا يوجد تاريخ شحن مسجل لهذا الجراج.</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">تظهر هنا الباقات المشحونة فور تفعيلها بواسطة المناديب.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-[#faf9f6] dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4.5 flex flex-col hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
                >
                  {/* Top row: Package Name and Price */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 flex-1">
                      <span className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded-md">
                        عملية شحن باقة
                      </span>
                      <h4 className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100 leading-snug mt-1.5">
                        {log.plateNumber}
                      </h4>
                    </div>

                    <div className="flex flex-col items-end shrink-0 text-left">
                      <span className="text-sm md:text-base font-black text-slate-900 dark:text-white font-mono">
                        {log.amount !== undefined 
                          ? `${log.amount} ج.م` 
                          : (log.details?.revenueAmount !== undefined 
                              ? `${log.details.revenueAmount} ج.م` 
                              : (log.plateNumber?.match(/-\s*(\d+)\s*ج/)?.[1] 
                                  ? `${log.plateNumber.match(/-\s*(\d+)\s*ج/)?.[1]} ج.م` 
                                  : ''))}
                      </span>
                      <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/10 px-2 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        مكتملة
                      </span>
                    </div>
                  </div>

                  {/* Premium dashed divider representing a ticket */}
                  <div className="w-full border-t border-dashed border-slate-200 dark:border-slate-800 my-3.5" />

                  {/* Bottom row: Time & Delegate */}
                  <div className="flex justify-between items-center text-xs text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{formatTime(log.timestamp)} — {formatDate(log.timestamp)}</span>
                    </div>

                    {(log.staffName || log.operatorName) && (
                      <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/50 px-2.5 py-1 rounded-full text-2xs md:text-xs">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-300 font-bold">
                          {((log.staffName || log.operatorName) || '').includes('مدير النظام') || ((log.staffName || log.operatorName) || '').toLowerCase().includes('admin')
                            ? 'مدير النظام'
                            : `المسؤول: ${log.staffName || log.operatorName}`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
