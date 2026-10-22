import type { Transaction, PersonBalance, GlobalTotals } from '../../shared/types';

export function calculatePersonBalance(personId: string, personName: string, transactions: Transaction[]): PersonBalance {
  const personTransactions = transactions.filter(t => t.person_id === personId);
  const sent = personTransactions
    .filter(t => t.type === 'sent')
    .reduce((sum, t) => sum + t.amount_minor, 0);
  const received = personTransactions
    .filter(t => t.type === 'received')
    .reduce((sum, t) => sum + t.amount_minor, 0);
  const outstanding = Math.max(sent - received, 0);
  const overpaid = Math.max(received - sent, 0);
  const status = outstanding > 0 ? 'pending' : 'settled';
  return {
    personId,
    personName,
    totalSent: sent,
    totalReceived: received,
    outstanding,
    overpaid,
    status,
  };
}

export function calculateAllBalances(people: Array<{ id: string; name: string }>, transactions: Transaction[]): PersonBalance[] {
  return people.map(p => calculatePersonBalance(p.id, p.name, transactions));
}

export function calculateGlobalTotals(balances: PersonBalance[]): GlobalTotals {
  return {
    totalSent: balances.reduce((sum, b) => sum + b.totalSent, 0),
    totalReceived: balances.reduce((sum, b) => sum + b.totalReceived, 0),
    totalOutstanding: balances.reduce((sum, b) => sum + b.outstanding, 0),
    totalOverpaid: balances.reduce((sum, b) => sum + b.overpaid, 0),
  };
}

export function getPersonStatus(balance: PersonBalance): { label: string; variant: 'pending' | 'settled' | 'overpaid' } {
  if (balance.outstanding > 0) {
    return { label: 'Pending', variant: 'pending' };
  }
  if (balance.overpaid > 0) {
    return { label: 'Settled', variant: 'overpaid' };
  }
  return { label: 'Settled', variant: 'settled' };
}