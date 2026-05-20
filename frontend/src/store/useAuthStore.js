import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
    authUser: null,
    isSigningUp: false,
    isLoggingIn: false,
    isUpdatingProfile: false,
    isCheckingAuth: true,
    socket: null,
    onlineUsers: [],
    checkAuth: async () => {
        try {
            const res = await axiosInstance.get("/auth/check");
            set({ authUser: res.data });
            get().connectSocket();
        } catch (error) {
            console.log("Error system", error);
            set({ authUser: null });
        } finally {
            set({ isCheckingAuth: false });
        }
    },

    signUp: async (data) => {
        set({ isSigningUp: true });
        try {
            const res = await axiosInstance.post("/auth/signup", data);
            set({ authUser: res.data });
            get().connectSocket();
            toast.success("Tạo tài khoản thành công");
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isSigningUp: false });
        }
    },
    logout: async () => {
        try {
            set({ isLoggingIn: true });
            await axiosInstance.post("/auth/logout");
            set({ authUser: null });
            toast.success("Đăng xuất thành công");
            get().disconnectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isLoggingIn: false });
        }

    },
    login: async (data) => {
        set({ isLoggingIng: true });
        try {
            const res = await axiosInstance.post("/auth/login", data);
            set({ authUser: res.data });
            toast.success("Đăng nhập thành công");
            get().connectSocket();
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isLoggingIn: false });
        }
    },
    updateProfile: async (data) => {
        set({ isUpdatingProfile: true });
        try {
            const res = await axiosInstance.put("/auth/update-profile", data);
            set({ authUser: res.data });
            toast.success("Cập nhật thông tin thành công");
        } catch (error) {
            toast.error(error.response.data.message);
        } finally {
            set({ isUpdatingProfile: false });
        }
    },
    connectSocket: () => {
        const { authUser } = get();
        if (!authUser) return;

        const existing = get().socket;
        if (existing?.connected) return;

        if (existing) {
            existing.removeAllListeners();
            existing.disconnect();
        }

        const socket = io(BASE_URL, {
            query: { userId: String(authUser._id) },
            transports: ["websocket", "polling"],
        });

        set({ socket });

        const bindChatListeners = () => {
            import("./useChatStore")
                .then(({ useChatStore }) => {
                    useChatStore.getState().initializeSocketListener?.(socket);
                })
                .catch((err) => console.error(err));
        };

        socket.on("connect", bindChatListeners);
        if (socket.connected) bindChatListeners();

        socket.on("getOnlineUsers", (userIds) => {
            set({ onlineUsers: userIds });
        });

        socket.on("friendRequestReceived", (requester) => {
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    friendRequests: [...(state.authUser.friendRequests || []), requester._id]
                } : null
            }));
            toast.success(`${requester.fullName} đã gửi cho bạn lời mời kết bạn!`, { icon: "👋" });
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().getUsers();
            });
        });

        socket.on("friendRequestAccepted", (friend) => {
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    friends: [...(state.authUser.friends || []), friend._id],
                    sentRequests: (state.authUser.sentRequests || []).filter(id => id !== friend._id)
                } : null
            }));
            toast.success(`${friend.fullName} đã chấp nhận lời mời kết bạn!`, { icon: "🎉" });
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().getUsers();
            });
        });

        socket.on("friendRequestRejected", ({ userId, fullName }) => {
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    sentRequests: (state.authUser.sentRequests || []).filter(id => id !== userId)
                } : null
            }));
            toast.error(`${fullName} đã từ chối lời mời kết bạn.`, { icon: "❌" });
        });

        socket.on("unfriended", ({ userId, fullName }) => {
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    friends: (state.authUser.friends || []).filter(id => id !== userId)
                } : null
            }));
            toast.error(`${fullName} đã hủy kết bạn với bạn.`, { icon: "💔" });
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().getUsers();
            });
        });
    },
    disconnectSocket: () => {
        const socket = get().socket;
        if (socket) {
            socket.removeAllListeners();
            socket.disconnect();
        }
        set({ socket: null, onlineUsers: [] });
    },

    sendFriendRequest: async (targetId) => {
        try {
            const res = await axiosInstance.post(`/messages/friend-request/${targetId}`);
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    sentRequests: res.data.sentRequests
                } : null
            }));
            toast.success("Đã gửi lời mời kết bạn");
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi gửi kết bạn");
        }
    },
    acceptFriendRequest: async (requesterId) => {
        try {
            const res = await axiosInstance.post(`/messages/accept-friend/${requesterId}`);
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    friends: res.data.friends,
                    friendRequests: res.data.friendRequests
                } : null
            }));
            toast.success("Đã trở thành bạn bè");
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().getUsers();
            });
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi đồng ý kết bạn");
        }
    },
    rejectFriendRequest: async (requesterId) => {
        try {
            const res = await axiosInstance.post(`/messages/reject-friend/${requesterId}`);
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    friendRequests: res.data.friendRequests
                } : null
            }));
            toast.success("Đã từ chối lời mời");
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi từ chối kết bạn");
        }
    },
    unfriend: async (targetId) => {
        try {
            const res = await axiosInstance.post(`/messages/unfriend/${targetId}`);
            set(state => ({
                authUser: state.authUser ? {
                    ...state.authUser,
                    friends: res.data.friends
                } : null
            }));
            toast.success("Đã hủy kết bạn");
            import("./useChatStore").then(({ useChatStore }) => {
                useChatStore.getState().getUsers();
            });
        } catch (error) {
            toast.error(error.response?.data?.message || "Lỗi hủy kết bạn");
        }
    }
}));