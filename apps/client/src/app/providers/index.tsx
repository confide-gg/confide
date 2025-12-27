import { Profiler, type ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";
import { measureRenderTime } from "@/utils/performance";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <Profiler
        id="App"
        onRender={(id, phase, actualDuration) => measureRenderTime(id, phase, actualDuration)}
      >
        <BrowserRouter>
          <ErrorBoundary>
            <AuthProvider>
              {children}
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
