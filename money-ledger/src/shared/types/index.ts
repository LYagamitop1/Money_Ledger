export interface Person {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  person_id: string;
  type: 'sent' | 'received';
  amount_minor: number;
  transaction_at: string;
}

export interface PersonBalance {
  personId: string;
  personName: string;
  totalSent: number;
  totalReceived: number;
  outstanding: number;
  overpaid: number;
  status: 'pending' | 'settled';
}

export interface GlobalTotals {
  totalSent: number;
  totalReceived: number;
  totalOutstanding: number;
  totalOverpaid: number;
}

export interface BackupFile {
  version: number;
  exportedAt: string;
  ownerId: string;
  people: Person[];
  transactions: Transaction[];
}