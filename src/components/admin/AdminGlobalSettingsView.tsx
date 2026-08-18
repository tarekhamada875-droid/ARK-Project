import React, { useState, useEffect } from 'react';
import { 
  Save, 
  ShieldAlert, 
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SystemConfig } from '../../types';
import { firestoreServiceV2 as firestoreService } from '../../services/domain/firestoreServiceV2';
import { useTheme } from '../../utils/ThemeContext';
import { useAdminTranslation } from '../../utils/adminTranslations';

interface AdminGlobalSettingsViewProps {
  // Cleaned up - no showToast to avoid duplicate notifications
}

export const AdminGlobalSettingsView: React.FC<AdminGlobalSettingsViewProps> = () => {
  const { adminLang } = useTheme();
  const t = useAdminTranslation(adminLang);

  const [config, setConfig] = useState<SystemConfig>({
    defaultTrialDays: 15,
    warningDaysThreshold: 3,
    monthlySubscribersSurchargePercent: 25,
    isMaintenanceMode: false,
    maintenanceMessage: ''
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const loadConfig = async () => {
      try {
        const config = await firestoreService.getSystemConfig();
        if (config) {
          setConfig(prev => ({ ...prev, ...config }));
        }
      } catch (e) {
        console.error('Failed to load system config:', e);
      } finally {
        clearTimeout(timeout);
        setIsLoading(false);
      }
    };
    
    timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);
    
    loadConfig();
    
    return () => clearTimeout(timeout);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await firestoreService.updateSystemConfig({
        defaultTrialDays: Number(config.defaultTrialDays) || 15,
        warningDaysThreshold: Number(config.warningDaysThreshold) || 3,
        monthlySubscribersSurchargePercent: Number(config.monthlySubscribersSurchargePercent) || 25,
        isMaintenanceMode: !!config.isMaintenanceMode,
        maintenanceMessage: (config.maintenanceMessage || '').trim()
      });
      setStatusMessage({ type: 'success', text: t('تم حفظ وتحديث الإعدادات العامة للنظام بنجاح') });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: 'error', text: t('فشل حفظ الإعدادات العامة') });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-sm font-bold text-slate-400">{t('جاري تحميل الإعدادات...')}</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Subscriptions & Trials */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <span>{t('فترات التجربة والتنبيهات')}</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                {t('مدة الفترة التجريبية المجانية الافتراضية (بالأيام)')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={config.defaultTrialDays}
                  onChange={(e) => setConfig({ ...config, defaultTrialDays: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-mono font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {t('يوم')}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400">
                {t('المدة التي تُمنح للجراجات الجديدة عند اختيار تفعيل التجربة المجانية (افتراضياً 15 يوماً)')}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
                {t('حد التنبيه باقتراب انتهاء الاشتراك (بالأيام)')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={config.warningDaysThreshold}
                  onChange={(e) => setConfig({ ...config, warningDaysThreshold: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                  className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-mono font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                  required
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  {t('أيام أو أقل')}
                </span>
              </div>
              <p className="text-[10px] font-bold text-slate-400">
                {t('يظهر شريط تحذيري للجراج والمندوب عندما يتبقى هذا العدد من الأيام (افتراضياً 3 أيام)')}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 dark:text-slate-300 block">
              {t('نسبة الزيادة للمشتركين الشهريين (%)')}
            </label>
            <div className="relative max-w-xs">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={config.monthlySubscribersSurchargePercent}
                onChange={(e) => setConfig({ ...config, monthlySubscribersSurchargePercent: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl font-mono font-bold text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                required
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                %
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400">
              {t('النسبة المضافة تلقائياً عند تفعيل خيار المشتركين الشهريين للجراج (افتراضياً 25%)')}
            </p>
          </div>
        </div>

        {/* Section 2: System Maintenance Mode */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>{t('وضع الصيانة')}</span>
            </h3>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={config.isMaintenanceMode}
                onChange={(e) => setConfig({ ...config, isMaintenanceMode: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-rose-600"></div>
            </label>
          </div>

          {config.isMaintenanceMode && (
            <div className="space-y-2 animate-in fade-in duration-150">
              <label className="text-xs font-black text-rose-600 dark:text-rose-400 block">
                {t('رسالة الصيانة التي تظهر للمستخدمين')}
              </label>
              <textarea
                rows={3}
                value={config.maintenanceMessage || ''}
                onChange={(e) => setConfig({ ...config, maintenanceMessage: e.target.value })}
                placeholder={t('مثال: النظام تحت الصيانة الدورية المجدولة وسيعود للعمل خلال نصف ساعة')}
                className="w-full p-4 bg-rose-50/50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/50 rounded-xl text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-rose-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Status Feedback Banner */}
        {statusMessage && (
          <div className={`p-4 rounded-2xl border-2 flex items-center gap-3 transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}>
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span className="text-xs font-black">{statusMessage.text}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-base flex items-center justify-center gap-3 transition-all shadow-lg active:scale-98 cursor-pointer disabled:opacity-50"
        >
          {isSaving ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5 stroke-[2.5]" />
              <span>{t('حفظ وتطبيق التغييرات')}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default AdminGlobalSettingsView;
