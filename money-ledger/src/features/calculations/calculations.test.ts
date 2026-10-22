import { describe, it, expect } from 'vitest';
import { calculatePersonBalance, calculateGlobalTotals, getPersonStatus } from './calculations';
import type { Transaction, PersonBalance } from '../../shared/types';

const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  user_id: 'user-1',
  person_id: 'p1',
  type: 'sent',
  amount_minor: 500000, // ₹5,000
  transaction_at: new Date().toISOString(),
  ...overrides,
});

describe('calculatePersonBalance', () => {
  it('1. new person has zero outstanding and zero overpaid', () => {
    const result = calculatePersonBalance('p1', 'Test', []);
    expect(result.outstanding).toBe(0);
    expect(result.overpaid).toBe(0);
    expect(result.totalSent).toBe(0);
    expect(result.totalReceived).toBe(0);
    expect(result.status).toBe('settled');
  });

  it('2. sending money increases outstanding', () => {
    const txs = [createTransaction({ type: 'sent', amount_minor: 500000 })];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.outstanding).toBe(500000);
    expect(result.overpaid).toBe(0);
    expect(result.status).toBe('pending');
  });

  it('3. receiving money decreases outstanding', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 500000 }),
      createTransaction({ type: 'received', amount_minor: 200000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.outstanding).toBe(300000);
    expect(result.overpaid).toBe(0);
    expect(result.status).toBe('pending');
  });

  it('4. exact repayment results in zero outstanding balance', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 500000 }),
      createTransaction({ type: 'received', amount_minor: 500000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.outstanding).toBe(0);
    expect(result.overpaid).toBe(0);
    expect(result.status).toBe('settled');
  });

  it('5. overpayment results in zero outstanding and positive overpaid', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 500000 }),
      createTransaction({ type: 'received', amount_minor: 600000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.outstanding).toBe(0);
    expect(result.overpaid).toBe(100000);
    expect(result.status).toBe('settled');
  });

  it('6. negative outstanding is never displayed (always clamped to 0)', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 100000 }),
      createTransaction({ type: 'received', amount_minor: 500000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.outstanding).toBe(0);
    expect(result.overpaid).toBe(400000);
  });

  it('7. one person overpayment does not affect another person outstanding', () => {
    const txs = [
      createTransaction({ person_id: 'rahul', type: 'sent', amount_minor: 500000 }),
      createTransaction({ person_id: 'amit', type: 'sent', amount_minor: 500000 }),
      createTransaction({ person_id: 'amit', type: 'received', amount_minor: 600000 }),
    ];
    const rahul = calculatePersonBalance('rahul', 'Rahul', txs);
    const amit = calculatePersonBalance('amit', 'Amit', txs);
    expect(rahul.outstanding).toBe(500000);
    expect(rahul.overpaid).toBe(0);
    expect(amit.outstanding).toBe(0);
    expect(amit.overpaid).toBe(100000);
  });

  it('8. global outstanding is sum of individual outstanding', () => {
    const balances: PersonBalance[] = [
      { personId: 'p1', personName: 'A', totalSent: 500000, totalReceived: 200000, outstanding: 300000, overpaid: 0, status: 'pending' },
      { personId: 'p2', personName: 'B', totalSent: 300000, totalReceived: 100000, outstanding: 200000, overpaid: 0, status: 'pending' },
      { personId: 'p3', personName: 'C', totalSent: 0, totalReceived: 0, outstanding: 0, overpaid: 0, status: 'settled' },
    ];
    const totals = calculateGlobalTotals(balances);
    expect(totals.totalOutstanding).toBe(500000);
  });

  it('9. global overpaid is sum of individual overpaid', () => {
    const balances: PersonBalance[] = [
      { personId: 'p1', personName: 'A', totalSent: 500000, totalReceived: 600000, outstanding: 0, overpaid: 100000, status: 'settled' },
      { personId: 'p2', personName: 'B', totalSent: 300000, totalReceived: 500000, outstanding: 0, overpaid: 200000, status: 'settled' },
    ];
    const totals = calculateGlobalTotals(balances);
    expect(totals.totalOverpaid).toBe(300000);
  });

  it('10. integer monetary calculations avoid floating-point errors', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 100 }), // ₹1.00
      createTransaction({ type: 'sent', amount_minor: 200 }), // ₹2.00
      createTransaction({ type: 'received', amount_minor: 300 }), // ₹3.00
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.totalSent).toBe(300);
    expect(result.totalReceived).toBe(300);
    expect(result.outstanding).toBe(0);
  });

  it('11. multiple transactions of same type sum correctly', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 100000 }),
      createTransaction({ type: 'sent', amount_minor: 200000 }),
      createTransaction({ type: 'sent', amount_minor: 300000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.totalSent).toBe(600000);
    expect(result.outstanding).toBe(600000);
  });

  it('12. transactions for other persons are ignored', () => {
    const txs = [
      createTransaction({ person_id: 'p1', type: 'sent', amount_minor: 500000 }),
      createTransaction({ person_id: 'p2', type: 'sent', amount_minor: 300000 }),
      createTransaction({ person_id: 'p2', type: 'received', amount_minor: 100000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.totalSent).toBe(500000);
    expect(result.outstanding).toBe(500000);
  });

  it('13. empty transaction list returns zeros', () => {
    const result = calculatePersonBalance('p1', 'Test', []);
    expect(result.totalSent).toBe(0);
    expect(result.totalReceived).toBe(0);
    expect(result.outstanding).toBe(0);
    expect(result.overpaid).toBe(0);
  });

  it('14. status is pending when outstanding > 0', () => {
    const txs = [createTransaction({ type: 'sent', amount_minor: 100000 })];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.status).toBe('pending');
  });

  it('15. status is settled when outstanding = 0 and overpaid = 0', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 100000 }),
      createTransaction({ type: 'received', amount_minor: 100000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.status).toBe('settled');
  });

  it('16. status is settled when overpaid > 0 (overpaid shown separately)', () => {
    const txs = [
      createTransaction({ type: 'sent', amount_minor: 100000 }),
      createTransaction({ type: 'received', amount_minor: 150000 }),
    ];
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.status).toBe('settled');
    expect(result.overpaid).toBe(50000);
  });

  it('17. getPersonStatus returns correct labels', () => {
    expect(getPersonStatus({ outstanding: 100, overpaid: 0 } as PersonBalance)).toEqual({ label: 'Pending', variant: 'pending' });
    expect(getPersonStatus({ outstanding: 0, overpaid: 0 } as PersonBalance)).toEqual({ label: 'Settled', variant: 'settled' });
    expect(getPersonStatus({ outstanding: 0, overpaid: 100 } as PersonBalance)).toEqual({ label: 'Settled', variant: 'overpaid' });
  });

  it('18. calculateGlobalTotals handles empty array', () => {
    const totals = calculateGlobalTotals([]);
    expect(totals.totalSent).toBe(0);
    expect(totals.totalReceived).toBe(0);
    expect(totals.totalOutstanding).toBe(0);
    expect(totals.totalOverpaid).toBe(0);
  });

  it('19. large numbers handled correctly (no overflow)', () => {
    const txs = Array.from({ length: 1000 }, () => createTransaction({ amount_minor: 10000000 })); // ₹1,00,000 each
    const result = calculatePersonBalance('p1', 'Test', txs);
    expect(result.totalSent).toBe(10000000000); // ₹1,00,00,00,000
  });

  it('20. mixed sent/received across multiple people calculates independently', () => {
    const txs = [
      // Rahul: sent 5000, received 2000 -> outstanding 3000
      createTransaction({ person_id: 'rahul', type: 'sent', amount_minor: 500000 }),
      createTransaction({ person_id: 'rahul', type: 'received', amount_minor: 200000 }),
      // Amit: sent 5000, received 6000 -> overpaid 1000
      createTransaction({ person_id: 'amit', type: 'sent', amount_minor: 500000 }),
      createTransaction({ person_id: 'amit', type: 'received', amount_minor: 600000 }),
    ];
    const rahul = calculatePersonBalance('rahul', 'Rahul', txs);
    const amit = calculatePersonBalance('amit', 'Amit', txs);
    expect(rahul.outstanding).toBe(300000);
    expect(rahul.overpaid).toBe(0);
    expect(amit.outstanding).toBe(0);
    expect(amit.overpaid).toBe(100000);
    const totals = calculateGlobalTotals([rahul, amit]);
    expect(totals.totalOutstanding).toBe(300000);
    expect(totals.totalOverpaid).toBe(100000);
  });
});