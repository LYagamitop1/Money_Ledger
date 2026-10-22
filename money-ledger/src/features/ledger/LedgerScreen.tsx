import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, Badge, Modal } from '../../shared/ui';
import { transactionQueries } from '../../services/supabase/queries';
import { calculatePersonBalance, getPersonStatus } from '../../features/calculations/calculations';
import { formatINR } from '../../shared/utils/currency';
import { formatDateTime as formatDateTimeUtil } from '../../shared/utils/date';
import { useAuthStore } from '../../shared/hooks/useAuthStore';
import { TransactionSheet } from '../transactions/TransactionSheet';
import { peopleQueries } from '../../services/supabase/queries';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function LedgerScreen() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showSentSheet, setShowSentSheet] = useState(false);
  const [showReceivedSheet, setShowReceivedSheet] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: person, isLoading: personLoading } = useQuery({
    queryKey: ['person', personId],
    queryFn: () => peopleQueries.getById(personId!),
    enabled: !!personId && !!user,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', personId],
    queryFn: () => transactionQueries.getByPerson(personId!),
    enabled: !!personId && !!user,
  });

  const balance = person ? calculatePersonBalance(person.id, person.name, transactions) : null;
  const status = balance ? getPersonStatus(balance) : { label: 'Settled', variant: 'settled' as const };

  const handleDelete = () => setShowDeleteModal(true);

  const confirmDelete = async () => {
    if (!personId || !user) return;
    setIsDeleting(true);
    try {
      await peopleQueries.delete(personId);
      await queryClient.invalidateQueries({ queryKey: ['people', user.id] });
      await queryClient.invalidateQueries({ queryKey: ['transactions', user.id] });
      setShowDeleteModal(false);
      navigate('/');
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete person');
    } finally {
      setIsDeleting(false);
    }
  };

  if (personLoading || txLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!person) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
        <p className="text-text-muted">Person not found</p>
        <Button variant="outline" onClick={() => navigate('/')}>Go to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border">
        <div className="container-app py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-text truncate">{person.name}</h1>
            <p className="text-xs text-text-muted">Independent notebook</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-text-muted hover:text-danger"
            aria-label={`Delete ${person.name}`}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="container-app py-4 pb-24">
        <Card className="mb-4">
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-surface-hover">
                <p className="text-xs text-text-muted">Total Sent</p>
                <p className="text-lg font-semibold text-text">{formatINR(balance?.totalSent || 0)}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-surface-hover">
                <p className="text-xs text-text-muted">Total Received</p>
                <p className="text-lg font-semibold text-text">{formatINR(balance?.totalReceived || 0)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-text-muted">Status</p>
                <div className="flex items-center gap-2">
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {balance && balance.overpaid > 0 && (
                    <Badge variant="overpaid">
                      {formatINR(balance.overpaid)} overpaid
                    </Badge>
                  )}
                </div>
              </div>
              {balance && balance.outstanding > 0 && (
                <div className="text-right">
                  <p className="text-sm text-text-muted">Outstanding</p>
                  <p className="text-xl font-bold text-danger">{formatINR(balance.outstanding)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            onClick={() => setShowSentSheet(true)}
            className="h-14"
            variant="primary"
          >
            <div className="flex flex-col items-center gap-1">
              <Minus className="h-5 w-5" />
              <span className="text-sm">Sent</span>
            </div>
          </Button>
          <Button
            onClick={() => setShowReceivedSheet(true)}
            className="h-14"
            variant="secondary"
          >
            <div className="flex flex-col items-center gap-1">
              <Plus className="h-5 w-5" />
              <span className="text-sm">Received</span>
            </div>
          </Button>
        </div>

        <Card>
          <CardContent className="pt-0">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-muted mb-2">No transactions yet</p>
                <p className="text-sm text-text-muted">Tap Sent or Received to add one</p>
              </div>
            ) : (
              <ul className="divide-y divide-border" role="list">
                {transactions.map((tx) => (
                  <li key={tx.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={tx.type === 'sent' ? 'pending' : 'settled'} 
                        size="sm"
                        className={tx.type === 'sent' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
                      >
                        {tx.type === 'sent' ? 'Sent' : 'Received'}
                      </Badge>
                      <div>
                        <p className="font-medium text-text">{formatINR(tx.amount_minor)}</p>
                        <p className="text-xs text-text-muted">{formatDateTimeUtil(tx.transaction_at)}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>

      <TransactionSheet
        isOpen={showSentSheet}
        onClose={() => setShowSentSheet(false)}
        personName={person.name}
        personId={person.id}
        type="sent"
      />
      <TransactionSheet
        isOpen={showReceivedSheet}
        onClose={() => setShowReceivedSheet(false)}
        personName={person.name}
        personId={person.id}
        type="received"
      />

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Person"
        description="This will permanently delete this person and all their transactions. This action cannot be undone."
        size="sm"
      >
        <p className="text-sm text-text-muted mb-4">
          Are you sure you want to delete this person?
        </p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={isDeleting}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}