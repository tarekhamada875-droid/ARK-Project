/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { memo } from 'react';
// UI
import { 
  Shield,
  Key,
  Car, 
  Plus, 
  Search, 
  Users, 
  Trash2, 
  Settings as SettingsIcon,
  X,
  RotateCcw,
  RefreshCw,
  MoreVertical,
  ClipboardList,
  Check,
  Zap,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Building2,
  Wallet,
  LogOut,
  Sliders,
  Tag,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { Garage, Delegate, Package, RechargeRequest, Supervisor } from '../../types';
import { getCleanPackageInfo } from '../../constants/packages';
import { Spinner } from '../ui/Spinner';
import { firestoreServiceV2 as firestoreService, firestoreServiceV2 } from '../../services/domain/firestoreServiceV2';
import { AppearanceSettingsModal } from '../modals/AppearanceSettingsModal';
import { soundManager } from '../../utils/sounds';
import { useTheme } from '../../utils/ThemeContext';
import { useAdminTranslation } from '../../utils/adminTranslations';
import { generateSafePin, normalizeArabicSearch, resolveShimmerColor, isLightColor, normalizeDigits } from '../../utils';
import { useLocalStorageState } from '../../hooks/useLocalStorage';
import { AdminGarageList } from './AdminGarageList';
import { AdminAnnouncementsView } from './AdminAnnouncementsView';
import { AdminGlobalSettingsView } from './AdminGlobalSettingsView';
import { AdminOverviewView } from './AdminOverviewView';
import { AdminPeopleView } from './AdminPeopleView';

export { AdminGarageList };

interface AdminDashboardProps {
  allGarages: Garage[];
  isLoading: boolean;
  createNewGarage: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setView: (view: any) => void;
  setSelectedGarageForDetails: (garage: Garage | null) => void;
  setSelectedDelegateForDetails: (delegate: Delegate | null) => void;
  delegates: Delegate[];
  addDelegate?: (data: Omit<Delegate, 'id'>) => Promise<any>;
  packages: Package[];
  onLogout: () => void;
  rechargeRequests: RechargeRequest[];
  // Supervisor addition
  currentSupervisor?: Supervisor | null;
  supervisors?: Supervisor[];
  currentAdminPin: string;
  currentWalletNumber: string;
  onUpdateWalletNumber: (wallet: string) => Promise<void>;
  subscriptionPrices?: { weekly: number; biweekly?: number; monthly: number; weeklyDiscount?: number; biweeklyDiscount?: number; monthlyDiscount?: number };
  showToast?: (msg: string, type?: 'success' | 'error') => void;
}

export const AdminDashboard = memo(({
  allGarages,
  isLoading,
  createNewGarage,
  setView,
  setSelectedGarageForDetails,
  setSelectedDelegateForDetails,
  delegates,
  addDelegate: _addDelegate,
  packages,
  onLogout,
  rechargeRequests,
  currentSupervisor = null,
  supervisors = [],
  currentAdminPin,
  currentWalletNumber,
  onUpdateWalletNumber,
  subscriptionPrices = { weekly: 800, biweekly: 1500, monthly: 3000 },
  showToast
}: AdminDashboardProps) => {

  // Localized states to encapsulate admin view and prevent global App re-renders
  const [adminSearch, setAdminSearch] = React.useState<string>('');
  const [packageDurationFilter, setPackageDurationFilter] = React.useState<15 | 30>(30);
  const [activeTab, setActiveTab] = useLocalStorageState<'overview' | 'menu' | 'garages' | 'packages' | 'people' | 'delegates' | 'requests' | 'supervisors' | 'wallet' | 'admin-pin' | 'announcements' | 'global_settings' | 'catalog_settings'>('app_admin_tab', 'overview');

  const ADMIN_GARAGES_PER_PAGE = 50;
  const [adminGarageRows, setAdminGarageRows] = React.useState<Garage[]>([]);
  const [adminGarageHasMore, setAdminGarageHasMore] = React.useState(true);
  const [isAdminGaragePageLoading, setIsAdminGaragePageLoading] = React.useState(false);
  const [adminGaragePageError, setAdminGaragePageError] = React.useState(false);
  const adminGarageLastDocRef = React.useRef<any>(null);
  const adminGarageHasMoreRef = React.useRef(true);
  const isAdminGaragePageLoadingRef = React.useRef(false);
  const adminGarageTabOpenedRef = React.useRef(false);

  const loadAdminGaragePage = React.useCallback(async (reset = false) => {
    if (isAdminGaragePageLoadingRef.current || (!reset && !adminGarageHasMoreRef.current)) return;

    isAdminGaragePageLoadingRef.current = true;
    setIsAdminGaragePageLoading(true);
    setAdminGaragePageError(false);

    try {
      const page = await firestoreService.getAdminGaragesPage(
        ADMIN_GARAGES_PER_PAGE,
        reset ? null : adminGarageLastDocRef.current
      );

      setAdminGarageRows(previousRows => {
        const rows = reset ? page.garages : [...previousRows, ...page.garages];
        return Array.from(new Map(rows.map(garage => [garage.id, garage])).values());
      });
      adminGarageLastDocRef.current = page.lastDoc;
      adminGarageHasMoreRef.current = page.hasMore;
      setAdminGarageHasMore(page.hasMore);
    } catch (error) {
      console.error('Failed to load admin garage page:', error);
      setAdminGaragePageError(true);
    } finally {
      isAdminGaragePageLoadingRef.current = false;
      setIsAdminGaragePageLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'garages') {
      adminGarageTabOpenedRef.current = false;
      return;
    }

    if (!adminGarageTabOpenedRef.current) {
      adminGarageTabOpenedRef.current = true;
      void loadAdminGaragePage(true);
    }
  }, [activeTab, loadAdminGaragePage]);

  const [showPlansModal, setShowPlansModal] = useLocalStorageState<boolean>('app_admin_plans_modal', false);
  const [showOverview, setShowOverview] = useLocalStorageState<boolean>('app_admin_overview', false);
  const [pinInput, setPinInput] = React.useState<string>('');
  const [garageForm, setGarageForm] = React.useState<{
    name: string;
    hourlyRate: string;
    overnightRate: string;
    phone: string;
    initialPackageId: string;
    hasMonthlySubscribers: boolean;
    isTrial: boolean;
    priceScope: 'new_only' | 'all';
    ownerPin: string;
  }>({
    name: '',
    hourlyRate: '',
    overnightRate: '',
    phone: '',
    initialPackageId: '',
    hasMonthlySubscribers: false,
    isTrial: false,
    priceScope: 'new_only',
    ownerPin: ''
  });

  const [showMenu, setShowMenu] = React.useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = React.useState(false);
  const [adminColor, setAdminColor] = useLocalStorageState<string>('app_admin_color', '#10b981');
  
  const [isSavingAdminPin, setIsSavingAdminPin] = React.useState(false);
  const [isAdminPinVerified, setIsAdminPinVerified] = React.useState(false);
  const [currentPinAttempt, setCurrentPinAttempt] = React.useState('');
  const [newAdminPinValue, setNewAdminPinValue] = React.useState('');
  const [adminPinError, setAdminPinError] = React.useState('');
  const [adminPinSuccess, setAdminPinSuccess] = React.useState('');

  React.useEffect(() => {
    if (activeTab !== 'admin-pin') {
      setIsAdminPinVerified(false);
      setCurrentPinAttempt('');
      setNewAdminPinValue('');
      setAdminPinError('');
      setAdminPinSuccess('');
    }
  }, [activeTab]);

  const [walletValue, setWalletValue] = React.useState(currentWalletNumber);
  const [isSavingWallet, setIsSavingWallet] = React.useState(false);

  const [_subPriceForm, _setSubPriceForm] = React.useState<{
    weekly: string;
    weeklyDiscount: number;
    biweekly: string;
    biweeklyDiscount: number;
    monthly: string;
    monthlyDiscount: number;
  }>({
    weekly: String(subscriptionPrices.weekly ?? 800),
    weeklyDiscount: subscriptionPrices.weeklyDiscount || 0,
    biweekly: String(subscriptionPrices.biweekly ?? 1500),
    biweeklyDiscount: subscriptionPrices.biweeklyDiscount || 0,
    monthly: String(subscriptionPrices.monthly ?? 3000),
    monthlyDiscount: subscriptionPrices.monthlyDiscount || 0,
  });

  React.useEffect(() => {
    _setSubPriceForm({
      weekly: String(subscriptionPrices.weekly ?? 800),
      weeklyDiscount: subscriptionPrices.weeklyDiscount || 0,
      biweekly: String(subscriptionPrices.biweekly ?? 1500),
      biweeklyDiscount: subscriptionPrices.biweeklyDiscount || 0,
      monthly: String(subscriptionPrices.monthly ?? 3000),
      monthlyDiscount: subscriptionPrices.monthlyDiscount || 0,
    });
  }, [subscriptionPrices]);

  React.useEffect(() => {
    setWalletValue(currentWalletNumber);
  }, [currentWalletNumber]);


  const [packageValidationError, setPackageValidationError] = React.useState<{
    isOpen: boolean;
    conflictingPackageName: string;
    message: string;
    suggestions: string[];
  } | null>(null);

  const [confirmDialog, setConfirmDialog] = React.useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  const { theme, adminLang, setAdminLang } = useTheme();
  const resolvedAdminColor = resolveShimmerColor(adminColor, theme);
  const t = useAdminTranslation(adminLang);

  const menuRef = React.useRef<HTMLDivElement>(null);
  const mainScrollRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const handleApproveRequest = async (request: RechargeRequest) => {
    setConfirmDialog({
      isOpen: true,
      title: 'تفعيل الشحن',
      message: `هل أنت متأكد من تفعيل تجديد اشتراك جراج "${request.garageName || 'الجراج'}"؟`,
      confirmText: 'تفعيل الآن',
      cancelText: 'تراجع',
      type: 'success',
      onConfirm: async () => {
        try {
          const result = await firestoreServiceV2.approveRechargeRequest(request);
          if (result.success) {
            soundManager.play('checkIn');
            showToast?.('تم تفعيل اشتراك الجراج بنجاح', 'success');
          } else {
            soundManager.play('error');
            showToast?.(result.error || 'تعذر تفعيل الاشتراك', 'error');
          }
        } catch (error: any) {
          console.error('Failed to approve request:', error);
          soundManager.play('error');
          showToast?.(error?.message || 'حدث خطأ أثناء تفعيل الطلب', 'error');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRejectRequest = async (requestId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('رفض طلب الشحن'),
      message: 'هل أنت متأكد من رفض هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'نعم، ارفض الطلب',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        try {
          await firestoreService.rejectRechargeRequest(requestId);
          showToast?.('تم رفض طلب الشحن', 'error');
        } catch (error: any) {
          console.error('Failed to reject request:', error);
          showToast?.(error?.message || 'حدث خطأ أثناء رفض الطلب', 'error');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleApproveGarage = async (garage: Garage) => {
    setConfirmDialog({
      isOpen: true,
      title: 'قبول وتفعيل الجراج',
      message: `هل أنت متأكد من تفعيل جراج "${garage.name}" ليكون متاحاً للشحن والعمل بالكامل؟`,
      confirmText: 'قبول وتفعيل',
      cancelText: 'تراجع',
      type: 'success',
      onConfirm: async () => {
        try {
          await firestoreService.updateGarage(garage.id, { status: 'approved' });
          soundManager.play('checkIn');
        } catch (error) {
          console.error('Failed to approve garage:', error);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRejectGarage = async (garage: Garage) => {
    setConfirmDialog({
      isOpen: true,
      title: 'رفض طلب إنشاء جراج',
      message: `هل أنت متأكد من رفض طلب إنشاء جراج "${garage.name}"؟ سيؤدي ذلك لحذف البيانات نهائياً.`,
      confirmText: 'نعم، ارفض واحذف',
      cancelText: 'تراجع',
      type: 'danger',
      onConfirm: async () => {
        try {
          await firestoreService.deleteGarage(garage.id);
        } catch (error) {
          console.error('Failed to reject garage:', error);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (showPlansModal || showOverview) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPlansModal, showOverview]);

  const handleAddGarage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (currentSupervisor) {
      showToast?.('غير مصرح للمشرف بإضافة جراجات', 'error');
      setShowOverview(false);
      return;
    }
    await createNewGarage(e);
    setShowOverview(false);
  };

  const [requestSubTab, setRequestSubTab] = React.useState<'recharge' | 'creation'>('recharge');

  const approvedGarages = React.useMemo(() => {
    return allGarages.filter(g => g.status !== 'pending');
  }, [allGarages]);

  const pendingGarages = React.useMemo(() => {
    return allGarages.filter(g => g.status === 'pending');
  }, [allGarages]);

  const displayedGarages = React.useMemo(() => {
    const q = normalizeArabicSearch(adminSearch);

    return adminGarageRows.filter(garage => {
      if (garage.status === 'pending') return false;
      if (!q) return true;

      const normalizedName = normalizeArabicSearch(garage.name);
      const phoneMatch = (garage.phone || '').includes(adminSearch);
      return normalizedName.includes(q) || phoneMatch;
    });
  }, [adminGarageRows, adminSearch]);

  return (
    <div className={`admin-custom-theme h-[100dvh] w-full bg-[#faf9f6] dark:bg-slate-950 font-sans relative text-slate-900 dark:text-slate-100 transition-colors overflow-hidden flex flex-col`} dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
      <style>{`
        .admin-custom-theme .text-emerald-500,
        .admin-custom-theme .text-emerald-500,
        .admin-custom-theme .text-emerald-600,
        .admin-custom-theme .text-emerald-700,
        .admin-custom-theme .dark\\:text-emerald-400,
        .admin-custom-theme .text-emerald-450 {
          color: ${resolvedAdminColor} !important;
        }
        .admin-custom-theme .bg-emerald-600,
        .admin-custom-theme .bg-emerald-500,
        .admin-custom-theme .dark\\:bg-emerald-600,
        .admin-custom-theme .dark\\:bg-emerald-500 {
          background-color: ${resolvedAdminColor} !important;
          color: ${isLightColor(resolvedAdminColor) ? '#0f172a' : '#ffffff'} !important;
        }
        .admin-custom-theme .bg-emerald-600 *,
        .admin-custom-theme .bg-emerald-500 *,
        .admin-custom-theme .dark\\:bg-emerald-600 *,
        .admin-custom-theme .dark\\:bg-emerald-500 * {
          color: ${isLightColor(resolvedAdminColor) ? '#0f172a' : 'inherit'} !important;
        }
        .admin-custom-theme .hover\\:bg-emerald-700:hover,
        .admin-custom-theme .bg-emerald-600:hover,
        .admin-custom-theme .bg-emerald-500:hover,
        .admin-custom-theme .dark\\:bg-emerald-600:hover,
        .admin-custom-theme .dark\\:bg-emerald-500:hover {
          background-color: ${resolvedAdminColor}e6 !important;
          opacity: 0.95;
        }
        .admin-custom-theme .bg-emerald-50,
        .admin-custom-theme .bg-emerald-50\\/30,
        .admin-custom-theme .bg-emerald-50\\/50,
        .admin-custom-theme .bg-emerald-100,
        .admin-custom-theme .dark\\:bg-emerald-950\\/40,
        .admin-custom-theme .dark\\:bg-emerald-950\\/45,
        .admin-custom-theme .dark\\:bg-emerald-950\\/10 {
          background-color: ${resolvedAdminColor}15 !important;
        }
        .admin-custom-theme .bg-emerald-400\\/10,
        .admin-custom-theme .dark\\:bg-emerald-400\\/5,
        .admin-custom-theme .bg-emerald-50\\/50 {
          background-color: ${resolvedAdminColor}1a !important;
        }
        .admin-custom-theme .border-emerald-500,
        .admin-custom-theme .border-emerald-600,
        .admin-custom-theme .border-emerald-400,
        .admin-custom-theme .border-emerald-300,
        .admin-custom-theme .border-emerald-100,
        .admin-custom-theme .dark\\:border-emerald-700\\/80,
        .admin-custom-theme .dark\\:border-emerald-900\\/50 {
          border-color: ${resolvedAdminColor}80 !important;
        }
        .admin-custom-theme .border-emerald-500\\/20,
        .admin-custom-theme .border-emerald-400\\/10 {
          border-color: ${resolvedAdminColor}20 !important;
        }
        .admin-custom-theme .focus\\:border-emerald-500:focus,
        .admin-custom-theme .focus\\:border-emerald-400:focus {
          border-color: ${resolvedAdminColor} !important;
        }
        .admin-custom-theme .focus\\:ring-emerald-500:focus,
        .admin-custom-theme .focus\\:ring-emerald-400:focus,
        .admin-custom-theme .dark\\:focus\\:ring-emerald-500:focus {
          --tw-ring-color: ${resolvedAdminColor} !important;
          border-color: ${resolvedAdminColor} !important;
        }
        .admin-custom-theme .shadow-emerald-500\\/5 {
          --tw-shadow-color: ${resolvedAdminColor}1a !important;
          --tw-shadow: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -1px var(--tw-shadow-color) !important;
        }
        .admin-custom-theme .from-emerald-500\\/5 {
          --tw-gradient-from: ${resolvedAdminColor}0d !important;
          --tw-gradient-to: transparent !important;
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
        }
        .admin-custom-theme .dark\\:from-emerald-500\\/5 {
          --tw-gradient-from: ${resolvedAdminColor}0d !important;
          --tw-gradient-to: transparent !important;
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
        }
      `}</style>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 transition-colors w-full shrink-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            {activeTab !== 'menu' && (
              <button 
                type="button"
                onTouchEnd={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveTab('menu');
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveTab('menu');
                }}
                className="flex items-center justify-center w-10 h-10 bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 rounded-xl hover:bg-slate-800 dark:hover:bg-amber-500 outline-none cursor-pointer transition-colors shadow-sm shrink-0"
                title={t('رجوع')}
              >
                <ChevronRight className={`w-5.5 h-5.5 text-amber-400 dark:text-slate-950 stroke-[3.5] ${adminLang === 'en' ? 'rotate-180' : ''}`} />
              </button>
            )}
            <div className="hidden sm:flex w-10 h-10 bg-slate-900 dark:bg-slate-800 rounded-xl items-center justify-center text-white">
              <Shield className="w-6 h-6 stroke-[3]" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight leading-tight">
              {t('لوحة تحكم النظام')}
            </h1>
          </div>
          <div className="flex items-center gap-4 relative" ref={menuRef}>
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all outline-none border-2 ${
                showMenu 
                  ? 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/80 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100/50 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <MoreVertical className="w-5 h-5 stroke-[3]" />
            </button>

            {showMenu && (
              <>
                <div 
                  onClick={() => setShowMenu(false)}
                  className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 z-50 pointer-events-auto"
                />
                
                <div 
                  className={`fixed top-4 bottom-3 ${adminLang === 'en' ? 'right-3' : 'left-3'} w-[290px] xs:w-[330px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 z-50 flex flex-col overflow-hidden pointer-events-auto`}
                  dir={adminLang === 'en' ? 'ltr' : 'rtl'}
                >
                  {/* Drawer Header - Clean Profile Box matching Garage Sidebar */}
                  <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800/60 font-sans">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-400 dark:bg-amber-400 flex items-center justify-center text-slate-950 font-extrabold shadow-sm shrink-0">
                          <Shield className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div className={`flex flex-col ${adminLang === 'en' ? 'text-left' : 'text-right'}`}>
                          <span className="text-mobile-wrap text-sm font-black text-slate-900 dark:text-slate-100 max-w-[150px] leading-snug">
                            {currentSupervisor ? currentSupervisor.name : t('مالك النظام')}
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => setShowMenu(false)}
                        className="w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center justify-center transition-colors outline-none cursor-pointer shrink-0"
                      >
                        <X className="w-6 h-6 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Content Area */}
                  <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-scrollbar-slate font-sans">

                    {/* Display Language Selection */}
                    <div className="space-y-2">
                      <span className="font-bold text-xs text-slate-400 dark:text-slate-500 pr-1 select-none block">
                        {currentSupervisor ? t('لغة العرض:') : t('لغة العرض (الآدمن فقط):')}
                      </span>
                      <div className="flex gap-2">
                        {/* Arabic Button */}
                        <button 
                          type="button"
                          onClick={() => {
                            setAdminLang('ar');
                            setShowMenu(false);
                          }}
                          className={`flex-1 flex items-center justify-center py-2.5 px-3 rounded-xl border-2 transition-all outline-none font-bold text-sm cursor-pointer ${
                            adminLang === 'ar'
                              ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-sm'
                              : 'bg-[#faf9f6] dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>{t('العربية')}</span>
                        </button>

                        {/* English Button */}
                        <button 
                          type="button"
                          onClick={() => {
                            setAdminLang('en');
                            setShowMenu(false);
                          }}
                          className={`flex-1 flex items-center justify-center py-2.5 px-3 rounded-xl border-2 transition-all outline-none font-bold text-sm cursor-pointer ${
                            adminLang === 'en'
                              ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-sm'
                              : 'bg-[#faf9f6] dark:bg-slate-900 border-slate-150 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>{t('English')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Appearance Settings Button */}
                    <button 
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setShowAppearanceSettings(true);
                      }}
                      className="w-full flex items-center justify-between p-2.5 bg-[#faf9f6] dark:bg-slate-900 hover:bg-slate-100/60 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl border-2 border-slate-150 dark:border-slate-800 transition-all outline-none cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
                          <Sliders className="w-4 h-4 text-amber-400 dark:text-slate-950" />
                        </div>
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{t('إعدادات المظهر')}</span>
                      </div>
                    </button>
                  </div>

                  {/* Logout Button in Bottom Bar */}
                  <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/40 dark:bg-slate-900/40">
                    <button 
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        onLogout();
                      }}
                      className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-black text-sm outline-none cursor-pointer"
                    >
                      <LogOut className="w-5 h-5 rotate-180" />
                      <span>{t('تسجيل الخروج')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

        {/* Main Workspace Body */}
        <main 
          ref={mainScrollRef} 
          className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full ${showPlansModal || showOverview ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          {/* Top Navigation Bar with Horizontal Scrolling */}
          <div className="mb-8 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-hide no-scrollbar hide-scroll-bar touch-pan-x snap-x snap-mandatory">
              {/* Tab 1: Overview */}
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`flex shrink-0 snap-start items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeTab === 'overview' || activeTab === 'menu'
                    ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                <span>{t('نظرة عامة')}</span>
              </button>

              {/* Tab 2: Garages */}
              <button
                type="button"
                onClick={() => setActiveTab('garages')}
                className={`flex shrink-0 snap-start items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeTab === 'garages'
                    ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>{t('الجراجات')}</span>
              </button>

              {/* Tab 3: People (Delegates, Supervisors) */}
              <button
                type="button"
                onClick={() => setActiveTab('people')}
                className={`flex shrink-0 snap-start items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                  activeTab === 'people' || activeTab === 'delegates' || activeTab === 'supervisors'
                    ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{currentSupervisor ? t('المناديب') : t('الأشخاص')}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                  activeTab === 'delegates' || activeTab === 'supervisors'
                    ? 'bg-amber-400 text-slate-900 dark:bg-slate-950 dark:text-amber-400'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}>
                  {currentSupervisor ? delegates.length : (delegates.length + supervisors.length)}
                </span>
              </button>

              {/* Tab 4: Requests (Moved inside the main slider) */}
              {!currentSupervisor && (
                <button
                  type="button"
                  onClick={() => setActiveTab('requests')}
                  className={`flex shrink-0 snap-start items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    activeTab === 'requests'
                      ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>{t('الطلبات والمراجعات')}</span>
                  {(rechargeRequests.length > 0 || pendingGarages.length > 0) && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 animate-pulse ${
                      activeTab === 'requests'
                        ? 'bg-amber-400 text-slate-900 dark:bg-slate-950 dark:text-amber-400'
                        : 'bg-rose-500 text-white'
                    }`}>
                      {rechargeRequests.length + pendingGarages.length}
                    </span>
                  )}
                </button>
              )}

              {/* Tab 5: Subscription Pricing */}
              {!currentSupervisor && (
                <button
                  type="button"
                  onClick={() => setActiveTab('packages')}
                  className={`flex shrink-0 snap-start items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    activeTab === 'packages'
                      ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>{t('أسعار الاشتراكات')}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    activeTab === 'packages'
                      ? 'bg-amber-400 text-slate-900 dark:bg-slate-950 dark:text-amber-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}>
                    {packages.length}
                  </span>
                </button>
              )}

              {/* Tab 6: Settings */}
              {!currentSupervisor && (
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog_settings')}
                  className={`flex shrink-0 snap-start items-center gap-2.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                    activeTab === 'catalog_settings' || activeTab === 'wallet' || activeTab === 'admin-pin' || activeTab === 'announcements' || activeTab === 'global_settings'
                      ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <SettingsIcon className="w-4 h-4" />
                  <span>{t('الإعدادات')}</span>
                </button>
              )}
            </div>
          </div>

          {activeTab === 'overview' || activeTab === 'menu' ? (
            <AdminOverviewView
              allGarages={approvedGarages}
              delegates={delegates}
              isSupervisor={Boolean(currentSupervisor)}
              onSelectGarage={(g) => {
                if (currentSupervisor) return;
                setSelectedGarageForDetails(g);
                setView('admin_garage_details');
              }}
              onOpenAddGarage={!currentSupervisor ? () => {
                setPinInput('');
                setShowOverview(true);
              } : undefined}
            />
          ) : activeTab === 'people' || activeTab === 'delegates' || activeTab === 'supervisors' ? (
            <AdminPeopleView
              delegates={delegates}
              supervisors={supervisors}
              currentSupervisor={currentSupervisor}
              allGarages={approvedGarages}
              onSelectDelegate={(d) => {
                if (currentSupervisor) return;
                setSelectedDelegateForDetails(d);
                setView('admin_delegate_details');
              }}
            />
          ) : activeTab === 'catalog_settings' ? (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
                {/* Wallet Number */}
                <div 
                  onClick={() => setActiveTab('wallet')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 p-6 rounded-2xl cursor-pointer flex flex-col justify-between h-36 transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white text-base">{t('رقم المحفظة الإلكترونية')}</h3>
                    <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shadow-sm shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold font-mono">
                    <span>{currentWalletNumber}</span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-emerald-500 ${adminLang === 'en' ? '' : 'rotate-180'}`} />
                  </div>
                </div>

                {/* Admin PIN */}
                <div 
                  onClick={() => setActiveTab('admin-pin')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 p-6 rounded-2xl cursor-pointer flex flex-col justify-between h-36 transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white text-base">{t('رمز دخول الآدمن')}</h3>
                    <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shadow-sm shrink-0">
                      <Key className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                    <span>{t('تحديث رمز الحماية السري')}</span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-emerald-500 ${adminLang === 'en' ? '' : 'rotate-180'}`} />
                  </div>
                </div>

                {/* Announcements */}
                <div 
                  onClick={() => setActiveTab('announcements')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 p-6 rounded-2xl cursor-pointer flex flex-col justify-between h-36 transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white text-base">{t('إعلانات المنصة')}</h3>
                    <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shadow-sm shrink-0">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                    <span>{t('نشر وتعديل الإعلانات العامة')}</span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-blue-500 ${adminLang === 'en' ? '' : 'rotate-180'}`} />
                  </div>
                </div>

                {/* Global Settings */}
                <div 
                  onClick={() => setActiveTab('global_settings')}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 p-6 rounded-2xl cursor-pointer flex flex-col justify-between h-36 transition-all group shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-900 dark:text-white text-base">{t('الإعدادات العامة')}</h3>
                    <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 flex items-center justify-center shadow-sm shrink-0">
                      <SettingsIcon className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                    <span>{t('إعدادات النظام والعمولات')}</span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:text-purple-500 ${adminLang === 'en' ? '' : 'rotate-180'}`} />
                  </div>
                </div>
              </div>
            </div>
        ) : activeTab === 'garages' ? (
          <div className="grid grid-cols-1 gap-6">
            {/* Add Garage Button - Hidden for Supervisors */}
            {!currentSupervisor && (
              <button
                onClick={() => {
                  setPinInput('');
                  setShowOverview(true);
                }}
                className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-4 hover:opacity-90 transition-all outline-none active:scale-[0.98]"
              >
                <Plus className="w-5 h-5 stroke-[3]" />
                <span>{t('إضافة جراج جديد')}</span>
              </button>
            )}

            <section className="w-full">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
                  <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 ${adminLang === 'en' ? 'sm:flex-row-reverse' : ''}`}>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{t('قائمة الجراجات')}</span>
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">({displayedGarages.length})</span>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className={`absolute ${adminLang === 'en' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-3.5 h-3.5`} />
                      <input 
                        type="text" 
                        placeholder={t('بحث حسب الاسم أو الهاتف...')}
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 ${adminLang === 'en' ? 'pl-8 pr-4' : 'pr-8 pl-4'} text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-500 font-medium transition-all`}
                        dir="auto"
                      />
                    </div>
                  </div>
                </div>
                <div className="p-3 sm:p-4 flex flex-col gap-2 min-h-[160px]">
                  {displayedGarages.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-bold text-xs">
                      {t('لا توجد جراجات مطابقة للبحث')}
                    </div>
                  ) : (
                    displayedGarages.map((g) => {
                      return (
                        <div 
                          key={g.id} 
                          onClick={() => {
                            if (currentSupervisor) return;
                            setSelectedGarageForDetails(g);
                            setView('admin_garage_details');
                          }}
                          className={`w-full bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all ${
                            currentSupervisor 
                              ? 'cursor-default select-none' 
                              : 'cursor-pointer active:scale-[0.99] group'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="text-mobile-wrap font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm leading-snug">
                              {g.name}
                            </span>
                            {g.isLocked && (
                              <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-md bg-red-500/10 dark:bg-red-500/25 text-red-500 dark:text-red-400 border border-red-500/20 leading-none">
                                {t('مغلق')}
                              </span>
                            )}
                          </div>
                          {!currentSupervisor && (
                            <div className="shrink-0 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 transition-colors">
                              {adminLang === 'en' ? (
                                <ChevronRight className="w-4 h-4" />
                              ) : (
                                <ChevronLeft className="w-4 h-4" />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {adminGaragePageError && (
                  <div className="p-4 flex flex-col items-center gap-2 border-t border-slate-100 dark:border-slate-800 text-center">
                    <span className="text-xs font-bold text-red-500 dark:text-red-400">
                      {t('تعذر تحميل قائمة الجراجات.')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void loadAdminGaragePage(adminGarageRows.length === 0)}
                      disabled={isAdminGaragePageLoading}
                      className="px-5 py-2 text-xs font-black text-white bg-slate-900 dark:bg-emerald-600 rounded-xl disabled:opacity-60"
                    >
                      {t('إعادة المحاولة')}
                    </button>
                  </div>
                )}

                {!adminGaragePageError && adminGarageHasMore && (
                  <div className="p-4 flex justify-center border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <button
                      type="button"
                      onClick={() => void loadAdminGaragePage()}
                      disabled={isAdminGaragePageLoading}
                      className="px-6 py-2.5 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl font-black text-xs transition-colors shadow-sm active:scale-95"
                    >
                      {isAdminGaragePageLoading ? t('جارٍ التحميل...') : t('تحميل المزيد')}
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : activeTab === 'requests' ? (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">

            {/* Sub-tabs segment controller */}
            <div className="flex bg-[#f1f5f9] dark:bg-slate-900/60 p-1 rounded-2xl max-w-sm sm:max-w-md w-full border border-slate-200/40 dark:border-slate-800/40">
              <button
                onClick={() => setRequestSubTab('recharge')}
                className={`flex-1 flex items-center justify-center gap-4 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all focus:outline-none ${
                  requestSubTab === 'recharge'
                    ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('طلبات الشحن')}</span>
                {rechargeRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white shrink-0">
                    {rechargeRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRequestSubTab('creation')}
                className={`flex-1 flex items-center justify-center gap-4 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all focus:outline-none ${
                  requestSubTab === 'creation'
                    ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('إنشاء الجراجات')}</span>
                {pendingGarages.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white shrink-0">
                    {pendingGarages.length}
                  </span>
                )}
              </button>
            </div>

            {requestSubTab === 'recharge' ? (
              <div className="grid grid-cols-1 gap-4">
                {rechargeRequests.map((request) => (
                  <div 
                    key={request.id}
                    className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 transition-all hover:border-emerald-500/50"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400">
                            <Car className="w-7 h-7" />
                          </div>
                          <div className={adminLang === 'en' ? 'text-left' : 'text-right'}>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{request.garageName}</h3>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-1">
                              <span>{t('بواسطة المندوب:')}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 underline decoration-dotted">{request.delegateName}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('نوع الاشتراك')}</p>
                            <div className="flex items-center gap-4">
                              <Zap className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-mobile-wrap text-xs font-black text-slate-900 dark:text-white leading-snug">{request.packageName}</span>
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('السعة اليومية')}</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                              {request.carsCount === 0 || !request.carsCount ? t('غير محدودة') : `${request.carsCount} ${t('سيارة/يوم')}`}
                            </p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('المدة')}</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white font-mono">{request.durationDays || 30} <span className="text-[10px]">{t('يوم')}</span></p>
                          </div>
                        </div>

                        {/* Payment Breakdown */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-1.5 bg-slate-50/60 dark:bg-slate-800/40 p-3 rounded-xl text-right">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('المبلغ الأصلي')}</span>
                            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{(request as any).originalRevenueAmount !== undefined ? (request as any).originalRevenueAmount : request.revenueAmount} {t('ج.م')}</span>
                          </div>
                          {request.discountAmount && request.discountAmount > 0 ? (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{t('الخصم')}</span>
                              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">- {request.discountAmount} {t('ج.م')} {request.couponCode ? `[${request.couponCode}]` : ''}</span>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between text-xs font-bold border-t border-slate-200/60 dark:border-slate-700/60 pt-1.5">
                            <span className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest">{t('المبلغ المدفوع')}</span>
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{request.revenueAmount} {t('ج.م')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-4 justify-center">
                        <button
                          onClick={() => handleApproveRequest(request)}
                          className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-4 transition-all uppercase tracking-widest"
                        >
                          <Check className="w-5 h-5 stroke-[4]" />
                          <span>{t('موافق')}</span>
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="flex-1 md:w-32 bg-red-50 dark:bg-red-900/20 text-red-655 dark:text-red-400 p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-4 transition-all uppercase tracking-widest border border-red-100 dark:border-red-900/30"
                        >
                          <X className="w-5 h-5 stroke-[4]" />
                          <span>{t('رفض')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {rechargeRequests.length === 0 && (
                  <div className="text-center py-24 bg-white dark:bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                      <ClipboardList className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 dark:text-slate-755 mb-2">{t('لا توجد طلبات معلقة')}</h3>
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-600">{t('سيظهر هنا طلبات شحن الأرصدة المقدمة من قبل المندوبين')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {pendingGarages.map((garage) => (
                  <div 
                    key={garage.id}
                    className="bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 transition-all hover:border-emerald-500/50"
                  >
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-400/10 text-emerald-500 rounded-2xl flex items-center justify-center">
                            <Building2 className="w-7 h-7" />
                          </div>
                          <div className={adminLang === 'en' ? 'text-left' : 'text-right'}>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white leading-tight">{garage.name}</h3>
                            <div className="flex items-center gap-4 text-xs font-bold text-slate-400 mt-1">
                              <span>{t('بواسطة المندوب:')}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 underline decoration-dotted">
                                {garage.createdByDelegateName || t('غير معروف')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('رقم الموبايل')}</p>
                            <p className="text-xs font-black text-slate-900 dark:text-white font-mono" dir="ltr">{garage.phone || t('بدون هاتف')}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('سعر الساعة')}</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{garage.hourlyRate} <span className="text-[10px]">{t('ج.م')}</span></p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('سعر المبيت')}</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white font-mono">{garage.overnightRate} <span className="text-[10px]">{t('ج.م')}</span></p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-4 justify-center">
                        <button
                          onClick={() => handleApproveGarage(garage)}
                          className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-4 transition-all uppercase tracking-widest"
                        >
                          <Check className="w-5 h-5 stroke-[4]" />
                          <span>{t('تأكيد تفعيل')}</span>
                        </button>
                        <button
                          onClick={() => handleRejectGarage(garage)}
                          className="flex-1 md:w-32 bg-red-50 dark:bg-red-900/20 text-red-655 dark:text-red-400 p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-4 transition-all uppercase tracking-widest border border-red-100 dark:border-red-900/30"
                        >
                          <X className="w-5 h-5 stroke-[4]" />
                          <span>{t('رفض الطلب')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {pendingGarages.length === 0 && (
                  <div className="text-center py-24 bg-white dark:bg-slate-900/50 rounded-[3rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
                    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Building2 className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-400 dark:text-slate-755 mb-2">{t('لا توجد طلبات معلقة')}</h3>
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-600">{t('سيظهر هنا طلبات تسجيل الجراجات الجديدة المقدمة من المندوبين')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'packages' ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form Column */}
              <section className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-4">
                    <div className="w-8 h-8 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0 text-white">
                      <Plus className="w-5 h-5 stroke-[3]" />
                    </div>
                    <span>{t('إضافة خطة اشتراك جديدة')}</span>
                  </h2>

                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const nameInput = form.elements.namedItem('pkgName') as HTMLInputElement;
                      const priceInput = form.elements.namedItem('pkgPrice') as HTMLInputElement;
                      const durationInput = form.elements.namedItem('pkgDurationDays') as HTMLInputElement | HTMLSelectElement;
                      const dailyCapInput = form.elements.namedItem('pkgDailyCapacity') as HTMLInputElement | HTMLSelectElement;
                      const discountValueInput = form.elements.namedItem('pkgDiscountValue') as HTMLSelectElement;
                      
                      const name = nameInput.value.trim();
                      const price = Number(priceInput.value) || 0;
                      const durationDays = Number(durationInput.value) || 30;
                      const rawCapVal = dailyCapInput?.value !== undefined && dailyCapInput.value.trim() !== '' ? Number(dailyCapInput.value) : 0;
                      const dailyCapacity = isNaN(rawCapVal) ? 0 : rawCapVal;
                      const discountVal = discountValueInput?.value ? Number(discountValueInput.value) : 0;
                      
                      if (!name || price <= 0) {
                        return;
                      }

                      // Logical Validation
                      const finalPrice = discountVal > 0 ? price * (1 - discountVal / 100) : price;
                      const nDur = durationDays;
                      const nCap = dailyCapacity === 0 ? Infinity : dailyCapacity;

                      let conflict = null;
                      const currentPkgs = packages || [];
                      for (const pkg of currentPkgs) {
                        const info = getCleanPackageInfo(pkg);
                        const eCap = info.isUnlimited ? Infinity : (info.dailyCapacity || 50);
                        const eDur = info.durationDays;
                        const ePrice = pkg.discountValue && pkg.discountValue > 0 
                          ? (pkg.discountType === 'percentage' 
                              ? pkg.price * (1 - pkg.discountValue / 100) 
                              : Math.max(0, pkg.price - pkg.discountValue))
                          : pkg.price;

                        // Same package details (Duplicate)
                        if (nCap === eCap && nDur === eDur && finalPrice === ePrice) {
                          conflict = { pkgName: pkg.name, reason: 'duplicate', ePrice, eCap, eDur };
                          break;
                        }

                        // Condition A: New offers MORE/EQUAL value but is CHEAPER/EQUAL
                        if (nDur >= eDur && nCap >= eCap && finalPrice <= ePrice) {
                          conflict = { pkgName: pkg.name, reason: 'too_cheap', ePrice, eCap, eDur };
                          break;
                        }

                        // Condition B: New offers LESS/EQUAL value but is MORE EXPENSIVE/EQUAL
                        if (nDur <= eDur && nCap <= eCap && finalPrice >= ePrice) {
                          conflict = { pkgName: pkg.name, reason: 'too_expensive', ePrice, eCap, eDur };
                          break;
                        }
                      }

                      if (conflict) {
                        let msg = '';
                        let suggestions: string[] = [];
                        if (conflict.reason === 'duplicate') {
                          msg = `هذا الاشتراك مطابق تماماً لاشتراك "${conflict.pkgName}".`;
                          suggestions = ['قم بتغيير السعر', 'أو تغيير السعة اليومية', 'أو تغيير مدة الاشتراك'];
                        } else if (conflict.reason === 'too_cheap') {
                          msg = `هذا الاشتراك يقدم ميزات (مدة/سعة) أكبر من أو تساوي اشتراك "${conflict.pkgName}" ولكن بسعر أرخص أو مساوٍ!`;
                          suggestions = [
                            `ارفع السعر (بعد الخصم) ليكون أعلى من ${Math.round(conflict.ePrice)} ج.م`,
                            conflict.eCap === Infinity ? `قم بتحديد سعة يومية بدلاً من السعة المفتوحة` : `قلل السعة اليومية لتكون أقل من ${conflict.eCap} سيارة/يوم`,
                            `قلل مدة الاشتراك لتكون أقل من ${conflict.eDur} يوماً`
                          ];
                        } else if (conflict.reason === 'too_expensive') {
                          msg = `هذا الاشتراك يقدم ميزات (مدة/سعة) أقل من أو تساوي اشتراك "${conflict.pkgName}" ولكن بسعر أعلى أو مساوٍ!`;
                          suggestions = [
                            `قلل السعر (بعد الخصم) ليكون أقل من ${Math.round(conflict.ePrice)} ج.م`,
                            conflict.eCap === Infinity ? `(السعة الحالية مفتوحة بالفعل)` : `ارفع السعة اليومية لتكون أعلى من ${conflict.eCap} سيارة/يوم`,
                            `ارفع مدة الاشتراك لتكون أعلى من ${conflict.eDur} يوماً`
                          ];
                        }

                        setPackageValidationError({
                          isOpen: true,
                          conflictingPackageName: conflict.pkgName,
                          message: msg,
                          suggestions: suggestions.filter(s => !s.includes('(السعة الحالية مفتوحة بالفعل)'))
                        });
                        return;
                      }

                      try {
                        const pkgData: Omit<Package, 'id' | 'createdAt' | 'isActive'> = {
                          name,
                          price,
                          vehiclesCount: dailyCapacity,
                          durationDays,
                          dailyCapacity
                        };
                        if (discountVal > 0) {
                          pkgData.discountType = 'percentage';
                          pkgData.discountValue = discountVal;
                        }
                        await firestoreService.addPackage(pkgData);
                        form.reset();
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="space-y-5"
                  >
                    {/* Plan Name */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                        {t('اسم خطة الاشتراك')} <span className="text-red-500">*</span>
                      </label>
                      <input 
                        name="pkgName" 
                        placeholder={t('مثال: اشتراك 15 يوم - سعة 50 سيارة/يوم')} 
                        required 
                        className="w-full p-4 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 outline-none font-bold text-sm transition-all" 
                      />
                    </div>

                    {/* Price */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                        {t('سعر الاشتراك الدوري (ج.م)')} <span className="text-red-500">*</span>
                      </label>
                      <input 
                        name="pkgPrice" 
                        type="text" 
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={t('مثال: 800 أو 1500')} 
                        required 
                        className="w-full p-4 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-500 outline-none font-bold font-mono text-base transition-all" 
                      />
                    </div>

                    {/* Duration & Daily Capacity */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                          {t('مدة الاشتراك (بالأيام)')}
                        </label>
                        <select 
                          name="pkgDurationDays" 
                          defaultValue="30"
                          className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 font-bold font-mono text-sm outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="15">15 {t('يوم')}</option>
                          <option value="30">30 {t('يوم')}</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                          {t('السعة اليومية (سيارة/يوم)')}
                        </label>
                        <select 
                          name="pkgDailyCapacity" 
                          defaultValue=""
                          className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold font-mono text-sm outline-none focus:border-emerald-500" 
                          dir="rtl"
                        >
                          <option value="40">40 {t('سيارة')}</option>
                          <option value="70">70 {t('سيارة')}</option>
                          <option value="100">100 {t('سيارة')}</option>
                          <option value="150">150 {t('سيارة')}</option>
                          <option value="">{t('غير محدودة')}</option>
                        </select>
                      </div>
                    </div>

                    {/* Discount */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <Tag className="w-4 h-4" />
                        <span>{t('نسبة الخصم التشجيعي (%)')}</span>
                      </label>
                      <select 
                        name="pkgDiscountValue"
                        className="w-full p-4.5 bg-slate-100 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-sm font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">{t('بدون خصم (0%)')}</option>
                        {[10, 15, 20, 25, 30, 50].map((num) => (
                          <option key={num} value={num}>
                            خصم {num}%
                          </option>
                        ))}
                      </select>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-base transition-all shadow-md flex items-center justify-center gap-4 cursor-pointer mt-2"
                    >
                      <Plus className="w-5 h-5 stroke-[3]" />
                      <span>{t('حفظ وإضافة خطة الاشتراك')}</span>
                    </button>
                  </form>
                </div>
              </section>

              {/* Plans List Column */}
              <section className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="p-6 border-b-2 border-slate-200 dark:border-slate-800 flex justify-between items-center">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-4">
                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
                        <Zap className="w-5 h-5" />
                      </div>
                      <span>{t('خطط الاشتراكات الحالية للنظام')}</span>
                      <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                        ({packages.length})
                      </span>
                    </h2>
                  </div>

                  <div className="p-6">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mb-6">
                      <button
                        type="button"
                        onClick={() => setPackageDurationFilter(15)}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex flex-col items-center justify-center gap-1 ${
                          packageDurationFilter === 15 
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        <span>15 {t('يوم')}</span>
                        <span className="text-[10px] font-bold opacity-60">({t('نصف شهر')})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPackageDurationFilter(30)}
                        className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex flex-col items-center justify-center gap-1 ${
                          packageDurationFilter === 30 
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                      >
                        <span>30 {t('يوم')}</span>
                        <span className="text-[10px] font-bold opacity-60">({t('شهر')})</span>
                      </button>
                    </div>

                    {(() => {
                      const displayedPackages = packages.filter(p => packageDurationFilter === 30 ? (p.durationDays === 30 || !p.durationDays) : p.durationDays === 15);

                      return (
                        <div className="space-y-8">
                          {displayedPackages.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {displayedPackages.map(pkg => (
                                <div 
                                  key={pkg.id} 
                                  className="p-5 bg-slate-50 dark:bg-slate-800/60 border-2 border-slate-200 dark:border-slate-700 rounded-2xl hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between shadow-sm relative"
                                >
                                  <div className="flex justify-between items-start mb-4">
                                    <div>
                                      <h4 className="font-black text-slate-900 dark:text-white text-base leading-tight">{pkg.name}</h4>
                                      {pkg.discountValue && pkg.discountValue > 0 ? (
                                        <div className="relative overflow-hidden rounded-full inline-flex items-center justify-center shrink-0 mt-1">
                                          {/* Spinning Golden Snake Background */}
                                          <div 
                                            className="absolute inset-[-250%] bg-[conic-gradient(from_0deg,transparent_75%,#fbbf24_100%)]" 
                                            style={{ animation: 'spin 3.5s linear infinite' }} 
                                          />
                                          {/* Inner Background Mask */}
                                          <div className="absolute inset-[1.5px] rounded-full bg-slate-50 dark:bg-slate-800" />
                                          {/* Original Emerald Tint */}
                                          <div className="absolute inset-[1.5px] rounded-full bg-emerald-500/10" />
                                          
                                          {/* Text Content */}
                                          <span className="relative z-10 inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 text-emerald-600 dark:text-emerald-400">
                                            <Tag className="w-3 h-3" />
                                            خصم {pkg.discountValue}%
                                          </span>
                                        </div>
                                      ) : null}
                                    </div>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setConfirmDialog({
                                          isOpen: true,
                                          title: t('حذف خطة اشتراك'),
                                          message: `هل أنت متأكد من حذف خطة الاشتراك "${pkg.name}"؟`,
                                          confirmText: t('حذف'),
                                          cancelText: t('تراجع'),
                                          type: 'danger',
                                          onConfirm: async () => {
                                            try {
                                              await firestoreService.deletePackage(pkg.id);
                                            } catch (err) {
                                              console.error(err);
                                            } finally {
                                              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                            }
                                          }
                                        });
                                      }}
                                      className="w-9 h-9 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white dark:bg-red-900/30 dark:hover:bg-red-600 dark:text-red-400 dark:hover:text-white rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0"
                                      title={t('حذف الخطة')}
                                    >
                                      <Trash2 className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-3 gap-4 border-t border-slate-200 dark:border-slate-700/80 pt-4 mt-auto text-center font-sans">
                                    <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">{t('سعر الاشتراك')}</span>
                                      <div className="flex flex-col items-center">
                                        {pkg.discountValue && pkg.discountValue > 0 ? (
                                          <>
                                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                              {Math.round(pkg.price * (1 - pkg.discountValue / 100))} ج.م
                                            </span>
                                            <span className="text-[10px] text-slate-400 line-through font-mono">{pkg.price} ج.م</span>
                                          </>
                                        ) : (
                                          <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">{pkg.price} ج.م</span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-center border-x border-slate-200 dark:border-slate-700/80 px-1">
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">{t('مدة الاشتراك')}</span>
                                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                                        {pkg.durationDays || 30} يوماً
                                      </span>
                                    </div>

                                    <div className="flex flex-col items-center">
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1">{t('السعة اليومية')}</span>
                                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                                        {getCleanPackageInfo(pkg).isUnlimited ? 'سعة مفتوحة' : `${getCleanPackageInfo(pkg).dailyCapacity} سيارة/يوم`}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="py-16 text-center text-slate-400 dark:text-slate-500 font-bold">
                              <Zap className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-500" />
                              <p>{t('لا توجد خطط اشتراكات مسجلة حالياً في هذه الفئة')}</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : activeTab === 'wallet' ? (
          (() => {
            const renderFormattedWallet = (val: string) => {
              if (!val) return null;
              return val.split('').map((char, index) => {
                const isDigit = /\d/.test(char);
                if (isDigit) {
                  return (
                    <span key={index} className="text-slate-900 dark:text-white font-mono">
                      {char}
                    </span>
                  );
                } else {
                  return (
                    <span key={index} className="text-emerald-500 dark:text-emerald-400 font-extrabold font-mono select-none px-[1px]">
                      {char}
                    </span>
                  );
                }
              });
            };

            return (
              <div className="max-w-2xl mx-auto font-sans">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 sm:p-12 transition-colors relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none" />
                  
                  {/* Description Header */}
                  <div className="mb-10 text-center space-y-3 relative z-10">
                    <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-emerald-500/10">
                      <Wallet className="w-7 h-7 text-slate-950 stroke-[2.5]" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('رقم المحفظة الإلكترونية')}</h2>
                  </div>

                  {/* Edit Form */}
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!walletValue.trim()) {
                        return;
                      }
                      setIsSavingWallet(true);
                      try {
                        await onUpdateWalletNumber(walletValue);
                        setActiveTab('menu');
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsSavingWallet(false);
                      }
                    }}
                    className="space-y-6 relative z-10"
                  >
                    <div className="space-y-4 text-center">
                      {/* Emerald Separators Live Preview */}
                      <div className="bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 text-center select-none" dir="ltr">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 font-sans">{t('الرقم بالتنسيق الملون')}</p>
                        <div className="text-2xl font-black tracking-widest">
                          {renderFormattedWallet(walletValue) || <span className="text-slate-300 dark:text-slate-600">-- - --- - --- - --</span>}
                        </div>
                      </div>

                      <input 
                        type="text"
                        value={walletValue}
                        onChange={(e) => {
                          const filtered = e.target.value.replace(/[^0-9\s-]/g, '');
                          setWalletValue(filtered);
                        }}
                        dir="ltr"
                        required
                        placeholder="015 - 524 - 113 - 23"
                        className="w-full text-center p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all tracking-wide font-mono" 
                      />
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button 
                        type="submit"
                        disabled={isSavingWallet}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all outline-none animate-none"
                      >
                        {isSavingWallet ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span>{t('حفظ التعديلات')}</span>
                        )}
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setWalletValue(currentWalletNumber);
                          setActiveTab('menu');
                        }}
                        className="px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-extrabold text-sm rounded-2xl transition-all"
                      >
                        {t('إلغاء')}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()
        ) : activeTab === 'announcements' ? (
          <AdminAnnouncementsView allGarages={allGarages} />
        ) : activeTab === 'global_settings' ? (
          <AdminGlobalSettingsView />
        ) : activeTab === 'admin-pin' ? (
          <div className="max-w-2xl mx-auto font-sans">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-8 sm:p-12 transition-colors relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-500/5 to-transparent rounded-full -mr-16 -mt-16 pointer-events-none" />
              
              {!isAdminPinVerified ? (
                /* Stage 1: Identity verification (Requesting current admin passcode) */
                <div>
                  {/* Header */}
                  <div className="mb-10 text-center space-y-3 relative z-10">
                    <div className="w-14 h-14 bg-red-500/10 dark:bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Shield className="w-7 h-7 text-red-600 dark:text-red-400 stroke-[2.5]" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {t('التحقق من الهوية')}
                    </h2>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-md mx-auto text-balance">
                      {t('أدخل رمز الدخول الحالي للمتابعة')}
                    </p>
                  </div>

                  {/* Verification Form */}
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      setAdminPinError('');
                      setAdminPinSuccess('');

                      const attempt = normalizeDigits(currentPinAttempt);
                      const current = normalizeDigits(currentAdminPin || '');

                      if (attempt.length < 4) {
                        setAdminPinError('أدخل رمز الدخول الحالي للمتابعة.');
                        return;
                      }

                      if (attempt !== current) {
                        setAdminPinError('رمز الدخول الحالي غير صحيح.');
                        return;
                      }

                      setCurrentPinAttempt('');
                      setNewAdminPinValue('');
                      setIsAdminPinVerified(true);
                    }}
                    className="space-y-6 relative z-10"
                  >
                    <div className="space-y-4 text-center">
                      <input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={currentPinAttempt}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setCurrentPinAttempt(val);
                        }}
                        maxLength={6}
                        aria-label="رمز الدخول الحالي"
                        required
                        placeholder="••••"
                        className="w-full max-w-xs mx-auto text-center p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all tracking-[0.5em] font-mono"
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all outline-none cursor-pointer"
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                        <span>{t('تأكيد ودخول')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewAdminPinValue('');
                          setAdminPinError('');
                          setAdminPinSuccess('');
                          setCurrentPinAttempt('');
                          setIsAdminPinVerified(false);
                          setActiveTab('menu');
                        }}
                        className="px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-extrabold text-sm rounded-2xl transition-all cursor-pointer"
                      >
                        {t('رجوع')}
                      </button>
                    </div>
                    {adminPinError && (
                      <p role="alert" className="mt-4 text-center text-sm font-black text-red-500">
                        {adminPinError}
                      </p>
                    )}
                  </form>
                </div>
              ) : (
                /* Stage 2: Verified (Set a new admin passcode) */
                <div>
                  {/* Header */}
                  <div className="mb-10 text-center space-y-3 relative z-10">
                    <div className="w-14 h-14 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Key className="w-7 h-7 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {t('رمز دخول الآدمن')}
                    </h2>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 max-w-md mx-auto text-balance">
                      {t('أدخل رمز دخول جديداً مكوّناً من 6 أرقام')}
                    </p>
                  </div>

                  {/* Edit Passcode Form */}
                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setAdminPinError('');
                      setAdminPinSuccess('');

                      const newPin = normalizeDigits(newAdminPinValue);
                      const current = normalizeDigits(currentAdminPin || '');

                      if (newPin.length !== 6) {
                        setAdminPinError('رمز الدخول الجديد يجب أن يتكون من 6 أرقام بالضبط.');
                        return;
                      }

                      if (newPin === current) {
                        setAdminPinError('رمز الدخول الجديد يجب أن يكون مختلفاً عن الرمز الحالي.');
                        return;
                      }

                      setIsSavingAdminPin(true);
                      try {
                        await firestoreService.updateAdminPin(newPin);
                        setAdminPinSuccess('تم تغيير رمز الدخول بنجاح.');
                        setCurrentPinAttempt('');
                        setNewAdminPinValue('');
                        setIsAdminPinVerified(false);

                        window.setTimeout(() => {
                          setAdminPinSuccess('');
                          setActiveTab('menu');
                        }, 1200);
                      } catch (error) {
                        console.error('Failed to update admin PIN:', error);
                        setAdminPinError('تعذر حفظ رمز الدخول. تحقق من الاتصال وحاول مرة أخرى.');
                      } finally {
                        setIsSavingAdminPin(false);
                      }
                    }}
                    className="space-y-6 relative z-10"
                  >
                    <div className="space-y-4 text-center">
                      <input
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newAdminPinValue}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setNewAdminPinValue(val);
                        }}
                        maxLength={6}
                        minLength={6}
                        aria-label="رمز الدخول الجديد"
                        required
                        placeholder="••••••"
                        className="w-full max-w-xs mx-auto text-center p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all tracking-[0.5em] font-mono"
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button
                        type="submit"
                        disabled={isSavingAdminPin}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl flex items-center justify-center gap-4 active:scale-[0.98] transition-all outline-none cursor-pointer"
                      >
                        {isSavingAdminPin ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>جارٍ الحفظ...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-5 h-5 stroke-[3]" />
                            <span>{t('حفظ رمز الدخول')}</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewAdminPinValue('');
                          setAdminPinError('');
                          setAdminPinSuccess('');
                          setIsAdminPinVerified(false);
                        }}
                        className="px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-extrabold text-sm rounded-2xl transition-all cursor-pointer"
                      >
                        {t('رجوع')}
                      </button>
                    </div>
                    {adminPinError && (
                      <p role="alert" className="mt-4 text-center text-sm font-black text-red-500">
                        {adminPinError}
                      </p>
                    )}
                    {adminPinSuccess && (
                      <p role="status" className="mt-4 text-center text-sm font-black text-emerald-500">
                        {adminPinSuccess}
                      </p>
                    )}
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Plans Management Modal */}
      {showPlansModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80" onClick={() => setShowPlansModal(false)}>
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('إدارة خطط الاشتراكات الدوريّة')}</h2>
              </div>
              <button 
                onClick={() => setShowPlansModal(false)}
                className="w-10 h-10 bg-red-500 dark:bg-red-600 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-8 max-h-[70vh] overflow-y-auto custom-scrollbar-slate">
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                  const price = Number((form.elements.namedItem('price') as HTMLInputElement).value);
                  const durationDays = Number((form.elements.namedItem('durationDays') as HTMLInputElement).value) || 30;
                  const dailyCapacity = Number((form.elements.namedItem('dailyCapacity') as HTMLInputElement).value) || 100;
                  
                  try {
                    await firestoreService.addPackage({ 
                      name, 
                      price, 
                      durationDays, 
                      dailyCapacity, 
                      vehiclesCount: dailyCapacity 
                    });
                    form.reset();
                  } catch (err) {
                    console.error(err);
                  }
                }}
                className="mb-10 space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase pr-2">{t('اسم الباقة')}</label>
                    <input name="name" placeholder={t('باقة مميزة')} required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase pr-2">{t('السعر')}</label>
                    <input name="price" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="200" required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase pr-2">{t('مدة الاشتراك (أيام)')}</label>
                    <input name="durationDays" type="text" inputMode="numeric" pattern="[0-9]*" defaultValue="30" required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase pr-2">{t('السعة اليومية (سيارة/يوم)')}</label>
                    <input name="dailyCapacity" type="text" inputMode="numeric" pattern="[0-9]*" placeholder="100" defaultValue="100" required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-mono" />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-slate-900 dark:bg-emerald-600 text-white dark:text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-emerald-700 transition-all outline-none"
                >
                  {t('إضافة الباقة')}
                </button>
              </form>

              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">{t('الباقات الحالية')}</h3>
                {packages.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 transition-colors">
                    <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">{t('لا يوجد باقات')}</p>
                  </div>
                ) : (
                  packages.map(pkg => (
                    <div key={pkg.id} className="p-5 bg-white dark:bg-slate-800 border-2 border-slate-50 dark:border-slate-800 rounded-xl flex items-center justify-between group hover:border-emerald-500/20 dark:hover:border-emerald-500/30 transition-all">
                      <div className="flex-1">
                        <h4 className="font-black text-slate-900 dark:text-white text-base mb-2">{pkg.name}</h4>
                        <div className="flex items-center gap-4">
                          <div className="flex items-baseline gap-1 font-black">
                            <span className="text-lg text-emerald-500">{pkg.price}</span>
                            <span className="text-[10px] text-emerald-400">{t('ج.م')}</span>
                          </div>
                          <div className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="flex items-baseline gap-1 font-black">
                            <span className="text-sm text-slate-600 dark:text-slate-300">{pkg.vehiclesCount}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{t('سيارة')}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setConfirmDialog({
                            isOpen: true,
                            title: t('حذف باقة'),
                            message: adminLang === 'en' ? `Are you sure you want to delete package "${pkg.name}"?` : `هل أنت متأكد من حذف باقة "${pkg.name}"؟`,
                            confirmText: t('حذف'),
                            cancelText: t('تراجع'),
                            type: 'danger',
                            onConfirm: async () => {
                              try {
                                await firestoreService.deletePackage(pkg.id);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                              }
                            }
                          });
                        }}
                        className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center hover:bg-red-700 transition-all outline-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showOverview && (
        <div className="fixed inset-0 z-50 flex items-center justify-start sm:justify-center overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 p-4" onClick={() => setShowOverview(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl relative z-10 my-auto overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b-2 border-slate-50 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-20 transition-colors">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-900 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-white transition-colors">
                  <Shield className="w-6 h-6 stroke-[3]" />
                </div>
                {t('إدارة النظام والإحصائيات')}
              </h3>
              <button 
                onClick={() => setShowOverview(false)}
                className="w-10 h-10 bg-red-500 dark:bg-red-600 text-white rounded-xl flex shrink-0 items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[80dvh] overflow-y-auto custom-scrollbar-slate">
              {/* Add Garage Form Section */}
              <div className="transition-colors">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 rounded-xl flex items-center justify-center transition-colors">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{t('إضافة جراج جديد')}</h4>
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em] mt-0.5">{t('تسجيل جراج جديد وتحديد التعريفة')}</p>
                  </div>
                </div>

                <form 
                  onSubmit={async (e) => {
                    await handleAddGarage(e);
                    // Clear form on success
                    setGarageForm({ 
                      name: '', 
                      hourlyRate: '', 
                      overnightRate: '', 
                      phone: '', 
                      initialPackageId: '', 
                      hasMonthlySubscribers: false,
                      isTrial: false,
                      priceScope: 'new_only',
                      ownerPin: ''
                    });
                  }}
                  className="space-y-6"
                >
                  <div className="space-y-2 text-center">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-black">{t('اسم الجراج')}</label>
                    <input 
                      name="name" 
                      placeholder={t('اسم الجراج...')} 
                      value={garageForm.name}
                      onChange={(e) => setGarageForm({ ...garageForm, name: e.target.value })}
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-center focus:border-slate-900 dark:focus:border-emerald-500 outline-none text-lg transition-all" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2 text-center">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-black">{t('سعر الساعة')}</label>
                      <div className="relative">
                        <input 
                          name="hourlyRate" 
                          type="text" 
                          inputMode="numeric" 
                          placeholder="10" 
                          value={garageForm.hourlyRate}
                          onChange={(e) => setGarageForm({ ...garageForm, hourlyRate: e.target.value.replace(/\D/g, '') })}
                          required 
                          className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-center focus:border-slate-900 dark:focus:border-emerald-500 outline-none font-mono text-xl transition-all" 
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 dark:text-slate-600 font-bold">{t('ج.م')}</span>
                      </div>
                    </div>
                    <div className="space-y-2 text-center">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-black">{t('سعر المبيت')}</label>
                      <div className="relative">
                        <input 
                          name="overnightRate" 
                          type="text" 
                          inputMode="numeric" 
                          placeholder="50" 
                          value={garageForm.overnightRate}
                          onChange={(e) => setGarageForm({ ...garageForm, overnightRate: e.target.value.replace(/\D/g, '') })}
                          required 
                          className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-center focus:border-slate-900 dark:focus:border-emerald-500 outline-none font-mono text-xl transition-all" 
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 dark:text-slate-600 font-bold">{t('ج.م')}</span>
                      </div>
                    </div>
                  </div>

                  <input type="hidden" name="billingModel" value="subscription" />

                  {/* Subscription Package Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest text-center block font-black">{t('باقة الاشتراك الابتدائي')}</label>
                    <select 
                      name="initialPackageId" 
                      value={garageForm.initialPackageId}
                      onChange={(e) => setGarageForm({ ...garageForm, initialPackageId: e.target.value })}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 appearance-none text-center transition-all" 
                      dir="rtl"
                    >
                      <option value="">{t('اختر باقة الاشتراك النظامية')}</option>
                      {packages.map(pkg => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} - {pkg.price} {t('ج.م')} ({getCleanPackageInfo(pkg).isUnlimited ? 'سعة مفتوحة' : `${getCleanPackageInfo(pkg).dailyCapacity} سيارة/يوم`})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Monthly Subscribers Surcharge Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors">
                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 dark:text-white block">{t('يتضمن مشتركين شهريين / إيواء')}</span>
                      <span className="text-[10px] font-bold text-slate-400 block mt-0.5">{t('إضافة 500 ج.م ثابتة تلقائياً على سعر أية باقة/اشتراك')}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox"
                        name="hasMonthlySubscribers"
                        checked={garageForm.hasMonthlySubscribers}
                        onChange={(e) => setGarageForm({ ...garageForm, hasMonthlySubscribers: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                    </label>
                  </div>

                  {/* Price Scope Selector */}
                  <div className="space-y-2 text-right">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest block font-black">
                      {t('نطاق تطبيق السعر')}
                    </label>
                    <select
                      name="priceScope"
                      value={garageForm.priceScope}
                      onChange={(e) => setGarageForm({ ...garageForm, priceScope: e.target.value as 'new_only' | 'all' })}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 text-center transition-all"
                      dir="rtl"
                    >
                      <option value="new_only">{t('جراجات جديدة فقط')}</option>
                      <option value="all">{t('جميع الجراجات (بما فيها الحالية)')}</option>
                    </select>
                  </div>

                  {/* Free Trial Toggle */}
                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl transition-colors">
                    <div className="text-right">
                      <span className="text-xs font-black text-blue-950 dark:text-blue-200 block">{t('تفعيل فترة تجريبية مجانية (15 يوم)')}</span>
                      <span className="text-[10px] font-bold text-blue-500/80 block mt-0.5">{t('صلاحية مجانية لمدة 15 يوماً للجراج الجديد')}</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input 
                        type="checkbox"
                        name="isTrial"
                        checked={garageForm.isTrial}
                        onChange={(e) => setGarageForm({ ...garageForm, isTrial: e.target.checked })}
                        className="sr-only peer"
                      />
                      <input type="hidden" name="isTrial" value={garageForm.isTrial ? 'true' : 'false'} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest text-center block font-black">{t('رقم الموبايل (اختياري)')}</label>
                      <input 
                        name="phone" 
                        placeholder="01xxxxxxxxx" 
                        value={garageForm.phone}
                        onChange={(e) => setGarageForm({ ...garageForm, phone: e.target.value.replace(/\D/g, '') })}
                        className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-slate-900 dark:focus:border-emerald-500 outline-none font-mono font-bold tracking-wider text-center transition-all" 
                        dir="ltr" 
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest text-center block font-black">{t('رمز الدخول (PIN)')}</label>
                      <div className="relative">
                        <input 
                          name="pin" 
                          type="tel"
                          inputMode="numeric"
                          value={pinInput}
                          onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="123456" 
                          maxLength={6}
                          required 
                          className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-slate-900 dark:focus:border-emerald-500 outline-none font-mono font-bold tracking-[0.5em] text-center transition-all pl-14" 
                          dir="ltr" 
                        />
                        <button
                          type="button"
                          onClick={() => setPinInput(generateSafePin(allGarages.map(g => g.pin)))}
                          className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                          title={t('توليد رقم سري عشوائي')}
                        >
                          <RefreshCw className="w-5 h-5 mx-auto" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* الجراج المُرشِّح (اختياري) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest text-center block font-black">
                      {t('الجراج المُرشِّح / تمت الإحالة بواسطة (اختياري)')}
                    </label>
                    <select
                      name="referredByGarageId"
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 text-center transition-all"
                      dir="rtl"
                    >
                      <option value="">{t('بدون ترشيح / مباشر')}</option>
                      {allGarages.filter(g => g.status !== 'pending').map(g => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.phone || t('بدون هاتف')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-5 rounded-xl font-bold text-lg hover:bg-slate-800 dark:hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-4 mt-4 uppercase tracking-widest transition-all outline-none"
                  >
                    {isLoading ? <Spinner /> : (
                      <>
                        <Plus className="w-5 h-5" />
                        <span>{t('حفظ وإضافة الجراج')}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Package Validation Modal */}
      {packageValidationError?.isOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl overflow-hidden border border-red-100 dark:border-red-900 shadow-2xl">
            <div className="p-6">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-2xl flex items-center justify-center mb-5 mx-auto">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white text-center mb-2">
                تنبيه: تسعير غير منطقي
              </h3>
              <p className="text-sm font-bold text-red-600 dark:text-red-400 text-center mb-6 leading-relaxed bg-red-50 dark:bg-red-500/10 p-4 rounded-xl">
                {packageValidationError.message}
              </p>
              
              <div className="space-y-3 mb-8">
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">نقترح عليك أحد الحلول التالية:</h4>
                <ul className="space-y-2">
                  {packageValidationError.suggestions.map((sug, idx) => (
                    <li key={idx} className="flex items-start gap-4 text-sm font-bold text-slate-600 dark:text-slate-400">
                      <span className="text-emerald-500 mt-0.5"><Check className="w-4 h-4" /></span>
                      <span className="leading-relaxed">{sug}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => setPackageValidationError(null)}
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white font-black py-4 rounded-xl transition-all"
              >
                حسناً، سأقوم بالتعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80">
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 text-center">
              <div className={`w-20 h-20 mx-auto rounded-xl flex items-center justify-center mb-6 ${
                confirmDialog.type === 'danger' ? 'bg-red-50 text-red-600' : 
                confirmDialog.type === 'warning' ? 'bg-emerald-50 text-emerald-600' : 
                'bg-emerald-50 text-emerald-600'
              }`}>
                {confirmDialog.type === 'danger' ? <Trash2 className="w-10 h-10" /> : 
                 confirmDialog.type === 'warning' ? <RotateCcw className="w-10 h-10" /> : 
                 <Check className="w-10 h-10" />}
              </div>
              
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{confirmDialog.title}</h3>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                {confirmDialog.message}
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all outline-none"
                >
                  {confirmDialog.cancelText || 'إلغاء'}
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className={`flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all outline-none ${
                    confirmDialog.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 
                    confirmDialog.type === 'warning' ? 'bg-emerald-600 hover:bg-emerald-700' : 
                    'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {confirmDialog.confirmText || 'تأكيد'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appearance Settings Modal */}
      {showAppearanceSettings && (
        <AppearanceSettingsModal 
          onClose={() => setShowAppearanceSettings(false)}
          adminColor={adminColor}
          onUpdateAdminColor={(color) => setAdminColor(color)}
        />
      )}
    </div>
  );
});
