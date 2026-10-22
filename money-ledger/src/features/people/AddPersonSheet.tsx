import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Sheet, Button, Input } from '../../shared/ui';
import { peopleQueries } from '../../services/supabase/queries';
import { cachePeople } from '../../services/indexeddb/client';
import { useAuthStore } from '../../shared/hooks/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { personNameSchema } from '../../shared/utils/validation';

const schema = z.object({
  name: personNameSchema,
});

type FormData = z.infer<typeof schema>;

interface AddPersonSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddPersonSheet({ isOpen, onClose }: AddPersonSheetProps) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const onSubmit = async (data: FormData) => {
    if (!user) return;
    
    setIsSubmitting(true);
    setError(null);

    try {
      const person = await peopleQueries.create({
        user_id: user.id,
        name: data.name.trim(),
      });

      await queryClient.invalidateQueries({ queryKey: ['people', user.id] });
      await cachePeople([person]);
      
      reset();
      onClose();
      navigate(`/ledger/${person.id}`);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('duplicate') || err.message.includes('unique')) {
          setError('A person with this name already exists');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to create person. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="Add Person"
      description="Enter the name of the person you want to track."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          {...register('name')}
          placeholder="Person's name"
          autoFocus
          error={errors.name?.message}
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
          <Button type="submit" className="flex-1" loading={isSubmitting}>
            Save
          </Button>
        </div>
      </form>
    </Sheet>
  );
}