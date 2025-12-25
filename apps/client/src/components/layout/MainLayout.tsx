import { useEffect, useState, useMemo } from "react";
import { useChat } from "../../context/chat";
import { useAuth } from "../../context/AuthContext";
import { useServer } from "../../context/server";
import { cn } from "../../lib/utils";
import { Sidebar } from "../sidebar/Sidebar";
import { ChatArea } from "../chat/ChatArea";
import { GroupChatArea } from "../groups/GroupChatArea";
import { FriendsPage, DiscoveryPage } from "../pages";
import { Panel } from "./Panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { ContextMenu } from "../common/ContextMenu";
import { DmContextMenu } from "../sidebar/DmContextMenu";
import { GroupContextMenu } from "../groups/GroupContextMenu";
import { ProfileModal } from "../profile/ProfileModal";
import { VerifyModal } from "../common/VerifyModal";
import { toast } from "sonner";
import { useDropzone } from "../../hooks/useDropzone";
import { Button } from "../ui/button";
import { ServerList } from "../sidebar/ServerList";
import { ChannelList } from "../servers/ChannelList";
import { ChannelChat } from "../servers/ChannelChat";
import { MemberList } from "../servers/MemberList";
import { ServerOfflineOverlay } from "../common/ServerOfflineOverlay";
import { Avatar } from "../ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "../ui/tooltip";
import { groupService } from "../../features/groups/groupService";
import { AddGroupMembersModal } from "../groups/AddGroupMembersModal";
import { conversationService } from "../../features/chat/conversations";
import { cryptoService } from "../../core/crypto/crypto";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { KeyboardShortcutsModal } from "../common/KeyboardShortcutsModal";

export function MainLayout() {
  const { user, keys } = useAuth();
  const { activeServer, activeChannel, setActiveServer } = useServer();
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [confirmGroupAction, setConfirmGroupAction] = useState<{
    type: "leave" | "delete";
    conversationId: string;
  } | null>(null);
  const [addMembersTarget, setAddMembersTarget] = useState<{
    conversationId: string;
    conversationKey: number[];
  } | null>(null);
  const {
    activeChat,
    sidebarView,
    setSidebarView,
    contextMenu,
    setContextMenu,
    dmContextMenu,
    setDmContextMenu,
    groupContextMenu,
    setGroupContextMenu,
    profileView,
    setProfileView,
    confirmRemove,
    setConfirmRemove,
    removeFriend,
    friendsList,
    openChat,
    closeDm,
    verifyModal,
    setVerifyModal,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    isConnected,
    hasConnectedOnce,
    unreadCounts,
    dmPreviews,
    openDmFromPreview,
  } = useChat();
  const { isDragging } = useDropzone();
  const { showShortcutsModal, setShowShortcutsModal } = useKeyboardShortcuts();

  const unreadDms = useMemo(() => {
    return dmPreviews
      .filter((dm) => !dm.isGroup && (unreadCounts.get(dm.conversationId) || 0) > 0)
      .map((dm) => ({
        ...dm,
        unreadCount: unreadCounts.get(dm.conversationId) || 0,
      }));
  }, [dmPreviews, unreadCounts]);

  useEffect(() => {
    const handleClick = () => {
      setContextMenu(null);
      setDmContextMenu(null);
      setGroupContextMenu(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [setContextMenu, setDmContextMenu, setGroupContextMenu]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      setError("");
    }
  }, [error, setError]);

  useEffect(() => {
    if (successMessage) {
      toast.success(successMessage);
      setSuccessMessage("");
    }
  }, [successMessage, setSuccessMessage]);

  useEffect(() => {
    if (activeServer) {
      setShowDiscovery(false);
    }
  }, [activeServer]);

  useEffect(() => {
    if (activeChat) {
      setShowDiscovery(false);
    }
  }, [activeChat]);

  const renderMainContent = () => {
    if (showDiscovery) {
      return <DiscoveryPage onClose={() => setShowDiscovery(false)} />;
    }

    if (activeChat) {
      return activeChat.isGroup ? <GroupChatArea /> : <ChatArea />;
    }

    switch (sidebarView) {
      case "friends":
        return <FriendsPage />;
      default:
        return <FriendsPage />;
    }
  };

  const handleOpenDiscovery = () => {
    setShowDiscovery(true);
  };

  const handleHomeClick = () => {
    setActiveServer(null);
    setSidebarView("friends");
  };

  return (
    <div className="flex h-screen bg-background text-foreground p-3 gap-3 relative">
      {!isConnected && hasConnectedOnce && <ServerOfflineOverlay />}
      {isDragging && activeChat && (
        <div className="absolute inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-in fade-in duration-150">
          <div className="flex flex-col items-center gap-4 p-8 bg-card border-2 border-dashed border-primary rounded-2xl shadow-2xl">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-primary"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-foreground">Drop file to attach</div>
              <div className="text-sm text-muted-foreground mt-1">Release to upload</div>
            </div>
          </div>
        </div>
      )}
      <aside className="w-16 h-full shrink-0">
        <TooltipProvider delayDuration={0}>
          <Panel className="h-full flex flex-col items-center">
            <div className="h-14 w-full flex items-center justify-center shrink-0">
              <button
                onClick={handleHomeClick}
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 font-bold text-lg",
                  !activeServer
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                )}
              >
                C
              </button>
            </div>

            {unreadDms.length > 0 && (
              <div className="flex flex-col items-center gap-2 px-1 w-full pb-2">
                <div className="w-6 h-px bg-border" />
                {unreadDms.map((dm) => (
                  <Tooltip key={dm.conversationId}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          openDmFromPreview(dm);
                          setActiveServer(null);
                        }}
                        className="relative w-10 h-10 rounded-full hover:rounded-lg transition-all duration-200"
                      >
                        <Avatar fallback={dm.visitorUsername} size="md" className="w-10 h-10" />
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white border-[3px] border-card">
                          {dm.unreadCount > 99 ? "99+" : dm.unreadCount}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p>{dm.visitorUsername}</p>
                      <p className="text-xs text-muted-foreground">
                        {dm.unreadCount} unread message{dm.unreadCount !== 1 ? "s" : ""}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto py-4 w-full">
              <ServerList onOpenDiscovery={handleOpenDiscovery} />
            </div>
          </Panel>
        </TooltipProvider>
      </aside>

      {activeServer && <ChannelList />}

      {!activeServer && (
        <Sidebar
          onLeaveGroup={(conversationId) => {
            setConfirmGroupAction({ type: "leave", conversationId });
          }}
        />
      )}

      {!activeServer && (
        <Panel className="flex-1 flex flex-col min-w-0 relative">{renderMainContent()}</Panel>
      )}

      {activeServer && activeChannel && (
        <main className="flex-1 flex min-w-0 relative overflow-hidden gap-3">
          <Panel className="flex-1 flex flex-col min-w-0">
            <ChannelChat />
          </Panel>
          <MemberList />
        </main>
      )}

      {activeServer && !activeChannel && (
        <Panel className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg font-medium">Welcome to {activeServer.name}</p>
            <p className="text-sm mt-1 text-muted-foreground">Select a channel to start chatting</p>
          </div>
        </Panel>
      )}

      {contextMenu && (
        <ContextMenu
          data={contextMenu}
          onMessage={() => {
            const friend = friendsList.find((f) => f.id === contextMenu.friendId);
            if (friend) openChat(friend);
            setContextMenu(null);
          }}
          onRemove={() => {
            const friend = friendsList.find((f) => f.id === contextMenu.friendId);
            if (friend) setConfirmRemove(friend);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
          onVerify={() => {
            const friend = friendsList.find((f) => f.id === contextMenu.friendId);
            if (friend && friend.kem_public_key) {
              setVerifyModal({
                friendId: friend.id,
                friendUsername: friend.username,
                theirIdentityKey: friend.kem_public_key,
              });
            }
            setContextMenu(null);
          }}
        />
      )}

      {dmContextMenu && (
        <DmContextMenu
          data={dmContextMenu}
          onClose={() => setDmContextMenu(null)}
          onCloseDm={() => {
            closeDm(dmContextMenu.conversationId);
            setDmContextMenu(null);
          }}
          onUnfriend={() => {
            const friend = friendsList.find((f) => f.id === dmContextMenu.visitorId);
            if (friend) setConfirmRemove(friend);
            setDmContextMenu(null);
          }}
        />
      )}

      {groupContextMenu && (
        <GroupContextMenu
          data={groupContextMenu}
          onClose={() => setGroupContextMenu(null)}
          onAddMember={async () => {
            try {
              if (!keys || !user) return;
              const convs = await conversationService.getConversations();
              const conv = convs.find((c) => c.id === groupContextMenu.conversationId);
              if (!conv) throw new Error("Conversation not found");
              const conversationKey = await cryptoService.decryptFromSender(
                keys.kem_secret_key,
                conv.encrypted_sender_key
              );
              setAddMembersTarget({ conversationId: conv.id, conversationKey });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to open add member");
            } finally {
              setGroupContextMenu(null);
            }
          }}
          onLeave={() => {
            setConfirmGroupAction({
              type: "leave",
              conversationId: groupContextMenu.conversationId,
            });
            setGroupContextMenu(null);
          }}
          onDelete={() => {
            setConfirmGroupAction({
              type: "delete",
              conversationId: groupContextMenu.conversationId,
            });
            setGroupContextMenu(null);
          }}
        />
      )}

      {addMembersTarget && (
        <AddGroupMembersModal
          isOpen={true}
          onClose={() => setAddMembersTarget(null)}
          conversationId={addMembersTarget.conversationId}
          conversationKey={addMembersTarget.conversationKey}
          friends={friendsList}
          maxTotalMembers={10}
          onAdded={() => setAddMembersTarget(null)}
        />
      )}

      <Dialog
        open={!!confirmGroupAction}
        onOpenChange={(open) => !open && setConfirmGroupAction(null)}
      >
        <DialogContent className="max-w-[460px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {confirmGroupAction?.type === "delete" ? "Delete Group" : "Leave Group"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {confirmGroupAction?.type === "delete" ? (
              <>
                <p>Are you sure you want to delete this group?</p>
                <p className="text-muted-foreground text-sm">This will remove it for everyone.</p>
              </>
            ) : (
              <>
                <p>Are you sure you want to leave this group?</p>
                <p className="text-muted-foreground text-sm">You can be added back later.</p>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmGroupAction(null)}>
              Cancel
            </Button>
            <Button
              variant={confirmGroupAction?.type === "delete" ? "destructive" : "default"}
              onClick={async () => {
                if (!confirmGroupAction) return;
                try {
                  if (confirmGroupAction.type === "delete") {
                    await groupService.deleteGroup(confirmGroupAction.conversationId);
                  } else {
                    await groupService.leaveGroup(confirmGroupAction.conversationId);
                  }
                  closeDm(confirmGroupAction.conversationId);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Action failed");
                } finally {
                  setConfirmGroupAction(null);
                }
              }}
            >
              {confirmGroupAction?.type === "delete" ? "Delete Group" : "Leave Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(null)}>
        <DialogContent className="max-w-[460px] bg-card border-border">
          <DialogHeader>
            <DialogTitle>Remove Friend</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p>
              Are you sure you want to remove <strong>@{confirmRemove?.username}</strong> from your
              friends?
            </p>
            <p className="text-muted-foreground text-sm">
              This will remove them from your friends list. You can add them back later.
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemove && removeFriend(confirmRemove)}
            >
              Remove Friend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {profileView && (
        <ProfileModal
          userId={profileView.userId}
          username={profileView.username}
          isOnline={profileView.isOnline}
          onClose={() => setProfileView(null)}
        />
      )}

      {verifyModal && keys && user && (
        <VerifyModal
          isOpen={true}
          onClose={() => setVerifyModal(null)}
          ourUsername={user.username}
          theirUsername={verifyModal.friendUsername}
          ourIdentityKey={keys.kem_public_key}
          theirIdentityKey={verifyModal.theirIdentityKey}
        />
      )}

      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
