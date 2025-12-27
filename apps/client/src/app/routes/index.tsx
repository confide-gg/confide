import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { SnowEffect } from "@/components/common";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Login, Register, ResetPassword } from "@/app/pages";

const Chat = lazy(() => import("@/app/pages/Chat").then((m) => ({ default: m.Chat })));
const RecoveryKit = lazy(() =>
  import("@/app/pages/RecoveryKit").then((m) => ({ default: m.RecoveryKit }))
);
const Settings = lazy(() => import("@/app/pages/Settings").then((m) => ({ default: m.Settings })));
const AuthenticatedLayout = lazy(() =>
  import("@/components/layout/AuthenticatedLayout").then((m) => ({
    default: m.AuthenticatedLayout,
  }))
);

function ProtectedRoute({
  children,
  allowRecoverySetup = false,
}: {
  children: React.ReactNode;
  allowRecoverySetup?: boolean;
}) {
  const { isAuthenticated, isLoading, keys, needsRecoverySetup } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
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
    return <div className="min-h-screen bg-background" />;
  }

  if (isAuthenticated) {
    if (needsRecoverySetup) {
      return <Navigate to="/recovery-kit" replace />;
    }
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
}

function LoadingFallback() {
  return <div className="min-h-screen bg-background" />;
}

const AUTH_ROUTES = ["/login", "/register", "/reset-password"];

function ConditionalSnowEffect() {
  const location = useLocation();
  const isAuthRoute = AUTH_ROUTES.includes(location.pathname);

  if (isAuthRoute) return null;
  return <SnowEffect />;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route
          element={
            <PublicRoute>
              <AuthLayout />
            </PublicRoute>
          }
        >
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
        </Route>
        <Route
          element={
            <ProtectedRoute allowRecoverySetup={true}>
              <AuthLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/recovery-kit" element={<RecoveryKit />} />
        </Route>
        <Route
          element={
            <ProtectedRoute>
              <AuthenticatedLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/chat" element={<Chat />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

export { ConditionalSnowEffect };
