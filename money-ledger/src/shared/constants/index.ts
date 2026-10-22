export const APP_NAME = 'My Ledger';
export const APP_DESCRIPTION = 'Track money you give and receive. Simple, private, synced across devices.';
export const CURRENCY_SYMBOL = '₹';
export const MINOR_UNITS_PER_MAJOR = 100;
export const STORAGE_KEYS = {
  USER_ID: 'ml_user_id',
  LAST_SYNC: 'ml_last_sync',
  OFFLINE_QUEUE: 'ml_offline_queue',
} as const;
export const DB_NAME = 'money-ledger';
export const DB_VERSION = 1;
export const BACKUP_FILENAME_PREFIX = 'my-ledger-backup';
export const QUERY_STALE_TIME = 30000;