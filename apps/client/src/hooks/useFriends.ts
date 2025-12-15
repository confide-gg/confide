import { useState, useCallback, useEffect, useRef } from "react";
import { type Friend, type FriendRequestResponse } from "../types";
import { friendService } from "../features/friends/friends";
import { cryptoService } from "../core/crypto/crypto";
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
            const response = await friendService.getFriends();
            if (response.encrypted_friends.length > 0) {
                const decrypted = await cryptoService.decryptData(keys.kem_secret_key, response.encrypted_friends);
                const friendsData = JSON.parse(cryptoService.bytesToString(decrypted)) as Friend[];
                const seen = new Set<string>();
                const deduped = friendsData.filter((f) => {
                    if (seen.has(f.id)) return false;
                    seen.add(f.id);
                    return true;
                });
                setFriendsList(deduped);
            } else {
                setFriendsList([]);
            }
        } catch (err) {
            console.error("Failed to load friends:", err);
        }
    }, [keys]);

    const loadFriendRequests = useCallback(async () => {
        try {
            const requests = await friendService.getFriendRequests();
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
            const results = await friendService.searchUsers(query);
            setSearchResults(results);
        } catch (err) {
            console.error("Failed to search users:", err);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleSendFriendRequest = useCallback(async (toUser: { id: string; username: string }) => {
        try {
            await friendService.sendFriendRequest({ to_user_id: toUser.id, encrypted_message: null });
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

        const alreadyFriend = friendsListRef.current.some((f) => f.id === request.from_user.id);
        if (alreadyFriend) {
            setFriendRequests((prev) => prev.filter((r) => r.id !== request.id));
            return;
        }

        try {
            const newFriend: Friend = {
                id: request.from_user.id,
                username: request.from_user.username,
                kem_public_key: request.from_user.kem_public_key,
                dsa_public_key: request.from_user.dsa_public_key
            };

            const currentFriends = friendsListRef.current.filter((f) => f.id !== newFriend.id);
            const updatedFriends = [...currentFriends, newFriend];
            const jsonData = JSON.stringify(updatedFriends);
            const encryptedFriends = await cryptoService.encryptData(keys.kem_secret_key, cryptoService.stringToBytes(jsonData));

            await friendService.acceptFriendRequest(request.id, { encrypted_friends: encryptedFriends });

            setFriendsList(updatedFriends);
            setFriendRequests((prev) => prev.filter((r) => r.id !== request.id));
            subscribeToUsers([newFriend.id]);
        } catch (err) {
            console.error("Failed to accept friend request:", err);
            throw err;
        }
    }, [keys, subscribeToUsers]);

    const handleRejectRequest = useCallback(async (requestId: string) => {
        try {
            await friendService.rejectFriendRequest(requestId);
            setFriendRequests((prev) => prev.filter((r) => r.id !== requestId));
        } catch (err) {
            console.error("Failed to reject friend request:", err);
            throw err;
        }
    }, []);

    const removeFriend = useCallback(async (friendToRemove: Friend) => {
        if (!keys) return;
        try {
            const updatedFriends = friendsListRef.current.filter((f) => f.id !== friendToRemove.id);
            const jsonData = JSON.stringify(updatedFriends);
            const encryptedFriends = await cryptoService.encryptData(keys.kem_secret_key, cryptoService.stringToBytes(jsonData));

            await friendService.updateFriends({
                encrypted_friends: encryptedFriends,
                removed_friend_id: friendToRemove.id
            });

            setFriendsList(updatedFriends);
            setConfirmRemove(null);
        } catch (err) {
            console.error("Failed to remove friend:", err);
            throw err;
        }
    }, [keys]);

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
        if (alreadyFriend) {
            subscribeToUsers([userId]);
            setSentRequests((prev) => {
                const next = new Set(prev);
                next.delete(userId);
                return next;
            });
            return;
        }

        subscribeToUsers([userId]);

        try {
            const searchResults = await friendService.searchUsers(username, 1);
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

            const currentFriends = friendsListRef.current.filter((f) => f.id !== userId);
            const updatedFriends = [...currentFriends, newFriend];
            const jsonData = JSON.stringify(updatedFriends);
            const encryptedFriends = await cryptoService.encryptData(keys.kem_secret_key, cryptoService.stringToBytes(jsonData));

            await friendService.updateFriends({ encrypted_friends: encryptedFriends });

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

    const onFriendRemoved = useCallback(async (userId: string) => {
        if (!keys) return;

        const updatedFriends = friendsListRef.current.filter((f) => f.id !== userId);
        setFriendsList(updatedFriends);

        try {
            const jsonData = JSON.stringify(updatedFriends);
            const encryptedFriends = await cryptoService.encryptData(keys.kem_secret_key, cryptoService.stringToBytes(jsonData));
            await friendService.updateFriends({ encrypted_friends: encryptedFriends });
        } catch (err) {
            console.error("Failed to sync friend removal:", err);
        }
    }, [keys]);

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
        onFriendAccepted,
        onFriendRemoved
    };
}