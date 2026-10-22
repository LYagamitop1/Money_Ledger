import { MINOR_UNITS_PER_MAJOR } from '../constants';

export function toMinorUnits(major: string | number): number {
  const num = typeof major === 'string' ? parseFloat(major) : major;
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Amount must be a positive number');
  }
  const minor = Math.round(num * MINOR_UNITS_PER_MAJOR);
  if (minor > Number.MAX_SAFE_INTEGER) {
    throw new Error('Amount exceeds maximum supported value');
  }
  return minor;
}

export function toMajorUnits(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

export function formatMajorUnits(minor: number): string {
  return toMajorUnits(minor).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatINR(minor: number): string {
  return `₹${formatMajorUnits(minor)}`;
}

export function formatINRCompact(minor: number): string {
  return `₹${toMajorUnits(minor).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function parseAmountInput(value: string): { valid: boolean; minor?: number; error?: string } {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, error: 'Amount is required' };
  }
  
  const num = parseFloat(trimmed);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: 'Invalid number format' };
  }
  
  if (num <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }
  
  const decimalPlaces = (trimmed.split('.')[1] || '').length;
  if (decimalPlaces > 2) {
    return { valid: false, error: 'Maximum 2 decimal places allowed' };
  }
  
  try {
    const minor = toMinorUnits(num);
    return { valid: true, minor };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Invalid amount' };
  }
}