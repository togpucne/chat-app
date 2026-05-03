import jwt from "jsonwebtoken";
import User from "../models/user.model.js";


export const protectRoute = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;
        if (!token) {
            return res.status(401).json({ message: "Bạn không có quyền truy cập" });
        }

        const decode = jwt.verify(token, process.env.JWT_SECRET);
        if (!decode) {
            return res.status(401).json({ message: "Không xác thực được token!" });
        }

        const user = await User.findById(decode.userId).select("-password");
        if (!user) {
            return res.status(404).json({ message: "Không tìm thấy thông tin người dùng!" });
        }

        req.user = user;
        next();

    } catch (error) {
        console.log("Lỗi xác thực " + error.message);
        return res.status(500).json({ message: "Lỗi hệ thống" });

    }
}