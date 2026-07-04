import React from 'react';
import { Users, X, Car } from 'lucide-react';
import { Staff, Vehicle } from '../../types';
import { safeDate } from '../../utils';

interface StaffStatsModalProps {
  staffList: Staff[];
  vehiclesInside: Vehicle[];
  todayExitedVehicles: Vehicle[];
  onClose: () => void;
  now: Date;
}

export const StaffStatsModal: React.FC<StaffStatsModalProps> = ({
  staffList,
  vehiclesInside,
  todayExitedVehicles,
  onClose,
  now
}) => {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const allTodayVehicles = [...vehiclesInside, ...todayExitedVehicles].filter(v => {
    const entryDate = v.entryTime ? safeDate(v.entryTime) : null;
    return entryDate && entryDate >= startOfDay;
  });

  const getStaffStats = (staffName: string) => {
    return allTodayVehicles.filter(v => v.staffName === staffName).length;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#faf9f6] dark:bg-slate-950 flex flex-col transition-colors" dir="rtl">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 shrink-0 transition-colors">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">موظفي الوردية</h2>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">إحصائيات اليوم</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm outline-none"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar stable-scrollbar pb-10">
          {/* Manager Stat at the top */}
          <div className="p-4 bg-slate-900 rounded-2xl flex items-center justify-between">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white font-black text-lg">
                  م
                </div>
                <div>
                  <h3 className="font-black text-white text-sm">المدير</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">مسؤول النظام</p>
                </div>
             </div>
             <div className="flex flex-col items-end">
                <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                  <span className="text-lg font-black text-white leading-none">{getStaffStats('مدير الجراج')}</span>
                  <Car className="w-3.5 h-3.5 text-white/40" />
                </div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">سيارة اليوم</p>
             </div>
          </div>

          {staffList.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 transition-colors">
              <Users className="w-12 h-12 text-slate-100 dark:text-slate-800 mx-auto mb-3" />
              <p className="text-slate-300 dark:text-slate-700 font-bold text-sm">لا يوجد موظفين مسجلين</p>
            </div>
          ) : (
            staffList.map(staff => {
              const count = getStaffStats(staff.name);
              
              return (
                <div key={staff.id} className="p-4 bg-[#faf9f6] dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 font-black text-lg">
                        {staff.name.charAt(0)}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-sm">{staff.name}</h3>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1.5 bg-teal-50 dark:bg-teal-900/20 px-3 py-1.5 rounded-lg border border-teal-100 dark:border-teal-900/30">
                      <span className="text-lg font-black text-teal-600 dark:text-teal-400 leading-none">{count}</span>
                      <Car className="w-3.5 h-3.5 text-teal-500" />
                    </div>
                    <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter mt-1">سيارة اليوم</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
    </div>
  );
};
