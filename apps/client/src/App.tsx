import { useEffect, Profiler, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster, toast } from "sonner";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { SnowEffect } from "./components/common";
import { measureRenderTime } from "./utils/performance";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./App.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { ResetPassword } from "./pages/ResetPassword";
import { AuthLayout } from "./components/layout/AuthLayout";

const Chat = lazy(() => import("./pages/Chat").then((m) => ({ default: m.Chat })));
const RecoveryKit = lazy(() =>
  import("./pages/RecoveryKit").then((m) => ({ default: m.RecoveryKit }))
);
const Settings = lazy(() => import("./pages/Settings").then((m) => ({ default: m.Settings })));
const AuthenticatedLayout = lazy(() =>
  import("./components/layout/AuthenticatedLayout").then((m) => ({
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

function AppRoutes() {
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

function App() {
  useEffect(() => {
    async function checkForUpdates() {
      try {
        const update = await check();
        if (update) {
          toast(`Update available: v${update.version}`, {
            description: "A new version is ready to install.",
            duration: Infinity,
            action: {
              label: "Install & Restart",
              onClick: async () => {
                toast.loading("Downloading update...", { id: "update-progress" });
                await update.downloadAndInstall();
                toast.dismiss("update-progress");
                await relaunch();
              },
            },
          });
        }
      } catch (e) {
        console.error("Failed to check for updates:", e);
      }
    }
    checkForUpdates();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Profiler
        id="App"
        onRender={(id, phase, actualDuration) => measureRenderTime(id, phase, actualDuration)}
      >
        <BrowserRouter>
          <ErrorBoundary>
            <AuthProvider>
              <AppRoutes />
              <ConditionalSnowEffect />
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
          </ErrorBoundary>
        </BrowserRouter>
      </Profiler>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
