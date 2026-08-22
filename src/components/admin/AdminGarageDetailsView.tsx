/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, memo, useRef, useEffect } from 'react';
import { 
  Shield,
  ChevronRight, 
  CheckCircle2,
  Trash2, 
  Settings, 
  Users, 
  Car, 
  Plus, 
  Phone, 
  Loader2, 
  Sun, 
  Moon, 
  MoreVertical, 
  Check, 
  Gift, 
  RotateCcw,
  ChevronDown,
  Key,
  Calendar,
  Lock,
  Unlock,
  Sparkles,
  Filter
} from 'lucide-react';
import { firestoreServiceV2 as firestoreService } from '../../services/domain/firestoreServiceV2';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
import { normalizeDigits, safeDate, getRemainingDays, calculateFinalPrice } from '../../utils';
import { Garage, Staff, Package } from '../../types';
import { getCleanPackageInfo } from '../../constants/packages';
import { useTheme } from '../../utils/ThemeContext';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import { useAdminTranslation } from '../../utils/adminTranslations';

interface AdminGarageDetailsViewProps {
  selectedGarageForDetails: Garage;
  setView: (view: any) => void;
  setSelectedGarageForDetails: (garage: Garage | null) => void;
  setShowDeleteConfirm: (show: boolean) => void;
  updateGarageRate: (garage: Garage, field: keyof Garage, value: number) => Promise<void>;
  staffList: Staff[];
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  packages: Package[];
  subscriptionPrices?: { weekly: number; biweekly?: number; monthly: number; weeklyDiscount?: number; biweeklyDiscount?: number; monthlyDiscount?: number };
  allGarages?: Garage[];
}

export const AdminGarageDetailsView = memo(({
  selectedGarageForDetails,
  setView,
  setSelectedGarageForDetails,
  setShowDeleteConfirm,
  updateGarageRate: _updateGarageRate,
  staffList,
  isLoading,
  setIsLoading,
  packages,
  subscriptionPrices: _subscriptionPrices = { weekly: 800, biweekly: 1500, monthly: 3000 },
  allGarages = []
}: AdminGarageDetailsViewProps) => {
  const [showClearBalanceConfirm, setShowClearBalanceConfirm] = useState(false);
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [staffForm, setStaffForm] = useState({ name: '', pin: '' });
  const [pendingPackage, setPendingPackage] = useState<Package | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const { theme, toggleTheme, adminLang } = useTheme();
  const t = useAdminTranslation(adminLang);

  // Accordion state for Zone 3
  const [isZone3Open, setIsZone3Open] = useState(false);

  const [isEditingGaragePin, setIsEditingGaragePin] = useState(false);
  const [garagePinInput, setGaragePinInput] = useState(selectedGarageForDetails.pin || '');
  const [isUpdatingGaragePin, setIsUpdatingGaragePin] = useState(false);

  const [editingStaffPinId, setEditingStaffPinId] = useState<string | null>(null);
  const [editingStaffPinValue, setEditingStaffPinValue] = useState<string>('');
  const [isUpdatingStaffPin, setIsUpdatingStaffPin] = useState(false);

  const [hourlyRateInput, setHourlyRateInput] = useState<string>(String(selectedGarageForDetails.hourlyRate || 0));
  const [overnightRateInput, setOvernightRateInput] = useState<string>(String(selectedGarageForDetails.overnightRate || 0));
  const [isSavingRates, setIsSavingRates] = useState(false);
  const [selectedDurationFilter, setSelectedDurationFilter] = useState<number>(15);
  const config = useSystemConfig();
  const subscriberFlatFee = Number(config?.monthlySubscribersFlatFee) || 500;

  useEffect(() => {
    setHourlyRateInput(String(selectedGarageForDetails.hourlyRate || 0));
    setOvernightRateInput(String(selectedGarageForDetails.overnightRate || 0));
  }, [selectedGarageForDetails.id, selectedGarageForDetails.hourlyRate, selectedGarageForDetails.overnightRate]);

  useEffect(() => {
    setGaragePinInput(selectedGarageForDetails.pin || '');
  }, [selectedGarageForDetails.id, selectedGarageForDetails.pin]);

  const hasRateChanges = 
    hourlyRateInput !== String(selectedGarageForDetails.hourlyRate || 0) ||
    overnightRateInput !== String(selectedGarageForDetails.overnightRate || 0);

  const handleSaveRates = async () => {
    const hourly = Number(normalizeDigits(hourlyRateInput));
    const overnight = Number(normalizeDigits(overnightRateInput));

    if (isNaN(hourly) || isNaN(overnight)) {
      return;
    }

    setIsSavingRates(true);
    try {
      await firestoreService.updateGarage(selectedGarageForDetails.id, {
        hourlyRate: hourly,
        overnightRate: overnight,
      });
      selectedGarageForDetails.hourlyRate = hourly;
      selectedGarageForDetails.overnightRate = overnight;
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingRates(false);
    }
  };

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
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
      const cleanPkg = getCleanPackageInfo(pkg);
      const updateData: any = {
        totalAdminRevenue: Number(((selectedGarageForDetails.totalAdminRevenue || 0) + pkg.price).toFixed(2)),
        isLocked: false,
        isTrial: false,
        dailyCapacity: cleanPkg.isUnlimited ? 0 : (cleanPkg.dailyCapacity || 40),
        activePackageName: pkg.name,
        packageName: pkg.name,
        lastRechargeDate: serverTimestamp()
      };

      let baseDate = new Date();
      const currentExpiry = selectedGarageForDetails.balanceExpiry;
      if (currentExpiry) {
        const currentExpiryDate = safeDate(currentExpiry);
        if (currentExpiryDate > baseDate) {
          baseDate = currentExpiryDate;
        }
      }
      let days = cleanPkg.durationDays || 30;

      baseDate.setDate(baseDate.getDate() + days);
      
      updateData.balanceExpiry = Timestamp.fromDate(baseDate);
      updateData.billingModel = 'subscription';

      await firestoreService.updateGarage(selectedGarageForDetails.id, updateData);

      try {
        await firestoreService.processReferralRewardForRecharge(selectedGarageForDetails.id);
      } catch (err) {
        console.error('Error processing referral reward on manual recharge:', err);
      }

      await firestoreService.addActivityLog({
        garageId: selectedGarageForDetails.id,
        garageName: selectedGarageForDetails.name,
        staffId: 'admin',
        staffName: t('مدير النظام (Admin)'),
        actionType: 'recharge',
        plateNumber: adminLang === 'en' ? `Recharge Subscription: ${pkg.name} (${pkg.vehiclesCount} Days) - ${pkg.price} EGP` : `تجديد اشتراك: ${pkg.name} (${pkg.vehiclesCount} يوم) - ${pkg.price} ج`,
        timestamp: serverTimestamp() as any,
        amount: pkg.price,
        packageId: pkg.id
      });
      setPendingPackage(null);
    } catch (e) { 
      console.error(e);
    } finally { 
      setIsLoading(false); 
    }
  };

  const handleResetTodayCounters = async () => {
    if (!window.confirm(adminLang === 'en' ? 'Are you sure you want to reset today counters (revenue & cars)?' : 'هل أنت متأكد من تصفير عداد وإيراد اليوم لهذا الجراج؟')) return;
    setIsLoading(true);
    try {
      await firestoreService.updateGarage(selectedGarageForDetails.id, {
        todayRevenue: 0,
        todayCount: 0
      });
      setSelectedGarageForDetails({
        ...selectedGarageForDetails,
        todayRevenue: 0,
        todayCount: 0
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (showAddStaffModal || staffToDelete) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showAddStaffModal, staffToDelete]);

  const today = new Date().toISOString().split('T')[0];
  const isTodayValid = selectedGarageForDetails.lastTransactionDate === today;
  
  const dailyCount = isTodayValid ? (selectedGarageForDetails.todayCount || 0) : 0;
  const dailyRevenue = isTodayValid ? (selectedGarageForDetails.todayRevenue || 0) : 0;
  
  const totalCount = selectedGarageForDetails.totalVehiclesOut || 0;
  const totalRevenue = selectedGarageForDetails.totalRevenue || 0;
  const remainingDays = getRemainingDays(selectedGarageForDetails);

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
    <div 
      className={`h-screen bg-[#faf9f6] dark:bg-slate-950 font-sans pb-32 custom-scrollbar-slate text-slate-900 dark:text-slate-100 transition-colors ${adminLang === 'en' ? 'text-left' : 'text-right'} ${showAddStaffModal || staffToDelete ? 'overflow-hidden' : 'overflow-y-auto'}`} 
      dir={adminLang === 'en' ? 'ltr' : 'rtl'}
    >
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 mb-8 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center h-full">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setView('admin_dashboard');
                setSelectedGarageForDetails(null);
                setShowDeleteConfirm(false);
              }}
              className="flex items-center justify-center w-10 h-10 bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 rounded-xl hover:bg-slate-800 dark:hover:bg-amber-500 outline-none cursor-pointer transition-colors shadow-sm shrink-0"
              title={t('رجوع')}
            >
              <ChevronRight className={`w-5.5 h-5.5 text-amber-400 dark:text-slate-950 stroke-[3.5] ${adminLang === 'en' ? 'rotate-180' : ''}`} />
            </button>
            <div>
              <h1 className="text-base font-black text-slate-900 dark:text-white leading-tight">{selectedGarageForDetails.name}</h1>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                {t('تفاصيل وإدارة الجراج')} • <span className="font-mono text-[10px]">ID: {selectedGarageForDetails.id}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 relative" ref={menuRef}>
            <button 
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all outline-none border ${showMenu ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'}`}
            >
              <MoreVertical className="w-5 h-5 text-slate-600 dark:text-slate-400 stroke-[2.5]" />
            </button>

            {showMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40 bg-slate-900/10 dark:bg-black/35" 
                  onClick={() => setShowMenu(false)}
                />
                
                <div className={`absolute top-12 ${adminLang === 'en' ? 'right-0' : 'left-0'} w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl z-50 overflow-hidden shadow-xl`}>
                  <div className="p-4 flex flex-col gap-3">
                    <span className="font-black text-xs text-slate-400 dark:text-slate-500 select-none">{t('وضع الشاشة:')}</span>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => {
                          if (theme !== 'light') toggleTheme();
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border transition-all font-bold text-xs ${
                          theme === 'light'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>{t('النهاري')}</span>
                      </button>

                      <button 
                        type="button"
                        onClick={() => {
                          if (theme !== 'dark') toggleTheme();
                          setShowMenu(false);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border transition-all font-bold text-xs ${
                          theme === 'dark'
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>{t('الليلي')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2 space-y-1 border-t border-slate-100 dark:border-slate-800">
                    <button 
                      onClick={() => {
                        setShowMenu(false);
                        handleResetTodayCounters();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-xl transition-colors text-xs font-bold"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>{t('تصفير عدادات اليوم')}</span>
                    </button>
                    <button 
                      onClick={() => {
                        setShowDeleteConfirm(true);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 rounded-xl transition-colors text-xs font-bold"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{t('حذف الجراج')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 space-y-8">
        
        {/* ================= ZONE 1: STATUS & KEY PERFORMANCE STATS ================= */}
        <section className="space-y-4">
          {/* Garage Hero Identity Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 relative overflow-hidden shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
                  selectedGarageForDetails.isLocked 
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60' 
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                }`}>
                  <Car className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                      {selectedGarageForDetails.name}
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      selectedGarageForDetails.isLocked
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                    }`}>
                      {selectedGarageForDetails.isLocked ? t('معطل') : t('نشط')}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold">
                    {selectedGarageForDetails.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-slate-700 dark:text-slate-300">{selectedGarageForDetails.phone}</span>
                      </div>
                    )}
                    
                    {/* Owner PIN quick view / edit */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <Key className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-[10px] text-slate-500">{t('رمز المالك:')}</span>
                      {isEditingGaragePin ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={garagePinInput}
                            maxLength={6}
                            onChange={(e) => setGaragePinInput(e.target.value.replace(/\D/g, ''))}
                            className="w-14 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded px-1 text-center font-mono font-black"
                            placeholder="••••"
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              if (garagePinInput.length < 4) return;
                              setIsUpdatingGaragePin(true);
                              try {
                                const pinCheck = await firestoreService.isPinTaken(garagePinInput, selectedGarageForDetails.id);
                                if (pinCheck.taken) {
                                  setIsUpdatingGaragePin(false);
                                  return;
                                }
                                await firestoreService.updateGarage(selectedGarageForDetails.id, { pin: garagePinInput, ownerPin: garagePinInput });
                                selectedGarageForDetails.pin = garagePinInput;
                                selectedGarageForDetails.ownerPin = garagePinInput;
                                setIsEditingGaragePin(false);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsUpdatingGaragePin(false);
                              }
                            }}
                            disabled={isUpdatingGaragePin}
                            className="w-5 h-5 bg-emerald-600 text-white rounded flex items-center justify-center"
                          >
                            {isUpdatingGaragePin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <button
                            onClick={() => {
                              setGaragePinInput(selectedGarageForDetails.pin || '');
                              setIsEditingGaragePin(false);
                            }}
                            className="text-[10px] text-slate-400 hover:underline px-0.5"
                          >
                            {t('إلغاء')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                            {selectedGarageForDetails.pin || selectedGarageForDetails.ownerPin || '—'}
                          </span>
                          <button
                            onClick={() => {
                              setIsEditingGaragePin(true);
                              setGaragePinInput(selectedGarageForDetails.pin || selectedGarageForDetails.ownerPin || '');
                            }}
                            className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
                          >
                            {t('تعديل')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lock / Unlock Toggle Action */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto">
                <button
                  onClick={async () => {
                    const newLocked = !selectedGarageForDetails.isLocked;
                    await firestoreService.updateGarage(selectedGarageForDetails.id, { isLocked: newLocked });
                    setSelectedGarageForDetails({ ...selectedGarageForDetails, isLocked: newLocked });
                  }}
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    selectedGarageForDetails.isLocked
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                  }`}
                >
                  {selectedGarageForDetails.isLocked ? (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>{t('تفعيل الجراج الآن')}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>{t('إيقاف الخدمة فوراً')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 4-Card Performance Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Today */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-center relative group shadow-sm">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('اليوم')}</span>
                {(dailyCount > 0 || dailyRevenue > 0) && (
                  <button
                    type="button"
                    onClick={handleResetTodayCounters}
                    title={t('تصفير عداد وإيراد اليوم')}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-amber-500 transition-opacity p-0.5"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">{dailyCount}</div>
              <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1.5">
                {Number(dailyRevenue).toFixed(0)} {t('ج.م')}
              </p>
            </div>

            {/* Metric 2: Cumulative */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('تراكمي')}</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">{totalCount}</div>
              <p className="text-[11px] font-black text-slate-600 dark:text-slate-300 font-mono mt-1.5">
                {Number(totalRevenue).toFixed(0)} {t('ج.م')}
              </p>
            </div>

            {/* Metric 3: Total Recharged Units */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-center shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('إجمالي الوحدات')}</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">
                {selectedGarageForDetails.totalRechargedCars || 0}
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1.5">{t('وحدة مشحونة')}</p>
            </div>

            {/* Metric 4: Daily Refund Limit */}
            <div className={`p-4 rounded-2xl border text-center shadow-sm ${
              (selectedGarageForDetails.lastRefundDate === today ? selectedGarageForDetails.dailyRefundCount || 0 : 0) >= 5 
                ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{t('المرتجع اليومي')}</span>
              <div className={`text-2xl font-black font-mono leading-none ${
                (selectedGarageForDetails.lastRefundDate === today ? selectedGarageForDetails.dailyRefundCount || 0 : 0) >= 5 
                  ? 'text-rose-600 dark:text-rose-400' 
                  : 'text-slate-900 dark:text-white'
              }`}>
                {selectedGarageForDetails.lastRefundDate === today ? selectedGarageForDetails.dailyRefundCount || 0 : 0}
              </div>
              <p className="text-[10px] font-bold text-slate-400 mt-1.5">{t('/ 5 حد يومي')}</p>
            </div>
          </div>
        </section>

        {/* ================= ZONE 2: SUBSCRIPTION, FINANCIALS & RECHARGE ================= */}
        <section className="space-y-6">
          {/* Subscription Remaining Hero Card */}
          <div className="bg-slate-900 dark:bg-slate-900/90 text-white rounded-2xl border border-slate-800 p-6 sm:p-8 relative overflow-hidden shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="text-center md:text-right">
                <span className="text-slate-400 text-xs font-black uppercase tracking-widest block mb-2">
                  {t('الاشتراك المتبقي للجراج')}
                </span>
                <div className="flex items-baseline gap-3 justify-center md:justify-start">
                  <span className={`text-6xl sm:text-7xl font-black font-mono tracking-tighter ${
                    remainingDays <= 0 ? 'text-rose-400' : remainingDays <= 3 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {remainingDays}
                  </span>
                  <span className="text-xl font-bold text-slate-400">{t('يوم')}</span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400 justify-center md:justify-start">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span>
                    {t('تاريخ انتهاء الاشتراك:')} {(() => {
                      const expiry = selectedGarageForDetails.balanceExpiry;
                      if (!expiry) return '-';
                      const expiryDate = safeDate(expiry);
                      return expiryDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
                    })()}
                  </span>
                </div>
              </div>

              {/* Zero Balance / Clear Wallet Action */}
              <div className="w-full md:w-auto shrink-0 flex flex-col items-center md:items-end gap-2">
                {!showClearBalanceConfirm ? (
                  <button 
                    onClick={() => setShowClearBalanceConfirm(true)}
                    className="w-full md:w-auto px-6 py-3 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl font-bold text-xs border border-white/10 transition-all cursor-pointer"
                  >
                    {t('تصفير المحفظة وإنهاء الاشتراك')}
                  </button>
                ) : (
                  <div className="flex gap-2 p-1.5 bg-slate-800/80 rounded-xl border border-slate-700">
                    <button 
                      onClick={async () => {
                        setIsLoading(true);
                        try { 
                          const updateFields: any = { balance: 0, isLocked: true, balanceExpiry: Timestamp.fromDate(new Date()) };
                          await firestoreService.updateGarage(selectedGarageForDetails.id, updateFields); 
                          setShowClearBalanceConfirm(false); 
                        } 
                        catch (error) { console.error(error); } finally { setIsLoading(false); }
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-xs transition-all"
                    >
                      {t('تأكيد التصفير')}
                    </button>
                    <button 
                      onClick={() => setShowClearBalanceConfirm(false)} 
                      className="px-4 py-2 text-slate-400 hover:text-white font-bold text-xs"
                    >
                      {t('إلغاء')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Monthly Subscribers Surcharge Toggle */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>{t('خدمة المشتركين الشهريين / الإيواء')}</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-bold">
                {t('عند تفعيل هذا الخيار تضاف 500 ج.م ثابتة تلقائياً على قيمة أية باقة أو اشتراك بالجراج.')}
              </p>
            </div>
            <button 
              type="button"
              onClick={async () => {
                const newState = !selectedGarageForDetails.hasMonthlySubscribers;
                try {
                  await firestoreService.updateGarage(selectedGarageForDetails.id, { hasMonthlySubscribers: newState });
                  setSelectedGarageForDetails({ ...selectedGarageForDetails, hasMonthlySubscribers: newState });
                } catch (e) {
                  console.error(e);
                }
              }}
              className={`w-14 h-8 rounded-full p-1 transition-all duration-300 relative shrink-0 ${
                selectedGarageForDetails.hasMonthlySubscribers ? 'bg-purple-600' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full transition-all duration-300 transform ${
                selectedGarageForDetails.hasMonthlySubscribers ? (adminLang === 'en' ? 'translate-x-6' : '-translate-x-6') : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Quick Recharge Package Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <span>{t('باقات شحن الاشتراك الفوري')}</span>
              </h3>
              <span className="text-xs font-bold text-slate-400">
                {packages.length} {t('باقة متوفرة')}
              </span>
            </div>

            {/* Duration Filter Tabs */}
            {(() => {
              const rawList = packages || [];
              const displayPackages = rawList
                .map(p => {
                  const { finalPrice } = calculateFinalPrice(p, !!selectedGarageForDetails.hasMonthlySubscribers, subscriberFlatFee);
                  return {
                    ...p,
                    _sortPrice: finalPrice
                  };
                })
                .sort((a, b) => (a as any)._sortPrice - (b as any)._sortPrice);

              const filteredPackages = displayPackages.filter(pkg => {
                const info = getCleanPackageInfo(pkg);
                return info.durationDays === selectedDurationFilter;
              });

              const hasUnlimitedInFiltered = filteredPackages.some(p => getCleanPackageInfo(p).isUnlimited);
              const maxCapInFiltered = Math.max(...filteredPackages.map(p => getCleanPackageInfo(p).dailyCapacity || 0));

              return (
                <div className="space-y-4">
                  {/* Duration Filter Switcher */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-sm">
                      <Filter className="w-4 h-4 text-amber-500" />
                      <span>{t('اختار مدة الاشتراك:')}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">
                      ({filteredPackages.length} {t('باقات')})
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/70 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setSelectedDurationFilter(15)}
                      className={`py-2.5 px-2 rounded-xl font-black text-xs sm:text-sm transition-all text-center cursor-pointer ${
                        selectedDurationFilter === 15
                          ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      15 {t('يوم (نصف شهر)')}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedDurationFilter(30)}
                      className={`py-2.5 px-2 rounded-xl font-black text-xs sm:text-sm transition-all text-center cursor-pointer ${
                        selectedDurationFilter === 30
                          ? 'bg-amber-500 text-slate-950 shadow-md scale-[1.02]'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      30 {t('يوم (شهر)')}
                    </button>
                  </div>

                  {/* Packages List */}
                  <div className="space-y-3">
                    {filteredPackages.map((pkg) => {
                      const info = getCleanPackageInfo(pkg);
                      const { finalPrice: effectivePrice, displayBasePrice, hasDiscount } = calculateFinalPrice(
                        pkg, 
                        !!selectedGarageForDetails.hasMonthlySubscribers, 
                        subscriberFlatFee
                      );

                      const packageName = info.displayName;
                      const isTopTier = filteredPackages.length > 1 && (
                        info.isUnlimited || (!hasUnlimitedInFiltered && info.dailyCapacity !== null && info.dailyCapacity === maxCapInFiltered && maxCapInFiltered > 0)
                      );

                      return (
                        <div
                          key={pkg.id}
                          className={`p-4 sm:p-5 rounded-3xl border-2 transition-all flex items-center justify-between gap-3 ${
                            info.isUnlimited
                              ? 'bg-slate-900 border-amber-500 text-white shadow-xl'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white shadow-sm'
                          }`}
                        >
                          {/* Right Side: Package Name & Capacity */}
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-lg sm:text-xl font-black tracking-tight ${info.isUnlimited ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                {packageName}
                              </span>

                              {isTopTier && (
                                <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 shrink-0">
                                  <Sparkles className="w-3 h-3" />
                                  {t('الأكبر سعة')}
                                </span>
                              )}
                            </div>

                            <div className={`flex items-center gap-1.5 text-xs font-bold ${info.isUnlimited ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`}>
                              <Car className="w-4 h-4 text-amber-500 shrink-0" />
                              <span>
                                {info.isUnlimited ? t('عربيات مفتوحة بدون حد أقصى') : `${info.dailyCapacity} ${t('عربية فى اليوم بس')}`}
                              </span>
                            </div>
                          </div>

                          {/* Left Side: Direct Total Price & Recharge Button */}
                          <div className="flex flex-col items-end text-left shrink-0 gap-2">
                            <div>
                              {hasDiscount ? (
                                <div className="flex items-center gap-1.5 mb-0.5 justify-end">
                                  <div className="relative overflow-hidden rounded px-2 py-0.5 flex items-center justify-center shrink-0">
                                    <div 
                                      className="absolute inset-[-250%] bg-[conic-gradient(from_0deg,transparent_75%,#fbbf24_100%)]" 
                                      style={{ animation: 'spin 3.5s linear infinite' }} 
                                    />
                                    <div className={`absolute inset-[1.5px] rounded-[2.5px] ${info.isUnlimited ? 'bg-slate-900' : 'bg-white dark:bg-slate-900'}`} />
                                    <div className="absolute inset-[1.5px] rounded-[2.5px] bg-emerald-500/10" />
                                    <span className="relative z-10 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                                      {t('خصم')} {pkg.discountType === 'percentage' ? `${pkg.discountValue}%` : `${pkg.discountValue} ${t('ج.م')}`}
                                    </span>
                                  </div>
                                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 line-through">
                                    {displayBasePrice.toLocaleString('en-US')}
                                  </span>
                                </div>
                              ) : null}
                              <div className="flex items-baseline gap-1 font-mono justify-end">
                                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                                  {effectivePrice.toLocaleString('en-US')}
                                </span>
                                <span className="text-xs font-black text-amber-700 dark:text-amber-400">{t('ج.م')}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setPendingPackage({ ...pkg, price: effectivePrice })}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <Shield className="w-3.5 h-3.5" />
                              <span>{t('شحن الآن')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredPackages.length === 0 && (
                      <div className="py-8 text-center text-slate-400 font-bold text-xs">
                        {t('لا توجد باقات متوفرة في هذه المدة')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Referral System Box */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Gift className="w-4 h-4 text-emerald-500" />
                <span>{t('نظام مكافآت الإحالة (15 يوم اشتراك مجاني)')}</span>
              </h3>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400">
                {t('أيام المكافآت:')} {selectedGarageForDetails.totalReferralRewardDays || 0} {t('يوم')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Who referred this garage */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  {t('تم ترشيح هذا الجراج بواسطة:')}
                </label>
                <select
                  value={selectedGarageForDetails.referredByGarageId || ''}
                  onChange={async (e) => {
                    const refId = e.target.value;
                    const refGarage = allGarages.find(g => g.id === refId);
                    try {
                      await firestoreService.updateGarage(selectedGarageForDetails.id, {
                        referredByGarageId: refId || null,
                        referredByGarageName: refGarage ? refGarage.name : null
                      });
                      setSelectedGarageForDetails({
                        ...selectedGarageForDetails,
                        referredByGarageId: refId || undefined,
                        referredByGarageName: refGarage ? refGarage.name : undefined
                      });
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                >
                  <option value="">{t('غير مُرشَّح من جراج آخر (مباشر)')}</option>
                  {allGarages
                    .filter(g => g.id !== selectedGarageForDetails.id && g.status !== 'pending')
                    .map(g => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.phone || 'بدون هاتف'})
                      </option>
                    ))}
                </select>
              </div>

              {/* Garages referred by this garage */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {t('الجراجات التي رشحها هذا الجراج:')}
                  </span>
                  <span className="text-xs font-black text-emerald-600 font-mono">
                    {allGarages.filter(g => g.referredByGarageId === selectedGarageForDetails.id).length} {t('جراج')}
                  </span>
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1.5 custom-scrollbar-slate">
                  {allGarages.filter(g => g.referredByGarageId === selectedGarageForDetails.id).map(rg => (
                    <div key={rg.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-white dark:bg-slate-900">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{rg.name}</span>
                      <span className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                        rg.referralRewardClaimed ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {rg.referralRewardClaimed ? t('ممنوح 15 يوم') : t('في الانتظار')}
                      </span>
                    </div>
                  ))}
                  {allGarages.filter(g => g.referredByGarageId === selectedGarageForDetails.id).length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-2">{t('لا توجد إحالات مسجلة')}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= ZONE 3: SETTINGS & STAFF (COLLAPSIBLE ACCORDION) ================= */}
        <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Accordion Header */}
          <button
            onClick={() => setIsZone3Open(!isZone3Open)}
            className="w-full p-5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-right cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center font-black">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  {t('الإعدادات والتعريفة وطاقم العمل')}
                </h3>
                <p className="text-xs text-slate-400 font-bold">
                  {t('تعديل تسعيرة الساعة والمبيت وإدارة حسابات الموظفين')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">
                {isZone3Open ? t('إخفاء') : t('عرض')}
              </span>
              <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isZone3Open ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* Accordion Content */}
          {isZone3Open && (
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 space-y-6 animate-in fade-in duration-200">
              {/* Pricing Rates Configuration */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-4">
                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  <span>{t('تعريفة أسعار الركنة')}</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-400 text-center">
                      {t('سعر الساعة (ج.م)')}
                    </label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={hourlyRateInput}
                      onChange={(e) => setHourlyRateInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:border-emerald-500 text-center transition-all outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-black text-slate-600 dark:text-slate-400 text-center">
                      {t('سعر المبيت (ج.م)')}
                    </label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={overnightRateInput}
                      onChange={(e) => setOvernightRateInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-slate-900 dark:text-white focus:border-emerald-500 text-center transition-all outline-none font-mono"
                    />
                  </div>
                </div>

                <button 
                  type="button"
                  disabled={!hasRateChanges || isSavingRates}
                  onClick={handleSaveRates}
                  className={`w-full py-3.5 text-center rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all ${
                    hasRateChanges 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-98 cursor-pointer' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
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
                      <span>{t('حفظ تعديل التعريفة')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Staff Management Section */}
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-600" />
                    <span>{t('طاقم عمل الجراج (الموظفين)')}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 font-mono">
                      {staffList.length}
                    </span>
                  </h4>
                  <button 
                    onClick={openAddStaffModal}
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl font-black text-xs transition-all shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('إضافة موظف')}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar-slate">
                  {staffList.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center text-xs font-black">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900 dark:text-white">{s.name}</p>
                          
                          {editingStaffPinId === s.id ? (
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="tel"
                                inputMode="numeric"
                                value={editingStaffPinValue}
                                maxLength={6}
                                onChange={(e) => setEditingStaffPinValue(e.target.value.replace(/\D/g, ''))}
                                className="w-14 text-[10px] bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded px-1 text-center font-mono font-black"
                                placeholder="••••"
                                autoFocus
                              />
                              <button
                                onClick={async () => {
                                  if (editingStaffPinValue.length < 4) return;
                                  setIsUpdatingStaffPin(true);
                                  try {
                                    const pinCheck = await firestoreService.isPinTaken(editingStaffPinValue, s.id);
                                    if (pinCheck.taken) {
                                      setIsUpdatingStaffPin(false);
                                      return;
                                    }
                                    await firestoreService.updateStaff(s.id, { pin: editingStaffPinValue });
                                    s.pin = editingStaffPinValue;
                                    setEditingStaffPinId(null);
                                  } catch (err) {
                                    console.error(err);
                                  } finally {
                                    setIsUpdatingStaffPin(false);
                                  }
                                }}
                                disabled={isUpdatingStaffPin}
                                className="w-5 h-5 bg-emerald-600 text-white rounded flex items-center justify-center"
                              >
                                {isUpdatingStaffPin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                              <button
                                onClick={() => setEditingStaffPinId(null)}
                                className="text-[10px] text-slate-400 hover:underline px-0.5"
                              >
                                {t('إلغاء')}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400">{t('الرمز:')}</span>
                              <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md text-[10px] font-mono font-black">
                                {s.pin}
                              </span>
                              <button 
                                onClick={() => {
                                  setEditingStaffPinId(s.id);
                                  setEditingStaffPinValue(s.pin || '');
                                }}
                                className="text-[10px] text-emerald-600 hover:underline font-bold"
                              >
                                {t('تعديل')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <button 
                        onClick={() => setStaffToDelete(s)} 
                        className="w-8 h-8 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center hover:bg-rose-100 transition-colors cursor-pointer"
                        title={t('حذف الموظف')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {staffList.length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-400 font-bold">
                      {t('لا يوجد موظفين مسجلين لهذا الجراج')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl p-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{t('إضافة موظف جديد')}</h3>
            <p className="text-xs text-slate-400 font-bold mb-5">{t('أدخل اسم الموظف وسيتم استخدام الرمز الظاهر لتسجيل الدخول.')}</p>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                if (!staffForm.name || !staffForm.pin) return;
                setIsLoading(true);
                try {
                  const pinCheck = await firestoreService.isPinTaken(staffForm.pin);
                  if (pinCheck.taken) {
                    setIsLoading(false);
                    return;
                  }
                  await firestoreService.addStaff({ 
                    name: staffForm.name, 
                    pin: staffForm.pin, 
                    garageId: selectedGarageForDetails.id, 
                    role: 'staff' 
                  });
                  setShowAddStaffModal(false);
                } catch (e) { 
                  console.error(e);
                } finally { 
                  setIsLoading(false); 
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">{t('اسم الموظف')}</label>
                <input 
                  placeholder={t('مثال: أحمد محمد')} 
                  value={staffForm.name}
                  autoFocus
                  onChange={e => setStaffForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-base font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 text-center transition-all" 
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300">{t('الرمز السري (PIN)')}</label>
                <div className="w-full p-4 bg-slate-900 rounded-xl text-center border border-slate-800">
                  <span className="text-3xl font-black text-emerald-400 tracking-[0.25em] font-mono">{staffForm.pin}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="submit" 
                  disabled={isLoading || !staffForm.name} 
                  className="flex-1 py-3.5 bg-emerald-600 text-white rounded-xl font-black text-sm hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : t('تأكيد الإضافة')}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-5 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-sm hover:bg-slate-200 transition-all cursor-pointer"
                >
                  {t('إلغاء')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Package Confirmation Overlay */}
      {pendingPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm border-2 border-emerald-500 shadow-2xl animate-in fade-in">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {t('تأكيد تجديد الاشتراك؟')}
              </h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                {`${t('أنت على وشك تجديد الاشتراك لمدة')} ${pendingPackage.vehiclesCount || pendingPackage.durationDays || 30} ${t('يوم للجراج')}`}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-5 flex justify-between items-center">
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('السعر المطلوب')}</p>
                <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{pendingPackage.price} {t('ج.م')}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('المدة')}</p>
                <p className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  {pendingPackage.vehiclesCount || pendingPackage.durationDays || 30} {t('يوم')}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                disabled={isLoading}
                onClick={() => handleRechargeSubmit(pendingPackage)}
                className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-black text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>{t('تأكيد التجديد')}</span>}
              </button>
              <button
                disabled={isLoading}
                onClick={() => setPendingPackage(null)}
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 py-3.5 rounded-xl font-black text-sm hover:bg-slate-200 transition-all cursor-pointer"
              >
                {t('إلغاء')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Delete Confirmation Modal */}
      {staffToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center">
            <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2">{t('حذف الموظف؟')}</h3>
            <p className="text-xs text-slate-400 font-bold mb-6">
              {t('هل أنت متأكد من حذف الموظف')} <span className="text-slate-900 dark:text-white font-black">"{staffToDelete.name}"</span>؟
            </p>
            
            <div className="flex gap-3">
              <button 
                onClick={async () => {
                  setIsLoading(true);
                  try {
                    await firestoreService.removeStaff(staffToDelete.id);
                    setStaffToDelete(null);
                  } catch (e) { 
                    console.error(e);
                  } finally { 
                    setIsLoading(false); 
                  }
                }}
                disabled={isLoading}
                className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl font-black text-sm hover:bg-rose-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                {t('تأكيد الحذف')}
              </button>
              <button 
                onClick={() => setStaffToDelete(null)}
                className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-sm hover:bg-slate-200 transition-all cursor-pointer"
              >
                {t('إلغاء')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
