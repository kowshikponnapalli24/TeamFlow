
import { Router } from "express";
import {
  createTeam,
  getOrganizationTeams,
  addTeamMember,
  getTeamMembers,
  removeTeamMember,
  deleteTeam,
} from "../controllers/team.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeOrganizationRoles } from "../middleware/role.middleware.js";


const router = Router();

// Create a team (Admin and Manager only)
router.post(
  "/:organizationId/teams",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  createTeam
);
router.get(
  "/:organizationId/teams",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  getOrganizationTeams
);
router.post(
  "/:organizationId/teams/:teamId/members",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  addTeamMember
);
// List team members (all organization members)
router.get(
  "/:organizationId/teams/:teamId/members",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  getTeamMembers
);
// Delete a team (Admin only)
router.delete(
  "/:organizationId/teams/:teamId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN"),
  deleteTeam
);
// Remove team member (Admin and Manager)
router.delete(
  "/:organizationId/teams/:teamId/members/:userId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  removeTeamMember
);
export default router;
