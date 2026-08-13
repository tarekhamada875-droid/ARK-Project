import { Package } from '../types';

export const getCleanPackageInfo = (pkg: Package) => {
  // 1. Duration Days
  let durationDays = 30;
  if (typeof pkg.durationDays === 'number' && pkg.durationDays > 0 && pkg.durationDays <= 365) {
    durationDays = pkg.durationDays;
  } else if (typeof pkg.vehiclesCount === 'number' && pkg.vehiclesCount > 0 && pkg.vehiclesCount <= 365) {
    durationDays = pkg.vehiclesCount;
  } else {
    const name = pkg.name || '';
    if (name.includes('15') || name.includes('15 يوم') || name.includes('نصف شهر')) {
      durationDays = 15;
    } else if (name.includes('7') || name.includes('أسبوع')) {
      durationDays = 7;
    } else if (name.includes('30') || name.includes('شهر')) {
      durationDays = 30;
    }
  }

  // 2. Daily Capacity
  let dailyCapacity: number | null = null;
  let isUnlimited = false;

  if (pkg.dailyCapacity === 0 || pkg.name?.includes('مفتوح') || pkg.name?.includes('غير محدود') || pkg.name?.includes('غير محدودة') || pkg.name?.includes('بدون حدود')) {
    isUnlimited = true;
  } else if (typeof pkg.dailyCapacity === 'number' && pkg.dailyCapacity > 0) {
    dailyCapacity = pkg.dailyCapacity;
  } else {
    const match = (pkg.name || '').match(/(\d+)\s*سيارة/);
    if (match && match[1]) {
      const parsedCap = parseInt(match[1], 10);
      if (parsedCap > 0 && parsedCap <= 1000) {
        dailyCapacity = parsedCap;
      }
    } else if (typeof pkg.vehiclesCount === 'number' && pkg.vehiclesCount > 0 && pkg.vehiclesCount <= 500 && pkg.vehiclesCount !== durationDays) {
      dailyCapacity = pkg.vehiclesCount;
    }
  }

  if (!isUnlimited && (!dailyCapacity || dailyCapacity <= 0)) {
    dailyCapacity = 50;
  }

  // 3. Duration Text
  let durationText = `${durationDays} يوم`;
  if (durationDays === 30) {
    durationText = 'شهر كامل (30 يوم)';
  } else if (durationDays === 15) {
    durationText = 'نصف شهر (15 يوم)';
  } else if (durationDays === 7) {
    durationText = 'أسبوع (7 أيام)';
  }

  // 4. Display Name
  let displayName = pkg.name;
  if (!displayName) {
    displayName = isUnlimited ? 'باقة سعة مفتوحة' : `باقة ${dailyCapacity} سيارة/يوم`;
  }

  return {
    durationDays,
    dailyCapacity,
    isUnlimited,
    durationText,
    displayName
  };
};
