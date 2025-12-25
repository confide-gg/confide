import { useState, useRef, useEffect } from "react";
import { type ActiveChat, type DecryptedMessage, type Friend, type DmPreview, type ReplyTo, type TimedMessageDuration } from "../../types";
import { useAuth } from "../../context/AuthContext";
import {
  useSendMessage as useSendMessageMutation,
  useEditMessage as useEditMessageMutation,
  useDeleteMessage as useDeleteMessageMutation,
  usePinMessage as usePinMessageMutation,
  useUnpinMessage as useUnpinMessageMutation,
  useAddReaction as useAddReactionMutation,
  useRemoveReaction as useRemoveReactionMutation,
  useConversations
} from "../queries";
import { useDecryptedMessages } from "../useDecryptedMessages";
import { MessageQueue } from "../../utils/MessageQueue";
import { useGifFavorites } from "./useGifFavorites";
import { useDmPreviews } from "./useDmPreviews";
import { useIncomingMessages } from "./useIncomingMessages";
import { useOpenChat } from "./useOpenChat";
import { useSendMessage } from "./useSendMessage";
import { useMessageActions } from "./useMessageActions";

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
    const groupMemberNameCache = useRef<Map<string, Map<string, string>>>(new Map());
    const messageQueuesRef = useRef<Map<string, MessageQueue>>(new Map());

    useConversations();

    const decryptionContext = activeChat && userKeys && user ? {
        userId: user.id,
        username: user.username,
        kemSecretKey: userKeys.kem_secret_key,
        isGroup: activeChat.isGroup || false,
        conversationKey: activeChat.conversationKey,
        visitorUsername: activeChat.visitorUsername,
        visitorId: activeChat.visitorId,
        conversationId: activeChat.conversationId,
    } : null;

    const { data: cachedDecryptedMessages, isLoading: isLoadingDecrypted } = useDecryptedMessages(
        activeChat?.conversationId || null,
        decryptionContext
    );

    const sendMessageMutation = useSendMessageMutation(activeChat?.conversationId || "");
    const editMessageMutation = useEditMessageMutation(activeChat?.conversationId || "");
    const deleteMessageMutation = useDeleteMessageMutation(activeChat?.conversationId || "");
    const pinMessageMutation = usePinMessageMutation(activeChat?.conversationId || "");
    const unpinMessageMutation = useUnpinMessageMutation(activeChat?.conversationId || "");
    const addReactionMutation = useAddReactionMutation(activeChat?.conversationId || "");
    const removeReactionMutation = useRemoveReactionMutation(activeChat?.conversationId || "");

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    useEffect(() => {
        if (cachedDecryptedMessages && activeChat) {
            setChatMessages(cachedDecryptedMessages);
            setIsLoadingChat(isLoadingDecrypted);
        }
    }, [cachedDecryptedMessages, activeChat, isLoadingDecrypted]);

    const { loadFavoriteGifs, toggleFavoriteGif } = useGifFavorites(favoriteGifUrls, setFavoriteGifUrls);

    const { loadDmPreviews } = useDmPreviews({
        userKeys,
        userId: user?.id,
        setDmPreviews,
    });

    const { handleIncomingMessage } = useIncomingMessages({
        userId: user?.id,
        userKeys,
        friendsList,
        profileStatus: profile?.status,
        activeChatRef,
        processedMessageIds,
        groupMemberNameCache,
        setUnreadCounts,
        setDmPreviews,
        setChatMessages,
    });

    const { openChat } = useOpenChat({
        userKeys,
        userId: user?.id,
        friendsList,
        setIsLoadingChat,
        setChatMessages,
        setActiveChat,
        setUnreadCounts,
        setDmPreviews,
    });

    const { sendMessage } = useSendMessage({
        activeChat,
        messageInput,
        setMessageInput,
        userKeys,
        userId: user?.id,
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
    });

    const {
        deleteMessage,
        pinMessage,
        unpinMessage,
        editMessage,
        addReaction,
        addSystemMessage,
    } = useMessageActions({
        activeChat,
        userKeys,
        userId: user?.id,
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
    });

    useEffect(() => {
        loadDmPreviews();
        loadFavoriteGifs();
    }, [loadDmPreviews, loadFavoriteGifs]);

    useEffect(() => {
        const hasTimedMessages = chatMessages.some(msg => msg.expiresAt);
        if (!hasTimedMessages) return;

        const interval = setInterval(() => {
            const now = Date.now();
            setChatMessages((prev) =>
                prev.filter((msg) => !msg.expiresAt || new Date(msg.expiresAt).getTime() > now)
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [chatMessages.length, chatMessages.some(msg => msg.expiresAt)]);

    return {
        activeChat,
        setActiveChat,
        chatMessages,
        setChatMessages,
        isLoadingChat,
        setIsLoadingChat,
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
        pinMessage,
        unpinMessage,
        addReaction,
        handleIncomingMessage,
        addSystemMessage,
    };
}
