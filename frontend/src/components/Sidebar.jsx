import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, BellOff, Pin } from "lucide-react";

const formatMessageTime = (createdAt) => {
    if (!createdAt) return "";
    const date = new Date(createdAt);
    const now = new Date();
    
    const dateZero = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const diffMs = nowZero.getTime() - dateZero.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
    }
    if (diffDays === 1) {
        return "Hôm qua";
    }
    if (diffDays < 7) {
        return `${diffDays} ngày`;
    }
    return `${date.getDate()} thg ${date.getMonth() + 1}`;
};

const formatLastActive = (updatedAt, isOnline) => {
    if (isOnline) return "Vừa truy cập";
    if (!updatedAt) return "offline";
    
    const diffMs = Date.now() - new Date(updatedAt).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Vừa mới truy cập";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 30) return `${diffDays} ngày trước`;
    return "offline";
};

const formatLastActiveShort = (updatedAt, isOnline) => {
    if (isOnline) return "";
    if (!updatedAt) return "offline";
    const diffMs = Date.now() - new Date(updatedAt).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "vừa xong";
    if (diffMins < 60) return `${diffMins} phút`;
    if (diffHours < 24) return `${diffHours} giờ`;
    if (diffDays < 30) return `${diffDays} ngày`;
    return "offline";
};

const stripHtmlTags = (str) => {
    if (!str) return "";
    return str.replace(/<[^>]*>/g, "");
};

const getMessagePreview = (msg) => {
    if (!msg) return "";
    if (msg.isRecalled) return "Tin nhắn đã thu hồi";
    if (msg.image) return "[Hình ảnh]";
    if (msg.file && msg.file.url) return `[Tệp đính kèm] ${msg.file.name || ""}`;
    return stripHtmlTags(msg.text || "");
};

const Sidebar = () => {
    const {
        getUsers,
        users,
        selectedUser,
        setSelectedUser,
        isUsersLoading,
        unreadCounts
    } = useChatStore();

    const { onlineUsers, authUser } = useAuthStore();
    const [showOnlineOnly, setShowOnlineOnly] = useState(false);
    const [pinnedToggle, setPinnedToggle] = useState(false);

    useEffect(() => {
        const handlePinnedChanged = () => setPinnedToggle(prev => !prev);
        window.addEventListener("pinnedConversationsChanged", handlePinnedChanged);
        return () => window.removeEventListener("pinnedConversationsChanged", handlePinnedChanged);
    }, []);

    useEffect(() => {
        getUsers();
    }, [getUsers]);

    const filteredUsers = (showOnlineOnly ? users.filter((user) => onlineUsers.includes(user._id)) : users)
        .filter(user => {
            if (!authUser) return true;
            return localStorage.getItem(`deleted_chat_${authUser._id}_${user._id}`) !== "true";
        })
        .sort((a, b) => {
            if (!authUser) return 0;
            const aPinned = localStorage.getItem(`pin_conv_${authUser._id}_${a._id}`) === "true";
            const bPinned = localStorage.getItem(`pin_conv_${authUser._id}_${b._id}`) === "true";
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0;
        });

    if (isUsersLoading) {
        return <SidebarSkeleton />;
    }

    return (
        <aside className="h-full w-20 lg:w-72 border-r border-base-300
            flex flex-col transition-all duration-200">
            <div className="border-b border-base-300 w-full p-5">
                <div className="flex items-center gap-2">
                    <Users className="size-6" />
                    <span className="font-medium">Liên hệ</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <label className="cursor-pointer flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={showOnlineOnly}
                            onChange={(e) => setShowOnlineOnly(e.target.checked)}
                            className="checkbox checkbox-sm"
                        />
                        <span className="text-sm">Show online only</span>
                    </label>

                    <span className="text-xs text-zinc-500">
                        ({onlineUsers.length - 1} online)
                    </span>
                </div>
            </div>
            {/* Users List */}
            <div className="overflow-y-auto w-full py-3">
                {filteredUsers.map((user) => {
                    const isMuted = authUser && localStorage.getItem(`muted_${authUser._id}_${user._id}`) === "true";
                    const isPinned = authUser && localStorage.getItem(`pin_conv_${authUser._id}_${user._id}`) === "true";
                    return (
                        <button
                            key={user._id}
                            onClick={() => setSelectedUser(user)}
                        className={`
        w-full p-3 flex items-center gap-3 
        hover:bg-base-300 transition-colors
        ${selectedUser?._id === user._id
                                ? "bg-base-300 ring-1 ring-base-300"
                                : ""}
      `}
                    >
                        {/* Avatar */}
                        <div className="relative mx-auto lg:mx-0">
                            <img
                                src={user.profilePic || "/avatar.png"}
                                alt={user.name || user.fullName}
                                className="size-12 object-cover rounded-full"
                            />

                            {/* Online Status */}
                            {onlineUsers.includes(user._id) && (
                                <span
                                    className="absolute bottom-0.5 right-0.5 size-3 bg-green-500 rounded-full z-10"
                                />
                            )}

                            {/* Small screen unread badge (absolute top-right of avatar) */}
                            {isMuted ? (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center size-5 bg-base-300 text-base-content/60 rounded-full shadow-sm z-20 lg:hidden">
                                    <BellOff className="size-3" />
                                </span>
                            ) : unreadCounts[user._id] > 0 ? (
                                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm z-20 lg:hidden animate-pulse">
                                    {unreadCounts[user._id] > 5 ? "5+" : unreadCounts[user._id]}
                                </span>
                            ) : null}
                        </div>

                        {/* User Info - only visible on larger screens */}
                        <div className="hidden lg:flex items-center justify-between text-left min-w-0 flex-1">
                            {/* Left Side: Name and Last Message Preview or Status */}
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm text-base-content truncate">
                                    {user.fullName}
                                </div>
                                <div className="text-xs text-zinc-400 truncate mt-0.5 max-w-[170px]">
                                    {user.lastMessage ? (
                                        getMessagePreview(user.lastMessage)
                                    ) : (
                                        formatLastActive(user.updatedAt, onlineUsers.includes(user._id))
                                    )}
                                </div>
                            </div>
                            
                            {/* Right Side: Message Time and Unread Badge */}
                            <div className="flex flex-col items-end justify-between ml-2 h-10 select-none">
                                <div className="text-[10px] text-zinc-400">
                                    {formatLastActiveShort(user.updatedAt, onlineUsers.includes(user._id))}
                                </div>
                                {isMuted ? (
                                    <div className="flex items-center justify-center mr-2 gap-1.5">
                                        {isPinned && <Pin className="size-3 text-slate-400 fill-slate-400" />}
                                        <BellOff className="size-4 text-zinc-400" />
                                    </div>
                                ) : unreadCounts[user._id] > 0 ? (
                                    <div className="flex items-center mr-2 gap-1.5">
                                        {isPinned && <Pin className="size-3 text-slate-400 fill-slate-400" />}
                                        <span className="flex items-center justify-center min-w-5 h-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm animate-pulse">
                                            {unreadCounts[user._id] > 5 ? "5+" : unreadCounts[user._id]}
                                        </span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-end mr-2">
                                        {isPinned && <Pin className="size-3 text-slate-400 fill-slate-400" />}
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                ); })}
            </div>


        </aside >
    );
};

export default Sidebar;