import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PresenceProvider } from "../../context/PresenceContext";
import { ChatProvider } from "../../context/ChatContext";
import { ServerProvider } from "../../context/ServerContext";
import { CallProvider, ActiveCallOverlay, IncomingCallDialog } from "../calls";
import { useIdleDetection } from "../../hooks/useIdleDetection";

function IdleDetector() {
  useIdleDetection();
  return null;
}

function GlobalProviders({ children }: { children: React.ReactNode }) {
  const { user, keys } = useAuth();

  if (!user || !keys) return null;

  return (
    <PresenceProvider>
      <ChatProvider>
        <ServerProvider>
          <CallProvider currentUserId={user.id}>
            <IdleDetector />
            {children}
            <ActiveCallOverlay />
            <IncomingCallDialog dsaSecretKey={keys.dsa_secret_key} />
          </CallProvider>
        </ServerProvider>
      </ChatProvider>
    </PresenceProvider>
  );
}

export function AuthenticatedLayout() {
  return (
    <GlobalProviders>
      <Outlet />
    </GlobalProviders>
  );
}
