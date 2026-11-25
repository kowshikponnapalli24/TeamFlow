
import { Router } from "express";

import {
  createOrganization,
  getMyOrganizations,
  getOrganizationDetails,
  getOrganizationMembers,
  addOrganizationMember,
  updateOrganization,
  updateOrganizationMemberRole,
} from "../controllers/organization.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeOrganizationRoles } from "../middleware/role.middleware.js";

const router = Router();

// Create an organization
router.post("/", authenticateToken, createOrganization);

// Get organizations belonging to the logged-in user
router.get("/", authenticateToken, getMyOrganizations);

// Get organization details
router.get(
  "/:organizationId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  getOrganizationDetails
);

// Update organization settings (Admin only)
router.patch(
  "/:organizationId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN"),
  updateOrganization
);

// Get organization members
router.get(
  "/:organizationId/members",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER", "DEVELOPER"),
  getOrganizationMembers
);
// Update organization member role (Admin only)
router.patch(
  "/:organizationId/members/:userId/role",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN"),
  updateOrganizationMemberRole
);
// Add a member (Admin only)
router.post(
  "/:organizationId/members",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN"),
  addOrganizationMember
);

export default router;
