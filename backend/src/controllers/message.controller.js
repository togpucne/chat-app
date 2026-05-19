import mongoose from "mongoose";
import cloudinary from "../lib/cloudinary.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
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

    const myGroups = await Group.find({ members: loggedInUserId }).populate("members", "-password").lean();

    const groupsWithMetadata = await Promise.all(
      myGroups.map(async (group) => {
        const lastMsg = await Message.findOne({ receiverId: group._id })
          .sort({ createdAt: -1 })
          .populate("senderId", "fullName")
          .lean();

        let formattedLastMsg = lastMsg || null;
        if (lastMsg && lastMsg.senderId) {
          const senderName = lastMsg.senderId._id.toString() === loggedInUserId.toString() ? "Bạn" : lastMsg.senderId.fullName;
          if (lastMsg.text) {
            formattedLastMsg = {
              ...lastMsg,
              text: `${senderName}: ${lastMsg.text}`
            };
          } else if (lastMsg.image) {
            formattedLastMsg = {
              ...lastMsg,
              text: `${senderName}: [Hình ảnh]`
            };
          } else if (lastMsg.file && lastMsg.file.url) {
            formattedLastMsg = {
              ...lastMsg,
              text: `${senderName}: [Tệp đính kèm] ${lastMsg.file.name || ""}`
            };
          }
        }

        return {
          _id: group._id,
          fullName: group.name,
          profilePic: group.groupPic || "",
          isGroup: true,
          members: group.members,
          creator: group.creator,
          admins: group.admins,
          lastMessage: formattedLastMsg,
          unreadCount: 0,
          updatedAt: group.updatedAt,
        };
      })
    );

    return res.status(200).json([...usersWithMetadata, ...groupsWithMetadata]);
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

    // Check if userToChatId is a Group
    const group = await Group.findById(userToChatId);

    if (group) {
      // Group chat
      const messages = await Message.find({
        receiverId: userToChatId,
        deletedBy: { $ne: myId }
      })
      .populate("senderId", "fullName profilePic")
      .populate({
        path: "replyTo",
        select: "text image senderId isRecalled",
        populate: {
          path: "senderId",
          select: "fullName"
        }
      });
      return res.status(200).json(messages);
    }

    // Mark all received messages as seen for 1-1 chat
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
    })
    .populate("senderId", "fullName profilePic")
    .populate({
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

    // Check if receiverId is a Group
    const group = await Group.findById(receiverId);

    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    if (group) {
      // Group message
      const newMessage = new Message({
        senderId,
        receiverId, // Storing Group ID in receiverId
        text,
        image: imageUrl,
        replyTo: replyTo || null,
        file: file || null,
        isSeen: false,
      });

      await newMessage.save();

      // Populate replyTo and senderId info
      const populatedMessage = await Message.findById(newMessage._id)
        .populate("senderId", "fullName profilePic")
        .populate({
          path: "replyTo",
          select: "text image senderId isRecalled",
          populate: {
            path: "senderId",
            select: "fullName"
          }
        });

      // Notify all current members of the group
      group.members.forEach((memberId) => {
        if (memberId.toString() !== senderId.toString()) {
          const memberSocketId = getReceiverSocketId(memberId.toString());
          if (memberSocketId) {
            io.to(memberSocketId).emit("newMessage", populatedMessage);
          }
        }
      });

      return res.status(201).json(populatedMessage);
    }

    // Normal private message
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

    // Populate replyTo and senderId to send back complete info to sender and receiver
    const populatedMessage = await Message.findById(newMessage._id)
      .populate("senderId", "fullName profilePic")
      .populate({
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

export const createGroup = async (req, res) => {
  try {
    const { name, members, groupPic } = req.body;
    const creatorId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: "Vui lòng nhập tên nhóm" });
    }

    const groupMembers = [creatorId];
    if (members && Array.isArray(members)) {
      members.forEach((memberId) => {
        if (memberId && !groupMembers.some(m => m.toString() === memberId.toString())) {
          groupMembers.push(memberId);
        }
      });
    }

    if (groupMembers.length < 3) {
      return res.status(400).json({ message: "Nhóm chat phải có từ 3 thành viên trở lên" });
    }

    let imageUrl = "";
    if (groupPic) {
      const uploadResponse = await cloudinary.uploader.upload(groupPic);
      imageUrl = uploadResponse.secure_url;
    }

    const newGroup = new Group({
      name,
      groupPic: imageUrl,
      creator: creatorId,
      members: groupMembers,
      admins: [creatorId],
    });

    await newGroup.save();

    const populatedGroup = await Group.findById(newGroup._id).populate(
      "members",
      "-password"
    );

    // Send system message
    const systemMessage = new Message({
      senderId: creatorId,
      receiverId: newGroup._id,
      text: `đã tạo nhóm "${name}"`,
    });
    await systemMessage.save();

    // Emit groupCreated socket to all members
    groupMembers.forEach((memberId) => {
      const receiverSocketId = getReceiverSocketId(memberId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("groupCreated", populatedGroup);
      }
    });

    res.status(201).json(populatedGroup);
  } catch (error) {
    console.log("Lỗi tạo nhóm: " + error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const addGroupMembers = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { members } = req.body;
    const myId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    }

    // Clean nulls or undefined values from group.members
    group.members = group.members.filter(m => m !== null && m !== undefined);

    const isMeInGroup = group.members.some(m => m.toString() === myId.toString());
    if (!isMeInGroup) {
      return res.status(403).json({ message: "Bạn không có quyền thêm thành viên" });
    }

    const addedMembers = [];
    const addedNames = [];

    for (const memberId of members) {
      if (!memberId) continue;
      const isAlreadyInGroup = group.members.some(m => m.toString() === memberId.toString());
      if (!isAlreadyInGroup) {
        group.members.push(memberId);
        addedMembers.push(memberId);

        const user = await User.findById(memberId);
        if (user) {
          addedNames.push(user.fullName);
        }
      }
    }

    let populatedGroup = null;
    if (addedMembers.length > 0) {
      await group.save();

      // Create a system message in group
      const systemMessage = new Message({
        senderId: myId,
        receiverId: group._id,
        text: `đã thêm ${addedNames.join(", ")} vào nhóm`,
      });
      await systemMessage.save();

      populatedGroup = await Group.findById(group._id).populate("members", "-password");

      // Notify members via socket
      group.members.forEach((memberId) => {
        if (!memberId) return;
        const receiverSocketId = getReceiverSocketId(memberId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("groupUpdated", populatedGroup);
          io.to(receiverSocketId).emit("newMessage", systemMessage);
        }
      });
    }

    const responseGroup = populatedGroup || await Group.findById(group._id).populate("members", "-password");
    res.status(200).json(responseGroup);
  } catch (error) {
    console.log("Lỗi thêm thành viên: " + error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const removeGroupMember = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { memberId } = req.body;
    const myId = req.user._id;

    if (!memberId) {
      return res.status(400).json({ message: "Thiếu ID thành viên cần xóa" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    }

    // Clean nulls or undefined values from group.members and group.admins
    group.members = group.members.filter(m => m !== null && m !== undefined);
    group.admins = group.admins.filter(a => a !== null && a !== undefined);

    // Only creator / admin can remove members
    const isAdmin = group.admins.some((adminId) => adminId.toString() === myId.toString());
    const isCreator = group.creator.toString() === myId.toString();

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ message: "Chỉ trưởng nhóm mới được xóa thành viên" });
    }

    // Cannot remove oneself (use leave group instead)
    if (memberId.toString() === myId.toString()) {
      return res.status(400).json({ message: "Không thể tự xóa chính mình. Hãy dùng tính năng rời nhóm" });
    }

    const isMemberInGroup = group.members.some((m) => m.toString() === memberId.toString());
    if (!isMemberInGroup) {
      return res.status(400).json({ message: "Thành viên này không có trong nhóm" });
    }

    // Safely remove using atomic MongoDB operation
    // Must convert string memberId to ObjectId for $pull to match correctly
    const memberObjectId = new mongoose.Types.ObjectId(memberId);
    const updateResult = await Group.findByIdAndUpdate(groupId, {
      $pull: {
        members: memberObjectId,
        admins: memberObjectId
      }
    }, { new: true });

    const removedUser = await User.findById(memberId);
    const removedName = removedUser ? removedUser.fullName : "Thành viên";

    // Create a system message in group
    const systemMessage = new Message({
      senderId: myId,
      receiverId: group._id,
      text: `đã xóa ${removedName} khỏi nhóm`,
    });
    await systemMessage.save();

    // Populate the already updated document to ensure it is 100% in sync
    const populatedGroup = await updateResult.populate("members", "-password");

    // Notify ALL members (including the one removed so they know they are no longer in the group)
    // Use the updated list from updateResult plus the removed member
    const allNotifiedMembers = [...updateResult.members, memberId];
    allNotifiedMembers.forEach((mId) => {
      if (!mId) return;
      const receiverSocketId = getReceiverSocketId(mId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("groupUpdated", populatedGroup);
        io.to(receiverSocketId).emit("newMessage", systemMessage);
      }
    });

    res.status(200).json(populatedGroup);
  } catch (error) {
    log(`CRITICAL ERROR: ${error.message}\n${error.stack}`);
    console.log("Lỗi xóa thành viên: " + error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const myId = req.user._id;
    const { newCreatorId } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Không tìm thấy nhóm" });
    }

    // Clean nulls or undefined values from group.members and group.admins
    group.members = group.members.filter(m => m !== null && m !== undefined);
    group.admins = group.admins.filter(a => a !== null && a !== undefined);

    const isUserInGroup = group.members.some(m => m.toString() === myId.toString());
    if (!isUserInGroup) {
      return res.status(400).json({ message: "Bạn không có trong nhóm này" });
    }

    // Remove from members and admins safely using Mongoose pull
    group.members.pull(myId);
    group.admins.pull(myId);

    const leaverName = req.user.fullName;
    let systemMsgText = `đã rời khỏi nhóm`;

    if (group.members.length > 0) {
      if (group.creator.toString() === myId.toString()) {
        const targetCreator = newCreatorId && group.members.some(m => m.toString() === newCreatorId.toString())
          ? newCreatorId
          : group.members[0];
          
        group.creator = targetCreator;
        const targetCreatorIsAdmin = group.admins.some(a => a.toString() === targetCreator.toString());
        if (!targetCreatorIsAdmin) {
          group.admins.push(targetCreator);
        }

        const newLeaderUser = await User.findById(targetCreator);
        if (newLeaderUser) {
          systemMsgText = `đã rời khỏi nhóm và nhường quyền trưởng nhóm cho ${newLeaderUser.fullName}`;
        }
      }
      await group.save();

      // Create a system message in group
      const systemMessage = new Message({
        senderId: myId,
        receiverId: group._id,
        text: systemMsgText,
      });
      await systemMessage.save();

      const populatedGroup = await Group.findById(group._id).populate("members", "-password");

      // Notify ALL remaining members, and the leaver
      const allNotifiedMembers = [...group.members, myId];
      allNotifiedMembers.forEach((mId) => {
        if (!mId) return;
        const receiverSocketId = getReceiverSocketId(mId.toString());
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("groupUpdated", populatedGroup);
          io.to(receiverSocketId).emit("newMessage", systemMessage);
        }
      });
    } else {
      // Delete empty group
      await Group.deleteOne({ _id: group._id });
    }

    res.status(200).json({ message: "Rời nhóm thành công" });
  } catch (error) {
    console.log("Lỗi rời nhóm: " + error.message);
    res.status(500).json({ message: "Lỗi hệ thống" });
  }
};


