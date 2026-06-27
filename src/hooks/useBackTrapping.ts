import { useEffect } from 'react';

interface BackTrappingProps {
  view: string;
  setView: (view: any) => void;
  showCheckInModal: boolean;
  setShowCheckInModal: (val: boolean) => void;
  showCheckOutModal: boolean;
  setShowCheckOutModal: (val: boolean) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (val: boolean) => void;
  showLogoutConfirm: boolean;
  setShowLogoutConfirm: (val: boolean) => void;
  showRecentExitWarning: boolean;
  setShowRecentExitWarning: (val: boolean) => void;
  showSubscriberWarning: boolean;
  setShowSubscriberWarning: (val: boolean) => void;
  showPackages: boolean;
  setShowPackages: (val: boolean) => void;
  showStaffStats: boolean;
  setShowStaffStats: (val: boolean) => void;
  showSubscribers: boolean;
  setShowSubscribers: (val: boolean) => void;
  setSelectedVehicle: (vehicle: any | null) => void;
  setSelectedGarageForDetails: (garage: any | null) => void;
  setSelectedDelegateForDetails: (delegate: any | null) => void;
  setRecentVehicle: (vehicle: any | null) => void;
  setSubscriberWarningPlate: (plate: string) => void;
}

export function useBackTrapping({
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
  setSubscriberWarningPlate
}: BackTrappingProps) {
  useEffect(() => {
    if (!window.history.state || !window.history.state.trapped) {
      window.history.pushState({ trapped: true }, '');
    }

    const handlePopState = () => {
      const isModalOpen = !!(
        showCheckInModal || showCheckOutModal || showDeleteConfirm || 
        showLogoutConfirm || showRecentExitWarning || showSubscriberWarning ||
        showPackages || showStaffStats || showSubscribers
      );
      const isSubView = ['admin_login', 'delegate_login', 'admin_garage_details', 'admin_delegate_details', 'packages', 'staff_stats'].includes(view);

      if (isModalOpen || isSubView) {
        window.history.pushState({ trapped: true }, '');
        
        if (showPackages) setShowPackages(false);
        if (showStaffStats) setShowStaffStats(false);
        if (showSubscribers) setShowSubscribers(false);
        if (showLogoutConfirm) setShowLogoutConfirm(false);
        if (showCheckInModal) setShowCheckInModal(false);
        if (showCheckOutModal) { setShowCheckOutModal(false); setSelectedVehicle(null); }
        if (showDeleteConfirm) { setShowDeleteConfirm(false); setSelectedVehicle(null); }
        if (showRecentExitWarning) { setShowRecentExitWarning(false); setRecentVehicle(null); }
        if (showSubscriberWarning) { setShowSubscriberWarning(false); setSubscriberWarningPlate(''); }

        if (view === 'admin_login' || view === 'delegate_login') setView('login');
        if (view === 'admin_garage_details') { setView('admin_dashboard'); setSelectedGarageForDetails(null); }
        if (view === 'admin_delegate_details') { setView('admin_dashboard'); setSelectedDelegateForDetails(null); }
        if (view === 'packages' || view === 'staff_stats') setView('garage');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    view,
    showCheckInModal,
    showCheckOutModal,
    showDeleteConfirm,
    showLogoutConfirm,
    showRecentExitWarning,
    showSubscriberWarning,
    showPackages,
    showStaffStats,
    showSubscribers,
    setView,
    setShowCheckInModal,
    setShowCheckOutModal,
    setShowDeleteConfirm,
    setShowLogoutConfirm,
    setShowRecentExitWarning,
    setShowSubscriberWarning,
    setShowPackages,
    setShowStaffStats,
    setShowSubscribers,
    setSelectedVehicle,
    setSelectedGarageForDetails,
    setSelectedDelegateForDetails,
    setRecentVehicle,
    setSubscriberWarningPlate
  ]);
}
