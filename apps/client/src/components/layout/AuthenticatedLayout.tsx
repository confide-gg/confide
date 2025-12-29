import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { PresenceProvider } from "../../context/PresenceContext";
import { ChatProvider } from "../../context/chat";
import { ServerProvider } from "../../context/server";
import {
  CallProvider,
  ActiveCallOverlay,
  ActiveGroupCallOverlay,
  IncomingCallDialog,
  useCall,
} from "../calls";
import { GroupCallInviteDialog } from "../calls/group";
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
    preferenceService
      .getPreferences()
      .then((prefs) => {
        applyTheme(prefs.theme as Theme);
      })
      .catch((err) => {
        console.error("Failed to load preferences:", err);
      });
  }, []);
  return null;
}

function GroupCallDialogWrapper({
  userId,
  dsaSecretKey,
  identityPublicKey,
}: {
  userId: string;
  dsaSecretKey: number[];
  identityPublicKey: number[];
}) {
  const { incomingGroupCall, joinGroupCall, declineGroupCall } = useCall();
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!incomingGroupCall || isJoining) return;
    setIsJoining(true);
    try {
      await joinGroupCall({
        callId: incomingGroupCall.call_id,
        userId,
        identityPublicKey,
        dsaSecretKey,
        announcement: incomingGroupCall.announcement,
      });
    } catch (e) {
      console.error("Failed to join group call:", e);
      setIsJoining(false);
    }
  };

  useEffect(() => {
    if (!incomingGroupCall) {
      setIsJoining(false);
    }
  }, [incomingGroupCall]);

  return (
    <GroupCallInviteDialog
      incomingCall={incomingGroupCall}
      isJoining={isJoining}
      onJoin={handleJoin}
      onDecline={declineGroupCall}
    />
  );
}

function GlobalProviders({
  children,
  userId,
  dsaSecretKey,
  identityPublicKey,
}: {
  children: React.ReactNode;
  userId: string;
  dsaSecretKey: number[];
  identityPublicKey: number[];
}) {
  return (
    <ErrorBoundary>
      <PresenceProvider>
        <ErrorBoundary>
          <ChatProvider>
            <ErrorBoundary>
              <ServerProvider>
                <ErrorBoundary>
                  <CallProvider
                    currentUserId={userId}
                    identityPublicKey={identityPublicKey}
                    dsaSecretKey={dsaSecretKey}
                  >
                    <IdleDetector />
                    <PreferencesLoader />
                    <CacheSync />
                    <SnowEffect />
                    {children}
                    <ActiveCallOverlay />
                    <ActiveGroupCallOverlay />
                    <IncomingCallDialog dsaSecretKey={dsaSecretKey} />
                    <GroupCallDialogWrapper
                      userId={userId}
                      dsaSecretKey={dsaSecretKey}
                      identityPublicKey={identityPublicKey}
                    />
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
    <GlobalProviders
      userId={user.id}
      dsaSecretKey={keys.dsa_secret_key}
      identityPublicKey={keys.dsa_public_key}
    >
      <Outlet />
    </GlobalProviders>
  );
}
