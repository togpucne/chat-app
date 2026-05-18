import { X, Search, Info } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const formatLastActive = (updatedAt, isOnline) => {
    if (isOnline) return "Đang hoạt động";
    if (!updatedAt) return "Ngoại tuyến";
    
    const diffMs = Date.now() - new Date(updatedAt).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Vừa mới truy cập";
    if (diffMins < 60) return `Truy cập ${diffMins} phút trước`;
    if (diffHours < 24) return `Truy cập ${diffHours} giờ trước`;
    return `Truy cập ${diffDays} ngày trước`;
};

const ChatHeader = ({ onToggleSearch, isSearchOpen, onToggleSidebar, isSidebarOpen }) => {
    const { selectedUser, setSelectedUser } = useChatStore();
    const { onlineUsers } = useAuthStore();

    return (
        <div className="p-3 border-b border-base-300 bg-base-100/90 backdrop-blur-sm select-none">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="avatar relative">
                        <div className="size-10 rounded-full">
                            <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                        </div>
                        {onlineUsers.includes(selectedUser._id) && (
                            <span className="absolute bottom-0.5 right-0.5 size-2.5 bg-green-500 rounded-full z-10"></span>
                        )}
                    </div>

                    {/* User info */}
                    <div>
                        <h3 className="font-medium text-sm text-base-content">{selectedUser.fullName}</h3>
                        <p className="text-xs text-base-content/50">
                            {formatLastActive(selectedUser.updatedAt, onlineUsers.includes(selectedUser._id))}
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