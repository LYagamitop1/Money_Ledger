import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Person, Transaction, BackupFile } from '../../shared/types';
import { DB_NAME, DB_VERSION } from '../../shared/constants';

export interface SyncQueueItem {
  id: string;
  userId: string;
  type: 'create_person' | 'create_transaction';
  payload: unknown;
  status: 'pending' | 'synced' | 'failed';
  createdAt: string;
  retries: number;
}

interface MetadataItem {
  key: string;
  value: unknown;
}

interface MoneyLedgerDB extends DBSchema {
  people: {
    key: string;
    value: Person;
    indexes: { 'by-user': string };
  };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'by-user': string; 'by-person': string };
  };
  syncQueue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-status': string; 'by-user': string };
  };
  metadata: {
    key: string;
    value: MetadataItem;
  };
}

let dbInstance: IDBPDatabase<MoneyLedgerDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<MoneyLedgerDB>> {
  if (dbInstance) return dbInstance;
  
  dbInstance = await openDB<MoneyLedgerDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const peopleStore = db.createObjectStore('people', { keyPath: 'id' });
      peopleStore.createIndex('by-user', 'user_id');
      
      const transactionsStore = db.createObjectStore('transactions', { keyPath: 'id' });
      transactionsStore.createIndex('by-user', 'user_id');
      transactionsStore.createIndex('by-person', 'person_id');
      
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-status', 'status');
      syncStore.createIndex('by-user', 'userId');
      
      db.createObjectStore('metadata', { keyPath: 'key' });
    },
  });
  
  return dbInstance;
}

export async function clearUserData(userId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['people', 'transactions', 'syncQueue', 'metadata'], 'readwrite');
  
  const peopleStore = tx.objectStore('people');
  const peopleIndex = peopleStore.index('by-user');
  const peopleCursor = await peopleIndex.openCursor(userId);
  for (let cursor = peopleCursor; cursor; cursor = await cursor.continue()) {
    await cursor.delete();
  }
  
  const transactionsStore = tx.objectStore('transactions');
  const txIndex = transactionsStore.index('by-user');
  const txCursor = await txIndex.openCursor(userId);
  for (let cursor = txCursor; cursor; cursor = await cursor.continue()) {
    await cursor.delete();
  }
  
  const syncStore = tx.objectStore('syncQueue');
  const syncIndex = syncStore.index('by-user');
  const syncCursor = await syncIndex.openCursor(userId);
  for (let cursor = syncCursor; cursor; cursor = await cursor.continue()) {
    await cursor.delete();
  }
  
  await tx.done;
}

export async function clearAllData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['people', 'transactions', 'syncQueue', 'metadata'], 'readwrite');
  await Promise.all([
    tx.objectStore('people').clear(),
    tx.objectStore('transactions').clear(),
    tx.objectStore('syncQueue').clear(),
    tx.objectStore('metadata').clear(),
  ]);
  await tx.done;
}

export async function cachePeople(people: Person[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('people', 'readwrite');
  const store = tx.objectStore('people');
  await Promise.all(people.map(p => store.put(p)));
  await tx.done;
}

export async function getCachedPeople(userId: string): Promise<Person[]> {
  const db = await getDB();
  return db.getAllFromIndex('people', 'by-user', userId);
}

export async function cacheTransactions(transactions: Transaction[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('transactions', 'readwrite');
  const store = tx.objectStore('transactions');
  await Promise.all(transactions.map(t => store.put(t)));
  await tx.done;
}

export async function getCachedTransactions(userId: string): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAllFromIndex('transactions', 'by-user', userId);
}

export async function getCachedTransactionsByPerson(personId: string): Promise<Transaction[]> {
  const db = await getDB();
  return db.getAllFromIndex('transactions', 'by-person', personId);
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  const db = await getDB();
  const queueItem: SyncQueueItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    retries: 0,
  };
  await db.add('syncQueue', queueItem);
}

export async function getPendingSyncItems(userId: string): Promise<SyncQueueItem[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('syncQueue', 'by-user', userId);
  return all.filter(item => item.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateSyncItemStatus(id: string, status: SyncQueueItem['status'], retries?: number): Promise<void> {
  const db = await getDB();
  const item = await db.get('syncQueue', id);
  if (item) {
    item.status = status;
    if (retries !== undefined) item.retries = retries;
    await db.put('syncQueue', item);
  }
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function setMetadata(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put('metadata', { key, value });
}

export async function getMetadata(key: string): Promise<unknown> {
  const db = await getDB();
  const item = await db.get('metadata', key);
  return item?.value;
}

export async function exportBackup(userId: string): Promise<BackupFile> {
  const [people, transactions] = await Promise.all([
    getCachedPeople(userId),
    getCachedTransactions(userId),
  ]);
  
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    ownerId: userId,
    people,
    transactions,
  };
}

export async function importBackup(backup: BackupFile, currentUserId: string): Promise<void> {
  if (backup.ownerId !== currentUserId) {
    throw new Error('Backup owner does not match current user');
  }
  
  const db = await getDB();
  const tx = db.transaction(['people', 'transactions'], 'readwrite');
  
  await tx.objectStore('people').clear();
  await tx.objectStore('transactions').clear();
  
  await Promise.all([
    ...backup.people.map(p => tx.objectStore('people').put(p)),
    ...backup.transactions.map(t => tx.objectStore('transactions').put(t)),
  ]);
  
  await tx.done;
}