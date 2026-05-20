import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { formatCallSystemText, formatGroupLastMessagePreview } from "../lib/callMessage";
import { normId } from "../lib/utils";

const loadUnreadCounts = () => {
    try {
        const raw = JSON.parse(localStorage.getItem("unread_counts") || "{}");
        const normalized = {};
        Object.entries(raw).forEach(([k, v]) => {
            normalized[normId(k)] = v;
        });
        return normalized;
    } catch {
        return {};
    }
};

const persistUnreadCounts = (counts) => {
    localStorage.setItem("unread_counts", JSON.stringify(counts));
};

/** Giữ ref để socket.off() không xóa nhầm listener global */
let globalNewMessageHandler = null;

export const useChatStore = create((set, get) => ({
    messages: [],
    users: [],
    selectedUser: null,
    isUsersLoading: false,
    isMessagesLoading: false,
    replyingTo: null,
    unreadCounts: loadUnreadCounts(),
    activeCall: null,
    /** groupId -> ongoing call snapshot from server */
    groupCalls: {},
    isCreateCallModalOpen: false,
    callType: "video",

    setCreateCallModalOpen: (open) => set({ isCreateCallModalOpen: open }),
    setCallType: (type) => set({ callType: type }),

    setReplyingTo: (message) => set({ replyingTo: message }),

    getUsers: async () => {
        set({ isUsersLoading: true });
        try {
            const res = await axiosInstance.get("/messages/users");
            
            // Sync unreadCounts dynamically from backend response database states
            const counts = { ...get().unreadCounts };
            res.data.forEach((user) => {
                const key = normId(user._id);
                const local = counts[key] || 0;
                // Groups: unread is client-side only; DMs: trust server count
                counts[key] = user.isDocuments ? 0 : user.isGroup ? local : (user.unreadCount || 0);
            });
            
            set({ users: res.data, unreadCounts: counts });
            persistUnreadCounts(counts);
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi kết nối máy chủ");
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
            const key = normId(userId);
            const counts = { ...get().unreadCounts };
            if (counts[key]) {
                delete counts[key];
                set({ unreadCounts: counts });
                persistUnreadCounts(counts);
            }
            
            // Notify active chat socket
            const socket = useAuthStore.getState().socket;
            const authUser = useAuthStore.getState().authUser;
            if (socket && authUser) {
                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: userId });
            }
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi tải tin nhắn");
        } finally {
            set({ isMessagesLoading: false });
        }
    },

    sendMessage: async (messageData) => {
        const { selectedUser, messages, replyingTo, users } = get();
        const authUser = useAuthStore.getState().authUser;
        if (
            selectedUser &&
            !selectedUser.isGroup &&
            !selectedUser.isDocuments &&
            authUser
        ) {
            const me = normId(authUser._id);
            const them = normId(selectedUser._id);
            if (localStorage.getItem(`block_${me}_${them}`) === "true") {
                toast.error("Bạn đã chặn người này. Bỏ chặn để nhắn tin.");
                return;
            }
            if (localStorage.getItem(`block_${them}_${me}`) === "true") {
                toast.error("Bạn không thể nhắn tin vì đã bị chặn");
                return;
            }
        }
        try {
            const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, {
                ...messageData,
                replyTo: replyingTo?._id || null
            });

            // Real-time update lastMessage in sidebar list immediately on send
            const updatedUsers = users.map((u) => {
                if (normId(u._id) === normId(selectedUser._id)) {
                    return { ...u, lastMessage: res.data };
                }
                return u;
            });

            const alreadyInThread = messages.some((m) => normId(m._id) === normId(res.data._id));
            set({ 
                messages: alreadyInThread ? messages : [...messages, res.data],
                replyingTo: null,
                users: updatedUsers
            });
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi gửi tin nhắn");
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

        get().unsubscribeFromMessages();

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

        socket.on("groupMessagesSeen", ({ groupId, userId }) => {
            const { selectedUser, messages } = get();
            if (selectedUser && selectedUser.isGroup && selectedUser._id === groupId) {
                const userObj = selectedUser.members?.find((m) => {
                    const mId = typeof m === "object" ? m._id : m;
                    return mId?.toString() === userId.toString();
                });
                
                if (userObj) {
                    const updatedMessages = messages.map((msg) => {
                        const senderId = typeof msg.senderId === "object" ? msg.senderId?._id : msg.senderId;
                        if (senderId?.toString() === userId.toString()) return msg;
                        
                        const alreadySeen = msg.seenBy?.some((u) => {
                            const uId = typeof u === "object" ? u._id : u;
                            return uId?.toString() === userId.toString();
                        });
                        
                        if (!alreadySeen) {
                            return {
                                ...msg,
                                seenBy: [...(msg.seenBy || []), userObj],
                            };
                        }
                        return msg;
                    });
                    set({ messages: updatedMessages });
                }
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
            socket.off("recipientOpenedChat");
            socket.off("groupMessagesSeen");
            socket.off("messageRecalled");
            socket.off("messagePinned");
            socket.off("messageReacted");
        }
    },

    initializeSocketListener: (socket) => {
        if (!socket) return;
        
        // Auto-subscribe to the active chat on reconnect
        const { selectedUser } = get();
        if (selectedUser) {
            get().subscribeToMessages();
            
            const authUser = useAuthStore.getState().authUser;
            if (authUser) {
                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: selectedUser._id });
            }
        }

        // Clean any existing listener to prevent double triggers
        socket.off("globalNewMessage");
        socket.off("blockStateChanged");
        socket.off("groupCreated");
        socket.off("groupUpdated");
        
        socket.off("groupCallParticipantLeft");

        if (globalNewMessageHandler) {
            socket.off("newMessage", globalNewMessageHandler);
        }

        globalNewMessageHandler = (newMessage) => {
            const authUser = useAuthStore.getState().authUser;
            const myId = normId(authUser?._id);
            const senderId = normId(
                typeof newMessage.senderId === "object" ? newMessage.senderId?._id : newMessage.senderId
            );
            const receiverId = normId(newMessage.receiverId);
            const { selectedUser, users, messages } = get();

            const isDocumentsMsg = Boolean(
                newMessage.isDocuments ||
                (senderId === myId && receiverId === myId)
            );
            const groupUser = users.find((u) => normId(u._id) === receiverId && u.isGroup);
            const isGroupMsg = Boolean(newMessage.isGroup || groupUser);

            let updatedLastMessage = newMessage;
            if (groupUser) {
                const senderName =
                    senderId === myId ? "Bạn" : newMessage.senderId?.fullName || "Thành viên";
                if (newMessage.text) {
                    updatedLastMessage = {
                        ...newMessage,
                        text: formatGroupLastMessagePreview(senderName, newMessage.text),
                    };
                } else if (newMessage.image) {
                    updatedLastMessage = { ...newMessage, text: `${senderName}: [Hình ảnh]` };
                } else if (newMessage.file && newMessage.file.url) {
                    updatedLastMessage = {
                        ...newMessage,
                        text: `${senderName}: [Tệp đính kèm] ${newMessage.file.name || ""}`,
                    };
                }
            } else if (!isDocumentsMsg && newMessage.text) {
                const callLabel = formatCallSystemText(newMessage.text);
                if (callLabel) {
                    updatedLastMessage = { ...newMessage, text: callLabel };
                }
            }

            const chatKey = isDocumentsMsg
                ? myId
                : isGroupMsg
                ? receiverId
                : senderId === myId
                ? receiverId
                : senderId;

            let updatedUsers = users.map((u) => {
                const uid = normId(u._id);
                const isMatch = isDocumentsMsg
                    ? u.isDocuments
                    : isGroupMsg
                    ? uid === receiverId
                    : !u.isDocuments && (uid === senderId || uid === receiverId);
                if (isMatch) {
                    return {
                        ...u,
                        lastMessage: updatedLastMessage,
                        updatedAt: newMessage.createdAt || u.updatedAt,
                    };
                }
                return u;
            });

            updatedUsers.sort((a, b) => {
                const ta = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
                const tb = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
                return tb - ta;
            });

            const isCallOverlayActive = Boolean(
                get().activeCall &&
                (get().activeCall.status === "ringing" ||
                    get().activeCall.status === "connected" ||
                    get().activeCall.status === "disconnected")
            );
            const viewingChat =
                selectedUser && normId(selectedUser._id) === chatKey && !isCallOverlayActive;

            let nextCounts = get().unreadCounts;
            if (!isDocumentsMsg && senderId !== myId && !viewingChat) {
                nextCounts = { ...get().unreadCounts };
                nextCounts[chatKey] = (nextCounts[chatKey] || 0) + 1;
                persistUnreadCounts(nextCounts);

                const isMuted =
                    authUser &&
                    localStorage.getItem(`muted_${normId(authUser._id)}_${chatKey}`) === "true";
                if (!isMuted) {
                    try {
                        const audio = new Audio("/notification.mp3");
                        audio.volume = 0.4;
                        audio.play().catch(() => {});
                    } catch {
                        /* ignore */
                    }
                }
            }

            let nextMessages = messages;
            if (selectedUser) {
                const isRelevant = isDocumentsMsg
                    ? selectedUser.isDocuments
                    : isGroupMsg
                    ? selectedUser.isGroup && normId(newMessage.receiverId) === normId(selectedUser._id)
                    : !selectedUser.isGroup &&
                      !selectedUser.isDocuments &&
                      (senderId === normId(selectedUser._id) ||
                          (senderId === myId &&
                              normId(newMessage.receiverId) === normId(selectedUser._id)));

                if (isRelevant) {
                    const exists = messages.some((m) => normId(m._id) === normId(newMessage._id));
                    if (!exists) {
                        nextMessages = [...messages, newMessage];
                        if (authUser && socket) {
                            socket.emit("userOpenedChat", {
                                openerId: authUser._id,
                                recipientId: selectedUser._id,
                            });
                        }
                    }
                }
            }

            set({ users: updatedUsers, unreadCounts: nextCounts, messages: nextMessages });
        };

        socket.on("newMessage", globalNewMessageHandler);

        socket.off("incomingCall");
        socket.off("callAccepted");
        socket.off("callRejected");
        socket.off("callEnded");
        socket.off("groupCallState");
        socket.off("groupCallUpdated");
        socket.off("groupCallEnded");
        socket.off("groupCallParticipantLeft");
        socket.off("webrtcSignal");

        socket.on("incomingCall", (callData) => {
            if (callData.isGroup && callData.receiverId) {
                set({
                    groupCalls: {
                        ...get().groupCalls,
                        [callData.receiverId]: {
                            callId: callData.callId,
                            groupId: callData.receiverId,
                            type: callData.type,
                            hostId: callData.callerId,
                            receiverName: callData.receiverName,
                            receiverAvatar: callData.receiverAvatar,
                            participants: callData.participants || [],
                        },
                    },
                });
            }
            set({
                activeCall: {
                    ...callData,
                    status: "ringing",
                    isIncoming: true,
                },
            });
        });

        socket.on("callAccepted", () => {
            const { activeCall } = get();
            if (activeCall) {
                set({
                    activeCall: {
                        ...activeCall,
                        status: "connected"
                    }
                });
            }
        });

        socket.on("callRejected", () => {
            const { activeCall } = get();
            if (activeCall) {
                set({
                    activeCall: {
                        ...activeCall,
                        status: "disconnected",
                        endedReason: "Đã từ chối cuộc gọi"
                    }
                });
            }
        });

        socket.on("callEnded", () => {
            const { activeCall } = get();
            if (activeCall?.isGroup) return;
            if (activeCall) {
                const wasRinging = activeCall.status === "ringing" && activeCall.isIncoming;
                set({
                    activeCall: {
                        ...activeCall,
                        status: "disconnected",
                        endedReason: "Cuộc gọi đã kết thúc"
                    }
                });
                if (wasRinging) {
                    get().logMissedCall();
                }
            }
        });

        socket.on("groupCallState", (state) => {
            if (!state?.groupId) return;
            set({ groupCalls: { ...get().groupCalls, [state.groupId]: state } });
        });

        socket.on("groupCallUpdated", (state) => {
            if (!state?.groupId) return;
            set({ groupCalls: { ...get().groupCalls, [state.groupId]: state } });
            const { activeCall } = get();
            if (activeCall?.isGroup && activeCall.receiverId === state.groupId) {
                set({
                    activeCall: {
                        ...activeCall,
                        callId: state.callId,
                        type: state.type,
                        participants: state.participants,
                    },
                });
            }
        });

        socket.on("groupCallEnded", ({ groupId }) => {
            const gc = { ...get().groupCalls };
            delete gc[groupId];
            set({ groupCalls: gc });
            const { activeCall } = get();
            if (activeCall?.isGroup && activeCall.receiverId === groupId) {
                set({
                    activeCall: {
                        ...activeCall,
                        status: "disconnected",
                        endedReason: "Cuộc gọi nhóm đã kết thúc",
                    },
                });
            }
        });

        socket.on("groupCallParticipantJoined", ({ groupId, participants }) => {
            const { activeCall } = get();
            if (activeCall?.isGroup && activeCall.receiverId === groupId) {
                set({
                    activeCall: { ...activeCall, participants },
                });
            }
        });

        socket.on("groupCallParticipantLeft", ({ groupId, participants }) => {
            const gc = get().groupCalls[groupId];
            if (gc) {
                set({
                    groupCalls: {
                        ...get().groupCalls,
                        [groupId]: { ...gc, participants },
                    },
                });
            }
            const { activeCall } = get();
            if (activeCall?.isGroup && activeCall.receiverId === groupId) {
                set({
                    activeCall: { ...activeCall, participants },
                });
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
        const previousSelected = get().selectedUser;
        set({ selectedUser });
        
        const socket = useAuthStore.getState().socket;
        const authUser = useAuthStore.getState().authUser;
        
        if (socket && authUser) {
            if (selectedUser) {
                // Clear unread counts for this user!
                const key = normId(selectedUser._id);
                const counts = { ...get().unreadCounts };
                if (counts[key]) {
                    delete counts[key];
                    set({ unreadCounts: counts });
                    persistUnreadCounts(counts);
                }

                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: selectedUser._id });
                if (selectedUser.isGroup) {
                    socket.emit("getGroupCallState", { groupId: selectedUser._id });
                }
            } else if (previousSelected) {
                socket.emit("userClosedChat", { userId: authUser._id });
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

    initiateCall: (type, isGroup = false, invitedUsers = []) => {
        set({ callType: type }); // Sync callType state when initiating
        const { selectedUser } = get();
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;
        if (!selectedUser || !authUser || !socket) return;

        if (isGroup) {
            const existing = get().groupCalls[selectedUser._id];
            if (existing?.participants?.length > 0 && (!invitedUsers || invitedUsers.length === 0)) {
                get().joinGroupCall(selectedUser._id);
                return;
            }

            const allMemberIds = (selectedUser.members || [])
                .map((m) => (typeof m === "object" ? m._id : m))
                .filter((id) => id?.toString() !== authUser._id?.toString());
            const targets = invitedUsers.length > 0 ? invitedUsers : allMemberIds;
            const selfParticipant = {
                userId: authUser._id,
                fullName: authUser.fullName,
                profilePic: authUser.profilePic || "",
            };

            socket.emit("startGroupCall", {
                groupId: selectedUser._id,
                type,
                callerId: authUser._id,
                callerName: authUser.fullName,
                callerAvatar: authUser.profilePic,
                receiverName: selectedUser.fullName,
                receiverAvatar: selectedUser.profilePic,
                invitedUsers: targets,
            });

            set({
                activeCall: {
                    callerId: authUser._id,
                    callerName: authUser.fullName,
                    callerAvatar: authUser.profilePic,
                    receiverId: selectedUser._id,
                    receiverName: selectedUser.fullName,
                    receiverAvatar: selectedUser.profilePic,
                    type,
                    isGroup: true,
                    invitedUsers: targets,
                    participants: [selfParticipant],
                    status: "connected",
                    isIncoming: false,
                },
            });
            return;
        }

        const callData = {
            callerId: authUser._id,
            callerName: authUser.fullName,
            callerAvatar: authUser.profilePic,
            receiverId: selectedUser._id,
            receiverName: selectedUser.fullName,
            receiverAvatar: selectedUser.profilePic,
            type,
            isGroup: false,
            invitedUsers: [selectedUser._id],
        };

        set({
            activeCall: {
                ...callData,
                status: "ringing",
                isIncoming: false,
            },
        });

        socket.emit("callUser", callData);
    },

    joinGroupCall: (groupId) => {
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;
        if (!authUser || !socket) return;

        const room = get().groupCalls[groupId];
        const group =
            get().users.find((u) => u._id === groupId) ||
            (get().selectedUser?._id === groupId ? get().selectedUser : null);
        if (!room) {
            socket.emit("getGroupCallState", { groupId });
            toast.error("Không tìm thấy cuộc gọi nhóm đang hoạt động");
            return;
        }

        const alreadyIn = room.participants?.some(
            (p) => p.userId?.toString() === authUser._id?.toString()
        );
        if (!alreadyIn) {
            socket.emit("joinGroupCall", {
                groupId,
                userId: authUser._id,
                fullName: authUser.fullName,
                profilePic: authUser.profilePic,
                videoOn: room.type === "video",
            });
        }

        const selfParticipant = {
            userId: authUser._id,
            fullName: authUser.fullName,
            profilePic: authUser.profilePic || "",
        };
        const participants = alreadyIn
            ? room.participants
            : [...(room.participants || []), selfParticipant];

        set({
            activeCall: {
                callerId: room.hostId,
                receiverId: groupId,
                receiverName: group?.fullName || room.receiverName,
                receiverAvatar: group?.profilePic || room.receiverAvatar,
                type: room.type,
                isGroup: true,
                callId: room.callId,
                participants,
                status: "connected",
                isIncoming: false,
            },
        });
    },

    acceptCall: () => {
        const { activeCall } = get();
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;
        if (!activeCall || !socket || !authUser) return;

        if (activeCall.isGroup) {
            socket.emit("joinGroupCall", {
                groupId: activeCall.receiverId,
                userId: authUser._id,
                fullName: authUser.fullName,
                profilePic: authUser.profilePic,
                videoOn: activeCall.type === "video",
            });
            const selfParticipant = {
                userId: authUser._id,
                fullName: authUser.fullName,
                profilePic: authUser.profilePic || "",
            };
            const participants = [
                ...(activeCall.participants || []).filter(
                    (p) => p.userId?.toString() !== authUser._id?.toString()
                ),
                selfParticipant,
            ];
            set({
                activeCall: {
                    ...activeCall,
                    status: "connected",
                    participants,
                },
            });
            return;
        }

        set({
            activeCall: {
                ...activeCall,
                status: "connected",
            },
        });

        socket.emit("answerCall", { callerId: activeCall.callerId, isGroup: false });
    },

    rejectCall: () => {
        const { activeCall } = get();
        const socket = useAuthStore.getState().socket;
        if (!activeCall || !socket) return;

        set({
            activeCall: {
                ...activeCall,
                status: "disconnected",
                endedReason: "Đã từ chối cuộc gọi"
            }
        });

        if (!activeCall.isGroup) {
            socket.emit("rejectCall", { callerId: activeCall.callerId, isGroup: false });
            get().logMissedCall();
        }
    },

    endCall: () => {
        const { activeCall } = get();
        const authUser = useAuthStore.getState().authUser;
        const socket = useAuthStore.getState().socket;
        if (!activeCall || !socket) return;

        if (activeCall.isGroup) {
            socket.emit("leaveGroupCall", {
                groupId: activeCall.receiverId,
                userId: authUser?._id,
            });
        } else {
            socket.emit("endCall", {
                targetId: activeCall.isIncoming ? activeCall.callerId : activeCall.receiverId,
                isGroup: false,
            });
        }

        set({
            activeCall: {
                ...activeCall,
                status: "disconnected",
                endedReason: activeCall.isGroup ? "Bạn đã rời cuộc gọi" : "Cuộc gọi đã kết thúc",
            },
        });
    },

    closeCallOverlay: () => {
        set({ activeCall: null });
        const { selectedUser } = get();
        if (selectedUser) {
            const key = normId(selectedUser._id);
            const counts = { ...get().unreadCounts };
            if (counts[key]) {
                delete counts[key];
                set({ unreadCounts: counts });
                persistUnreadCounts(counts);
            }
            const socket = useAuthStore.getState().socket;
            const authUser = useAuthStore.getState().authUser;
            if (socket && authUser) {
                socket.emit("userOpenedChat", { openerId: authUser._id, recipientId: selectedUser._id });
            }
            // Re‑subscribe to incoming messages so chat updates instantly after a call ends
            get().subscribeToMessages();

        }
    },

    logMissedCall: async () => {
        const { activeCall } = get();
        if (!activeCall) return;

        const receiverId = activeCall.isGroup
            ? activeCall.receiverId
            : activeCall.isIncoming
              ? activeCall.callerId
              : activeCall.receiverId;
        try {
            const res = await axiosInstance.post(`/messages/send/${receiverId}`, {
                text: `[CALL_${activeCall.type.toUpperCase()}_MISSED]`,
            });
            const selectedUser = get().selectedUser;
            const users = get().users;
            const previewText = activeCall.isGroup && res.data.text
                ? formatGroupLastMessagePreview(
                      useAuthStore.getState().authUser?.fullName || "Bạn",
                      res.data.text
                  )
                : null;
            let lastMsg = previewText ? { ...res.data, text: previewText } : res.data;
            const callLabel = formatCallSystemText(res.data.text);
            if (callLabel && !activeCall.isGroup) {
                lastMsg = { ...res.data, text: callLabel };
            }
            const recvKey = normId(receiverId);
            const updatedUsers = users.map((u) =>
                normId(u._id) === recvKey ? { ...u, lastMessage: lastMsg } : u
            );
            if (selectedUser && normId(selectedUser._id) === recvKey) {
                set({
                    messages: [...get().messages, res.data],
                    users: updatedUsers,
                });
            } else {
                set({ users: updatedUsers });
            }
        } catch (error) {
            console.error("Failed to log completed call:", error);
        }
    },

    logCompletedCall: async (duration) => {
        const { activeCall } = get();
        if (!activeCall) return;

        // Only the caller / host logs the completed call to avoid duplicates!
        if (activeCall.isIncoming) return;
        const authUser = useAuthStore.getState().authUser;
        if (activeCall.isGroup && activeCall.callerId?.toString() !== authUser?._id?.toString()) return;

        const receiverId = activeCall.receiverId;
        try {
            const res = await axiosInstance.post(`/messages/send/${receiverId}`, {
                text: `[CALL_${activeCall.type.toUpperCase()}_COMPLETED:${duration}]`,
            });
            const selectedUser = get().selectedUser;
            const users = get().users;
            const previewText = activeCall.isGroup && res.data.text
                ? formatGroupLastMessagePreview(
                      authUser?.fullName || "Bạn",
                      res.data.text
                  )
                : null;
            let lastMsg = previewText ? { ...res.data, text: previewText } : res.data;
            const callLabel = formatCallSystemText(res.data.text);
            if (callLabel && !activeCall.isGroup) {
                lastMsg = { ...res.data, text: callLabel };
            }
            const recvKey = normId(receiverId);
            const updatedUsers = users.map((u) =>
                normId(u._id) === recvKey ? { ...u, lastMessage: lastMsg } : u
            );
            if (selectedUser && normId(selectedUser._id) === recvKey) {
                set({
                    messages: [...get().messages, res.data],
                    users: updatedUsers,
                });
            } else {
                set({ users: updatedUsers });
            }
        } catch (error) {
            console.error("Failed to log completed call:", error);
        }
    },
}));
