export interface DisplayMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isMine: boolean;
  verified: boolean;
  decryptionFailed: boolean;
}

export function shouldShowHeader(
  msg: DisplayMessage,
  idx: number,
  messages: DisplayMessage[]
): boolean {
  if (idx === 0) return true;
  const prevMsg = messages[idx - 1];
  if (prevMsg.senderId !== msg.senderId) return true;
  const prevTime = new Date(prevMsg.createdAt).getTime();
  const currTime = new Date(msg.createdAt).getTime();
  return currTime - prevTime > 5 * 60 * 1000;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return `Today at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  } else if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  } else {
    return (
      date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      ` at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
    );
  }
}
