import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getUsersForSidebar, getMessages, sendMessage, deleteOrRecallMessage, pinMessage, reactMessage, searchByPhone, sendFriendRequest, acceptFriendRequest, rejectFriendRequest } from "../controllers/message.controller.js";
const router = express.Router();
router.get("/search-phone", protectRoute, searchByPhone);
router.post("/friend-request/:id", protectRoute, sendFriendRequest);
router.post("/accept-friend/:id", protectRoute, acceptFriendRequest);
router.post("/reject-friend/:id", protectRoute, rejectFriendRequest);

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage);
router.post("/delete/:id", protectRoute, deleteOrRecallMessage);
router.post("/pin/:id", protectRoute, pinMessage);
router.post("/react/:id", protectRoute, reactMessage);
export default router;