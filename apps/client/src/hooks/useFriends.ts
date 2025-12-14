import { useState, useCallback, useEffect, useRef } from "react";
import { type Friend, type FriendRequestResponse } from "../types";
import { friends, crypto } from "../api";
import { useAuth } from "../context/AuthContext";
import { usePresence } from "../context/PresenceContext";

export function useFriends() {
    const { keys } = useAuth();
    const { subscribeToUsers, isWsConnected } = usePresence();
    const [friendsList, setFriendsList] = useState<Friend[]>([]);
    const friendsListRef = useRef<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequestResponse[]>([]);
    const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
    const [searchResults, setSearchResults] = useState<{ id: string; username: string; kem_public_key: number[] }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [confirmRemove, setConfirmRemove] = useState<Friend | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        friendsListRef.current = friendsList;
    }, [friendsList]);

    const loadFriends = useCallback(async () => {
        if (!keys) return;
        try {
            const response = await friends.getFriends();
            if (response.encrypted_friends.length > 0) {
                const decrypted = await crypto.decryptData(keys.kem_secret_key, response.encrypted_friends);
                const friendsData = JSON.parse(crypto.bytesToString(decrypted)) as Friend[];
                setFriendsList(friendsData);
            } else {
                setFriendsList([]);
            }
        } catch (err) {
            console.error("Failed to load friends:", err);
        }
    }, [keys]);

    const loadFriendRequests = useCallback(async () => {
        try {
            const requests = await friends.getFriendRequests();
            setFriendRequests(requests);
        } catch (err) {
            console.error("Failed to load friend requests:", err);
        }
    }, []);

    const searchUsers = useCallback(async (query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        try {
            const results = await friends.searchUsers(query);
            setSearchResults(results);
        } catch (err) {
            console.error("Failed to search users:", err);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSendFriendRequest = useCallback(async (toUser: { id: string; username: string }) => {
        try {
            await friends.sendFriendRequest({ to_user_id: toUser.id, encrypted_message: null });
            setSentRequests((prev) => new Set([...prev, toUser.id]));
            // Success handling usually done in UI via toast/result
        } catch (err) {
            console.error("Failed to send friend request:", err);
            throw err;
        }
    }, []);

    const handleAcceptRequest = useCallback(async (request: FriendRequestResponse) => {
        if (!keys) {
            console.error("No keys available");
            return;
        }

        try {
            const newFriend: Friend = {
                id: request.from_user.id,
                username: request.from_user.username,
                kem_public_key: request.from_user.kem_public_key,
                dsa_public_key: request.from_user.dsa_public_key
            };

            const updatedFriends = [...friendsListRef.current, newFriend];
            const jsonData = JSON.stringify(updatedFriends);
            const encryptedFriends = await crypto.encryptData(keys.kem_secret_key, crypto.stringToBytes(jsonData));

            await friends.acceptFriendRequest(request.id, { encrypted_friends: encryptedFriends });

            subscribeToUsers([newFriend.id]);

            setFriendsList(updatedFriends);
            setFriendRequests((prev) => prev.filter((r) => r.id !== request.id));
        } catch (err) {
            console.error("Failed to accept friend request:", err);
            throw err;
        }
    }, [keys, subscribeToUsers]);

    const handleRejectRequest = useCallback(async (requestId: string) => {
        try {
            await friends.rejectFriendRequest(requestId);
            setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err) {
            console.error("Failed to reject friend request:", err);
            throw err;
        }
    }, []);

    const removeFriend = useCallback(async (friendToRemove: Friend) => {
        if (!keys) return;
        try {
            const updatedFriends = friendsList.filter((f) => f.id !== friendToRemove.id);
            const jsonData = JSON.stringify(updatedFriends);
            const encryptedFriends = await crypto.encryptData(keys.kem_secret_key, crypto.stringToBytes(jsonData));

            await friends.updateFriends({
                encrypted_friends: encryptedFriends,
                removed_friend_id: friendToRemove.id
            });

            setFriendsList(updatedFriends);
            setConfirmRemove(null);
        } catch (err) {
            console.error("Failed to remove friend:", err);
            throw err;
        }
    }, [keys, friendsList]);

    useEffect(() => {
        loadFriends();
        loadFriendRequests();
    }, [loadFriends, loadFriendRequests]);

    useEffect(() => {
        if (isWsConnected && friendsList.length > 0) {
            const friendIds = friendsList.map(f => f.id);
            subscribeToUsers(friendIds);
        }
    }, [isWsConnected, friendsList, subscribeToUsers]);

    const onFriendAccepted = useCallback(async (userId: string, username: string) => {
        if (!keys) return;

        const alreadyFriend = friendsListRef.current.some((f) => f.id === userId);
        if (alreadyFriend) return;

        subscribeToUsers([userId]);

        try {
            const searchResults = await friends.searchUsers(username, 1);
            const userResult = searchResults.find((u) => u.id === userId);

            if (!userResult) {
                throw new Error("Could not find user public key");
            }

            const newFriend: Friend = {
                id: userId,
                username,
                kem_public_key: userResult.kem_public_key,
                dsa_public_key: userResult.dsa_public_key
            };

            const updatedFriends = [...friendsListRef.current, newFriend];
            const jsonData = JSON.stringify(updatedFriends);
            const encryptedFriends = await crypto.encryptData(keys.kem_secret_key, crypto.stringToBytes(jsonData));

            await friends.updateFriends({ encrypted_friends: encryptedFriends });

            setFriendsList(updatedFriends);
            setSentRequests((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
            return newFriend;
        } catch (err) {
            console.error("Failed to update friends after acceptance:", err);
            throw err;
        }
    }, [keys, subscribeToUsers]);

    return {
        friendsList,
        setFriendsList,
        friendRequests,
        setFriendRequests,
        searchResults,
        isSearching,
        searchQuery,
        setSearchQuery,
        sentRequests,
        setSentRequests,
        confirmRemove,
        setConfirmRemove,
        loadFriends,
        loadFriendRequests,
        searchUsers,
        handleSendFriendRequest,
        handleAcceptRequest,
        handleRejectRequest,
        removeFriend,
        onFriendAccepted
    };
}
