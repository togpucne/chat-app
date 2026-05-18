import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    replyingTo: null,
    unreadCounts: JSON.parse(localStorage.getItem("unread_counts") || "{}"),

    setReplyingTo: (message) => set({ replyingTo: message }),

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            
            // Sync unreadCounts dynamically from backend response database states
            const counts = { ...get().unreadCounts };
            res.data.forEach((user) => {
                counts[user._id] = user.unreadCount || 0;
            });
            
            set({ users: res.data, unreadCounts: counts });
            localStorage.setItem("unread_counts", JSON.stringify(counts));
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isUsersLoading: false });
        }
    },

    getMessages: async (userId) => {
        set({ isMessagesLoading: true });
        try {
            const res = await axiosInstance.get(`/messages/${userId}`);
            set({ messages: res.data });
            
            // Clear unread counts for this user upon reading messages
            const counts = { ...get().unreadCounts };
            if (counts[userId]) {
                delete counts[userId];
                set({ unreadCounts: counts });
                localStorage.setItem("unread_counts", JSON.stringify(counts));
            }
            
            // Notify active chat socket
            const socket = useAuthStore.getState().socket;
            const authUser = useAuthStore.getState().authUser;
            if (socket && authUser) {
                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: userId });
            }
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser, messages, replyingTo, users } = get();
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, {
                ...messageData,
                replyTo: replyingTo?._id || null
            });

            // Real-time update lastMessage in sidebar list immediately on send
            const updatedUsers = users.map((u) => {
                if (u._id === selectedUser._id) {
                    return { ...u, lastMessage: res.data };
                }
                return u;
            });

            set({ 
                messages: [...messages, res.data],
                replyingTo: null,
                users: updatedUsers
            });
        } catch (error) {
            toast.error(error.response.data.message);
        }
    },

    forwardMessages: async (recipientIds, messagesToForward) => {
        try {
            for (const recipientId of recipientIds) {
                for (const msg of messagesToForward) {
                    const messageData = {
                        text: msg.text || "",
                        image: msg.image || null,
                        file: msg.file ? { ...msg.file } : null,
                        replyTo: null
                    };
                    await axiosInstance.post(`/messages/send/${recipientId}`, messageData);
                }
            }
            toast.success("Chuyển tiếp tin nhắn thành công!");
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi chuyển tiếp");
        }
    },

    deleteMessage: async (messageId, action) => {
        try {
            await axiosInstance.post(`/messages/delete/${messageId}`, { action });
            if (action === "everyone") {
                set({
                    messages: get().messages.map((msg) =>
                        msg._id === messageId ? { ...msg, isRecalled: true, text: "", image: "" } : msg
                    )
                });
                toast.success("Thu hồi tin nhắn thành công");
            } else if (action === "me") {
                set({
                    messages: get().messages.filter((msg) => msg._id !== messageId)
                });
                toast.success("Xóa tin nhắn thành công");
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi xử lý");
        }
    },

    pinMessage: async (messageId) => {
        try {
            const res = await axiosInstance.post(`/messages/pin/${messageId}`);
            set({
                messages: get().messages.map((msg) =>
                    msg._id === messageId ? res.data : msg
                )
            });
            toast.success(res.data.isPinned ? "Ghim tin nhắn thành công" : "Bỏ ghim tin nhắn thành công");
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi xử lý ghim");
        }
    },

    reactMessage: async (messageId, emoji) => {
        try {
            const res = await axiosInstance.post(`/messages/react/${messageId}`, { emoji });
            set({
                messages: get().messages.map((msg) =>
                    msg._id === messageId ? res.data : msg
                )
            });
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi xử lý cảm xúc");
        }
    },

    subscribeToMessages: () => {
        const { selectedUser } = get();
        if (!selectedUser) return;

        const socket = useAuthStore.getState().socket;
        if (!socket) return;

        socket.on("newMessage", (newMessage) => {
            const isMessageSentBySelectedUser = newMessage.senderId === selectedUser._id;
            if (!isMessageSentBySelectedUser) return;

            set({
                messages: [...get().messages, newMessage],
            });

            // Immediately notify recipient we've seen it since we have the chat active
            const authUser = useAuthStore.getState().authUser;
            if (authUser) {
                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: selectedUser._id });
            }
        });

        socket.on("recipientOpenedChat", ({ openerId }) => {
            if (selectedUser && openerId === selectedUser._id) {
                set({
                    messages: get().messages.map((msg) => {
                        const senderIdStr = typeof msg.senderId === "object" ? msg.senderId?._id : msg.senderId;
                        const myIdStr = useAuthStore.getState().authUser?._id;
                        return senderIdStr?.toString() === myIdStr?.toString()
                            ? { ...msg, isSeen: true }
                            : msg;
                    }),
                });
            }
        });

        socket.on("messageRecalled", ({ messageId }) => {
            set({
                messages: get().messages.map((msg) =>
                    msg._id === messageId ? { ...msg, isRecalled: true, text: "", image: "" } : msg
                ),
            });
        });

        socket.on("messagePinned", (updatedMessage) => {
            set({
                messages: get().messages.map((msg) =>
                    msg._id === updatedMessage._id ? updatedMessage : msg
                ),
            });
        });

        socket.on("messageReacted", (updatedMessage) => {
            set({
                messages: get().messages.map((msg) =>
                    msg._id === updatedMessage._id ? updatedMessage : msg
                ),
            });
        });
    },

    unsubscribeFromMessages: () => {
        const socket = useAuthStore.getState().socket;
        if (socket) {
            socket.off("newMessage");
            socket.off("messageRecalled");
            socket.off("messagePinned");
            socket.off("messageReacted");
            socket.off("recipientOpenedChat");
        }
    },

    initializeSocketListener: (socket) => {
        if (!socket) return;
        // Clean any existing listener to prevent double triggers
        socket.off("globalNewMessage");
        socket.off("blockStateChanged");
        
        socket.on("newMessage", (newMessage) => {
            const { selectedUser, users } = get();
            const senderId = newMessage.senderId;
            
            // Real-time update lastMessage in sidebar list immediately on receive
            const updatedUsers = users.map((u) => {
                if (u._id === senderId || u._id === newMessage.receiverId) {
                    return { ...u, lastMessage: newMessage };
                }
                return u;
            });

            set({ users: updatedUsers });

            // Increment unread count only if we are not actively in their conversation
            if (!selectedUser || selectedUser._id !== senderId) {
                const counts = { ...get().unreadCounts };
                counts[senderId] = (counts[senderId] || 0) + 1;
                set({ unreadCounts: counts });
                localStorage.setItem("unread_counts", JSON.stringify(counts));
                
                // Play simple notification chime if available only if NOT muted!
                const authUser = useAuthStore.getState().authUser;
                const isMuted = authUser && localStorage.getItem(`muted_${authUser._id}_${senderId}`) === "true";
                if (!isMuted) {
                    try {
                        const audio = new Audio("/notification.mp3");
                        audio.volume = 0.4;
                        audio.play().catch(() => {});
                    } catch (e) {}
                }
            }
        });

        socket.on("blockStateChanged", ({ blockerId, isBlocked }) => {
            const myId = useAuthStore.getState().authUser?._id;
            if (myId) {
                if (isBlocked) {
                    localStorage.setItem(`block_${blockerId}_${myId}`, "true");
                } else {
                    localStorage.removeItem(`block_${blockerId}_${myId}`);
                }
            }
        });
    },

    setSelectedUser: (selectedUser) => {
        set({ selectedUser });
        if (selectedUser) {
            // Clear unread counts for this user!
            const counts = { ...get().unreadCounts };
            if (counts[selectedUser._id]) {
                delete counts[selectedUser._id];
                set({ unreadCounts: counts });
                localStorage.setItem("unread_counts", JSON.stringify(counts));
            }

            const socket = useAuthStore.getState().socket;
            const authUser = useAuthStore.getState().authUser;
            if (socket && authUser) {
                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: selectedUser._id });
            }
        }
    },
    clearMessages: () => set({ messages: [] }),
}));
