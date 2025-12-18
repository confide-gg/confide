import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PresenceProvider } from "../../context/PresenceContext";
import { ChatProvider } from "../../context/ChatContext";
import { ServerProvider } from "../../context/ServerContext";
import { CallProvider, ActiveCallOverlay, IncomingCallDialog } from "../calls";
import { useIdleDetection } from "../../hooks/useIdleDetection";
import { useCacheSync } from "../../hooks/useCacheSync";
import { preferenceService } from "../../features/settings/preferences";
import { applyTheme, type Theme } from "../../lib/themes";
import { SnowEffect } from "../common";
import { ErrorBoundary } from "../ErrorBoundary";

function IdleDetector() {
  useIdleDetection();
  return null;
}

function CacheSync() {
  useCacheSync();
  return null;
}

function PreferencesLoader() {
  useEffect(() => {
    preferenceService.getPreferences()
      .then((prefs) => {
        applyTheme(prefs.theme as Theme);
      })
      .catch((err) => {
        console.error("Failed to load preferences:", err);
      });
  }, []);
  return null;
}

function GlobalProviders({ children, userId, dsaSecretKey }: { children: React.ReactNode; userId: string; dsaSecretKey: number[] }) {
  return (
    <ErrorBoundary>
      <PresenceProvider>
        <ErrorBoundary>
          <ChatProvider>
            <ErrorBoundary>
              <ServerProvider>
                <ErrorBoundary>
                  <CallProvider currentUserId={userId}>
                    <IdleDetector />
                    <PreferencesLoader />
                    <CacheSync />
                    <SnowEffect />
                    {children}
                    <ActiveCallOverlay />
                    <IncomingCallDialog dsaSecretKey={dsaSecretKey} />
                  </CallProvider>
                </ErrorBoundary>
              </ServerProvider>
            </ErrorBoundary>
          </ChatProvider>
        </ErrorBoundary>
      </PresenceProvider>
    </ErrorBoundary>
  );
}

export function AuthenticatedLayout() {
  const { user, keys } = useAuth();

  if (!user || !keys) {
    return null;
  }

  return (
    <GlobalProviders userId={user.id} dsaSecretKey={keys.dsa_secret_key}>
      <Outlet />
    </GlobalProviders>
  );
}