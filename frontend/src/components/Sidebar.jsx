import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, BellOff, Pin, Search, Phone, X, Loader2, UserPlus } from "lucide-react";
import { axiosInstance } from "../lib/axios";

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

    const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
    const [phoneQuery, setPhoneQuery] = useState("");
    const [searchingPhone, setSearchingPhone] = useState(false);
    const [foundUser, setFoundUser] = useState(null);
    const [searchError, setSearchError] = useState("");

    const handlePhoneSearch = async (e) => {
        e.preventDefault();
        if (!phoneQuery.trim()) return;
        setSearchingPhone(true);
        setFoundUser(null);
        setSearchError("");
        try {
            const res = await axiosInstance.get(`/messages/search-phone?phone=${phoneQuery.trim()}`);
            setFoundUser(res.data);
        } catch (err) {
            setSearchError(err.response?.data?.message || "Không tìm thấy người dùng");
        } finally {
            setSearchingPhone(false);
        }
    };

    useEffect(() => {
        const handleConversationsUpdate = () => setPinnedToggle(prev => !prev);
        window.addEventListener("pinnedConversationsChanged", handleConversationsUpdate);
        window.addEventListener("conversationMutedChanged", handleConversationsUpdate);
        return () => {
            window.removeEventListener("pinnedConversationsChanged", handleConversationsUpdate);
            window.removeEventListener("conversationMutedChanged", handleConversationsUpdate);
        };
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
            flex flex-col transition-all duration-200 select-none">
            <div className="border-b border-base-300 w-full p-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Users className="size-5 font-bold text-primary" />
                        <span className="font-bold text-sm">Liên hệ</span>
                    </div>
                    <button 
                        onClick={() => setShowOnlineOnly(!showOnlineOnly)}
                        title={showOnlineOnly ? "Bấm để hiện tất cả" : "Bấm để lọc người đang online"}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${
                            showOnlineOnly 
                                ? "bg-primary text-white ring-2 ring-primary/30" 
                                : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                    >
                        <span className={`size-2 rounded-full ${showOnlineOnly ? "bg-white" : "bg-green-500 animate-pulse"}`}></span>
                        <span>{onlineUsers.length > 0 ? onlineUsers.length - 1 : 0} online</span>
                    </button>
                </div>
                
                <button 
                    onClick={() => setIsPhoneModalOpen(true)}
                    className="w-full btn btn-sm btn-outline border-base-300 hover:border-primary hover:bg-primary/5 hover:text-primary text-xs flex items-center justify-start gap-2 shadow-sm font-normal rounded-lg transition-all"
                >
                    <Search className="size-3.5 text-base-content/60 flex-shrink-0" />
                    <span className="truncate">Tìm bạn qua số điện thoại...</span>
                </button>
            </div>
            {/* Users List */}
            <div className="overflow-y-auto w-full py-2 flex-1">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 px-4 text-base-content/40 text-xs italic">
                        Chưa có cuộc trò chuyện nào.<br/>Bấm tìm số điện thoại để kết bạn!
                    </div>
                ) : (
                    filteredUsers.map((user) => {
                        const isMuted = authUser && localStorage.getItem(`muted_${authUser._id}_${user._id}`) === "true";
                        const isPinned = authUser && localStorage.getItem(`pin_conv_${authUser._id}_${user._id}`) === "true";
                        const isFriend = authUser?.friends?.includes(user._id);
                        return (
                            <button
                                key={user._id}
                                onClick={() => setSelectedUser(user)}
                                className={`
                                    w-full p-3 flex items-center gap-3 
                                    hover:bg-base-300/60 transition-colors
                                    ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                                `}
                            >
                                {/* Avatar */}
                                <div className="relative mx-auto lg:mx-0 flex-shrink-0">
                                    <img
                                        src={user.profilePic || "/avatar.png"}
                                        alt={user.fullName}
                                        className="size-12 object-cover rounded-full"
                                    />

                                    {/* Online Status (only if friend) */}
                                    {isFriend && onlineUsers.includes(user._id) && (
                                        <span className="absolute bottom-0.5 right-0.5 size-3 bg-green-500 rounded-full z-10 ring-2 ring-white" />
                                    )}

                                    {/* Small screen unread badge */}
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

                                {/* User Info */}
                                <div className="hidden lg:flex items-center justify-between text-left min-w-0 flex-1">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-sm text-base-content truncate flex items-center gap-1.5">
                                            <span className="truncate">{user.fullName}</span>
                                            {!isFriend && (
                                                <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Người lạ</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-zinc-400 truncate mt-0.5 max-w-[170px]">
                                            {user.lastMessage ? (
                                                getMessagePreview(user.lastMessage)
                                            ) : isFriend ? (
                                                formatLastActive(user.updatedAt, onlineUsers.includes(user._id))
                                            ) : (
                                                "Chưa kết bạn"
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-end justify-between ml-2 h-10">
                                        <div className="text-[10px] text-zinc-400">
                                            {isFriend ? formatLastActiveShort(user.updatedAt, onlineUsers.includes(user._id)) : ""}
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
                        );
                    })
                )}
            </div>

            {/* Phone Search Modal */}
            {isPhoneModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 animate-fade-in text-base-content">
                    <div className="bg-base-100 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Phone className="size-5 text-primary" /> Tìm bạn qua số điện thoại
                            </h3>
                            <button 
                                onClick={() => {
                                    setIsPhoneModalOpen(false);
                                    setPhoneQuery("");
                                    setFoundUser(null);
                                    setSearchError("");
                                }}
                                className="btn btn-ghost btn-circle btn-sm text-base-content/60"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        
                        <form onSubmit={handlePhoneSearch} className="p-4 border-b border-base-300 bg-base-50 flex gap-2">
                            <div className="relative flex-1 flex items-center">
                                <Search className="size-4 absolute left-3 text-base-content/40" />
                                <input
                                    type="text"
                                    placeholder="Nhập số điện thoại (10 số)..."
                                    value={phoneQuery}
                                    onChange={(e) => setPhoneQuery(e.target.value)}
                                    className="input input-sm w-full pl-9 bg-base-100 border-base-300 rounded focus:border-primary text-xs"
                                    autoFocus
                                />
                            </div>
                            <button 
                                type="submit" 
                                disabled={searchingPhone || !phoneQuery.trim()}
                                className="btn btn-primary btn-sm text-white font-bold px-4 shadow-sm"
                            >
                                {searchingPhone ? <Loader2 className="size-4 animate-spin" /> : "Tìm"}
                            </button>
                        </form>
                        
                        <div className="p-4 bg-base-100 min-h-[120px] flex flex-col justify-center">
                            {searchingPhone ? (
                                <div className="flex flex-col items-center gap-2 py-6">
                                    <Loader2 className="size-6 text-primary animate-spin" />
                                    <span className="text-xs text-base-content/60">Đang tìm kiếm...</span>
                                </div>
                            ) : foundUser ? (
                                <div 
                                    onClick={() => {
                                        setSelectedUser(foundUser);
                                        setIsPhoneModalOpen(false);
                                        setPhoneQuery("");
                                        setFoundUser(null);
                                    }}
                                    className="flex items-center gap-3 p-3 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-xl cursor-pointer transition-all group shadow-sm"
                                >
                                    <div className="size-12 rounded-full overflow-hidden border border-base-300 flex-shrink-0">
                                        <img src={foundUser.profilePic || "/avatar.png"} alt="avatar" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 font-bold text-sm text-base-content group-hover:text-primary transition-colors truncate">
                                            <span className="truncate">{foundUser.fullName}</span>
                                            <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Người lạ</span>
                                        </div>
                                        <p className="text-xs text-base-content/60 mt-0.5 truncate">Số điện thoại: <span className="font-semibold text-primary">{foundUser.phoneNumber || phoneQuery}</span></p>
                                    </div>
                                </div>
                            ) : searchError ? (
                                <p className="text-center text-xs text-error py-6 italic font-medium">{searchError}</p>
                            ) : (
                                <p className="text-center text-xs text-base-content/40 py-6 italic">Nhập số điện thoại để tìm kiếm liên hệ mới</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;