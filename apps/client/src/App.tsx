import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Chat } from "./pages/Chat";
import { RecoveryKit } from "./pages/RecoveryKit";
import { ResetPassword } from "./pages/ResetPassword";
import { Settings } from "./pages/Settings";
import { Toaster } from "sonner";
import "./App.css";

function ProtectedRoute({ children, allowRecoverySetup = false }: { children: React.ReactNode; allowRecoverySetup?: boolean }) {
  const { isAuthenticated, isLoading, keys, needsRecoverySetup } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!isAuthenticated || !keys) {
    return <Navigate to="/login" replace />;
  }

  if (needsRecoverySetup && !allowRecoverySetup) {
    return <Navigate to="/recovery-kit" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, needsRecoverySetup } = useAuth();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (isAuthenticated) {
    if (needsRecoverySetup) {
      return <Navigate to="/recovery-kit" replace />;
    }
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}

import { AuthenticatedLayout } from "./components/layout/AuthenticatedLayout";

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/reset-password"
        element={
          <PublicRoute>
            <ResetPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/recovery-kit"
        element={
          <ProtectedRoute allowRecoverySetup={true}>
            <RecoveryKit />
          </ProtectedRoute>
        }
      />
      <Route element={<ProtectedRoute><AuthenticatedLayout /></ProtectedRoute>}>
        <Route path="/chat" element={<Chat />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
