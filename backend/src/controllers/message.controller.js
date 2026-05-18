import cloudinary from "../lib/cloudinary.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");
    return res.status(200).json(filteredUsers);
  } catch (error) {
    console.log("Lỗi lấy danh sách người dùng " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;
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
    const { text, image, replyTo } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }
    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      replyTo: replyTo || null,
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
