import { X, Search, Info } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChatHeader = ({ onToggleSearch, isSearchOpen, onToggleSidebar, isSidebarOpen }) => {
    const { selectedUser, setSelectedUser } = useChatStore();
    const { onlineUsers } = useAuthStore();

    return (
        <div className="p-3 border-b border-base-300 bg-base-100/90 backdrop-blur-sm select-none">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="avatar">
                        <div className="size-10 rounded-full relative">
                            <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                            {onlineUsers.includes(selectedUser._id) && (
                                <span className="absolute bottom-0 right-0 size-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                            )}
                        </div>
                    </div>

                    {/* User info */}
                    <div>
                        <h3 className="font-medium text-sm text-base-content">{selectedUser.fullName}</h3>
                        <p className="text-xs text-base-content/50">
                            {onlineUsers.includes(selectedUser._id) ? "Đang hoạt động" : "Ngoại tuyến"}
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