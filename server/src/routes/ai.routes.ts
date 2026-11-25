import { Router } from "express";
import { chatWithAssistant } from "../controllers/ai.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeOrganizationRoles } from "../middleware/role.middleware.js";

const router = Router();

router.post(
  "/:organizationId/ai/chat",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  chatWithAssistant
);

export default router;
