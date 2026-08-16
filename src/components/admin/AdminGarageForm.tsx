import React, { useState } from 'react';
import { Package, Delegate } from '../../types';
import { calculateFinalPrice } from '../../utils';

interface AdminGarageFormProps {
  onSubmit: (formData: any) => void;
  delegates: Delegate[];
  packages: Package[];
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLoading?: boolean;
}

export const AdminGarageForm: React.FC<AdminGarageFormProps> = ({
  onSubmit,
  delegates,
  packages,
  showToast,
  isLoading = false
}) => {
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [ownerPin, setOwnerPin] = useState('');
  const [address, setAddress] = useState('');
  const [hourlyRate, setHourlyRate] = useState('10');
  const [overnightRate, setOvernightRate] = useState('20');
  const [hasMonthlySubscribers, setHasMonthlySubscribers] = useState(false);
  const [isTrial, setIsTrial] = useState(false);
  const [priceScope, setPriceScope] = useState<'new_only' | 'all'>('new_only');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('monthly_sub');
  const [selectedDelegateId, setSelectedDelegateId] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      if (showToast) showToast('يرجى إدخال اسم الجراج', 'error');
      return;
    }
    if (!ownerName.trim()) {
      if (showToast) showToast('يرجى إدخال اسم مالك الجراج', 'error');
      return;
    }
    if (!phone.trim()) {
      if (showToast) showToast('يرجى إدخال رقم الهاتف', 'error');
      return;
    }

    onSubmit({
      name,
      ownerName,
      phone,
      ownerPin,
      address,
      hourlyRate: parseFloat(hourlyRate) || 0,
      overnightRate: parseFloat(overnightRate) || 0,
      hasMonthlySubscribers,
      isTrial,
      priceScope,
      selectedPackageId,
      selectedDelegateId
    });
  };

  const selectedPackage = packages.find(p => p.id === selectedPackageId) || packages[0];
  const priceInfo = selectedPackage ? calculateFinalPrice(selectedPackage, hasMonthlySubscribers) : null;

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
      <h3 className="text-lg font-black text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
        إضافة جراج جديد
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم الجراج *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: جراج الحرية"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">اسم المالك *</label>
          <input
            type="text"
            required
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            placeholder="اسم مالك الجراج"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رقم الهاتف *</label>
          <input
            type="text"
            inputMode="numeric"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            placeholder="010xxxxxxxx"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">رمز الدخول الخاص (PIN)</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={ownerPin}
            onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ''))}
            placeholder="اختياري (توليد تلقائي)"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">العنوان / الملاحظات</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="العنوان التفصيلي للجراج"
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">المندوب المسند للجراج</label>
          <select
            value={selectedDelegateId}
            onChange={(e) => setSelectedDelegateId(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">بدون مندوب (مباشر)</option>
            {delegates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.phone})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">سعر الساعة (ج.م)</label>
          <input
            type="text"
            inputMode="numeric"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">سعر المبيت (ج.م)</label>
          <input
            type="text"
            inputMode="numeric"
            value={overnightRate}
            onChange={(e) => setOvernightRate(e.target.value.replace(/\D/g, ''))}
            className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
        <input
          type="checkbox"
          id="monthly_subs_toggle"
          checked={hasMonthlySubscribers}
          onChange={(e) => setHasMonthlySubscribers(e.target.checked)}
          className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
        />
        <label htmlFor="monthly_subs_toggle" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          يحتوي الجراج على مشتركين شهريين (إضافة 25% زيادة على سعر باقة الاشتراك)
        </label>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">باقة الاشتراك الأولى</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {packages.map((pkg) => {
            const { finalPrice } = calculateFinalPrice(pkg, hasMonthlySubscribers);
            const isSelected = selectedPackageId === pkg.id;
            return (
              <div
                key={pkg.id}
                onClick={() => setSelectedPackageId(pkg.id)}
                className={`cursor-pointer p-4 rounded-xl border transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-sm text-slate-900 dark:text-white">{pkg.name}</div>
                <div className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {finalPrice} ج.م
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {priceInfo && (
        <div className="p-4 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl border border-emerald-500/30 flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">إجمالي المبلغ المطلوب للتفعيل:</span>
          <span className="text-lg font-mono font-black text-emerald-600 dark:text-emerald-400">
            {isTrial ? '0 ج.م (فترة تجريبية مجانية)' : `${priceInfo.finalPrice} ج.م`}
          </span>
        </div>
      )}

      {/* Price Scope Selector */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">نطاق تطبيق السعر:</label>
        <select
          value={priceScope}
          onChange={(e) => setPriceScope(e.target.value as 'new_only' | 'all')}
          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="new_only">جراجات جديدة فقط</option>
          <option value="all">جميع الجراجات (بما فيها الحالية)</option>
        </select>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {priceScope === 'all'
            ? '⚠️ هيأثر على كل الجراجات الحالية كمان'
            : '✅ هيأثر على الجراجات الجديدة بس'}
        </p>
      </div>

      {/* Free Trial Checkbox */}
      <label className="flex items-center gap-3 cursor-pointer p-3 border border-blue-200 dark:border-blue-900/60 rounded-xl bg-blue-50/80 dark:bg-blue-950/30 transition-all select-none">
        <input
          type="checkbox"
          checked={isTrial}
          onChange={(e) => setIsTrial(e.target.checked)}
          className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
        />
        <span className="text-xs font-black text-blue-950 dark:text-blue-200">تفعيل فترة تجريبية مجانية (15 يوم)</span>
      </label>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all shadow-md active:scale-95"
      >
        {isLoading ? 'جاري إنشاء الجراج...' : 'حفظ وإنشاء الجراج'}
      </button>
    </form>
  );
};

export default AdminGarageForm;
