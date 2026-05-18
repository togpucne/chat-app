import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessagesSkeleton from "./skeletons/MessagesSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { MoreVertical, Pin, X, Paperclip, RotateCcw, RotateCw, Download, Search, Trash2, Ban, Bell, Link2, FileText, Image, Globe, Check } from "lucide-react";

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
const renderFormattedText = (text) => {
    if (!text) return "";
    
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

        return <span dangerouslySetInnerHTML={{ __html: sanitized }} />;
    }

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

    return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
};

const ChatContainer = () => {
    const { messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages, unsubscribeFromMessages, deleteMessage, setReplyingTo, pinMessage, reactMessage, clearMessages } = useChatStore();
    const { authUser, onlineUsers } = useAuthStore();
    const messageEndRef = useRef(null);

    const [viewingImage, setViewingImage] = useState(null);
    const [rotation, setRotation] = useState(0);

    // Search and Sidebar states
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Sidebar Mock action states (to fulfill Block, Mute, Pin requests)
    const [isBlocked, setIsBlocked] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isPinnedConv, setIsPinnedConv] = useState(false);

    const handleRotateLeft = () => setRotation((prev) => (prev - 90) % 360);
    const handleRotateRight = () => setRotation((prev) => (prev + 90) % 360);
    const handleCloseViewer = () => {
        setViewingImage(null);
        setRotation(0);
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

    // Tự động cuộn xuống khi có tin nhắn mới
    useEffect(() => {
        if (messageEndRef.current && messages) {
            messageEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

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

    const filteredMessages = searchQuery.trim() !== "" 
        ? messages.filter(msg => {
            if (msg.isRecalled) return false;
            if (msg.text && msg.text.toLowerCase().includes(searchQuery.toLowerCase())) return true;
            if (msg.file && msg.file.name && msg.file.name.toLowerCase().includes(searchQuery.toLowerCase())) return true;
            return false;
          })
        : messages;

    const groupedMessages = groupMessagesByDate(filteredMessages);
    const pinnedMessages = messages.filter((m) => m.isPinned && !m.isRecalled);
    const latestPinned = pinnedMessages[pinnedMessages.length - 1];

    return (
        <div className="flex-1 flex overflow-hidden bg-base-100">
            {/* Left Area: Main Chat Flow */}
            <div className="flex-1 flex flex-col overflow-hidden relative border-r border-base-300">
                <ChatHeader 
                    onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
                    isSearchOpen={isSearchOpen}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    isSidebarOpen={isSidebarOpen}
                />

                {/* Search Bar Input Panel */}
                {isSearchOpen && (
                    <div className="p-3 bg-base-200/50 border-b border-base-300 flex items-center gap-2 animate-fade-in z-10 backdrop-blur-sm shadow-sm">
                        <Search className="size-4 text-base-content/50" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm tin nhắn..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input input-sm flex-1 bg-base-100 border border-base-300 rounded focus:outline-none focus:border-primary text-xs"
                            autoFocus
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery("")}
                                className="btn btn-ghost btn-circle btn-xs text-base-content/50 hover:text-base-content bg-base-200"
                            >
                                <X className="size-3" />
                            </button>
                        )}
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
                        {/* Sticky Date Divider Header */}
                        <div className="sticky top-0 z-[10] flex justify-center my-2 pointer-events-none">
                            <span className="bg-base-300/90 backdrop-blur-sm text-base-content/85 px-4 py-1 rounded-full text-xs font-semibold tracking-wide shadow-sm pointer-events-auto border border-base-200/40">
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

                            return (
                                <div
                                key={message._id}
                                id={`msg-${message._id}`}
                                className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"} group relative transition-colors duration-500 rounded-xl p-1`}
                            >
                                <div className="chat-image avatar">
                                    <div className="size-10 rounded-full border">
                                        <img
                                            src={
                                                message.senderId === authUser._id
                                                    ? authUser.profilePic || "/avatar.png"
                                                    : selectedUser.profilePic || "/avatar.png"
                                            }
                                            alt="Ảnh đại diện"
                                        />
                                    </div>
                                </div>
                                
                                {/* Transparent wrapper grid item to position bubble and dropdown side-by-side without clipping */}
                                <div className="chat-bubble bg-transparent p-0 max-w-[85%] overflow-visible flex items-center gap-2 shadow-none before:hidden after:hidden">
                                    
                                    {/* Action block for sender: Hover reaction panel + dropdown */}
                                    {message.senderId === authUser._id && !message.isRecalled && (
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
                                    <div className={`relative flex flex-col gap-1 max-w-full ${message.senderId === authUser._id ? "items-end" : "items-start"}`}>
                                        
                                        {/* If there is an image, render it borderless and raw with rounded corners! */}
                                        {message.image && (
                                            <img
                                                src={message.image}
                                                alt="Attachment"
                                                onClick={() => setViewingImage(message.image)}
                                                className="max-w-[280px] sm:max-w-[320px] rounded-2xl cursor-zoom-in hover:opacity-95 transition-opacity shadow-sm border border-slate-200/30"
                                            />
                                        )}

                                        {/* If there is text, a file, a reply context, or if it is recalled, render the standard Zalo colored bubble! */}
                                        {(message.text || message.file || message.isRecalled || message.replyTo) && (
                                            <div className={`flex flex-col relative py-2.5 px-4 rounded-2xl shadow-sm text-[14px] leading-relaxed max-w-full overflow-visible transition-all duration-200 ${
                                                message.senderId === authUser._id 
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
                                                        {/* Document download card */}
                                                        {message.file && message.file.url && (
                                                            <a 
                                                                href={message.file.url} 
                                                                download={message.file.name}
                                                                className="flex items-center gap-3 bg-[#f0f2f5] hover:bg-[#e4e6eb] text-slate-800 p-2.5 rounded-lg border border-[#e4e6eb] transition-colors mt-1 mb-2 select-none max-w-[240px] text-left shadow-sm"
                                                                title="Bấm để tải tệp về"
                                                            >
                                                                <div className="bg-primary/10 text-primary p-2 rounded flex-shrink-0">
                                                                    <Paperclip className="size-5" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-bold truncate leading-tight text-slate-800">{message.file.name}</p>
                                                                    <p className="text-[10px] text-slate-500 leading-none mt-1">
                                                                        {message.file.size ? `${(message.file.size / 1024).toFixed(1)} KB` : "Tệp đính kèm"}
                                                                    </p>
                                                                </div>
                                                            </a>
                                                        )}

                                                        {message.text && (
                                                            <div className="flex flex-col gap-1.5">
                                                                <p className="break-words text-sm whitespace-pre-wrap">
                                                                    {renderFormattedText(message.text)}
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
                                    {message.senderId !== authUser._id && !message.isRecalled && (
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
                                    <div className={`chat-footer text-[10px] mt-1 select-none flex items-center gap-1.5 ${message.senderId === authUser._id ? "justify-end" : "justify-start"}`}>
                                        <span className="opacity-50">{formatMessageTime(message.createdAt)}</span>
                                        
                                        {/* Zalo Status Pill / Seen Avatar */}
                                        {message.senderId === authUser._id && (
                                            <>
                                                {message._id === messages[messages.length - 1]?._id ? (
                                                    message.isSeen ? (
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

            {/* Block Action Banner or Message Input */}
            {isBlocked ? (
                <div 
                    onClick={() => setIsBlocked(false)}
                    className="p-4 bg-red-50 border-t border-red-200 text-red-600 text-sm font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-red-100 transition-colors select-none"
                >
                    <span className="flex items-center gap-1.5"><Ban className="size-4" /> Bạn đã chặn tin nhắn từ người dùng này.</span>
                    <span className="text-[10px] font-normal text-red-500 underline">Bấm vào đây để bỏ chặn</span>
                </div>
            ) : (
                <MessageInput />
            )}
            </div>

            {/* Zalo Info Right Sidebar Panel */}
            {isSidebarOpen && (
                <div className="w-80 bg-base-100 flex-shrink-0 flex flex-col overflow-y-auto z-20 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] select-none animate-slide-left">
                    {/* Sidebar Header */}
                    <div className="p-4 border-b border-base-300 flex items-center justify-between bg-base-200/50 sticky top-0 z-10 backdrop-blur-md">
                        <h3 className="font-bold text-sm text-base-content">Thông tin hội thoại</h3>
                        <button 
                            onClick={() => setIsSidebarOpen(false)}
                            className="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-base-content"
                        >
                            <X className="size-4" />
                        </button>
                    </div>

                    {/* User profile details block */}
                    <div className="p-6 flex flex-col items-center border-b border-base-300 text-center bg-base-50/10">
                        <div className="avatar mb-3">
                            <div className="size-16 rounded-full ring-2 ring-primary/20 ring-offset-2 relative">
                                <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} />
                                {onlineUsers.includes(selectedUser._id) && (
                                    <span className="absolute bottom-0.5 right-0.5 size-3.5 bg-green-500 rounded-full border-2 border-white"></span>
                                )}
                            </div>
                        </div>
                        <h4 className="font-bold text-base text-base-content flex items-center gap-1.5 justify-center">
                            {selectedUser.fullName}
                        </h4>
                        <p className="text-xs text-base-content/50 mt-0.5">
                            {onlineUsers.includes(selectedUser._id) ? "Đang hoạt động" : "Ngoại tuyến"}
                        </p>

                        {/* Action buttons (Mute, Pin, Block) */}
                        <div className="grid grid-cols-3 gap-2 w-full mt-5">
                            {/* Mute action */}
                            <button 
                                onClick={() => setIsMuted(!isMuted)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs gap-1.5 transition-colors ${
                                    isMuted 
                                        ? "bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100" 
                                        : "bg-base-200/50 border-base-300 text-base-content/70 hover:bg-base-200"
                                }`}
                            >
                                {isMuted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
                                <span className="text-[10px] font-semibold leading-none">{isMuted ? "Bật âm" : "Tắt âm"}</span>
                            </button>

                            {/* Pin action */}
                            <button 
                                onClick={() => setIsPinnedConv(!isPinnedConv)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs gap-1.5 transition-colors ${
                                    isPinnedConv 
                                        ? "bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100" 
                                        : "bg-base-200/50 border-base-300 text-base-content/70 hover:bg-base-200"
                                }`}
                            >
                                <Pin className="size-4 rotate-45" />
                                <span className="text-[10px] font-semibold leading-none">{isPinnedConv ? "Bỏ ghim" : "Ghim"}</span>
                            </button>

                            {/* Block action */}
                            <button 
                                onClick={() => setIsBlocked(!isBlocked)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs gap-1.5 transition-colors ${
                                    isBlocked 
                                        ? "bg-red-50 border-red-200 text-red-600 hover:bg-red-100" 
                                        : "bg-base-200/50 border-base-300 text-base-content/70 hover:bg-base-200"
                                }`}
                            >
                                <Ban className="size-4" />
                                <span className="text-[10px] font-semibold leading-none">{isBlocked ? "Bỏ chặn" : "Chặn"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Shared History sections */}
                    <div className="flex-1 p-4 space-y-5">
                        
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
                                <div className="grid grid-cols-3 gap-1.5">
                                    {sharedImages.slice(0, 9).map((msg, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => setViewingImage(msg.image)}
                                            className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200/60 cursor-zoom-in hover:opacity-90 transition-opacity"
                                        >
                                            <img src={msg.image} alt="Shared" className="w-full h-full object-cover" />
                                        </div>
                                    ))}
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
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {sharedFiles.map((msg, i) => (
                                        <a 
                                            key={i} 
                                            href={msg.file.url} 
                                            download={msg.file.name}
                                            className="flex items-center gap-2 p-2 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-lg transition-colors select-none text-left"
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
                                    ))}
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
                                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                    {sharedLinks.map((msg, i) => {
                                        const url = msg.text.match(/(https?:\/\/[^\s]+)/gi)?.[0] || "#";
                                        return (
                                            <a 
                                                key={i} 
                                                href={url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 p-2 bg-base-200/50 hover:bg-base-200 border border-base-300 rounded-lg transition-colors select-none text-left"
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
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-[11px] text-base-content/40 italic p-2 border border-dashed border-base-300 rounded-lg text-center">
                                    Chưa chia sẻ liên kết nào
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Dangerous Action Footer */}
                    <div className="p-4 border-t border-base-300 bg-base-200/20">
                        <button 
                            onClick={() => {
                                if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử cuộc trò chuyện này không? Hành động này không thể hoàn tác.")) {
                                    clearMessages();
                                }
                            }}
                            className="btn btn-error btn-outline btn-sm w-full gap-2 text-xs flex items-center justify-center font-bold"
                        >
                            <Trash2 className="size-4" />
                            <span>Xóa lịch sử trò chuyện</span>
                        </button>
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
        </div>
    );
};

export default ChatContainer;
