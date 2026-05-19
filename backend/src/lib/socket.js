import { Server } from "socket.io";
import http from "http";
import express from "express";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import Message from "../models/message.model.js";


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

/** groupId -> active group call session */
export const groupCallRooms = {};

function serializeGroupCall(room) {
    return {
        callId: room.callId,
        groupId: room.groupId,
        type: room.type,
        hostId: room.hostId,
        receiverName: room.receiverName,
        receiverAvatar: room.receiverAvatar,
        participants: Object.values(room.participants),
    };
}

function emitGroupCallToMembers(groupId, event, payload, excludeUserId = null) {
    Group.findById(groupId)
        .then((group) => {
            if (!group) return;
            group.members.forEach((memberId) => {
                const id = memberId.toString();
                if (excludeUserId && id === excludeUserId.toString()) return;
                const socketId = userSocketMap[id];
                if (socketId) io.to(socketId).emit(event, payload);
            });
        })
        .catch((err) => console.error("emitGroupCallToMembers:", err.message));
}

function broadcastRoom(groupId, excludeUserId = null) {
    const room = groupCallRooms[groupId];
    if (!room) return;
    emitGroupCallToMembers(groupId, "groupCallUpdated", serializeGroupCall(room), excludeUserId);
}


io.on("connection", (socket) => {
    console.log("A user connected", socket.id);
    const userId = socket.handshake.query.userId;
    if (userId) {
        userSocketMap[userId] = socket.id;
    }

    io.emit("getOnlineUsers", Object.keys(userSocketMap));

    socket.on("userOpenedChat", async ({ openerId, recipientId }) => {
        if (openerId) {
            activeChats[openerId] = recipientId;
            try {
                const group = await Group.findById(recipientId);
                if (group) {
                    await Message.updateMany(
                        { receiverId: recipientId, seenBy: { $ne: openerId } },
                        { $addToSet: { seenBy: openerId } }
                    );

                    group.members.forEach((memberId) => {
                        if (memberId.toString() !== openerId.toString()) {
                            const memberSocketId = userSocketMap[memberId.toString()];
                            if (memberSocketId) {
                                io.to(memberSocketId).emit("groupMessagesSeen", { groupId: recipientId, userId: openerId });
                            }
                        }
                    });
                }
            } catch (err) {
                console.error("Lỗi cập nhật đã xem nhóm:", err);
            }
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

    socket.on("typing", async ({ recipientId, isTyping, isGroup, senderName }) => {
        if (isGroup) {
            const group = await Group.findById(recipientId);
            if (group) {
                group.members.forEach((memberId) => {
                    if (memberId && memberId.toString() !== userId?.toString()) {
                        const memberSocketId = userSocketMap[memberId.toString()];
                        if (memberSocketId) {
                            io.to(memberSocketId).emit("typingStateChanged", { 
                                senderId: userId, 
                                isTyping, 
                                isGroup: true,
                                groupId: recipientId,
                                senderName
                            });
                        }
                    }
                });
            }
        } else {
            const recipientSocketId = userSocketMap[recipientId];
            if (recipientSocketId) {
                io.to(recipientSocketId).emit("typingStateChanged", { 
                    senderId: userId, 
                    isTyping,
                    isGroup: false,
                    senderName
                });
            }
        }
    });

    // --- 1:1 calling ---
    socket.on("callUser", ({ callerId, receiverId, type, isGroup, callerName, callerAvatar, invitedUsers, receiverName, receiverAvatar }) => {
        if (isGroup) return; // group calls use startGroupCall
        const receiverSocketId = userSocketMap[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("incomingCall", {
                callerId,
                callerName,
                callerAvatar,
                receiverId,
                receiverName,
                receiverAvatar,
                type,
                isGroup: false,
            });
        }
    });

    socket.on("webrtcSignal", ({ targetId, signal, groupId }) => {
        const targetSocketId = userSocketMap[targetId];
        if (targetSocketId) {
            io.to(targetSocketId).emit("webrtcSignal", { senderId: userId, signal, groupId });
        }
    });

    socket.on("answerCall", ({ callerId, isGroup }) => {
        if (isGroup) return;
        const callerSocketId = userSocketMap[callerId];
        if (callerSocketId) {
            io.to(callerSocketId).emit("callAccepted");
        }
    });

    socket.on("rejectCall", ({ callerId, isGroup }) => {
        if (isGroup) return;
        const callerSocketId = userSocketMap[callerId];
        if (callerSocketId) {
            io.to(callerSocketId).emit("callRejected");
        }
    });

    socket.on("endCall", ({ targetId, isGroup }) => {
        if (isGroup) return;
        const targetSocketId = userSocketMap[targetId];
        if (targetSocketId) {
            io.to(targetSocketId).emit("callEnded");
        }
    });

    // --- Group calling (room persists until last participant leaves) ---
    socket.on("getGroupCallState", ({ groupId }) => {
        const room = groupCallRooms[groupId];
        socket.emit("groupCallState", room ? serializeGroupCall(room) : null);
    });

    socket.on("startGroupCall", async ({ groupId, type, callerId, callerName, callerAvatar, receiverName, receiverAvatar, invitedUsers }) => {
        if (!groupId || !callerId) return;

        let room = groupCallRooms[groupId];
        const callId = room?.callId || `${groupId}-${Date.now()}`;

        if (!room) {
            room = {
                callId,
                groupId,
                type: type || "video",
                hostId: callerId,
                receiverName,
                receiverAvatar,
                participants: {},
            };
            groupCallRooms[groupId] = room;
        }

        room.participants[callerId.toString()] = {
            userId: callerId,
            fullName: callerName,
            profilePic: callerAvatar || "",
            joinedAt: Date.now(),
        };

        const payload = serializeGroupCall(room);
        broadcastRoom(groupId);

        const targets = new Set((invitedUsers || []).map((id) => id.toString()));
        Group.findById(groupId)
            .then((group) => {
                if (!group) return;
                group.members.forEach((memberId) => {
                    const id = memberId.toString();
                    if (id === callerId.toString()) return;
                    const socketId = userSocketMap[id];
                    if (!socketId) return;
                    if (targets.has(id) && !room.participants[id]) {
                        io.to(socketId).emit("incomingCall", {
                            callerId,
                            callerName,
                            callerAvatar,
                            receiverId: groupId,
                            receiverName,
                            receiverAvatar,
                            type: room.type,
                            isGroup: true,
                            callId: room.callId,
                            invitedUsers: Object.keys(room.participants),
                            participants: payload.participants,
                        });
                    } else {
                        io.to(socketId).emit("groupCallUpdated", payload);
                    }
                });
            })
            .catch((err) => console.error("startGroupCall:", err.message));
    });

    socket.on("joinGroupCall", ({ groupId, userId, fullName, profilePic }) => {
        const room = groupCallRooms[groupId];
        if (!room || !userId) return;

        room.participants[userId.toString()] = {
            userId,
            fullName: fullName || "Thành viên",
            profilePic: profilePic || "",
            joinedAt: Date.now(),
        };

        const payload = serializeGroupCall(room);
        emitGroupCallToMembers(groupId, "groupCallUpdated", payload);
        emitGroupCallToMembers(groupId, "groupCallParticipantJoined", {
            groupId,
            callId: room.callId,
            userId,
            fullName,
            profilePic,
            participants: payload.participants,
        });
    });

    socket.on("leaveGroupCall", ({ groupId, userId }) => {
        const room = groupCallRooms[groupId];
        if (!room || !userId) return;

        delete room.participants[userId.toString()];
        const remaining = Object.keys(room.participants).length;

        if (remaining === 0) {
            delete groupCallRooms[groupId];
            emitGroupCallToMembers(groupId, "groupCallEnded", { groupId, callId: room.callId });
            return;
        }

        const payload = serializeGroupCall(room);
        emitGroupCallToMembers(groupId, "groupCallUpdated", payload);
        emitGroupCallToMembers(groupId, "groupCallParticipantLeft", {
            groupId,
            callId: room.callId,
            userId,
            participants: payload.participants,
        });
    });

    socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);
        delete userSocketMap[userId];
        if (userId) {
            delete activeChats[userId];
            Object.keys(groupCallRooms).forEach((groupId) => {
                const room = groupCallRooms[groupId];
                if (room?.participants[userId.toString()]) {
                    delete room.participants[userId.toString()];
                    const remaining = Object.keys(room.participants).length;
                    if (remaining === 0) {
                        delete groupCallRooms[groupId];
                        emitGroupCallToMembers(groupId, "groupCallEnded", { groupId, callId: room.callId });
                    } else {
                        const payload = serializeGroupCall(room);
                        emitGroupCallToMembers(groupId, "groupCallUpdated", payload);
                        emitGroupCallToMembers(groupId, "groupCallParticipantLeft", {
                            groupId,
                            callId: room.callId,
                            userId,
                            participants: payload.participants,
                        });
                    }
                }
            });
            User.findByIdAndUpdate(userId, { updatedAt: new Date() }).catch((err) => {
                console.error("Lỗi cập nhật thời gian offline:", err.message);
            });
        }
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
    });
});
export { server, app, io };