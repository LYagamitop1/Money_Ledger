import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight } from 'lucide-react';
import { Button, Card, CardContent, Badge } from '../../shared/ui';
import { peopleQueries, transactionQueries } from '../../services/supabase/queries';
import { calculateAllBalances, calculateGlobalTotals, getPersonStatus } from '../../features/calculations/calculations';
import { formatINR } from '../../shared/utils/currency';
import { useAuthStore } from '../../shared/hooks/useAuthStore';
import { AddPersonSheet } from '../people/AddPersonSheet';

export function DashboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [showAddPerson, setShowAddPerson] = useState(false);

  const { data: people = [], isLoading: peopleLoading } = useQuery({
    queryKey: ['people', user?.id],
    queryFn: () => peopleQueries.getAll(user!.id),
    enabled: !!user,
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: () => transactionQueries.getByUser(user!.id),
    enabled: !!user,
  });

  const balances = calculateAllBalances(people, transactions);
  const totals = calculateGlobalTotals(balances);

  const handleAddPerson = () => setShowAddPerson(true);
  const handlePersonClick = (personId: string) => navigate(`/ledger/${personId}`);

  if (peopleLoading || txLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border">
        <div className="container-app py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-text">My Ledger</h1>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
            Settings
          </Button>
        </div>
      </header>

      <main className="container-app py-4 pb-20">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Card padding="sm">
            <CardContent>
              <p className="text-xs text-text-muted">Total Sent</p>
              <p className="text-lg font-semibold text-text">{formatINR(totals.totalSent)}</p>
            </CardContent>
          </Card>
          <Card padding="sm">
            <CardContent>
              <p className="text-xs text-text-muted">Total Received</p>
              <p className="text-lg font-semibold text-text">{formatINR(totals.totalReceived)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card padding="sm">
            <CardContent>
              <p className="text-xs text-text-muted">Total Outstanding</p>
              <p className="text-lg font-semibold text-danger">{formatINR(totals.totalOutstanding)}</p>
            </CardContent>
          </Card>
          {totals.totalOverpaid > 0 && (
            <Card padding="sm">
              <CardContent>
                <p className="text-xs text-text-muted">Total Overpaid</p>
                <p className="text-lg font-semibold text-blue-600">{formatINR(totals.totalOverpaid)}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {people.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <p className="text-text-muted mb-4">No people yet</p>
              <p className="text-sm text-text-muted mb-4">Tap the + button to add someone</p>
              <Button onClick={handleAddPerson} className="w-full max-w-xs">
                <Plus className="h-4 w-4" />
                Add Person
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {people.map((person) => {
              const balance = balances.find(b => b.personId === person.id);
              const status = balance ? getPersonStatus(balance) : { label: 'Settled', variant: 'settled' as const };
              
              return (
                <Button
                  key={person.id}
                  variant="outline"
                  className="w-full justify-between text-left p-3"
                  onClick={() => handlePersonClick(person.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text truncate">{person.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={status.variant} size="sm">{status.label}</Badge>
                      {balance && balance.overpaid > 0 && (
                        <Badge variant="overpaid" size="sm">
                          {formatINR(balance.overpaid)} overpaid
                        </Badge>
                      )}
                    </div>
                  </div>
                  {balance && (
                    <div className="text-right ml-4">
                      <p className={`font-medium ${balance.outstanding > 0 ? 'text-danger' : 'text-text'}`}>
                        {formatINR(balance.outstanding > 0 ? balance.outstanding : balance.overpaid)}
                      </p>
                      <p className="text-xs text-text-muted">
                        {balance.outstanding > 0 ? 'Outstanding' : 'Overpaid'}
                      </p>
                    </div>
                  )}
                  <ChevronRight className="h-5 w-5 text-text-muted flex-shrink-0 ml-2" />
                </Button>
              );
            })}
          </div>
        )}
      </main>

      <div className="fixed bottom-4 right-4 safe-bottom z-20">
        <Button
          onClick={handleAddPerson}
          size="lg"
          className="rounded-full p-3 shadow-lg"
          aria-label="Add person"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      <AddPersonSheet isOpen={showAddPerson} onClose={() => setShowAddPerson(false)} />
    </div>
  );
}