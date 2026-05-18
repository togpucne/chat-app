import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
const BASE_URL = "http://localhost:5001";

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
        if (!authUser || get().socket?.connected) return;
        const socket = io(BASE_URL, {
            query: {
                userId: authUser._id
            }
        });


        socket.connect();

        set({ socket: socket });

        // Lazy load useChatStore dynamically to prevent circular dependencies
        import("./useChatStore").then(({ useChatStore }) => {
            useChatStore.getState().initializeSocketListener?.(socket);
        }).catch(err => console.error(err));

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
    },
    disconnectSocket: () => {
        if (get().socket?.connected) get().socket.disconnect();
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
    }

}));