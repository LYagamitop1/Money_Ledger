import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '../shared/hooks/useAuthStore';
import { SignInScreen } from '../features/auth/SignInScreen';
import { AuthCallback } from '../features/auth/AuthCallback';
import { DashboardScreen } from '../features/dashboard/DashboardScreen';
import { LedgerScreen } from '../features/ledger/LedgerScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { useEffect } from 'react';
import { clearUserData } from '../services/indexeddb/client';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export function App() {
  const { user } = useAuthStore();

  const clearAllCaches = async () => {
    try {
      await clearUserData('');
    } catch {
      // Ignore errors
    }
  };

  useEffect(() => {
    if (!user) {
      clearAllCaches();
    }
  }, [user, clearAllCaches]);

  return (
    <Routes>
      <Route path="/signin" element={<AuthLayout><SignInScreen /></AuthLayout>} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ledger/:personId"
        element={
          <ProtectedRoute>
            <LedgerScreen />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsScreen />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}