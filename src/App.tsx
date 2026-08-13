/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, lazy, Suspense } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Shield,
} from 'lucide-react';
import { safeDate, resolveShimmerColor } from './utils';
import { useTheme } from './utils/ThemeContext';
import { useLocalStorageState } from './hooks/useLocalStorage';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { LandscapeMobileView } from './components/layout/LandscapeMobileView';
import { OfflineView } from './components/layout/OfflineView';

import { LoginView } from './components/auth/LoginView';
import { AdminLoginView } from './components/auth/AdminLoginView';
import { DelegateLoginView } from './components/auth/DelegateLoginView';
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
import { useAppStore } from './store/appStore';

// Lazy Loaded Dashboard Views
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const GeneralManagerDashboard = lazy(() => import('./components/general_manager/GeneralManagerDashboard').then(m => ({ default: m.GeneralManagerDashboard })));
const DelegateDashboardView = lazy(() => import('./components/delegate/DelegateDashboardView').then(m => ({ default: m.DelegateDashboardView })));
const AdminGarageDetailsView = lazy(() => import('./components/admin/AdminGarageDetailsView').then(m => ({ default: m.AdminGarageDetailsView })));
const AdminDelegateDetailsView = lazy(() => import('./components/admin/AdminDelegateDetailsView').then(m => ({ default: m.AdminDelegateDetailsView })));
const GarageDashboardView = lazy(() => import('./components/garage/GarageDashboardView').then(m => ({ default: m.GarageDashboardView })));

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
    removeDelegate
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

  const storeToasts = useAppStore((state) => state.toasts);
  const removeToast = useAppStore((state) => state.removeToast);

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
        <ErrorBoundary>
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
        </ErrorBoundary>
      );
    }

    if (view === 'general_manager_dashboard' && currentGeneralManager) {
      return (
        <ErrorBoundary>
          <GeneralManagerDashboard 
            currentGeneralManager={currentGeneralManager}
            allGarages={allGarages}
            onLogout={handleInitiateLogout}
          />
        </ErrorBoundary>
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
        <ErrorBoundary>
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
        </ErrorBoundary>
      );
    }

    if (view === 'admin_garage_details' && selectedGarageForDetails) {
      return (
        <ErrorBoundary>
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
            allGarages={allGarages}
          />
        </ErrorBoundary>
      );
    }

    if (view === 'admin_delegate_details' && selectedDelegateForDetails) {
      // Find the most up-to-date delegate data from our synced delegates list
      const liveDelegate = delegates.find(d => d.id === selectedDelegateForDetails.id) || selectedDelegateForDetails;
      if (!liveDelegate) return <div className="p-8 text-center">جاري التحميل...</div>;
      
      return (
        <ErrorBoundary>
          <AdminDelegateDetailsView 
            delegate={liveDelegate}
            setView={setView}
            setSelectedDelegate={setSelectedDelegateForDetails}
            removeDelegate={removeDelegate}
          />
        </ErrorBoundary>
      );
    }

    if (view === 'garage' && garage) {
      return (
        <ErrorBoundary>
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
            subscriptionPrices={subscriptionPrices}
          />
        </ErrorBoundary>
      );
    }

    if (view === 'packages' && garage) {
      return (
        <PackagesModal 
          packages={sortedPackages}
          onClose={() => setView('garage')}
          garageHourlyRate={garage.hourlyRate}
          walletNumber={walletNumber}
          subscriptionPrices={subscriptionPrices}
          hasMonthlySubscribers={garage.hasMonthlySubscribers}
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

  // --- Initial Loading State ---
  if (!isAuthReady) {
    return (
      <div className="w-full h-full min-h-screen bg-[#faf9f6] dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-300 font-bold text-sm animate-pulse">
          جاري تحميل البيانات...
        </p>
      </div>
    );
  }

  const isLoggedIn = Boolean(view && view !== 'login');

  return (
    <div 
      className={`w-full h-full bg-[#faf9f6] dark:bg-transparent transition-colors ${isLoggedIn ? 'theme-logged-in' : ''}`}
      style={{ '--theme-accent-color': resolvedColor } as React.CSSProperties}
    >
      <ErrorBoundary>
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



        {storeToasts.length > 0 && (
          <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
            {storeToasts.map((t) => (
              <div
                key={t.id}
                onClick={() => removeToast(t.id)}
                className={`px-4 py-3 rounded-xl shadow-lg font-bold text-xs flex items-center justify-between cursor-pointer transition-all ${
                  t.type === 'error'
                    ? 'bg-red-600 text-white'
                    : t.type === 'warning'
                    ? 'bg-amber-500 text-white'
                    : t.type === 'info'
                    ? 'bg-blue-600 text-white'
                    : 'bg-emerald-600 text-white'
                }`}
              >
                <span>{t.message}</span>
              </div>
            ))}
          </div>
        )}

        <Suspense fallback={
          <div className="w-full h-full min-h-screen bg-[#faf9f6] dark:bg-slate-950 flex flex-col items-center justify-center p-4 text-center font-sans" dir="rtl">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-slate-600 dark:text-slate-300 font-bold text-xs animate-pulse">
              جاري تحميل الصفحة...
            </p>
          </div>
        }>
          {renderView()}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
