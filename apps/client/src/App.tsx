import { useEffect, Profiler, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Toaster, toast } from "sonner";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { SnowEffect } from "./components/common";
import { measureRenderTime } from "./utils/performance";
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

const Login = lazy(() => import("./pages/Login").then(m => ({ default: m.Login })));
const Register = lazy(() => import("./pages/Register").then(m => ({ default: m.Register })));
const Chat = lazy(() => import("./pages/Chat").then(m => ({ default: m.Chat })));
const RecoveryKit = lazy(() => import("./pages/RecoveryKit").then(m => ({ default: m.RecoveryKit })));
const ResetPassword = lazy(() => import("./pages/ResetPassword").then(m => ({ default: m.ResetPassword })));
const Settings = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
const AuthenticatedLayout = lazy(() => import("./components/layout/AuthenticatedLayout").then(m => ({ default: m.AuthenticatedLayout })));

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

function LoadingFallback() {
  return <div className="loading">Loading...</div>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LoadingFallback />}>
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
      <Profiler id="App" onRender={(id, phase, actualDuration) => measureRenderTime(id, phase, actualDuration)}>
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
            <SnowEffect />
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
      </Profiler>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
