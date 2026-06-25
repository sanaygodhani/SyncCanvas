import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { SocketProvider } from './lib/socket';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import AppShell from './components/layout/AppShell';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-discord-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blurple border-t-transparent rounded-full animate-spin" />
          <p className="text-discord-muted text-sm">Connecting...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const { user } = useAuthStore();

  return (
    <SocketProvider>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/channels/me" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/channels/me" replace /> : <RegisterPage />}
        />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/channels/me" replace />} />
      </Routes>
    </SocketProvider>
  );
}