import { useCallback } from "react";
import { conversationService } from "../../features/chat/conversations";
import { keyService } from "../../core/crypto/KeyService";
import { cryptoService } from "../../core/crypto/crypto";
import { centralWebSocketService } from "../../core/network/CentralWebSocketService";
import { getPrekeySecrets } from "../../context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../queries";
import type { ActiveChat, DecryptedMessage, Friend, DmPreview } from "../../types";

interface UseOpenChatParams {
  userKeys: {
    kem_secret_key: number[];
    kem_public_key: number[];
    dsa_secret_key: number[];
  } | null;
  userId: string | undefined;
  friendsList: Friend[];
  setIsLoadingChat: React.Dispatch<React.SetStateAction<boolean>>;
  setChatMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
  setActiveChat: React.Dispatch<React.SetStateAction<ActiveChat | null>>;
  setUnreadCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>;
  setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
}

export function useOpenChat({
  userKeys,
  userId,
  friendsList,
  setIsLoadingChat,
  setChatMessages,
  setActiveChat,
  setUnreadCounts,
  setDmPreviews,
}: UseOpenChatParams) {
  const queryClient = useQueryClient();

  const openChat = useCallback(
    async (friend: Friend | { id: string; username: string; kem_public_key: number[] }) => {
      if (!userKeys || !userId) {
        return;
      }

      setIsLoadingChat(true);

      try {
        const allConvs = await conversationService.getConversations();
        let existingConv = null;

        for (const conv of allConvs) {
          if (conv.conversation_type === "dm") {
            try {
              const members = await conversationService.getMembers(conv.id);
              const isFriendInConv = members.some((m) => m.user.id === friend.id);
              if (isFriendInConv) {
                existingConv = conv;
                break;
              }
            } catch {
              continue;
            }
          }
        }

        let conversationId: string;
        let friendPublicKey = (friend as Friend).kem_public_key;
        let friendDsaKey = (friend as Friend).dsa_public_key;

        if (!friendPublicKey || friendPublicKey.length === 0) {
          const found = friendsList.find((f) => f.id === friend.id);
          if (found) {
            friendPublicKey = found.kem_public_key;
            friendDsaKey = found.dsa_public_key;
          }
        }

        if (!friendPublicKey) throw new Error("Could not find friend's public key");

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const conversationKey = await cryptoService.generateConversationKey();

          const myEncryptedKey = await cryptoService.encryptForRecipient(
            userKeys.kem_public_key,
            conversationKey
          );
          const theirEncryptedKey = await cryptoService.encryptForRecipient(
            friendPublicKey,
            conversationKey
          );

          const roleData = cryptoService.stringToBytes(JSON.stringify({ role: "member" }));
          const myEncryptedRole = await cryptoService.encryptForRecipient(
            userKeys.kem_public_key,
            roleData
          );
          const theirEncryptedRole = await cryptoService.encryptForRecipient(
            friendPublicKey,
            roleData
          );

          const conv = await conversationService.getOrCreateDm(friend.id, {
            my_encrypted_sender_key: myEncryptedKey,
            my_encrypted_role: myEncryptedRole,
            their_encrypted_sender_key: theirEncryptedKey,
            their_encrypted_role: theirEncryptedRole,
            encrypted_metadata: null,
          });
          conversationId = conv.id;

          if (conv.encrypted_sender_key) {
            existingConv = {
              id: conv.id,
              conversation_type: conv.conversation_type,
              encrypted_metadata: null,
              owner_id: null,
              created_at: new Date().toISOString(),
              encrypted_sender_key: conv.encrypted_sender_key,
              encrypted_role: conv.encrypted_role || [],
            };
          } else {
            const updatedConvs = await conversationService.getConversations();
            existingConv = updatedConvs.find((c) => c.id === conversationId) || null;
          }
        }

        if (!existingConv) throw new Error("Conversation not found");

        const conversationKeyBytes = await cryptoService.decryptFromSender(
          userKeys.kem_secret_key,
          existingConv.encrypted_sender_key
        );

        let ratchetState: number[] | undefined;
        let theirIdentityKey: number[] | undefined;

        try {
          const existingSession = await keyService.getSession(conversationId, friend.id);

          if (existingSession?.encrypted_state) {
            ratchetState = await cryptoService.decryptData(
              userKeys.kem_secret_key,
              existingSession.encrypted_state
            );
          } else {
            const pendingExchanges = await keyService.getPendingExchanges();
            const relevantExchange = pendingExchanges.find(
              (e) => e.from_user_id === friend.id && e.conversation_id === conversationId
            );

            if (relevantExchange) {
              const prekeySecrets = await getPrekeySecrets();
              if (prekeySecrets) {
                ratchetState = await cryptoService.acceptRatchetSession(
                  userKeys.kem_secret_key,
                  prekeySecrets.signedPrekey.secret_key,
                  null,
                  relevantExchange.key_bundle
                );

                const encryptedState = await cryptoService.encryptData(
                  userKeys.kem_secret_key,
                  ratchetState
                );
                await keyService.acceptKeyExchange(relevantExchange.id, {
                  encrypted_session_state: encryptedState,
                });
                await keyService.saveSession(conversationId, friend.id, {
                  encrypted_state: encryptedState,
                });
              }
            } else {
              const bundle = await keyService.getPrekeyBundle(friend.id);
              theirIdentityKey = bundle.identity_key;

              const result = await cryptoService.createInitialRatchetSession(
                userKeys.kem_secret_key,
                bundle.identity_key,
                bundle.signed_prekey_public,
                null
              );

              ratchetState = result.state;

              const encryptedState = await cryptoService.encryptData(
                userKeys.kem_secret_key,
                ratchetState
              );
              await keyService.initiateKeyExchange({
                to_user_id: friend.id,
                conversation_id: conversationId,
                key_bundle: result.key_bundle,
                encrypted_session_state: encryptedState,
              });
              await keyService.saveSession(conversationId, friend.id, {
                encrypted_state: encryptedState,
              });
            }
          }
        } catch (ratchetErr) {
          console.warn(
            "Failed to initialize ratchet session, falling back to conversation key:",
            ratchetErr
          );
        }

        const newActiveChat = {
          visitorId: friend.id,
          visitorUsername: friend.username,
          conversationId,
          conversationKey: conversationKeyBytes,
          ratchetState,
          theirIdentityKey: theirIdentityKey || friendPublicKey,
          theirDsaKey: friendDsaKey,
        };

        const cacheKey = [...queryKeys.messages.list(conversationId), "decrypted", userId];
        const cachedMessages = queryClient.getQueryData<DecryptedMessage[]>(cacheKey);

        if (cachedMessages && cachedMessages.length > 0) {
          setChatMessages(cachedMessages);
          setIsLoadingChat(false);
        } else {
          setChatMessages([]);
        }

        setActiveChat(newActiveChat);

        setUnreadCounts((prev) => {
          const next = new Map(prev);
          next.delete(conversationId);
          return next;
        });

        setDmPreviews((prev) => {
          const exists = prev.some((p) => p.conversationId === conversationId);
          if (exists) return prev;
          return [
            ...prev,
            {
              conversationId,
              visitorId: friend.id,
              visitorUsername: friend.username,
              lastMessage: "",
              lastMessageTime: new Date().toISOString(),
              isLastMessageMine: false,
            },
          ];
        });

        centralWebSocketService.subscribeConversation(conversationId);
      } catch (err) {
        console.error("Failed to open chat:", err);
        const message = err instanceof Error ? err.message : String(err);
        alert(`Failed to open chat: ${message}`);
      } finally {
        setIsLoadingChat(false);
      }
    },
    [
      userKeys,
      userId,
      friendsList,
      queryClient,
      setIsLoadingChat,
      setChatMessages,
      setActiveChat,
      setUnreadCounts,
      setDmPreviews,
    ]
  );

  return { openChat };
}
