import { X, Search, Info, UserPlus, Loader2, UserMinus, Phone, MessageSquare, LogOut, Pencil, Globe, FileText, Link2, Camera, Target } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import { GroupAvatar } from "./GroupAvatar";

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

const ChatHeader = ({ onToggleSearch, isSearchOpen, onToggleSidebar, isSidebarOpen, onOpenAddMember }) => {
    const { selectedUser, setSelectedUser, leaveGroup, messages, updateGroup } = useChatStore();
    const { onlineUsers, authUser, unfriend } = useAuthStore();
    
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    
    const isGroup = selectedUser?.isGroup;
    const isFriend = !isGroup && authUser?.friends?.some(id => (typeof id === "object" ? id._id : id).toString() === selectedUser?._id?.toString());

    return (
        <div className="p-3 border-b border-base-300 bg-base-100/90 backdrop-blur-sm select-none relative">
            <div className="flex items-center justify-between">
                {/* Clickable Info Area */}
                <div 
                    onClick={() => setIsInfoModalOpen(true)}
                    className="flex items-center gap-3 cursor-pointer hover:bg-base-200/50 p-1 rounded-xl transition-all min-w-0 flex-1 mr-2"
                    title="Xem thông tin chi tiết"
                >
                    {/* Avatar */}
                    <div className="avatar relative flex-shrink-0">
                        <div className="size-10 flex items-center justify-center">
                            <GroupAvatar user={selectedUser} size="size-10" />
                        </div>
                        {!isGroup && isFriend && onlineUsers.includes(selectedUser._id) && (
                            <span className="absolute bottom-0.5 right-0.5 size-2.5 bg-green-500 rounded-full z-10 ring-2 ring-white"></span>
                        )}
                    </div>

                    {/* User info */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-base-content truncate">{selectedUser.fullName}</h3>
                            {!isGroup && !isFriend && (
                                <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Người lạ</span>
                            )}
                            {isGroup && (
                                <span className="bg-primary/10 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Nhóm</span>
                            )}
                        </div>
                        <p className="text-xs text-base-content/50 truncate mt-0.5">
                            {isGroup ? (
                                `Nhóm • ${selectedUser.members?.length || 0} thành viên`
                            ) : isFriend ? (
                                formatLastActive(selectedUser.updatedAt, onlineUsers.includes(selectedUser._id))
                            ) : (
                                "Chưa kết bạn (Không chia sẻ trạng thái hoạt động)"
                            )}
                        </p>
                    </div>
                </div>

                {/* Header Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Add member button (Only for groups) */}
                    {isGroup && (
                        <button
                            onClick={onOpenAddMember}
                            className="btn btn-ghost btn-circle btn-sm text-primary hover:bg-primary/10"
                            title="Thêm người vào nhóm"
                        >
                            <UserPlus className="size-4" />
                        </button>
                    )}

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

            {/* Detailed Account/Group Info Modal */}
            {isInfoModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-fade-in p-4 select-none">
                    <div className="bg-white text-slate-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-scale-up flex flex-col relative max-h-[90vh]">
                        {/* Title Header */}
                        <div className="p-4 flex items-center justify-between sticky top-0 bg-white z-10">
                            <h3 className="font-bold text-[17px] text-slate-800">
                                {isGroup ? "Thông tin nhóm" : "Thông tin tài khoản"}
                            </h3>
                            <button 
                                onClick={() => setIsInfoModalOpen(false)}
                                className="btn btn-ghost btn-circle btn-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Modal Body (Scrollable) */}
                        <div className="flex-1 overflow-y-auto pb-4">
                            {/* Avatar & Name & Button */}
                            <div className="px-4 pt-2 pb-4">
                                <div className="flex items-center gap-4">
                                    <div className="relative flex-shrink-0">
                                        <div className="size-16 rounded-full border border-slate-200 overflow-hidden shadow-sm flex items-center justify-center bg-white">
                                            <GroupAvatar user={selectedUser} size="size-16" />
                                        </div>
                                        {isGroup && (
                                            <button className="absolute bottom-0 right-0 size-6 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow hover:bg-slate-50">
                                                <Camera className="size-3.5 text-slate-600" />
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <h4 className="font-bold text-[18px] text-slate-800 truncate">
                                            {selectedUser.fullName}
                                        </h4>
                                        {isGroup && (
                                            <button 
                                                onClick={() => {
                                                    const newName = prompt("Nhập tên nhóm mới:", selectedUser.fullName);
                                                    if (newName && newName.trim() && newName !== selectedUser.fullName) {
                                                        updateGroup(selectedUser._id, { name: newName.trim() });
                                                    }
                                                }}
                                                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-800 flex-shrink-0"
                                            >
                                                <Pencil className="size-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4">
                                    {isGroup ? (
                                        <button 
                                            onClick={() => {
                                                setIsInfoModalOpen(false);
                                                const editor = document.querySelector('[contenteditable="true"]');
                                                if (editor) editor.focus();
                                            }}
                                            className="w-full btn bg-slate-200 text-slate-800 hover:bg-slate-300 border-none rounded-lg font-semibold text-[15px] h-10 min-h-10"
                                        >
                                            Nhắn tin
                                        </button>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-2">
                                            <button 
                                                onClick={() => {
                                                    setIsInfoModalOpen(false);
                                                    const editor = document.querySelector('[contenteditable="true"]');
                                                    if (editor) editor.focus();
                                                }}
                                                className="btn bg-slate-200 text-slate-800 hover:bg-slate-300 border-none rounded-lg font-semibold text-[14px] h-10 min-h-10"
                                            >
                                                Nhắn tin
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    toast.success("Tính năng gọi điện đang được tích hợp. Vui lòng quay lại sau!", { icon: "📞" });
                                                }}
                                                className="btn bg-slate-700 text-white hover:bg-slate-800 border-none rounded-lg font-semibold text-[14px] h-10 min-h-10 flex items-center justify-center gap-1.5"
                                            >
                                                <Phone className="size-4" />
                                                Gọi điện
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Group details or Personal details */}
                            {isGroup ? (
                                <>
                                    {/* Members section */}
                                    <div className="border-t-[8px] border-slate-100 p-4">
                                        <h5 className="font-bold text-[15px] text-slate-800 mb-3">
                                            Thành viên ({selectedUser.members?.length || 0})
                                        </h5>
                                        <div className="flex items-center -space-x-2">
                                            {selectedUser.members?.slice(0, 5).map((member, index) => {
                                                const mId = typeof member === "object" ? member._id : member;
                                                const mPic = typeof member === "object" ? member.profilePic : "/avatar.png";
                                                const mName = typeof member === "object" ? member.fullName : `Thành viên #${index + 1}`;
                                                return (
                                                    <img 
                                                        key={mId}
                                                        src={mPic || "/avatar.png"} 
                                                        alt={mName} 
                                                        className="size-11 rounded-full object-cover border-[3px] border-white relative z-0 hover:z-10 bg-white cursor-pointer"
                                                        title={mName}
                                                        onClick={() => {
                                                            if (typeof member === "object") setSelectedUser(member);
                                                        }}
                                                    />
                                                );
                                            })}
                                            {selectedUser.members?.length > 5 && (
                                                <button 
                                                    onClick={() => {
                                                        setIsInfoModalOpen(false);
                                                        if (!isSidebarOpen) onToggleSidebar();
                                                    }}
                                                    className="size-11 rounded-full bg-slate-200 border-[3px] border-white flex items-center justify-center relative z-10 hover:bg-slate-300 transition-colors"
                                                >
                                                    <div className="flex gap-0.5">
                                                        <div className="size-1 rounded-full bg-slate-600"></div>
                                                        <div className="size-1 rounded-full bg-slate-600"></div>
                                                        <div className="size-1 rounded-full bg-slate-600"></div>
                                                    </div>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {/* Personal Info section */}
                                    <div className="border-t-[8px] border-slate-100 p-4">
                                        <h5 className="font-bold text-[15px] text-slate-800 mb-4 uppercase text-[12px] tracking-wider text-slate-500">
                                            Thông tin cá nhân
                                        </h5>
                                        <div className="space-y-4 text-[14px]">
                                            <div className="grid grid-cols-[100px_1fr]">
                                                <span className="text-slate-500">Điện thoại</span>
                                                <span className="font-medium text-slate-800">
                                                    {selectedUser.phoneNumber 
                                                        ? selectedUser.phoneNumber.replace(/(.{4})(.*)(.{3})/, (m, p1, p2, p3) => p1 + p2.replace(/./g, '*') + p3) 
                                                        : "Chưa cập nhật"
                                                    }
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-[100px_1fr]">
                                                <span className="text-slate-500">Email</span>
                                                <span className="font-medium text-slate-800 truncate pr-2">
                                                    {selectedUser.email 
                                                        ? selectedUser.email.replace(/(.{2})(.*)(?=@)/, (m, p1, p2) => p1 + p2.replace(/./g, '*')) 
                                                        : "Chưa cập nhật"
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Shared Photos Section */}
                            <div className="border-t-[8px] border-slate-100 p-4">
                                <h5 className="font-bold text-[15px] text-slate-800 mb-3">
                                    Ảnh/Video đã chia sẻ
                                </h5>
                                {(() => {
                                    const sharedImages = (messages || []).filter(m => m.image);
                                    if (sharedImages.length === 0) {
                                        return (
                                            <p className="text-[13px] text-slate-400 italic">
                                                Chưa có ảnh nào được chia sẻ
                                            </p>
                                        );
                                    }
                                    return (
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {sharedImages.slice(0, 3).map((msg) => (
                                                <div 
                                                    key={msg._id} 
                                                    className="group/item relative aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                                                >
                                                    <img 
                                                        src={msg.image} 
                                                        alt="shared" 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                    {/* Hover options */}
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                                                        <button 
                                                            onClick={() => {
                                                                setIsInfoModalOpen(false);
                                                                window.dispatchEvent(new CustomEvent("open-image-viewer", { detail: msg.image }));
                                                            }}
                                                            className="size-7 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                                                            title="Xem ảnh"
                                                        >
                                                            <Search className="size-3.5 text-slate-800" />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setIsInfoModalOpen(false);
                                                                const element = document.getElementById(`msg-${msg._id}`);
                                                                if (element) {
                                                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    element.classList.add('bg-blue-200/50');
                                                                    setTimeout(() => element.classList.remove('bg-blue-200/50'), 2000);
                                                                }
                                                            }}
                                                            className="size-7 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                                                            title="Xem tin nhắn gốc"
                                                        >
                                                            <Target className="size-3.5 text-slate-800" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {sharedImages.length > 3 ? (
                                                <div 
                                                    onClick={() => {
                                                        setIsInfoModalOpen(false);
                                                        if (!isSidebarOpen) onToggleSidebar();
                                                    }}
                                                    className="aspect-square bg-[#e1f0ff] rounded-lg flex items-center justify-center text-[#0068ff] cursor-pointer hover:bg-[#cbe3ff] transition-colors shadow-sm"
                                                >
                                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                                                </div>
                                            ) : sharedImages.length === 4 ? (
                                                <div 
                                                    key={sharedImages[3]._id} 
                                                    className="group/item relative aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm"
                                                >
                                                    <img 
                                                        src={sharedImages[3].image} 
                                                        alt="shared" 
                                                        className="w-full h-full object-cover" 
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                                                        <button 
                                                            onClick={() => {
                                                                setIsInfoModalOpen(false);
                                                                window.dispatchEvent(new CustomEvent("open-image-viewer", { detail: sharedImages[3].image }));
                                                            }}
                                                            className="size-7 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                                                            title="Xem ảnh"
                                                        >
                                                            <Search className="size-3.5 text-slate-800" />
                                                        </button>
                                                        <button 
                                                            onClick={() => {
                                                                setIsInfoModalOpen(false);
                                                                const element = document.getElementById(`msg-${sharedImages[3]._id}`);
                                                                if (element) {
                                                                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                    element.classList.add('bg-blue-200/50');
                                                                    setTimeout(() => element.classList.remove('bg-blue-200/50'), 2000);
                                                                }
                                                            }}
                                                            className="size-7 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform shadow-md"
                                                            title="Xem tin nhắn gốc"
                                                        >
                                                            <Target className="size-3.5 text-slate-800" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Shared Files Section (Both Group & Personal) */}
                            <div className="border-t-[8px] border-slate-100 p-4">
                                <h5 className="font-bold text-[15px] text-slate-800 mb-3">
                                    Tệp tin đã chia sẻ
                                </h5>
                                {(() => {
                                    const sharedFiles = (messages || []).filter(m => m.file && m.file.url).slice(0, 2);
                                    if (sharedFiles.length === 0) {
                                        return (
                                            <p className="text-[13px] text-slate-400 italic">
                                                Chưa chia sẻ tệp tin nào
                                            </p>
                                        );
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {sharedFiles.map((msg, index) => (
                                                <a 
                                                    key={index}
                                                    href={msg.file.url} 
                                                    download={msg.file.name}
                                                    className="flex items-center gap-3 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700 transition-colors"
                                                >
                                                    <FileText className="size-4 text-[#0068ff] flex-shrink-0" />
                                                    <span className="truncate flex-1 font-medium">{msg.file.name}</span>
                                                </a>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Shared Links Section (Both Group & Personal) */}
                            <div className="border-t-[8px] border-slate-100 p-4">
                                <h5 className="font-bold text-[15px] text-slate-800 mb-3">
                                    Liên kết đã chia sẻ
                                </h5>
                                {(() => {
                                    const sharedLinks = (messages || []).filter(m => m.text && m.text.match(/(https?:\/\/[^\s]+)/gi)).slice(0, 2);
                                    if (sharedLinks.length === 0) {
                                        return (
                                            <p className="text-[13px] text-slate-400 italic">
                                                Chưa chia sẻ liên kết nào
                                            </p>
                                        );
                                    }
                                    return (
                                        <div className="space-y-2">
                                            {sharedLinks.map((msg, index) => {
                                                const url = msg.text.match(/(https?:\/\/[^\s]+)/gi)?.[0] || "#";
                                                return (
                                                    <a 
                                                        key={index}
                                                        href={url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-3 p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm text-[#0068ff] transition-colors"
                                                    >
                                                        <Link2 className="size-4 flex-shrink-0" />
                                                        <span className="truncate flex-1 hover:underline font-medium">{url}</span>
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Footer Actions (Group) */}
                            {isGroup && (
                                <div className="border-t-[8px] border-slate-100 py-2">
                                    <div 
                                        onClick={async () => {
                                            const amICreator = selectedUser.creator === authUser?._id || selectedUser.creator?._id === authUser?._id;
                                            if (amICreator) {
                                                toast.error("Trưởng nhóm phải bàn giao quyền trưởng nhóm trước khi rời!");
                                                setIsInfoModalOpen(false);
                                                if (!isSidebarOpen) onToggleSidebar();
                                            } else {
                                                if (window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này?")) {
                                                    await leaveGroup(selectedUser._id);
                                                    setIsInfoModalOpen(false);
                                                }
                                            }
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 hover:bg-red-50 cursor-pointer transition-colors"
                                    >
                                        <LogOut className="size-5 text-red-500" />
                                        <p className="text-[15px] font-medium text-red-500">Rời nhóm</p>
                                    </div>
                                </div>
                            )}

                            {/* Unfriend (Personal only) */}
                            {!isGroup && isFriend && (
                                <div className="border-t-[8px] border-slate-100 p-4">
                                    <button 
                                        onClick={async () => {
                                            if (window.confirm(`Bạn có chắc chắn muốn hủy kết bạn với ${selectedUser.fullName}?`)) {
                                                await unfriend(selectedUser._id);
                                                setIsInfoModalOpen(false);
                                            }
                                        }}
                                        className="w-full flex items-center justify-center gap-1.5 p-2 bg-red-50 hover:bg-red-100 text-red-600 transition-colors text-[14px] font-bold rounded-lg h-10"
                                    >
                                        <UserMinus className="size-4" />
                                        Hủy kết bạn
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};

export default ChatHeader;