import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet, Button, Input } from '../../shared/ui';
import { transactionQueries } from '../../services/supabase/queries';
import { cacheTransactions } from '../../services/indexeddb/client';
import { useAuthStore } from '../../shared/hooks/useAuthStore';
import { useQueryClient } from '@tanstack/react-query';
import { parseAmountInput } from '../../shared/utils/currency';
import { formatINR as formatINRUtil } from '../../shared/utils/currency';

const schema = z.object({
  amount: z.string().min(1, 'Amount is required'),
});

type FormData = z.infer<typeof schema>;

interface TransactionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  personName: string;
  personId: string;
  type: 'sent' | 'received';
}

export function TransactionSheet({ isOpen, onClose, personName, personId, type }: TransactionSheetProps) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '' },
  });

  const amountValue = watch('amount');

  const parsedAmount = amountValue ? parseAmountInput(amountValue) : { valid: false };

  const onSubmit = async (data: FormData) => {
    if (!user || !personId) return;
    
    const parsed = parseAmountInput(data.amount);
    if (!parsed.valid || !parsed.minor) {
      setError(parsed.error || 'Invalid amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const transaction = await transactionQueries.create({
        user_id: user.id,
        person_id: personId,
        type,
        amount_minor: parsed.minor,
      });

      await queryClient.invalidateQueries({ queryKey: ['transactions', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['transactions', personId] });
      await cacheTransactions([transaction]);
      
      reset();
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to save transaction. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9.]/g, '');
    const parts = value.split('.');
    if (parts.length > 2) {
      setValue('amount', parts[0] + '.' + parts.slice(1).join(''));
    } else {
      setValue('amount', value);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title={`${type === 'sent' ? 'Sent' : 'Received'} Money`}
      description={`${personName} • ${type === 'sent' ? 'You gave' : 'You received'} money`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('amount')}
          type="text"
          inputMode="decimal"
          placeholder="Enter amount"
          autoFocus
          value={amountValue}
          onChange={handleAmountChange}
          error={errors.amount?.message || (amountValue && !parsedAmount.valid ? parsedAmount.error : undefined)}
          helperText={amountValue && parsedAmount.valid ? `₹${(parsedAmount.minor! / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : undefined}
        />
        {error && (
          <p className="text-sm text-danger text-center" role="alert">
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={isSubmitting} disabled={!parsedAmount.valid}>
            Save {formatINRUtil(parsedAmount.minor || 0)}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}