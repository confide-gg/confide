import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { wsService } from "../api";
import { useFriends } from "../hooks/useFriends";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";

export function Friends() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    friendsList,
    friendRequests,
    searchResults,
    searchQuery,
    setSearchQuery,
    isSearching,
    loadFriends,
    loadFriendRequests,
    searchUsers,
    handleSendFriendRequest,
    handleAcceptRequest,
    handleRejectRequest,
    onFriendAccepted,
    sentRequests
  } = useFriends();

  const [activeTab, setActiveTab] = useState<"friends" | "requests" | "search">("friends");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadFriends();
    loadFriendRequests();

    const unsubscribe = wsService.onMessage((message) => {
      if (message.type === "friend_request") {
        loadFriendRequests();
      } else if (message.type === "friend_accepted") {
        onFriendAccepted(message.data.by_user_id, message.data.by_username)
          .then(() => {
            setSuccessMessage(`@${message.data.by_username} accepted your friend request!`);
            setTimeout(() => setSuccessMessage(""), 3000);
          })
          .catch((err) => console.error(err));
      }
    });

    pollIntervalRef.current = setInterval(() => {
      loadFriendRequests();
    }, 30000);

    return () => {
      unsubscribe();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadFriends, loadFriendRequests, onFriendAccepted]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.length < 2) {
      setError("Search query must be at least 2 characters");
      return;
    }
    setError("");
    await searchUsers(searchQuery);
  };

  const onSendRequest = async (user: any) => {
    if (sentRequests.has(user.id)) return;
    setLoadingAction(user.id);
    try {
      await handleSendFriendRequest(user);
      setSuccessMessage(`Request sent to @${user.username}`);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError("Failed to send request");
    } finally {
      setLoadingAction(null);
    }
  };

  const onLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b border-border bg-card/50 backdrop-blur shrink-0">
        <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-[#a8d15a] bg-clip-text text-transparent">Confide</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Avatar fallback={user?.username} size="sm" />
            <span className="text-sm font-medium">@{user?.username}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </header>

      <nav className="flex gap-2 p-4 border-b border-border bg-muted/20 shrink-0 overflow-x-auto">
        <div className="flex bg-secondary p-1 rounded-lg">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "friends" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("friends")}
          >
            Friends {friendsList.length > 0 && <Badge variant="secondary" className="ml-2">{friendsList.length}</Badge>}
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "requests" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("requests")}
          >
            Requests {friendRequests.length > 0 && <Badge variant="destructive" className="ml-2">{friendRequests.length}</Badge>}
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "search" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("search")}
          >
            Add Friends
          </button>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full">
        {error && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm font-medium">{error}</div>}
        {successMessage && <div className="mb-4 p-3 rounded-lg bg-green-500/10 text-green-500 text-sm font-medium">{successMessage}</div>}

        {activeTab === "friends" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {friendsList.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                <Avatar fallback="?" size="xl" className="mb-4 opacity-50 bg-secondary" />
                <p>No friends yet. Search for users to add friends!</p>
              </div>
            ) : (
              friendsList.map((friend) => (
                <div key={friend.id} className="flex items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <Avatar fallback={friend.username} size="md" />
                  <span className="font-medium truncate">@{friend.username}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "requests" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friendRequests.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                <p>No pending friend requests.</p>
              </div>
            ) : (
              friendRequests.map((request) => (
                <div key={request.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex items-center gap-3">
                    <Avatar fallback={request.from_user.username} size="md" />
                    <div className="flex flex-col">
                      <span className="font-medium">@{request.from_user.username}</span>
                      <span className="text-xs text-muted-foreground">{new Date(request.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => handleAcceptRequest(request)}
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleRejectRequest(request.id)}
                      variant="secondary"
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "search" && (
          <div className="flex flex-col gap-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username..."
                disabled={isSearching}
                className="flex-1"
              />
              <Button type="submit" disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </form>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {searchResults.length === 0 && searchQuery && !isSearching && (
                <div className="col-span-full p-8 text-center text-muted-foreground">No users found.</div>
              )}
              {searchResults.map((result) => {
                const isFriend = friendsList.some(f => f.id === result.id);
                const sent = sentRequests.has(result.id);

                if (result.id === user?.id || isFriend) return null;

                return (
                  <div key={result.id} className="flex items-center justify-between p-4 rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex items-center gap-3 relative min-w-0">
                      <Avatar fallback={result.username} size="sm" />
                      <span className="font-medium truncate">@{result.username}</span>
                    </div>
                    {sent ? (
                      <Badge variant="secondary">Sent</Badge>
                    ) : (
                      <Button
                        onClick={() => onSendRequest(result)}
                        size="sm"
                        disabled={loadingAction === result.id}
                      >
                        Add
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
