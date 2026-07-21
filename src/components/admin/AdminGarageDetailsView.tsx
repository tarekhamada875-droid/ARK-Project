/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, memo } from 'react';
import { 
  Shield,
  ChevronRight, 
  CheckCircle2,
  Trash2, 
  Settings, 
  Users, 
  Car,
  Zap,
  Plus,
  Phone,
  Loader2,
  Sun,
  Moon,
  MoreVertical,
  Check
} from 'lucide-react';
import { firestoreService } from '../../services/firestoreService';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { normalizeDigits } from '../../utils';
import { Garage, Staff, Package } from '../../types';
import { useTheme } from '../../utils/ThemeContext';
import { useAdminTranslation } from '../../utils/adminTranslations';

interface AdminGarageDetailsViewProps {
  selectedGarageForDetails: Garage;
  setView: (view: any) => void;
  setSelectedGarageForDetails: (garage: Garage | null) => void;
  setShowDeleteConfirm: (show: boolean) => void;
  updateGarageRate: (garage: Garage, field: keyof Garage, value: number) => Promise<void>;
  showToast: (message: string, type?: 'success' | 'error') => void;
  staffList: Staff[];
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  packages: Package[];
}

export const AdminGarageDetailsView = memo(({
  selectedGarageForDetails,
  setView,
  setSelectedGarageForDetails,
  setShowDeleteConfirm,
  updateGarageRate: _updateGarageRate,
  showToast,
  staffList,
  isLoading,
  setIsLoading,
  packages
}: AdminGarageDetailsViewProps) => {
  const [showClearBalanceConfirm, setShowClearBalanceConfirm] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState({ name: '', pin: '' });
  const [pendingPackage, setPendingPackage] = useState<Package | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const { theme, toggleTheme, adminLang } = useTheme();
  const t = useAdminTranslation(adminLang);

  const [isEditingGaragePin, setIsEditingGaragePin] = useState(false);
  const [garagePinInput, setGaragePinInput] = useState(selectedGarageForDetails.pin || '');
  const [isUpdatingGaragePin, setIsUpdatingGaragePin] = useState(false);

  const [editingStaffPinId, setEditingStaffPinId] = useState<string | null>(null);
  const [editingStaffPinValue, setEditingStaffPinValue] = useState<string>('');
  const [isUpdatingStaffPin, setIsUpdatingStaffPin] = useState(false);

  const [hourlyRateInput, setHourlyRateInput] = useState<string>(String(selectedGarageForDetails.hourlyRate || 0));
  const [overnightRateInput, setOvernightRateInput] = useState<string>(String(selectedGarageForDetails.overnightRate || 0));
  const [isSavingRates, setIsSavingRates] = useState(false);

  const [monthlyGiftInput, setMonthlyGiftInput] = useState<string>(String(selectedGarageForDetails.monthlyGiftAmount || 0));
  const [isSavingGift, setIsSavingGift] = useState(false);

  React.useEffect(() => {
    setHourlyRateInput(String(selectedGarageForDetails.hourlyRate || 0));
    setOvernightRateInput(String(selectedGarageForDetails.overnightRate || 0));
  }, [selectedGarageForDetails.id, selectedGarageForDetails.hourlyRate, selectedGarageForDetails.overnightRate]);

  React.useEffect(() => {
    setGaragePinInput(selectedGarageForDetails.pin || '');
  }, [selectedGarageForDetails.id, selectedGarageForDetails.pin]);

  React.useEffect(() => {
    setMonthlyGiftInput(String(selectedGarageForDetails.monthlyGiftAmount || 0));
  }, [selectedGarageForDetails.id, selectedGarageForDetails.monthlyGiftAmount]);

  const hasRateChanges = 
    hourlyRateInput !== String(selectedGarageForDetails.hourlyRate || 0) ||
    overnightRateInput !== String(selectedGarageForDetails.overnightRate || 0);

  const hasGiftChanges = monthlyGiftInput !== String(selectedGarageForDetails.monthlyGiftAmount || 0);

  const handleSaveRates = async () => {
    const hourly = Number(normalizeDigits(hourlyRateInput));
    const overnight = Number(normalizeDigits(overnightRateInput));

    if (isNaN(hourly) || isNaN(overnight)) {
      showToast(t('الرجاء إدخال أرقام صحيحة'), 'error');
      return;
    }

    setIsSavingRates(true);
    try {
      await firestoreService.updateGarage(selectedGarageForDetails.id, {
        hourlyRate: hourly,
        overnightRate: overnight,
      });
      showToast(t('تم تحديث التعريفة بنجاح'));
    } catch (e) {
      showToast(t('فشل تحديث التعريفة'), 'error');
    } finally {
      setIsSavingRates(false);
    }
  };

  const handleSaveGift = async () => {
    const val = Number(normalizeDigits(monthlyGiftInput));

    if (isNaN(val) || val < 0) {
      showToast(t('الرجاء إدخال رقم صحيح'), 'error');
      return;
    }

    setIsSavingGift(true);
    try {
      await firestoreService.updateGarage(selectedGarageForDetails.id, {
        monthlyGiftAmount: val,
      });
      showToast(t('تم تحديث الرصيد الهدية بنجاح'));
    } catch (e) {
      showToast(t('فشل تحديث الرصيد الهدية'), 'error');
    } finally {
      setIsSavingGift(false);
    }
  };

  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRechargeSubmit = async (pkg: Package) => {
    setIsLoading(true);
    try {
      const isSubscriptionGarage = selectedGarageForDetails.billingModel === 'subscription';
      const commission = selectedGarageForDetails.commissionPerVehicle || 1;
      
      const updateData: any = {
        totalAdminRevenue: Number(((selectedGarageForDetails.totalAdminRevenue || 0) + pkg.price).toFixed(2)),
        isLocked: false,
        lastRechargeDate: serverTimestamp()
      };

      if (isSubscriptionGarage) {
        let baseDate = new Date();
        const currentExpiry = selectedGarageForDetails.balanceExpiry;
        if (currentExpiry) {
          const currentExpiryDate = currentExpiry.toDate ? currentExpiry.toDate() : new Date(currentExpiry);
          if (currentExpiryDate > baseDate) {
            baseDate = currentExpiryDate;
          }
        }
        const days = pkg.id === 'weekly_sub' ? 7 : 30;
        baseDate.setDate(baseDate.getDate() + days);
        
        updateData.balanceExpiry = Timestamp.fromDate(baseDate);
        updateData.billingModel = 'subscription';
      } else {
        const balanceValue = pkg.vehiclesCount * commission;
        updateData.balance = Number(((selectedGarageForDetails.balance || 0) + balanceValue).toFixed(2));
        updateData.totalRechargedCars = (selectedGarageForDetails.totalRechargedCars || 0) + pkg.vehiclesCount;
      }

      await firestoreService.updateGarage(selectedGarageForDetails.id, updateData);

      await firestoreService.addActivityLog({
        garageId: selectedGarageForDetails.id,
        garageName: selectedGarageForDetails.name,
        staffId: 'admin',
        staffName: adminLang === 'en' ? 'System Administrator (Admin)' : 'مدير النظام (Admin)',
        actionType: 'recharge',
        plateNumber: isSubscriptionGarage
          ? (adminLang === 'en' ? `Recharge Subscription: ${pkg.name} (${pkg.vehiclesCount} Days) - ${pkg.price} EGP` : `تجديد اشتراك: ${pkg.name} (${pkg.vehiclesCount} يوم) - ${pkg.price} ج`)
          : (adminLang === 'en' ? `Recharge package ${pkg.name} (${pkg.vehiclesCount} Cars) - ${pkg.price} EGP` : `شحن باقة ${pkg.name} (${pkg.vehiclesCount} سيارة) - ${pkg.price} ج`),
        timestamp: serverTimestamp() as any,
        amount: pkg.price,
        packageId: pkg.id
      });
      showToast(isSubscriptionGarage 
        ? (adminLang === 'en' ? `Subscription extended by ${pkg.vehiclesCount} days` : `تم تمديد الاشتراك بـ ${pkg.vehiclesCount} يوم`)
        : (adminLang === 'en' ? `Successfully recharged ${pkg.vehiclesCount} cars` : `تم شحن ${pkg.vehiclesCount} سيارة`));
      setPendingPackage(null);
    } catch (e) { 
      showToast(t('فشل'), 'error'); 
    } finally { 
      setIsLoading(false); 
    }
  };

  React.useEffect(() => {
    if (showAddStaffModal || staffToDelete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddStaffModal, staffToDelete]);

  // Use counters from the garage document for "today" stats if they match today's date
  const today = new Date().toISOString().split('T')[0];
  const isTodayValid = selectedGarageForDetails.lastTransactionDate === today;
  
  const dailyCount = isTodayValid ? (selectedGarageForDetails.todayCount || 0) : 0;
  const dailyRevenue = isTodayValid ? (selectedGarageForDetails.todayRevenue || 0) : 0;
  
  // Overall/Monthly totals
  const totalCount = selectedGarageForDetails.totalVehiclesOut || 0;
  const totalRevenue = selectedGarageForDetails.totalRevenue || 0;

  // Generate unique-ish PIN for new staff
  const generateNewStaffPin = () => {
    let newPin = '';
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 50) {
      newPin = Math.floor(100000 + Math.random() * 900000).toString();
      isUnique = !staffList.some(s => s.pin === newPin);
      attempts++;
    }
    return newPin;
  };

  const openAddStaffModal = () => {
    setStaffForm({ name: '', pin: generateNewStaffPin() });
    setShowAddStaffModal(true);
  };

  return (
    <div className={`h-screen bg-[#faf9f6] dark:bg-slate-950 font-sans pb-32 text-slate-900 dark:text-slate-100 transition-colors custom-scrollbar-slate ${adminLang === 'en' ? 'text-left' : 'text-right'} ${showAddStaffModal || staffToDelete ? 'overflow-hidden' : 'overflow-y-auto'}`} dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 mb-8 transition-colors">
        <div className="max-w-5xl mx-auto flex justify-between items-center h-full">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setView('admin_dashboard');
                setSelectedGarageForDetails(null);
                setShowDeleteConfirm(false);
              }}
              className="flex items-center justify-center w-10 h-10 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white rounded-xl border border-slate-200 dark:border-slate-700 outline-none cursor-pointer transition-colors"
              title={t('رجوع')}
            >
              <ChevronRight className={`w-5.5 h-5.5 text-slate-600 dark:text-slate-300 stroke-[3.5] ${adminLang === 'en' ? 'rotate-180' : ''}`} />
            </button>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">{t('تفاصيل الجراج')}</h1>
          </div>
          <div className="flex items-center gap-2 relative" ref={menuRef}>
            <button 
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all outline-none border-2 ${showMenu ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}
            >
              <MoreVertical className="w-5 h-5 text-slate-600 dark:text-slate-400 stroke-[3]" />
            </button>

            {showMenu && (
              <>
                {/* Backdrop to prevent the menu from melting into the background */}
                <div 
                  className="fixed inset-0 z-40 bg-slate-900/10 dark:bg-black/35 backdrop-blur-[2px]" 
                  onClick={() => setShowMenu(false)}
                />
                
                <div className={`absolute top-14 ${adminLang === 'en' ? 'right-0' : 'left-0'} w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl z-50 overflow-hidden`}>
                  <div className="p-4 flex flex-col gap-2">
                    <span className={`font-bold text-xs text-slate-400 dark:text-slate-500 pr-1 select-none ${adminLang === 'en' ? 'text-left' : 'text-right'}`}>{t('وضع الشاشة:')}</span>
                    <div className="flex gap-2">
                      {/* النهارى (Light Mode) Button */}
                      <button 
                        type="button"
                        onClick={() => {
                          if (theme !== 'light') toggleTheme();
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border-2 transition-all outline-none font-bold text-xs ${
                          theme === 'light'
                            ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Sun className={`w-3.5 h-3.5 ${theme === 'light' ? 'stroke-[2.5px]' : ''}`} />
                        <span>{t('النهاري')}</span>
                      </button>

                      {/* الليلى (Dark Mode) Button */}
                      <button 
                        type="button"
                        onClick={() => {
                          if (theme !== 'dark') toggleTheme();
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border-2 transition-all outline-none font-bold text-xs ${
                          theme === 'dark'
                            ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.02]'
                            : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <Moon className={`w-3.5 h-3.5 ${theme === 'dark' ? 'stroke-[2.5px]' : ''}`} />
                        <span>{t('الليلي')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2 space-y-1 border-t border-slate-100 dark:border-slate-800/60">
                    <button 
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 ${adminLang === 'en' ? 'text-left' : 'text-right'} hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-2xl transition-colors group`}
                    >
                      <Trash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      <span className="font-bold text-sm">{t('حذف الجراج')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6">
        {/* Garage Header Card - MOVED TO TOP */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 pr-8 relative mb-6 overflow-hidden transition-colors">
            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-slate-900 dark:bg-amber-400" />
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 dark:bg-slate-800 text-white dark:text-amber-400 rounded-xl flex items-center justify-center transition-colors">
                    <Car className="w-6 h-6" />
                </div>
                <div className="text-right">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{selectedGarageForDetails.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5">
                        <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">{selectedGarageForDetails.phone}</span>
                        </div>
                        {isEditingGaragePin ? (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-400/5 border border-amber-200 dark:border-amber-400/20 rounded-lg transition-colors">
                                <span className="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase">{t('الرمز:')}</span>
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    value={garagePinInput}
                                    maxLength={6}
                                    onChange={(e) => setGaragePinInput(e.target.value.replace(/\D/g, ''))}
                                    className="w-12 text-[10px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-amber-600 dark:text-amber-400 rounded px-1 text-center font-black focus:outline-none focus:ring-0"
                                    placeholder="••••"
                                    autoFocus
                                />
                                <button
                                    onClick={async () => {
                                        if (garagePinInput.length < 4) {
                                            showToast(adminLang === 'en' ? 'Access PIN must be at least 4 digits' : 'رمز الدخول يجب أن يكون 4 أرقام على الأقل', 'error');
                                            return;
                                        }
                                        setIsUpdatingGaragePin(true);
                                        try {
                                            await firestoreService.updateGarage(selectedGarageForDetails.id, { pin: garagePinInput });
                                            selectedGarageForDetails.pin = garagePinInput;
                                            setIsEditingGaragePin(false);
                                            showToast(t('تم تحديث الرمز بنجاح'));
                                        } catch (err) {
                                            showToast(t('فشل تحديث الرمز'), 'error');
                                        } finally {
                                            setIsUpdatingGaragePin(false);
                                        }
                                    }}
                                    disabled={isUpdatingGaragePin}
                                    className="w-4 h-4 bg-amber-500 text-slate-950 hover:bg-amber-600 rounded flex items-center justify-center cursor-pointer"
                                    title={t('حفظ')}
                                >
                                    {isUpdatingGaragePin ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </button>
                                <button
                                    onClick={() => {
                                        setGaragePinInput(selectedGarageForDetails.pin || '');
                                        setIsEditingGaragePin(false);
                                    }}
                                    className="text-[8px] font-black text-slate-400 dark:text-slate-500 hover:underline px-0.5 animate-in fade-in cursor-pointer"
                                >
                                    {t('إلغاء')}
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 dark:bg-amber-400/5 border border-amber-200 dark:border-amber-400/20 rounded-lg transition-colors">
                                <span className="text-[8px] font-black text-amber-600 dark:text-amber-500 uppercase">{t('الرمز:')}</span>
                                <span className="text-[10px] font-black text-amber-600 dark:text-amber-500 font-mono tracking-widest">{selectedGarageForDetails.pin || t('لا يوجد')}</span>
                                <button
                                    onClick={() => {
                                        setIsEditingGaragePin(true);
                                        setGaragePinInput(selectedGarageForDetails.pin || '');
                                    }}
                                    className="text-[8px] text-amber-500 font-bold hover:underline cursor-pointer"
                                >
                                    {t('تعديل')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-end transition-colors">
                <span className="text-[8px] font-black text-slate-300 dark:text-slate-700 uppercase tracking-widest leading-none">GARAGE ID: {selectedGarageForDetails.id}</span>
            </div>
        </div>

        {/* Performance Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center transition-colors">
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{t('اليوم')}</p>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono leading-none">{dailyCount}</div>
            <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-1">{Number(dailyRevenue).toFixed(0)} {adminLang === 'en' ? 'EGP' : 'ج.م'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center transition-colors">
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{t('تراكمي')}</p>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono leading-none">{totalCount}</div>
            <p className="text-[9px] font-bold text-amber-500 dark:text-amber-400 font-mono mt-1">{Number(totalRevenue).toFixed(0)} {adminLang === 'en' ? 'EGP' : 'ج.م'}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center transition-colors">
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{t('إجمالي الوحدات')}</p>
            <div className="text-xl font-bold text-slate-900 dark:text-white font-mono leading-none">{selectedGarageForDetails.totalRechargedCars || 0}</div>
            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 uppercase mt-1 transition-colors">{t('وحدة')}</p>
          </div>
          <div className={`p-4 rounded-xl border transition-colors flex flex-col items-center text-center ${
            (selectedGarageForDetails.lastRefundDate === new Date().toISOString().split('T')[0] ? selectedGarageForDetails.dailyRefundCount || 0 : 0) >= 5 
            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}>
            <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 text-center">{t('المرتجع')}</p>
            <div className={`text-xl font-bold font-mono leading-none ${
                (selectedGarageForDetails.lastRefundDate === new Date().toISOString().split('T')[0] ? selectedGarageForDetails.dailyRefundCount || 0 : 0) >= 5 
                ? 'text-red-500 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}>
              {selectedGarageForDetails.lastRefundDate === new Date().toISOString().split('T')[0] ? selectedGarageForDetails.dailyRefundCount || 0 : 0}
            </div>
            <p className="text-[9px] font-bold text-slate-300 dark:text-slate-600 mt-1 uppercase">{t('/ 5 حد يومي')}</p>
          </div>
        </div>

        {/* Price Config Row - MOVED HERE */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 transition-colors">
          <h4 className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Settings className="w-3 h-3" />
            {t('الإعدادات والتعريفة')}
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase text-center">{t('ساعة')}</label>
              <input 
                type="text" inputMode="numeric"
                value={hourlyRateInput}
                onChange={(e) => setHourlyRateInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:border-amber-400 dark:focus:border-amber-400 focus:ring-0 text-center transition-all outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase text-center">{t('مبيت')}</label>
              <input 
                type="text" inputMode="numeric"
                value={overnightRateInput}
                onChange={(e) => setOvernightRateInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:border-amber-400 dark:focus:border-amber-400 focus:ring-0 text-center transition-all outline-none"
              />
            </div>
          </div>

          <div className="mt-4">
            <button 
              type="button"
              disabled={!hasRateChanges || isSavingRates}
              onClick={handleSaveRates}
              className={`w-full py-3.5 text-center rounded-2xl font-black text-xs md:text-sm flex items-center justify-center gap-2 transition-all duration-300 outline-none ${
                hasRateChanges 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-lg shadow-amber-500/10 active:scale-95 cursor-pointer' 
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 cursor-not-allowed select-none'
              }`}
            >
              {isSavingRates ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('جاري حفظ التعديل...')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t('تأكيد تعديل التعريفة')}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Monthly Gift Config */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 transition-colors">
          <h4 className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-500" />
            {t('هدايا الرصيد الشهرية')}
          </h4>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t('عدد السيارات المجانية كل شهر')}</label>
              <input 
                type="text" inputMode="numeric"
                value={monthlyGiftInput}
                onChange={(e) => setMonthlyGiftInput(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-4 py-3 text-lg font-black text-amber-600 dark:text-amber-400 focus:border-amber-400 dark:focus:border-amber-400 focus:ring-0 text-center transition-all outline-none"
                placeholder={t('مثال: 100')}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase text-center">{t('تفعيل الهدية')}</label>
              <button 
                onClick={() => {
                  const newState = !selectedGarageForDetails.isMonthlyGiftEnabled;
                  firestoreService.updateGarage(selectedGarageForDetails.id, { isMonthlyGiftEnabled: newState });
                  showToast(newState ? t('تم تفعيل الهدية الشهرية') : t('تم إيقاف الهدية الشهرية'));
                }}
                className={`w-16 h-8 rounded-full p-1 transition-all duration-300 relative ${
                  selectedGarageForDetails.isMonthlyGiftEnabled 
                    ? 'bg-amber-500' 
                    : 'bg-slate-200 dark:bg-slate-800'
                }`}
              >
                <div className={`w-6 h-6 bg-white rounded-full transition-all duration-300 transform ${
                  selectedGarageForDetails.isMonthlyGiftEnabled ? '-translate-x-8' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>

          <div className="mt-4">
            <button 
              type="button"
              disabled={!hasGiftChanges || isSavingGift}
              onClick={handleSaveGift}
              className={`w-full py-3 text-center rounded-xl font-black text-[11px] flex items-center justify-center gap-2 transition-all duration-300 outline-none ${
                hasGiftChanges 
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 shadow-lg shadow-amber-500/10 active:scale-95 cursor-pointer' 
                  : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 cursor-not-allowed select-none'
              }`}
            >
              {isSavingGift ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('جاري حفظ الهدية...')}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('تأكيد تعديل عدد هدايا الرصيد')}</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-4 flex justify-between items-center text-[8px] font-bold">
            <p className="text-slate-400 dark:text-slate-600">
              {t('* سيتم زيادة رصيد الجراج تلقائياً بهذا العدد من السيارات في أول يوم من كل شهر.')}
            </p>
            <span className={`px-2 py-0.5 rounded-full ${
              selectedGarageForDetails.lastGiftMonth === new Date().toISOString().slice(0, 7)
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
            }`}>
              {selectedGarageForDetails.lastGiftMonth === new Date().toISOString().slice(0, 7) ? t('تم إرسال هدية هذا الشهر ✓') : t('في انتظار أول الشهر')}
            </span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar - Stats & Settings */}
          <div className="w-full lg:w-[320px] space-y-6 shrink-0 order-2 lg:order-1">
            {/* Staff Management - Compact */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between transition-colors">
                    <div className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                        <h4 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase">{t('الموظفين')}</h4>
                    </div>
                    <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500">{staffList.length} {t('عضو')}</span>
                </div>
                <div className="p-4 space-y-3">
                    <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1 custom-scrollbar-slate">
                        {staffList.map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 group transition-all">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 bg-white dark:bg-slate-900 rounded-lg flex items-center justify-center text-xs font-black text-amber-500 border border-slate-100 dark:border-slate-800 transition-colors">
                                        {s.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-black text-slate-800 dark:text-slate-100">{s.name}</p>
                                        {editingStaffPinId === s.id ? (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <input
                                                    type="tel"
                                                    inputMode="numeric"
                                                    value={editingStaffPinValue}
                                                    maxLength={6}
                                                    onChange={(e) => setEditingStaffPinValue(e.target.value.replace(/\D/g, ''))}
                                                    className="w-12 text-[10px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-blue-600 dark:text-blue-400 rounded px-1 text-center font-black focus:outline-none"
                                                    placeholder="••••"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={async () => {
                                                        if (editingStaffPinValue.length < 4) {
                                                            showToast(adminLang === 'en' ? 'Access PIN must be at least 4 digits' : 'رمز الدخول يجب أن يكون 4 أرقام على الأقل', 'error');
                                                            return;
                                                        }
                                                        setIsUpdatingStaffPin(true);
                                                        try {
                                                            await firestoreService.updateStaff(s.id, { pin: editingStaffPinValue });
                                                            s.pin = editingStaffPinValue;
                                                            setEditingStaffPinId(null);
                                                            showToast(t('تم تحديث الرمز بنجاح'));
                                                        } catch (err) {
                                                            showToast(t('فشل تحديث الرمز'), 'error');
                                                        } finally {
                                                            setIsUpdatingStaffPin(false);
                                                        }
                                                    }}
                                                    disabled={isUpdatingStaffPin}
                                                    className="w-4 h-4 bg-emerald-500 hover:bg-emerald-600 rounded flex items-center justify-center text-white"
                                                >
                                                    {isUpdatingStaffPin ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                                </button>
                                                <button
                                                    onClick={() => setEditingStaffPinId(null)}
                                                    className="text-[8px] font-black text-slate-400 dark:text-slate-500 hover:underline cursor-pointer"
                                                >
                                                    {t('إلغاء')}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{t('الرمز:')}</span>
                                                <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-black font-mono tracking-widest border border-blue-100 dark:border-blue-900/30 transition-colors mr-0.5">
                                                    {s.pin}
                                                </span>
                                                <button 
                                                    onClick={() => {
                                                        setEditingStaffPinId(s.id);
                                                        setEditingStaffPinValue(s.pin || '');
                                                    }}
                                                    className="text-[8px] text-amber-500 font-bold hover:underline cursor-pointer"
                                                >
                                                    {t('تعديل')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button onClick={() => setStaffToDelete(s)} className="w-7 h-7 bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-700 transition-all outline-none cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        {staffList.length === 0 && <div className="text-center py-4 text-[10px] text-slate-300 dark:text-slate-700 font-bold">{t('لا يوجد موظفين')}</div>}
                    </div>
                    <button 
                        onClick={openAddStaffModal}
                        className="w-full py-2.5 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 rounded-xl font-black text-[10px] hover:bg-slate-800 dark:hover:bg-amber-500 flex items-center justify-center gap-2 mt-2 transition-all outline-none cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        {t('إضافة موظف')}
                    </button>
                </div>
            </div>
          </div>

          {/* Main Content - Financials */}
          <div className="flex-1 space-y-6 order-1 lg:order-2">
            {/* Main Wallet Card */}
            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl overflow-visible relative transition-colors border border-slate-800 dark:border-amber-400/20">
              <div className="relative z-10 p-10 flex flex-col md:flex-row justify-between items-center gap-12">
                <div className="text-center md:text-right">
                  <p className="text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-[0.5em] mb-4">
                    {selectedGarageForDetails.billingModel === 'subscription' ? t('الاشتراك المتبقي للجراج') : t('رصيد التشغيل الحالي')}
                  </p>
                  <div className="flex items-end gap-3 justify-center md:justify-start">
                    {selectedGarageForDetails.billingModel === 'subscription' ? (
                      <>
                        <span className={`text-8xl font-black tracking-tighter transition-colors ${ (() => {
                          const expiry = selectedGarageForDetails.balanceExpiry;
                          const expiryDate = expiry?.toDate ? expiry.toDate() : new Date(expiry || '');
                          return expiryDate < new Date() ? 'text-red-400' : 'text-white';
                        })()}`}>
                          {(() => {
                            const expiry = selectedGarageForDetails.balanceExpiry;
                            if (!expiry) return 0;
                            const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
                            const diff = expiryDate.getTime() - Date.now();
                            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                          })()}
                        </span>
                        <span className="text-2xl text-slate-500 dark:text-slate-400 font-bold mb-4 transition-colors">{t('يوم')}</span>
                      </>
                    ) : (
                      <>
                        <span className={`text-8xl font-black tracking-tighter transition-colors ${ (selectedGarageForDetails.balance || 0) <= 0 ? 'text-red-400' : 'text-white'}`}>
                          {Math.floor((selectedGarageForDetails.balance || 0) / (selectedGarageForDetails.commissionPerVehicle || 1))}
                        </span>
                        <span className="text-2xl text-slate-500 dark:text-slate-400 font-bold mb-4 transition-colors">{t('وحدة')}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-center md:justify-start">
                    <div className="px-4 py-1.5 bg-white/5 rounded-full border border-white/5 transition-colors">
                      <span className="text-[11px] font-black text-slate-400 dark:text-slate-500 tracking-wider">
                        {selectedGarageForDetails.billingModel === 'subscription' ? (
                          <>
                            {t('تاريخ انتهاء الاشتراك:')} {(() => {
                              const expiry = selectedGarageForDetails.balanceExpiry;
                              if (!expiry) return '-';
                              const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry);
                              return expiryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                            })()}
                          </>
                        ) : (
                          <>{t('الرصيد المالي:')} {Number(selectedGarageForDetails.balance || 0).toFixed(2)} {adminLang === 'en' ? 'EGP' : 'ج.م'}</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto shrink-0">
                  <button 
                    onClick={() => firestoreService.updateGarage(selectedGarageForDetails.id, { isLocked: !selectedGarageForDetails.isLocked })}
                    className={`px-10 py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-4 transition-all outline-none cursor-pointer ${
                      selectedGarageForDetails.isLocked 
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                      : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white">
                      <Shield className="w-6 h-6 stroke-[3]" />
                    </div>
                    {selectedGarageForDetails.isLocked ? t('تفعيل الجراج الآن') : t('إيقاف الخدمة فوراً')}
                  </button>
                  
                  {!showClearBalanceConfirm ? (
                    <button 
                      onClick={() => setShowClearBalanceConfirm(true)}
                      className="py-4 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-xs hover:text-white dark:hover:text-white bg-white/5 dark:bg-white/5 border border-white/5 dark:border-slate-800 transition-all outline-none cursor-pointer"
                    >
                      {t('تصفير المحفظة')}
                    </button>
                  ) : (
                    <div className="flex gap-2 p-1 bg-white/5 dark:bg-slate-900/50 rounded-2xl border border-white/10 dark:border-slate-800 transition-colors shrink-0">
                      <button 
                        onClick={async () => {
                          setIsLoading(true);
                          try { await firestoreService.updateGarage(selectedGarageForDetails.id, { balance: 0, isLocked: true }); showToast(t('تم التصفير')); setShowClearBalanceConfirm(false); } 
                          catch (error) { showToast(t('فشل'), 'error'); } finally { setIsLoading(false); }
                        }}
                        className="flex-1 py-3 bg-red-500 text-white rounded-xl font-black text-xs hover:bg-red-600 transition-all outline-none cursor-pointer"
                      >
                        {t('تأكيد')}
                      </button>
                      <button onClick={() => setShowClearBalanceConfirm(false)} className="px-6 py-3 text-slate-400 dark:text-slate-500 font-bold text-xs hover:text-white transition-colors outline-none cursor-pointer">{t('إلغاء')}</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Recharge & Custom Plans */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 p-8 sm:p-10 space-y-10 transition-colors">
                <div className="w-full">
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-black text-slate-900 dark:text-white text-lg">{t('باقات الشحن')}</h3>
                            <span className="text-[9px] font-bold text-slate-300 dark:text-slate-700 uppercase tracking-widest shrink-0 mr-4">{t('شحن تلقائي فوري')}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {(() => {
                                const isSubscriptionGarage = selectedGarageForDetails.billingModel === 'subscription';
                                const subPackages: Package[] = [
                                    { id: 'weekly_sub', name: adminLang === 'en' ? 'Weekly Subscription' : 'تجديد اشتراك أسبوعي', price: 800, vehiclesCount: 7 },
                                    { id: 'monthly_sub', name: adminLang === 'en' ? 'Monthly Subscription' : 'تجديد اشتراك شهري', price: 3000, vehiclesCount: 30 }
                                ];
                                const displayPackages = isSubscriptionGarage ? subPackages : (packages.length > 0 ? packages : []);
                                
                                return displayPackages.map((pkg) => {
                                    const isPremium = pkg.price >= 4000;
                                    const isMid = pkg.price >= 1500 && pkg.price < 4000;
                                    
                                    return (
                                        <button
                                            key={pkg.id}
                                            onClick={() => setPendingPackage(pkg)}
                                            className={`group relative rounded-2xl border-2 flex flex-col items-center overflow-hidden transition-all outline-none cursor-pointer ${
                                                isPremium 
                                                ? 'bg-slate-900 dark:bg-slate-950 border-slate-900 dark:border-slate-800 text-white' 
                                                : isMid 
                                                ? 'bg-amber-50 dark:bg-amber-400/5 border-amber-400 dark:border-amber-400/30 text-slate-900 dark:text-amber-400' 
                                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-900 dark:text-slate-100'
                                            }`}
                                        >
                                            <div className="w-full bg-slate-950 dark:bg-slate-900 py-2 px-3 flex items-center justify-center border-b border-white/5 dark:border-slate-800 transition-colors">
                                              <span className="text-[10px] font-black text-white dark:text-slate-400 uppercase tracking-[0.15em]">
                                                {pkg.name || t('باقة شحن')}
                                              </span>
                                            </div>
                                            
                                            <div className="flex flex-col items-center py-5 px-4 w-full">
                                                <span className="text-5xl font-black font-mono tracking-tighter leading-none">
                                                  {pkg.vehiclesCount}
                                                </span>
                                                <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 transition-colors ${isPremium || (document.documentElement.classList.contains('dark')) ? 'text-slate-400 dark:text-slate-500' : 'text-slate-500'}`}>
                                                  {isSubscriptionGarage ? t('يوم') : t('وحدة رصيد')}
                                                </span>
      
                                                <div className="mt-5 w-full py-2.5 rounded-xl text-sm font-black font-mono bg-amber-400 text-slate-900 transition-transform group-hover:scale-105">
                                                    {pkg.price} {adminLang === 'en' ? 'EGP' : 'ج.م'}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                });
                            })()}
                            {packages.length === 0 && (
                                <div className="col-span-full py-12 bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl text-center transition-colors">
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-600">{t('لا يوجد باقات حالية متوفرة')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
 
      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm transition-all" dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="p-6">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('إضافة موظف جديد')}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mb-6">{t('أدخل اسم الموظف وسيتم استخدام الرمز الظاهر لتسجيل الدخول.')}</p>
                    
                    <form 
                        onSubmit={async (e) => {
                            e.preventDefault();
                            if (!staffForm.name || !staffForm.pin) return;
                            setIsLoading(true);
                            try {
                                await firestoreService.addStaff({ 
                                    name: staffForm.name, 
                                    pin: staffForm.pin, 
                                    garageId: selectedGarageForDetails.id, 
                                    role: 'staff' 
                                });
                                setShowAddStaffModal(false);
                                showToast(t('تمت إضافة الموظف بنجاح'));
                            } catch (e) { 
                                showToast(t('فشل في الإضافة'), 'error'); 
                            } finally { 
                                setIsLoading(false); 
                            }
                        }}
                        className="space-y-4"
                    >
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1">{t('اسم الموظف')}</label>
                            <input 
                                placeholder={t('مثال: أحمد محمد')} 
                                value={staffForm.name}
                                autoFocus
                                onChange={e => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-lg font-black text-slate-900 dark:text-white outline-none focus:border-amber-400 dark:focus:border-amber-400 focus:bg-white dark:focus:bg-slate-900 text-center transition-all" 
                            />
                        </div>
 
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mr-1">{t('الرمز السري (PIN)')}</label>
                            <div className="w-full p-5 bg-slate-900 dark:bg-slate-950 rounded-2xl text-center border border-white/5 dark:border-slate-800 transition-colors">
                                <span className="text-4xl font-black text-white dark:text-amber-400 tracking-[0.25em] font-mono leading-none">{staffForm.pin}</span>
                            </div>
                        </div>
 
                        <div className="flex gap-3 pt-4">
                            <button 
                                type="submit" 
                                disabled={isLoading || !staffForm.name} 
                                className="flex-1 py-4 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 rounded-2xl font-black text-sm hover:bg-slate-800 dark:hover:bg-amber-500 disabled:opacity-50 transition-all outline-none cursor-pointer"
                            >
                                {t('تأكيد الإضافة')}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => setShowAddStaffModal(false)}
                                className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all outline-none cursor-pointer"
                            >
                                {t('إلغاء')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
      )}
 
      {/* Package Confirmation Overlay */}
      {pendingPackage && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm" dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 w-full max-w-sm border-2 border-amber-400 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-amber-50 dark:bg-amber-400/10 rounded-full flex items-center justify-center mx-auto mb-3 transition-colors">
                <CheckCircle2 className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {selectedGarageForDetails.billingModel === 'subscription' ? t('تأكيد تجديد الاشتراك؟') : t('تأكيد شحن الباقة؟')}
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {selectedGarageForDetails.billingModel === 'subscription' 
                  ? `${t('أنت على وشك تجديد الاشتراك لمدة')} ${pendingPackage.vehiclesCount} ${t('يوم للجراج')}`
                  : `${t('أنت على وشك شحن')} ${pendingPackage.vehiclesCount} ${t('وحدة للجراج')}`}
              </p>
            </div>
 
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-6 flex justify-between items-center transition-colors">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('السعر المطلوب')}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white">{pendingPackage.price} {adminLang === 'en' ? 'EGP' : 'ج.م'}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {selectedGarageForDetails.billingModel === 'subscription' ? t('المدة') : t('عدد العربات')}
                </p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  {pendingPackage.vehiclesCount} {selectedGarageForDetails.billingModel === 'subscription' ? t('يوم') : t('وحدة')}
                </p>
              </div>
            </div>
 
            <div className="flex gap-3">
              <button
                disabled={isLoading}
                onClick={() => handleRechargeSubmit(pendingPackage)}
                className="flex-1 bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 py-4 rounded-xl font-black text-base hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 outline-none cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{selectedGarageForDetails.billingModel === 'subscription' ? t('تأكيد التجديد') : t('تأكيد الشحن')}</span>}
              </button>
              <button
                disabled={isLoading}
                onClick={() => setPendingPackage(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 py-4 rounded-xl font-black text-base hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50 outline-none cursor-pointer"
              >
                {t('إلغاء')}
              </button>
            </div>
          </div>
        </div>
      )}
 
      {/* Staff Delete Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm" dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
            <div className="bg-white dark:bg-slate-900 rounded-xl w-full max-sm:max-w-[calc(100vw-32px)] max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors">
                        <Trash2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('حذف الموظف؟')}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mb-6">
                        {t('هل أنت متأكد من حذف الموظف')} <span className="text-slate-900 dark:text-slate-100">"{staffToDelete.name}"</span>؟ {t('لن يتمكن من تسجيل الدخول مرة أخرى بهذا الرمز.')}
                    </p>
                    
                    <div className="flex gap-3">
                        <button 
                            onClick={async () => {
                                setIsLoading(true);
                                try {
                                    await firestoreService.removeStaff(staffToDelete.id);
                                    setStaffToDelete(null);
                                    showToast(t('تم حذف الموظف'));
                                } catch (e) { 
                                    showToast(t('فشل في الحذف'), 'error'); 
                                } finally { 
                                    setIsLoading(false); 
                                }
                            }}
                            disabled={isLoading}
                            className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black text-sm hover:bg-red-700 disabled:opacity-50 transition-all outline-none cursor-pointer"
                        >
                            {t('تأكيد الحذف')}
                        </button>
                        <button 
                            onClick={() => setStaffToDelete(null)}
                            className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-all outline-none cursor-pointer"
                        >
                            {t('إلغاء')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
});
