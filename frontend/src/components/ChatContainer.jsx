import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessagesSkeleton from "./skeletons/MessagesSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { MoreVertical } from "lucide-react";

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

// Định dạng ngày hiển thị ở giữa đoạn chat (Ví dụ: T5 14/05/2026)
const formatDateHeader = (dateString) => {
    const date = new Date(dateString);
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const dayName = days[date.getDay()];
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dayName} ${dd}/${mm}/${yyyy}`;
};

const ChatContainer = () => {
    const { messages, getMessages, isMessagesLoading, selectedUser, subscribeToMessages, unsubscribeFromMessages, deleteMessage } = useChatStore();
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

    return (
        <div className="flex-1 flex flex-col overflow-auto">
            <ChatHeader />

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => {
                    const showDateHeader = index === 0 || isDifferentDay(messages[index - 1], message);

                    return (
                        <div key={message._id}>
                            {showDateHeader && (
                                <div className="flex justify-center my-4">
                                    <span className="bg-base-300/80 text-base-content/70 px-4 py-1 rounded-full text-xs font-semibold tracking-wide shadow-sm">
                                        {formatDateHeader(message.createdAt)}
                                    </span>
                                </div>
                            )}
                            
                            <div
                                className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"} group relative`}
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
                                    <div className={`chat-bubble flex flex-col relative ${message.isRecalled ? "bg-base-300/40 text-base-content/40 italic" : ""}`}>
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
                                                    <button onClick={() => deleteMessage(message._id, "me")} className="py-1.5 hover:bg-base-300 rounded-md">
                                                        Xóa ở phía tôi
                                                    </button>
                                                </li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                <div ref={messageEndRef} />
            </div>

            <MessageInput />
        </div>
    );
};

export default ChatContainer;
