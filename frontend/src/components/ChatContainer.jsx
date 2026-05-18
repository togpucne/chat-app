import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessagesSkeleton from "./skeletons/MessagesSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { MoreVertical, Pin, X, Paperclip, RotateCcw, RotateCw, Download } from "lucide-react";

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

    return <span dangerouslySetInnerHTML={{ __html: escaped }} />;
};

const ChatContainer = () => {
    const { messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages, unsubscribeFromMessages, deleteMessage, setReplyingTo, pinMessage, reactMessage } = useChatStore();
    const { authUser } = useAuthStore();
    const messageEndRef = useRef(null);

    const [viewingImage, setViewingImage] = useState(null);
    const [rotation, setRotation] = useState(0);

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

    const groupedMessages = groupMessagesByDate(messages);
    const pinnedMessages = messages.filter((m) => m.isPinned && !m.isRecalled);
    const latestPinned = pinnedMessages[pinnedMessages.length - 1];

    return (
        <div className="flex-1 flex flex-col overflow-auto relative">
            <ChatHeader />

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

                        {msgs.map((message) => (
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
                                                            <p className="break-words text-sm whitespace-pre-wrap">
                                                                {renderFormattedText(message.text)}
                                                            </p>
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

                                {/* Time displayed below the bubble (Zalo style) */}
                                <div className="chat-footer opacity-45 text-[10px] mt-1 select-none">
                                    {formatMessageTime(message.createdAt)}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                <div ref={messageEndRef} />
            </div>

            <MessageInput />

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
