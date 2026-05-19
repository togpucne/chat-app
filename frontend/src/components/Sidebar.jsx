import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, BellOff, Pin, Search, Phone, X, Loader2, UserPlus, Camera, Check } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { GroupAvatar } from "./GroupAvatar";
import { formatCallSystemText } from "../lib/callMessage";
import { normId } from "../lib/utils";

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
    
    if (msg.text) {
        const callLabel = formatCallSystemText(msg.text);
        if (callLabel) return callLabel;
        return stripHtmlTags(msg.text);
    }
    
    return stripHtmlTags(msg.text || "");
};

const Sidebar = () => {
    const {
        getUsers,
        users,
        selectedUser,
        setSelectedUser,
        isUsersLoading,
        unreadCounts,
        createGroup
    } = useChatStore();

    const { onlineUsers, authUser, acceptFriendRequest, rejectFriendRequest } = useAuthStore();
    const onlineFriendsCount = onlineUsers.filter(id => authUser?.friends?.includes(id)).length;
    const [showOnlineOnly, setShowOnlineOnly] = useState(false);
    const [pinnedToggle, setPinnedToggle] = useState(false);
    const [ticker, setTicker] = useState(0);

    // Group creation states
    const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
    const [groupName, setGroupName] = useState("");
    const [groupPic, setGroupPic] = useState("");
    const [groupSearchQuery, setGroupSearchQuery] = useState("");
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [isCreatingGroup, setIsCreatingGroup] = useState(false);

    const handleGroupPicUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            setGroupPic(reader.result);
        };
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) {
            toast.error("Vui lòng nhập tên nhóm");
            return;
        }
        if (selectedFriends.length < 2) {
            toast.error("Nhóm chat phải có từ 3 thành viên trở lên (bao gồm bạn và ít nhất 2 bạn bè)");
            return;
        }

        setIsCreatingGroup(true);
        try {
            await createGroup({
                name: groupName.trim(),
                members: selectedFriends,
                groupPic: groupPic || null
            });
            setIsCreateGroupModalOpen(false);
            setGroupName("");
            setGroupPic("");
            setSelectedFriends([]);
            setGroupSearchQuery("");
        } catch (err) {
            console.error(err);
        } finally {
            setIsCreatingGroup(false);
        }
    };

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

    useEffect(() => {
        const interval = setInterval(() => {
            setTicker((t) => t + 1);
        }, 15000);
        return () => clearInterval(interval);
    }, []);

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
            
            // Under pinned, sort by last message timestamp descending
            const aTime = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
            const bTime = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
            return bTime - aTime;
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
                        <span>{onlineFriendsCount} online</span>
                    </button>
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsPhoneModalOpen(true)}
                        className="flex-1 btn btn-sm btn-outline border-base-300 hover:border-primary hover:bg-primary/5 hover:text-primary text-xs flex items-center justify-start gap-2 shadow-sm font-normal rounded-lg transition-all"
                    >
                        <Search className="size-3.5 text-base-content/60 flex-shrink-0" />
                        <span className="truncate lg:block hidden">Tìm bạn qua số ĐT...</span>
                        <span className="truncate lg:hidden block">Tìm</span>
                    </button>
                    <button
                        onClick={() => setIsCreateGroupModalOpen(true)}
                        title="Tạo nhóm chat"
                        className="btn btn-sm btn-outline border-base-300 hover:border-primary hover:bg-primary/5 hover:text-primary p-2 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                    >
                        <UserPlus className="size-4" />
                    </button>
                </div>
            </div>
            {/* Users List */}
            <div className="overflow-y-auto w-full py-2 flex-1">
                {(authUser?.friendRequests?.length > 0) && (
          <div className="mb-2">
            <h4 className="font-semibold text-sm mb-1">Lời mời kết bạn</h4>
            {authUser.friendRequests.map(reqId => {
              const reqUser = users.find(u => u._id === reqId);
              if (!reqUser) return null;
              return (
                <div key={reqId} className="flex items-center justify-between p-2 bg-base-200 rounded mb-1">
                  <div className="flex items-center gap-2">
                    <img src={reqUser.profilePic || "/avatar.png"} alt={reqUser.fullName} className="size-8 rounded-full" />
                    <span className="font-medium">{reqUser.fullName}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => acceptFriendRequest(reqId)} className="btn btn-success btn-xs">
                      <UserPlus className="size-3" />
                    </button>
                    <button onClick={() => rejectFriendRequest(reqId)} className="btn btn-error btn-xs">
                      <X className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {filteredUsers.length === 0 ? (
                    <div className="text-center py-8 px-4 text-base-content/40 text-xs italic">
                        Chưa có cuộc trò chuyện nào.<br/>Bấm tìm số điện thoại để kết bạn!
                    </div>
                ) : (
                    filteredUsers.map((user) => {
                        const userKey = normId(user._id);
                        const unread = unreadCounts[userKey] || 0;
                        const isMuted = authUser && localStorage.getItem(`muted_${normId(authUser._id)}_${userKey}`) === "true";
                        const isPinned = authUser && localStorage.getItem(`pin_conv_${normId(authUser._id)}_${userKey}`) === "true";
                        const isFriend = authUser?.friends?.some(
                            (f) => normId(typeof f === "object" ? f._id : f) === userKey
                        );
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
                                    <div className="size-12 flex items-center justify-center">
                                        <GroupAvatar user={user} size="size-12" />
                                    </div>

                                    {/* Online Status (only if friend) */}
                                    {isFriend && onlineUsers.includes(user._id) && (
                                        <span className="absolute bottom-0.5 right-0.5 size-3 bg-green-500 rounded-full z-10 ring-2 ring-white" />
                                    )}

                                    {/* Small screen unread badge */}
                                    {isMuted ? (
                                        <span className="absolute -top-1 -right-1 flex items-center justify-center size-5 bg-base-300 text-base-content/60 rounded-full shadow-sm z-20 lg:hidden">
                                            <BellOff className="size-3" />
                                        </span>
                                    ) : unread > 0 ? (
                                        <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm z-20 lg:hidden animate-pulse">
                                            {unread > 99 ? "99+" : unread > 5 ? "5+" : unread}
                                        </span>
                                    ) : null}
                                </div>

                                {/* User Info */}
                                <div className="hidden lg:flex items-center justify-between text-left min-w-0 flex-1">
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold text-sm text-base-content truncate flex items-center gap-1.5">
                                            <span className="truncate">{user.fullName}</span>
                                            {user.isGroup ? (
                                                <span className="bg-purple-100 text-purple-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase flex-shrink-0 animate-fade-in">Nhóm</span>
                                            ) : !isFriend ? (
                                                <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Người lạ</span>
                                            ) : null}
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
                                        ) : unread > 0 ? (
                                            <div className="flex items-center mr-2 gap-1.5">
                                                {isPinned && <Pin className="size-3 text-slate-400 fill-slate-400" />}
                                                <span className="flex items-center justify-center min-w-5 h-5 px-1.5 bg-red-500 text-white text-[10px] font-black rounded-full shadow-sm animate-pulse">
                                                    {unread > 99 ? "99+" : unread > 5 ? "5+" : unread}
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

            {/* Create Group Modal */}
            {isCreateGroupModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in text-base-content backdrop-blur-sm">
                    <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col h-[550px] overflow-hidden border border-base-300">
                        {/* Header */}
                        <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
                            <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                                <Users className="size-5 text-primary" /> Tạo nhóm
                            </h3>
                            <button 
                                onClick={() => {
                                    setIsCreateGroupModalOpen(false);
                                    setGroupName("");
                                    setGroupPic("");
                                    setSelectedFriends([]);
                                    setGroupSearchQuery("");
                                }}
                                className="btn btn-ghost btn-circle btn-sm text-base-content/60"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        
                        {/* Modal Body */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Side: Friends selection */}
                            <div className="w-3/5 border-r border-base-300 flex flex-col p-4 bg-base-50/50 overflow-hidden">
                                {/* Group Info & Pic */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative group">
                                        <div className="size-14 rounded-full overflow-hidden border-2 border-primary/20 bg-base-200 flex items-center justify-center flex-shrink-0 relative">
                                            {groupPic ? (
                                                <img src={groupPic} alt="Group pic" className="w-full h-full object-cover" />
                                            ) : (
                                                <Camera className="size-6 text-base-content/40" />
                                            )}
                                        </div>
                                        <label htmlFor="group-pic-upload" className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-200">
                                            <Camera className="size-4 text-white" />
                                            <input 
                                                type="file" 
                                                id="group-pic-upload" 
                                                className="hidden" 
                                                accept="image/*" 
                                                onChange={handleGroupPicUpload}
                                            />
                                        </label>
                                    </div>
                                    <input 
                                        type="text" 
                                        value={groupName}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder="Nhập tên nhóm..." 
                                        className="input input-sm border-base-300 focus:border-primary flex-1 text-sm font-semibold rounded-lg bg-base-100"
                                        maxLength={40}
                                    />
                                </div>

                                {/* Friends Search */}
                                <div className="relative mb-3">
                                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                                    <input 
                                        type="text" 
                                        value={groupSearchQuery}
                                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                                        placeholder="Nhập tên người bạn cần tìm..." 
                                        className="input input-sm pl-9 border-base-300 focus:border-primary w-full text-xs rounded-lg bg-base-100"
                                    />
                                </div>

                                {/* Friends List */}
                                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 select-none">
                                    <h4 className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider mb-2">Bạn bè kết bạn</h4>
                                    {users.filter(u => {
                                        const isFriend = authUser?.friends?.includes(u._id);
                                        const matchesSearch = u.fullName.toLowerCase().includes(groupSearchQuery.toLowerCase());
                                        return isFriend && matchesSearch;
                                    }).length === 0 ? (
                                        <div className="text-center py-8 text-xs text-base-content/40 italic">
                                            Không tìm thấy bạn bè phù hợp
                                        </div>
                                    ) : (
                                        users.filter(u => {
                                            const isFriend = authUser?.friends?.includes(u._id);
                                            const matchesSearch = u.fullName.toLowerCase().includes(groupSearchQuery.toLowerCase());
                                            return isFriend && matchesSearch;
                                        }).map((friend) => {
                                            const isChecked = selectedFriends.includes(friend._id);
                                            return (
                                                <div 
                                                    key={friend._id}
                                                    onClick={() => {
                                                        if (isChecked) {
                                                            setSelectedFriends(selectedFriends.filter(id => id !== friend._id));
                                                        } else {
                                                            setSelectedFriends([...selectedFriends, friend._id]);
                                                        }
                                                    }}
                                                    className="flex items-center gap-3 p-2 hover:bg-base-200 border border-transparent hover:border-base-300 rounded-xl cursor-pointer transition-all"
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked}
                                                        onChange={() => {}} // click handler is on parent
                                                        className="checkbox checkbox-primary checkbox-sm rounded-full flex-shrink-0 pointer-events-none"
                                                    />
                                                    <img 
                                                        src={friend.profilePic || "/avatar.png"} 
                                                        alt="avatar" 
                                                        className="size-9 rounded-full object-cover border border-base-300"
                                                    />
                                                    <span className="text-xs font-semibold truncate flex-1">{friend.fullName}</span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Right Side: Selected items */}
                            <div className="w-2/5 flex flex-col p-4 overflow-hidden bg-base-100">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-xs font-bold text-base-content/75">Đã chọn ({selectedFriends.length})</span>
                                    {selectedFriends.length > 0 && (
                                        <button 
                                            onClick={() => setSelectedFriends([])}
                                            className="text-[10px] text-primary hover:underline font-bold"
                                        >
                                            Xóa tất cả
                                        </button>
                                    )}
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                                    {selectedFriends.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                            <p className="text-xs text-base-content/40 italic">Chưa chọn thành viên nào</p>
                                        </div>
                                    ) : (
                                        selectedFriends.map(id => {
                                            const friend = users.find(u => u._id === id);
                                            if (!friend) return null;
                                            return (
                                                <div 
                                                    key={id}
                                                    className="flex items-center gap-2 p-1.5 bg-primary/5 border border-primary/10 rounded-xl"
                                                >
                                                    <img 
                                                        src={friend.profilePic || "/avatar.png"} 
                                                        alt="avatar" 
                                                        className="size-7 rounded-full object-cover"
                                                    />
                                                    <span className="text-[11px] font-bold truncate flex-1 text-primary">{friend.fullName}</span>
                                                    <button 
                                                        onClick={() => setSelectedFriends(selectedFriends.filter(item => item !== id))}
                                                        className="btn btn-ghost btn-circle btn-xs text-primary hover:bg-primary/10"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-base-300 flex justify-end gap-2 bg-base-200/30">
                            <button 
                                onClick={() => {
                                    setIsCreateGroupModalOpen(false);
                                    setGroupName("");
                                    setGroupPic("");
                                    setSelectedFriends([]);
                                    setGroupSearchQuery("");
                                }}
                                className="btn btn-ghost btn-sm text-xs font-semibold px-4"
                            >
                                Hủy
                            </button>
                            <button 
                                onClick={handleCreateGroup}
                                disabled={isCreatingGroup || !groupName.trim() || selectedFriends.length === 0}
                                className="btn btn-primary btn-sm text-white font-extrabold px-6 shadow-md"
                            >
                                {isCreatingGroup ? <Loader2 className="size-4 animate-spin" /> : "Tạo nhóm"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
};

export default Sidebar;