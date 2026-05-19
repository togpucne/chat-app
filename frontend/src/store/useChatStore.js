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
            const senderId = typeof newMessage.senderId === "object" ? newMessage.senderId?._id : newMessage.senderId;
            const isGroupMsg = newMessage.isGroup || get().users.some(u => u._id === newMessage.receiverId && u.isGroup);
            
            const isRelevant = isGroupMsg
                ? (selectedUser.isGroup && newMessage.receiverId === selectedUser._id)
                : (!selectedUser.isGroup && (
                    senderId === selectedUser._id ||
                    (senderId === useAuthStore.getState().authUser?._id && newMessage.receiverId === selectedUser._id)
                  ));
            
            if (!isRelevant) return;

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
        socket.off("groupCreated");
        socket.off("groupUpdated");
        
        socket.on("newMessage", (newMessage) => {
            const { selectedUser, users } = get();
            const senderId = typeof newMessage.senderId === "object" ? newMessage.senderId?._id : newMessage.senderId;
            
            // Format lastMessage preview for group if it's a group message
            let updatedLastMessage = newMessage;
            const groupUser = users.find(u => u._id === newMessage.receiverId);
            if (groupUser && groupUser.isGroup) {
                const senderName = senderId === useAuthStore.getState().authUser?._id ? "Bạn" : (newMessage.senderId?.fullName || "Thành viên");
                if (newMessage.text) {
                    updatedLastMessage = { ...newMessage, text: `${senderName}: ${newMessage.text}` };
                } else if (newMessage.image) {
                    updatedLastMessage = { ...newMessage, text: `${senderName}: [Hình ảnh]` };
                } else if (newMessage.file && newMessage.file.url) {
                    updatedLastMessage = { ...newMessage, text: `${senderName}: [Tệp đính kèm] ${newMessage.file.name || ""}` };
                }
            }

            const isGroupMsg = newMessage.isGroup || (groupUser && groupUser.isGroup);

            // Real-time update lastMessage in sidebar list immediately on receive
            const updatedUsers = users.map((u) => {
                const isMatch = isGroupMsg
                    ? u._id === newMessage.receiverId
                    : (u._id === senderId || u._id === newMessage.receiverId);

                if (isMatch) {
                    return { ...u, lastMessage: updatedLastMessage };
                }
                return u;
            });

            set({ users: updatedUsers });

            // Determine if the target chat is a group or direct user
            const targetId = isGroupMsg ? newMessage.receiverId : senderId;

            // Increment unread count only if we are not actively in their conversation and the sender is NOT ourselves
            if (senderId !== useAuthStore.getState().authUser?._id) {
                if (!selectedUser || selectedUser._id !== targetId) {
                    const counts = { ...get().unreadCounts };
                    counts[targetId] = (counts[targetId] || 0) + 1;
                    set({ unreadCounts: counts });
                    localStorage.setItem("unread_counts", JSON.stringify(counts));
                    
                    // Play simple notification chime if available only if NOT muted!
                    const authUser = useAuthStore.getState().authUser;
                    const isMuted = authUser && localStorage.getItem(`muted_${authUser._id}_${targetId}`) === "true";
                    if (!isMuted) {
                        try {
                            const audio = new Audio("/notification.mp3");
                            audio.volume = 0.4;
                            audio.play().catch(() => {});
                        } catch (e) {}
                    }
                }
            }
        });

        socket.on("groupCreated", (newGroup) => {
            const { users } = get();
            if (!users.some(u => u._id === newGroup._id)) {
                const formattedGroup = {
                    _id: newGroup._id,
                    fullName: newGroup.name,
                    profilePic: newGroup.groupPic || "",
                    isGroup: true,
                    members: newGroup.members,
                    creator: newGroup.creator,
                    admins: newGroup.admins,
                    lastMessage: { text: "Nhóm mới đã được tạo" },
                    unreadCount: 0,
                    updatedAt: newGroup.updatedAt,
                };
                set({ users: [...users, formattedGroup] });
            }
        });

        socket.on("groupUpdated", (updatedGroup) => {
            const { users, selectedUser } = get();
            const myId = useAuthStore.getState().authUser?._id;
            
            // Check if I am still a member of the group
            const isStillMember = updatedGroup.members.some(m => (typeof m === "object" ? m._id : m) === myId);
            
            if (!isStillMember) {
                // If I was removed from this group, remove it from my conversations list
                const updatedUsers = users.filter(u => u._id !== updatedGroup._id);
                set({ users: updatedUsers });
                
                if (selectedUser && selectedUser._id === updatedGroup._id) {
                    set({ selectedUser: null });
                    toast.error("Bạn không còn là thành viên của nhóm này");
                }
                return;
            }

            const hasGroup = users.some(u => u._id === updatedGroup._id);
            if (!hasGroup) {
                const formattedGroup = {
                    _id: updatedGroup._id,
                    fullName: updatedGroup.name,
                    profilePic: updatedGroup.groupPic || "",
                    isGroup: true,
                    members: updatedGroup.members,
                    creator: updatedGroup.creator,
                    admins: updatedGroup.admins,
                    lastMessage: { text: "Bạn đã được thêm vào nhóm" },
                    unreadCount: 0,
                    updatedAt: updatedGroup.updatedAt,
                };
                set({ users: [...users, formattedGroup] });
                return;
            }

            const updatedUsers = users.map(u => {
                if (u._id === updatedGroup._id) {
                    return {
                        ...u,
                        fullName: updatedGroup.name,
                        profilePic: updatedGroup.groupPic || "",
                        members: updatedGroup.members,
                        creator: updatedGroup.creator,
                        admins: updatedGroup.admins,
                    };
                }
                return u;
            });
            set({ users: updatedUsers });

            if (selectedUser && selectedUser._id === updatedGroup._id) {
                set({
                    selectedUser: {
                        ...selectedUser,
                        fullName: updatedGroup.name,
                        profilePic: updatedGroup.groupPic || "",
                        members: updatedGroup.members,
                        admins: updatedGroup.admins,
                    }
                });
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
    createGroup: async (groupData) => {
        try {
            const res = await axiosInstance.post("/messages/groups", groupData);
            toast.success("Tạo nhóm thành công!");
            
            // Format new group
            const formattedGroup = {
                _id: res.data._id,
                fullName: res.data.name,
                profilePic: res.data.groupPic || "",
                isGroup: true,
                members: res.data.members,
                creator: res.data.creator,
                admins: res.data.admins,
                lastMessage: { text: "Nhóm mới đã được tạo" },
                unreadCount: 0,
                updatedAt: res.data.updatedAt,
            };

            const existingUsers = get().users;
            const isAlreadyAdded = existingUsers.some(u => u._id === res.data._id);
            if (!isAlreadyAdded) {
                set({
                    users: [...existingUsers, formattedGroup],
                    selectedUser: formattedGroup
                });
            } else {
                // If already added by socket, just select it and update it
                const updatedUsers = existingUsers.map(u => u._id === res.data._id ? formattedGroup : u);
                set({
                    users: updatedUsers,
                    selectedUser: formattedGroup
                });
            }
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi tạo nhóm");
        }
    },

    addGroupMembers: async (groupId, memberIds) => {
        try {
            const res = await axiosInstance.post(`/messages/groups/${groupId}/add`, { members: memberIds });
            toast.success("Thêm thành viên thành công!");
            
            const updatedGroup = {
                ...res.data,
                isGroup: true,
            };
            
            const { users, selectedUser } = get();
            const updatedUsers = users.map((u) => u._id === groupId ? { ...u, ...updatedGroup } : u);
            
            set({
                users: updatedUsers,
                selectedUser: selectedUser?._id === groupId ? { ...selectedUser, ...updatedGroup } : selectedUser,
            });
            
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi thêm thành viên");
        }
    },

    removeGroupMember: async (groupId, memberId) => {
        try {
            const res = await axiosInstance.post(`/messages/groups/${groupId}/remove`, { memberId });
            toast.success("Đã xóa thành viên khỏi nhóm!");
            
            const updatedGroup = {
                ...res.data,
                isGroup: true,
            };
            
            const { users, selectedUser } = get();
            const updatedUsers = users.map((u) => u._id === groupId ? { ...u, ...updatedGroup } : u);
            
            set({
                users: updatedUsers,
                selectedUser: selectedUser?._id === groupId ? { ...selectedUser, ...updatedGroup } : selectedUser,
            });
            
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi xóa thành viên");
        }
    },

    leaveGroup: async (groupId, newCreatorId) => {
        try {
            const res = await axiosInstance.post(`/messages/groups/${groupId}/leave`, { newCreatorId });
            toast.success("Đã rời khỏi nhóm!");
            
            // Clear selected chat if active chat was the left group
            const { selectedUser, users } = get();
            if (selectedUser && selectedUser._id === groupId) {
                set({ selectedUser: null });
            }
            
            // Remove group from conversations list
            const updatedUsers = users.filter((u) => u._id !== groupId);
            set({ users: updatedUsers });
            
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi rời nhóm");
        }
    },

    updateGroup: async (groupId, updateData) => {
        try {
            const res = await axiosInstance.put(`/messages/groups/${groupId}`, updateData);
            toast.success("Cập nhật thông tin nhóm thành công!");
            
            const updatedGroup = {
                ...res.data,
                isGroup: true,
            };
            
            const { users, selectedUser } = get();
            const updatedUsers = users.map((u) => u._id === groupId ? { ...u, ...updatedGroup } : u);
            
            set({
                users: updatedUsers,
                selectedUser: selectedUser?._id === groupId ? { ...selectedUser, ...updatedGroup } : selectedUser,
            });
            
            return res.data;
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi cập nhật nhóm");
        }
    },
    clearMessages: () => set({ messages: [] }),
}));
