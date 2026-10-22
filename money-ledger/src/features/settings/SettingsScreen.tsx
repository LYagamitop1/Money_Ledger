import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Upload, LogOut, AlertCircle } from 'lucide-react';
import { Button, Card, CardContent, Modal } from '../../shared/ui';
import { useAuthStore } from '../../shared/hooks/useAuthStore';
import { signOut } from '../../services/supabase/client';
import { clearAllData } from '../../services/indexeddb/client';
import { exportBackup, importBackup } from '../../services/indexeddb/client';
import { formatINR } from '../../shared/utils/currency';
import { useQuery } from '@tanstack/react-query';
import { peopleQueries, transactionQueries } from '../../services/supabase/queries';
import { calculateAllBalances, calculateGlobalTotals } from '../../features/calculations/calculations';
import { BACKUP_FILENAME_PREFIX } from '../../shared/constants';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  const { data: people = [] } = useQuery({
    queryKey: ['people', user?.id],
    queryFn: () => peopleQueries.getAll(user!.id),
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: () => transactionQueries.getByUser(user!.id),
    enabled: !!user,
  });

  const balances = calculateAllBalances(people, transactions);
  const totals = calculateGlobalTotals(balances);

  const handleExport = async () => {
    if (!user) return;
    
    try {
      const backup = await exportBackup(user.id);
      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().split('T')[0];
      a.download = `${BACKUP_FILENAME_PREFIX}-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export backup');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRestoreFile(file);
      setRestoreError(null);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile || !user) return;
    
    setIsRestoring(true);
    setRestoreError(null);

    try {
      const text = await restoreFile.text();
      const backup = JSON.parse(text);
      
      if (backup.version !== 1) {
        throw new Error('Unsupported backup version');
      }
      if (!backup.people || !backup.transactions) {
        throw new Error('Invalid backup format');
      }
      if (backup.ownerId !== user.id) {
        throw new Error('Backup belongs to a different account');
      }

      await importBackup(backup, user.id);
      await clearAllData();
      
      window.location.reload();
    } catch (err) {
      if (err instanceof Error) {
        setRestoreError(err.message);
      } else {
        setRestoreError('Failed to restore backup');
      }
    } finally {
      setIsRestoring(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      await clearAllData();
      clearAuth();
      navigate('/signin', { replace: true });
    } catch (err) {
      console.error('Sign out failed:', err);
      alert('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen bg-surface safe-top safe-bottom">
      <header className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-border">
        <div className="container-app py-4">
          <h1 className="text-xl font-bold text-text">Settings</h1>
        </div>
      </header>

      <main className="container-app py-4 pb-20">
        <Card className="mb-4">
          <CardContent className="space-y-3">
            <h2 className="text-sm font-medium text-text-muted">Backup & Restore</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <Button 
                variant="outline" 
                onClick={handleExport}
                className="h-14 flex flex-col items-center gap-1"
              >
                <Download className="h-5 w-5" />
                <span className="text-sm">Export Backup</span>
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowRestoreModal(true)}
                className="h-14 flex flex-col items-center gap-1"
              >
                <Upload className="h-5 w-5" />
                <span className="text-sm">Restore Backup</span>
              </Button>
            </div>

            <p className="text-xs text-text-muted text-center">
              Backups include all people, transactions, and original timestamps.
            </p>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardContent className="space-y-3">
            <h2 className="text-sm font-medium text-text-muted">Account</h2>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Signed in as</span>
                <span className="font-medium text-text truncate max-w-[200px]">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">People</span>
                <span className="font-medium text-text">{people.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Transactions</span>
                <span className="font-medium text-text">{transactions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Total Outstanding</span>
                <span className="font-medium text-danger">{formatINR(totals.totalOutstanding)}</span>
              </div>
              {totals.totalOverpaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-text-muted">Total Overpaid</span>
                  <span className="font-medium text-blue-600">{formatINR(totals.totalOverpaid)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Button 
              variant="danger" 
              className="w-full"
              onClick={() => setShowSignOutModal(true)}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
            <p className="text-xs text-text-muted text-center mt-2">
              You'll need to sign in again to access your ledger.
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-text-muted mt-6">
          My Ledger v1.0.0
        </p>
      </main>

      <Modal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        title="Sign Out"
        description="Are you sure you want to sign out? Your data will remain saved in the cloud."
        size="sm"
      >
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setShowSignOutModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showRestoreModal}
        onClose={() => { setShowRestoreModal(false); setRestoreFile(null); setRestoreError(null); }}
        title="Restore Backup"
        description="This will replace ALL your current data with the backup. This action cannot be undone."
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
              <div className="text-sm text-text">
                <p className="font-medium">Warning: This will replace all your current data</p>
                <p className="mt-1">Make sure you have exported a recent backup before proceeding.</p>
              </div>
            </div>
          </div>

          <input
            type="file"
            accept=".json"
            onChange={handleFileSelect}
            className="sr-only"
            id="restore-file"
            ref={(el) => el?.click()}
          />
          <Button
            variant="outline"
            className="w-full"
            onClick={() => document.getElementById('restore-file')?.click()}
          >
            <Upload className="h-4 w-4" />
            Choose Backup File
          </Button>

          {restoreFile && (
            <p className="text-sm text-text-muted text-center">
              Selected: {restoreFile.name}
            </p>
          )}

          {restoreError && (
            <p className="text-sm text-danger text-center" role="alert">
              {restoreError}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => { setShowRestoreModal(false); setRestoreFile(null); setRestoreError(null); }}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRestore} loading={isRestoring} disabled={!restoreFile || isRestoring}>
              <AlertCircle className="h-4 w-4" />
              Restore Backup
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}