import cloudinary from "../lib/cloudinary.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import bcrypt from "bcryptjs";
export const signup = async (req, res) => {
  const { fullName, email, password, phoneNumber } = req.body;
  try {
    if (!fullName || !email || !password || !phoneNumber) {
      return res
        .status(400)
        .json({ message: "Vui lòng điền đầy đủ thông tin!" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Mật khẩu phải hơn 6 kí tự!" });
    }

    if (!/^0(3|5|7|8|9)\d{8}$/.test(phoneNumber)) {
      return res.status(400).json({ message: "Số điện thoại không hợp lệ (phải đủ 10 số và thuộc đầu số Việt Nam 03, 05, 07, 08, 09)" });
    }

    const existingUserEmail = await User.findOne({ email });
    if (existingUserEmail) {
      return res.status(400).json({ message: "Email đã được đăng ký." });
    }

    const existingUserPhone = await User.findOne({ phoneNumber });
    if (existingUserPhone) {
      return res.status(400).json({ message: "Số điện thoại đã được đăng ký." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName: fullName,
      email: email,
      password: hashPassword,
      phoneNumber: phoneNumber,
      friends: [],
      friendRequests: [],
      sentRequests: []
    });

    if (newUser) {
      generateToken(newUser._id, res);
      await newUser.save();
      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        phoneNumber: newUser.phoneNumber,
        friends: newUser.friends,
        friendRequests: newUser.friendRequests,
        sentRequests: newUser.sentRequests,
      });
    } else {
      return res.status(400).json({ message: "Dữ liệu không đúng" });
    }
  } catch (error) {
    console.log("Lỗi đăng ký ", error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng điền đầy đủ thông tin!" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Email không tồn tại." });
    }

    const checkPassword = await bcrypt.compare(password, user.password);
    if (!checkPassword) {
      return res.status(400).json({ message: "Mật khẩu không chính xác." });
    }

    generateToken(user._id, res);
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
      phoneNumber: user.phoneNumber,
      friends: user.friends || [],
      friendRequests: user.friendRequests || [],
      sentRequests: user.sentRequests || [],
    });

  } catch (error) {
    console.log("Lỗi đăng nhập ", error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    return res.status(200).json({ message: "Đăng xuất thành công" });
  } catch (error) {
    console.log("Lỗi đăng xuất ", error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};


export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Vui lòng chọn ảnh đại diện." });
    }

    const updateResponse = await cloudinary.uploader.upload(profilePic);
    const updateUser = await User.findByIdAndUpdate(userId, {
      profilePic: updateResponse.secure_url
    }, { returnDocument: "after" });

    return res.status(200).json(updateUser);

  } catch (error) {
    console.log("Lỗi cập nhật ảnh đại diện " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }

}


export const checkAuth = (req, res) => {
  try {
    return res.status(200).json(req.user);
  } catch (error) {
    console.log("Lỗi check auth " + error.message);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
}