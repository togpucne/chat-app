import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessagesSkeleton from "./skeletons/MessagesSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { MoreVertical, Pin, X } from "lucide-react";

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

const ChatContainer = () => {
    const { messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages, unsubscribeFromMessages, deleteMessage, setReplyingTo, pinMessage } = useChatStore();
    const { authUser } = useAuthStore();
    const messageEndRef = useRef(null);

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
                                {latestPinned.image ? "[Hình ảnh] " : ""}{latestPinned.text || ""}
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
                                <div className="chat-header mb-1">
                                    <time className="text-xs opacity-50 ml-1">
                                        {formatMessageTime(message.createdAt)}
                                    </time>
                                </div>
                                
                                {/* Transparent wrapper grid item to position bubble and dropdown side-by-side without clipping */}
                                <div className="chat-bubble bg-transparent p-0 max-w-[85%] overflow-visible flex items-center gap-2 shadow-none before:hidden after:hidden">
                                    
                                    {/* Recall & Delete Menu for Sent Messages (appears on the left of the bubble) */}
                                    {message.senderId === authUser._id && !message.isRecalled && (
                                        <div className="dropdown dropdown-top md:dropdown-left">
                                            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-xs opacity-0 group-hover:opacity-100 transition-opacity text-base-content/50 hover:text-base-content flex items-center justify-center">
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
                                    )}

                                    {/* The Actual Visible Chat Bubble */}
                                    <div className={`chat-bubble flex flex-col relative ${message.isRecalled ? "bg-base-300/40 text-base-content/40 italic" : ""} ${message.isPinned ? "border border-primary/40 shadow-sm" : ""}`}>
                                        
                                        {/* Pinned mini status inside bubble */}
                                        {message.isPinned && (
                                            <div className="flex items-center gap-1 text-[9px] text-primary/80 font-bold mb-1 select-none uppercase tracking-wider">
                                                <Pin className="size-2.5 rotate-45 flex-shrink-0 text-primary" />
                                                <span>Đã ghim</span>
                                            </div>
                                        )}

                                        {/* Reply Context (rendered inside the bubble, above the text/image) */}
                                        {message.replyTo && (
                                            <div 
                                                onClick={() => {
                                                    const element = document.getElementById(`msg-${message.replyTo._id}`);
                                                    if (element) {
                                                        element.scrollIntoView({ behavior: "smooth", block: "center" });
                                                        // Highlight the target element briefly
                                                        element.classList.add("bg-primary/25");
                                                        setTimeout(() => {
                                                            element.classList.remove("bg-primary/25");
                                                        }, 1500);
                                                    }
                                                }}
                                                className="cursor-pointer bg-base-200/50 hover:bg-base-200/80 transition-colors text-xs px-2.5 py-1.5 rounded border-l-4 border-primary/70 mb-1.5 opacity-85 flex items-center gap-2 max-w-[200px] text-base-content"
                                            >
                                                {message.replyTo.image && (
                                                    <img 
                                                        src={message.replyTo.image} 
                                                        alt="Replied Attachment" 
                                                        className="w-6 h-6 object-cover rounded border border-base-300 flex-shrink-0"
                                                    />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-primary/80 truncate text-[10px] leading-tight">
                                                        {message.replyTo.senderId?._id === authUser._id 
                                                            ? "Chính mình" 
                                                            : message.replyTo.senderId?.fullName || "Người dùng"}
                                                    </p>
                                                    <p className="text-base-content/60 truncate text-[10px] leading-tight">
                                                        {message.replyTo.isRecalled 
                                                            ? "Tin nhắn đã bị thu hồi" 
                                                            : message.replyTo.image ? "[Hình ảnh]" : message.replyTo.text}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {message.isRecalled ? (
                                            <p className="text-sm py-1">Tin nhắn đã bị thu hồi</p>
                                        ) : (
                                            <>
                                                {message.image && (
                                                    <img
                                                        src={message.image}
                                                        alt="Attachment"
                                                        className="sm:max-w-[200px] rounded-md mb-2"
                                                    />
                                                )}
                                                {message.text && <p className="break-words">{message.text}</p>}
                                            </>
                                        )}
                                    </div>

                                    {/* Delete Menu for Received Messages (appears on the right of the bubble) */}
                                    {message.senderId !== authUser._id && !message.isRecalled && (
                                        <div className="dropdown dropdown-top md:dropdown-right">
                                            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle btn-xs opacity-0 group-hover:opacity-100 transition-opacity text-base-content/50 hover:text-base-content flex items-center justify-center">
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
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}

                <div ref={messageEndRef} />
            </div>

            <MessageInput />
        </div>
    );
};

export default ChatContainer;
