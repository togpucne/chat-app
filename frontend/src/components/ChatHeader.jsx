import { X, Search, Info, UserPlus, Loader2, UserMinus, Phone, Video, MessageSquare, LogOut, Pencil, Globe, FileText, Link2, Camera, Target } from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
    const { selectedUser, setSelectedUser, leaveGroup, messages, updateGroup, initiateCall, groupCalls, joinGroupCall, activeCall, isCreateCallModalOpen, setCreateCallModalOpen } = useChatStore();
    const { onlineUsers, authUser, unfriend } = useAuthStore();
    
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
    const [isUploadingGroupPic, setIsUploadingGroupPic] = useState(false);
    const groupPicInputRef = useRef(null);
    const [callType, setCallType] = useState("video");
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [ticker, setTicker] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTicker((t) => t + 1);
        }, 15000);
        return () => clearInterval(interval);
    }, []);
    
    const handleGroupPicChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedUser?.isGroup) return;
        if (!file.type.startsWith("image/")) {
            toast.error("Vui lòng chọn tệp hình ảnh");
            return;
        }
        setIsUploadingGroupPic(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            try {
                await updateGroup(selectedUser._id, { groupPic: reader.result });
            } finally {
                setIsUploadingGroupPic(false);
                if (groupPicInputRef.current) groupPicInputRef.current.value = "";
            }
        };
        reader.onerror = () => {
            setIsUploadingGroupPic(false);
            toast.error("Không đọc được ảnh");
        };
    };

    const isGroup = selectedUser?.isGroup;
    const isDocuments = selectedUser?.isDocuments;
    const isFriend = !isGroup && !isDocuments && authUser?.friends?.some(id => (typeof id === "object" ? id._id : id).toString() === selectedUser?._id?.toString());

    const ongoingGroupCall = isGroup ? groupCalls[selectedUser?._id] : null;
    const isInGroupCall =
        ongoingGroupCall?.participants?.some(
            (p) => p.userId?.toString() === authUser?._id?.toString()
        ) || (activeCall?.isGroup && activeCall?.receiverId === selectedUser?._id && activeCall?.status === "connected");

    const onlineMemberCount = isGroup
        ? (selectedUser?.members || []).filter((m) => {
              const id = (typeof m === "object" ? m._id : m)?.toString();
              return onlineUsers.some((ou) => ou?.toString() === id);
          }).length
        : 0;

    return (
        <div className="p-3 border-b border-base-300 bg-base-100/90 backdrop-blur-sm select-none relative">
            {ongoingGroupCall && !isInGroupCall && !activeCall && (
                <div className="mb-2 flex items-center justify-between gap-2 rounded-xl bg-green-50 border border-green-200 px-3 py-2 animate-fade-in">
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-green-800">
                            Cuộc gọi {ongoingGroupCall.type === "video" ? "video" : "thoại"} đang diễn ra
                        </p>
                        <p className="text-[11px] text-green-700 truncate">
                            {ongoingGroupCall.participants?.length || 0} người đang tham gia
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => joinGroupCall(selectedUser._id)}
                        className="btn btn-sm bg-green-600 hover:bg-green-700 text-white border-none rounded-lg font-bold shrink-0"
                    >
                        Tham gia
                    </button>
                </div>
            )}
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
                        {!isGroup && !isDocuments && isFriend && onlineUsers.includes(selectedUser._id) && (
                            <span className="absolute bottom-0.5 right-0.5 size-2.5 bg-green-500 rounded-full z-10 ring-2 ring-white"></span>
                        )}
                    </div>

                    {/* User info */}
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-base-content truncate">{selectedUser.fullName}</h3>
                            {!isGroup && !isDocuments && !isFriend && (
                                <span className="bg-slate-200 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Người lạ</span>
                            )}
                            {isGroup && (
                                <span className="bg-primary/10 text-primary text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase flex-shrink-0">Nhóm</span>
                            )}
                        </div>
                        <p className="text-xs text-base-content/50 truncate mt-0.5">
                            {isDocuments ? (
                                "My document"
                            ) : isGroup ? (
                                `${onlineMemberCount} đang hoạt động · ${selectedUser.members?.length || 0} thành viên`
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

                    {/* Audio Call button (hidden for My Documents) */}
                    {!isDocuments && (
                    <button 
                        onClick={() => {
                            if (isGroup) {
                                setCallType("audio");
                                setSelectedMembers([]);
                                setMemberSearchQuery("");
                                setCreateCallModalOpen(true);
                            } else {
                                initiateCall("audio", false);
                            }
                        }}
                        className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content"
                        title="Cuộc gọi thoại"
                    >
                        <Phone className="size-4" />
                    </button>
                    )}

                    {/* Video Call button (hidden for My Documents) */}
                    {!isDocuments && (
                    <button 
                        onClick={() => {
                            if (isGroup) {
                                setCallType("video");
                                setSelectedMembers([]);
                                setMemberSearchQuery("");
                                setCreateCallModalOpen(true);
                            } else {
                                initiateCall("video", false);
                            }
                        }}
                        className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content"
                        title="Cuộc gọi video"
                    >
                        <Video className="size-4" />
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
                                {isDocuments ? "My document" : isGroup ? "Thông tin nhóm" : "Thông tin tài khoản"}
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
                                            <>
                                                <input
                                                    ref={groupPicInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={handleGroupPicChange}
                                                />
                                                <button
                                                    type="button"
                                                    disabled={isUploadingGroupPic}
                                                    onClick={() => groupPicInputRef.current?.click()}
                                                    className="absolute bottom-0 right-0 size-6 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow hover:bg-slate-50 disabled:opacity-60"
                                                    title="Đổi ảnh nhóm"
                                                >
                                                    {isUploadingGroupPic ? (
                                                        <Loader2 className="size-3.5 text-slate-600 animate-spin" />
                                                    ) : (
                                                        <Camera className="size-3.5 text-slate-600" />
                                                    )}
                                                </button>
                                            </>
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
                                    {isDocuments ? (
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
                                    ) : isGroup ? (
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
                                                    setIsInfoModalOpen(false);
                                                    initiateCall("audio", false);
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
                            {isDocuments ? (
                                <div className="border-t-[8px] border-slate-100 p-4">
                                    <p className="text-sm text-slate-600 leading-relaxed">
                                        My document — lưu văn bản, ảnh, link và tệp cá nhân. Chỉ bạn xem được.
                                    </p>
                                </div>
                            ) : isGroup ? (
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

                            {/* Unfriend (Personal only, not My Documents) */}
                            {!isGroup && !isDocuments && isFriend && (
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

            {/* Create Group Call Modal */}
            {isCreateCallModalOpen && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center animate-fade-in p-4 select-none">
                    <div className="bg-white text-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-scale-up flex flex-col max-h-[90vh]">
                        {/* Title Header */}
                        <div className="p-4 flex items-center justify-between border-b border-slate-100">
                            <h3 className="font-bold text-[17px] text-slate-800">Tạo cuộc gọi</h3>
                            <button 
                                onClick={() => setCreateCallModalOpen(false)}
                                className="btn btn-ghost btn-circle btn-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* Search Box */}
                        <div className="p-3 border-b border-slate-100 relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                                <input 
                                    type="text" 
                                    placeholder="Tìm kiếm thành viên" 
                                    value={memberSearchQuery}
                                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder-slate-400"
                                />
                            </div>
                        </div>

                        {/* Alphabetically Grouped Members List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[50vh]">
                            {(() => {
                                const callCandidates = (selectedUser?.members || []).filter(member => {
                                    const mId = typeof member === "object" ? member._id : member;
                                    return mId?.toString() !== authUser?._id?.toString();
                                });

                                const filteredCandidates = callCandidates.filter(member => {
                                    const name = typeof member === "object" ? member.fullName : "Thành viên";
                                    return name.toLowerCase().includes(memberSearchQuery.toLowerCase());
                                });

                                if (filteredCandidates.length === 0) {
                                    return (
                                        <div className="text-center py-8 text-slate-400 text-sm">
                                            Không tìm thấy thành viên phù hợp
                                        </div>
                                    );
                                }

                                const groupedCandidates = filteredCandidates.reduce((acc, member) => {
                                    const name = typeof member === "object" ? member.fullName : "Thành viên";
                                    const firstLetter = name.trim().charAt(0).toUpperCase();
                                    if (!acc[firstLetter]) acc[firstLetter] = [];
                                    acc[firstLetter].push(member);
                                    return acc;
                                }, {});

                                const sortedKeys = Object.keys(groupedCandidates).sort();

                                return sortedKeys.map(key => (
                                    <div key={key} className="space-y-2">
                                        <h4 className="text-[13px] font-bold text-slate-500 pl-1">{key}</h4>
                                        <div className="space-y-1">
                                            {groupedCandidates[key].map(member => {
                                                const mId = typeof member === "object" ? member._id : member;
                                                const mName = typeof member === "object" ? member.fullName : "Thành viên";
                                                const mPic = typeof member === "object" ? member.profilePic : "/avatar.png";
                                                const isSelected = selectedMembers.includes(mId);

                                                return (
                                                    <div 
                                                        key={mId}
                                                        onClick={() => {
                                                            setSelectedMembers(prev => 
                                                                isSelected 
                                                                    ? prev.filter(id => id !== mId)
                                                                    : [...prev, mId]
                                                            );
                                                        }}
                                                        className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors"
                                                    >
                                                        {/* Circular Checkbox */}
                                                        <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'}`}>
                                                            {isSelected && (
                                                                <svg className="size-3 fill-current stroke-current stroke-2" viewBox="0 0 24 24">
                                                                    <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z" />
                                                                </svg>
                                                            )}
                                                        </div>

                                                        {/* Avatar */}
                                                        <img 
                                                            src={mPic || "/avatar.png"} 
                                                            alt={mName} 
                                                            className="size-10 rounded-full object-cover border border-slate-100 shadow-sm"
                                                        />

                                                        {/* Full Name */}
                                                        <span className="font-semibold text-sm text-slate-700">{mName}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* Footer Controls */}
                        <div className="p-4 bg-slate-50 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button 
                                onClick={() => setCreateCallModalOpen(false)}
                                className="btn border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300 rounded-lg px-6 font-semibold text-[14px]"
                            >
                                Hủy
                            </button>
                            <button 
                                disabled={selectedMembers.length === 0}
                                onClick={() => {
                                    setCreateCallModalOpen(false);
                                    initiateCall(callType, true, selectedMembers);
                                }}
                                className={`btn border-none rounded-lg px-6 font-semibold text-[14px] ${selectedMembers.length > 0 ? 'bg-[#0068ff] hover:bg-[#005AE6] text-white' : 'bg-blue-200 text-white cursor-not-allowed shadow-none'}`}
                            >
                                Gọi
                            </button>
                        </div>
                    </div>
                </div>
            , document.body)}
        </div>
    );
};

export default ChatHeader;