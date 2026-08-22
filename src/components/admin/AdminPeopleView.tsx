/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, memo } from 'react';
import { 
  Users, 
  Plus, 
  Shield, 
  RefreshCw, 
  Trash2, 
  Check, 
  Loader2, 
  Briefcase
} from 'lucide-react';
import { Delegate, Supervisor, GeneralManager } from '../../types';
import { firestoreServiceV2 as firestoreService } from '../../services/domain/firestoreServiceV2';
import { generateSafePin } from '../../utils';
import { useTheme } from '../../utils/ThemeContext';
import { useAdminTranslation } from '../../utils/adminTranslations';

interface AdminPeopleViewProps {
  delegates: Delegate[];
  supervisors: Supervisor[];
  generalManagers: GeneralManager[];
  currentSupervisor: Supervisor | null;
  onSelectDelegate: (delegate: Delegate) => void;
}

export const AdminPeopleView = memo(({
  delegates,
  supervisors,
  generalManagers,
  currentSupervisor,
  onSelectDelegate
}: AdminPeopleViewProps) => {
  const { adminLang } = useTheme();
  const t = useAdminTranslation(adminLang);
  const [subTab, setSubTab] = useState<'delegates' | 'supervisors' | 'general_managers'>('delegates');

  // Delegates State
  const [delegateForm, setDelegateForm] = useState({ name: '', phone: '', pin: '', canCreateGarage: false });
  const [isSubmittingDelegate, setIsSubmittingDelegate] = useState(false);

  // Supervisors State
  const [supervisorForm, setSupervisorForm] = useState({ name: '', phone: '', pin: '' });
  const [isSubmittingSupervisor, setIsSubmittingSupervisor] = useState(false);
  const [editingSupervisorPinId, setEditingSupervisorPinId] = useState<string | null>(null);
  const [editingSupervisorPinValue, setEditingSupervisorPinValue] = useState('');
  const [isUpdatingSupervisorPin, setIsUpdatingSupervisorPin] = useState(false);

  // General Managers State
  const [gmForm, setGmForm] = useState({ name: '', phone: '', pin: '' });
  const [isSubmittingGm, setIsSubmittingGm] = useState(false);
  const [editingGmPinId, setEditingGmPinId] = useState<string | null>(null);
  const [editingGmPinValue, setEditingGmPinValue] = useState('');
  const [isUpdatingGmPin, setIsUpdatingGmPin] = useState(false);

  const handleCreateDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateForm.name || !delegateForm.phone || !delegateForm.pin) return;
    setIsSubmittingDelegate(true);
    try {
      const pinCheck = await firestoreService.isPinTaken(delegateForm.pin);
      if (pinCheck.taken) {
        setIsSubmittingDelegate(false);
        return;
      }
      await firestoreService.addDelegate({
        name: delegateForm.name,
        phone: delegateForm.phone,
        pin: delegateForm.pin,
        canCreateGarage: delegateForm.canCreateGarage,
        totalRechargedAmount: 0,
        role: 'delegate',
        createdAt: new Date()
      });
      setDelegateForm({ name: '', phone: '', pin: '', canCreateGarage: false });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingDelegate(false);
    }
  };

  const handleCreateSupervisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorForm.name || !supervisorForm.phone || !supervisorForm.pin) return;
    setIsSubmittingSupervisor(true);
    try {
      const pinCheck = await firestoreService.isPinTaken(supervisorForm.pin);
      if (pinCheck.taken) {
        setIsSubmittingSupervisor(false);
        return;
      }
      await firestoreService.addSupervisor({
        name: supervisorForm.name,
        phone: supervisorForm.phone,
        pin: supervisorForm.pin,
        role: 'supervisor',
        createdAt: new Date()
      });
      setSupervisorForm({ name: '', phone: '', pin: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingSupervisor(false);
    }
  };

  const handleCreateGm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmForm.name || !gmForm.phone || !gmForm.pin) return;
    setIsSubmittingGm(true);
    try {
      const pinCheck = await firestoreService.isPinTaken(gmForm.pin);
      if (pinCheck.taken) {
        setIsSubmittingGm(false);
        return;
      }
      await firestoreService.addGeneralManager({
        name: gmForm.name,
        phone: gmForm.phone,
        pin: gmForm.pin,
        role: 'general_manager',
        garageIds: [],
        createdAt: new Date()
      });
      setGmForm({ name: '', phone: '', pin: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingGm(false);
    }
  };

  return (
    <div className="space-y-6 font-sans pb-16" dir={adminLang === 'en' ? 'ltr' : 'rtl'}>
      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-800 w-full sm:max-w-xl flex-nowrap overflow-x-auto">
        <button
          type="button"
          onClick={() => setSubTab('delegates')}
          className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-3 rounded-xl font-black text-[11px] sm:text-xs transition-all cursor-pointer ${
            subTab === 'delegates'
              ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
          <span className="text-mobile-wrap text-center leading-tight">{t('المندوبين')}</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
            subTab === 'delegates'
              ? 'bg-amber-400 text-slate-900 dark:bg-slate-950 dark:text-amber-400'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            {delegates.length}
          </span>
        </button>

        {!currentSupervisor && (
          <>
            <button
              type="button"
              onClick={() => setSubTab('supervisors')}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-3 rounded-xl font-black text-[11px] sm:text-xs transition-all cursor-pointer ${
                subTab === 'supervisors'
                  ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-mobile-wrap text-center leading-tight">{t('المشرفين')}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                subTab === 'supervisors'
                  ? 'bg-amber-400 text-slate-900 dark:bg-slate-950 dark:text-amber-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {supervisors.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubTab('general_managers')}
              className={`flex-1 min-w-0 flex items-center justify-center gap-1.5 sm:gap-2 py-2.5 px-2 sm:px-3 rounded-xl font-black text-[11px] sm:text-xs transition-all cursor-pointer ${
                subTab === 'general_managers'
                  ? 'bg-slate-900 dark:bg-amber-400 text-amber-400 dark:text-slate-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="text-mobile-wrap text-center leading-tight">{t('المديرين العموم')}</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${
                subTab === 'general_managers'
                  ? 'bg-amber-400 text-slate-900 dark:bg-slate-950 dark:text-amber-400'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}>
                {generalManagers.length}
              </span>
            </button>
          </>
        )}
      </div>

      {/* Delegates Section */}
      {subTab === 'delegates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Delegate Form */}
          <section className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <span>{t('إضافة مندوب جديد')}</span>
              </h3>

              <form onSubmit={handleCreateDelegate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('اسم المندوب')}</label>
                  <input 
                    value={delegateForm.name}
                    onChange={(e) => setDelegateForm({ ...delegateForm, name: e.target.value })}
                    placeholder={t('الاسم الثلاثي...')} 
                    required 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('رقم الموبايل')}</label>
                  <input 
                    value={delegateForm.phone}
                    onChange={(e) => setDelegateForm({ ...delegateForm, phone: e.target.value })}
                    placeholder="01xxxxxxxxx" 
                    required 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-emerald-500 transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('رمز الدخول (6 أرقام)')}</label>
                  <div className="relative">
                    <input 
                      type="tel"
                      inputMode="numeric"
                      value={delegateForm.pin}
                      onChange={(e) => setDelegateForm({ ...delegateForm, pin: e.target.value.replace(/\D/g, '') })}
                      placeholder="••••••" 
                      maxLength={6}
                      required 
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-black text-slate-900 dark:text-white outline-none focus:border-emerald-500 text-center tracking-[0.3em] transition-all px-10" 
                    />
                    <button
                      type="button"
                      onClick={() => setDelegateForm({ ...delegateForm, pin: generateSafePin(delegates.map(d => d.pin)) })}
                      className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                      title={t('توليد رقم سري عشوائي')}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setDelegateForm({ ...delegateForm, canCreateGarage: !delegateForm.canCreateGarage })}
                  className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                    delegateForm.canCreateGarage 
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 text-emerald-700 dark:text-emerald-400' 
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500'
                  }`}
                >
                  <span className="font-black text-xs">{t('السماح بإنشاء جراجات جديدة')}</span>
                  <div className={`w-5 h-5 rounded flex items-center justify-center ${delegateForm.canCreateGarage ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-700'}`}>
                    {delegateForm.canCreateGarage && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>

                <button 
                  type="submit" 
                  disabled={isSubmittingDelegate}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {isSubmittingDelegate ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{t('إضافة المندوب')}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>

          {/* Delegates Directory */}
          <section className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-500" />
                  <span>{t('المندوبين المعتمدين')}</span>
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {delegates.length} {t('مندوب')}
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {delegates.map((d) => (
                  <div 
                    key={d.id} 
                    onClick={() => onSelectDelegate(d)}
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl hover:border-emerald-500 cursor-pointer group flex flex-col justify-between h-36 transition-all shadow-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                          {d.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-mobile-wrap font-black text-slate-900 dark:text-white text-xs leading-snug group-hover:text-emerald-600 transition-colors">
                            {d.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{d.phone}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[10px]">
                      <div className="flex items-center gap-1 font-mono">
                        <span className="text-slate-400">{t('PIN:')}</span>
                        <span className="font-black text-emerald-600 dark:text-emerald-400">{d.pin}</span>
                      </div>
                      <span className="font-mono font-black text-slate-700 dark:text-slate-300">
                        +{(d.totalRechargedAmount || 0).toLocaleString()} {t('ج.م')}
                      </span>
                    </div>
                  </div>
                ))}

                {delegates.length === 0 && (
                  <div className="col-span-full py-12 text-center text-xs font-bold text-slate-400">
                    {t('لا يوجد مندوبين مسجلين في النظام')}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Supervisors Section */}
      {subTab === 'supervisors' && !currentSupervisor && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add Supervisor Form */}
          <section className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-500/10 text-purple-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <span>{t('إضافة مشرف جديد')}</span>
              </h3>

              <form onSubmit={handleCreateSupervisor} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('اسم المشرف')}</label>
                  <input 
                    value={supervisorForm.name}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, name: e.target.value })}
                    placeholder={t('الاسم...')} 
                    required 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-purple-500 transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('رقم الموبايل')}</label>
                  <input 
                    value={supervisorForm.phone}
                    onChange={(e) => setSupervisorForm({ ...supervisorForm, phone: e.target.value })}
                    placeholder="01xxxxxxxxx" 
                    required 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-purple-500 transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('رمز الدخول (6 أرقام)')}</label>
                  <div className="relative">
                    <input 
                      type="tel"
                      inputMode="numeric"
                      value={supervisorForm.pin}
                      onChange={(e) => setSupervisorForm({ ...supervisorForm, pin: e.target.value.replace(/\D/g, '') })}
                      placeholder="••••••" 
                      maxLength={6}
                      required 
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-black text-slate-900 dark:text-white outline-none focus:border-purple-500 text-center tracking-[0.3em] transition-all px-10" 
                    />
                    <button
                      type="button"
                      onClick={() => setSupervisorForm({ ...supervisorForm, pin: generateSafePin(supervisors.map(s => s.pin)) })}
                      className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                      title={t('توليد رقم سري')}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmittingSupervisor}
                  className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {isSubmittingSupervisor ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{t('إضافة المشرف')}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>

          {/* Supervisors Directory */}
          <section className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-500" />
                  <span>{t('المشرفين المعتمدين')}</span>
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {supervisors.length} {t('مشرف')}
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {supervisors.map((s) => (
                  <div 
                    key={s.id} 
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-col justify-between h-36"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-950/40 text-purple-600 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-mobile-wrap font-black text-slate-900 dark:text-white text-xs leading-snug">{s.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{s.phone}</span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (window.confirm(adminLang === 'en' ? 'Delete this supervisor?' : 'هل أنت متأكد من حذف المشرف؟')) {
                            await firestoreService.removeSupervisor(s.id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                        title={t('حذف المشرف')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">{t('الرمز السري:')}</span>
                      {editingSupervisorPinId === s.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={editingSupervisorPinValue}
                            maxLength={6}
                            onChange={(e) => setEditingSupervisorPinValue(e.target.value.replace(/\D/g, ''))}
                            className="w-14 text-center font-mono font-black text-[10px] bg-white dark:bg-slate-900 border rounded px-1"
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              if (editingSupervisorPinValue.length < 4) return;
                              setIsUpdatingSupervisorPin(true);
                              try {
                                await firestoreService.updateSupervisor(s.id, { pin: editingSupervisorPinValue });
                                s.pin = editingSupervisorPinValue;
                                setEditingSupervisorPinId(null);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsUpdatingSupervisorPin(false);
                              }
                            }}
                            className="text-emerald-600 font-bold"
                          >
                            {isUpdatingSupervisorPin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-black text-purple-600 dark:text-purple-400">{s.pin}</span>
                          <button
                            onClick={() => {
                              setEditingSupervisorPinId(s.id);
                              setEditingSupervisorPinValue(s.pin || '');
                            }}
                            className="text-[10px] text-purple-600 hover:underline font-bold"
                          >
                            {t('تعديل')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {supervisors.length === 0 && (
                  <div className="col-span-full py-12 text-center text-xs font-bold text-slate-400">
                    {t('لا يوجد مشرفين مسجلين')}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* General Managers Section */}
      {subTab === 'general_managers' && !currentSupervisor && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add GM Form */}
          <section className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-base font-black text-slate-900 dark:text-white mb-5 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center">
                  <Plus className="w-4 h-4 stroke-[3]" />
                </div>
                <span>{t('إضافة مدير عام')}</span>
              </h3>

              <form onSubmit={handleCreateGm} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('الاسم')}</label>
                  <input 
                    value={gmForm.name}
                    onChange={(e) => setGmForm({ ...gmForm, name: e.target.value })}
                    placeholder={t('الاسم...')} 
                    required 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('رقم الموبايل')}</label>
                  <input 
                    value={gmForm.phone}
                    onChange={(e) => setGmForm({ ...gmForm, phone: e.target.value })}
                    placeholder="01xxxxxxxxx" 
                    required 
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-all" 
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">{t('رمز الدخول (6 أرقام)')}</label>
                  <div className="relative">
                    <input 
                      type="tel"
                      inputMode="numeric"
                      value={gmForm.pin}
                      onChange={(e) => setGmForm({ ...gmForm, pin: e.target.value.replace(/\D/g, '') })}
                      placeholder="••••••" 
                      maxLength={6}
                      required 
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-black text-slate-900 dark:text-white outline-none focus:border-blue-500 text-center tracking-[0.3em] transition-all px-10" 
                    />
                    <button
                      type="button"
                      onClick={() => setGmForm({ ...gmForm, pin: generateSafePin(generalManagers.map(g => g.pin)) })}
                      className="absolute left-2 top-2 bottom-2 aspect-square flex items-center justify-center bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                      title={t('توليد رقم سري')}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isSubmittingGm}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                >
                  {isSubmittingGm ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    <>
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{t('إضافة المدير العام')}</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </section>

          {/* GM Directory */}
          <section className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-blue-500" />
                  <span>{t('المديرين العموم المعتمدين')}</span>
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {generalManagers.length} {t('مدير')}
                </span>
              </div>

              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {generalManagers.map((gm) => (
                  <div 
                    key={gm.id} 
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl flex flex-col justify-between h-36"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-xl flex items-center justify-center font-black text-xs shrink-0">
                          {gm.name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="text-mobile-wrap font-black text-slate-900 dark:text-white text-xs leading-snug">{gm.name}</h4>
                          <span className="text-[10px] text-slate-400 font-mono block mt-0.5">{gm.phone}</span>
                        </div>
                      </div>

                      <button
                        onClick={async () => {
                          if (window.confirm(adminLang === 'en' ? 'Delete this general manager?' : 'هل أنت متأكد من حذف المدير العام؟')) {
                            await firestoreService.removeGeneralManager(gm.id);
                          }
                        }}
                        className="text-slate-400 hover:text-rose-500 p-1 transition-colors"
                        title={t('حذف')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400">{t('الرمز السري:')}</span>
                      {editingGmPinId === gm.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="tel"
                            inputMode="numeric"
                            value={editingGmPinValue}
                            maxLength={6}
                            onChange={(e) => setEditingGmPinValue(e.target.value.replace(/\D/g, ''))}
                            className="w-14 text-center font-mono font-black text-[10px] bg-white dark:bg-slate-900 border rounded px-1"
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              if (editingGmPinValue.length < 4) return;
                              setIsUpdatingGmPin(true);
                              try {
                                await firestoreService.updateGeneralManager(gm.id, { pin: editingGmPinValue });
                                gm.pin = editingGmPinValue;
                                setEditingGmPinId(null);
                              } catch (err) {
                                console.error(err);
                              } finally {
                                setIsUpdatingGmPin(false);
                              }
                            }}
                            className="text-emerald-600 font-bold"
                          >
                            {isUpdatingGmPin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-black text-blue-600 dark:text-blue-400">{gm.pin}</span>
                          <button
                            onClick={() => {
                              setEditingGmPinId(gm.id);
                              setEditingGmPinValue(gm.pin || '');
                            }}
                            className="text-[10px] text-blue-600 hover:underline font-bold"
                          >
                            {t('تعديل')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {generalManagers.length === 0 && (
                  <div className="col-span-full py-12 text-center text-xs font-bold text-slate-400">
                    {t('لا يوجد مديرين عموم مسجلين')}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
});
