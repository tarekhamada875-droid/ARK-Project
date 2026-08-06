export interface RechargeLog {
  amount: number;
  revenueAmount?: number;
  timestamp: string | Date | { seconds: number };
}

export const filterLogsByMonth = (logs: RechargeLog[], monthKey: string): RechargeLog[] => {
  if (monthKey === 'all') return logs;
  return logs.filter(log => {
    let d: Date;
    if (log.timestamp instanceof Date) {
      d = log.timestamp;
    } else if (typeof log.timestamp === 'object' && log.timestamp && 'seconds' in log.timestamp) {
      d = new Date((log.timestamp as { seconds: number }).seconds * 1000);
    } else {
      d = new Date(log.timestamp as string);
    }
    if (isNaN(d.getTime())) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return key === monthKey;
  });
};

export const sumLogs = (logs: RechargeLog[]): number => {
  return logs.reduce((sum, log) => sum + (log.revenueAmount || log.amount || 0), 0);
};

export const calculateCommission = (totalAmount: number, rate: number): number => {
  if (isNaN(totalAmount) || isNaN(rate) || rate < 0) return 0;
  return (totalAmount * rate) / 100;
};
