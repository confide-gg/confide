import { useCallback, MutableRefObject } from "react";
import { keyService } from "@/core/crypto/KeyService";
import { cryptoService } from "@/core/crypto/crypto";
import { toast } from "sonner";
import type { ActiveChat, Friend, DmPreview, ReplyTo, TimedMessageDuration } from "@/types";
import type { SendMessageRequest } from "@/features/chat/types";
import type { MessageQueue } from "@/utils/MessageQueue";
import { getPreviewContent } from "./utils";
import type { AttachmentMeta } from "./types";

interface UseSendMessageParams {
  activeChat: ActiveChat | null;
  messageInput: string;
  setMessageInput: React.Dispatch<React.SetStateAction<string>>;
  userKeys: {
    kem_secret_key: number[];
    kem_public_key: number[];
    dsa_secret_key: number[];
  } | null;
  userId: string | undefined;
  replyTo: ReplyTo | null;
  setReplyTo: React.Dispatch<React.SetStateAction<ReplyTo | null>>;
  timedMessageDuration: TimedMessageDuration;
  setTimedMessageDuration: React.Dispatch<React.SetStateAction<TimedMessageDuration>>;
  friendsList: Friend[];
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveChat: React.Dispatch<React.SetStateAction<ActiveChat | null>>;
  setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
  messageQueuesRef: MutableRefObject<Map<string, MessageQueue>>;
  sendMessageMutation: {
    mutateAsync: (data: SendMessageRequest) => Promise<{ created_at: string }>;
  };
}

export function useSendMessage({
  activeChat,
  messageInput,
  setMessageInput,
  userKeys,
  userId,
  replyTo,
  setReplyTo,
  timedMessageDuration,
  setTimedMessageDuration,
  friendsList,
  setIsSending,
  setActiveChat,
  setDmPreviews,
  messageQueuesRef,
  sendMessageMutation,
}: UseSendMessageParams) {
  const sendMessage = useCallback(
    async (content?: string, attachmentMeta?: AttachmentMeta) => {
      const msgContent = content || messageInput.trim();
      if (!activeChat || !msgContent || !userKeys || !userId) return;

      if (!activeChat.isGroup && !activeChat.ratchetState) {
        console.error("Cannot send message: no ratchet session established");
        alert("Encryption session not ready. Please wait or reopen the chat.");
        return;
      }

      setIsSending(true);
      if (!content) setMessageInput("");
      const currentReplyTo = replyTo;
      setReplyTo(null);
      const currentDuration = timedMessageDuration;
      if (currentDuration) setTimedMessageDuration(null);

      try {
        const msgBytes = cryptoService.stringToBytes(msgContent);
        const expiresAt = currentDuration
          ? new Date(Date.now() + currentDuration * 1000).toISOString()
          : null;

        let encrypted: number[];
        let messageKeys: Array<{ user_id: string; encrypted_key: number[] }> | undefined;

        if (activeChat.isGroup) {
          encrypted = await cryptoService.encryptWithKey(activeChat.conversationKey, msgBytes);
        } else {
          const { MessageQueue } = await import("@/utils/MessageQueue");
          let queue = messageQueuesRef.current.get(activeChat.conversationId);
          if (!queue) {
            queue = new MessageQueue();
            messageQueuesRef.current.set(activeChat.conversationId, queue);
          }

          const encryptionResult = await queue.enqueue(async () => {
            const currentState = activeChat.ratchetState;
            if (!currentState) {
              throw new Error("Chat missing ratchet state");
            }
            const result = await cryptoService.ratchetEncrypt(currentState, msgBytes);
            const encryptedContent = cryptoService.stringToBytes(JSON.stringify(result.message));
            const ratchetNewState = result.new_state;

            const myEncryptedKey = await cryptoService.encryptForRecipient(
              userKeys.kem_public_key,
              result.message_key
            );
            const keys = [{ user_id: userId, encrypted_key: myEncryptedKey }];

            let friendPublicKey = friendsList.find(
              (f) => f.id === activeChat.visitorId
            )?.kem_public_key;
            if (!friendPublicKey) {
              console.error(
                "[Crypto] Friend public key not in friendsList, fetching from server..."
              );
              try {
                const bundle = await keyService.getPrekeyBundle(activeChat.visitorId);
                friendPublicKey = bundle.identity_key;
              } catch (err) {
                console.error("[Crypto] Failed to fetch friend's public key:", err);
                throw new Error("Friend's public key not found");
              }
            }

            const theirEncryptedKey = await cryptoService.encryptForRecipient(
              friendPublicKey,
              result.message_key
            );
            keys.push({ user_id: activeChat.visitorId, encrypted_key: theirEncryptedKey });

            setActiveChat((prev) => (prev ? { ...prev, ratchetState: ratchetNewState } : null));

            const encryptedState = await cryptoService.encryptData(
              userKeys.kem_secret_key,
              ratchetNewState
            );
            keyService
              .saveSession(activeChat.conversationId, activeChat.visitorId, {
                encrypted_state: encryptedState,
              })
              .catch((err) => console.warn("Failed to save session state:", err));

            return { encryptedContent, keys };
          });

          encrypted = encryptionResult.encryptedContent;
          messageKeys = encryptionResult.keys;
        }

        const signature = await cryptoService.dsaSign(userKeys.dsa_secret_key, encrypted);

        const sendData: SendMessageRequest = {
          encrypted_content: encrypted,
          signature,
          reply_to_id: currentReplyTo?.id || null,
          expires_at: expiresAt,
          message_keys: messageKeys,
          attachment: attachmentMeta,
        };

        const response = await sendMessageMutation.mutateAsync(sendData);

        const previewContent = getPreviewContent(msgContent);
        setDmPreviews((prev) => {
          const idx = prev.findIndex((p) => p.conversationId === activeChat.conversationId);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              lastMessage: previewContent,
              lastMessageTime: response.created_at,
              isLastMessageMine: true,
            };
            updated.sort(
              (a, b) =>
                new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
            );
            return updated;
          }
          return [
            {
              conversationId: activeChat.conversationId,
              visitorId: activeChat.visitorId,
              visitorUsername: activeChat.visitorUsername,
              lastMessage: previewContent,
              lastMessageTime: response.created_at,
              isLastMessageMine: true,
            },
            ...prev.filter((p) => p.conversationId !== activeChat.conversationId),
          ];
        });
      } catch (err: any) {
        console.error("Failed to send message", err);

        const errorMessage = err?.message || err?.error || String(err);
        if (
          errorMessage.toLowerCase().includes("rate limit") ||
          errorMessage.toLowerCase().includes("too many")
        ) {
          toast.error("Wow! Wait a little there.", {
            description: "You're sending messages too quickly. Please slow down.",
          });
        }

        if (!content) setMessageInput(msgContent);
      } finally {
        setIsSending(false);
      }
    },
    [
      activeChat,
      messageInput,
      userKeys,
      userId,
      replyTo,
      timedMessageDuration,
      friendsList,
      sendMessageMutation,
      setMessageInput,
      setReplyTo,
      setTimedMessageDuration,
      setIsSending,
      setActiveChat,
      setDmPreviews,
      messageQueuesRef,
    ]
  );

  return { sendMessage };
}
