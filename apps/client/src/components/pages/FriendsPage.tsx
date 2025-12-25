import { useState, useEffect } from "react";
import { useChat } from "../../context/chat";
import { usePresence } from "../../context/PresenceContext";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { Search } from "lucide-react";
import { ActivityDisplay } from "../activity/ActivityDisplay";
import { useUserActivity } from "../../hooks/useUserActivity";
import { type Friend } from "../../types";

type FriendsTab = "online" | "all" | "pending" | "blocked" | "add_friend";

const STATUS_LABELS: Record<string, string> = {
  online: "Online",
  away: "Away",
  dnd: "Do Not Disturb",
  invisible: "Invisible",
  offline: "Offline",
};

interface FriendRowProps {
  friend: Friend;
  onOpenChat: (friend: Friend) => void;
  onRemove: (friend: Friend) => void;
  getUserPresence: (userId: string) => { status?: string } | undefined;
  isOnline: (userId: string) => boolean;
}

function FriendRow({ friend, onOpenChat, onRemove, getUserPresence, isOnline }: FriendRowProps) {
  const presence = getUserPresence(friend.id);
  const activity = useUserActivity(friend.id);
  const userIsOnline = isOnline(friend.id);
  const displayStatus = userIsOnline ? presence?.status || "online" : "offline";

  return (
    <div
      onClick={() => onOpenChat(friend)}
      className="group flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border hover:bg-accent/50 cursor-pointer transition-all mb-3 relative overflow-hidden"
    >
      <div className="flex items-center gap-4 relative flex-1 min-w-0">
        <div className="relative shrink-0">
          <Avatar
            fallback={friend.username}
            status={displayStatus as "online" | "away" | "dnd" | "invisible" | "offline"}
            className="w-12 h-12 border-2 border-background"
          />
        </div>
        <div className="flex flex-col flex-1 min-w-0">
          <span className="font-semibold text-foreground text-base tracking-tight">
            {friend.username}
          </span>
          {activity ? (
            <ActivityDisplay activity={activity} compact className="mt-1" />
          ) : (
            <span
              className={`text-xs font-medium ${userIsOnline ? "text-green-500" : "text-muted-foreground"}`}
            >
              {STATUS_LABELS[displayStatus] || "Offline"}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 relative">
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onOpenChat(friend);
          }}
          className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
        >
          Message
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(friend);
          }}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

export function FriendsPage() {
  const {
    friendsList,
    openChat,
    setConfirmRemove,
    searchQuery,
    setSearchQuery,
    searchResults,
    sentRequests,
    searchUsers,
    handleSendFriendRequest,
    friendRequests,
    handleAcceptRequest,
    handleRejectRequest,
  } = useChat();
  const { getUserPresence, subscribeToUsers, isWsConnected, isOnline } = usePresence();

  const [activeTab, setActiveTab] = useState<FriendsTab>("online");
  const [localSearch, setLocalSearch] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (friendsList.length > 0 && isWsConnected) {
      const friendIds = friendsList.map((f) => f.id);
      subscribeToUsers(friendIds);
    }
  }, [friendsList, isWsConnected, subscribeToUsers]);

  const onlineFriends = friendsList.filter((f) => isOnline(f.id));

  // Handlers
  const onSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setHasSearched(false);
    setSuccessMsg("");
    await searchUsers(searchQuery);
    setHasSearched(true);
  };

  const onSendRequest = async (user: any) => {
    await handleSendFriendRequest(user);
    setSuccessMsg(`Friend request sent to ${user.username}`);
    setSearchQuery("");
    setHasSearched(false);
  };

  const renderRequestRow = (request: (typeof friendRequests)[0]) => (
    <div
      key={request.id}
      className="group flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 shadow-sm hover:shadow-md hover:border-border hover:bg-accent/50 transition-all mb-3"
    >
      <div className="flex items-center gap-4">
        <Avatar
          fallback={request.from_user.username}
          className="w-12 h-12 border-2 border-background"
        />
        <div className="flex flex-col">
          <span className="font-semibold text-foreground text-base">
            {request.from_user.username}
          </span>
          <span className="text-xs text-muted-foreground font-medium">Incoming Friend Request</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleAcceptRequest(request)}
          className="text-muted-foreground hover:text-green-500 hover:bg-green-500/10 transition-colors"
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleRejectRequest(request.id)}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          Decline
        </Button>
      </div>
    </div>
  );

  // Filter lists based on local search
  const filteredFriendsList = friendsList.filter((f) =>
    f.username.toLowerCase().includes(localSearch.toLowerCase())
  );
  const filteredOnlineFriends = onlineFriends.filter((f) =>
    f.username.toLowerCase().includes(localSearch.toLowerCase())
  );
  const filteredRequests = friendRequests.filter((r) =>
    r.from_user.username.toLowerCase().includes(localSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center px-6 h-14 border-b border-border">
        <div className="flex items-center gap-2 mr-6 text-foreground">
          <span className="font-bold text-lg">Friends</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium overflow-x-auto hide-scrollbar">
          <Button
            variant={activeTab === "online" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("online")}
          >
            Online
          </Button>
          <Button
            variant={activeTab === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("all")}
          >
            All
          </Button>
          <Button
            variant={activeTab === "pending" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("pending")}
            className="gap-2"
          >
            Pending
            {friendRequests.length > 0 && (
              <span className="bg-destructive text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {friendRequests.length}
              </span>
            )}
          </Button>
          <Button
            variant={activeTab === "add_friend" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("add_friend")}
            className={activeTab === "add_friend" ? "" : "text-primary"}
          >
            Add Friend
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {activeTab === "add_friend" ? (
          <div className="max-w-2xl w-full mx-auto mt-8">
            <h2 className="text-xl font-bold mb-2 text-foreground">Add Friend</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You can add friends with their Confide username.
            </p>
            <form onSubmit={onSearchSubmit} className="relative mb-6">
              <div
                className={`flex items-center bg-secondary/50 rounded-xl border-2 transition-colors ${hasSearched && searchResults.length === 0 ? "border-destructive" : hasSearched && successMsg ? "border-green-500" : "border-transparent focus-within:border-primary"}`}
              >
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a username..."
                  className="flex-1 bg-transparent border-none text-foreground px-6 py-4 focus:outline-none placeholder:text-muted-foreground/60 text-lg"
                  autoFocus
                />
                <div className="pr-3">
                  <Button
                    size="default"
                    type="button"
                    onClick={onSearchSubmit}
                    disabled={!searchQuery.trim()}
                  >
                    Send Request
                  </Button>
                </div>
              </div>
              {hasSearched && searchResults.length === 0 && searchQuery && (
                <p className="text-destructive text-sm mt-3 px-4">
                  User not found. Please check spelling and capitalization.
                </p>
              )}
              {successMsg && <p className="text-green-500 text-sm mt-3 px-4">{successMsg}</p>}
            </form>

            {hasSearched && searchResults.length > 0 && (
              <div className="mt-8 border rounded-lg p-4 bg-card">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-4 px-2">
                  Result
                </h3>
                {searchResults.map((user) => {
                  const isFriend = friendsList.some((f) => f.id === user.id);
                  const isSent = sentRequests.has(user.id);

                  if (isFriend)
                    return (
                      <div key={user.id} className="text-muted-foreground text-sm px-2">
                        You are already friends with <b>{user.username}</b>
                      </div>
                    );

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-secondary/20"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar fallback={user.username} className="w-10 h-10" />
                        <span className="font-semibold text-lg">{user.username}</span>
                      </div>
                      <Button disabled={isSent} onClick={() => onSendRequest(user)}>
                        {isSent ? "Request Sent" : "Send Friend Request"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 relative">
              <input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Search friends"
                className="w-full bg-secondary/50 border border-transparent focus:border-primary rounded-lg px-4 py-2.5 pl-10 text-sm focus:outline-none transition-colors"
              />
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-4 px-2 tracking-wider">
                {activeTab === "online"
                  ? `Online — ${filteredOnlineFriends.length}`
                  : activeTab === "all"
                    ? `All Friends — ${filteredFriendsList.length}`
                    : `Pending Requests — ${filteredRequests.length}`}
              </h3>

              <div className="space-y-1">
                {activeTab === "online" &&
                  filteredOnlineFriends.map((f) => (
                    <FriendRow
                      key={f.id}
                      friend={f}
                      onOpenChat={openChat}
                      onRemove={setConfirmRemove}
                      getUserPresence={getUserPresence}
                      isOnline={isOnline}
                    />
                  ))}
                {activeTab === "all" &&
                  filteredFriendsList.map((f) => (
                    <FriendRow
                      key={f.id}
                      friend={f}
                      onOpenChat={openChat}
                      onRemove={setConfirmRemove}
                      getUserPresence={getUserPresence}
                      isOnline={isOnline}
                    />
                  ))}
                {activeTab === "pending" && filteredRequests.map(renderRequestRow)}

                {((activeTab === "online" && filteredOnlineFriends.length === 0) ||
                  (activeTab === "all" && filteredFriendsList.length === 0) ||
                  (activeTab === "pending" && filteredRequests.length === 0)) && (
                  <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <p className="text-muted-foreground font-medium">Nothing here yet.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
