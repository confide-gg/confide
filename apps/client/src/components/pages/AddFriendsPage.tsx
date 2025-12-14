import { useChat } from "../../context/ChatContext";
import { getInitials } from "../common/Avatar";

export function AddFriendsPage() {
  const { searchQuery, setSearchQuery, searchResults, isSearching, sentRequests, searchUsers, handleSendFriendRequest } = useChat();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-2xl font-bold text-foreground">Add Friends</h2>
        <p className="text-sm text-muted-foreground mt-1">Search for users by their username</p>
      </div>

      <form onSubmit={handleSearch} className="p-6 space-y-4 border-b border-border bg-secondary/20 shrink-0">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter a username..."
            disabled={isSearching}
            className="flex-1 px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={isSearching || searchQuery.length < 2}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Search
              </>
            )}
          </button>
        </div>
      </form>

      <div className="flex-1 overflow-y-auto p-6">
        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <div className="text-center p-4 bg-secondary/50 border border-border rounded-lg text-sm text-muted-foreground">
            Enter at least 2 characters to search
          </div>
        )}

        {searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Users Found</h3>
            <p className="text-sm text-muted-foreground">Try a different username</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {searchResults.map((result) => (
              <div key={result.id} className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold shrink-0">
                  {getInitials(result.username)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">@{result.username}</div>
                </div>
                {sentRequests.has(result.id) ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-medium shrink-0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Sent
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/80 transition-colors shrink-0"
                    onClick={() => handleSendFriendRequest(result)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="8.5" cy="7" r="4" />
                      <line x1="20" y1="8" x2="20" y2="14" />
                      <line x1="23" y1="11" x2="17" y2="11" />
                    </svg>
                    Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
