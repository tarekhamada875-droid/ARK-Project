/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Timestamp } from 'firebase/firestore';

export const safeDate = (date: any): Date => {
  if (!date) return new Date();
  if (date instanceof Timestamp) return date.toDate();
  if (typeof date.toDate === 'function') return date.toDate();
  
  // Handle Firestore internal object structure if passed directly
  if (typeof date === 'object' && date.seconds !== undefined) {
    try {
      return new Timestamp(date.seconds, date.nanoseconds || 0).toDate();
    } catch (e) {
      return new Date();
    }
  }

  const d = new Date(date);
  // Specifically check for epoch (0) or invalid dates
  if (isNaN(d.getTime()) || d.getTime() < 31536000000) { // If before 1971, treat as 'now'
    return new Date();
  }
  return d;
};

export const normalizeDigits = (val: string): string => {
  if (!val) return '';
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
  const arabicDecimal = '٫';
  let result = '';
  for (let i = 0; i < val.length; i++) {
    const char = val[i];
    const aIdx = arabicDigits.indexOf(char);
    if (aIdx !== -1) {
      result += aIdx.toString();
    } else {
      const pIdx = persianDigits.indexOf(char);
      if (pIdx !== -1) {
        result += pIdx.toString();
      } else if (char === arabicDecimal) {
        result += '.';
      } else {
        result += char;
      }
    }
  }
  return result;
};

export const normalizeLetters = (val: string): string => {
  if (!val) return '';
  // Force any Alef variation to be Alef with Hamza (أ) as per Egyptian plate standard
  // Also normalize Yeh (ى) to (ي) to treat them as the same as requested
  return val.replace(/[اإآ]/g, 'أ')
            .replace(/[ى]/g, 'ي');
};

/**
 * Normalizes Arabic text for flexible and resilient searching.
 * Treats Alef variations as identical, Heh/Teh Marbuta as identical, and Yeh/Alef Maksura as identical.
 */
export const normalizeArabicSearch = (text: string): string => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/[ةه]/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .trim();
};

export const getCleanPlate = (val: string): string => {
  if (!val) return '';
  const letters: string[] = [];
  const numbers: string[] = [];
  
  const normalized = normalizeLetters(val);
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    // Numbers (English, Arabic, Persian)
    if (/[0-9\u0660-\u0669\u06F0-\u06F9]/.test(char)) {
      if (numbers.length < 4) numbers.push(char);
    } 
    // Arabic Letters Only (Range \u0621-\u064A covers basic letters and hamzas)
    else if (/[\u0621-\u064A]/.test(char)) {
      if (letters.length < 4) letters.push(char);
    }
    // All other characters (symbols, latin letters) are ignored
  }
  return letters.join('') + numbers.join('');
};

export const getRawPlate = (val: string): string => {
  if (!val) return '';
  const letters: string[] = [];
  const numbers: string[] = [];
  
  const normalized = normalizeLetters(normalizeDigits(val));
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (/[0-9]/.test(char)) {
      if (numbers.length < 4) numbers.push(char);
    } else if (/[\u0621-\u064A]/.test(char)) {
      if (letters.length < 4) letters.push(char);
    }
  }
  return letters.join('') + numbers.join('');
};

export interface PlateParts {
  letters: string;
  numbers: string;
}

/**
 * Splits a plate number into its distinct letter and number segments.
 */
export const getPlateParts = (val: string): PlateParts => {
  const raw = getRawPlate(val);
  const letters = raw.replace(/[0-9]/g, '');
  const numbers = raw.replace(/[^0-9]/g, '');
  return { letters, numbers };
};

/**
 * Validates whether a plate has at least 1 letter and 1 number.
 */
export const isPlateValid = (val: string): boolean => {
  const { letters, numbers } = getPlateParts(val);
  return letters.length >= 1 && numbers.length >= 1;
};

/**
 * Formats plate letters with standard spacing.
 */
export const formatPlateLetters = (letters: string): string => {
  return letters.split('').join(' ');
};

export const normalizePhone = (phone: string): string => {
  return normalizeDigits(phone.trim()).replace(/[^\d+]/g, '');
};

export const formatPlateNumber = (val: string): string => {
  if (!val) return '';
  
  const letters: string[] = [];
  const numbers: string[] = [];
  
  const normalized = normalizeLetters(val);
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (/[0-9\u0660-\u0669\u06F0-\u06F9]/.test(char)) {
      if (numbers.length < 4) numbers.push(char);
    } else if (/[\u0621-\u064A]/.test(char)) {
      if (letters.length < 4) letters.push(char);
    }
  }
  
  if (letters.length === 0 && numbers.length === 0) return '';
  // Join letters with spaces, but numbers WITHOUT spaces to prevent RTL reversal of digit order
  return letters.join(' ') + ' : ' + numbers.join('');
};

export const getDuration = (entryTime: any, referenceNow?: Date): string => {
  const start = entryTime ? safeDate(entryTime) : new Date();
  const end = referenceNow ? safeDate(referenceNow) : new Date();
  
  // If entryTime is in the future or very close to end (pending sync)
  if (start.getTime() >= end.getTime() - 2000) return 'الآن';
  
  const diff = Math.max(0, end.getTime() - start.getTime());
  const totalMinutes = Math.floor(diff / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    let result = `${days} يوم`;
    if (hours > 0) result += ` و ${hours} ساعة`;
    if (minutes > 0) result += ` و ${minutes} دقيقة`;
    return result;
  }

  if (totalHours > 0) {
    let result = `${totalHours} ساعة`;
    if (minutes > 0) result += ` و ${minutes} دقيقة`;
    return result;
  }
  return `${minutes} دقيقة`;
};

export const calculateCost = (vehicle: any, garage: any, referenceNow?: Date): number => {
  if (!vehicle || !garage) return 0;
  
  // Default to hourly if type is missing (for legacy data in activePlates)
  const type = vehicle.type || 'hourly';
  
  const now = referenceNow || new Date();
  let start = now;
  
  if (vehicle.entryTime) {
    start = safeDate(vehicle.entryTime);
  }

  const diffMs = now.getTime() - start.getTime();

  // If it's been less than 5 minutes, it's FREE (protection against accidental entry error)
  if (diffMs < 300000) return 0;

  // 0. Subscribers are always FREE at check-out
  if (vehicle.isSubscriber) return 0;

  if (type === 'overnight') {
    const overnightRate = garage.overnightRate || 0;
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const total = Math.max(1, days) * overnightRate;
    return Number(total.toFixed(2));
  }
  
  // FALLBACK for old offline vehicles (If everything is missing or returns now)
  // Ensure we charge at least 1 hour if it's hourly, unless it's genuinely new
  if (type === 'hourly' && (diffMs <= 2000)) {
     // If it's old (has an ID but no times found), assume at least one hour
     if (vehicle.id && !vehicle.id.startsWith('temp_')) return garage.hourlyRate || 0;
  }
  
  // If start is somehow still in the future or invalid, cap it at 'now'
  if (start.getTime() > now.getTime()) start = now;
  
  if (type === 'hourly') {
    const hourlyRate = garage.hourlyRate || 0;
    const hours = Math.ceil(diffMs / (1000 * 60 * 60));
    const total = Math.max(1, hours) * hourlyRate;
    return Number(total.toFixed(2));
  }
  return 0;
};

export const formatEntryTimeParts = (entryTime: any, referenceNow?: Date) => {
  const date = safeDate(entryTime);
  const now = referenceNow || new Date();
  
  const dMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  const diffDays = Math.round((nowMidnight.getTime() - dMidnight.getTime()) / (1000 * 60 * 60 * 24));
  
  const timeStr = date.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
  const dayName = date.toLocaleDateString('ar-EG', { weekday: 'long' });
  const dayMonth = date.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
  
  if (diffDays === 0) {
    return { main: timeStr, sub: null, isToday: true };
  } else if (diffDays === 1) {
    return { main: timeStr, sub: `امبارح ${dayName}`, sub2: dayMonth, isYesterday: true };
  } else {
    return { main: timeStr, sub: dayName, sub2: dayMonth, isPast: true };
  }
};

export const isSessionActive = (lastActive: any, serverTimeOffset: number = 0): boolean => {
  if (!lastActive) return false;
  let lastActiveMillis = 0;
  if (lastActive instanceof Timestamp) {
    lastActiveMillis = lastActive.toMillis();
  } else if (typeof lastActive === 'object' && (lastActive as any).seconds !== undefined) {
    lastActiveMillis = (lastActive as any).seconds * 1000;
  } else if (typeof lastActive === 'number') {
    lastActiveMillis = lastActive;
  } else {
    lastActiveMillis = new Date(lastActive).getTime();
  }
  // If last activity was within 10 minutes (600000ms), session is active
  return Date.now() + serverTimeOffset - lastActiveMillis < 600000;
};

export const getStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    if (typeof defaultValue === 'string') return saved as unknown as T;
    if (typeof defaultValue === 'boolean') return (saved === 'true') as unknown as T;
    return JSON.parse(saved);
  } catch (e) {
    return defaultValue;
  }
};

/**
 * Generates a safe 6-digit PIN that isn't easily guessable and is unique against a provided set of PINs.
 */
export const generateSafePin = (existingPins: Set<string> | string[] = new Set()): string => {
  const pins = existingPins instanceof Set ? existingPins : new Set(existingPins);
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  
  let pin = '';
  let attempts = 0;
  
  while (attempts < 100) {
    // Shuffling digits and taking 6 often creates more "random-looking" PINs than raw Random
    const shuffled = [...digits].sort(() => Math.random() - 0.5);
    const candidate = shuffled.slice(0, 6).join('');
    if (!pins.has(candidate)) {
      pin = candidate;
      break;
    }
    attempts++;
  }
  
  // Fallback if loop finishes without finding unique or for simpler logic
  if (!pin) {
    pin = Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  return pin;
};

/**
 * Resolves a shimmer color value, mapping the pink placeholder (#ec4899) to gray in light mode
 * and off-white in dark mode.
 */
export const resolveShimmerColor = (color: string | undefined, theme: 'light' | 'dark'): string => {
  const baseColor = color || '#10b981';
  if (baseColor === '#ec4899') {
    return theme === 'dark' ? '#faf9f6' : '#64748b';
  }
  return baseColor;
};

/**
 * Checks if a hex color is "light" (bright), suggesting a dark text color should be used on top of it.
 */
export const isLightColor = (color: string | undefined): boolean => {
  if (!color) return false;
  const c = color.toLowerCase();
  if (c === '#faf9f6' || c === '#f59e0b' || c === '#eab308') {
    return true;
  }
  if (c.startsWith('#')) {
    const hex = c.substring(1);
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      return yiq > 150;
    }
  }
  return false;
};

export { 
  isSubscriptionExpired, 
  getRemainingDays, 
  isTrialActive, 
  getEffectiveDailyCapacity,
  isUnlimitedCapacity, 
  calculateCapacityUsed 
} from '../domain/garage/subscription';
export { validateVehicleEntry, validateGarageCreation, validateRechargeRequest } from '../domain/garage/validation';

/**
 * Applies the configured monthly-subscribers fixed fee (default 500 EGP).
 * Flat fee comes from system_config/global (monthlySubscribersFlatFee).
 */
export const applyMonthlySubscribersFlatFee = (price: number, hasMonthlySubscribers: boolean, flatFee: number = 500): number => {
  const fee = Number(flatFee) || 500;
  return hasMonthlySubscribers ? price + fee : price;
};

/**
 * Calculates the final display price for a package:
 * 1. Add referralFee for delegate-referred garage (default 30 EGP if referred, 0 otherwise)
 * 2. Apply discount (percentage or fixed) on the base price
 * 3. Apply monthly subscribers flat fee (configured flat amount, default 500 EGP)
 */
export const calculateFinalPrice = (
  pkg: any, 
  hasMonthlySubscribers: boolean = false, 
  flatFee: number = 500,
  referralFee: number = 0
): {
  basePrice: number;
  hasDiscount: boolean;
  discountedPrice: number;
  finalPrice: number;
  totalDiscount: number;
  displayBasePrice: number;
} => {
  if (!pkg) {
    return {
      basePrice: 0,
      hasDiscount: false,
      discountedPrice: 0,
      finalPrice: 0,
      totalDiscount: 0,
      displayBasePrice: 0,
    };
  }
  const rawBasePrice = pkg.price || 0;
  const refFee = Number(referralFee) >= 0 ? Number(referralFee) : 0;
  const basePrice = rawBasePrice + refFee;
  const hasDiscount = !!(pkg.discountValue && pkg.discountValue > 0);
  const discountedPrice = hasDiscount
    ? (pkg.discountType === 'percentage'
        ? Math.round(basePrice * (1 - pkg.discountValue / 100))
        : Math.max(0, basePrice - pkg.discountValue))
    : basePrice;
  const finalPrice = applyMonthlySubscribersFlatFee(discountedPrice, hasMonthlySubscribers, flatFee);
  const displayBasePrice = applyMonthlySubscribersFlatFee(basePrice, hasMonthlySubscribers, flatFee);
  const totalDiscount = displayBasePrice - finalPrice;
  return { basePrice, hasDiscount, discountedPrice, finalPrice, totalDiscount, displayBasePrice };
};

/**
 * Converts a subscription package ID to duration in days.
 */
export const packageIdToDays = (packageId: string, pkgName?: string): number => {
  if (packageId === 'weekly_sub') return 7;
  if (packageId === 'biweekly_sub' || packageId === '15days') return 15;
  if (packageId === 'monthly_sub') return 30;
  if (pkgName) {
    if (pkgName.includes('أسبوع') || pkgName.includes('7 يوم') || pkgName.includes('7 days')) return 7;
    if (pkgName.includes('15 يوم') || pkgName.includes('نصف شهر') || pkgName.includes('15 days')) return 15;
    if (pkgName.includes('شهر') || pkgName.includes('30 يوم') || pkgName.includes('monthly') || pkgName.includes('30 days')) return 30;
  }
  return 30; // Default: 30 days (not 365+)
};

/**
 * Retries a Firestore operation with exponential backoff and network checks.
 * Prevents transient failures from breaking the user experience.
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 300
): Promise<T> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('لا يوجد اتصال بالإنترنت. يرجى التأكد من اتصالك بشبكة الإنترنت ثم المحاولة مرة أخرى.');
  }
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('انقطع الاتصال بالإنترنت أثناء تنفيذ العملية. يرجى إعادة الاتصال والمحاولة مرة أخرى.');
      }
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
};

/**
 * Creates a debounced version of a function.
 * Prevents rapid-fire calls (e.g., double-click on check-in button).
 */
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number = 500
): T & { cancel: () => void } => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
  debounced.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
  };
  return debounced as T & { cancel: () => void };
};

/**
 * Simple lock to prevent concurrent execution of the same async operation.
 * Use for check-in/check-out to prevent double-submits.
 */
export const createAsyncLock = () => {
  let isLocked = false;
  return async <T>(fn: () => Promise<T>): Promise<T | null> => {
    if (isLocked) return null; // Already running — ignore this call
    isLocked = true;
    try {
      return await fn();
    } finally {
      isLocked = false;
    }
  };
};


