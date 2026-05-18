import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { 
    Image, 
    Send, 
    X, 
    Quote, 
    Smile, 
    Paperclip, 
    Type, 
    ThumbsUp 
} from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const [fileAttachment, setFileAttachment] = useState(null); // { url, name, size }
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [formatOpen, setFormatOpen] = useState(false);

    const fileInputRef = useRef(null);
    const docInputRef = useRef(null);
    const inputRef = useRef(null);

    const { sendMessage, replyingTo, setReplyingTo, selectedUser } = useChatStore();
    const { authUser } = useAuthStore();

    const emojis = ["😀", "😂", "🤣", "❤️", "👍", "😍", "😘", "😭", "🙏", "🎉", "🔥", "🙌", "👏", "💩", "😎", "🤩", "😮", "😡"];

    const typingTimeoutRef = useRef(null);
    const isTypingRef = useRef(false);

    // Stop typing state immediately when user changes conversation
    useEffect(() => {
        if (isTypingRef.current) {
            const socket = useAuthStore.getState().socket;
            if (socket && selectedUser) {
                socket.emit("typing", { recipientId: selectedUser._id, isTyping: false });
            }
            isTypingRef.current = false;
        }
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
    }, [selectedUser]);

    const handleTyping = () => {
        const socket = useAuthStore.getState().socket;
        if (!socket || !selectedUser) return;

        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socket.emit("typing", { recipientId: selectedUser._id, isTyping: true });
        }

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        typingTimeoutRef.current = setTimeout(() => {
            isTypingRef.current = false;
            socket.emit("typing", { recipientId: selectedUser._id, isTyping: false });
        }, 5000);
    };

    // Tự động focus vào ô nhập liệu khi nhấn "Trả lời"
    useEffect(() => {
        if (replyingTo && inputRef.current) {
            inputRef.current.focus();
        }
    }, [replyingTo]);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Vui lòng chọn tệp hình ảnh");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handleDocChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) { // Giới hạn 10MB
            toast.error("Vui lòng gửi tệp nhỏ hơn 10MB");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setFileAttachment({
                url: reader.result,
                name: file.name,
                size: file.size
            });
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeDoc = () => {
        setFileAttachment(null);
        if (docInputRef.current) docInputRef.current.value = "";
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        
        // Clear typing state immediately on send
        if (isTypingRef.current) {
            isTypingRef.current = false;
            const socket = useAuthStore.getState().socket;
            if (socket && selectedUser) {
                socket.emit("typing", { recipientId: selectedUser._id, isTyping: false });
            }
        }
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        
        // Lấy nội dung từ thẻ contenteditable
        const currentHtml = inputRef.current ? inputRef.current.innerHTML : "";
        let cleanText = currentHtml.trim();

        // Xóa sạch các thẻ ngắt dòng rỗng do trình duyệt sinh ra
        if (cleanText === "<br>" || cleanText === "<div><br></div>" || cleanText === "<p><br></p>") {
            cleanText = "";
        }

        if (!cleanText && !imagePreview && !fileAttachment) return;

        try {
            await sendMessage({
                text: cleanText,
                image: imagePreview,
                replyTo: replyingTo ? replyingTo._id : null,
                file: fileAttachment || null
            });

            // Reset toàn bộ form
            setText("");
            setImagePreview(null);
            setFileAttachment(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (docInputRef.current) docInputRef.current.value = "";
            if (inputRef.current) inputRef.current.innerHTML = "";
            setEmojiOpen(false);
            setFormatOpen(false);
        } catch (error) {
            console.error("Gửi tin nhắn thất bại:", error);
        }
    };

    const handleSendLike = async () => {
        // Clear typing state immediately on send
        if (isTypingRef.current) {
            isTypingRef.current = false;
            const socket = useAuthStore.getState().socket;
            if (socket && selectedUser) {
                socket.emit("typing", { recipientId: selectedUser._id, isTyping: false });
            }
        }
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }
        try {
            await sendMessage({
                text: "👍",
                image: null,
                replyTo: replyingTo ? replyingTo._id : null,
                file: null
            });
            if (replyingTo) setReplyingTo(null);
        } catch (error) {
            toast.error("Không gửi được biểu cảm");
        }
    };

    const insertFormat = (command) => {
        document.execCommand(command, false, null);
        inputRef.current?.focus();
        if (inputRef.current) {
            setText(inputRef.current.innerHTML);
        }
    };

    const insertCode = () => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        const codeElement = document.createElement("code");
        codeElement.className = "bg-base-300/80 px-1.5 py-0.5 rounded font-mono text-[11px] text-secondary-content";
        codeElement.textContent = selectedText || "Mã code";

        range.deleteContents();
        range.insertNode(codeElement);

        // Thu gọn vùng chọn về phía cuối phần tử vừa chèn
        selection.collapseToEnd();
        inputRef.current?.focus();

        if (inputRef.current) {
            setText(inputRef.current.innerHTML);
        }
    };

    const insertEmoji = (emoji) => {
        const input = inputRef.current;
        if (!input) return;

        input.focus();
        
        // Chèn văn bản trực tiếp vào vị trí con trỏ hiện tại
        document.execCommand("insertText", false, emoji);
        
        setText(input.innerHTML);
        setEmojiOpen(false);
    };

    const repliedSenderName = replyingTo
        ? replyingTo.senderId === authUser._id
            ? "Chính mình"
            : selectedUser.fullName
        : "";

    // Kiểm tra xem trường văn bản có rỗng thực sự hay không
    const isTextEmpty = () => {
        if (!text) return true;
        const clean = text.replace(/<br>/gi, "").replace(/<div>/gi, "").replace(/<\/div>/gi, "").trim();
        return clean === "";
    };

    return (
        <div className="p-4 w-full border-t border-base-300 bg-base-100/50 backdrop-blur-md relative">
            
            {/* Reply Preview Box */}
            {replyingTo && (
                <div className="mb-2.5 bg-base-200/60 rounded-lg p-2.5 flex items-center justify-between border-l-4 border-primary/80 animate-fade-in relative">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {/* Quote icon */}
                        <div className="text-primary flex-shrink-0">
                            <Quote className="size-4 rotate-180" />
                        </div>
                        {/* Thumbnail of image if replying to a photo */}
                        {replyingTo.image && (
                            <img
                                src={replyingTo.image}
                                alt="Reply Attachment"
                                className="w-8 h-8 object-cover rounded border border-base-300 flex-shrink-0"
                            />
                        )}
                        <div className="min-w-0 text-sm">
                            <p className="font-semibold text-primary text-xs">
                                Trả lời <span className="text-base-content/80 font-bold">{repliedSenderName}</span>
                            </p>
                            <p className="text-xs text-base-content/60 truncate max-w-[200px] sm:max-w-[400px]">
                                {replyingTo.image ? "[Hình ảnh]" : replyingTo.file ? `[Tệp tin: ${replyingTo.file.name}]` : replyingTo.text}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setReplyingTo(null)}
                        className="btn btn-ghost btn-circle btn-xs hover:bg-base-300/80 flex items-center justify-center text-base-content/50 hover:text-base-content"
                        type="button"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            )}

            {imagePreview && (
                <div className="mb-3 flex items-center gap-2 animate-fade-in">
                    <div className="relative">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-20 h-20 object-cover rounded-lg border border-base-300"
                        />
                        <button
                            onClick={removeImage}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300 hover:bg-base-400 transition-colors flex items-center justify-center text-base-content"
                            type="button"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>
            )}

            {/* Document File Attachment Preview */}
            {fileAttachment && (
                <div className="mb-3 flex items-center gap-3 animate-fade-in bg-base-200/90 p-2.5 rounded-lg border border-base-300 max-w-sm justify-between shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="size-4 text-primary flex-shrink-0" />
                        <div className="min-w-0">
                            <p className="text-xs font-semibold truncate text-base-content leading-tight">{fileAttachment.name}</p>
                            <p className="text-[10px] text-base-content/60 leading-none mt-1">
                                {(fileAttachment.size / 1024).toFixed(1)} KB
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={removeDoc}
                        className="btn btn-ghost btn-circle btn-xs hover:bg-base-300 text-base-content flex items-center justify-center flex-shrink-0"
                        type="button"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
            )}

            {/* Markdown Text Formatting Options Bar */}
            {formatOpen && (
                <div className="flex items-center gap-1.5 mb-2.5 bg-base-200/90 p-1 rounded-lg border border-base-300 max-w-max animate-fade-in shadow-sm select-none">
                    <button
                        type="button"
                        onClick={() => insertFormat("bold")}
                        className="btn btn-ghost btn-xs font-bold text-[11px]"
                        title="Chữ đậm"
                    >
                        B
                    </button>
                    <button
                        type="button"
                        onClick={() => insertFormat("italic")}
                        className="btn btn-ghost btn-xs italic text-[11px]"
                        title="Chữ nghiêng"
                    >
                        I
                    </button>
                    <button
                        type="button"
                        onClick={() => insertFormat("strikeThrough")}
                        className="btn btn-ghost btn-xs line-through text-[11px]"
                        title="Gạch ngang"
                    >
                        S
                    </button>
                    <button
                        type="button"
                        onClick={insertCode}
                        className="btn btn-ghost btn-xs font-mono text-[10px]"
                        title="Khối mã code"
                    >
                        &lt;/&gt;
                    </button>
                </div>
            )}

            {/* Zalo-style Toolbar Icons (Compact & clean like Zalo PC) */}
            <div className="flex items-center gap-2 mb-2 pb-1 border-b border-base-200/50 text-slate-500/80 relative select-none">
                {/* Emoji Smile */}
                <div className="relative">
                    <button 
                        type="button" 
                        onClick={() => {
                            setEmojiOpen(!emojiOpen);
                            setFormatOpen(false);
                        }} 
                        className={`w-7 h-7 flex items-center justify-center rounded hover:bg-base-200 text-slate-600 hover:text-primary transition-colors ${emojiOpen ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}`} 
                        title="Chọn biểu cảm"
                    >
                        <Smile className="size-4" />
                    </button>
                    
                    {/* Emoji Dropdown Picker */}
                    {emojiOpen && (
                        <div className="absolute left-0 bottom-8 bg-base-200 border border-base-300 p-2 rounded-lg shadow-xl grid grid-cols-6 gap-1 w-44 z-[40] animate-scale-in">
                            {emojis.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => insertEmoji(emoji)}
                                    className="text-lg hover:bg-base-300 rounded p-1 text-center transition-colors"
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Send Image */}
                <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-base-200 text-slate-600 hover:text-primary transition-colors" 
                    title="Gửi hình ảnh"
                >
                    <Image className="size-4" />
                </button>

                {/* Send File document */}
                <button 
                    type="button" 
                    onClick={() => docInputRef.current?.click()} 
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-base-200 text-slate-600 hover:text-primary transition-colors" 
                    title="Đính kèm tệp tài liệu"
                >
                    <Paperclip className="size-4" />
                </button>

                {/* Formatter bar toggle */}
                <button 
                    type="button" 
                    onClick={() => {
                        setFormatOpen(!formatOpen);
                        setEmojiOpen(false);
                    }} 
                    className={`w-7 h-7 flex items-center justify-center rounded hover:bg-base-200 text-slate-600 hover:text-primary transition-colors ${formatOpen ? "bg-primary/10 text-primary hover:bg-primary/20" : ""}`} 
                    title="Định dạng tin nhắn"
                >
                    <Type className="size-4" />
                </button>
            </div>

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <div className="flex-1 flex gap-2 relative min-w-0">
                    
                    {/* WYSIWYG ContentEditable Rich Text Area - EXACTLY like Zalo PC! */}
                    <div
                        ref={inputRef}
                        contentEditable="true"
                        onInput={(e) => {
                            setText(e.currentTarget.innerHTML);
                            handleTyping();
                        }}
                        className="w-full min-h-[40px] max-h-[120px] overflow-y-auto input input-bordered rounded-lg p-2.5 text-sm sm:text-base outline-none whitespace-pre-wrap text-left break-words pr-10"
                        placeholder={`Nhập tin nhắn tới ${selectedUser.fullName}...`}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />
                    
                    {/* Hidden Inputs */}
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                    />
                    <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                        className="hidden"
                        ref={docInputRef}
                        onChange={handleDocChange}
                    />

                    {/* Inline Emoji Selector Button */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                        <button
                            type="button"
                            onClick={() => {
                                setEmojiOpen(!emojiOpen);
                                setFormatOpen(false);
                            }}
                            className="text-base-content/50 hover:text-base-content btn btn-ghost btn-circle btn-xs flex items-center justify-center"
                            title="Chọn biểu cảm"
                        >
                            <Smile className="size-4 sm:size-5" />
                        </button>
                    </div>
                </div>

                {/* Send Button or Fast Thumbs Up like Zalo */}
                {isTextEmpty() && !imagePreview && !fileAttachment ? (
                    <button
                        type="button"
                        onClick={handleSendLike}
                        className="btn btn-ghost btn-circle btn-sm text-primary hover:bg-base-300 flex items-center justify-center flex-shrink-0 animate-scale-in"
                        title="Thích"
                    >
                        <ThumbsUp className="size-5 fill-primary/10" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        className="btn btn-primary btn-circle btn-sm flex items-center justify-center flex-shrink-0 animate-scale-in"
                        title="Gửi"
                    >
                        <Send className="size-4" />
                    </button>
                )}
            </form>
        </div>
    );
};

export default MessageInput;