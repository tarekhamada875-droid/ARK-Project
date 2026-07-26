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
  Phone, 
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
  Loader2,
  Building2,
  Wallet,
  LogOut,
  Sliders
} from 'lucide-react';
import { Garage, Delegate, Package, RechargeRequest, Supervisor, GeneralManager } from '../../types';
import { Spinner } from '../ui/Spinner';
import { firestoreService } from '../../services/firestoreService';
import { AppearanceSettingsModal } from '../modals/AppearanceSettingsModal';
import { soundManager } from '../../utils/sounds';
import { useTheme } from '../../utils/ThemeContext';
import { useAdminTranslation } from '../../utils/adminTranslations';
import { generateSafePin, normalizeArabicSearch } from '../../utils';
import { useLocalStorageState } from '../../hooks/useLocalStorage';
import { AdminReportsView } from './AdminReportsView';

interface AdminDashboardProps {
  allGarages: Garage[];
  isLoading: boolean;
  createNewGarage: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  setView: (view: any) => void;
  setSelectedGarageForDetails: (garage: Garage | null) => void;
  setSelectedDelegateForDetails: (delegate: Delegate | null) => void;
  delegates: Delegate[];
  addDelegate: (data: Omit<Delegate, 'id'>) => Promise<any>;
  packages: Package[];
  onLogout: () => void;
  rechargeRequests: RechargeRequest[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  // Supervisor addition
  currentSupervisor?: Supervisor | null;
  supervisors?: Supervisor[];
  generalManagers?: GeneralManager[];
  currentAdminPin: string;
  currentWalletNumber: string;
  onUpdateWalletNumber: (wallet: string) => Promise<void>;
  subscriptionPrices?: { weekly: number; monthly: number };
}

export const AdminDashboard = memo(({
  allGarages,
  isLoading,
  createNewGarage,
  setView,
  setSelectedGarageForDetails,
  setSelectedDelegateForDetails,
  delegates,
  addDelegate,
  packages,
  onLogout,
  rechargeRequests,
  showToast,
  currentSupervisor = null,
  supervisors = [],
  generalManagers = [],
  currentAdminPin,
  currentWalletNumber,
  onUpdateWalletNumber,
  subscriptionPrices = { weekly: 800, monthly: 3000 }
}: AdminDashboardProps) => {

  // Localized states to encapsulate admin view and prevent global App re-renders
  const [adminSearch, setAdminSearch] = React.useState<string>('');
  const [activeTab, setActiveTab] = useLocalStorageState<'menu' | 'garages' | 'packages' | 'delegates' | 'requests' | 'reports' | 'supervisors' | 'general_managers' | 'wallet' | 'admin-pin'>('app_admin_tab', 'menu');
  const [showPlansModal, setShowPlansModal] = useLocalStorageState<boolean>('app_admin_plans_modal', false);
  const [showOverview, setShowOverview] = useLocalStorageState<boolean>('app_admin_overview', false);
  const [pinInput, setPinInput] = React.useState<string>('');
  const [delegateForm, setDelegateForm] = React.useState<{ name: string; phone: string; pin: string; canCreateGarage: boolean }>({ 
    name: '', 
    phone: '', 
    pin: '', 
    canCreateGarage: false 
  });
  const [adminSupervisorForm, setAdminSupervisorForm] = React.useState<{ name: string; phone: string; pin: string }>({
    name: '',
    phone: '',
    pin: ''
  });
  const [adminGeneralManagerForm, setAdminGeneralManagerForm] = React.useState<{ name: string; phone: string; pin: string; selectedGarages: string[] }>({
    name: '',
    phone: '',
    pin: '',
    selectedGarages: []
  });
  const [isSubmittingGeneralManager, setIsSubmittingGeneralManager] = React.useState(false);
  const [editingGeneralManagerPinId, setEditingGeneralManagerPinId] = React.useState<string | null>(null);
  const [editingGeneralManagerPinValue, setEditingGeneralManagerPinValue] = React.useState<string>('');
  const [isUpdatingGeneralManagerPin, setIsUpdatingGeneralManagerPin] = React.useState<boolean>(false);
  const [garageForm, setGarageForm] = React.useState<{ name: string; hourlyRate: string; overnightRate: string; phone: string; initialPackageId: string; billingModel: 'commission' | 'subscription'; subscriptionType: 'weekly' | 'monthly' }>({
    name: '',
    hourlyRate: '',
    overnightRate: '',
    phone: '',
    initialPackageId: '',
    billingModel: 'commission',
    subscriptionType: 'weekly'
  });

  const [editingSupervisorPinId, setEditingSupervisorPinId] = React.useState<string | null>(null);
  const [editingSupervisorPinValue, setEditingSupervisorPinValue] = React.useState<string>('');
  const [isUpdatingSupervisorPin, setIsUpdatingSupervisorPin] = React.useState<boolean>(false);

  const [isSubmittingDelegate, setIsSubmittingDelegate] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showAppearanceSettings, setShowAppearanceSettings] = React.useState(false);
  const [adminColor, setAdminColor] = useLocalStorageState<string>('app_admin_color', '#10b981');
  
  const [isSavingAdminPin, setIsSavingAdminPin] = React.useState(false);
  const [isAdminPinVerified, setIsAdminPinVerified] = React.useState(false);
  const [currentPinAttempt, setCurrentPinAttempt] = React.useState('');
  const [newAdminPinValue, setNewAdminPinValue] = React.useState('');

  React.useEffect(() => {
    if (activeTab !== 'admin-pin') {
      setIsAdminPinVerified(false);
      setCurrentPinAttempt('');
      setNewAdminPinValue('');
    }
  }, [activeTab]);

  const [walletValue, setWalletValue] = React.useState(currentWalletNumber);
  const [isSavingWallet, setIsSavingWallet] = React.useState(false);

  React.useEffect(() => {
    setWalletValue(currentWalletNumber);
  }, [currentWalletNumber]);
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
  const { adminLang, setAdminLang } = useTheme();
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
      message: `هل أنت متأكد من تفعيل شحن رصيد جراج "${request.garageName}" بمقدار ${request.carsCount} سيارة؟`,
      confirmText: 'تفعيل الآن',
      cancelText: 'تراجع',
      type: 'success',
      onConfirm: async () => {
        try {
          await firestoreService.approveRechargeRequest(request);
          soundManager.play('checkIn');
          showToast(`تم شحن رصيد ${request.garageName} بنجاح`);
        } catch (error) {
          console.error('Failed to approve request:', error);
          let msg = 'فشل تفعيل الشحن';
          if (error instanceof Error) {
            try {
              const obj = JSON.parse(error.message);
              // If there's a nested error message like "FirebaseError: Missing or insufficient permissions"
              msg += `: ${obj.error || error.message}`;
            } catch {
              msg += `: ${error.message}`;
            }
          }
          showToast(msg, 'error');
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  const handleRejectRequest = async (requestId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'رفض طلب الشحن',
      message: 'هل أنت متأكد من رفض هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.',
      confirmText: 'نعم، ارفض الطلب',
      cancelText: 'إلغاء',
      type: 'danger',
      onConfirm: async () => {
        try {
          await firestoreService.rejectRechargeRequest(requestId);
          showToast('تم رفض الطلب بنجاح');
        } catch (error) {
          console.error('Failed to reject request:', error);
          showToast('فشل رفض الطلب', 'error');
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
          showToast(`تم قبول وتفعيل جراج "${garage.name}" بنجاح`);
        } catch (error) {
          console.error('Failed to approve garage:', error);
          showToast('فشل قبول وتفعيل الجراج', 'error');
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
          showToast(`تم رفض وحذف الطلب بنجاح`);
        } catch (error) {
          console.error('Failed to reject garage:', error);
          showToast('فشل رفض الطلب', 'error');
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

  const handleCreateDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateForm.name || !delegateForm.phone || !delegateForm.pin) {
      showToast('يرجى إكمال جميع الحقول المطلوبة', 'error');
      return;
    }
    
    if (delegateForm.phone.length < 10) {
      showToast('رقم الموبايل يجب أن يكون 10 أرقام على الأقل', 'error');
      return;
    }

    if (delegateForm.pin.length < 4) {
      showToast('رمز الدخول يجب أن يكون 4 أرقام على الأقل', 'error');
      return;
    }

    setIsSubmittingDelegate(true);
    try {
      const pinCheck = await firestoreService.isPinTaken(delegateForm.pin);
      if (pinCheck.taken) {
        showToast(`هذا الرمز السري (PIN) مستخدم بالفعل في حساب آخر: (${pinCheck.name} - ${pinCheck.role})`, 'error');
        setIsSubmittingDelegate(false);
        return;
      }
      await addDelegate({
        ...delegateForm,
        role: 'delegate',
        createdAt: new Date(),
      });
      setDelegateForm({ 
        name: '', 
        phone: '', 
        pin: '', 
        canCreateGarage: false 
      });
      showToast('تم إضافة المندوب بنجاح');
    } catch (error) {
      console.error('Failed to add delegate:', error);
      showToast('حدث خطأ أثناء إضافة المندوب', 'error');
    } finally {
      setIsSubmittingDelegate(false);
    }
  };

  const [isSubmittingSupervisor, setIsSubmittingSupervisor] = React.useState(false);

  const handleCreateSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = (adminSupervisorForm?.name || '').trim();
    const cleanPhone = (adminSupervisorForm?.phone || '').replace(/\D/g, '');
    const cleanPin = (adminSupervisorForm?.pin || '').replace(/\D/g, '');

    if (!cleanName || !cleanPhone || !cleanPin) {
      showToast('يرجى إكمال جميع الحقول المطلوبة بشكل صحيح', 'error');
      return;
    }
    
    if (cleanPhone.length < 10) {
      showToast('رقم الموبايل يجب أن يكون 10 أرقام على الأقل', 'error');
      return;
    }

    if (cleanPin.length < 4) {
      showToast('رمز الدخول يجب أن يكون 4 أرقام على الأقل', 'error');
      return;
    }

    setIsSubmittingSupervisor(true);
    try {
      const pinCheck = await firestoreService.isPinTaken(cleanPin);
      if (pinCheck.taken) {
        showToast(`هذا الرمز السري (PIN) مستخدم بالفعل في حساب آخر: (${pinCheck.name} - ${pinCheck.role})`, 'error');
        setIsSubmittingSupervisor(false);
        return;
      }
      await firestoreService.addSupervisor({
        name: cleanName,
        phone: cleanPhone,
        pin: cleanPin,
        role: 'supervisor',
        createdAt: new Date(),
      } as Omit<Supervisor, 'id'>);
      
      if (setAdminSupervisorForm) {
        setAdminSupervisorForm({ 
          name: '', 
          phone: '', 
          pin: '' 
        });
      }
      showToast('تم إضافة المشرف بنجاح');
    } catch (error: any) {
      console.error('Failed to add supervisor:', error);
      const errMsg = error?.message || String(error);
      showToast('حدث خطأ أثناء إضافة المشرف: ' + errMsg, 'error');
    } finally {
      setIsSubmittingSupervisor(false);
    }
  };

  const handleCreateGeneralManager = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = (adminGeneralManagerForm?.name || '').trim();
    const cleanPhone = (adminGeneralManagerForm?.phone || '').replace(/\D/g, '');
    const cleanPin = (adminGeneralManagerForm?.pin || '').replace(/\D/g, '');
    const cleanGarages = adminGeneralManagerForm?.selectedGarages || [];

    if (!cleanName || !cleanPhone || !cleanPin) {
      showToast('يرجى إكمال جميع الحقول المطلوبة بشكل صحيح', 'error');
      return;
    }
    
    if (cleanPhone.length < 10) {
      showToast('رقم الموبايل يجب أن يكون 10 أرقام على الأقل', 'error');
      return;
    }

    if (cleanPin.length < 4) {
      showToast('رمز الدخول يجب أن يكون 4 أرقام على الأقل', 'error');
      return;
    }

    if (cleanGarages.length === 0) {
      showToast('يرجى اختيار جراج واحد على الأقل للمدير العام', 'error');
      return;
    }

    setIsSubmittingGeneralManager(true);
    try {
      const pinCheck = await firestoreService.isPinTaken(cleanPin);
      if (pinCheck.taken) {
        showToast(`هذا الرمز السري (PIN) مستخدم بالفعل في حساب آخر: (${pinCheck.name} - ${pinCheck.role})`, 'error');
        setIsSubmittingGeneralManager(false);
        return;
      }
      await firestoreService.addGeneralManager({
        name: cleanName,
        phone: cleanPhone,
        pin: cleanPin,
        garageIds: cleanGarages,
        role: 'general_manager',
        createdAt: new Date(),
      } as Omit<GeneralManager, 'id'>);
      
      setAdminGeneralManagerForm({ 
        name: '', 
        phone: '', 
        pin: '',
        selectedGarages: []
      });
      showToast('تم إضافة المدير العام بنجاح');
    } catch (error: any) {
      console.error('Failed to add general manager:', error);
      const errMsg = error?.message || String(error);
      showToast('حدث خطأ أثناء إضافة المدير العام: ' + errMsg, 'error');
    } finally {
      setIsSubmittingGeneralManager(false);
    }
  };

  const toggleGarageSelection = (garageId: string) => {
    setAdminGeneralManagerForm(prev => {
      const alreadySelected = prev.selectedGarages.includes(garageId);
      const updated = alreadySelected
        ? prev.selectedGarages.filter(id => id !== garageId)
        : [...prev.selectedGarages, garageId];
      return { ...prev, selectedGarages: updated };
    });
  };

  const handleAddGarage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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

  const filteredGarages = React.useMemo(() => {
    const q = normalizeArabicSearch(adminSearch);
    if (!q) return approvedGarages;
    return approvedGarages.filter(g => {
      const normalizedName = normalizeArabicSearch(g.name);
      const phoneMatch = (g.phone || '').includes(adminSearch);
      return normalizedName.includes(q) || phoneMatch;
    });
  }, [approvedGarages, adminSearch]);

  const totalAdminRevenue = React.useMemo(() => {
    return approvedGarages.reduce((sum, g) => sum + (g.totalAdminRevenue || 0), 0);
  }, [approvedGarages]);

  return (
    <div className={`admin-custom-theme h-[100dvh] w-full bg-[#faf9f6] dark:bg-slate-950 font-sans relative text-slate-900 dark:text-slate-100 transition-colors overflow-hidden flex flex-col`} dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
      <style>{`
        .admin-custom-theme .text-emerald-500,
        .admin-custom-theme .text-emerald-550,
        .admin-custom-theme .text-emerald-600,
        .admin-custom-theme .text-emerald-700,
        .admin-custom-theme .dark\\:text-emerald-400,
        .admin-custom-theme .text-emerald-450 {
          color: ${adminColor} !important;
        }
        .admin-custom-theme .bg-emerald-600,
        .admin-custom-theme .bg-emerald-500,
        .admin-custom-theme .dark\\:bg-emerald-600,
        .admin-custom-theme .dark\\:bg-emerald-500 {
          background-color: ${adminColor} !important;
        }
        .admin-custom-theme .hover\\:bg-emerald-700:hover,
        .admin-custom-theme .bg-emerald-600:hover,
        .admin-custom-theme .bg-emerald-500:hover,
        .admin-custom-theme .dark\\:bg-emerald-600:hover,
        .admin-custom-theme .dark\\:bg-emerald-500:hover {
          background-color: ${adminColor}e6 !important;
          opacity: 0.95;
        }
        .admin-custom-theme .bg-emerald-50,
        .admin-custom-theme .bg-emerald-50\\/30,
        .admin-custom-theme .bg-emerald-50\\/50,
        .admin-custom-theme .bg-emerald-100,
        .admin-custom-theme .dark\\:bg-emerald-950\\/40,
        .admin-custom-theme .dark\\:bg-emerald-950\\/45,
        .admin-custom-theme .dark\\:bg-emerald-950\\/10 {
          background-color: ${adminColor}15 !important;
        }
        .admin-custom-theme .bg-emerald-400\\/10,
        .admin-custom-theme .dark\\:bg-emerald-400\\/5,
        .admin-custom-theme .bg-emerald-50\\/50 {
          background-color: ${adminColor}1a !important;
        }
        .admin-custom-theme .border-emerald-500,
        .admin-custom-theme .border-emerald-600,
        .admin-custom-theme .border-emerald-400,
        .admin-custom-theme .border-emerald-300,
        .admin-custom-theme .border-emerald-100,
        .admin-custom-theme .dark\\:border-emerald-700\\/80,
        .admin-custom-theme .dark\\:border-emerald-900\\/50 {
          border-color: ${adminColor}80 !important;
        }
        .admin-custom-theme .border-emerald-500\\/20,
        .admin-custom-theme .border-emerald-400\\/10 {
          border-color: ${adminColor}20 !important;
        }
        .admin-custom-theme .focus\\:border-emerald-500:focus,
        .admin-custom-theme .focus\\:border-emerald-400:focus {
          border-color: ${adminColor} !important;
        }
        .admin-custom-theme .focus\\:ring-emerald-500:focus,
        .admin-custom-theme .focus\\:ring-emerald-400:focus,
        .admin-custom-theme .dark\\:focus\\:ring-emerald-500:focus {
          --tw-ring-color: ${adminColor} !important;
          border-color: ${adminColor} !important;
        }
        .admin-custom-theme .shadow-emerald-500\\/5 {
          --tw-shadow-color: ${adminColor}1a !important;
          --tw-shadow: 0 4px 6px -1px var(--tw-shadow-color), 0 2px 4px -1px var(--tw-shadow-color) !important;
        }
        .admin-custom-theme .from-emerald-500\\/5 {
          --tw-gradient-from: ${adminColor}0d !important;
          --tw-gradient-to: transparent !important;
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
        }
        .admin-custom-theme .dark\\:from-emerald-500\\/5 {
          --tw-gradient-from: ${adminColor}0d !important;
          --tw-gradient-to: transparent !important;
          --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
        }
      `}</style>
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 transition-colors w-full shrink-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
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
                className="flex items-center justify-center w-10 h-10 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/80 outline-none cursor-pointer transition-colors shadow-sm shadow-emerald-500/5"
                title={t('رجوع')}
              >
                <ChevronRight className={`w-5.5 h-5.5 text-emerald-600 dark:text-emerald-400 stroke-[3.5] ${adminLang === 'en' ? 'rotate-180' : ''}`} />
              </button>
            )}
            <div className="hidden sm:flex w-10 h-10 bg-slate-900 dark:bg-slate-800 rounded-xl items-center justify-center text-white">
              <Shield className="w-6 h-6 stroke-[3]" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight leading-tight">
              {activeTab === 'menu' ? t('لوحة تحكم النظام') : (
                activeTab === 'garages' ? t('الجراجات') :
                activeTab === 'packages' ? t('إدارة الباقات') :
                activeTab === 'delegates' ? t('المندوبين') :
                activeTab === 'requests' ? t('الطلبات والمراجعات') :
                activeTab === 'reports' ? t('التقارير الذكية') :
                activeTab === 'supervisors' ? t('المشرفين') :
                activeTab === 'general_managers' ? t('المديرين العموم') :
                activeTab === 'wallet' ? t('رقم المحفظة') :
                activeTab === 'admin-pin' ? t('تعديل رمز دخول الآدمن') : t('لوحة تحكم النظام')
              )}
            </h1>
          </div>
          <div className="flex items-center gap-2 relative" ref={menuRef}>
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
                  className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/70 backdrop-blur-sm z-50 pointer-events-auto"
                />
                
                <div 
                  className={`fixed top-3 bottom-3 ${adminLang === 'en' ? 'right-3' : 'left-3'} w-[290px] xs:w-[330px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/80 z-50 flex flex-col overflow-hidden pointer-events-auto`}
                  dir={adminLang === 'en' ? 'ltr' : 'rtl'}
                >
                  {/* Drawer Header - Clean Profile Box */}
                  <div className="p-5 pb-4 border-b border-slate-100 dark:border-slate-800/60 font-sans">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-500 dark:bg-emerald-600 flex items-center justify-center text-white font-extrabold AN_ELEMENT_ID_HERE">
                          <Shield className="w-6 h-6" />
                        </div>
                        <div className={`flex flex-col ${adminLang === 'en' ? 'text-left' : 'text-right'}`}>
                          <span className="text-sm font-black text-slate-900 dark:text-slate-100 truncate max-w-[150px]">
                            {currentSupervisor ? currentSupervisor.name : t('مالك النظام')}
                          </span>
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-wider">
                            {currentSupervisor ? t('مشرف نظام') : t('مسؤول النظام')}
                          </span>
                        </div>
                      </div>
                      
                      <button 
                        type="button"
                        onClick={() => setShowMenu(false)}
                        className="w-10 h-10 bg-red-500 dark:bg-red-600 text-white rounded-xl flex items-center justify-center hover:bg-red-600 dark:hover:bg-red-700 transition-colors outline-none"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Content Area */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar-slate font-sans">


                    {/* Display Language Selection */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/40">
                      <div className="flex flex-col gap-2">
                        <span className="font-bold text-xs text-slate-400 dark:text-slate-500 pr-1 select-none">
                          {currentSupervisor ? t('لغة العرض:') : t('لغة العرض (الآدمن فقط):')}
                        </span>
                        <div className="flex gap-3">
                          {/* Arabic Button */}
                          <button 
                            type="button"
                            onClick={() => {
                              setAdminLang('ar');
                              setShowMenu(false);
                            }}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all outline-none font-bold text-sm cursor-pointer ${
                              adminLang === 'ar'
                                ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.02]'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 transition-all outline-none font-bold text-sm cursor-pointer ${
                              adminLang === 'en'
                                ? 'bg-emerald-600 border-emerald-600 text-white scale-[1.02]'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span>{t('English')}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Appearance Settings Button */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/40">
                      <button 
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          setShowAppearanceSettings(true);
                        }}
                        className="w-full flex items-center justify-between p-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-850 dark:text-slate-200 rounded-xl border-2 border-slate-100 dark:border-slate-800 transition-all outline-none cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-400/10 text-indigo-500 flex items-center justify-center">
                            <Sliders className="w-4 h-4 text-indigo-500" />
                          </div>
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{t('إعدادات المظهر')}</span>
                        </div>
                      </button>
                    </div>



                    {/* Logout Button */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/40">
                      <button 
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          onLogout();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-red-200/50 dark:border-red-900/30 bg-red-50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/40 text-red-650 dark:text-red-400 font-bold text-sm transition-all outline-none cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 stroke-[2.5]" />
                        <span>{t('تسجيل الخروج')}</span>
                      </button>
                    </div>
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
          {activeTab === 'menu' ? (
            <div className="flex flex-col gap-10 md:gap-14 pt-4 md:pt-6 pb-8">
              {/* Premium Quranic Verse Manuscript Section */}
              <div className="w-full text-center px-6 py-10 md:py-14 bg-[#fdfbf7] dark:bg-[#0c0d0e] border-2 border-double border-amber-600/30 dark:border-amber-400/15 rounded-xl relative overflow-hidden transition-all shadow-sm">
                {/* Spiritual Glowing/Pattern Accents */}
                <div className="absolute inset-0 bg-radial-gradient from-amber-500/5 dark:from-emerald-500/5 via-transparent to-transparent opacity-80 pointer-events-none" />
                
                {/* Traditional Side Ornaments for Visual Framing */}
                <div className="absolute top-3 bottom-3 right-3 left-3 border border-dashed border-amber-500/10 dark:border-amber-400/5 rounded-2xl pointer-events-none" />
                
                {/* Top Islamic Geometric Ornament accent */}
                <div className="flex items-center justify-center gap-4 text-amber-600/50 dark:text-amber-400/40 mb-4 select-none">
                  <span className="text-xs">─── ❖ ───</span>
                  <span className="text-lg md:text-xl">۩</span>
                  <span className="text-xs">─── ❖ ───</span>
                </div>

                {/* Holy Text Container with Amiri Font */}
                <div className="max-w-4xl mx-auto px-2 relative z-10 text-center">
                  <p className="font-serif text-[18px] sm:text-[22px] md:text-[28px] lg:text-[34px] text-emerald-950 dark:text-[#faf9f6] font-extrabold leading-[2.2] sm:leading-[2.5] text-balance transition-colors select-none" dir="rtl">
                    ﴿ إِنَّا فَتَحْنَا لَكَ فَتْحًا مُبِينًا <span className="text-amber-600 dark:text-amber-500/90 font-serif font-black mx-1 inline-block drop-shadow-sm">﴿١﴾</span> لِيَغْفِرَ لَكَ اللَّهُ مَا تَقَدَّمَ مِنْ ذَنْبِكَ وَمَا تَأَخَّرَ وَيُتِمَّ نِعْمَتَهُ عَلَيْكَ وَيَهْدِيَكَ صِرَاطًا مُسْتَقِيمًا <span className="text-amber-600 dark:text-amber-500/90 font-serif font-black mx-1 inline-block drop-shadow-sm">﴿٢﴾</span> وَيَنْصُرَكَ اللَّهُ نَصْرًا عَزِيزًا <span className="text-amber-600 dark:text-amber-500/90 font-serif font-black mx-1 inline-block drop-shadow-sm">﴿٣﴾ ﴾</span>
                  </p>
                </div>

                {/* Bottom Islamic Geometric Ornament accent */}
                <div className="flex items-center justify-center gap-4 text-amber-600/50 dark:text-amber-400/40 mt-5 select-none">
                  <span className="text-xs">─── ❖ ───</span>
                  <span className="text-sm">❖</span>
                  <span className="text-xs">─── ❖ ───</span>
                </div>
              </div>

              {/* Grid of Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {/* Card 1: Garages */}
            <div 
              onClick={() => setActiveTab('garages')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
            >
              <div className="flex items-center justify-between relative z-10">
                <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('الجراجات')}</h3>
                <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 px-3 py-1 bg-slate-150/60 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 rounded-lg shrink-0">
                  {approvedGarages.length} {t('جراج مسجل')}
                </span>
              </div>
            </div>

            {/* Card 2: Packages (إدارة الباقات) - Only for Super Admin */}
            {!currentSupervisor && (
              <div 
                onClick={() => setActiveTab('packages')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('إدارة الباقات')}</h3>
                  <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 px-3 py-1 bg-slate-150/60 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 rounded-lg shrink-0">
                    {packages.length} {t('باقة شحن')}
                  </span>
                </div>
              </div>
            )}

            {/* Card 3: Delegates */}
            <div 
              onClick={() => setActiveTab('delegates')}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
            >
              <div className="flex items-center justify-between relative z-10">
                <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('المندوبين')}</h3>
                <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 px-3 py-1 bg-slate-150/60 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 rounded-lg shrink-0">
                  {delegates.length} {t('مندوب معتمد')}
                </span>
              </div>
            </div>

            {/* Card 4: Recharge Requests & Garage Approvals - Only for Super Admin */}
            {!currentSupervisor && (
              <div 
                onClick={() => setActiveTab('requests')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('الطلبات والمراجعات')}</h3>
                  <div className="flex flex-wrap gap-1.5 justify-end shrink-0">
                    {rechargeRequests.length > 0 && (
                      <span className="text-[10px] font-black text-white px-2.5 py-1 bg-red-650 rounded-lg shrink-0">
                        {rechargeRequests.length} {t('معلق شحن')}
                      </span>
                    )}
                    {pendingGarages.length > 0 && (
                      <span className="text-[10px] font-black text-white px-2.5 py-1 bg-slate-600 rounded-lg shrink-0">
                        {pendingGarages.length} {t('انتظار موافقة')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Card 5: Reports (التقارير الذكية) - Only for Super Admin */}
            {!currentSupervisor && (
              <div 
                onClick={() => setActiveTab('reports')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('التقارير الذكية')}</h3>
                  <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 px-3 py-1 bg-slate-150/65 dark:bg-slate-800/65 border border-slate-200/30 dark:border-slate-700/30 rounded-lg shrink-0">
                    {t('رؤية حية')}
                  </span>
                </div>
              </div>
            )}

            {/* Card 6: Supervisors (المشرفين) - Only for Super Admin */}
            {!currentSupervisor && (
              <div 
                onClick={() => setActiveTab('supervisors')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('المشرفين')}</h3>
                  <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 px-3 py-1 bg-slate-150/60 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 rounded-lg shrink-0">
                    {supervisors.length} {t('مشرف')}
                  </span>
                </div>
              </div>
            )}

            {/* Card 6.5: General Managers (المديرين العموم) - Only for Super Admin */}
            {!currentSupervisor && (
              <div 
                onClick={() => setActiveTab('general_managers')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('المديرين العموم')}</h3>
                  <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 px-3 py-1 bg-slate-150/60 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 rounded-lg shrink-0">
                    {generalManagers.length} {t('مدير عام')}
                  </span>
                </div>
              </div>
            )}

            {/* Card 7: Wallet Setting - Only for Super Admin */}
            {!currentSupervisor && (
              <div 
                onClick={() => setActiveTab('wallet')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('رقم المحفظة')}</h3>
                  <span className="text-[10px] font-bold text-slate-550 dark:text-slate-400 px-3 py-1 bg-slate-150/60 dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 rounded-lg max-w-[130px] truncate shrink-0" dir="ltr">
                    {currentWalletNumber}
                  </span>
                </div>
              </div>
            )}

            {/* Card 8: Admin Passcode Setting - Only for Super Admin */}
            {!currentSupervisor && (
              <div 
                onClick={() => setActiveTab('admin-pin')}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 hover:border-slate-400 dark:hover:border-slate-700/80 p-6 rounded-2xl cursor-pointer flex flex-col justify-center h-[100px] group relative overflow-hidden transition-colors"
              >
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="font-black text-slate-900 dark:text-white text-base leading-none">{t('رمز دخول الآدمن')}</h3>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <Key className="w-4.5 h-4.5" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        ) : activeTab === 'garages' ? (
          <div className="grid grid-cols-1 gap-6">
            {/* Add Garage Button */}
            <button
              onClick={() => {
                setPinInput('');
                setShowOverview(true);
              }}
              className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 hover:opacity-90 transition-all outline-none active:scale-[0.98]"
            >
              <Plus className="w-5 h-5 stroke-[3]" />
              <span>{t('إضافة جراج جديد')}</span>
            </button>

            <section className="w-full">
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
                  <div className={`flex flex-col sm:flex-row justify-between items-center gap-4 ${adminLang === 'en' ? 'sm:flex-row-reverse' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{t('قائمة الجراجات')}</span>
                      <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">({approvedGarages.length})</span>
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

                  {!currentSupervisor && (
                    <div className="grid grid-cols-1">
                      <div className="bg-emerald-50/50 dark:bg-emerald-400/5 p-2.5 rounded-xl border border-emerald-100/50 dark:border-emerald-400/10 flex flex-col items-center justify-center text-center">
                        <div className="text-sm font-black text-emerald-500 font-mono">
                          {Number(totalAdminRevenue).toFixed(0)}
                        </div>
                        <p className="text-[8px] font-bold text-emerald-550 dark:text-emerald-400/60 uppercase tracking-tight">{t('إجمالي الدخل')}</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-6 grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[300px]">
                  {filteredGarages.map((g) => {
                    return (
                      <div 
                        key={g.id} 
                        onClick={() => {
                          if (currentSupervisor) return;
                          setSelectedGarageForDetails(g);
                          setView('admin_garage_details');
                        }}
                        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col justify-between h-36 overflow-hidden transition-colors ${
                          currentSupervisor 
                            ? 'cursor-default select-none' 
                            : 'hover:border-slate-400 dark:hover:border-slate-700 cursor-pointer group'
                        }`}
                      >
                        {/* Elegant Flat Slate Header */}
                        <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-4 py-3 text-center border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-center">
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-center text-xs sm:text-sm truncate leading-none w-full">
                            {g.name}
                          </h3>
                        </div>

                        {/* Card Body */}
                        <div className="flex-1 flex flex-col items-center justify-center p-4 relative bg-slate-50/20 dark:bg-slate-900/10">
                          <Car className={`w-8 h-8 text-slate-300 dark:text-slate-600 transition-colors ${
                            currentSupervisor ? '' : 'group-hover:text-slate-600 dark:group-hover:text-slate-400'
                          }`} />
                          
                          {g.isLocked && (
                            <div className="absolute bottom-2 inset-x-2 text-center">
                              <span className="inline-block text-[8px] font-black px-2.5 py-0.5 rounded-full bg-red-500/10 dark:bg-red-500/25 text-red-650 dark:text-red-400 border border-red-500/20 uppercase tracking-widest leading-none">
                                {t('مغلق')}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'delegates' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-8 transition-colors">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-white" />
                  </div>
                  {t('إضافة مندوب جديد')}
                </h2>
                <form onSubmit={handleCreateDelegate} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('اسم المندوب')}</label>
                    <input 
                      value={delegateForm.name}
                      onChange={(e) => setDelegateForm({...delegateForm, name: e.target.value})}
                      placeholder={t('الاسم الثلاثي...')} 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('رقم الموبايل')}</label>
                    <input 
                      value={delegateForm.phone}
                      onChange={(e) => setDelegateForm({...delegateForm, phone: e.target.value})}
                      placeholder="01xxxxxxxxx" 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('رمز الدخول (6 أرقام)')}</label>
                    <div className="relative">
                      <input 
                        type="tel"
                        inputMode="numeric"
                        value={delegateForm.pin}
                        onChange={(e) => setDelegateForm({...delegateForm, pin: e.target.value.replace(/\D/g, '')})}
                        placeholder="••••••" 
                        maxLength={6}
                        required 
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold text-center tracking-[0.5em] transition-all px-14" 
                      />
                      <button
                        type="button"
                        onClick={() => setDelegateForm({...delegateForm, pin: generateSafePin(delegates.map(d => d.pin))})}
                        className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-900 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                        title={t('توليد رقم سري عشوائي')}
                      >
                        <RefreshCw className="w-5 h-5 mx-auto" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2 mb-3 block">{t('صلاحيات المندوب')}</label>
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        type="button"
                        onClick={() => setDelegateForm({...delegateForm, canCreateGarage: !delegateForm.canCreateGarage})}
                        className={`p-4 rounded-2xl border-2 flex items-center justify-between group transition-all outline-none ${
                          delegateForm.canCreateGarage 
                            ? 'bg-emerald-50 dark:bg-emerald-400/5 border-emerald-500 dark:border-emerald-400 text-emerald-700 dark:text-emerald-400' 
                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                            delegateForm.canCreateGarage ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-900 text-slate-400 dark:text-slate-600'
                          }`}>
                            <Plus className="w-5 h-5" />
                          </div>
                          <span className="font-bold text-sm">{t('السماح بإنشاء جراجات جديدة')}</span>
                        </div>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                          delegateForm.canCreateGarage ? 'bg-emerald-500 text-white' : 'bg-slate-100/50 dark:bg-slate-900/50 text-slate-400 dark:text-slate-600'
                        }`}>
                          <Shield className="w-4 h-4" />
                        </div>
                      </button>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isSubmittingDelegate}
                    className="w-full bg-emerald-600 dark:bg-emerald-500 text-white py-5 rounded-2xl font-bold text-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 flex items-center justify-center gap-3 mt-4 transition-all outline-none"
                  >
                    {isSubmittingDelegate ? <Spinner /> : (
                      <>
                        <Plus className="w-6 h-6" />
                        <span>{t('منح صلاحية مندوب')}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </section>

            <section className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="p-8 border-b-2 border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 transition-colors">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border-2 border-slate-200 dark:border-slate-800 transition-colors">
                      <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    {t('قائمة المندوبين المعتمدين')}
                    <span className="text-slate-300 dark:text-slate-600 text-sm font-bold mr-2">({delegates.length})</span>
                  </h2>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                    {delegates.map((d) => (
                      <div 
                        key={d.id} 
                        onClick={() => {
                          setSelectedDelegateForDetails(d);
                          setView('admin_delegate_details');
                        }}
                        className="p-3 bg-white dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-700 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer group flex flex-col justify-between h-32 transition-all"
                      >
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center font-black group-hover:bg-emerald-500 group-hover:text-white transition-all text-xs">
                            {d.name.charAt(0)}
                          </div>
                          <h4 className="font-semibold text-slate-900 dark:text-white text-xs truncate leading-tight group-hover:text-emerald-500 transition-colors uppercase flex-1">{d.name}</h4>
                        </div>
                        
                        <div className="flex justify-between items-end">
                          <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-mono text-[9px]">
                            <Phone className="w-2 h-2" />
                            <span className="tracking-tighter">{d.phone}</span>
                          </div>
                          {d.canCreateGarage && (
                            <div className="text-[7px] font-bold px-1 py-0.5 rounded-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-widest shrink-0">PLUS</div>
                          )}
                        </div>
                      </div>
                    ))}
                    {delegates.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-300 dark:text-slate-700 font-bold">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        {t('لا يوجد مندوبين مسجلين حالياً')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'supervisors' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-8 transition-colors">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-900 dark:bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-white dark:text-white" />
                  </div>
                  {t('إضافة مشرف جديد')}
                </h2>
                <form onSubmit={handleCreateSupervisor} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('اسم المشرف')}</label>
                    <input 
                      value={adminSupervisorForm?.name || ''}
                      onChange={(e) => setAdminSupervisorForm && setAdminSupervisorForm({...adminSupervisorForm, name: e.target.value})}
                      placeholder={t('الاسم الثلاثي...')} 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('رقم الموبايل')}</label>
                    <input 
                      value={adminSupervisorForm?.phone || ''}
                      onChange={(e) => setAdminSupervisorForm && setAdminSupervisorForm({...adminSupervisorForm, phone: e.target.value})}
                      placeholder="01xxxxxxxxx" 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('رمز الدخول المشرف (PIN من 4-6 أرقام)')}</label>
                    <div className="relative">
                      <input 
                        type="tel"
                        inputMode="numeric"
                        value={adminSupervisorForm?.pin || ''}
                        onChange={(e) => setAdminSupervisorForm && setAdminSupervisorForm({...adminSupervisorForm, pin: e.target.value.replace(/\D/g, '')})}
                        placeholder="••••" 
                        maxLength={6}
                        required 
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold text-center tracking-[0.5em] transition-all px-14" 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (setAdminSupervisorForm) {
                            setAdminSupervisorForm({...adminSupervisorForm, pin: Math.floor(1000 + Math.random() * 9000).toString()});
                          }
                        }}
                        className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-emerald-100 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-400/20 transition-colors"
                        title={t('توليد رقم سري عشوائي')}
                      >
                        <RefreshCw className="w-5 h-5 mx-auto" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmittingSupervisor}
                    className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-5 rounded-2xl font-bold text-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3 mt-4 transition-all outline-none"
                  >
                    {isSubmittingSupervisor ? <Spinner /> : (
                      <>
                        <Plus className="w-6 h-6" />
                        <span>{t('منح صلاحية مشرف')}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </section>

            <section className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="p-8 border-b-2 border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 transition-colors">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border-2 border-slate-200 dark:border-slate-800 transition-colors shrink-0">
                      <Shield className="w-5 h-5 text-slate-800 dark:text-emerald-400" />
                    </div>
                    {t('قائمة المشرفين المعتمدين بالمنصة')}
                    <span className="text-slate-300 dark:text-slate-600 text-sm font-bold mr-2">({supervisors.length})</span>
                  </h2>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {supervisors.map((s) => (
                      <div 
                        key={s.id} 
                        className="p-5 bg-slate-50 dark:bg-slate-800/20 border-2 border-slate-100 dark:border-slate-800/80 rounded-2xl flex flex-col justify-between h-36 transition-all hover:border-slate-300 dark:hover:border-slate-700 relative group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center font-black text-sm">
                              {s.name.charAt(0)}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm truncate max-w-[140px] leading-snug">{s.name}</h4>
                              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-mono text-[9px]">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{s.phone}</span>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: t('حذف المشرف'),
                                message: adminLang === 'en' ? `Are you sure you want to delete supervisor "${s.name}"? This action cannot be undone.` : `هل أنت متأكد من حذف المشرف "${s.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
                                confirmText: t('نعم، احذف'),
                                cancelText: t('إلغاء'),
                                type: 'danger',
                                onConfirm: async () => {
                                  try {
                                    await firestoreService.removeSupervisor(s.id);
                                    showToast(t('تم حذف المشرف بنجاح'));
                                  } catch (error) {
                                    console.error(error);
                                    showToast(t('فشل حذف المشرف'), 'error');
                                  } finally {
                                    setConfirmDialog(p => ({ ...p, isOpen: false }));
                                  }
                                }
                              });
                            }}
                            className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                            title={t('إلغاء صلاحيات المشرف')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                          {editingSupervisorPinId === s.id ? (
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                              <input
                                type="tel"
                                inputMode="numeric"
                                value={editingSupervisorPinValue}
                                maxLength={6}
                                onChange={(e) => setEditingSupervisorPinValue(e.target.value.replace(/\D/g, ''))}
                                className="w-12 bg-transparent text-slate-800 dark:text-slate-200 text-[10px] font-black text-center focus:outline-none focus:ring-0 border-0 p-0 font-mono"
                                placeholder="••••"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (editingSupervisorPinValue.length < 4) {
                                    showToast(t('رمز الدخول يجب أن يكون 4 أرقام على الأقل'), 'error');
                                    return;
                                  }
                                  setIsUpdatingSupervisorPin(true);
                                  try {
                                    const pinCheck = await firestoreService.isPinTaken(editingSupervisorPinValue, s.id);
                                    if (pinCheck.taken) {
                                      showToast(`هذا الرمز السري (PIN) مستخدم بالفعل في حساب آخر: (${pinCheck.name} - ${pinCheck.role})`, 'error');
                                      setIsUpdatingSupervisorPin(false);
                                      return;
                                    }
                                    await firestoreService.updateSupervisor(s.id, { pin: editingSupervisorPinValue });
                                    s.pin = editingSupervisorPinValue;
                                    setEditingSupervisorPinId(null);
                                    showToast(t('تم تحديث الرمز بنجاح'));
                                  } catch (err) {
                                    showToast(t('فشل تحديث الرمز'), 'error');
                                  } finally {
                                    setIsUpdatingSupervisorPin(false);
                                  }
                                }}
                                disabled={isUpdatingSupervisorPin}
                                className="w-4 h-4 bg-emerald-600 text-white rounded flex items-center justify-center hover:bg-emerald-700 transition-colors cursor-pointer"
                              >
                                {isUpdatingSupervisorPin ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingSupervisorPinId(null)}
                                className="text-[9px] font-bold text-slate-400 px-0.5 hover:underline"
                              >
                                {t('إلغاء')}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <Key className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-black font-mono tracking-widest">{s.pin}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSupervisorPinId(s.id);
                                  setEditingSupervisorPinValue(s.pin || '');
                                }}
                                className="text-[9px] text-emerald-500 font-bold hover:underline"
                              >
                                {t('تعديل')}
                              </button>
                            </div>
                          )}
                          <span className="text-[8px] font-black px-2.5 py-1 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-400">
                            {t('صلاحيات مشرف')}
                          </span>
                        </div>
                      </div>
                    ))}
                    {supervisors.length === 0 && (
                      <div className="col-span-full py-16 text-center text-slate-300 dark:text-slate-700 font-bold">
                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        {t('لا يوجد مشرفين منشئين حالياً')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'general_managers' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-8 transition-colors">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-900 dark:bg-emerald-500 rounded-lg flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-white dark:text-white" />
                  </div>
                  {t('إضافة مدير عام جديد')}
                </h2>
                <form onSubmit={handleCreateGeneralManager} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('اسم المدير العام')}</label>
                    <input 
                      value={adminGeneralManagerForm?.name || ''}
                      onChange={(e) => setAdminGeneralManagerForm({...adminGeneralManagerForm, name: e.target.value})}
                      placeholder={t('الاسم الثلاثي...')} 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('رقم الموبايل')}</label>
                    <input 
                      value={adminGeneralManagerForm?.phone || ''}
                      onChange={(e) => setAdminGeneralManagerForm({...adminGeneralManagerForm, phone: e.target.value})}
                      placeholder="01xxxxxxxxx" 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('رمز الدخول (PIN من 4-6 أرقام)')}</label>
                    <div className="relative">
                      <input 
                        type="tel"
                        inputMode="numeric"
                        value={adminGeneralManagerForm?.pin || ''}
                        onChange={(e) => setAdminGeneralManagerForm({...adminGeneralManagerForm, pin: e.target.value.replace(/\D/g, '')})}
                        placeholder="••••" 
                        maxLength={6}
                        required 
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold text-center tracking-[0.5em] transition-all px-14" 
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setAdminGeneralManagerForm({...adminGeneralManagerForm, pin: Math.floor(1000 + Math.random() * 9000).toString()});
                        }}
                        className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-emerald-100 dark:bg-emerald-400/10 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-200 dark:hover:bg-emerald-400/20 transition-colors"
                        title={t('توليد رقم سري عشوائي')}
                      >
                        <RefreshCw className="w-5 h-5 mx-auto" strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('الجراجات المتاحة للمدير العام')}</label>
                    <div className="max-h-48 overflow-y-auto border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 bg-slate-50 dark:bg-slate-800/40 space-y-2.5">
                      {approvedGarages.map(g => (
                        <div 
                          key={g.id}
                          onClick={() => toggleGarageSelection(g.id)}
                          className="flex items-center gap-3 cursor-pointer select-none"
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                            adminGeneralManagerForm.selectedGarages.includes(g.id)
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {adminGeneralManagerForm.selectedGarages.includes(g.id) && <Check className="w-3.5 h-3.5 stroke-[3.5]" />}
                          </div>
                          <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">{g.name}</span>
                        </div>
                      ))}
                      {approvedGarages.length === 0 && (
                        <span className="text-slate-400 text-xs font-bold block text-center">{t('لا يوجد جراجات معتمدة حالياً')}</span>
                      )}
                    </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSubmittingGeneralManager}
                    className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-5 rounded-2xl font-bold text-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3 mt-4 transition-all outline-none"
                  >
                    {isSubmittingGeneralManager ? <Spinner /> : (
                      <>
                        <Plus className="w-6 h-6" />
                        <span>{t('إضافة مدير عام')}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </section>

            <section className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="p-8 border-b-2 border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 transition-colors">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center border-2 border-slate-200 dark:border-slate-800 transition-colors shrink-0">
                      <Shield className="w-5 h-5 text-slate-800 dark:text-emerald-400" />
                    </div>
                    {t('قائمة المديرين العموم بالمنصة')}
                    <span className="text-slate-300 dark:text-slate-600 text-sm font-bold mr-2">({generalManagers.length})</span>
                  </h2>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                    {generalManagers.map((gm) => (
                      <div 
                        key={gm.id} 
                        className="p-5 bg-slate-50 dark:bg-slate-800/20 border-2 border-slate-100 dark:border-slate-800/80 rounded-2xl flex flex-col justify-between h-44 transition-all hover:border-slate-300 dark:hover:border-slate-700 relative group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center font-black text-sm">
                              {gm.name.charAt(0)}
                            </div>
                            <div className="space-y-0.5">
                              <h4 className="font-semibold text-slate-900 dark:text-white text-xs sm:text-sm truncate max-w-[140px] leading-snug">{gm.name}</h4>
                              <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 font-mono text-[9px]">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{gm.phone}</span>
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1.5 max-h-[44px] overflow-y-auto">
                                {(gm.garageIds || []).map(gid => {
                                  const grg = allGarages.find(g => g.id === gid);
                                  return (
                                    <span key={gid} className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 border border-emerald-100/40 dark:border-emerald-800/30">
                                      {grg ? grg.name : gid}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: t('حذف المدير العام'),
                                message: adminLang === 'en' ? `Are you sure you want to delete general manager "${gm.name}"? This action cannot be undone.` : `هل أنت متأكد من حذف المدير العام "${gm.name}"؟ لا يمكن التراجع عن هذا الإجراء.`,
                                confirmText: t('نعم، احذف'),
                                cancelText: t('إلغاء'),
                                type: 'danger',
                                onConfirm: async () => {
                                  try {
                                    await firestoreService.removeGeneralManager(gm.id);
                                    showToast(t('تم حذف المدير العام بنجاح'));
                                  } catch (error) {
                                    console.error(error);
                                    showToast(t('فشل حذف المدير العام'), 'error');
                                  } finally {
                                    setConfirmDialog(p => ({ ...p, isOpen: false }));
                                  }
                                }
                              });
                            }}
                            className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                            title={t('إلغاء صلاحيات المدير العام')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                          {editingGeneralManagerPinId === gm.id ? (
                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                              <input
                                type="tel"
                                inputMode="numeric"
                                value={editingGeneralManagerPinValue}
                                maxLength={6}
                                onChange={(e) => setEditingGeneralManagerPinValue(e.target.value.replace(/\D/g, ''))}
                                className="w-12 bg-transparent text-slate-800 dark:text-slate-200 text-[10px] font-black text-center focus:outline-none focus:ring-0 border-0 p-0 font-mono"
                                placeholder="••••"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  if (editingGeneralManagerPinValue.length < 4) {
                                    showToast(t('رمز الدخول يجب أن يكون 4 أرقام على الأقل'), 'error');
                                    return;
                                  }
                                  setIsUpdatingGeneralManagerPin(true);
                                  try {
                                    const pinCheck = await firestoreService.isPinTaken(editingGeneralManagerPinValue, gm.id);
                                    if (pinCheck.taken) {
                                      showToast(`هذا الرمز السري (PIN) مستخدم بالفعل في حساب آخر: (${pinCheck.name} - ${pinCheck.role})`, 'error');
                                      setIsUpdatingGeneralManagerPin(false);
                                      return;
                                    }
                                    await firestoreService.updateGeneralManager(gm.id, { pin: editingGeneralManagerPinValue });
                                    gm.pin = editingGeneralManagerPinValue;
                                    setEditingGeneralManagerPinId(null);
                                    showToast(t('تم تحديث الرمز بنجاح'));
                                  } catch (err) {
                                    showToast(t('فشل تحديث الرمز'), 'error');
                                  } finally {
                                    setIsUpdatingGeneralManagerPin(false);
                                  }
                                }}
                                disabled={isUpdatingGeneralManagerPin}
                                className="w-4 h-4 bg-emerald-600 text-white rounded flex items-center justify-center hover:bg-emerald-700 transition-colors cursor-pointer"
                              >
                                {isUpdatingGeneralManagerPin ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingGeneralManagerPinId(null)}
                                className="text-[9px] font-bold text-slate-400 px-0.5 hover:underline"
                              >
                                {t('إلغاء')}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <Key className="w-3.5 h-3.5" />
                              <span className="text-[11px] font-black font-mono tracking-widest">{gm.pin}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGeneralManagerPinId(gm.id);
                                  setEditingGeneralManagerPinValue(gm.pin || '');
                                }}
                                className="text-[9px] text-emerald-500 font-bold hover:underline"
                              >
                                {t('تعديل')}
                              </button>
                            </div>
                          )}
                          <span className="text-[8px] font-black px-2.5 py-1 bg-purple-550/10 rounded-md text-purple-650 dark:text-purple-400">
                            {t('مدير عام لجراج أو أكثر')}
                          </span>
                        </div>
                      </div>
                    ))}
                    {generalManagers.length === 0 && (
                      <div className="col-span-full py-16 text-center text-slate-300 dark:text-slate-700 font-bold">
                        <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        {t('لا يوجد مديرين عموم منشئين حالياً')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : activeTab === 'requests' ? (
          <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">

            {/* Sub-tabs segment controller */}
            <div className="flex bg-[#f1f5f9] dark:bg-slate-900/60 p-1 rounded-2xl max-w-sm sm:max-w-md w-full border border-slate-200/40 dark:border-slate-800/40">
              <button
                onClick={() => setRequestSubTab('recharge')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all focus:outline-none ${
                  requestSubTab === 'recharge'
                    ? 'bg-emerald-600 text-white shadow-sm font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('طلبات الشحن')}</span>
                {rechargeRequests.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white animate-pulse shrink-0">
                    {rechargeRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setRequestSubTab('creation')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-black text-xs sm:text-sm transition-all focus:outline-none ${
                  requestSubTab === 'creation'
                    ? 'bg-emerald-600 text-white shadow-sm font-black'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <span>{t('إنشاء الجراجات')}</span>
                {pendingGarages.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white animate-pulse shrink-0">
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
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1">
                              <span>{t('بواسطة المندوب:')}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 underline decoration-dotted">{request.delegateName}</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('الباقة المختارة')}</p>
                            <div className="flex items-center gap-2">
                              <Zap className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-xs font-black text-slate-900 dark:text-white truncate">{request.packageName}</span>
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('الرصيد المضاف')}</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">+{request.carsCount} <span className="text-[10px]">{t('سيارة')}</span></p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('المبلغ المدفوع')}</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white font-mono">{request.revenueAmount} <span className="text-[10px]">{t('ج.م')}</span></p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-3 justify-center">
                        <button
                          onClick={() => handleApproveRequest(request)}
                          className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                        >
                          <Check className="w-5 h-5 stroke-[4]" />
                          <span>{t('موافق')}</span>
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="flex-1 md:w-32 bg-red-50 dark:bg-red-900/20 text-red-655 dark:text-red-400 p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all uppercase tracking-widest border border-red-100 dark:border-red-900/30"
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
                    <h3 className="text-xl font-bold text-slate-350 dark:text-slate-755 mb-2">{t('لا توجد طلبات معلقة')}</h3>
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
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 mt-1">
                              <span>{t('بواسطة المندوب:')}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 underline decoration-dotted">
                                {garage.createdByDelegateName || t('غير معروف')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('رقم الموبايل')}</p>
                            <p className="text-xs font-black text-slate-900 dark:text-white font-mono" dir="ltr">{garage.phone || t('بدون هاتف')}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('سعر الساعة')}</p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{garage.hourlyRate} <span className="text-[10px]">{t('ج.م')}</span></p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">{t('سعر المبيت')}</p>
                            <p className="text-sm font-black text-slate-900 dark:text-white font-mono">{garage.overnightRate} <span className="text-[10px]">{t('ج.م')}</span></p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-3 justify-center">
                        <button
                          onClick={() => handleApproveGarage(garage)}
                          className="flex-1 md:w-32 bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
                        >
                          <Check className="w-5 h-5 stroke-[4]" />
                          <span>{t('تأكيد تفعيل')}</span>
                        </button>
                        <button
                          onClick={() => handleRejectGarage(garage)}
                          className="flex-1 md:w-32 bg-red-50 dark:bg-red-900/20 text-red-655 dark:text-red-400 p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all uppercase tracking-widest border border-red-100 dark:border-red-900/30"
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
                    <h3 className="text-xl font-bold text-slate-350 dark:text-slate-755 mb-2">{t('لا توجد طلبات معلقة')}</h3>
                    <p className="text-sm font-medium text-slate-400 dark:text-slate-600">{t('سيظهر هنا طلبات تسجيل الجراجات الجديدة المقدمة من المندوبين')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'packages' ? (
          <div className="space-y-8">
            {/* Subscription Prices Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-8 transition-colors">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3 font-sans">
                <div className="w-8 h-8 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg flex items-center justify-center shrink-0">
                  <Zap className="w-5 h-5 stroke-[2.5]" />
                </div>
                {t('تعديل أسعار اشتراكات الجراجات الدوريّة')}
              </h2>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const weeklyInput = form.elements.namedItem('weeklyPrice') as HTMLInputElement;
                  const monthlyInput = form.elements.namedItem('monthlyPrice') as HTMLInputElement;
                  const weekly = Number(weeklyInput.value);
                  const monthly = Number(monthlyInput.value);
                  if (weekly <= 0 || monthly <= 0) {
                    showToast(t('يرجى إدخال أسعار صحيحة أكبر من الصفر'), 'error');
                    return;
                  }
                  try {
                    await firestoreService.updateSubscriptionPrices({ weekly, monthly });
                    showToast(t('تم تحديث أسعار الاشتراكات بنجاح'));
                  } catch (err) {
                    showToast(t('حدث خطأ أثناء تحديث الأسعار'), 'error');
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end font-sans"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('سعر الاشتراك الأسبوعي (7 أيام) - ج.م')}</label>
                  <input 
                    name="weeklyPrice" 
                    type="number" 
                    defaultValue={subscriptionPrices.weekly}
                    key={`weekly-${subscriptionPrices.weekly}`}
                    required 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-amber-500 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('سعر الاشتراك الشهري (30 يوماً) - ج.م')}</label>
                  <input 
                    name="monthlyPrice" 
                    type="number" 
                    defaultValue={subscriptionPrices.monthly}
                    key={`monthly-${subscriptionPrices.monthly}`}
                    required 
                    className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white font-bold outline-none focus:border-amber-500 transition-all" 
                  />
                </div>
                <button 
                  type="submit" 
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-4 rounded-2xl font-bold text-base transition-all outline-none flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>{t('حفظ أسعار الاشتراكات')}</span>
                </button>
              </form>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <section className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-8 transition-colors">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8 flex items-center gap-3 font-sans">
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5 text-white stroke-[3]" />
                  </div>
                  {t('إضافة باقة جديدة')}
                </h2>
                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const nameInput = form.elements.namedItem('pkgName') as HTMLInputElement;
                    const priceInput = form.elements.namedItem('pkgPrice') as HTMLInputElement;
                    const countInput = form.elements.namedItem('pkgCount') as HTMLInputElement;
                    
                    const name = nameInput.value;
                    const price = Number(priceInput.value);
                    const count = Number(countInput.value);
                    
                    try {
                      await firestoreService.addPackage({ name, price, vehiclesCount: count });
                      form.reset();
                      showToast(t('تم إضافة الباقة بنجاح'));
                    } catch (err) {
                      showToast(t('حدث خطأ أثناء إضافة الباقة'), 'error');
                    }
                  }}
                  className="space-y-5 font-sans"
                >
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('اسم الباقة')}</label>
                    <input 
                      name="pkgName" 
                      placeholder={t('مثال: الباقة البرونزية...')} 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('سعر الباقة (ج.م)')}</label>
                    <input 
                      name="pkgPrice" 
                      type="number" 
                      placeholder={t('مثال: 200')} 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 mr-2">{t('عدد السيارات المسموح بها')}</label>
                    <input 
                      name="pkgCount" 
                      type="number" 
                      placeholder={t('مثال: 100')} 
                      required 
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none font-bold transition-all" 
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-5 rounded-2xl font-bold text-lg hover:opacity-95 transition-all outline-none flex items-center justify-center gap-3 mt-4 pointer-events-auto"
                  >
                    <Plus className="w-6 h-6 stroke-[3]" />
                    <span>{t('إضافة الباقة')}</span>
                  </button>
                </form>
              </div>
            </section>

            <section className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
                <div className="p-8 border-b-2 border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-center gap-6 transition-colors font-sans">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 dark:bg-slate-850 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 transition-colors shrink-0">
                      <Zap className="w-5 h-5 text-emerald-550" />
                    </div>
                    الباقات الحالية في النظام
                    <span className="text-slate-300 dark:text-slate-500 text-sm font-bold mr-2">({packages.length})</span>
                  </h2>
                </div>
                <div className="p-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {packages.map(pkg => (
                      <div 
                        key={pkg.id} 
                        className="p-5 bg-white dark:bg-slate-900 border bg-white dark:bg-slate-900 border-2 border-slate-103 dark:border-slate-800 rounded-2xl hover:border-emerald-500 dark:hover:border-emerald-500 transition-all flex flex-col justify-between min-h-40 shadow-sm relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <h4 className="font-sans font-black text-slate-900 dark:text-white text-lg">{pkg.name}</h4>
                          <button 
                            type="button"
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
                                    showToast(t('تم حذف الباقة بنجاح'));
                                  } catch (err) {
                                    showToast(t('فشل حذف الباقة'), 'error');
                                  } finally {
                                    setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                  }
                                }
                              });
                            }}
                            className="w-9 h-9 bg-red-500/10 dark:bg-red-500/25 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white rounded-xl flex items-center justify-center transition-all outline-none"
                          >
                            <Trash2 className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-1 border-t border-slate-100 dark:border-slate-800 pt-4 mt-auto font-sans text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-none mb-1">{t('سعر الباقة')}</span>
                            <div className="flex items-baseline gap-0.5 font-black mt-0.5 whitespace-nowrap justify-center w-full">
                              <span className="text-sm xs:text-base sm:text-lg text-emerald-500 font-mono">{pkg.price}</span>
                              <span className="text-[8px] text-emerald-500 font-semibold">{t('ج.م')}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-center border-x border-slate-100 dark:border-slate-800/60 px-1">
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-none mb-1">{t('سعر السيارة')}</span>
                            <div className="flex items-baseline gap-0.5 font-black mt-0.5 whitespace-nowrap justify-center w-full">
                              <span className="text-sm xs:text-base sm:text-lg text-emerald-500 dark:text-emerald-400 font-mono">
                                {Number((pkg.price / (pkg.vehiclesCount || 1)).toFixed(2))}
                              </span>
                              <span className="text-[8px] text-emerald-500 dark:text-emerald-400 font-semibold font-sans">{t('ج.م')}</span>
                            </div>
                          </div>

                          <div className="flex flex-col items-center">
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold leading-none mb-1">{t('عدد السيارات')}</span>
                            <div className="flex items-baseline gap-0.5 font-black mt-0.5 whitespace-nowrap justify-center w-full">
                              <span className="text-sm xs:text-base sm:text-lg text-slate-800 dark:text-slate-200 font-mono">{pkg.vehiclesCount}</span>
                              <span className="text-[8px] text-slate-400 font-semibold font-sans">{t('سيارة')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {packages.length === 0 && (
                      <div className="col-span-full py-16 text-center text-slate-300 dark:text-slate-700 font-bold">
                        <Zap className="w-12 h-12 mx-auto mb-3 opacity-20 text-emerald-500" />
                        {t('لا يوجد باقات مسجلة حالياً')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
          </div>
        ) : activeTab === 'reports' ? (
          <AdminReportsView allGarages={approvedGarages} delegates={delegates} />
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
                        showToast(t('رقم المحفظة لا يمكن أن يكون فارغاً'), 'error');
                        return;
                      }
                      setIsSavingWallet(true);
                      try {
                        await onUpdateWalletNumber(walletValue);
                        showToast(t('تم تحديث رقم المحفظة الإلكترونية بنجاح'));
                        setActiveTab('menu');
                      } catch (err) {
                        showToast(t('حدث خطأ أثناء تحديث رقم المحفظة'), 'error');
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
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all outline-none animate-none"
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
                      {t('الرجاء إدخال رمز الدخول الحالي للآدمن:')}
                    </p>
                  </div>

                  {/* Verification Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (currentPinAttempt === currentAdminPin) {
                        setIsAdminPinVerified(true);
                        showToast(t('تم التحقق بنجاح'));
                      } else {
                        showToast(t('رمز الدخول الحالي غير صحيح'), 'error');
                      }
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
                        required
                        placeholder="••••"
                        className="w-full max-w-xs mx-auto text-center p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-red-500 dark:focus:border-red-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all tracking-[0.5em] font-mono"
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button
                        type="submit"
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all outline-none cursor-pointer"
                      >
                        <Check className="w-5 h-5 stroke-[3]" />
                        <span>{t('تأكيد ودخول')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('menu')}
                        className="px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-extrabold text-sm rounded-2xl transition-all cursor-pointer"
                      >
                        {t('رجوع')}
                      </button>
                    </div>
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
                      {t('رمز الدخول يجب أن يكون 4 أرقام على الأقل')}
                    </p>
                  </div>

                  {/* Edit Passcode Form */}
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (newAdminPinValue.length < 4) {
                        showToast(t('رمز الدخول يجب أن يكون 4 أرقام على الأقل'), 'error');
                        return;
                      }
                      setIsSavingAdminPin(true);
                      try {
                        await firestoreService.updateAdminPin(newAdminPinValue);
                        showToast(t('تم تحديث رمز دخول الآدمن بنجاح'));
                        setIsAdminPinVerified(false);
                        setActiveTab('menu');
                      } catch (err) {
                        showToast(t('فشل تحديث رمز الدخول'), 'error');
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
                        required
                        placeholder="••••"
                        className="w-full max-w-xs mx-auto text-center p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-black text-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all tracking-[0.5em] font-mono"
                        autoFocus
                      />
                    </div>

                    <div className="flex gap-4 pt-2">
                      <button
                        type="submit"
                        disabled={isSavingAdminPin}
                        className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all outline-none cursor-pointer"
                      >
                        {isSavingAdminPin ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
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
                          setIsAdminPinVerified(false);
                        }}
                        className="px-6 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 font-extrabold text-sm rounded-2xl transition-all cursor-pointer"
                      >
                        {t('رجوع')}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      {/* Plans Management Modal */}
      {showPlansModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowPlansModal(false)}>
          <div 
            className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white">
                  <SettingsIcon className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{t('إدارة الباقات')}</h2>
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
                  const count = Number((form.elements.namedItem('count') as HTMLInputElement).value);
                  
                  try {
                    await firestoreService.addPackage({ name, price, vehiclesCount: count });
                    form.reset();
                  } catch (err) {}
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
                    <input name="price" type="number" placeholder="200" required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase pr-2">{t('عدد السيارات')}</label>
                  <input name="count" type="number" placeholder="100" required className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all" />
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
                                showToast(t('تم حذف الباقة بنجاح'));
                              } catch (err) {
                                showToast(t('فشل حذف الباقة'), 'error');
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
        <div className="fixed inset-0 z-50 flex items-center justify-start sm:justify-center overflow-y-auto bg-slate-900/60 dark:bg-slate-950/80 p-4 backdrop-blur-sm" onClick={() => setShowOverview(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl relative z-10 my-auto overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors" onClick={e => e.stopPropagation()}>
            <div className="p-8 border-b-2 border-slate-50 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-20 transition-colors">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
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
                    setGarageForm({ name: '', hourlyRate: '', overnightRate: '', phone: '', initialPackageId: '', billingModel: 'commission', subscriptionType: 'weekly' });
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
                          dir="ltr" 
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
                          dir="ltr" 
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[9px] text-slate-300 dark:text-slate-600 font-bold">{t('ج.م')}</span>
                      </div>
                    </div>
                  </div>

                  {/* طريقة الحساب */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest text-center block font-black">{t('طريقة الحساب بالجراج')}</label>
                    <select 
                      name="billingModel" 
                      value={garageForm.billingModel}
                      onChange={(e) => setGarageForm({ ...garageForm, billingModel: e.target.value as any })}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 appearance-none text-center transition-all" 
                      dir="rtl"
                    >
                      <option value="commission">{t('بالعمولة (شحن سيارات)')}</option>
                      <option value="subscription">{t('بالاشتراك (أسبوعي/شهري)')}</option>
                    </select>
                  </div>

                  {/* Initial Package (Only for Commission) */}
                  {garageForm.billingModel === 'commission' && packages.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest text-center block font-black">{t('باقة البداية (اختياري)')}</label>
                      <select 
                        name="initialPackageId" 
                        value={garageForm.initialPackageId}
                        onChange={(e) => setGarageForm({ ...garageForm, initialPackageId: e.target.value })}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 appearance-none text-center transition-all" 
                        dir="rtl"
                      >
                        <option value="">{t('بدون باقة')}</option>
                        {packages.map(pkg => (
                          <option key={pkg.id} value={pkg.id}>{pkg.name} - {pkg.price} {t('ج.م')} ({pkg.vehiclesCount} {t('سيارة')})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Subscription Type (Only for Subscription) */}
                  {garageForm.billingModel === 'subscription' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mr-2 uppercase tracking-widest text-center block font-black">{t('نوع الاشتراك الابتدائي')}</label>
                      <select 
                        name="subscriptionType" 
                        value={garageForm.subscriptionType}
                        onChange={(e) => setGarageForm({ ...garageForm, subscriptionType: e.target.value as any })}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold outline-none focus:border-slate-900 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 appearance-none text-center transition-all" 
                        dir="rtl"
                      >
                        <option value="weekly">{t(`اشتراك أسبوعي - ${subscriptionPrices.weekly} ج.م`)}</option>
                        <option value="monthly">{t(`اشتراك شهري - ${subscriptionPrices.monthly} ج.م`)}</option>
                      </select>
                    </div>
                  )}

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

                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full bg-slate-900 dark:bg-emerald-600 text-white dark:text-white py-5 rounded-xl font-bold text-lg hover:bg-slate-800 dark:hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-3 mt-4 uppercase tracking-widest transition-all outline-none"
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
      {/* Custom Confirmation Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
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

              <div className="flex gap-3">
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
          showToast={(msg, type) => showToast(msg, type)}
          adminColor={adminColor}
          onUpdateAdminColor={(color) => setAdminColor(color)}
        />
      )}
    </div>
  );
});
