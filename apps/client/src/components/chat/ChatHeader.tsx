import { useEffect, useState } from "react";
import { Phone, Pin } from "lucide-react";
import { useChat } from "../../context/chat";
import { usePresence } from "../../context/PresenceContext";
import { useAuth } from "../../context/AuthContext";
import { useCall } from "../calls/context";
import { Avatar } from "../ui/avatar";
import { PinnedMessages } from "./PinnedMessages";

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  away: "Away",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
  offline: "Offline",
};

export function ChatHeader() {
  const { activeChat, showProfilePanel, setShowProfilePanel, setVerifyModal } = useChat();
  const { getUserPresence, subscribeToUsers, isWsConnected, isOnline } = usePresence();
  const { user, keys } = useAuth();
  const { callState, initiateCall } = useCall();
  const [showPinned, setShowPinned] = useState(false);

  useEffect(() => {
    if (activeChat && isWsConnected) {
      subscribeToUsers([activeChat.visitorId]);
    }
  }, [activeChat, isWsConnected, subscribeToUsers]);

  if (!activeChat) return null;

  const presence = getUserPresence(activeChat.visitorId);
  const userIsOnline = isOnline(activeChat.visitorId);
  const displayStatus = userIsOnline ? presence?.status || "online" : "offline";

  const canVerify = activeChat.theirIdentityKey && activeChat.theirIdentityKey.length > 0 && keys;
  const isDm = !activeChat.isGroup;
  const hasDsaKey = activeChat.theirDsaKey && activeChat.theirDsaKey.length > 0;
  const canCall = isDm && keys && callState.status === "idle" && hasDsaKey;

  const handleCall = async () => {
    if (!canCall || !keys || !user || !activeChat.theirDsaKey) return;
    try {
      await initiateCall(
        user.id,
        activeChat.visitorId,
        activeChat.theirDsaKey,
        keys.dsa_secret_key,
        {
          username: activeChat.visitorUsername,
        }
      );
    } catch (e) {
      console.error("Failed to initiate call:", e);
    }
  };

  const handleVerify = () => {
    if (canVerify && activeChat.theirIdentityKey) {
      setVerifyModal({
        friendId: activeChat.visitorId,
        friendUsername: activeChat.visitorUsername,
        theirIdentityKey: activeChat.theirIdentityKey,
      });
    }
  };

  const handleJump = (messageId: string) => {
    const element = document.getElementById(messageId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.style.transition = "background-color 0.5s ease";
      element.style.backgroundColor = "#1a1a1a";
      setTimeout(() => {
        element.style.backgroundColor = "";
      }, 2000);
    }
    setShowPinned(false);
  };

  return (
    <div className="shrink-0 z-10 border-b border-border relative">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-3">
          <Avatar
            fallback={activeChat.visitorUsername}
            status={displayStatus as "online" | "away" | "dnd" | "invisible" | "offline"}
            online={userIsOnline}
            size="md"
          />
          <div className="flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-foreground truncate">
                @{activeChat.visitorUsername}
              </span>
            </div>
            <span
              className={`text-xs font-medium ${userIsOnline ? "text-online" : "text-muted-foreground"}`}
            >
              {STATUS_LABELS[displayStatus] || "Offline"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDm && (
            <button
              onClick={handleCall}
              disabled={!canCall}
              className={`p-2 rounded-lg transition-colors ${
                canCall
                  ? "hover:bg-secondary text-muted-foreground hover:text-foreground"
                  : "text-muted-foreground/50 cursor-not-allowed"
              }`}
              title={canCall ? "Start voice call" : "Call in progress"}
            >
              <Phone className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setShowPinned(!showPinned)}
            className={`p-2 rounded-lg transition-colors ${
              showPinned
                ? "bg-primary/10 text-primary"
                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            title="Pinned Messages"
          >
            <Pin className="w-5 h-5" />
          </button>
          {canVerify && (
            <button
              onClick={handleVerify}
              className="p-2 rounded-lg transition-colors hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="View safety number"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowProfilePanel(!showProfilePanel)}
            className={`p-2 rounded-lg transition-colors ${
              showProfilePanel
                ? "bg-primary/10 text-primary"
                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            title={showProfilePanel ? "Hide profile" : "Show profile"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mx-8 border-b border-border/50" />
      {showPinned && (
        <PinnedMessages
          conversationId={activeChat.conversationId}
          onClose={() => setShowPinned(false)}
          onJump={handleJump}
        />
      )}
    </div>
  );
}
