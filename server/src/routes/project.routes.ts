
import { Router } from "express";

import {
  createProject,
  getOrganizationProjects,
  getProjectDetails,
  addProjectMember,
  removeProjectMember,
} from "../controllers/project.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeOrganizationRoles } from "../middleware/role.middleware.js";

const router = Router();

// Create project: Admin and Manager
router.post(
  "/:organizationId/projects",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  createProject
);

// List projects: all organization members
router.get(
  "/:organizationId/projects",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  getOrganizationProjects
);

// Project details: all organization members
router.get(
  "/:organizationId/projects/:projectId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  getProjectDetails
);

// Add project member: Admin and Manager
router.post(
  "/:organizationId/projects/:projectId/members",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  addProjectMember
);
// Remove project member: Admin and Manager
router.delete(
  "/:organizationId/projects/:projectId/members/:userId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  removeProjectMember
);

export default router;
