import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDateTime(isoString: string): string {
  try {
    const date = parseISO(isoString);
    return format(date, 'MMM d, yyyy \'at\' h:mm a');
  } catch {
    return 'Invalid date';
  }
}

export function formatDate(isoString: string): string {
  try {
    const date = parseISO(isoString);
    return format(date, 'MMM d, yyyy');
  } catch {
    return 'Invalid date';
  }
}

export function formatTime(isoString: string): string {
  try {
    const date = parseISO(isoString);
    return format(date, 'h:mm a');
  } catch {
    return 'Invalid time';
  }
}

export function formatRelative(isoString: string): string {
  try {
    const date = parseISO(isoString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

export function toISOString(date: Date = new Date()): string {
  return date.toISOString();
}