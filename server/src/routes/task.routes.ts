
import { Router } from "express";

import {
  createTask,
  getProjectTasks,
  getTaskDetails,
  updateTask,
  deleteTask,
  addTaskComment,
  getTaskComments,
  getProjectActivity,
  addTaskDependency,
  removeTaskDependency,
  uploadTaskAttachment,
  getTaskAttachments,
  downloadTaskAttachment,
  deleteTaskAttachment,
} from "../controllers/task.controller.js";

import { authenticateToken } from "../middleware/auth.middleware.js";
import { authorizeOrganizationRoles } from "../middleware/role.middleware.js";
import { taskAttachmentUpload } from "../middleware/upload.middleware.js";

const router = Router();

const allRoles = ["ADMIN", "MANAGER", "DEVELOPER"] as const;

// ---------------- TASK CRUD ----------------

router.post(
  "/:organizationId/projects/:projectId/tasks",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  createTask
);

router.get(
  "/:organizationId/projects/:projectId/tasks",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  getProjectTasks
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  getTaskDetails
);

router.patch(
  "/:organizationId/projects/:projectId/tasks/:taskId",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  updateTask
);

router.delete(
  "/:organizationId/projects/:projectId/tasks/:taskId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  deleteTask
);

// ---------------- TASK COMMENTS ----------------

router.post(
  "/:organizationId/projects/:projectId/tasks/:taskId/comments",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  addTaskComment
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId/comments",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  getTaskComments
);

// ---------------- PROJECT ACTIVITY ----------------

router.get(
  "/:organizationId/projects/:projectId/activity",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  getProjectActivity
);

// ---------------- TASK DEPENDENCIES ----------------

router.post(
  "/:organizationId/projects/:projectId/tasks/:taskId/dependencies",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  addTaskDependency
);

router.delete(
  "/:organizationId/projects/:projectId/tasks/:taskId/dependencies/:dependencyTaskId",
  authenticateToken,
  authorizeOrganizationRoles("ADMIN", "MANAGER"),
  removeTaskDependency
);

// ---------------- TASK ATTACHMENTS ----------------

router.post(
  "/:organizationId/projects/:projectId/tasks/:taskId/attachments",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  taskAttachmentUpload,
  uploadTaskAttachment
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId/attachments",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  getTaskAttachments
);

router.get(
  "/:organizationId/projects/:projectId/tasks/:taskId/attachments/:attachmentId/download",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  downloadTaskAttachment
);

router.delete(
  "/:organizationId/projects/:projectId/tasks/:taskId/attachments/:attachmentId",
  authenticateToken,
  authorizeOrganizationRoles(...allRoles),
  deleteTaskAttachment
);

export default router;
