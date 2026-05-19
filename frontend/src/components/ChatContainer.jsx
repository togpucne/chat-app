import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessagesSkeleton from "./skeletons/MessagesSkeleton";
import toast from "react-hot-toast";
import { useAuthStore } from "../store/useAuthStore";
import { GroupAvatar } from "./GroupAvatar";
import { formatMessageTime } from "../lib/utils";
import { MoreVertical, Pin, X, Paperclip, RotateCcw, RotateCw, Download, Search, Trash2, Ban, Bell, BellOff, Link2, FileText, Image, Globe, Check, Calendar, ChevronDown, Reply, Copy, Share2, RefreshCw, Target, CheckSquare, UserPlus, LogOut, UserMinus, Loader2, Users, Pencil, Camera } from "lucide-react";

// Kiểm tra 2 tin nhắn có được gửi ở 2 ngày khác nhau hay không
const isDifferentDay = (msg1, msg2) => {
    if (!msg1 || !msg2) return true;
    const d1 = new Date(msg1.createdAt);
    const d2 = new Date(msg2.createdAt);
    return (
        d1.getDate() !== d2.getDate() ||
        d1.getMonth() !== d2.getMonth() ||
        d1.getFullYear() !== d2.getFullYear()
    );
};

// Định dạng ngày hiển thị ở giữa đoạn chat (Ví dụ: Hôm nay, Hôm qua, T5 14/05/2026)
const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    // Kiểm tra xem có phải là hôm nay
    const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

    // Kiểm tra xem có phải là hôm qua
    const isYesterday =
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();

    if (isToday) {
        return "Hôm nay";
    }
    if (isYesterday) {
        return "Hôm qua";
    }

    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const dayName = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dayName} ${dd}/${mm}/${yyyy}`;
};

// Trích xuất và định dạng chữ đậm/nghiêng/gạch ngang/code hỗ trợ cả HTML từ contenteditable và Markdown cũ
const renderFormattedText = (text, searchQuery = "") => {
    if (!text) return "";
    
    let htmlContent = "";

    // TRƯỜNG HỢP 1: Đây là văn bản Rich HTML được gửi từ ô contenteditable
    // Ta tiến hành lọc bỏ tất cả các thẻ không an toàn (XSS protection) và chỉ giữ lại những thẻ định dạng cơ bản.
    if (text.includes("<") && text.includes(">")) {
        let sanitized = text;

        // Xóa sạch tất cả các thuộc tính nguy hiểm như onload, style, onerror, v.v.
        sanitized = sanitized.replace(/<([a-z0-9]+)\b[^>]*>/gi, (match, tag) => {
            const allowedTags = ["strong", "b", "em", "i", "del", "strike", "code", "br", "span", "div", "p"];
            if (allowedTags.includes(tag.toLowerCase())) {
                return `<${tag.toLowerCase()}>`;
            }
            return "";
        });

        // Xóa hoàn toàn các tag không được phép (như script, iframe, img, v.v.)
        sanitized = sanitized.replace(/<(?!(\/?(strong|b|em|i|del|strike|code|br|span|div|p)\b))[^>]+>/gi, "");

        // Convert URLs starting with http:// or https:// to clickable blue links
        sanitized = sanitized.replace(/(https?:\/\/[^\s<]+)/gi, "<a href='$1' target='_blank' rel='noopener noreferrer' class='text-[#0068ff] font-semibold hover:underline break-all'>$1</a>");

        htmlContent = sanitized;
    } else {
        // TRƯỜNG HỢP 2: Đây là tin nhắn Markdown thô dạng cũ (để giữ tính tương thích ngược)
        let escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Định dạng Bold & Italic kép: ***text*** hoặc ___text___
        escaped = escaped.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
        escaped = escaped.replace(/___(.*?)___/g, "<strong><em>$1</em></strong>");

        // Định dạng Bold: **text** hoặc __text__
        escaped = escaped.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        escaped = escaped.replace(/__(.*?)__/g, "<strong>$1</strong>");

        // Định dạng Italic: *text* hoặc _text_
        escaped = escaped.replace(/\*(.*?)\*/g, "<em>$1</em>");
        escaped = escaped.replace(/_(.*?)_/g, "<em>$1</em>");

        // Định dạng Strikethrough: ~~text~~
        escaped = escaped.replace(/~~(.*?)~~/g, "<del>$1</del>");

        // Định dạng Inline code: `text`
        escaped = escaped.replace(/`(.*?)`/g, "<code class='bg-base-300/85 px-1.5 py-0.5 rounded font-mono text-[11px] text-secondary-content'>$1</code>");

        // Convert URLs starting with http:// or https:// to clickable blue links
        escaped = escaped.replace(/(https?:\/\/[^\s<]+)/gi, "<a href='$1' target='_blank' rel='noopener noreferrer' class='text-[#0068ff] font-semibold hover:underline break-all'>$1</a>");

        htmlContent = escaped;
    }

    // Highlight keyword outside HTML tags safely
    if (searchQuery && searchQuery.trim()) {
        const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(<[^>]*>)|(${escapedQuery})`, "gi");
        htmlContent = htmlContent.replace(regex, (match, tag, textMatch) => {
            if (tag) return tag;
            return `<span class="bg-amber-300 text-amber-950 font-bold px-[2px] rounded-sm">${textMatch}</span>`;
        });
    }

    return <span dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

const ChatContainer = () => {
    const { messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages, unsubscribeFromMessages, deleteMessage, setReplyingTo, pinMessage, reactMessage, clearMessages, users, forwardMessages, removeGroupMember, leaveGroup, addGroupMembers, updateGroup } = useChatStore();
    const { authUser, onlineUsers, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } = useAuthStore();
    const messageEndRef = useRef(null);
    const fileInputRef = useRef(null);

    const [viewingImage, setViewingImage] = useState(null);
    const [rotation, setRotation] = useState(0);

    const [isEditingGroupName, setIsEditingGroupName] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [isUploadingGroupPic, setIsUploadingGroupPic] = useState(false);

    const handleGroupNameUpdate = async () => {
        if (!newGroupName.trim() || newGroupName === selectedUser.fullName) {
            setIsEditingGroupName(false);
            return;
        }
        await updateGroup(selectedUser._id, { name: newGroupName.trim() });
        setIsEditingGroupName(false);
    };

    const handleGroupPicUpdate = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Vui lòng chọn tệp hình ảnh");
            return;
        }

        setIsUploadingGroupPic(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Image = reader.result;
            await updateGroup(selectedUser._id, { groupPic: base64Image });
            setIsUploadingGroupPic(false);
        };
    };

    // Search and Sidebar states
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showAllTextResults, setShowAllTextResults] = useState(false);
    const [showAllFileResults, setShowAllFileResults] = useState(false);

    // Action Sidebar states
    const [isIBlockedHim, setIsIBlockedHim] = useState(false);
    const [isHeBlockedMe, setIsHeBlockedMe] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPinnedConv, setIsPinnedConv] = useState(false);

    // Multi Selection and Forward states
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedMessageIds, setSelectedMessageIds] = useState([]);
    const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
    const [forwardSearchQuery, setForwardSearchQuery] = useState("");
    const [selectedForwardUsers, setSelectedForwardUsers] = useState([]);

    const [isRecipientTyping, setIsRecipientTyping] = useState(false);
    const [typingSenderName, setTypingSenderName] = useState("");
    const recipientTypingTimeoutRef = useRef(null);

    const [showAllSharedImages, setShowAllSharedImages] = useState(false);
    const [showAllSharedFiles, setShowAllSharedFiles] = useState(false);
    const [showAllSharedLinks, setShowAllSharedLinks] = useState(false);

    // Local Add Member states for detail sidebar
    const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
    const [addMemberSearchQuery, setAddMemberSearchQuery] = useState("");
    const [selectedNewMembers, setSelectedNewMembers] = useState([]);
    const [isAddingMembers, setIsAddingMembers] = useState(false);

    // Leave Group Leadership delegation states
    const [isLeaveGroupModalOpen, setIsLeaveGroupModalOpen] = useState(false);
    const [selectedNewLeaderId, setSelectedNewLeaderId] = useState("");

    const handleAddMembersSubmit = async (e) => {
        e.preventDefault();
        if (selectedNewMembers.length === 0) return;
        setIsAddingMembers(true);
        try {
            await addGroupMembers(selectedUser._id, selectedNewMembers);
            setIsAddMemberModalOpen(false);
            setSelectedNewMembers([]);
            setAddMemberSearchQuery("");
        } catch (err) {
            console.error(err);
        } finally {
            setIsAddingMembers(false);
        }
    };

    const friendsNotInGroup = users.filter((u) => {
        if (!u || u.isGroup) return false;
        
        const isUserFriend = authUser?.friends?.some(
            (fId) => (fId?._id || fId)?.toString() === u._id?.toString()
        );
        
        const isAlreadyInGroup = selectedUser?.members?.some(
            (m) => {
                if (!m) return false;
                const mId = typeof m === "object" ? m._id : m;
                return mId?.toString() === u._id?.toString();
            }
        );
        
        const matchesSearch = u.fullName?.toLowerCase().includes(addMemberSearchQuery.toLowerCase());
        return isUserFriend && !isAlreadyInGroup && matchesSearch;
    });

    useEffect(() => {
        if (selectedUser && authUser) {
            setIsEditingGroupName(false);
            setNewGroupName(selectedUser.fullName || "");
            // Load block, mute and pin states
            setIsIBlockedHim(localStorage.getItem(`block_${authUser._id}_${selectedUser._id}`) === "true");
            setIsHeBlockedMe(localStorage.getItem(`block_${selectedUser._id}_${authUser._id}`) === "true");
            setIsMuted(localStorage.getItem(`muted_${authUser._id}_${selectedUser._id}`) === "true");
            setIsPinnedConv(localStorage.getItem(`pin_conv_${authUser._id}_${selectedUser._id}`) === "true");
            
            // Reset typing state immediately upon changing conversation
            setIsRecipientTyping(false);
            if (recipientTypingTimeoutRef.current) {
                clearTimeout(recipientTypingTimeoutRef.current);
            }

            // Clean/Reset deleted chat flag automatically when conversation starts
            localStorage.removeItem(`deleted_chat_${authUser._id}_${selectedUser._id}`);

            // Reset history expansion states
            setShowAllSharedImages(false);
            setShowAllSharedFiles(false);
            setShowAllSharedLinks(false);

            // Listen to real-time block and typing changes
            const socket = useAuthStore.getState().socket;
            if (socket) {
                const handleBlockChange = ({ blockerId, isBlocked }) => {
                    if (blockerId === selectedUser._id) {
                        setIsHeBlockedMe(isBlocked);
                    }
                };

                const handleTypingChange = ({ senderId, isTyping, isGroup, groupId, senderName }) => {
                    if (isGroup) {
                        if (selectedUser.isGroup && groupId === selectedUser._id) {
                            setTypingSenderName(senderName || "Thành viên");
                            setIsRecipientTyping(isTyping);
                            if (isTyping) {
                                if (recipientTypingTimeoutRef.current) {
                                    clearTimeout(recipientTypingTimeoutRef.current);
                                }
                                recipientTypingTimeoutRef.current = setTimeout(() => {
                                    setIsRecipientTyping(false);
                                }, 6000);
                            }
                        }
                    } else {
                        if (!selectedUser.isGroup && senderId === selectedUser._id) {
                            setIsRecipientTyping(isTyping);
                            if (isTyping) {
                                if (recipientTypingTimeoutRef.current) {
                                    clearTimeout(recipientTypingTimeoutRef.current);
                                }
                                recipientTypingTimeoutRef.current = setTimeout(() => {
                                    setIsRecipientTyping(false);
                                }, 6000);
                            }
                        }
                    }
                };

                socket.on("blockStateChanged", handleBlockChange);
                socket.on("typingStateChanged", handleTypingChange);

                return () => {
                    socket.off("blockStateChanged", handleBlockChange);
                    socket.off("typingStateChanged", handleTypingChange);
                    if (recipientTypingTimeoutRef.current) {
                        clearTimeout(recipientTypingTimeoutRef.current);
                    }
                };
            }
        }
    }, [selectedUser, authUser]);

    const handleRotateLeft = () => setRotation((prev) => (prev - 90) % 360);
    const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);
    const handleCloseViewer = () => {
        setViewingImage(null);
        setRotation(0);
    };
    const handleToggleBlock = () => {
        const socket = useAuthStore.getState().socket;
        if (isIBlockedHim) {
            localStorage.removeItem(`block_${authUser._id}_${selectedUser._id}`);
            setIsIBlockedHim(false);
            if (socket) {
                socket.emit("userBlockedRecipient", { blockerId: authUser._id, blockedId: selectedUser._id, isBlocked: false });
            }
        } else {
            localStorage.setItem(`block_${authUser._id}_${selectedUser._id}`, "true");
            setIsIBlockedHim(true);
            if (socket) {
                socket.emit("userBlockedRecipient", { blockerId: authUser._id, blockedId: selectedUser._id, isBlocked: true });
            }
        }
    };
    const handleDownload = async () => {
        try {
            const response = await fetch(viewingImage);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `judo-chat-img-${Date.now()}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            const link = document.createElement("a");
            link.href = viewingImage;
            link.target = "_blank";
            link.download = "image.png";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    useEffect(() => {
        getMessages(selectedUser._id);

        subscribeToMessages();
        return () => unsubscribeFromMessages();

    }, [selectedUser._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

    // Tự động cuộn xuống khi có tin nhắn mới hoặc trạng thái đang nhập thay đổi
    useEffect(() => {
        if (messageEndRef.current) {
            messageEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isRecipientTyping]);

    if (isMessagesLoading) {
        return (
            <div className="flex-1 flex flex-col overflow-auto">
                <ChatHeader />
                <MessagesSkeleton />
                <MessageInput />
            </div>
        );
    }

    // Lọc các tin nhắn chia sẻ theo các định dạng cụ thể (Ảnh, File, Link)
    const sharedImages = messages.filter(msg => msg.image && !msg.isRecalled);
    const sharedFiles = messages.filter(msg => msg.file && msg.file.url && !msg.isRecalled);
    const sharedLinks = messages.filter(msg => {
        if (msg.isRecalled || !msg.text) return false;
        return /https?:\/\/[^\s]+/gi.test(msg.text);
    });

    // Nhóm tin nhắn theo ngày để làm sticky date headers
    const groupMessagesByDate = (msgs) => {
        const groups = {};
        msgs.forEach((msg) => {
            const dateKey = formatDateHeader(msg.createdAt);
            if (!groups[dateKey]) {
                groups[dateKey] = [];
            }
            groups[dateKey].push(msg);
        });
        return groups;
    };

    const textResults = searchQuery.trim() !== "" 
        ? messages.filter(msg => {
            if (msg.isRecalled) return false;
            const hasFile = msg.file && msg.file.url;
            if (msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase()) && !hasFile) return true;
            return false;
          })
        : [];

    const fileResults = searchQuery.trim() !== "" 
        ? messages.filter(msg => {
            if (msg.isRecalled) return false;
            const hasFile = msg.file && msg.file.url;
            if (hasFile && msg.file.name && msg.file.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
            return false;
          })
        : [];

    const getFileColorAndIcon = (filename) => {
        const ext = filename?.split('.').pop()?.toLowerCase();
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
            return { bg: 'bg-purple-100 text-purple-600 border-purple-200', icon: <Paperclip className="size-4" /> };
        }
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
            return { bg: 'bg-violet-100 text-violet-600 border-violet-200', icon: <FileText className="size-4" /> };
        }
        if (['sql', 'db'].includes(ext)) {
            return { bg: 'bg-sky-100 text-sky-600 border-sky-200', icon: <FileText className="size-4" /> };
        }
        if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
            return { bg: 'bg-red-100 text-red-600 border-red-200', icon: <FileText className="size-4" /> };
        }
        return { bg: 'bg-blue-100 text-blue-600 border-blue-200', icon: <FileText className="size-4" /> };
    };

    const formatFileSize = (bytes) => {
        if (!bytes) return "0 KB";
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatMessageDateShort = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "Vừa xong";
        if (diffMins < 60) return `${diffMins} phút`;
        if (diffHours < 24) return `${diffHours} giờ`;
        if (diffDays < 7) return `${diffDays} ngày`;

        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}`;
    };

    const handleJumpToMessage = (messageId) => {
        const element = document.getElementById(`msg-${messageId}`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            
            // Clean, gorgeous Zalo-style fading light blue glow overlay!
            element.classList.add("bg-sky-100/70", "dark:bg-sky-900/30", "scale-[1.015]", "ring-2", "ring-sky-400/40");
            setTimeout(() => {
                element.classList.remove("bg-sky-100/70", "dark:bg-sky-900/30", "scale-[1.015]", "ring-2", "ring-sky-400/40");
            }, 2500);
        }
    };

    const handleEnableSelectionMode = (initialMessage) => {
        setIsSelectionMode(true);
        setSelectedMessageIds([initialMessage._id]);
    };
    
    const handleToggleSelectMessage = (messageId) => {
        setSelectedMessageIds(prev => 
            prev.includes(messageId) 
                ? prev.filter(id => id !== messageId) 
                : [...prev, messageId]
        );
    };

    const handleCopySelected = () => {
        const selectedMsgs = messages
            .filter(m => selectedMessageIds.includes(m._id))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const copyText = selectedMsgs
            .map(m => {
                const name = m.senderId === authUser._id ? authUser.fullName : selectedUser.fullName;
                const time = new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const content = m.isRecalled ? "Tin nhắn đã bị thu hồi" : m.image ? "[Hình ảnh]" : m.file ? `[Tệp tin: ${m.file.name}]` : m.text;
                return `[${time}] ${name}: ${content}`;
            })
            .join("\n");
        
        navigator.clipboard.writeText(copyText);
        toast.success(`Đã sao chép ${selectedMessageIds.length} tin nhắn`);
        setIsSelectionMode(false);
        setSelectedMessageIds([]);
    };

    const handleDeleteSelected = async () => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedMessageIds.length} tin nhắn này phía bạn?`)) {
            try {
                for (const id of selectedMessageIds) {
                    await deleteMessage(id, "me");
                }
                toast.success(`Đã xóa ${selectedMessageIds.length} tin nhắn`);
            } catch (err) {}
            setIsSelectionMode(false);
            setSelectedMessageIds([]);
        }
    };

    const handleRecallSelected = async () => {
        if (window.confirm(`Bạn có chắc muốn thu hồi ${selectedMessageIds.length} tin nhắn này phía mọi người?`)) {
            try {
                for (const id of selectedMessageIds) {
                    await deleteMessage(id, "everyone");
                }
                toast.success(`Đã thu hồi ${selectedMessageIds.length} tin nhắn`);
            } catch (err) {}
            setIsSelectionMode(false);
            setSelectedMessageIds([]);
        }
    };

    const handleForwardSelected = async () => {
        if (selectedForwardUsers.length === 0) return;
        const msgsToForward = messages
            .filter(m => selectedMessageIds.includes(m._id))
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        await forwardMessages(selectedForwardUsers, msgsToForward);
        setIsForwardModalOpen(false);
        setIsSelectionMode(false);
        setSelectedMessageIds([]);
        setSelectedForwardUsers([]);
    };

    const highlightResultText = (text, keyword) => {
        if (!text) return "";
        // Strip HTML tags from the search result preview text!
        const cleanText = text.replace(/<[^>]*>/g, "");
        if (!keyword.trim()) return cleanText;
        const regex = new RegExp(`(${keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");
        const parts = cleanText.split(regex);
        return parts.map((part, index) => 
            part.toLowerCase() === keyword.toLowerCase() 
                ? <span key={index} className="text-[#0068ff] font-bold">{part}</span> 
                : part
        );
    };

    const groupedMessages = groupMessagesByDate(messages);
    const pinnedMessages = messages.filter((m) => m.isPinned && !m.isRecalled);
    const latestPinned = pinnedMessages[pinnedMessages.length - 1];

    const isFriend = authUser?.friends?.includes(selectedUser?._id);
    const hasSentRequest = authUser?.sentRequests?.includes(selectedUser?._id);
    const hasReceivedRequest = authUser?.friendRequests?.includes(selectedUser?._id);

    return (
        <div className="flex-1 flex overflow-hidden bg-base-100">
            {/* Left Area: Main Chat Flow */}
            <div className="flex-1 flex flex-col overflow-hidden relative border-r border-base-300">
                <ChatHeader 
                    onToggleSearch={() => {
                        setIsSearchOpen(!isSearchOpen);
                        setIsSidebarOpen(false);
                    }}
                    isSearchOpen={isSearchOpen}
                    onToggleSidebar={() => {
                        setIsSidebarOpen(!isSidebarOpen);
                        setIsSearchOpen(false);
                    }}
                    isSidebarOpen={isSidebarOpen}
                    onOpenAddMember={() => setIsAddMemberModalOpen(true)}
                />

                {/* Stranger Banner for Friend Requests */}
                {!selectedUser.isGroup && !isFriend && selectedUser && (
                    <div className="bg-amber-50/95 backdrop-blur border-b border-amber-200 p-3 flex items-center justify-between text-xs shadow-sm z-20 select-none animate-fade-in">
                        <div className="flex items-center gap-2 font-medium text-amber-900 min-w-0">
                            <UserPlus className="size-4 text-amber-700 flex-shrink-0" />
                            <span className="truncate font-semibold">
                                {hasReceivedRequest ? `${selectedUser.fullName} đã gửi lời mời kết bạn` : `Gửi yêu cầu kết bạn tới người này`}
                            </span>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                            {hasReceivedRequest ? (
                                <div className="flex items-center gap-1.5">
                                    <button 
                                        onClick={() => acceptFriendRequest(selectedUser._id)}
                                        className="btn btn-primary btn-xs text-white font-bold px-3 shadow-sm"
                                    >
                                        Đồng ý
                                    </button>
                                    <button 
                                        onClick={() => rejectFriendRequest(selectedUser._id)}
                                        className="btn btn-ghost btn-xs text-slate-600 hover:bg-slate-200/60 font-bold px-2.5"
                                    >
                                        Từ chối
                                    </button>
                                </div>
                            ) : hasSentRequest ? (
                                <button 
                                    disabled
                                    className="btn btn-disabled btn-xs text-slate-500 font-bold px-3 border border-slate-200"
                                >
                                    Đã gửi lời mời
                                </button>
                            ) : (
                                <button 
                                    onClick={() => sendFriendRequest(selectedUser._id)}
                                    className="btn btn-primary btn-xs text-white font-bold px-4 shadow-sm"
                                >
                                    Gửi kết bạn
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Pinned Message Banner */}
            {latestPinned && (
                <div 
                    onClick={() => {
                        const element = document.getElementById(`msg-${latestPinned._id}`);
                        if (element) {
                            element.scrollIntoView({ behavior: "smooth", block: "center" });
                            element.classList.add("bg-primary/25");
                            setTimeout(() => {
                                element.classList.remove("bg-primary/25");
                            }, 1500);
                        }
                    }}
                    className="bg-base-200/95 backdrop-blur border-b border-base-300 px-4 py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-base-300/40 transition-colors select-none z-20 animate-fade-in"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <Pin className="size-3.5 text-primary rotate-45 flex-shrink-0 animate-pulse" />
                        <div className="min-w-0">
                            <p className="font-semibold text-primary text-[11px] leading-tight">Tin nhắn ghim</p>
                            <p className="text-base-content/70 truncate text-[11px] max-w-[300px] sm:max-w-[500px] leading-tight mt-0.5">
                                {latestPinned.image ? "[Hình ảnh] " : ""}
                                {latestPinned.file ? `[Tệp tin: ${latestPinned.file.name}] ` : ""}
                                {latestPinned.text || ""}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // Ngăn hành vi cuộn khi click nút đóng
                            pinMessage(latestPinned._id);
                        }}
                        className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content flex items-center justify-center flex-shrink-0"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
                    <div key={dateLabel} className="space-y-4 relative">
                        {/* Date Divider Header */}
                        <div className="flex justify-center my-4">
                            <span className="bg-base-300/90 text-base-content/85 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide shadow-sm border border-base-200/40">
                                {dateLabel}
                            </span>
                        </div>

                        {msgs.map((message, idx) => {
                            const nextMessage = msgs[idx + 1];
                            const isLastInGroup = !nextMessage || 
                                nextMessage.senderId !== message.senderId || 
                                new Date(nextMessage.createdAt).getMinutes() !== new Date(message.createdAt).getMinutes() ||
                                new Date(nextMessage.createdAt).getHours() !== new Date(message.createdAt).getHours() ||
                                new Date(nextMessage.createdAt).getDate() !== new Date(message.createdAt).getDate();

                            const isSystemMessage = selectedUser?.isGroup && (
                                message.text?.startsWith("đã tạo nhóm") || 
                                message.text?.includes("vào nhóm") ||
                                message.text?.includes("khỏi nhóm") ||
                                message.text?.includes("rời khỏi nhóm") ||
                                message.text?.includes("nhường quyền trưởng nhóm") ||
                                message.text?.includes("đổi tên nhóm thành") ||
                                message.text?.includes("cập nhật ảnh đại diện của nhóm")
                            );

                            if (isSystemMessage) {
                                const senderName = (typeof message.senderId === "object" ? message.senderId?._id : message.senderId) === authUser._id
                                    ? "Bạn"
                                    : (typeof message.senderId === "object" ? message.senderId?.fullName : "Thành viên");
                                return (
                                    <div key={message._id} className="flex justify-center my-2 select-none animate-fade-in">
                                        <span className="bg-base-200/80 text-base-content/60 px-3.5 py-1 rounded-full text-[11px] font-medium border border-base-300/30">
                                            {senderName} {message.text}
                                        </span>
                                    </div>
                                );
                            }

                            const isMyMessage = (typeof message.senderId === "object" ? message.senderId?._id : message.senderId) === authUser._id;
                            const senderProfilePic = isMyMessage 
                                ? authUser.profilePic 
                                : (typeof message.senderId === "object" ? message.senderId?.profilePic : selectedUser.profilePic);
                            const senderFullName = isMyMessage 
                                ? authUser.fullName 
                                : (typeof message.senderId === "object" ? message.senderId?.fullName : selectedUser.fullName);

                            return (
                                <div
                                key={message._id}
                                id={`msg-${message._id}`}
                                className={`chat ${isMyMessage ? "chat-end" : "chat-start"} group relative transition-colors duration-500 rounded-xl p-1 ${isSelectionMode ? "hover:bg-slate-100/60 cursor-pointer select-none bg-slate-50/20" : ""}`}
                                onClick={isSelectionMode ? () => handleToggleSelectMessage(message._id) : undefined}
                            >
                                {isSelectionMode && (
                                    <div className="flex items-center justify-center px-1.5 self-center">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedMessageIds.includes(message._id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleToggleSelectMessage(message._id);
                                            }}
                                            className="checkbox checkbox-primary checkbox-xs size-4 border-slate-300 pointer-events-none"
                                        />
                                    </div>
                                )}
                                <div className="chat-image avatar">
                                    <div className="size-10 rounded-full border">
                                        <img
                                            src={senderProfilePic || "/avatar.png"}
                                            alt="Ảnh đại diện"
                                        />
                                    </div>
                                </div>
                                
                                {/* Transparent wrapper grid item to position bubble and dropdown side-by-side without clipping */}
                                <div className="chat-bubble bg-transparent p-0 max-w-[85%] overflow-visible flex items-center gap-2 shadow-none before:hidden after:hidden">
                                    
                                    {/* Action block for sender: Hover reaction panel + dropdown */}
                                    {isMyMessage && !message.isRecalled && (
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            {/* Quick Emoji Reaction Bar */}
                                            <div className="flex items-center bg-white border border-slate-200/80 shadow-md rounded-full px-2 py-1 gap-1 select-none">
                                                {["👍", "❤️", "😂", "😮", "😢", "😡"].map((emoji) => {
                                                    const hasReacted = message.reactions?.some(
                                                        (r) => r.userId.toString() === authUser._id.toString() && r.emoji === emoji
                                                    );
                                                    return (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => reactMessage(message._id, emoji)}
                                                            className={`hover:scale-125 active:scale-95 transition-transform text-base p-0.5 rounded-full ${
                                                                hasReacted ? "bg-blue-100 scale-110" : "hover:bg-slate-100"
                                                            }`}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            
                                            {/* Dropdown Options */}
                                            <div className="dropdown dropdown-top dropdown-end">
                                                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content flex items-center justify-center">
                                                    <MoreVertical className="size-4" />
                                                </div>
                                                <ul tabIndex={0} className="dropdown-content z-[20] menu p-1 shadow-lg bg-base-200 border border-base-300 rounded-box w-36 text-xs text-base-content">
                                                    <li>
                                                        <button onClick={() => setReplyingTo(message)} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            Trả lời
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => pinMessage(message._id)} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            {message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => handleEnableSelectionMode(message)} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            Chọn nhiều tin nhắn
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => deleteMessage(message._id, "me")} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            Xóa ở phía tôi
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => deleteMessage(message._id, "everyone")} className="py-1.5 text-error hover:bg-error/10 rounded-md">
                                                            Thu hồi
                                                        </button>
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}

                                    {/* The Actual Visible Chat Bubble wrapper (relative block to group image + bubble together) */}
                                    <div className={`relative flex flex-col gap-1 max-w-full ${isMyMessage ? "items-end" : "items-start"}`}>
                                        
                                        {/* Group Sender Name */}
                                        {selectedUser.isGroup && !isMyMessage && (
                                            <span className="text-[10px] font-extrabold text-base-content/50 ml-1 mb-0.5 select-none leading-none">
                                                {senderFullName}
                                            </span>
                                        )}
                                        
                                        {/* If there is an image, render it borderless and raw with rounded corners! */}
                                        {message.image && (
                                            <img
                                                src={message.image}
                                                alt="Attachment"
                                                onClick={() => setViewingImage(message.image)}
                                                className="max-w-[280px] sm:max-w-[320px] rounded-2xl cursor-zoom-in hover:opacity-95 transition-opacity shadow-sm border border-slate-200/30"
                                            />
                                        )}

                                        {/* File card - rendered OUTSIDE bubble so file-only messages don't get blue bg */}
                                        {message.file && message.file.url && !message.isRecalled && (() => {
                                            const ext = message.file.name?.split('.').pop()?.toLowerCase() || '';
                                            const fileTypeConfig = {
                                                pdf: { bg: 'bg-red-500', letter: 'PDF', text: 'text-white' },
                                                doc: { bg: 'bg-blue-600', letter: 'W', text: 'text-white' },
                                                docx: { bg: 'bg-blue-600', letter: 'W', text: 'text-white' },
                                                xls: { bg: 'bg-green-600', letter: 'X', text: 'text-white' },
                                                xlsx: { bg: 'bg-green-600', letter: 'X', text: 'text-white' },
                                                ppt: { bg: 'bg-orange-500', letter: 'P', text: 'text-white' },
                                                pptx: { bg: 'bg-orange-500', letter: 'P', text: 'text-white' },
                                                zip: { bg: 'bg-yellow-500', letter: 'ZIP', text: 'text-white' },
                                                rar: { bg: 'bg-yellow-600', letter: 'RAR', text: 'text-white' },
                                                txt: { bg: 'bg-slate-500', letter: 'TXT', text: 'text-white' },
                                            };
                                            const cfg = fileTypeConfig[ext] || { bg: 'bg-slate-400', letter: ext?.toUpperCase().slice(0,3) || '?', text: 'text-white' };
                                            return (
                                                <a
                                                    href={message.file.url}
                                                    download={message.file.name}
                                                    className="flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-800 p-3 rounded-xl border border-slate-200 transition-colors select-none max-w-[260px] text-left shadow-sm"
                                                    title="Bấm để tải tệp về"
                                                >
                                                    <div className={`${cfg.bg} ${cfg.text} size-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm font-bold text-[11px] tracking-wide`}>
                                                        {cfg.letter}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-semibold truncate leading-tight text-slate-800">{message.file.name}</p>
                                                        <p className="text-[11px] text-slate-400 leading-none mt-1">
                                                            {message.file.size ? `${(message.file.size / 1024).toFixed(1)} KB` : "Tệp đính kèm"}
                                                        </p>
                                                    </div>
                                                </a>
                                            );
                                        })()}

                                        {/* Text bubble, reply context, or recalled - standard Zalo colored bubble */}
                                        {(message.text || message.isRecalled || message.replyTo) && (
                                            <div className={`flex flex-col relative py-2.5 px-4 rounded-2xl shadow-sm text-[14px] leading-relaxed max-w-full overflow-visible transition-all duration-200 ${
                                                isMyMessage 
                                                    ? "bg-[#e1f0ff] border border-[#cbe3ff] text-[#081c36] rounded-tr-none" 
                                                    : "bg-white border border-[#e4e6eb] text-[#1c1e21] rounded-tl-none"
                                            } ${message.isRecalled ? "bg-base-200/50 text-base-content/40 italic border-slate-200 shadow-none" : ""} ${message.isPinned ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
                                                
                                                {/* Pinned mini status inside bubble */}
                                                {message.isPinned && (
                                                    <div className="flex items-center gap-1 text-[9px] text-primary/80 font-bold mb-1 select-none uppercase tracking-wider">
                                                        <Pin className="size-2.5 rotate-45 flex-shrink-0 text-primary" />
                                                        <span>Đã ghim</span>
                                                    </div>
                                                )}

                                                {/* Reply Context */}
                                                {message.replyTo && (
                                                    <div 
                                                        onClick={() => {
                                                            const element = document.getElementById(`msg-${message.replyTo._id}`);
                                                            if (element) {
                                                                element.scrollIntoView({ behavior: "smooth", block: "center" });
                                                                element.classList.add("bg-primary/25");
                                                                setTimeout(() => {
                                                                    element.classList.remove("bg-primary/25");
                                                                }, 1500);
                                                            }
                                                        }}
                                                        className="cursor-pointer bg-black/5 hover:bg-black/10 transition-colors text-xs px-2.5 py-1.5 rounded border-l-4 border-primary/70 mb-1.5 opacity-85 flex items-center gap-2 max-w-[200px]"
                                                    >
                                                        {message.replyTo.image && (
                                                            <img 
                                                                src={message.replyTo.image} 
                                                                alt="Replied Attachment" 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setViewingImage(message.replyTo.image);
                                                                }}
                                                                className="w-6 h-6 object-cover rounded border border-base-300 flex-shrink-0 cursor-zoom-in hover:opacity-90 transition-opacity"
                                                            />
                                                        )}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="font-semibold text-primary/80 truncate text-[10px] leading-tight">
                                                                {message.replyTo.senderId?._id === authUser._id 
                                                                    ? "Chính mình" 
                                                                    : message.replyTo.senderId?.fullName || "Người dùng"}
                                                            </p>
                                                            <p className="text-slate-600 truncate text-[10px] leading-tight">
                                                                {message.replyTo.isRecalled 
                                                                    ? "Tin nhắn đã bị thu hồi" 
                                                                    : message.replyTo.image ? "[Hình ảnh]" : message.replyTo.file ? `[Tệp tin: ${message.replyTo.file.name}]` : message.replyTo.text}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {message.isRecalled ? (
                                                    <p className="text-sm py-1">Tin nhắn đã bị thu hồi</p>
                                                ) : (
                                                    <>
                                                        {message.text && (
                                                            <div className="flex flex-col gap-1.5">
                                                                <p className="break-words text-sm whitespace-pre-wrap">
                                                                    {renderFormattedText(message.text, searchQuery)}
                                                                </p>
                                                                
                                                                {/* Link Preview Card */}
                                                                {/https?:\/\/[^\s]+/gi.test(message.text) && (
                                                                    <a href={message.text.match(/(https?:\/\/[^\s]+)/gi)?.[0] || "#"} target="_blank" rel="noopener noreferrer" className="mt-1 border border-slate-200/80 rounded-xl bg-white overflow-hidden shadow-sm max-w-[280px] select-none hover:shadow-md transition-shadow block no-underline text-inherit cursor-pointer">
                                                                        {/* Link Thumbnail */}
                                                                        <div className="h-32 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                                                            <img 
                                                                                src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80" 
                                                                                alt="Link Preview" 
                                                                                className="w-full h-full object-cover"
                                                                            />
                                                                            <div className="absolute top-2 left-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                                                                                Liên kết
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {/* Link Details */}
                                                                        <div className="p-2.5 text-left">
                                                                            <h4 className="text-xs font-bold text-slate-800 line-clamp-1 hover:text-blue-600 transition-colors">
                                                                                {message.text.match(/https?:\/\/(www\.)?([^\/\s]+)/i)?.[2] || "Trang web liên kết"}
                                                                            </h4>
                                                                            <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5 leading-tight">
                                                                                Bấm vào đây để truy cập và xem chi tiết nội dung trang web chia sẻ.
                                                                            </p>
                                                                            <span className="text-[9px] text-blue-500 font-semibold block mt-1.5 truncate">
                                                                                {message.text.match(/(https?:\/\/[^\s]+)/gi)?.[0] || "Liên kết"}
                                                                            </span>
                                                                        </div>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Distinct Emoji Reaction Pill */}
                                        {message.reactions && message.reactions.length > 0 && (
                                            <div className="absolute -bottom-2.5 right-3 flex items-center gap-0.5 bg-white border border-slate-200 shadow-sm rounded-full px-1.5 py-0.5 text-xs select-none z-[5]">
                                                {Array.from(new Set(message.reactions.map(r => r.emoji))).map((emoji, idx) => (
                                                    <span key={idx} className="text-xs">{emoji}</span>
                                                ))}
                                                {message.reactions.length > 1 && (
                                                    <span className="text-[9px] font-bold text-slate-500 ml-0.5">
                                                        {message.reactions.length}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action block for receiver: Hover reaction panel + dropdown */}
                                    {!isMyMessage && !message.isRecalled && (
                                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            {/* Dropdown Options */}
                                            <div className="dropdown dropdown-top dropdown-start">
                                                <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content flex items-center justify-center">
                                                    <MoreVertical className="size-4" />
                                                </div>
                                                <ul tabIndex={0} className="dropdown-content z-[20] menu p-1 shadow-lg bg-base-200 border border-base-300 rounded-box w-36 text-xs text-base-content">
                                                    <li>
                                                        <button onClick={() => setReplyingTo(message)} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            Trả lời
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => pinMessage(message._id)} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            {message.isPinned ? "Bỏ ghim" : "Ghim tin nhắn"}
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => handleEnableSelectionMode(message)} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            Chọn nhiều tin nhắn
                                                        </button>
                                                    </li>
                                                    <li>
                                                        <button onClick={() => deleteMessage(message._id, "me")} className="py-1.5 hover:bg-base-300 rounded-md">
                                                            Xóa ở phía tôi
                                                        </button>
                                                    </li>
                                                </ul>
                                            </div>

                                            {/* Quick Emoji Reaction Bar */}
                                            <div className="flex items-center bg-white border border-slate-200/80 shadow-md rounded-full px-2 py-1 gap-1 select-none">
                                                {["👍", "❤️", "😂", "😮", "😢", "😡"].map((emoji) => {
                                                    const hasReacted = message.reactions?.some(
                                                        (r) => r.userId.toString() === authUser._id.toString() && r.emoji === emoji
                                                    );
                                                    return (
                                                        <button
                                                            key={emoji}
                                                            onClick={() => reactMessage(message._id, emoji)}
                                                            className={`hover:scale-125 active:scale-95 transition-transform text-base p-0.5 rounded-full ${
                                                                hasReacted ? "bg-blue-100 scale-110" : "hover:bg-slate-100"
                                                            }`}
                                                        >
                                                            {emoji}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Time displayed below the bubble (Zalo style) + Status Pill */}
                                {isLastInGroup && (
                                    <div className={`chat-footer text-[10px] mt-1 select-none flex items-center gap-1.5 ${isMyMessage ? "justify-end" : "justify-start"}`}>
                                        <span className="opacity-50">{formatMessageTime(message.createdAt)}</span>
                                        
                                        {/* Zalo Status Pill / Seen Avatar */}
                                        {isMyMessage && (
                                            <>
                                                {message._id === messages[messages.length - 1]?._id ? (
                                                    selectedUser.isGroup ? (
                                                        <span className="inline-flex items-center gap-0.5 bg-slate-200 border border-slate-300 text-slate-700 rounded-full px-1.5 py-[1px] text-[8px] font-semibold">
                                                            <Check className="size-2.5" /> Đã gửi
                                                        </span>
                                                    ) : message.isSeen ? (
                                                        <div className="size-3.5 rounded-full overflow-hidden border border-slate-300 ml-0.5 shadow-sm animate-fade-in flex-shrink-0" title="Đã xem">
                                                            <img src={selectedUser.profilePic || "/avatar.png"} alt="seen" className="w-full h-full object-cover" />
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-0.5 bg-slate-200 border border-slate-300 text-slate-700 rounded-full px-1.5 py-[1px] text-[8px] font-semibold">
                                                            <Check className="size-2.5" /> Đã gửi
                                                        </span>
                                                    )
                                                ) : null}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                ))}

                <div ref={messageEndRef} />
            </div>

            {isRecipientTyping && (
                <div className="px-4 py-2 text-xs text-base-content/50 flex items-center gap-1.5 animate-fade-in select-none bg-base-100">
                    <span className="font-semibold text-primary">
                        {selectedUser.isGroup ? typingSenderName : selectedUser.fullName}
                    </span> đang soạn tin...
                    <span className="flex gap-0.5 items-center justify-center ml-0.5">
                        <span className="size-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1000ms" }}></span>
                        <span className="size-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms", animationDuration: "1000ms" }}></span>
                        <span className="size-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms", animationDuration: "1000ms" }}></span>
                    </span>
                </div>
            )}

            {/* Block Action Banner, Message Input, or Selection Bar */}
            {isSelectionMode ? (
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs select-none animate-slide-up">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center size-5 bg-primary text-white rounded-full font-bold text-[10px]">
                            {selectedMessageIds.length}
                        </span>
                        <span className="font-semibold text-slate-700 text-sm">Đã chọn</span>
                    </div>
                    
                    <div className="flex items-center gap-2.5">
                        <button 
                            onClick={handleCopySelected}
                            disabled={selectedMessageIds.length === 0}
                            className="btn btn-ghost btn-sm text-slate-700 hover:bg-slate-200/80 font-bold gap-1 text-[11px] disabled:opacity-40"
                        >
                            <Copy className="size-3.5" /> Sao chép
                        </button>
                        <button 
                            onClick={() => setIsForwardModalOpen(true)}
                            disabled={selectedMessageIds.length === 0}
                            className="btn btn-ghost btn-sm text-slate-700 hover:bg-slate-200/80 font-bold gap-1 text-[11px] disabled:opacity-40"
                        >
                            <Share2 className="size-3.5 text-blue-600" /> Chia sẻ
                        </button>
                        {selectedMessageIds.every(id => {
                            const msg = messages.find(m => m._id === id);
                            return msg && msg.senderId === authUser._id && !msg.isRecalled;
                        }) && (
                            <button 
                                onClick={handleRecallSelected}
                                disabled={selectedMessageIds.length === 0}
                                className="btn btn-ghost btn-sm text-error hover:bg-error/10 font-bold gap-1 text-[11px] disabled:opacity-40"
                            >
                                <RefreshCw className="size-3.5 text-error" /> Thu hồi
                            </button>
                        )}
                        <button 
                            onClick={handleDeleteSelected}
                            disabled={selectedMessageIds.length === 0}
                            className="btn btn-ghost btn-sm text-error hover:bg-error/10 font-bold gap-1 text-[11px] disabled:opacity-40"
                        >
                            <Trash2 className="size-3.5" /> Xóa
                        </button>
                    </div>
                    
                    <button 
                        onClick={() => {
                            setIsSelectionMode(false);
                            setSelectedMessageIds([]);
                        }}
                        className="btn btn-ghost btn-sm text-slate-600 hover:bg-slate-200/80 font-bold text-[11px] px-3.5"
                    >
                        Hủy
                    </button>
                </div>
            ) : isIBlockedHim ? (
                <div 
                    onClick={handleToggleBlock}
                    className="p-4 bg-red-50 border-t border-red-200 text-red-600 text-sm font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-red-100 transition-colors select-none"
                >
                    <span className="flex items-center gap-1.5"><Ban className="size-4" /> Bạn đã chặn tin nhắn từ người dùng này.</span>
                    <span className="text-[10px] font-normal text-red-500 underline">Bấm vào đây để bỏ chặn</span>
                </div>
            ) : isHeBlockedMe ? (
                <div className="p-4 bg-gray-50 border-t border-gray-200 text-gray-500 text-sm font-semibold flex flex-col items-center justify-center gap-1 select-none">
                    <span className="flex items-center gap-1.5"><Ban className="size-4 text-gray-400" /> Tài khoản này hiện không thể nhận tin nhắn.</span>
                </div>
            ) : (
                <MessageInput />
            )}
            </div>

            {/* Zalo Info Right Sidebar Panel */}
            {isSidebarOpen && (
                <div className="w-80 bg-base-100 flex-shrink-0 flex flex-col overflow-y-auto z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] select-none animate-slide-left">
                    {/* Header with Title and Close Button */}
                    <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-100 sticky top-0 z-10">
                        <h3 className="font-extrabold text-xs text-base-content/80 uppercase tracking-wider">Thông tin hội thoại</h3>
                        <button 
                            onClick={() => setIsSidebarOpen(false)}
                            className="btn btn-ghost btn-circle btn-xs text-base-content/65 hover:text-base-content hover:bg-base-200 transition-colors flex items-center justify-center size-6"
                            title="Đóng thông tin"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {/* User profile details block */}
                    <div className="p-6 flex flex-col items-center border-b border-base-300 text-center bg-base-50/10">
                        <div className="mb-3 relative">
                            <div className="size-16 flex items-center justify-center">
                                <GroupAvatar user={selectedUser} size="size-16" />
                            </div>
                            {!selectedUser.isGroup && onlineUsers.includes(selectedUser._id) && (
                                <span className="absolute bottom-0.5 right-0.5 size-3 bg-green-500 rounded-full z-10 ring-2 ring-white"></span>
                            )}
                            {selectedUser.isGroup && (
                                <>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*" 
                                        onChange={handleGroupPicUpdate} 
                                    />
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute -bottom-1 -right-1 p-1 bg-primary text-white rounded-full shadow hover:scale-105 active:scale-95 transition-all flex items-center justify-center size-6 cursor-pointer"
                                        title="Đổi ảnh đại diện nhóm"
                                        disabled={isUploadingGroupPic}
                                    >
                                        {isUploadingGroupPic ? <Loader2 className="size-3 animate-spin" /> : <Camera className="size-3" />}
                                    </button>
                                </>
                            )}
                        </div>
                        {isEditingGroupName ? (
                            <div className="flex items-center gap-1 w-full max-w-[200px] justify-center mt-1">
                                <input 
                                    type="text" 
                                    value={newGroupName} 
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    className="input input-bordered input-xs w-full text-center font-bold text-sm h-7 rounded px-1.5 focus:outline-primary"
                                    placeholder="Tên nhóm..."
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleGroupNameUpdate();
                                        if (e.key === "Escape") setIsEditingGroupName(false);
                                    }}
                                />
                                <button 
                                    onClick={handleGroupNameUpdate}
                                    className="btn btn-square btn-xs btn-primary h-7 w-7 min-h-0 flex items-center justify-center rounded"
                                    title="Lưu"
                                >
                                    <Check className="size-3.5" />
                                </button>
                                <button 
                                    onClick={() => setIsEditingGroupName(false)}
                                    className="btn btn-square btn-xs btn-ghost h-7 w-7 min-h-0 flex items-center justify-center rounded hover:bg-base-200"
                                    title="Hủy"
                                >
                                    <X className="size-3.5" />
                                </button>
                            </div>
                        ) : (
                            <h4 className="font-bold text-base text-base-content flex items-center gap-1 justify-center">
                                <span className="truncate max-w-[180px]">{selectedUser.fullName}</span>
                                {selectedUser.isGroup && (
                                    <button 
                                        onClick={() => {
                                            setNewGroupName(selectedUser.fullName || "");
                                            setIsEditingGroupName(true);
                                        }}
                                        className="p-1 hover:bg-base-200 rounded-full transition-colors text-base-content/65 hover:text-base-content flex items-center justify-center size-6"
                                        title="Đổi tên nhóm"
                                    >
                                        <Pencil className="size-3" />
                                    </button>
                                )}
                            </h4>
                        )}
                        <p className="text-xs text-base-content/50 mt-0.5">
                            {selectedUser.isGroup 
                                ? `Nhóm • ${selectedUser.members?.length || 0} thành viên`
                                : (onlineUsers.includes(selectedUser._id) ? "Đang hoạt động" : "Ngoại tuyến")
                            }
                        </p>
 
                        {/* Action buttons (Mute, Pin, Add Member, Leave Group) */}
                        <div className={`grid ${selectedUser.isGroup ? "grid-cols-4" : "grid-cols-3"} gap-2 w-full mt-5`}>
                            {/* Mute action */}
                            <button 
                                onClick={() => {
                                    if (selectedUser && authUser) {
                                        const nextMuted = !isMuted;
                                        if (nextMuted) {
                                            localStorage.setItem(`muted_${authUser._id}_${selectedUser._id}`, "true");
                                        } else {
                                            localStorage.removeItem(`muted_${authUser._id}_${selectedUser._id}`);
                                        }
                                        setIsMuted(nextMuted);
                                        window.dispatchEvent(new Event("conversationMutedChanged"));
                                    }
                                }}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs gap-1.5 transition-colors ${
                                    isMuted 
                                        ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100" 
                                        : "bg-base-200/50 border-base-300 text-base-content/70 hover:bg-base-200"
                                }`}
                            >
                                {isMuted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
                                <span className="text-[10px] font-semibold leading-none">{isMuted ? "Bật thông báo" : "Tắt thông báo"}</span>
                            </button>
 
                            {/* Pin action */}
                            <button 
                                onClick={() => {
                                    if (selectedUser && authUser) {
                                        const nextPinned = !isPinnedConv;
                                        if (nextPinned) {
                                            localStorage.setItem(`pin_conv_${authUser._id}_${selectedUser._id}`, "true");
                                        } else {
                                            localStorage.removeItem(`pin_conv_${authUser._id}_${selectedUser._id}`);
                                        }
                                        setIsPinnedConv(nextPinned);
                                        window.dispatchEvent(new Event("pinnedConversationsChanged"));
                                    }
                                }}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs gap-1.5 transition-colors ${
                                    isPinnedConv 
                                        ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 ring-2 ring-blue-500/20" 
                                        : "bg-base-200/50 border-base-300 text-base-content/70 hover:bg-base-200"
                                }`}
                            >
                                <Pin className={`size-4 ${isPinnedConv ? "fill-blue-500 text-blue-600" : "rotate-45"}`} />
                                <span className="text-[10px] font-semibold leading-none">{isPinnedConv ? "Bỏ ghim" : "Ghim"}</span>
                            </button>

                            {/* Add Member action (Only for groups) */}
                            {selectedUser.isGroup && (
                                <button 
                                    onClick={() => setIsAddMemberModalOpen(true)}
                                    className="flex flex-col items-center justify-center p-2 rounded-xl border border-base-300 bg-base-200/50 hover:bg-base-200 text-primary transition-colors text-xs gap-1.5"
                                >
                                    <UserPlus className="size-4" />
                                    <span className="text-[10px] font-semibold leading-none">Thêm TV</span>
                                </button>
                            )}
 
                            {/* Block or Leave Group action */}
                            {selectedUser.isGroup ? (
                                <button 
                                    onClick={async () => {
                                        const amICreator = selectedUser.creator === authUser?._id || selectedUser.creator?._id === authUser?._id;
                                        const otherMembers = selectedUser.members?.filter(m => {
                                            if (!m) return false;
                                            const mId = typeof m === "object" ? m._id : m;
                                            return mId !== authUser?._id;
                                        }) || [];
                                        
                                        if (amICreator && otherMembers.length > 0) {
                                            const firstOtherId = typeof otherMembers[0] === "object" ? otherMembers[0]._id : otherMembers[0];
                                            setSelectedNewLeaderId(firstOtherId);
                                            setIsLeaveGroupModalOpen(true);
                                        } else {
                                            if (window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này?")) {
                                                await leaveGroup(selectedUser._id);
                                            }
                                        }
                                    }}
                                    className="flex flex-col items-center justify-center p-2 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 transition-colors text-xs gap-1.5"
                                >
                                    <LogOut className="size-4" />
                                    <span className="text-[10px] font-semibold leading-none">Rời nhóm</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={handleToggleBlock}
                                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs gap-1.5 transition-colors ${
                                        isIBlockedHim 
                                            ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100" 
                                            : "bg-base-200/50 border-base-300 text-base-content/70 hover:bg-base-200"
                                    }`}
                                >
                                    <Ban className="size-4" />
                                    <span className="text-[10px] font-semibold leading-none">{isIBlockedHim ? "Bỏ chặn" : "Chặn"}</span>
                                </button>
                            )}
                        </div>
                    </div>
 
                    {/* Shared History sections */}
                    <div className="flex-1 p-4 space-y-5 overflow-y-auto">
                        
                        {/* Group Members Section (Only for groups) */}
                        {selectedUser.isGroup && (
                            <div className="border-b border-base-300 pb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="font-bold text-xs text-base-content/80 flex items-center gap-1.5">
                                        <Users className="size-3.5 text-primary" />
                                        <span>Thành viên nhóm</span>
                                    </h5>
                                    <span className="text-[10px] text-base-content/50 font-medium">
                                        {selectedUser.members?.length || 0} thành viên
                                    </span>
                                </div>
                                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                                    {selectedUser.members?.map((member, index) => {
                                        if (!member) return null;
                                        const memberId = typeof member === "object" ? member._id : member;
                                        if (!memberId) return null;

                                        let memberName = "";
                                        let memberPic = "/avatar.png";

                                        if (typeof member === "object") {
                                            memberName = member.fullName || "Thành viên";
                                            memberPic = member.profilePic || "/avatar.png";
                                        } else {
                                            const found = users?.find(u => u._id === memberId);
                                            if (found) {
                                                memberName = found.fullName || "Thành viên";
                                                memberPic = found.profilePic || "/avatar.png";
                                            } else if (memberId === authUser?._id) {
                                                memberName = authUser.fullName || "Chính bạn";
                                                memberPic = authUser.profilePic || "/avatar.png";
                                            } else {
                                                memberName = `Thành viên #${index + 1}`;
                                                memberPic = "/avatar.png";
                                            }
                                        }

                                        const isMemberCreator = selectedUser.creator === memberId || (selectedUser.creator?._id || selectedUser.creator) === memberId;
                                        const isMe = memberId === authUser?._id;
                                        const amICreator = selectedUser.creator === authUser?._id || selectedUser.creator?._id === authUser?._id;
 
                                        return (
                                            <div key={memberId} className="flex items-center justify-between p-1.5 hover:bg-base-200/50 rounded-lg transition-colors">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <img 
                                                        src={memberPic} 
                                                        alt={memberName} 
                                                        className="size-7 rounded-full object-cover border border-base-300"
                                                    />
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-bold text-base-content truncate flex items-center gap-1">
                                                            <span>{memberName}</span>
                                                            {isMe && <span className="text-[8px] text-primary bg-primary/10 px-1 rounded font-normal">(Bạn)</span>}
                                                        </p>
                                                        {isMemberCreator && (
                                                            <span className="text-[8px] bg-amber-100 text-amber-700 font-extrabold px-1 py-0.2 rounded mt-0.5 inline-block uppercase">Trưởng nhóm</span>
                                                        )}
                                                    </div>
                                                </div>
 
                                                {/* Delete button (only visible to group creator for other members) */}
                                                {amICreator && !isMemberCreator && (
                                                    <button 
                                                        onClick={async () => {
                                                            if (window.confirm(`Bạn có chắc chắn muốn xóa ${memberName} khỏi nhóm?`)) {
                                                                await removeGroupMember(selectedUser._id, memberId);
                                                            }
                                                        }}
                                                        className="btn btn-ghost btn-circle btn-xs text-red-500 hover:bg-red-50 hover:text-red-600 transition-all animate-fade-in"
                                                        title={`Xóa ${memberName} khỏi nhóm`}
                                                    >
                                                        <UserMinus className="size-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {/* Image/Video section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h5 className="font-bold text-xs text-base-content/80 flex items-center gap-1.5">
                                    <Image className="size-3.5 text-primary" />
                                    <span>Ảnh/Video</span>
                                </h5>
                                <span className="text-[10px] text-base-content/50 font-medium">
                                    {sharedImages.length} mục
                                </span>
                            </div>
                            
                            {sharedImages.length > 0 ? (
                                <div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {(showAllSharedImages ? sharedImages : sharedImages.slice(0, 6)).map((msg, i) => (
                                            <div 
                                                key={i} 
                                                className="group/item relative aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200/60"
                                            >
                                                <img src={msg.image} alt="Shared" className="w-full h-full object-cover cursor-zoom-in" onClick={() => setViewingImage(msg.image)} />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center justify-center gap-1.5 z-10">
                                                    <button 
                                                        onClick={() => setViewingImage(msg.image)}
                                                        className="size-7 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-colors"
                                                        title="Xem ảnh"
                                                    >
                                                        <Search className="size-3.5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleJumpToMessage(msg._id)}
                                                        className="size-7 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-colors"
                                                        title="Xem tin nhắn gốc"
                                                    >
                                                        <Target className="size-3.5 text-primary" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {sharedImages.length > 6 && !showAllSharedImages && (
                                        <button 
                                            onClick={() => setShowAllSharedImages(true)}
                                            className="w-full text-center py-1.5 text-[10px] font-semibold text-primary/80 hover:text-primary hover:bg-primary/5 rounded border border-dashed border-base-300 mt-2 transition-all animate-fade-in"
                                        >
                                            Xem thêm
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[11px] text-base-content/40 italic p-2 border border-dashed border-base-300 rounded-lg text-center">
                                    Chưa chia sẻ hình ảnh nào
                                </p>
                            )}
                        </div>

                        {/* File section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h5 className="font-bold text-xs text-base-content/80 flex items-center gap-1.5">
                                    <FileText className="size-3.5 text-primary" />
                                    <span>Tệp tin</span>
                                </h5>
                                <span className="text-[10px] text-base-content/50 font-medium">
                                    {sharedFiles.length} tệp
                                </span>
                            </div>
                            
                            {sharedFiles.length > 0 ? (
                                <div>
                                    <div className="space-y-1.5 pr-1">
                                        {(showAllSharedFiles ? sharedFiles : sharedFiles.slice(0, 3)).map((msg, i) => (
                                            <div 
                                                key={i} 
                                                className="group/file relative flex items-center gap-2 p-2 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-lg transition-colors select-none text-left"
                                            >
                                                <a 
                                                    href={msg.file.url} 
                                                    download={msg.file.name}
                                                    className="flex items-center gap-2 min-w-0 flex-1"
                                                >
                                                    <div className="bg-primary/10 text-primary p-1.5 rounded flex-shrink-0">
                                                        <FileText className="size-3.5" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[10px] font-bold text-base-content truncate leading-tight">{msg.file.name}</p>
                                                        <p className="text-[8px] text-base-content/50 leading-none mt-0.5">
                                                            {msg.file.size ? `${(msg.file.size / 1024).toFixed(1)} KB` : "Tệp tin"}
                                                        </p>
                                                    </div>
                                                </a>
                                                <button 
                                                    onClick={() => handleJumpToMessage(msg._id)}
                                                    className="opacity-0 group-hover/file:opacity-100 size-6 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm transition-all flex-shrink-0"
                                                    title="Xem tin nhắn gốc"
                                                >
                                                    <Target className="size-3.5 text-primary" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    {sharedFiles.length > 3 && !showAllSharedFiles && (
                                        <button 
                                            onClick={() => setShowAllSharedFiles(true)}
                                            className="w-full text-center py-1.5 text-[10px] font-semibold text-primary/80 hover:text-primary hover:bg-primary/5 rounded border border-dashed border-base-300 mt-2 transition-all animate-fade-in"
                                        >
                                            Xem thêm
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[11px] text-base-content/40 italic p-2 border border-dashed border-base-300 rounded-lg text-center">
                                    Chưa chia sẻ tệp tin nào
                                </p>
                            )}
                        </div>

                        {/* Shared Links section */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h5 className="font-bold text-xs text-base-content/80 flex items-center gap-1.5">
                                    <Link2 className="size-3.5 text-primary" />
                                    <span>Liên kết</span>
                                </h5>
                                <span className="text-[10px] text-base-content/50 font-medium">
                                    {sharedLinks.length} liên kết
                                </span>
                            </div>
                            
                            {sharedLinks.length > 0 ? (
                                <div>
                                    <div className="space-y-1.5 pr-1">
                                        {(showAllSharedLinks ? sharedLinks : sharedLinks.slice(0, 3)).map((msg, i) => {
                                            const url = msg.text.match(/(https?:\/\/[^\s]+)/gi)?.[0] || "#";
                                            return (
                                                <div 
                                                    key={i} 
                                                    className="group/link relative flex items-center gap-2 p-2 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-lg transition-colors select-none text-left"
                                                >
                                                    <a 
                                                        href={url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 min-w-0 flex-1"
                                                    >
                                                        <div className="bg-blue-100 text-blue-600 p-1.5 rounded flex-shrink-0">
                                                            <Globe className="size-3.5" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-[10px] font-bold text-blue-600 truncate leading-tight hover:underline">{url}</p>
                                                            <p className="text-[8px] text-base-content/50 leading-none mt-0.5 truncate">
                                                                {msg.text}
                                                            </p>
                                                        </div>
                                                    </a>
                                                    <button 
                                                        onClick={() => handleJumpToMessage(msg._id)}
                                                        className="opacity-0 group-hover/link:opacity-100 size-6 rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shadow-sm transition-all flex-shrink-0"
                                                        title="Xem tin nhắn gốc"
                                                    >
                                                        <Target className="size-3.5 text-primary" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {sharedLinks.length > 3 && !showAllSharedLinks && (
                                        <button 
                                            onClick={() => setShowAllSharedLinks(true)}
                                            className="w-full text-center py-1.5 text-[10px] font-semibold text-primary/80 hover:text-primary hover:bg-primary/5 rounded border border-dashed border-base-300 mt-2 transition-all animate-fade-in"
                                        >
                                            Xem thêm
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-[11px] text-base-content/40 italic p-2 border border-dashed border-base-300 rounded-lg text-center">
                                    Chưa chia sẻ liên kết nào
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Dangerous Action Footer */}
                    <div className="p-4 border-t border-base-300 bg-base-200/20 space-y-2">
                        {selectedUser.isGroup && (
                            <button 
                                onClick={async () => {
                                    if (window.confirm("Bạn có chắc chắn muốn rời khỏi nhóm này?")) {
                                        await leaveGroup(selectedUser._id);
                                    }
                                }}
                                className="btn btn-error btn-outline btn-sm w-full gap-2 text-xs flex items-center justify-center font-bold"
                            >
                                <LogOut className="size-4" />
                                <span>Rời khỏi nhóm</span>
                            </button>
                        )}
                        <button 
                            onClick={() => {
                                if (window.confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này? Hành động này sẽ xóa toàn bộ tin nhắn và ẩn cuộc trò chuyện khỏi danh sách.")) {
                                    clearMessages();
                                    localStorage.setItem(`deleted_chat_${authUser._id}_${selectedUser._id}`, "true");
                                    setSelectedUser(null);
                                }
                            }}
                            className="btn btn-error btn-outline btn-sm w-full gap-2 text-xs flex items-center justify-center font-bold"
                        >
                            <Trash2 className="size-4" />
                            <span>Xóa cuộc trò chuyện</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Zalo Search Right Sidebar Panel */}
            {isSearchOpen && (
                <div className="w-80 bg-base-100 flex-shrink-0 flex flex-col border-l border-base-300 overflow-hidden z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] select-none animate-slide-left">
                    {/* Header */}
                    <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50 sticky top-0 z-10 backdrop-blur-md">
                        <h3 className="font-bold text-sm text-base-content flex items-center gap-1.5">
                            <Search className="size-4 text-primary" /> Tìm kiếm tin nhắn
                        </h3>
                        <button 
                            onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery("");
                                setShowAllTextResults(false);
                                setShowAllFileResults(false);
                            }}
                            className="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-base-content"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {/* Search Input Box */}
                    <div className="p-4 border-b border-base-300 bg-base-50/20 space-y-3">
                        <div className="relative flex items-center">
                            <Search className="size-4 absolute left-3 text-base-content/40" />
                            <input
                                type="text"
                                placeholder="Nhập từ khóa tìm kiếm..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setShowAllTextResults(false);
                                    setShowAllFileResults(false);
                                }}
                                className="input input-sm w-full pl-9 pr-8 bg-base-100 border border-base-300 rounded focus:outline-none focus:border-primary text-xs font-medium text-slate-800"
                                autoFocus
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => {
                                        setSearchQuery("");
                                        setShowAllTextResults(false);
                                        setShowAllFileResults(false);
                                    }}
                                    className="absolute right-2.5 text-base-content/50 hover:text-base-content"
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter by: Sender / Date (Mock dropdown style) */}
                        <div className="flex items-center gap-1.5 text-[11px] text-base-content/70">
                            <span>Lọc theo:</span>
                            <div className="dropdown dropdown-bottom">
                                <label tabIndex={0} className="flex items-center gap-1 bg-base-200 border border-base-300/80 px-2.5 py-0.5 rounded cursor-pointer hover:bg-base-300 transition-colors font-medium text-[10px]">
                                    <Calendar className="size-3 text-base-content/60" /> Ngày gửi <ChevronDown className="size-3" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Search Results list */}
                    <div className="flex-1 overflow-y-auto bg-base-50/10">
                        {searchQuery.trim() === "" ? (
                            <div className="text-center py-12 text-base-content/40 text-xs italic px-6">
                                Nhập từ khóa để tìm kiếm tin nhắn trong cuộc trò chuyện này
                            </div>
                        ) : (textResults.length === 0 && fileResults.length === 0) ? (
                            <div className="text-center py-12 text-base-content/40 text-xs italic px-6">
                                Không tìm thấy kết quả nào khớp với "{searchQuery}"
                            </div>
                        ) : (
                            <div className="p-3 space-y-6">
                                {/* SECTION 1: Tin nhắn */}
                                {textResults.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider px-1.5 pb-2 border-b border-base-200/85 mb-1">
                                            Tin nhắn ({textResults.length})
                                        </p>
                                        <div className="divide-y divide-base-200/50">
                                            {(showAllTextResults ? textResults : textResults.slice(0, 4)).map((msg) => {
                                                const isMe = msg.senderId === authUser._id;
                                                const senderName = isMe ? "Bạn" : selectedUser.fullName;
                                                const senderAvatar = isMe ? authUser.profilePic : selectedUser.profilePic;
                                                
                                                return (
                                                    <div 
                                                        key={msg._id}
                                                        onClick={() => handleJumpToMessage(msg._id)}
                                                        className="flex gap-2.5 py-3 px-1.5 hover:bg-primary/5 cursor-pointer transition-colors text-left group"
                                                    >
                                                        <div className="size-8 rounded-full overflow-hidden border border-base-200/80 flex-shrink-0">
                                                            <img src={senderAvatar || "/avatar.png"} alt="avatar" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className="font-bold text-xs text-base-content/90 truncate max-w-[120px]">{senderName}</span>
                                                                <span className="text-[9px] text-base-content/40 flex-shrink-0">{formatMessageDateShort(msg.createdAt)}</span>
                                                            </div>
                                                            <p className="text-[11px] text-base-content/75 mt-1 leading-relaxed break-words font-medium group-hover:text-base-content transition-colors">
                                                                {highlightResultText(msg.text || "", searchQuery)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        
                                        {/* "Xem thêm" button for textResults */}
                                        {textResults.length > 4 && !showAllTextResults && (
                                            <button 
                                                onClick={() => setShowAllTextResults(true)}
                                                className="w-full text-center py-2 text-xs font-semibold text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg border border-dashed border-base-300 mt-2 transition-all"
                                            >
                                                Xem thêm
                                            </button>
                                        )}
                                    </div>
                                )}

                                {/* SECTION 2: Tệp tin (File) */}
                                {fileResults.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-bold text-base-content/50 uppercase tracking-wider px-1.5 pb-2 border-b border-base-200/85 mb-2.5">
                                            File ({fileResults.length})
                                        </p>
                                        <div className="space-y-2">
                                            {(showAllFileResults ? fileResults : fileResults.slice(0, 4)).map((msg) => {
                                                const isMe = msg.senderId === authUser._id;
                                                const senderName = isMe ? "Bạn" : selectedUser.fullName;
                                                const fileStyle = getFileColorAndIcon(msg.file.name);
                                                
                                                return (
                                                    <div 
                                                        key={msg._id}
                                                        onClick={() => handleJumpToMessage(msg._id)}
                                                        className="flex items-center gap-3 p-2.5 hover:bg-primary/5 rounded-xl border border-base-200/60 cursor-pointer transition-all text-left bg-base-100 shadow-sm hover:shadow group"
                                                    >
                                                        {/* Styled File icon badge */}
                                                        <div className={`${fileStyle.bg} border p-2 rounded-lg flex-shrink-0 transition-transform group-hover:scale-105`}>
                                                            {fileStyle.icon}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-slate-800 truncate leading-tight group-hover:text-primary transition-colors">
                                                                {highlightResultText(msg.file.name, searchQuery)}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 leading-none mt-1.5 font-medium">
                                                                {formatFileSize(msg.file.size)} - {senderName}
                                                            </p>
                                                        </div>
                                                        <div className="text-[9px] text-base-content/40 flex-shrink-0 align-self-start pt-0.5">
                                                            {formatMessageDateShort(msg.createdAt)}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* "Xem thêm" button for fileResults */}
                                        {fileResults.length > 4 && !showAllFileResults && (
                                            <button 
                                                onClick={() => setShowAllFileResults(true)}
                                                className="w-full text-center py-2 text-xs font-semibold text-primary/80 hover:text-primary hover:bg-primary/5 rounded-lg border border-dashed border-base-300 mt-3 transition-all"
                                            >
                                                Xem thêm
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Full Screen Image Viewer Modal */}
            {viewingImage && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[9999] flex flex-col items-center justify-center animate-fade-in select-none">
                    {/* Top Control Bar */}
                    <div className="absolute top-4 right-4 flex items-center gap-3">
                        <button 
                            onClick={handleRotateLeft}
                            className="btn btn-circle btn-sm bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 flex items-center justify-center"
                            title="Xoay trái"
                        >
                            <RotateCcw className="size-4" />
                        </button>
                        <button 
                            onClick={handleRotateRight}
                            className="btn btn-circle btn-sm bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 flex items-center justify-center"
                            title="Xoay phải"
                        >
                            <RotateCw className="size-4" />
                        </button>
                        <button 
                            onClick={handleDownload}
                            className="btn btn-circle btn-sm bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 flex items-center justify-center"
                            title="Tải về"
                        >
                            <Download className="size-4" />
                        </button>
                        <button 
                            onClick={handleCloseViewer}
                            className="btn btn-circle btn-sm bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 flex items-center justify-center"
                            title="Đóng"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {/* Image Container */}
                    <div className="max-w-[90%] max-h-[80%] flex items-center justify-center overflow-hidden transition-all duration-300">
                        <img 
                            src={viewingImage} 
                            alt="Enlarged view" 
                            style={{ transform: `rotate(${rotation}deg)` }}
                            className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl transition-transform duration-200"
                        />
                    </div>
                </div>
            )}
            {/* Forward Modal */}
            {isForwardModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 animate-fade-in text-base-content">
                    <div className="bg-base-100 rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <Share2 className="size-5 text-primary" /> Chia sẻ tin nhắn
                            </h3>
                            <button 
                                onClick={() => {
                                    setIsForwardModalOpen(false);
                                    setSelectedForwardUsers([]);
                                    setForwardSearchQuery("");
                                }}
                                className="btn btn-ghost btn-circle btn-sm text-base-content/60"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        
                        <div className="p-3 border-b border-base-300 bg-base-50">
                            <div className="relative flex items-center">
                                <Search className="size-4 absolute left-3 text-base-content/40" />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm người liên hệ..."
                                    value={forwardSearchQuery}
                                    onChange={(e) => setForwardSearchQuery(e.target.value)}
                                    className="input input-sm w-full pl-9 bg-base-100 border-base-300 rounded focus:border-primary text-xs"
                                    autoFocus
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto max-h-60 p-2 space-y-1">
                            {users
                                .filter(u => u._id !== authUser._id && u.fullName.toLowerCase().includes(forwardSearchQuery.toLowerCase()))
                                .map(u => (
                                    <label key={u._id} className="flex items-center gap-3 p-2 hover:bg-base-200/50 rounded-lg cursor-pointer transition-colors">
                                        <input 
                                            type="checkbox" 
                                            className="checkbox checkbox-primary checkbox-sm border-slate-300 rounded"
                                            checked={selectedForwardUsers.includes(u._id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedForwardUsers([...selectedForwardUsers, u._id]);
                                                else setSelectedForwardUsers(selectedForwardUsers.filter(id => id !== u._id));
                                            }}
                                        />
                                        <div className="size-8 rounded-full overflow-hidden border border-base-300 flex-shrink-0">
                                            <img src={u.profilePic || "/avatar.png"} alt="avatar" className="w-full h-full object-cover" />
                                        </div>
                                        <span className="text-sm font-semibold truncate">{u.fullName}</span>
                                    </label>
                                ))
                            }
                            {users.filter(u => u._id !== authUser._id && u.fullName.toLowerCase().includes(forwardSearchQuery.toLowerCase())).length === 0 && (
                                <p className="text-center text-xs text-base-content/40 py-6 italic">Không tìm thấy liên hệ nào</p>
                            )}
                        </div>
                        
                        <div className="p-4 border-t border-base-300 bg-base-200/30 flex items-center justify-between">
                            <div className="text-xs font-semibold text-primary">
                                {selectedForwardUsers.length > 0 ? `Đã chọn ${selectedForwardUsers.length}` : ""}
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => {
                                        setIsForwardModalOpen(false);
                                        setSelectedForwardUsers([]);
                                    }}
                                    className="btn btn-ghost btn-sm text-xs font-bold"
                                >
                                    Hủy
                                </button>
                                <button 
                                    onClick={handleForwardSelected}
                                    disabled={selectedForwardUsers.length === 0}
                                    className="btn btn-primary btn-sm text-white text-xs font-bold px-6 shadow-sm"
                                >
                                    Gửi
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Add Member Modal */}
            {isAddMemberModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in text-base-content backdrop-blur-sm">
                    <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md flex flex-col h-[480px] overflow-hidden border border-base-300">
                        {/* Header */}
                        <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
                            <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                                <UserPlus className="size-5 text-primary" /> Thêm thành viên vào nhóm
                            </h3>
                            <button 
                                onClick={() => {
                                    setIsAddMemberModalOpen(false);
                                    setSelectedNewMembers([]);
                                    setAddMemberSearchQuery("");
                                }}
                                className="btn btn-ghost btn-circle btn-sm text-base-content/60"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Search field */}
                        <div className="p-4 border-b border-base-300 bg-base-50">
                            <div className="relative">
                                <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                                <input
                                    type="text"
                                    placeholder="Nhập tên người bạn cần tìm..."
                                    value={addMemberSearchQuery}
                                    onChange={(e) => setAddMemberSearchQuery(e.target.value)}
                                    className="input input-sm w-full pl-9 bg-base-100 border-base-300 rounded focus:border-primary text-xs"
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Body List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 select-none">
                            <h4 className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider mb-2">Bạn bè chưa tham gia nhóm</h4>
                            {friendsNotInGroup.length === 0 ? (
                                <div className="h-[200px] flex flex-col items-center justify-center text-center p-4">
                                    <p className="text-xs text-base-content/40 font-bold mb-2">Không có người bạn phù hợp để thêm</p>
                                    <p className="text-[10px] text-base-content/30 leading-relaxed max-w-[280px]">
                                        Lưu ý: Chỉ những người bạn <span className="font-semibold text-primary">đã kết bạn thành công</span> trên JudoChat mới hiển thị ở đây. Hãy kết bạn bằng số điện thoại trước nhé!
                                    </p>
                                </div>
                            ) : (
                                friendsNotInGroup.map((friend) => {
                                    const isChecked = selectedNewMembers.includes(friend._id);
                                    return (
                                        <div
                                            key={friend._id}
                                            onClick={() => {
                                                if (isChecked) {
                                                    setSelectedNewMembers(selectedNewMembers.filter(id => id !== friend._id));
                                                } else {
                                                    setSelectedNewMembers([...selectedNewMembers, friend._id]);
                                                }
                                            }}
                                            className="flex items-center gap-3 p-2 hover:bg-base-200 border border-transparent hover:border-base-300 rounded-xl cursor-pointer transition-all"
                                        >
                                            <input 
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {}} // handled by parent div
                                                className="checkbox checkbox-primary checkbox-sm rounded-full flex-shrink-0 pointer-events-none"
                                            />
                                            <img
                                                src={friend.profilePic || "/avatar.png"}
                                                alt={friend.fullName}
                                                className="size-9 rounded-full object-cover border border-base-300"
                                            />
                                            <span className="text-xs font-semibold truncate flex-1">{friend.fullName}</span>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-base-300 flex justify-end gap-2 bg-base-200/30">
                            <button
                                onClick={() => {
                                    setIsAddMemberModalOpen(false);
                                    setSelectedNewMembers([]);
                                    setAddMemberSearchQuery("");
                                }}
                                className="btn btn-ghost btn-sm text-xs font-semibold px-4"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleAddMembersSubmit}
                                disabled={isAddingMembers || selectedNewMembers.length === 0}
                                className="btn btn-primary btn-sm text-white font-extrabold px-6 shadow-md"
                            >
                                {isAddingMembers ? <Loader2 className="size-4 animate-spin" /> : `Thêm (${selectedNewMembers.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Bàn giao quyền Trưởng nhóm Modal */}
            {isLeaveGroupModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-fade-in text-base-content backdrop-blur-sm">
                    <div className="bg-base-100 rounded-2xl shadow-2xl w-full max-w-md flex flex-col h-[400px] overflow-hidden border border-base-300">
                        {/* Header */}
                        <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50">
                            <h3 className="font-extrabold text-base flex items-center gap-2 text-red-600">
                                <LogOut className="size-5 text-red-500" /> Bàn giao quyền Trưởng nhóm
                            </h3>
                            <button 
                                onClick={() => {
                                    setIsLeaveGroupModalOpen(false);
                                    setSelectedNewLeaderId("");
                                }}
                                className="btn btn-ghost btn-circle btn-sm text-base-content/60"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        {/* Tip info */}
                        <div className="p-4 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 leading-relaxed select-none">
                            Bạn là Trưởng nhóm. Trước khi rời nhóm, bạn cần chỉ định một thành viên khác làm Trưởng nhóm mới để tiếp tục quản lý cuộc hội thoại.
                        </div>

                        {/* Members list */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 select-none">
                            <h4 className="text-[11px] font-bold text-base-content/50 uppercase tracking-wider mb-2">Chọn Trưởng nhóm mới</h4>
                            {selectedUser.members
                                ?.filter(m => {
                                    if (!m) return false;
                                    const mId = typeof m === "object" ? m._id : m;
                                    return mId !== authUser?._id;
                                })
                                .map((member, index) => {
                                    const mId = typeof member === "object" ? member._id : member;
                                    let mName = "";
                                    let mPic = "/avatar.png";

                                    if (typeof member === "object") {
                                        mName = member.fullName || "Thành viên";
                                        mPic = member.profilePic || "/avatar.png";
                                    } else {
                                        const found = users?.find(u => u._id === mId);
                                        if (found) {
                                            mName = found.fullName || "Thành viên";
                                            mPic = found.profilePic || "/avatar.png";
                                        } else {
                                            mName = `Thành viên #${index + 1}`;
                                            mPic = "/avatar.png";
                                        }
                                    }

                                    const isSelected = selectedNewLeaderId === mId;

                                    return (
                                        <div
                                            key={mId}
                                            onClick={() => setSelectedNewLeaderId(mId)}
                                            className={`flex items-center gap-3 p-2 border rounded-xl cursor-pointer transition-all ${
                                                isSelected 
                                                    ? "bg-primary/5 border-primary shadow-sm" 
                                                    : "hover:bg-base-200 border-transparent hover:border-base-300"
                                            }`}
                                        >
                                            <input 
                                                type="radio"
                                                name="newLeader"
                                                checked={isSelected}
                                                onChange={() => {}} // handled by parent div click
                                                className="radio radio-primary radio-sm flex-shrink-0 pointer-events-none"
                                            />
                                            <img
                                                src={mPic}
                                                alt={mName}
                                                className="size-9 rounded-full object-cover border border-base-300"
                                            />
                                            <span className={`text-xs font-semibold truncate flex-1 ${isSelected ? "text-primary" : ""}`}>
                                                {mName}
                                            </span>
                                        </div>
                                    );
                                })
                            }
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-base-300 flex justify-end gap-2 bg-base-200/30">
                            <button
                                onClick={() => {
                                    setIsLeaveGroupModalOpen(false);
                                    setSelectedNewLeaderId("");
                                }}
                                className="btn btn-ghost btn-sm text-xs font-semibold px-4"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={async () => {
                                    if (!selectedNewLeaderId) {
                                        toast.error("Vui lòng chọn trưởng nhóm mới");
                                        return;
                                    }
                                    if (window.confirm("Bạn có chắc chắn muốn bàn giao quyền trưởng nhóm và rời khỏi nhóm này?")) {
                                        try {
                                            await leaveGroup(selectedUser._id, selectedNewLeaderId);
                                            setIsLeaveGroupModalOpen(false);
                                            setSelectedNewLeaderId("");
                                        } catch (err) {
                                            console.error(err);
                                        }
                                    }
                                }}
                                className="btn btn-error btn-sm text-white font-extrabold px-6 shadow-md"
                            >
                                Bàn giao & Rời nhóm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatContainer;
