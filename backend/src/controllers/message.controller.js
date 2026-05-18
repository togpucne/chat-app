import cloudinary from "../lib/cloudinary.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io, activeChats } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const currentUser = await User.findById(loggedInUserId);
    const friendIds = currentUser.friends || [];
    const friendRequests = currentUser.friendRequests || [];
    const sentRequests = currentUser.sentRequests || [];

    const messageHistory1 = await Message.distinct("senderId", { receiverId: loggedInUserId });
    const messageHistory2 = await Message.distinct("receiverId", { senderId: loggedInUserId });
    
    const relevantUserIds = [...new Set([
      ...friendIds.map(id => id.toString()), 
      ...friendRequests.map(id => id.toString()),
      ...sentRequests.map(id => id.toString()),
      ...messageHistory1.map(id => id.toString()), 
      ...messageHistory2.map(id => id.toString())
    ])].filter(id => id !== loggedInUserId.toString());

    const filteredUsers = await User.find({
      _id: { $in: relevantUserIds },
    }).select("-password").lean();

    const usersWithMetadata = await Promise.all(
      filteredUsers.map(async (user) => {
        const lastMsg = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: user._id },
            { senderId: user._id, receiverId: loggedInUserId },
          ],
        })
        .sort({ createdAt: -1 })
        .lean();

        // Calculate unread count sent by this contact to the logged-in user
        const unreadCount = await Message.countDocuments({
          senderId: user._id,
          receiverId: loggedInUserId,
          isSeen: { $ne: true },
        });

        return {
          ...user,
          lastMessage: lastMsg || null,
          unreadCount: unreadCount || 0,
        };
      })
    );

    return res.status(200).json(usersWithMetadata);
  } catch (error) {
    console.log("Lỗi lấy danh sách người dùng " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const searchByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    const myId = req.user._id;
    if (!phone) return res.status(400).json({ message: "Vui lòng nhập số điện thoại" });
    
    const user = await User.findOne({ phoneNumber: phone, _id: { $ne: myId } }).select("-password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy tài khoản với số điện thoại này" });
    
    return res.status(200).json(user);
  } catch (error) {
    console.log("Lỗi tìm kiếm số điện thoại: " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendFriendRequest = async (req, res) => {
  try {
    const { id: targetId } = req.params;
    const myId = req.user._id;
    
    const targetUser = await User.findById(targetId);
    const me = await User.findById(myId);
    if (!targetUser || !me) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    if (me.friends?.includes(targetId)) return res.status(400).json({ message: "Đã là bạn bè" });
    if (me.sentRequests?.includes(targetId)) return res.status(400).json({ message: "Đã gửi lời mời trước đó" });

    if (!targetUser.friendRequests?.includes(myId)) targetUser.friendRequests.push(myId);
    if (!me.sentRequests?.includes(targetId)) me.sentRequests.push(targetId);

    await targetUser.save();
    await me.save();

    const receiverSocketId = getReceiverSocketId(targetId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("friendRequestReceived", {
        _id: me._id, fullName: me.fullName, profilePic: me.profilePic, phoneNumber: me.phoneNumber
      });
    }

    return res.status(200).json({ success: true, sentRequests: me.sentRequests });
  } catch (error) {
    console.log("Lỗi gửi lời mời kết bạn: " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { id: requesterId } = req.params;
    const myId = req.user._id;

    const me = await User.findById(myId);
    const requester = await User.findById(requesterId);
    if (!me || !requester) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    me.friendRequests = me.friendRequests?.filter(id => id.toString() !== requesterId.toString()) || [];
    requester.sentRequests = requester.sentRequests?.filter(id => id.toString() !== myId.toString()) || [];

    if (!me.friends?.includes(requesterId)) me.friends.push(requesterId);
    if (!requester.friends?.includes(myId)) requester.friends.push(myId);

    await me.save();
    await requester.save();

    const requesterSocketId = getReceiverSocketId(requesterId.toString());
    if (requesterSocketId) {
      io.to(requesterSocketId).emit("friendRequestAccepted", {
        _id: me._id, fullName: me.fullName, profilePic: me.profilePic, phoneNumber: me.phoneNumber
      });
    }

    return res.status(200).json({ success: true, friends: me.friends, friendRequests: me.friendRequests });
  } catch (error) {
    console.log("Lỗi đồng ý kết bạn: " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { id: requesterId } = req.params;
    const myId = req.user._id;

    const me = await User.findById(myId);
    const requester = await User.findById(requesterId);
    if (!me || !requester) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    me.friendRequests = me.friendRequests?.filter(id => id.toString() !== requesterId.toString()) || [];
    if (requester) {
      requester.sentRequests = requester.sentRequests?.filter(id => id.toString() !== myId.toString()) || [];
      await requester.save();
    }

    await me.save();

    return res.status(200).json({ success: true, friendRequests: me.friendRequests });
  } catch (error) {
    console.log("Lỗi từ chối kết bạn: " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};


export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    // Mark all received messages as seen
    await Message.updateMany(
      { senderId: userToChatId, receiverId: myId, isSeen: { $ne: true } },
      { $set: { isSeen: true } }
    );

    // Let the sender know their messages were read
    const senderSocketId = getReceiverSocketId(userToChatId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("recipientOpenedChat", { openerId: myId });
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      deletedBy: { $ne: myId } // Filter out messages deleted by the current user
    }).populate({
      path: "replyTo",
      select: "text image senderId isRecalled",
      populate: {
        path: "senderId",
        select: "fullName"
      }
    });
    res.status(200).json(messages);
  } catch (error) {
    console.log("Lỗi lấy danh sách tin nhắn " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, replyTo, file } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }
    const isSeen = activeChats[receiverId]?.toString() === senderId.toString();

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      replyTo: replyTo || null,
      file: file || null,
      isSeen,
    });

    await newMessage.save();

    // Populate replyTo to send back complete info to sender and receiver
    const populatedMessage = await Message.findById(newMessage._id).populate({
      path: "replyTo",
      select: "text image senderId isRecalled",
      populate: {
        path: "senderId",
        select: "fullName"
      }
    });

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.log("Lỗi gửi tin nhắn!" + error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const deleteOrRecallMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { action } = req.body; // action can be "me" or "everyone"
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
    }

    if (action === "everyone") {
      // Global Recall: Must be the sender of the message
      if (message.senderId.toString() !== myId.toString()) {
        return res.status(403).json({ message: "Bạn không có quyền thu hồi tin nhắn này" });
      }
      message.isRecalled = true;
      message.text = "";
      message.image = "";
      await message.save();

      // Notify the receiver in real time via Socket.io
      const receiverId = message.receiverId.toString();
      const receiverSocketId = getReceiverSocketId(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("messageRecalled", { messageId });
      }

      return res.status(200).json(message);
    } else if (action === "me") {
      // Personal Delete: Push user ID into deletedBy array
      if (!message.deletedBy.includes(myId)) {
        message.deletedBy.push(myId);
        await message.save();
      }
      return res.status(200).json({ messageId, success: true });
    } else {
      return res.status(400).json({ message: "Hành động không hợp lệ" });
    }
  } catch (error) {
    console.log("Lỗi xử lý xóa/thu hồi tin nhắn: " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const pinMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
    }

    // Đảo ngược trạng thái ghim
    message.isPinned = !message.isPinned;
    await message.save();

    // Nạp thông tin replyTo đầy đủ để gửi lại
    const populatedMessage = await Message.findById(message._id).populate({
      path: "replyTo",
      select: "text image senderId isRecalled",
      populate: {
        path: "senderId",
        select: "fullName"
      }
    });

    // Xác định đối phương để gửi realtime socket
    const receiverId = message.senderId.toString() === myId.toString() ? message.receiverId : message.senderId;
    const receiverSocketId = getReceiverSocketId(receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messagePinned", populatedMessage);
    }

    return res.status(200).json(populatedMessage);
  } catch (error) {
    console.log("Lỗi ghim tin nhắn: " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const reactMessage = async (req, res) => {
  try {
    const { id: messageId } = req.params;
    const { emoji } = req.body;
    const myId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Không tìm thấy tin nhắn" });
    }

    if (!message.reactions) {
      message.reactions = [];
    }

    const existingReactionIndex = message.reactions.findIndex(
      (r) => r.userId.toString() === myId.toString()
    );

    if (existingReactionIndex > -1) {
      if (message.reactions[existingReactionIndex].emoji === emoji) {
        message.reactions.splice(existingReactionIndex, 1);
      } else {
        message.reactions[existingReactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ userId: myId, emoji });
    }

    await message.save();

    const populatedMessage = await Message.findById(message._id).populate({
      path: "replyTo",
      select: "text image senderId isRecalled",
      populate: {
        path: "senderId",
        select: "fullName"
      }
    });

    const receiverId = message.senderId.toString() === myId.toString() ? message.receiverId : message.senderId;
    const receiverSocketId = getReceiverSocketId(receiverId.toString());
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messageReacted", populatedMessage);
    }

    return res.status(200).json(populatedMessage);
  } catch (error) {
    console.log("Lỗi thả cảm xúc tin nhắn: " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

