import { Router } from "express";
import {
  registerUser,
  loginUser,
  updateMyProfile,
  changeMyPassword,
} from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

router.get("/me", authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      createdAt: true,
    },
  });

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  return res.status(200).json({ success: true, user });
});

router.patch("/profile", authenticateToken, updateMyProfile);
router.patch("/password", authenticateToken, changeMyPassword);

export default router;
