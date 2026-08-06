import { describe, it, expect } from 'vitest';
import { useAdminTranslation } from './adminTranslations';

describe('Admin Translations Hook Helper', () => {
  it('returns exact original Arabic string when language is ar', () => {
    const t = useAdminTranslation('ar');
    expect(t('المدير العام')).toBe('المدير العام');
    expect(t('الجراجات')).toBe('الجراجات');
    expect(t('نص غير موجود')).toBe('نص غير موجود');
  });

  it('translates Arabic strings to English when language is en', () => {
    const t = useAdminTranslation('en');
    expect(t('المدير العام')).toBe('General Manager');
    expect(t('الجراجات')).toBe('Garages');
    expect(t('سعر الساعة')).toBe('Hourly price');
  });

  it('falls back to the provided string if English dictionary key is missing', () => {
    const t = useAdminTranslation('en');
    expect(t('كلمة جديدة بدون ترجمة')).toBe('كلمة جديدة بدون ترجمة');
  });
});
