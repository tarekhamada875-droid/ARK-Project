import React from 'react';
import { Garage } from '../../types';
import { safeDate, isSubscriptionExpired } from '../../utils';

interface AdminGarageListProps {
  garages: Garage[];
  isLoading: boolean;
  onSelectGarage: (garage: Garage) => void;
  garagePage: number;
  setGaragePage: (page: React.SetStateAction<number>) => void;
  totalGarages: number;
  GARAGES_PER_PAGE: number;
}

export const AdminGarageList: React.FC<AdminGarageListProps> = ({
  garages,
  isLoading,
  onSelectGarage,
  garagePage,
  setGaragePage,
  totalGarages,
  GARAGES_PER_PAGE
}) => {
  if (isLoading && garages.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 animate-pulse h-48" />
        ))}
      </div>
    );
  }

  if (garages.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm">لا توجد جراجات مطابقة للبحث</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {garages.map((garage) => {
          const expired = isSubscriptionExpired(garage);
          const expiryDate = garage.balanceExpiry ? safeDate(garage.balanceExpiry) : null;

          return (
            <div
              key={garage.id}
              onClick={() => onSelectGarage(garage)}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:border-emerald-500/50 transition-all cursor-pointer shadow-sm hover:shadow-md group relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-black text-slate-900 dark:text-white text-base group-hover:text-emerald-500 transition-colors">
                    {garage.name}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                    المالك: {garage.ownerName || 'غير محدد'}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black ${
                    expired
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  }`}
                >
                  {expired ? 'منتهي الاشتراك' : 'نشط'}
                </span>
              </div>

              <div className="space-y-2 text-xs font-bold text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex justify-between items-center">
                  <span>الهاتف:</span>
                  <span className="font-mono text-slate-900 dark:text-white">{garage.phone || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>رمز الدخول (PIN):</span>
                  <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{garage.ownerPin || '—'}</span>
                </div>
                {expiryDate && (
                  <div className="flex justify-between items-center">
                    <span>انتهاء الاشتراك:</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {expiryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalGarages > (garagePage + 1) * GARAGES_PER_PAGE && (
        <button
          onClick={() => setGaragePage((p: number) => p + 1)}
          className="w-full mt-4 py-3 text-sm font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl hover:opacity-90 transition-opacity shadow-sm"
        >
          تحميل المزيد ({totalGarages - (garagePage + 1) * GARAGES_PER_PAGE} جراج متبقي)
        </button>
      )}
    </div>
  );
};

export default AdminGarageList;
