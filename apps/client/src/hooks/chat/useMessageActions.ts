import { useCallback, MutableRefObject } from "react";
import { keyService } from "../../core/crypto/KeyService";
import { cryptoService } from "../../core/crypto/crypto";
import type { ActiveChat, DecryptedMessage, Friend, DmPreview, SystemMessageType } from "../../types";
import type { EditMessageRequest } from "../../features/chat/types";
import { getPreviewContent } from "./utils";

interface UseMessageActionsParams {
    activeChat: ActiveChat | null;
    userKeys: {
        kem_secret_key: number[];
        kem_public_key: number[];
        dsa_secret_key: number[];
    } | null;
    userId: string | undefined;
    chatMessages: DecryptedMessage[];
    friendsList: Friend[];
    activeChatRef: MutableRefObject<ActiveChat | null>;
    setChatMessages: React.Dispatch<React.SetStateAction<DecryptedMessage[]>>;
    setDmPreviews: React.Dispatch<React.SetStateAction<DmPreview[]>>;
    deleteMessageMutation: { mutateAsync: (messageId: string) => Promise<void> };
    pinMessageMutation: { mutateAsync: (messageId: string) => Promise<void> };
    unpinMessageMutation: { mutateAsync: (messageId: string) => Promise<void> };
    editMessageMutation: { mutateAsync: (params: { messageId: string; data: EditMessageRequest }) => Promise<void> };
    addReactionMutation: { mutateAsync: (params: { messageId: string; emoji: string }) => Promise<void> };
    removeReactionMutation: { mutateAsync: (params: { messageId: string; emoji: string }) => Promise<void> };
}

export function useMessageActions({
    activeChat,
    userKeys,
    userId,
    chatMessages,
    friendsList,
    activeChatRef,
    setChatMessages,
    setDmPreviews,
    deleteMessageMutation,
    pinMessageMutation,
    unpinMessageMutation,
    editMessageMutation,
    addReactionMutation,
    removeReactionMutation,
}: UseMessageActionsParams) {
    const deleteMessage = useCallback(async (messageId: string) => {
        if (!activeChat) return;
        try {
            await deleteMessageMutation.mutateAsync(messageId);
        } catch (err) {
            console.error("Failed to delete message:", err);
        }
    }, [activeChat, deleteMessageMutation]);

    const pinMessage = useCallback(async (messageId: string) => {
        if (!activeChat) return;
        try {
            await pinMessageMutation.mutateAsync(messageId);
        } catch (err) {
            console.error("Failed to pin message:", err);
        }
    }, [activeChat, pinMessageMutation]);

    const unpinMessage = useCallback(async (messageId: string) => {
        if (!activeChat) return;
        try {
            await unpinMessageMutation.mutateAsync(messageId);
        } catch (err) {
            console.error("Failed to unpin message:", err);
        }
    }, [activeChat, unpinMessageMutation]);

    const editMessage = useCallback(async (messageId: string, newContent: string) => {
        if (!activeChat || !userKeys || !userId) return;

        const message = chatMessages.find((m) => m.id === messageId);
        if (!message || !message.isMine) return;

        try {
            const msgBytes = cryptoService.stringToBytes(newContent);

            let encrypted: number[];
            let messageKeys: Array<{ user_id: string; encrypted_key: number[] }> | undefined;

            if (activeChat.isGroup) {
                encrypted = await cryptoService.encryptWithKey(activeChat.conversationKey, msgBytes);
            } else {
                const messageKey = await cryptoService.generateConversationKey();
                const encryptedBytes = await cryptoService.encryptWithKey(messageKey, msgBytes);
                encrypted = cryptoService.stringToBytes(JSON.stringify({ ciphertext: Array.from(encryptedBytes) }));

                const myEncryptedKey = await cryptoService.encryptForRecipient(userKeys.kem_public_key, messageKey);
                messageKeys = [{ user_id: userId, encrypted_key: myEncryptedKey }];

                let friendPublicKey = friendsList.find(f => f.id === activeChat.visitorId)?.kem_public_key;
                if (!friendPublicKey) {
                    console.error("[Crypto] Friend public key not in friendsList, fetching from server...");
                    try {
                        const bundle = await keyService.getPrekeyBundle(activeChat.visitorId);
                        friendPublicKey = bundle.identity_key;
                    } catch (err) {
                        console.error("[Crypto] Failed to fetch friend's public key:", err);
                    }
                }

                if (friendPublicKey) {
                    const theirEncryptedKey = await cryptoService.encryptForRecipient(friendPublicKey, messageKey);
                    messageKeys.push({ user_id: activeChat.visitorId, encrypted_key: theirEncryptedKey });
                }
            }

            const signature = await cryptoService.dsaSign(userKeys.dsa_secret_key, encrypted);

            const editData: EditMessageRequest = {
                encrypted_content: encrypted,
                signature,
                message_keys: messageKeys,
            };

            await editMessageMutation.mutateAsync({ messageId, data: editData });

            const previewContent = getPreviewContent(newContent);
            setDmPreviews((prev) => {
                const idx = prev.findIndex((p) => p.conversationId === activeChat.conversationId);
                if (idx >= 0) {
                    const mostRecent = chatMessages[chatMessages.length - 1];
                    if (mostRecent && mostRecent.id === messageId) {
                        const updated = [...prev];
                        updated[idx] = {
                            ...updated[idx],
                            lastMessage: previewContent,
                        };
                        return updated;
                    }
                }
                return prev;
            });
        } catch (err: unknown) {
            const error = err as { status?: number; message?: string };
            console.error("Failed to edit message:", error.status, error.message, err);
            throw err;
        }
    }, [activeChat, userKeys, userId, chatMessages, friendsList, editMessageMutation, setDmPreviews]);

    const addReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!userId || !activeChat) return;
        const message = chatMessages.find((m) => m.id === messageId);
        if (!message) return;
        const existingReaction = message.reactions.find((r) => r.userId === userId && r.emoji === emoji);

        try {
            if (existingReaction) {
                await removeReactionMutation.mutateAsync({ messageId, emoji });
            } else {
                await addReactionMutation.mutateAsync({ messageId, emoji });
            }
        } catch (err) {
            console.error("Failed to toggle reaction", err);
        }
    }, [userId, activeChat, chatMessages, addReactionMutation, removeReactionMutation]);

    const addSystemMessage = useCallback((conversationId: string, content: string, systemType: SystemMessageType) => {
        const currentChat = activeChatRef.current;
        if (!currentChat || currentChat.conversationId !== conversationId) return;

        const systemMsg: DecryptedMessage = {
            id: `system-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            senderId: "system",
            senderName: "System",
            content,
            createdAt: new Date().toISOString(),
            isMine: false,
            isSystem: true,
            systemType,
            reactions: [],
        };

        setChatMessages(prev => [...prev, systemMsg]);
    }, [activeChatRef, setChatMessages]);

    return {
        deleteMessage,
        pinMessage,
        unpinMessage,
        editMessage,
        addReaction,
        addSystemMessage,
    };
}
