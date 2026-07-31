/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Shield,
  RefreshCw,
} from 'lucide-react';
import { safeDate, resolveShimmerColor } from './utils';
import { useTheme } from './utils/ThemeContext';
import { useLocalStorageState } from './hooks/useLocalStorage';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { LandscapeMobileView } from './components/layout/LandscapeMobileView';
import { OfflineView } from './components/layout/OfflineView';
import { SplashScreen } from './components/layout/SplashScreen';

import { AdminDashboard } from './components/admin/AdminDashboard';
import { GeneralManagerDashboard } from './components/general_manager/GeneralManagerDashboard';
import { LoginView } from './components/auth/LoginView';
import { AdminLoginView } from './components/auth/AdminLoginView';
import { DelegateLoginView } from './components/auth/DelegateLoginView';
import { DelegateDashboardView } from './components/delegate/DelegateDashboardView';
import { AdminGarageDetailsView } from './components/admin/AdminGarageDetailsView';
import { AdminDelegateDetailsView } from './components/admin/AdminDelegateDetailsView';
import { GarageDashboardView } from './components/garage/GarageDashboardView';
import { CheckInModal } from './components/modals/CheckInModal';
import { CheckOutModal } from './components/modals/CheckOutModal';
import { PackagesModal } from './components/modals/PackagesModal';
import { DeleteGarageConfirmModal } from './components/modals/DeleteGarageConfirmModal';
import { DeleteVehicleConfirmModal } from './components/modals/DeleteVehicleConfirmModal';
import { RecentExitWarningModal } from './components/modals/RecentExitWarningModal';
import { LogoutConfirmModal } from './components/modals/LogoutConfirmModal';
import { SubscriberWarningModal } from './components/modals/SubscriberWarningModal';
import { useGarageApp } from './hooks/useGarageApp';
import { useBackTrapping } from './hooks/useBackTrapping';
import { firestoreService } from './services/firestoreService';

export default function App() {
  const {
    isAuthReady,
    isLandscapeMobile,
    view,
    setView,
    garage,
    setGarage,
    delegate,
    delegates,
    vehicles,
    todayTransactions,
    allGarages,
    adminPin,
    setAdminPin,
    activeAdminPin,
    walletNumber,
    subscriptionPrices,
    loginPhone,
    setLoginPhone,
    showCheckInModal,
    setShowCheckInModal,
    showCheckOutModal,
    setShowCheckOutModal,
    selectedVehicle,
    setSelectedVehicle,
    newPlateNumber,
    setNewPlateNumber,
    plateInputRef,
    isLoading,
    loadingType,
    setIsLoading,
    selectedGarageForDetails,
    setSelectedGarageForDetails,
    selectedDelegateForDetails,
    setSelectedDelegateForDetails,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showLogoutConfirm,
    setShowLogoutConfirm,
    showPackages,
    setShowPackages,
    showStaffStats,
    setShowStaffStats,
    showSubscribers,
    setShowSubscribers,
    currentSupervisor,
    supervisors,
    currentGeneralManager,
    generalManagers,
    isInputFocused,
    setIsInputFocused,
    staffList,
    rechargeRequests,
    delegateRequests,
    currentStaff,
    toast,
    setToast,
    showRecentExitWarning,
    setShowRecentExitWarning,
    recentVehicle,
    setRecentVehicle,
    showSubscriberWarning,
    setShowSubscriberWarning,
    subscriberWarningPlate,
    setSubscriberWarningPlate,
    pendingCheckInType,
    isWaitingForApproval,
    setIsWaitingForApproval,
    pendingApprovalRequest,
    now,
    showOfflineScreen,
    inputRef,
    sortedPackages,
    delegateGarages,
    showToast,
    handleLogout,
    handleInitiateLogout,
    closeKeyboard,
    handleGarageLogin,
    handleDelegateLogin,
    handleDelegateRecharge,
    handleCheckIn,
    confirmCheckOut,
    handleDeleteVehicle,
    deleteGarage,
    updateGarageRate,
    createNewGarage,
    addDelegate,
    removeDelegate,
    handleAcceptApprovalRequest,
    handleRejectApprovalRequest
  } = useGarageApp();

  const { theme } = useTheme();
  const [adminColor] = useLocalStorageState<string>('app_admin_color', '#10b981');

  const activeColor = (view && (view.startsWith('admin_') || view === 'admin_dashboard'))
    ? adminColor
    : (garage?.shimmerColor || '#10b981');

  const resolvedColor = resolveShimmerColor(activeColor, theme);

  // View auto-recovery fallback when persisted view data is missing
  useEffect(() => {
    if (!isLoading && isAuthReady) {
      if (view === 'garage' && !garage) {
        setView('login');
      } else if (view === 'delegate_dashboard' && !delegate) {
        setView('login');
      } else if (view === 'general_manager_dashboard' && !currentGeneralManager) {
        setView('login');
      } else if (view === 'admin_garage_details' && !selectedGarageForDetails) {
        setView('admin_dashboard');
      } else if (view === 'admin_delegate_details' && !selectedDelegateForDetails) {
        setView('admin_dashboard');
      }
    }
  }, [view, garage, delegate, currentGeneralManager, selectedGarageForDetails, selectedDelegateForDetails, isLoading, isAuthReady, setView]);

  // Call useBackTrapping hook to handle browser navigation / Android popstate
  useBackTrapping({
    view,
    setView,
    showCheckInModal,
    setShowCheckInModal,
    showCheckOutModal,
    setShowCheckOutModal,
    showDeleteConfirm,
    setShowDeleteConfirm,
    showLogoutConfirm,
    setShowLogoutConfirm,
    showRecentExitWarning,
    setShowRecentExitWarning,
    showSubscriberWarning,
    setShowSubscriberWarning,
    showPackages,
    setShowPackages,
    showStaffStats,
    setShowStaffStats,
    showSubscribers,
    setShowSubscribers,
    setSelectedVehicle,
    setSelectedGarageForDetails,
    setSelectedDelegateForDetails,
    setRecentVehicle,
    setSubscriberWarningPlate,
  });

  const renderView = () => {
    // Balance/Lock Block
    if (garage && view !== 'admin_dashboard') {
      const expiry = garage.balanceExpiry ? safeDate(garage.balanceExpiry) : null;
      if (expiry && expiry.getTime() > 0 && expiry.getTime() < Date.now()) {
        return (
          <div className="h-full w-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans overflow-y-auto" dir="rtl">
            <div className="bg-white p-10 rounded-2xl max-w-md w-full">
              <div className="w-32 h-32 bg-slate-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-8">
                <Shield className="w-16 h-16 stroke-[3]" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 mb-4">نفذ الرصيد</h2>
              <p className="text-slate-500 font-bold text-lg mb-8 leading-relaxed">
                عذراً، لقد نفذ رصيد الجراج الخاص بك. يرجى التواصل مع الإدارة لشحن الرصيد ومتابعة العمل.
              </p>
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl font-bold text-sm mb-8">
                تاريخ الانتهاء: {expiry.toLocaleDateString('ar-EG')}
              </div>
              <button 
                onClick={() => {
                  setGarage(null);
                  setView('login');
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        );
      }
    }

    if (view === 'login') {
      return (
        <LoginView 
          loginPhone={loginPhone}
          setLoginPhone={setLoginPhone}
          handleGarageLogin={handleGarageLogin}
          isLoading={isLoading || !isAuthReady}
          closeKeyboard={closeKeyboard}
        />
      );
    }

    if (view === 'admin_login') {
      return (
        <AdminLoginView 
          adminPin={adminPin}
          setAdminPin={setAdminPin}
          setView={setView}
          showToast={showToast}
          closeKeyboard={closeKeyboard}
          correctAdminPin={activeAdminPin}
        />
      );
    }

    if (view === 'admin_dashboard') {
      return (
        <AdminDashboard 
          allGarages={allGarages}
          isLoading={isLoading}
          createNewGarage={createNewGarage}
          setView={setView}
          setSelectedGarageForDetails={setSelectedGarageForDetails}
          setSelectedDelegateForDetails={setSelectedDelegateForDetails}
          delegates={delegates}
          addDelegate={addDelegate}
          packages={sortedPackages}
          onLogout={handleInitiateLogout}
          rechargeRequests={rechargeRequests}
          showToast={showToast}
          currentSupervisor={currentSupervisor}
          supervisors={supervisors}
          generalManagers={generalManagers}
          currentAdminPin={activeAdminPin}
          currentWalletNumber={walletNumber}
          onUpdateWalletNumber={firestoreService.updateWalletNumber}
          subscriptionPrices={subscriptionPrices}
        />
      );
    }

    if (view === 'general_manager_dashboard' && currentGeneralManager) {
      return (
        <GeneralManagerDashboard 
          currentGeneralManager={currentGeneralManager}
          allGarages={allGarages}
          onLogout={handleInitiateLogout}
        />
      );
    }

    if (view === 'delegate_login') {
      return (
        <DelegateLoginView 
          onLogin={handleDelegateLogin}
          isLoading={isLoading}
          onBack={() => setView('login')}
        />
      );
    }

    if (view === 'delegate_dashboard' && delegate) {
      return (
        <DelegateDashboardView 
          delegate={delegate}
          allGarages={delegateGarages}
          onLogout={handleInitiateLogout}
          onRecharge={handleDelegateRecharge}
          onCreateGarage={createNewGarage}
          isLoading={isLoading}
          packages={sortedPackages}
          pendingRequests={rechargeRequests}
          delegateRequests={delegateRequests}
          showToast={showToast}
          subscriptionPrices={subscriptionPrices}
        />
      );
    }

    if (view === 'admin_garage_details' && selectedGarageForDetails) {
      return (
        <AdminGarageDetailsView 
          selectedGarageForDetails={selectedGarageForDetails}
          setView={setView}
          setSelectedGarageForDetails={setSelectedGarageForDetails}
          setShowDeleteConfirm={setShowDeleteConfirm}
          updateGarageRate={updateGarageRate}
          showToast={showToast}
          staffList={staffList}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
          packages={sortedPackages}
          subscriptionPrices={subscriptionPrices}
        />
      );
    }

    if (view === 'admin_delegate_details' && selectedDelegateForDetails) {
      // Find the most up-to-date delegate data from our synced delegates list
      const liveDelegate = delegates.find(d => d.id === selectedDelegateForDetails.id) || selectedDelegateForDetails;
      if (!liveDelegate) return <div className="p-8 text-center">جاري التحميل...</div>;
      
      return (
        <AdminDelegateDetailsView 
          delegate={liveDelegate}
          setView={setView}
          setSelectedDelegate={setSelectedDelegateForDetails}
          removeDelegate={removeDelegate}
        />
      );
    }

    if (view === 'garage' && garage) {
      return (
        <GarageDashboardView 
          garage={garage}
          currentStaff={currentStaff}
          isInputFocused={isInputFocused}
          now={now}
          vehicles={vehicles}
          todayTransactions={todayTransactions}
          setSelectedVehicle={setSelectedVehicle}
          setShowCheckOutModal={setShowCheckOutModal}
          closeKeyboard={closeKeyboard}
          newPlateNumber={newPlateNumber}
          setNewPlateNumber={setNewPlateNumber}
          setIsInputFocused={setIsInputFocused}
          plateInputRef={plateInputRef}
          handleCheckIn={handleCheckIn}
          inputRef={inputRef}
          onLogout={handleInitiateLogout}
          showToast={showToast}
          packages={sortedPackages}
          staffList={staffList}
          showPackages={showPackages}
          setShowPackages={setShowPackages}
          showStaffStats={showStaffStats}
          setShowStaffStats={setShowStaffStats}
          showSubscribers={showSubscribers}
          setShowSubscribers={setShowSubscribers}
          walletNumber={walletNumber}
        />
      );
    }

    if (view === 'packages' && garage) {
      return (
        <PackagesModal 
          packages={sortedPackages}
          onClose={() => setView('garage')}
          garageHourlyRate={garage.hourlyRate}
          walletNumber={walletNumber}
          billingModel={garage.billingModel}
          subscriptionPrices={subscriptionPrices}
        />
      );
    }

    // Safe fallback to login if state is inconsistent
    return <LoginView 
      loginPhone={loginPhone}
      setLoginPhone={setLoginPhone}
      handleGarageLogin={handleGarageLogin}
      isLoading={isLoading || !isAuthReady}
      closeKeyboard={closeKeyboard}
    />;
  };

  // --- Landscape Orientation Check for Mobiles ---
  if (isLandscapeMobile) {
    return <LandscapeMobileView garage={view === 'garage' ? garage : null} />;
  }

  // --- Offline Mode (Gatekeeper) ---
  if (showOfflineScreen) {
    return <OfflineView />;
  }

  return (
    <div className="w-full h-full bg-[#faf9f6] dark:bg-slate-950 transition-colors">
      <ErrorBoundary>
        <SplashScreen />
        {toast && (
          <div 
            onClick={() => setToast(null)}
            className="fixed inset-0 z-[250] bg-slate-950/60 dark:bg-black/75 flex items-center justify-center p-4 animate-overlay-30fps cursor-pointer"
          >
            <div 
              className="w-full max-w-sm bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-[28px] p-6 shadow-2xl flex flex-col items-center text-center animate-popup-30fps select-none"
            >
              <div 
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 border-2 ${
                  toast.type === 'error' 
                    ? 'bg-red-500/10 text-red-500 border-2 border-red-500/20' 
                    : ''
                }`}
                style={toast.type === 'error' ? {} : {
                  backgroundColor: `${resolvedColor}15`,
                  color: resolvedColor,
                  borderColor: `${resolvedColor}30`
                }}
              >
                {toast.type === 'error' ? (
                  <XCircle className="w-9 h-9 stroke-[2.5]" />
                ) : (
                  <CheckCircle2 className="w-9 h-9 stroke-[2.5]" />
                )}
              </div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight mb-2">
                {toast.type === 'error' ? 'تنبيه' : 'تم بنجاح'}
              </h4>
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                {toast.message}
              </p>
            </div>
          </div>
        )}

        {showCheckInModal && garage && (
          <CheckInModal 
            newPlateNumber={newPlateNumber}
            garage={garage}
            isLoading={isLoading}
            loadingType={loadingType}
            onCheckIn={handleCheckIn}
            onCancel={() => setShowCheckInModal(false)}
          />
        )}

        {showCheckOutModal && selectedVehicle && garage && (
          <CheckOutModal 
            selectedVehicle={selectedVehicle}
            garage={garage}
            isLoading={isLoading}
            loadingType={loadingType}
            now={now}
            onConfirm={confirmCheckOut}
            onDelete={handleDeleteVehicle}
            onCancel={() => { setShowCheckOutModal(false); setSelectedVehicle(null); }}
          />
        )}

        {showDeleteConfirm && view === 'admin_garage_details' && selectedGarageForDetails && (
          <DeleteGarageConfirmModal 
            garage={selectedGarageForDetails}
            isLoading={isLoading}
            onConfirm={() => deleteGarage(selectedGarageForDetails)}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}

        {showDeleteConfirm && selectedVehicle && (
          <DeleteVehicleConfirmModal 
            vehicle={selectedVehicle}
            isLoading={isLoading}
            onConfirm={handleDeleteVehicle}
            onCancel={() => { setShowDeleteConfirm(false); setSelectedVehicle(null); }}
          />
        )}

        {showRecentExitWarning && recentVehicle && (
          <RecentExitWarningModal 
            vehicle={recentVehicle}
            now={now}
            onConfirm={() => {
              if (pendingCheckInType) {
                setShowRecentExitWarning(false);
                handleCheckIn(pendingCheckInType);
              }
            }}
            onCancel={() => {
              setShowRecentExitWarning(false);
              setRecentVehicle(null);
              setNewPlateNumber('');
            }}
          />
        )}

        {showSubscriberWarning && subscriberWarningPlate && (
          <SubscriberWarningModal 
            plateNumber={subscriberWarningPlate}
            onConfirm={() => {
              setShowSubscriberWarning(false);
              setSubscriberWarningPlate('');
            }}
          />
        )}

        {showLogoutConfirm && (
          <LogoutConfirmModal 
            onConfirm={handleLogout}
            onCancel={() => setShowLogoutConfirm(false)}
            correctPin={activeAdminPin}
          />
        )}

        {isWaitingForApproval && (
          <div className="fixed inset-0 bg-slate-900/90 dark:bg-slate-950/95 z-[20002] flex items-center justify-center p-6 text-center" dir="rtl">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center gap-6 border-4 border-white/10 dark:border-slate-800 shadow-2xl transition-all">
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-2xl flex items-center justify-center animate-pulse">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">جاري طلب الإذن...</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-4">
                  الحساب مفتوح على جهاز آخر. جاري إرسال طلب للموافقة على تبديل الخدمة إلى هذا الجهاز.
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  برجاء إبقاء هذه الشاشة مفتوحة...
                </p>
              </div>
              <div className="flex flex-col gap-2.5 w-full">
                <button 
                  onClick={() => {
                    if (typeof (window as any)._forceTakeoverSession === 'function') {
                      (window as any)._forceTakeoverSession();
                    }
                  }}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3.5 rounded-2xl font-black text-sm transition-all shadow-md active:scale-[0.98]"
                >
                  ⚡ سحب الجلسة والدخول مباشرة
                </button>
                <button 
                  onClick={() => {
                    if (typeof (window as any)._cancelSessionRequest === 'function') {
                      (window as any)._cancelSessionRequest();
                    } else {
                      setIsWaitingForApproval(false);
                    }
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 py-3 rounded-2xl font-bold text-xs transition-all"
                >
                  إلغاء الطلب
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingApprovalRequest && (
          <div className="fixed inset-0 bg-slate-900/90 dark:bg-slate-950/95 z-[20003] flex items-center justify-center p-6 text-center" dir="rtl">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center gap-6 border border-slate-100 dark:border-slate-800 shadow-2xl transition-all relative overflow-hidden pt-10">
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-sans">تنبيه دخول جديد! ⚠️</h2>
                <p className="text-slate-500 dark:text-slate-400 font-bold text-sm leading-relaxed px-4">
                  هناك جهاز جديد يحاول تسجيل الدخول إلى هذا الحساب حالياً.
                </p>
                <div className="bg-amber-50 dark:bg-amber-950/40 p-4 rounded-2xl border border-amber-200/50 dark:border-amber-900/30 text-right">
                  <p className="text-xs font-black text-amber-800 dark:text-amber-400 flex items-center gap-2">
                    <span>📱 جهاز جديد يحتاج لموافقتك</span>
                  </p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
                    إذا قبلت، فسيتم تسجيل الخروج من هذا الجهاز ونقل العمل للجهاز الجديد فوراً.
                  </p>
                </div>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-4">
                  هل تريد السماح للجهاز الجديد بالدخول وتكملة العمل هناك؟
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <button 
                  onClick={handleAcceptApprovalRequest}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
                >
                  نعم، قبول
                </button>
                <button 
                  onClick={handleRejectApprovalRequest}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black text-base shadow-lg shadow-red-600/20 active:scale-[0.98] transition-all"
                >
                  رفض
                </button>
              </div>
            </div>
          </div>
        )}

      {renderView()}
      </ErrorBoundary>
    </div>
  );
}
