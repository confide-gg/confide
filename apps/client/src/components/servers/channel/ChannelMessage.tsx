import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cn } from "../../../lib/utils";
import { UserAvatar } from "../../ui/user-avatar";
import type { FederatedMember as Member } from "../../../features/servers/federatedClient";
import { type DisplayMessage, shouldShowHeader, formatDate } from "./helpers";

interface ChannelMessageProps {
  message: DisplayMessage;
  index: number;
  messages: DisplayMessage[];
  member: Member | undefined;
  onProfileClick: (memberId: string, event: React.MouseEvent) => void;
}

export function ChannelMessage({
  message,
  index,
  messages,
  member,
  onProfileClick,
}: ChannelMessageProps) {
  const showHeader = shouldShowHeader(message, index, messages);

  return (
    <div
      key={message.id}
      className={cn(
        "group relative flex gap-3 hover:bg-card-hover/30 px-8 py-1",
        showHeader ? "mt-3" : "mt-0"
      )}
    >
      <div className="w-10 shrink-0 flex items-start pt-0.5">
        {showHeader && (
          <UserAvatar
            user={member || { username: message.senderName }}
            size="sm"
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => onProfileClick(message.senderId, e)}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        {showHeader && (
          <div className="flex items-baseline gap-2 mb-1">
            <span
              className="text-sm font-semibold text-foreground cursor-pointer hover:underline"
              onClick={(e) => onProfileClick(message.senderId, e)}
            >
              {member?.display_name || message.senderName}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
            {message.decryptionFailed && (
              <span title="Decryption failed">
                <FontAwesomeIcon icon="triangle-exclamation" className="w-3 h-3 text-destructive" />
              </span>
            )}
          </div>
        )}

        <div className="text-sm text-foreground break-words">
          {message.decryptionFailed ? (
            <span className="text-destructive/80 italic">[Unable to decrypt message]</span>
          ) : message.content.startsWith("http") ? (
            message.content.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
              <img
                src={message.content}
                alt="Content"
                className="max-w-xs rounded-lg mt-1 cursor-pointer hover:opacity-90 transition-opacity"
              />
            ) : (
              <a
                href={message.content}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {message.content}
              </a>
            )
          ) : (
            message.content
          )}
        </div>
      </div>
    </div>
  );
}
