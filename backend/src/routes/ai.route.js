import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getAiResponse } from "../controllers/ai.controller.js";

const router = express.Router();

router.post("/chat", protectRoute, getAiResponse);

export default router;
