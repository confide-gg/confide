import { useEffect, useState, useRef, useCallback } from "react";
import { useServer } from "../../context/server";
import { useAuth } from "../../context/AuthContext";
import { usePresence } from "../../context/PresenceContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { cryptoService } from "../../core/crypto/crypto";
import type { FederatedMember as Member } from "../../features/servers/federatedClient";
import type { WsMessage as ServerMessage } from "../../core/network/wsTypes";
import type { EncryptedMessage } from "../../features/servers/types";
import { MemberProfileCard } from "./MemberProfileCard";
import { ChannelMessage, ChannelInputForm, TypingIndicator, type DisplayMessage } from "./channel";

export function ChannelChat() {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profilePosition, setProfilePosition] = useState({ x: 0, y: 0 });

  const { activeChannel, federatedClient, federatedWs, categories } = useServer();
  const { keys } = useAuth();
  const { getUserPresence, subscribeToUsers, isWsConnected } = usePresence();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [myMember, setMyMember] = useState<Member | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingClearTimeoutsRef = useRef<Map<string, number>>(new Map());

  const handleProfileClick = (memberId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    setProfilePosition({ x: rect.right, y: rect.top });
    setSelectedProfileId(memberId);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMembers = useCallback(async () => {
    if (!federatedClient) return;
    try {
      const [allMembers, me] = await Promise.all([
        federatedClient.getMembers(),
        federatedClient.getMe(),
      ]);
      setMembers(allMembers);
      setMyMember(me);
    } catch (err) {
      console.error("Failed to load members:", err);
    }
  }, [federatedClient]);

  useEffect(() => {
    if (members.length > 0 && isWsConnected) {
      const centralUserIds = members.map((m) => m.central_user_id).filter(Boolean);
      subscribeToUsers(centralUserIds);
    }
  }, [members, isWsConnected, subscribeToUsers]);

  const getChannelKey = async (channelId: string): Promise<number[] | null> => {
    if (!keys || !myMember) return null;
    const encryptedKey = myMember.channel_keys?.[channelId];
    if (!encryptedKey || encryptedKey.length === 0) return null;
    try {
      return await cryptoService.decryptFromSender(keys.kem_secret_key, encryptedKey);
    } catch (err) {
      console.error("Failed to decrypt channel key:", err);
      return null;
    }
  };

  const decryptMessage = async (msg: EncryptedMessage): Promise<DisplayMessage> => {
    if (!keys || !myMember) {
      return {
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_username,
        content: "[Unable to decrypt - not logged in]",
        createdAt: msg.created_at,
        isMine: myMember?.id === msg.sender_id,
        verified: false,
        decryptionFailed: true,
      };
    }

    try {
      const channelKey = await getChannelKey(msg.channel_id);
      if (!channelKey) {
        return {
          id: msg.id,
          senderId: msg.sender_id,
          senderName: msg.sender_username,
          content: "[Unable to decrypt - no channel key]",
          createdAt: msg.created_at,
          isMine: myMember?.id === msg.sender_id,
          verified: false,
          decryptionFailed: true,
        };
      }

      const decryptedContent = await cryptoService.decryptWithKey(
        channelKey,
        msg.encrypted_content
      );
      const content = cryptoService.bytesToString(decryptedContent);

      let verified = false;
      if (msg.sender_dsa_public_key && msg.sender_dsa_public_key.length > 0 && msg.signature) {
        try {
          verified = await cryptoService.dsaVerify(
            msg.sender_dsa_public_key!,
            msg.encrypted_content,
            msg.signature
          );
        } catch {
          verified = false;
        }
      }

      return {
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_username,
        content,
        createdAt: msg.created_at,
        isMine: myMember?.id === msg.sender_id,
        verified,
        decryptionFailed: false,
      };
    } catch (err) {
      console.error("Decryption failed for message:", msg.id, err);
      return {
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_username,
        content: "[Decryption failed]",
        createdAt: msg.created_at,
        isMine: myMember?.id === msg.sender_id,
        verified: false,
        decryptionFailed: true,
      };
    }
  };

  const loadMessages = useCallback(async () => {
    if (!activeChannel || !federatedClient || !keys || !myMember) return;
    setIsLoading(true);
    setError(null);
    try {
      const encryptedMsgs = await federatedClient.getMessages(activeChannel.id);
      const decryptedMsgs = await Promise.all(
        encryptedMsgs.map((msg: EncryptedMessage) => decryptMessage(msg))
      );
      setMessages(decryptedMsgs.reverse());
    } catch (err) {
      console.error("Failed to load messages:", err);
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [activeChannel, federatedClient, keys, myMember]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    if (myMember) loadMessages();
  }, [loadMessages, myMember]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!federatedWs || !activeChannel || !keys || !myMember) return;
    federatedWs.subscribeChannel(activeChannel.id);

    const unsubscribe = federatedWs.onMessage(async (message: ServerMessage) => {
      switch (message.type) {
        case "new_message": {
          if (message.data.channel_id !== activeChannel.id) return;
          const wsMsg = message.data;
          const encryptedMsg: EncryptedMessage = {
            id: wsMsg.id,
            channel_id: wsMsg.channel_id!,
            sender_id: wsMsg.sender_id,
            sender_username: wsMsg.sender_username,
            sender_dsa_public_key: wsMsg.sender_dsa_public_key,
            encrypted_content: wsMsg.encrypted_content,
            signature: wsMsg.signature,
            reply_to_id: wsMsg.reply_to_id || undefined,
            created_at: wsMsg.created_at,
          };
          const decrypted = await decryptMessage(encryptedMsg);
          setMessages((prev) => {
            if (prev.some((m) => m.id === decrypted.id)) return prev;
            return [...prev, decrypted];
          });
          break;
        }
        case "typing_start": {
          if (message.data.channel_id !== activeChannel.id) return;
          if (message.data.member_id === myMember.id) return;
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.set(message.data.member_id, message.data.username);
            return next;
          });
          const existingTimeout = typingClearTimeoutsRef.current.get(message.data.member_id);
          if (existingTimeout) clearTimeout(existingTimeout);
          const timeoutId = window.setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Map(prev);
              next.delete(message.data.member_id);
              return next;
            });
            typingClearTimeoutsRef.current.delete(message.data.member_id);
          }, 3000);
          typingClearTimeoutsRef.current.set(message.data.member_id, timeoutId);
          break;
        }
        case "typing_stop": {
          if (message.data.channel_id !== activeChannel.id) return;
          const existingTimeout = typingClearTimeoutsRef.current.get(message.data.member_id);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
            typingClearTimeoutsRef.current.delete(message.data.member_id);
          }
          setTypingUsers((prev) => {
            const next = new Map(prev);
            next.delete(message.data.member_id);
            return next;
          });
          break;
        }
        case "message_deleted": {
          if (message.data.channel_id !== activeChannel.id) return;
          setMessages((prev) => prev.filter((m) => m.id !== message.data.message_id));
          break;
        }
      }
    });

    return () => {
      unsubscribe();
      federatedWs.unsubscribeChannel(activeChannel.id);
      typingClearTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingClearTimeoutsRef.current.clear();
      setTypingUsers(new Map());
    };
  }, [federatedWs, activeChannel, keys, myMember]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (federatedWs && activeChannel && e.target.value.trim()) {
      federatedWs.sendTyping(activeChannel.id);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = window.setTimeout(() => {
        federatedWs.sendStopTyping(activeChannel.id);
      }, 2000);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !federatedClient || isSending || !keys || !myMember)
      return;
    setIsSending(true);
    try {
      const channelKey = await getChannelKey(activeChannel.id);
      if (!channelKey) {
        setError("No channel key available. Please contact an admin to receive access.");
        setIsSending(false);
        return;
      }
      const contentBytes = cryptoService.stringToBytes(newMessage.trim());
      const encryptedContent = await cryptoService.encryptWithKey(channelKey, contentBytes);
      const signature = await cryptoService.dsaSign(keys.dsa_secret_key, encryptedContent);
      await federatedClient.sendMessage(activeChannel.id, {
        encrypted_content: encryptedContent,
        signature,
      });
      setNewMessage("");
      if (!federatedWs?.isConnected()) await loadMessages();
    } catch (err) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  if (!activeChannel) return null;

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-8 text-center">
        <div className="text-destructive mb-4">
          <FontAwesomeIcon icon="triangle-exclamation" className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Channel Error</h3>
        <p className="text-sm text-muted-foreground max-w-md">{error}</p>
        <button
          onClick={loadMessages}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    );
  }

  const categoryName =
    categories.find((c) => c.id === activeChannel.category_id)?.name || "Text Channels";
  const selectedMember = members.find((m) => m.id === selectedProfileId);
  const selectedPresence = selectedMember
    ? getUserPresence(selectedMember.central_user_id)
    : undefined;
  const memberIsOnline = selectedPresence !== undefined;
  const memberStatus = memberIsOnline ? selectedPresence?.status || "online" : "offline";

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      <div className="shrink-0 h-14 px-6 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {categoryName}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <FontAwesomeIcon icon="hashtag" className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="text-sm font-semibold text-foreground truncate">
              {activeChannel.name}
            </div>
          </div>
        </div>
      </div>

      {selectedProfileId && (
        <MemberProfileCard
          userId={selectedMember?.central_user_id || selectedProfileId}
          username={selectedMember?.username || "?"}
          status={memberStatus}
          roles={[]}
          position={profilePosition}
          onClose={() => setSelectedProfileId(null)}
        />
      )}

      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
            <span className="text-sm font-medium">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center text-muted-foreground p-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <FontAwesomeIcon icon="hashtag" className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Welcome to #{activeChannel.name}
            </h3>
            <p className="text-sm max-w-sm">
              This is the start of the channel. Messages are end-to-end encrypted.
            </p>
          </div>
        ) : (
          <div className="flex flex-col py-6">
            {messages.map((msg, idx) => (
              <ChannelMessage
                key={msg.id}
                message={msg}
                index={idx}
                messages={messages}
                member={members.find((m) => m.id === msg.senderId)}
                onProfileClick={handleProfileClick}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="h-auto min-h-[68px] px-8 py-4 flex-none z-20 relative">
        <TypingIndicator typingUsers={typingUsers} />
        <ChannelInputForm
          channelName={activeChannel.name}
          value={newMessage}
          onChange={handleInputChange}
          onSubmit={handleSendMessage}
          onGifSelect={(url) => setNewMessage(url)}
          onEmojiSelect={(emoji) => {
            setNewMessage((prev) => prev + emoji.native);
            if (federatedWs && activeChannel) federatedWs.sendTyping(activeChannel.id);
          }}
          disabled={!myMember}
          isSending={isSending}
        />
      </div>
    </div>
  );
}
