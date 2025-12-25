import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useChat } from "../../context/chat";

export function SidebarNav() {
  const { sidebarView, setSidebarView, friendRequests, setActiveChat } = useChat();

  const handleFriendsClick = () => {
    setActiveChat(null);
    setSidebarView("friends");
  };

  const isActive = sidebarView === "friends";
  const hasPendingRequests = friendRequests.length > 0;

  return (
    <button
      onClick={handleFriendsClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <FontAwesomeIcon icon="users" className="w-5 h-5 shrink-0" />
      <span className="flex-1 truncate text-left text-sm font-medium">Friends</span>
      {hasPendingRequests && (
        <span
          className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-medium ${
            isActive
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-destructive text-destructive-foreground"
          }`}
        >
          {friendRequests.length}
        </span>
      )}
    </button>
  );
}
