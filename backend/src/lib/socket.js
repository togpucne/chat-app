import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",

    },
});
export function getReceiverSocketId(userId) {
    return userSocketMap[userId];
}
// used to use online users
const userSocketMap = {};
export const activeChats = {}; // userId -> recipientId


io.on("connection", (socket) => {
    console.log("A user connected", socket.id);
    const userId = socket.handshake.query.userId;
    if (userId) {
        userSocketMap[userId] = socket.id;
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("userOpenedChat", ({ openerId, recipientId }) => {
        if (openerId) {
            activeChats[openerId] = recipientId;
        }
        const recipientSocketId = userSocketMap[recipientId];
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("recipientOpenedChat", { openerId });
        }
    });

    socket.on("userBlockedRecipient", ({ blockerId, blockedId, isBlocked }) => {
        const recipientSocketId = userSocketMap[blockedId];
        if (recipientSocketId) {
            io.to(recipientSocketId).emit("blockStateChanged", { blockerId, isBlocked });
        }
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);
        delete userSocketMap[userId];
        if (userId) {
            delete activeChats[userId];
            // Update offline timestamp in MongoDB in real-time
            User.findByIdAndUpdate(userId, { updatedAt: new Date() }).catch((err) => {
                console.error("Lỗi cập nhật thời gian offline:", err.message);
            });
        }
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});
export { server, app, io };