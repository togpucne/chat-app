import { X, Search, Info } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const formatLastActive = (updatedAt, isOnline) => {
    if (isOnline) return "Đang hoạt động";
    if (!updatedAt) return "offline";
    
    const diffMs = Date.now() - new Date(updatedAt).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Vừa mới truy cập";
    if (diffMins < 60) return `Truy cập ${diffMins} phút trước`;
    if (diffHours < 24) return `Truy cập ${diffHours} giờ trước`;
    if (diffDays < 30) return `Truy cập ${diffDays} ngày trước`;
    return "offline";
};

const ChatHeader = ({ onToggleSearch, isSearchOpen, onToggleSidebar, isSidebarOpen }) => {
    const { selectedUser, setSelectedUser } = useChatStore();
    const { onlineUsers, authUser } = useAuthStore();
    const isFriend = authUser?.friends?.includes(selectedUser._id);

    return (
        <div className="p-3 border-b border-base-300 bg-base-100/90 backdrop-blur-sm select-none">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="avatar relative flex-shrink-0">
                        <div className="size-10 rounded-full">
                            <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                        </div>
                        {isFriend && onlineUsers.includes(selectedUser._id) && (
                            <span className="absolute bottom-0.5 right-0.5 size-2.5 bg-green-500 rounded-full z-10 ring-2 ring-white"></span>
                        )}
                    </div>

                    {/* User info */}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm text-base-content truncate">{selectedUser.fullName}</h3>
                            {!isFriend && (
                                <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Người lạ</span>
                            )}
                        </div>
                        <p className="text-xs text-base-content/50 truncate">
                            {isFriend 
                                ? formatLastActive(selectedUser.updatedAt, onlineUsers.includes(selectedUser._id))
                                : "Chưa kết bạn (Không chia sẻ trạng thái hoạt động)"}
                        </p>
                    </div>
                </div>

                {/* Header Controls */}
                <div className="flex items-center gap-2">
                    {/* Search button */}
                    <button 
                        onClick={onToggleSearch}
                        className={`btn btn-ghost btn-circle btn-sm ${isSearchOpen ? "text-primary bg-primary/10" : "text-base-content/60 hover:text-base-content"}`}
                        title="Tìm kiếm tin nhắn"
                    >
                        <Search className="size-4" />
                    </button>

                    {/* Sidebar Toggle button */}
                    <button 
                        onClick={onToggleSidebar}
                        className={`btn btn-ghost btn-circle btn-sm ${isSidebarOpen ? "text-primary bg-primary/10" : "text-base-content/60 hover:text-base-content"}`}
                        title="Thông tin hội thoại"
                    >
                        <Info className="size-4" />
                    </button>

                    <div className="w-[1px] h-4 bg-base-300 mx-1"></div>

                    {/* Close button */}
                    <button 
                        onClick={() => setSelectedUser(null)}
                        className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content"
                        title="Đóng chat"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatHeader;