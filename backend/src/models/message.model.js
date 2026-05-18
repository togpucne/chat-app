import mongoose from "mongoose";
const messageSchema = new mongoose.Schema(
    {
        senderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,

        },
        receiverId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        text: {
            type: String,
        },
        image: {
            type: String,
        },
        isRecalled: {
            type: Boolean,
            default: false,
        },
        deletedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            }
        ],
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
        file: {
            url: { type: String, default: null },
            name: { type: String, default: null },
            size: { type: Number, default: null }
        },
        reactions: [
            {
                userId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                },
                emoji: {
                    type: String,
                }
            }
        ]
    },
    {
        timestamps: true,
    },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
