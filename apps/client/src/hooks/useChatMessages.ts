import { useState, useCallback, useRef, useEffect } from "react";
import { type ActiveChat, type DecryptedMessage, type Friend, type DmPreview, type ReplyTo, type TimedMessageDuration, type FavoriteGif, type SystemMessageType } from "../types";
import { conversations, messages, crypto, keys as keysApi, get, post, del, wsService } from "../api";
import { useAuth, getPrekeySecrets } from "../context/AuthContext";
import { showMessageNotification } from "../utils/notifications";

export function useChatMessages(friendsList: Friend[]) {
    const { user, keys: userKeys, profile } = useAuth();

    const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
    const [chatMessages, setChatMessages] = useState<DecryptedMessage[]>([]);
    const [isLoadingChat, setIsLoadingChat] = useState(false);
    const [messageInput, setMessageInput] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
    const [timedMessageDuration, setTimedMessageDuration] = useState<TimedMessageDuration>(null);
    const [dmPreviews, setDmPreviews] = useState<DmPreview[]>([]);
    const [favoriteGifUrls, setFavoriteGifUrls] = useState<Set<string>>(new Set());
    const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

    const activeChatRef = useRef<ActiveChat | null>(null);
    const processedMessageIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    const loadFavoriteGifs = useCallback(async () => {
        try {
            const favs = await get<FavoriteGif[]>("/gifs/favorites");
            setFavoriteGifUrls(new Set(favs.map(f => f.gif_url)));
        } catch (err) {
            console.error("Failed to load favorite GIFs:", err);
        }
    }, []);

    const toggleFavoriteGif = useCallback(async (gifUrl: string, previewUrl?: string) => {
        try {
            if (favoriteGifUrls.has(gifUrl)) {
                await del("/gifs/favorites", { gif_url: gifUrl });
                setFavoriteGifUrls(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(gifUrl);
                    return newSet;
                });
            } else {
                await post<FavoriteGif>("/gifs/favorites", {
                    gif_url: gifUrl,
                    gif_preview_url: previewUrl || gifUrl,
                });
                setFavoriteGifUrls(prev => new Set([...prev, gifUrl]));
            }
        } catch (err) {
            console.error("Failed to toggle favorite:", err);
        }
    }, [favoriteGifUrls]);

    const loadDmPreviews = useCallback(async () => {
        if (!userKeys || !user) return;

        try {
            const allConvs = await conversations.getConversations();
            const previews: DmPreview[] = [];

            for (const conv of allConvs) {
                if (conv.conversation_type !== "dm") continue;

                let visitorId = "";
                let visitorUsername = "";

                try {
                    const members = await conversations.getMembers(conv.id);
                    const otherMember = members.find((m) => m.user.id !== user.id);
                    if (!otherMember) continue;
                    visitorId = otherMember.user.id;
                    visitorUsername = otherMember.user.username;
                } catch {
                    continue;
                }

                try {
                    const recentMsgs = await messages.getMessages(conv.id, { limit: 1 });
                    let lastMessage = "";
                    let lastMessageTime = conv.created_at;
                    let isLastMessageMine = false;

                    if (recentMsgs.length > 0) {
                        const msg = recentMsgs[0];
                        lastMessage = "New message";
                        lastMessageTime = msg.created_at;
                        isLastMessageMine = msg.sender_id === user.id;
                    } else {
                        lastMessage = "Started a chat";
                    }

                    previews.push({
                        conversationId: conv.id,
                        visitorId,
                        visitorUsername,
                        lastMessage,
                        lastMessageTime,
                        isLastMessageMine,
                    });
                } catch {
                    continue;
                }
            }

            previews.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
            setDmPreviews(previews);
        } catch (err) {
            console.error("Failed to load DM previews:", err);
        }
    }, [userKeys, user]);

    const handleIncomingMessage = useCallback(async (msgData: {
        id: string;
        conversation_id: string;
        sender_id: string;
        encrypted_content: number[];
        signature: number[];
        reply_to_id: string | null;
        expires_at: string | null;
        created_at: string;
        message_type?: string;
        call_duration_seconds?: number | null;
    }) => {
        const currentChat = activeChatRef.current;

        const isSystemMessage = msgData.message_type && msgData.message_type !== "text";

        if (!isSystemMessage && msgData.sender_id === user?.id) return;

        if (processedMessageIds.current.has(msgData.id)) return;
        processedMessageIds.current.add(msgData.id);

        wsService.subscribeConversation(msgData.conversation_id);

        if (!currentChat || currentChat.conversationId !== msgData.conversation_id) {
            if (!isSystemMessage) {
                setUnreadCounts((prev) => {
                    const next = new Map(prev);
                    const current = next.get(msgData.sender_id) || 0;
                    next.set(msgData.sender_id, current + 1);
                    return next;
                });

                const senderFriend = friendsList.find((f) => f.id === msgData.sender_id);
                if (senderFriend) {
                    showMessageNotification(senderFriend.username, "sent you a message", profile?.status);
                } else {
                    showMessageNotification("Someone", "sent you a message", profile?.status);
                }
            }
            loadDmPreviews();
            return;
        }

        if (isSystemMessage) {
            const systemType = msgData.message_type as SystemMessageType;
            const systemMsg: DecryptedMessage = {
                id: msgData.id,
                senderId: msgData.sender_id,
                senderName: "System",
                content: "",
                createdAt: msgData.created_at,
                isMine: false,
                isSystem: true,
                systemType,
                callDurationSeconds: msgData.call_duration_seconds,
                reactions: [],
            };

            setChatMessages((prev) => {
                if (prev.some((m) => m.id === msgData.id)) return prev;
                return [...prev, systemMsg];
            });
            return;
        }

        const senderFriend = friendsList.find((f) => f.id === msgData.sender_id);
        const senderName = senderFriend?.username || "Unknown";

        try {
            const keyResponse = await messages.getMessageKey(msgData.conversation_id, msgData.id);
            if (!keyResponse.encrypted_key || !userKeys) {
                throw new Error("No message key available");
            }

            const messageKey = await crypto.decryptFromSender(userKeys.kem_secret_key, keyResponse.encrypted_key);

            if (!messageKey || messageKey.length !== 32) {
                throw new Error(`Invalid message key length: ${messageKey?.length || 0} bytes (expected 32)`);
            }

            const ratchetMsgJson = crypto.bytesToString(msgData.encrypted_content);
            const ratchetMsg = JSON.parse(ratchetMsgJson);
            const contentBytes = await crypto.decryptWithMessageKey(messageKey, ratchetMsg.ciphertext);
            const content = crypto.bytesToString(contentBytes);

            let replyToMsg: DecryptedMessage["replyTo"];
            if (msgData.reply_to_id) {
                setChatMessages((prev) => {
                    const r = prev.find(m => m.id === msgData.reply_to_id);
                    if (r) replyToMsg = { id: r.id, content: r.content, senderName: r.senderName || "Unknown" };
                    return prev;
                });
            }

            const newMsg: DecryptedMessage = {
                id: msgData.id,
                senderId: msgData.sender_id,
                senderName,
                content,
                createdAt: msgData.created_at,
                isMine: false,
                isGif: content.startsWith("https://") && content.includes("tenor"),
                expiresAt: msgData.expires_at,
                replyToId: msgData.reply_to_id,
                replyTo: replyToMsg,
                reactions: [],
            };

            setChatMessages((prev) => {
                if (prev.some((m) => m.id === msgData.id)) return prev;
                if (msgData.reply_to_id && !newMsg.replyTo) {
                    const r = prev.find(m => m.id === msgData.reply_to_id);
                    if (r) newMsg.replyTo = { id: r.id, content: r.content, senderName: r.senderName || "Unknown" };
                }
                return [...prev, newMsg];
            });

            const previewContent = content.startsWith("https://") && content.includes("tenor") ? "GIF" : content;
            setDmPreviews((prev) => {
                const idx = prev.findIndex((p) => p.conversationId === msgData.conversation_id);
                if (idx >= 0) {
                    const updated = [...prev];
                    updated[idx] = {
                        ...updated[idx],
                        lastMessage: previewContent,
                        lastMessageTime: msgData.created_at,
                        isLastMessageMine: false,
                    };
                    updated.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
                    return updated;
                }
                return prev;
            });
        } catch (err) {
            console.error("Failed to decrypt incoming message:", err);
        }
    }, [user?.id, userKeys, friendsList, loadDmPreviews, profile?.status]);

    const openChat = useCallback(async (friend: Friend | { id: string; username: string; kem_public_key: number[] }) => {
        if (!userKeys || !user) {
            return;
        }

        setIsLoadingChat(true);
        setChatMessages([]);
        setActiveChat(null);
        setUnreadCounts(prev => {
            const next = new Map(prev);
            next.delete(friend.id);
            return next;
        });

        try {
            const allConvs = await conversations.getConversations();
            let existingConv = null;

            for (const conv of allConvs) {
                if (conv.conversation_type === "dm") {
                    try {
                        const members = await conversations.getMembers(conv.id);
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
                const found = friendsList.find(f => f.id === friend.id);
                if (found) {
                    friendPublicKey = found.kem_public_key;
                    friendDsaKey = found.dsa_public_key;
                }
            }

            if (!friendPublicKey) throw new Error("Could not find friend's public key");

            if (existingConv) {
                conversationId = existingConv.id;
            } else {
                const conversationKey = await crypto.generateConversationKey();

                const myEncryptedKey = await crypto.encryptForRecipient(
                    userKeys.kem_public_key,
                    conversationKey
                );
                const theirEncryptedKey = await crypto.encryptForRecipient(
                    friendPublicKey,
                    conversationKey
                );

                const roleData = crypto.stringToBytes(JSON.stringify({ role: "member" }));
                const myEncryptedRole = await crypto.encryptForRecipient(
                    userKeys.kem_public_key,
                    roleData
                );
                const theirEncryptedRole = await crypto.encryptForRecipient(
                    friendPublicKey,
                    roleData
                );

                const conv = await conversations.getOrCreateDm(friend.id, {
                    my_encrypted_sender_key: myEncryptedKey,
                    my_encrypted_role: myEncryptedRole,
                    their_encrypted_sender_key: theirEncryptedKey,
                    their_encrypted_role: theirEncryptedRole,
                    encrypted_metadata: null,
                });
                conversationId = conv.id;

                const updatedConvs = await conversations.getConversations();
                existingConv = updatedConvs.find(c => c.id === conversationId) || null;
            }

            if (!existingConv) throw new Error("Conversation not found");

            const conversationKeyBytes = await crypto.decryptFromSender(userKeys.kem_secret_key, existingConv.encrypted_sender_key);

            let ratchetState: number[] | undefined;
            let theirIdentityKey: number[] | undefined;

            try {
                const existingSession = await keysApi.getSession(conversationId, friend.id);

                if (existingSession?.encrypted_state) {
                    ratchetState = await crypto.decryptData(userKeys.kem_secret_key, existingSession.encrypted_state);
                } else {
                    const pendingExchanges = await keysApi.getPendingExchanges();
                    const relevantExchange = pendingExchanges.find(
                        (e) => e.from_user_id === friend.id && e.conversation_id === conversationId
                    );

                    if (relevantExchange) {
                        const prekeySecrets = await getPrekeySecrets();
                        if (prekeySecrets) {
                            ratchetState = await crypto.acceptRatchetSession(
                                userKeys.kem_secret_key,
                                prekeySecrets.signedPrekey.secret_key,
                                null,
                                relevantExchange.key_bundle
                            );

                            const encryptedState = await crypto.encryptData(userKeys.kem_secret_key, ratchetState);
                            await keysApi.acceptKeyExchange(relevantExchange.id, {
                                encrypted_session_state: encryptedState,
                            });
                            await keysApi.saveSession(conversationId, friend.id, {
                                encrypted_state: encryptedState,
                            });
                        }
                    } else {
                        const bundle = await keysApi.getPrekeyBundle(friend.id);
                        theirIdentityKey = bundle.identity_key;

                        const result = await crypto.createInitialRatchetSession(
                            userKeys.kem_secret_key,
                            bundle.identity_key,
                            bundle.signed_prekey_public,
                            null
                        );

                        ratchetState = result.state;

                        const encryptedState = await crypto.encryptData(userKeys.kem_secret_key, ratchetState);
                        await keysApi.initiateKeyExchange({
                            to_user_id: friend.id,
                            conversation_id: conversationId,
                            key_bundle: result.key_bundle,
                            encrypted_session_state: encryptedState,
                        });
                        await keysApi.saveSession(conversationId, friend.id, {
                            encrypted_state: encryptedState,
                        });
                    }
                }
            } catch (ratchetErr) {
                console.warn("Failed to initialize ratchet session, falling back to conversation key:", ratchetErr);
            }

            setActiveChat({
                visitorId: friend.id,
                visitorUsername: friend.username,
                conversationId,
                conversationKey: conversationKeyBytes,
                ratchetState,
                theirIdentityKey: theirIdentityKey || friendPublicKey,
                theirDsaKey: friendDsaKey,
            });

            setDmPreviews((prev) => {
                const exists = prev.some((p) => p.conversationId === conversationId);
                if (exists) return prev;
                return [{
                    conversationId,
                    visitorId: friend.id,
                    visitorUsername: friend.username,
                    lastMessage: "",
                    lastMessageTime: new Date().toISOString(),
                    isLastMessageMine: false,
                }, ...prev];
            });

            wsService.subscribeConversation(conversationId);

            const msgs = await messages.getMessages(conversationId, { limit: 50 });
            const decryptedMsgs: DecryptedMessage[] = [];
            const msgMap = new Map<string, { content: string; senderName: string; isSystem?: boolean; messageType?: string }>();

            for (const msg of msgs) {
                const isSystemMessage = msg.message_type && msg.message_type !== "text";

                if (isSystemMessage) {
                    msgMap.set(msg.id, { content: "", senderName: "System", isSystem: true, messageType: msg.message_type });
                    continue;
                }

                try {
                    const senderName = msg.sender_id === user.id ? user.username : friend.username;

                    if (!msg.encrypted_key || msg.encrypted_key.length === 0) {
                        console.error(`[Crypto] Message ${msg.id}: No encrypted_key in database`);
                        throw new Error("No message key available");
                    }

                    const messageKey = await crypto.decryptFromSender(userKeys.kem_secret_key, msg.encrypted_key);

                    if (!messageKey || messageKey.length !== 32) {
                        throw new Error(`Invalid message key length: ${messageKey?.length || 0} bytes (expected 32)`);
                    }

                    const ratchetMsgJson = crypto.bytesToString(msg.encrypted_content);
                    const ratchetMsg = JSON.parse(ratchetMsgJson);
                    const contentBytes = await crypto.decryptWithMessageKey(messageKey, ratchetMsg.ciphertext);
                    const content = crypto.bytesToString(contentBytes);

                    msgMap.set(msg.id, { content, senderName, isSystem: false });
                } catch (err) {
                    console.error(`Failed to decrypt message ${msg.id}:`, err);
                    msgMap.set(msg.id, { content: "[Unable to decrypt]", senderName: "Unknown", isSystem: false });
                }
            }

            for (const msg of msgs) {
                const decrypted = msgMap.get(msg.id)!;

                if (decrypted.isSystem) {
                    decryptedMsgs.push({
                        id: msg.id,
                        senderId: msg.sender_id,
                        senderName: "System",
                        content: "",
                        createdAt: msg.created_at,
                        isMine: false,
                        isSystem: true,
                        systemType: msg.message_type as SystemMessageType,
                        callDurationSeconds: msg.call_duration_seconds,
                        reactions: [],
                    });
                    continue;
                }

                let replyToMsg: DecryptedMessage["replyTo"];

                if (msg.reply_to_id) {
                    const replyData = msgMap.get(msg.reply_to_id);
                    if (replyData && !replyData.isSystem) {
                        replyToMsg = {
                            id: msg.reply_to_id,
                            content: replyData.content,
                            senderName: replyData.senderName,
                        };
                    }
                }

                decryptedMsgs.push({
                    id: msg.id,
                    senderId: msg.sender_id,
                    senderName: decrypted.senderName,
                    content: decrypted.content,
                    createdAt: msg.created_at,
                    isMine: msg.sender_id === user.id,
                    isGif: decrypted.content.startsWith("https://") && decrypted.content.includes("tenor"),
                    expiresAt: msg.expires_at,
                    replyToId: msg.reply_to_id,
                    replyTo: replyToMsg,
                    reactions: msg.reactions.map((r) => ({
                        id: r.id,
                        userId: r.user_id,
                        emoji: r.emoji,
                    })),
                    editedAt: msg.edited_at,
                });
            }
            setChatMessages(decryptedMsgs.reverse());

        } catch (err) {
            console.error("Failed to open chat:", err);
            const message = err instanceof Error ? err.message : String(err);
            alert(`Failed to open chat: ${message}`);
        } finally {
            setIsLoadingChat(false);
        }
    }, [userKeys, user, friendsList]);

    const sendMessage = useCallback(async (content?: string) => {
        const msgContent = content || messageInput.trim();
        if (!activeChat || !msgContent || !userKeys || !user) return;

        if (!activeChat.ratchetState) {
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
            const msgBytes = crypto.stringToBytes(msgContent);
            const expiresAt = currentDuration ? new Date(Date.now() + currentDuration * 1000).toISOString() : null;

            let encrypted: number[];
            let messageKeys: Array<{ user_id: string; encrypted_key: number[] }>;
            let newState: number[];

            if (activeChat.isGroup) {
                const currentState = activeChat.ratchetState;
                if (!currentState) {
                    throw new Error("Group chat missing ratchet state");
                }
                const groupResult = await crypto.encryptGroupMessage(currentState, msgBytes);
                const groupMessage = {
                    ciphertext: groupResult.ciphertext,
                    chain_id: groupResult.chain_id,
                    iteration: groupResult.iteration,
                };
                encrypted = crypto.stringToBytes(JSON.stringify(groupMessage));
                newState = groupResult.new_state;

                const myEncryptedKey = await crypto.encryptForRecipient(userKeys.kem_public_key, currentState);
                messageKeys = [{ user_id: user.id, encrypted_key: myEncryptedKey }];

                const members = await conversations.getMembers(activeChat.conversationId);
                for (const member of members) {
                    if (member.user.id !== user.id) {
                        try {
                            const memberEncryptedKey = await crypto.encryptForRecipient(member.user.kem_public_key, currentState);
                            messageKeys.push({
                                user_id: member.user.id,
                                encrypted_key: memberEncryptedKey,
                            });
                        } catch (err) {
                            console.warn(`Failed to encrypt for member ${member.user.id}:`, err);
                        }
                    }
                }
            } else {
                const currentState = activeChat.ratchetState;
                if (!currentState) {
                    throw new Error("Chat missing ratchet state");
                }
                const result = await crypto.ratchetEncrypt(currentState, msgBytes);
                encrypted = crypto.stringToBytes(JSON.stringify(result.message));
                newState = result.new_state;

                const myEncryptedKey = await crypto.encryptForRecipient(userKeys.kem_public_key, result.message_key);
                messageKeys = [{ user_id: user.id, encrypted_key: myEncryptedKey }];

                let friendPublicKey = friendsList.find(f => f.id === activeChat.visitorId)?.kem_public_key;
                if (!friendPublicKey) {
                    console.error("[Crypto] Friend public key not in friendsList, fetching from server...");
                    try {
                        const bundle = await keysApi.getPrekeyBundle(activeChat.visitorId);
                        friendPublicKey = bundle.identity_key;
                    } catch (err) {
                        console.error("[Crypto] Failed to fetch friend's public key:", err);
                        throw new Error("Friend's public key not found");
                    }
                }

                const theirEncryptedKey = await crypto.encryptForRecipient(friendPublicKey, result.message_key);
                messageKeys.push({ user_id: activeChat.visitorId, encrypted_key: theirEncryptedKey });

                const encryptedState = await crypto.encryptData(userKeys.kem_secret_key, newState);
                keysApi.saveSession(activeChat.conversationId, activeChat.visitorId, {
                    encrypted_state: encryptedState,
                }).catch(err => console.warn("Failed to save session state:", err));
            }

            setActiveChat(prev => prev ? { ...prev, ratchetState: newState } : null);

            const signature = await crypto.dsaSign(userKeys.dsa_secret_key, encrypted);

            const response = await messages.sendMessage(activeChat.conversationId, {
                encrypted_content: encrypted,
                signature,
                reply_to_id: currentReplyTo?.id || null,
                expires_at: expiresAt,
                message_keys: messageKeys,
            });

            const newMsg: DecryptedMessage = {
                id: response.id,
                senderId: user.id,
                senderName: user.username,
                content: msgContent,
                createdAt: response.created_at,
                isMine: true,
                isGif: msgContent.startsWith("https://") && msgContent.includes("tenor"),
                expiresAt,
                replyToId: currentReplyTo?.id || null,
                replyTo: currentReplyTo || undefined,
                reactions: []
            };

            setChatMessages(prev => [...prev, newMsg]);

            const previewContent = msgContent.startsWith("https://") && msgContent.includes("tenor") ? "GIF" : msgContent;
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
                    updated.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());
                    return updated;
                }
                return [{
                    conversationId: activeChat.conversationId,
                    visitorId: activeChat.visitorId,
                    visitorUsername: activeChat.visitorUsername,
                    lastMessage: previewContent,
                    lastMessageTime: response.created_at,
                    isLastMessageMine: true
                }, ...prev];
            });

        } catch (err) {
            console.error("Failed to send message", err);
            if (!content) setMessageInput(msgContent);
        } finally {
            setIsSending(false);
        }
    }, [activeChat, messageInput, userKeys, user, replyTo, timedMessageDuration, friendsList]);

    const deleteMessage = useCallback(async (messageId: string) => {
        if (!activeChat) return;
        try {
            await messages.deleteMessage(activeChat.conversationId, messageId);
            setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
        } catch (err) {
            console.error("Failed to delete message:", err);
        }
    }, [activeChat]);

    const editMessage = useCallback(async (messageId: string, newContent: string) => {
        if (!activeChat || !userKeys || !user) return;

        const message = chatMessages.find((m) => m.id === messageId);
        if (!message || !message.isMine) return;

        try {
            const msgBytes = crypto.stringToBytes(newContent);

            let encrypted: number[];
            let messageKeys: Array<{ user_id: string; encrypted_key: number[] }> = [];

            if (activeChat.isGroup) {
                const currentState = activeChat.ratchetState;
                if (!currentState) {
                    throw new Error("Group chat missing ratchet state");
                }
                const groupResult = await crypto.encryptGroupMessage(currentState, msgBytes);
                const groupMessage = {
                    ciphertext: groupResult.ciphertext,
                    chain_id: groupResult.chain_id,
                    iteration: groupResult.iteration,
                };
                encrypted = crypto.stringToBytes(JSON.stringify(groupMessage));

                const myEncryptedKey = await crypto.encryptForRecipient(userKeys.kem_public_key, currentState);
                messageKeys = [{ user_id: user.id, encrypted_key: myEncryptedKey }];

                const members = await conversations.getMembers(activeChat.conversationId);
                for (const member of members) {
                    if (member.user.id !== user.id) {
                        try {
                            const memberEncryptedKey = await crypto.encryptForRecipient(member.user.kem_public_key, currentState);
                            messageKeys.push({
                                user_id: member.user.id,
                                encrypted_key: memberEncryptedKey,
                            });
                        } catch (err) {
                            console.warn(`Failed to encrypt for member ${member.user.id}:`, err);
                        }
                    }
                }
            } else {
                const messageKey = await crypto.generateConversationKey();
                const encryptedBytes = await crypto.encryptWithKey(messageKey, msgBytes);
                encrypted = crypto.stringToBytes(JSON.stringify({ ciphertext: Array.from(encryptedBytes) }));

                const myEncryptedKey = await crypto.encryptForRecipient(userKeys.kem_public_key, messageKey);
                messageKeys = [{ user_id: user.id, encrypted_key: myEncryptedKey }];

                let friendPublicKey = friendsList.find(f => f.id === activeChat.visitorId)?.kem_public_key;
                if (!friendPublicKey) {
                    console.error("[Crypto] Friend public key not in friendsList, fetching from server...");
                    try {
                        const bundle = await keysApi.getPrekeyBundle(activeChat.visitorId);
                        friendPublicKey = bundle.identity_key;
                    } catch (err) {
                        console.error("[Crypto] Failed to fetch friend's public key:", err);
                    }
                }

                if (friendPublicKey) {
                    const theirEncryptedKey = await crypto.encryptForRecipient(friendPublicKey, messageKey);
                    messageKeys.push({ user_id: activeChat.visitorId, encrypted_key: theirEncryptedKey });
                }
            }

            const signature = await crypto.dsaSign(userKeys.dsa_secret_key, encrypted);

            const response = await messages.editMessage(activeChat.conversationId, messageId, {
                encrypted_content: encrypted,
                signature,
                message_keys: messageKeys,
            });

            setChatMessages((prev) =>
                prev.map((m) =>
                    m.id === messageId
                        ? { ...m, content: newContent, editedAt: response.edited_at }
                        : m
                )
            );

            const previewContent = newContent.startsWith("https://") && newContent.includes("tenor") ? "GIF" : newContent;
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
    }, [activeChat, userKeys, user, chatMessages, friendsList]);

    const addReaction = useCallback(async (messageId: string, emoji: string) => {
        if (!user || !activeChat) return;
        const message = chatMessages.find((m) => m.id === messageId);
        if (!message) return;
        const existingReaction = message.reactions.find((r) => r.userId === user.id && r.emoji === emoji);

        try {
            if (existingReaction) {
                await messages.removeReaction(activeChat.conversationId, messageId, emoji);
            } else {
                await messages.addReaction(activeChat.conversationId, messageId, { emoji });
            }
        } catch (err) {
            console.error("Failed to toggle reaction", err);
        }
    }, [user, activeChat, chatMessages]);

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
    }, []);

    useEffect(() => {
        loadDmPreviews();
        loadFavoriteGifs();
    }, [loadDmPreviews, loadFavoriteGifs]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setChatMessages((prev) =>
                prev.filter((msg) => !msg.expiresAt || new Date(msg.expiresAt).getTime() > now)
            );
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    return {
        activeChat,
        setActiveChat,
        chatMessages,
        setChatMessages,
        isLoadingChat,
        messageInput,
        setMessageInput,
        isSending,
        replyTo,
        setReplyTo,
        timedMessageDuration,
        setTimedMessageDuration,
        dmPreviews,
        setDmPreviews,
        favoriteGifUrls,
        setFavoriteGifUrls,
        unreadCounts,
        setUnreadCounts,
        activeChatRef,
        loadDmPreviews,
        loadFavoriteGifs,
        toggleFavoriteGif,
        openChat,
        sendMessage,
        editMessage,
        deleteMessage,
        addReaction,
        handleIncomingMessage,
        addSystemMessage,
    };
}
