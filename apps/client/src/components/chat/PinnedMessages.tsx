import { useState, useEffect } from "react";
import { Message } from "../../api/types";
import { messages, crypto } from "../../api";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../utils/formatters";
import { useChat } from "../../context/ChatContext";

interface PinnedMessagesProps {
  conversationId: string;
  onClose: () => void;
  onJump: (messageId: string) => void;
}

export function PinnedMessages({ conversationId, onClose, onJump }: PinnedMessagesProps) {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [decryptedContent, setDecryptedContent] = useState<Record<string, string>>({});
  const { keys } = useAuth();
  const { unpinMessage } = useChat();

  useEffect(() => {
    const fetchPinned = async () => {
      try {
        const msgs = await messages.getPinnedMessages(conversationId);
        setPinnedMessages(msgs);
        
        if (keys) {
          const decrypted: Record<string, string> = {};
          for (const msg of msgs) {
            try {
              if (msg.encrypted_key && msg.encrypted_key.length > 0) {
                 const messageKey = await crypto.decryptFromSender(keys.kem_secret_key, msg.encrypted_key);
                 const ratchetMsgJson = crypto.bytesToString(msg.encrypted_content);
                 const ratchetMsg = JSON.parse(ratchetMsgJson);
                 const contentBytes = await crypto.decryptWithMessageKey(messageKey, ratchetMsg.ciphertext);
                 decrypted[msg.id] = crypto.bytesToString(contentBytes);
              } else {
                 decrypted[msg.id] = "[Unable to decrypt]";
              }
            } catch (e) {
              console.error("Failed to decrypt pinned message", e);
              decrypted[msg.id] = "[Decryption Error]";
            }
          }
          setDecryptedContent(decrypted);
        }
      } catch (err) {
        console.error("Failed to fetch pinned messages:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPinned();
  }, [conversationId, keys]);

  const handleUnpin = async (e: React.MouseEvent, messageId: string) => {
    e.stopPropagation();
    try {
      await unpinMessage(messageId);
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
    } catch (err) {
      console.error("Failed to unpin message:", err);
    }
  };

  return (
    <div className="absolute top-16 right-6 z-50 w-80 bg-card border border-border rounded-lg shadow-xl flex flex-col max-h-[400px]">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="font-semibold text-sm">Pinned Messages</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {isLoading ? (
          <div className="flex justify-center p-4">
             <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm p-4">
            No pinned messages
          </div>
        ) : (
          pinnedMessages.map(msg => (
            <div 
              key={msg.id} 
              className="bg-secondary/30 rounded p-2 text-sm cursor-pointer hover:bg-secondary/50 transition-colors group"
              onClick={() => onJump(msg.id)}
            >
              <div className="flex justify-between items-start mb-1">
                 <span className="font-medium text-xs text-muted-foreground">
                   {formatDate(msg.created_at)}
                 </span>
                 <button 
                   onClick={(e) => handleUnpin(e, msg.id)}
                   className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                   title="Unpin"
                 >
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                     <line x1="18" y1="6" x2="6" y2="18" />
                     <line x1="6" y1="6" x2="18" y2="18" />
                   </svg>
                 </button>
              </div>
              <p className="text-foreground truncate line-clamp-2">
                {decryptedContent[msg.id] || "Loading..."}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
