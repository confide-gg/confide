import { useEffect } from "react";
import { centralWebSocketService } from "../../core/network/CentralWebSocketService";
import { cryptoService } from "../../core/crypto/crypto";
import { keyService } from "../../core/crypto/KeyService";
import { getPrekeySecrets } from "../AuthContext";
import {
  initNotifications,
  playFriendRequestSound,
  NotificationService,
} from "../../utils/notifications";
import { messageService } from "../../features/chat/messages";
import type { DecryptedMessage, ActiveChat, DmPreview } from "../../types/index";
import type { Reaction } from "../../features/chat/types";

interface UseChatWebSocketParams {
  userId: string | undefined;
  userKeys: { kem_secret_key: number[] } | null;
  activeChat: ActiveChat | null;
  friendsLogic: {
    loadFriendRequests: () => Promise<void>;
    onFriendAccepted: (byUserId: string, byUsername: string) => void;
    onFriendRemoved: (byUserId: string) => void;
    setFriendsList: React.Dispatch<React.SetStateAction<any[]>>;
  };
  chatLogic: {
    handleIncomingMessage: (data: any) => void;
    setChatMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
    setActiveChat: React.Dispatch<React.SetStateAction<ActiveChat | null>>;
    setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
    setUnreadCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  };
  loadGroupPreviews: () => void;
  setSuccessMessage: (message: string) => void;
  setTypingUsers: React.Dispatch<React.SetStateAction<Map<string, ReturnType<typeof setTimeout>>>>;
  setIsConnected: React.Dispatch<React.SetStateAction<boolean>>;
  setHasConnectedOnce: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useChatWebSocket({
  userId,
  userKeys,
  activeChat,
  friendsLogic,
  chatLogic,
  loadGroupPreviews,
  setSuccessMessage,
  setTypingUsers,
  setIsConnected,
  setHasConnectedOnce,
}: UseChatWebSocketParams) {
  useEffect(() => {
    const unsubConnect = centralWebSocketService.onConnect(() => {
      setIsConnected(true);
      setHasConnectedOnce(true);
    });
    const unsubDisconnect = centralWebSocketService.onDisconnect(() => setIsConnected(false));

    const initiallyConnected = centralWebSocketService.isConnected();
    setIsConnected(initiallyConnected);
    if (initiallyConnected) {
      setHasConnectedOnce(true);
    }

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, [setIsConnected, setHasConnectedOnce]);

  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        await NotificationService.initialize();
      } catch (error) {
        await initNotifications();
      }
    };

    initializeNotifications();

    const unsubscribe = centralWebSocketService.onMessage((message) => {
      switch (message.type) {
        case "friend_request":
          friendsLogic.loadFriendRequests();
          playFriendRequestSound();
          break;
        case "friend_accepted":
          friendsLogic.onFriendAccepted(message.data.by_user_id, message.data.by_username);
          setSuccessMessage(`Friend request accepted by ${message.data.by_username}`);
          break;
        case "friend_removed":
          friendsLogic.onFriendRemoved(message.data.by_user_id);
          break;
        case "key_update":
          friendsLogic.setFriendsList((prev) =>
            prev.map((f) => {
              if (f.id === message.data.user_id) {
                return { ...f, kem_public_key: message.data.kem_public_key };
              }
              return f;
            })
          );
          break;
        case "new_message":
          if (message.data.conversation_id) {
            chatLogic.handleIncomingMessage({
              ...message.data,
              conversation_id: message.data.conversation_id,
            });
          }
          break;
        case "message_deleted":
          if (activeChat && activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages((prev) =>
              prev.filter((m) => m.id !== message.data.message_id)
            );
          }
          break;
        case "message_edited":
          if (
            activeChat &&
            activeChat.conversationId === message.data.conversation_id &&
            userKeys
          ) {
            (async () => {
              try {
                const msgData = message.data;
                const msgJson = cryptoService.bytesToString(msgData.encrypted_content);
                const parsedMsg = JSON.parse(msgJson);

                const keyResponse = await messageService.getMessageKey(
                  msgData.conversation_id,
                  msgData.message_id
                );

                let content: string;

                if (parsedMsg.chain_id !== undefined && parsedMsg.iteration !== undefined) {
                  if (keyResponse.encrypted_key) {
                    const senderKeyState = await cryptoService.decryptFromSender(
                      userKeys.kem_secret_key,
                      keyResponse.encrypted_key
                    );
                    const contentBytes = await cryptoService.decryptGroupMessage(
                      senderKeyState,
                      parsedMsg.chain_id,
                      parsedMsg.iteration,
                      parsedMsg.ciphertext
                    );
                    content = cryptoService.bytesToString(contentBytes);
                  } else {
                    throw new Error("No key for group message");
                  }
                } else {
                  if (keyResponse.encrypted_key) {
                    const messageKey = await cryptoService.decryptFromSender(
                      userKeys.kem_secret_key,
                      keyResponse.encrypted_key
                    );
                    const contentBytes = await cryptoService.decryptWithKey(
                      messageKey,
                      parsedMsg.ciphertext
                    );
                    content = cryptoService.bytesToString(contentBytes);
                  } else {
                    throw new Error("No key for DM message");
                  }
                }

                chatLogic.setChatMessages((prev) =>
                  prev.map((m) =>
                    m.id === msgData.message_id ? { ...m, content, editedAt: msgData.edited_at } : m
                  )
                );
              } catch (err) {
                console.error("Failed to decrypt edited message:", err);
              }
            })();
          }
          break;
        case "message_pinned":
          if (activeChat && activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages((prev) =>
              prev.map((m) =>
                m.id === message.data.message_id ? { ...m, pinnedAt: message.data.pinned_at } : m
              )
            );
          }
          break;
        case "message_unpinned":
          if (activeChat && activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages((prev) =>
              prev.map((m: DecryptedMessage) =>
                m.id === message.data.message_id ? { ...m, pinnedAt: null } : m
              )
            );
          }
          break;
        case "reaction_added":
          if (activeChat && activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages((prev) =>
              prev.map((m: DecryptedMessage) => {
                if (m.id !== message.data.message_id) return m;
                if (
                  m.reactions.some(
                    (r: Reaction) =>
                      r.userId === message.data.user_id && r.emoji === message.data.emoji
                  )
                )
                  return m;
                return {
                  ...m,
                  reactions: [
                    ...m.reactions,
                    {
                      id: message.data.id,
                      userId: message.data.user_id,
                      messageId: message.data.message_id,
                      emoji: message.data.emoji,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                };
              })
            );
          }
          break;
        case "reaction_removed":
          if (activeChat && activeChat.conversationId === message.data.conversation_id) {
            chatLogic.setChatMessages((prev) =>
              prev.map((m: DecryptedMessage) => {
                if (m.id !== message.data.message_id) return m;
                return {
                  ...m,
                  reactions: m.reactions.filter(
                    (r) => !(r.userId === message.data.user_id && r.emoji === message.data.emoji)
                  ),
                };
              })
            );
          }
          break;
        case "typing":
          {
            const { user_id, is_typing, conversation_id } = message.data;
            if (
              activeChat &&
              activeChat.conversationId === conversation_id &&
              user_id !== userId &&
              user_id
            ) {
              if (is_typing) {
                setTypingUsers((prev) => {
                  const next = new Map(prev);
                  if (next.has(user_id)) clearTimeout(next.get(user_id)!);
                  const timeout = setTimeout(() => {
                    setTypingUsers((p) => {
                      const n = new Map(p);
                      n.delete(user_id);
                      return n;
                    });
                  }, 3000);
                  next.set(user_id, timeout);
                  return next;
                });
              } else {
                setTypingUsers((prev) => {
                  const next = new Map(prev);
                  if (next.has(user_id)) clearTimeout(next.get(user_id)!);
                  next.delete(user_id);
                  return next;
                });
              }
            }
          }
          break;
        case "key_exchange":
          {
            const { from_user_id, conversation_id, key_bundle } = message.data;
            if (activeChat && activeChat.conversationId === conversation_id && userKeys) {
              (async () => {
                try {
                  const prekeySecrets = await getPrekeySecrets();
                  if (!prekeySecrets) return;

                  const ratchetState = await cryptoService.acceptRatchetSession(
                    userKeys.kem_secret_key,
                    prekeySecrets.signedPrekey.secret_key,
                    null,
                    key_bundle
                  );

                  chatLogic.setActiveChat((prev: ActiveChat | null) =>
                    prev ? { ...prev, ratchetState } : null
                  );

                  const encryptedState = await cryptoService.encryptData(
                    userKeys.kem_secret_key,
                    ratchetState
                  );
                  await keyService.saveSession(conversation_id, from_user_id, {
                    encrypted_state: encryptedState,
                  });
                } catch (err) {
                  console.error("Failed to accept key exchange:", err);
                }
              })();
            }
          }
          break;
        case "group_created":
        case "group_member_added":
        case "group_metadata_updated":
          loadGroupPreviews();
          break;
        case "group_owner_changed":
          {
            const { conversation_id, new_owner_id } = message.data;
            chatLogic.setDmPreviews((prev) =>
              prev.map((p) =>
                p.conversationId === conversation_id ? { ...p, groupOwnerId: new_owner_id } : p
              )
            );
            chatLogic.setActiveChat((prev) =>
              prev && prev.isGroup && prev.conversationId === conversation_id
                ? { ...prev, groupOwnerId: new_owner_id }
                : prev
            );
            loadGroupPreviews();
          }
          break;
        case "group_member_removed":
          {
            const { conversation_id, user_id: removedUserId } = message.data;
            if (userId && removedUserId === userId) {
              chatLogic.setDmPreviews((prev) =>
                prev.filter((p) => p.conversationId !== conversation_id)
              );
              chatLogic.setUnreadCounts((prev) => {
                const next = new Map(prev);
                next.delete(conversation_id);
                return next;
              });
              chatLogic.setActiveChat((prev) =>
                prev && prev.isGroup && prev.conversationId === conversation_id ? null : prev
              );
            } else {
              loadGroupPreviews();
            }
          }
          break;
        case "group_member_left":
          {
            const { conversation_id, user_id: leftUserId } = message.data;
            if (userId && leftUserId === userId) {
              chatLogic.setDmPreviews((prev) =>
                prev.filter((p) => p.conversationId !== conversation_id)
              );
              chatLogic.setUnreadCounts((prev) => {
                const next = new Map(prev);
                next.delete(conversation_id);
                return next;
              });
              chatLogic.setActiveChat((prev) =>
                prev && prev.isGroup && prev.conversationId === conversation_id ? null : prev
              );
            } else {
              loadGroupPreviews();
            }
          }
          break;
        case "group_deleted":
          {
            const { conversation_id } = message.data;
            chatLogic.setDmPreviews((prev) =>
              prev.filter((p) => p.conversationId !== conversation_id)
            );
            chatLogic.setUnreadCounts((prev) => {
              const next = new Map(prev);
              next.delete(conversation_id);
              return next;
            });
            chatLogic.setActiveChat((prev) =>
              prev && prev.isGroup && prev.conversationId === conversation_id ? null : prev
            );
          }
          break;
      }
    });
    return () => unsubscribe();
  }, [
    userId,
    userKeys,
    activeChat,
    friendsLogic,
    chatLogic,
    loadGroupPreviews,
    setSuccessMessage,
    setTypingUsers,
  ]);
}
