import React from 'react';
import { RechargeRequest } from '../../types';
import { safeDate } from '../../utils';

interface AdminRequestsTabProps {
  requests: RechargeRequest[];
  onApprove: (request: RechargeRequest) => void;
  onReject: (request: RechargeRequest) => void;
  showToast?: (msg: string, type?: string) => void;
}

export const AdminRequestsTab: React.FC<AdminRequestsTabProps> = ({
  requests,
  onApprove,
  onReject
}) => {
  const pendingRequests = requests.filter(r => r.status === 'pending');

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">لا توجد طلبات تفعيل أو تجديد معلقة حالياً</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-black text-slate-900 dark:text-white">
        طلبات الشحن والتجديد المعلقة ({pendingRequests.length})
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingRequests.map((req) => {
          const reqDate = req.createdAt ? safeDate(req.createdAt) : null;

          return (
            <div
              key={req.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base">
                    جراج: {req.garageName}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                    المندوب: {req.delegateName || 'مباشر'}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  قيد الانتظار
                </span>
              </div>

              <div className="space-y-1.5 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                <div className="flex justify-between">
                  <span>الباقة المطلوبة:</span>
                  <span className="text-slate-900 dark:text-white">{req.packageName || 'باقة اشتراك'}</span>
                </div>
                <div className="flex justify-between">
                  <span>المبلغ المفروض:</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">{req.price || req.revenueAmount || req.amount || 0} ج.م</span>
                </div>
                {reqDate && (
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>تاريخ الطلب:</span>
                    <span className="font-mono">{reqDate.toLocaleString('ar-EG')}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onApprove(req)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95"
                >
                  تفعيل الشحن
                </button>
                <button
                  type="button"
                  onClick={() => onReject(req)}
                  className="px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-xl font-bold text-xs transition-all active:scale-95"
                >
                  رفض
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminRequestsTab;
