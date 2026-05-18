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

    setReplyingTo: (message) => set({ replyingTo: message }),

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            set({ users: res.data });
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
        const { selectedUser, messages, replyingTo } = get();
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, {
                ...messageData,
                replyTo: replyingTo?._id || null
            });
            set({ 
                messages: [...messages, res.data],
                replyingTo: null
            });
        } catch (error) {
            toast.error(error.response.data.message);
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

    setSelectedUser: (selectedUser) => {
        set({ selectedUser });
        if (selectedUser) {
            const socket = useAuthStore.getState().socket;
            const authUser = useAuthStore.getState().authUser;
            if (socket && authUser) {
                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: selectedUser._id });
            }
        }
    },
    clearMessages: () => set({ messages: [] }),
}));
