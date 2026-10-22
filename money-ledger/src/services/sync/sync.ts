import { 
  getPendingSyncItems, 
  updateSyncItemStatus, 
  removeSyncItem,
  setMetadata,
  getMetadata 
} from '../indexeddb/client';
import type { SyncQueueItem } from '../indexeddb/client';
import type { Person, Transaction } from '../../shared/types';
import { peopleQueries, transactionQueries, getUserData } from '../supabase/queries';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

export async function syncToServer(userId: string): Promise<{ success: boolean; error?: string }> {
  const pendingItems = await getPendingSyncItems(userId);
  
  for (const item of pendingItems) {
    try {
      await processSyncItem(item, userId);
      await removeSyncItem(item.id);
    } catch (error) {
      const retries = item.retries + 1;
      if (retries >= MAX_RETRIES) {
        await updateSyncItemStatus(item.id, 'failed', retries);
        return { success: false, error: `Sync failed after ${MAX_RETRIES} retries: ${error}` };
      }
      await updateSyncItemStatus(item.id, 'pending', retries);
      await new Promise(r => setTimeout(r, RETRY_DELAY * retries));
    }
  }
  
  await setMetadata('lastSync', new Date().toISOString());
  return { success: true };
}

async function processSyncItem(item: SyncQueueItem, userId: string): Promise<void> {
  switch (item.type) {
    case 'create_person': {
      const payload = item.payload as Omit<Person, 'id' | 'created_at'>;
      await peopleQueries.create({ ...payload, user_id: userId });
      break;
    }
    case 'create_transaction': {
      const payload = item.payload as Omit<Transaction, 'id' | 'transaction_at'>;
      await transactionQueries.create({ ...payload, user_id: userId });
      break;
    }
    default:
      throw new Error(`Unknown sync item type: ${(item as SyncQueueItem).type}`);
  }
}

export async function fetchAndCacheUserData(userId: string): Promise<void> {
  const { people, transactions } = await getUserData(userId);
  const { cachePeople, cacheTransactions } = await import('../indexeddb/client');
  await Promise.all([
    cachePeople(people),
    cacheTransactions(transactions),
  ]);
  await setMetadata('lastSync', new Date().toISOString());
}

export async function getLastSyncTime(): Promise<string | null> {
  return (await getMetadata('lastSync')) as string | null;
}

export async function isOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch('https://www.google.com/generate_204', { 
      method: 'HEAD', 
      cache: 'no-cache',
      signal: controller.signal 
    });
    clearTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

export async function queuePersonCreation(userId: string, person: Omit<Person, 'id' | 'created_at'>): Promise<void> {
  const { addToSyncQueue } = await import('../indexeddb/client');
  await addToSyncQueue({ userId, type: 'create_person', payload: person, status: 'pending' });
}

export async function queueTransactionCreation(userId: string, tx: Omit<Transaction, 'id' | 'transaction_at'>): Promise<void> {
  const { addToSyncQueue } = await import('../indexeddb/client');
  await addToSyncQueue({ userId, type: 'create_transaction', payload: tx, status: 'pending' });
}