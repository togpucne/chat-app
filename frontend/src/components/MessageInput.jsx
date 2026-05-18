import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Quote } from "lucide-react";
import toast from "react-hot-toast";

const MessageInput = () => {
    const [text, setText] = useState("");
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);
    const { sendMessage, replyingTo, setReplyingTo, selectedUser } = useChatStore();
    const { authUser } = useAuthStore();

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!text.trim() && !imagePreview) return;

        try {
            await sendMessage({
                text: text.trim(),
                image: imagePreview,
            });

            // Clear form
            setText("");
            setImagePreview(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        } catch (error) {
            console.error("Failed to send message:", error);
        }
    };

    const repliedSenderName = replyingTo
        ? replyingTo.senderId === authUser._id
            ? "Chính mình"
            : selectedUser.fullName
        : "";

    return (
        <div className="p-4 w-full">
            {/* Reply Preview Box */}
            {replyingTo && (
                <div className="mb-2 bg-base-200/60 rounded-lg p-2.5 flex items-center justify-between border-l-4 border-primary/80 animate-fade-in relative">
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
                                {replyingTo.image ? "[Hình ảnh]" : replyingTo.text}
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
                <div className="mb-3 flex items-center gap-2">
                    <div className="relative">
                        <img
                            src={imagePreview}
                            alt="Preview"
                            className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
                        />
                        <button
                            onClick={removeImage}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
                            type="button"
                        >
                            <X className="size-3" />
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        className="w-full input input-bordered rounded-lg input-sm sm:input-md"
                        placeholder="Nhập tin nhắn..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                    />
                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImageChange}
                    />

                    <button
                        type="button"
                        className={`hidden sm:flex btn btn-circle
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Image size={20} />
                    </button>
                </div>
                <button
                    type="submit"
                    className="btn btn-sm btn-circle"
                    disabled={!text.trim() && !imagePreview}
                >
                    <Send size={22} />
                </button>
            </form>
        </div>
    );
};
export default MessageInput;