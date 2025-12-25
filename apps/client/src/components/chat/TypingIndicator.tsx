import { useChat } from "../../context/chat";

export function TypingIndicator() {
  const { typingUsers, friendsList, activeChat } = useChat();

  if (typingUsers.size === 0 || !activeChat) return null;

  const typingUserIds = Array.from(typingUsers.keys());

  const getUsername = (userId: string): string => {
    if (userId === activeChat.visitorId) {
      return activeChat.visitorUsername;
    }
    const friend = friendsList.find(f => f.id === userId);
    return friend?.username || "Someone";
  };

  const typingNames = typingUserIds.map(getUsername);

  let text: string;
  if (typingNames.length === 1) {
    text = `${typingNames[0]} is typing`;
  } else if (typingNames.length === 2) {
    text = `${typingNames[0]} and ${typingNames[1]} are typing`;
  } else {
    text = `${typingNames.length} people are typing`;
  }

  return (
    <div className="h-5 px-8 flex items-center gap-2 text-xs text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-200">
      <div className="flex gap-1 items-center">
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" />
      </div>
      <span className="font-medium">{text}</span>
    </div>
  );
}
