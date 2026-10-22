import { z } from 'zod';

export const personNameSchema = z.string().trim().min(1, 'Name is required').max(100, 'Name too long');

export const amountSchema = z.string().refine(
  (val) => {
    const num = parseFloat(val);
    return !Number.isNaN(num) && Number.isFinite(num) && num > 0;
  },
  { message: 'Amount must be a positive number' }
).refine(
  (val) => {
    const decimalPlaces = (val.split('.')[1] || '').length;
    return decimalPlaces <= 2;
  },
  { message: 'Maximum 2 decimal places allowed' }
);

export const transactionSchema = z.object({
  personId: z.string().uuid('Invalid person ID'),
  type: z.enum(['sent', 'received']),
  amountMinor: z.number().int().positive('Amount must be positive'),
});

export type PersonNameInput = z.infer<typeof personNameSchema>;
export type AmountInput = z.infer<typeof amountSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;

export function validateUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}