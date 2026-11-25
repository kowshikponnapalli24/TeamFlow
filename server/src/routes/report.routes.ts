import { Router } from "express";
import { getOrganizationReports } from "../controllers/report.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeOrganizationRoles } from "../middleware/role.middleware.js";

const router = Router();

router.get(
  "/:organizationId/reports",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  getOrganizationReports
);

export default router;
