
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import path from "node:path";
import { access, unlink } from "node:fs/promises";

// ---------------- HELPERS ----------------

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const taskInclude = {
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  assignee: {
    select: { id: true, name: true, email: true },
  },
  _count: {
    select: { comments: true },
  },
};

const findProject = async (
  projectId: string,
  organizationId: string
) => {
  return prisma.project.findFirst({
    where: { id: projectId, organizationId },
  });
};

const isOrganizationMember = async (
  organizationId: string,
  userId: string
) => {
  return prisma.organizationMember.findFirst({
    where: { organizationId, userId },
  });
};

const getOrganizationMemberRole = async (
  organizationId: string,
  userId: string
) => {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
    },
    select: {
      role: true,
    },
  });

  return membership?.role ?? null;
};

// ---------------- CREATE TASK ----------------

const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum([
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "BLOCKED",
  ]).optional(),
  dueDate: z.string().datetime().optional(),
  assigneeId: z.string().uuid().optional(),
  labels: z.array(z.string().trim().min(1).max(30)).optional(),
});

export const createTask = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const validation = createTaskSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid task details",
        errors: validation.error.flatten(),
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const memberRole = await getOrganizationMemberRole(
      organizationId,
      userId
    );

    if (!memberRole) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    if (memberRole !== "ADMIN" && memberRole !== "MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Only admins and managers can create tasks",
      });
    }

    const input = validation.data;

    if (input.assigneeId) {
      const member = await isOrganizationMember(
        organizationId,
        input.assigneeId
      );

      if (!member) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this organization",
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        priority: input.priority ?? "MEDIUM",
        status: input.status ?? "TODO",
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        assigneeId: input.assigneeId ?? null,
        labels: input.labels ?? [],
        completedAt: input.status === "DONE" ? new Date() : null,
        projectId,
        createdById: userId,
      },
      include: taskInclude,
    });

    await prisma.activityLog.create({
      data: {
        action: "TASK_CREATED",
        organizationId,
        userId,
        projectId,
        taskId: task.id,
      },
    });

    if (input.assigneeId && input.assigneeId !== userId) {
      await prisma.notification.create({
        data: {
          title: "New task assigned",
          message: `You have been assigned to "${task.title}"`,
          type: "TASK_ASSIGNED",
          userId: input.assigneeId,
          taskId: task.id,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    console.error("Create task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create task",
    });
  }
};

// ---------------- GET PROJECT TASKS ----------------

export const getProjectTasks = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);

    if (!organizationId || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and Project ID are required",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;

    const allowedStatuses = [
      "TODO",
      "IN_PROGRESS",
      "IN_REVIEW",
      "DONE",
      "BLOCKED",
    ];

    const allowedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status filter",
      });
    }

    if (priority && !allowedPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task priority filter",
      });
    }

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        ...(status ? { status: status as any } : {}),
        ...(priority ? { priority: priority as any } : {}),
      },
      include: taskInclude,
      orderBy: [
        { position: "asc" },
        { createdAt: "desc" },
      ],
    });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      tasks,
    });
  } catch (error) {
    console.error("Get tasks error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tasks",
    });
  }
};

// ---------------- GET TASK DETAILS ----------------

export const getTaskDetails = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);

    if (!organizationId || !projectId || !taskId) {
      return res.status(400).json({
        success: false,
        message: "Required IDs are missing",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      include: {
        ...taskInclude,
        comments: {
          include: {
            author: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            projectId: true,
          },
        },
        blocks: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            projectId: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    return res.status(200).json({
      success: true,
      task,
    });
  } catch (error) {
    console.error("Get task details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch task details",
    });
  }
};

// ---------------- UPDATE TASK ----------------

const updateTaskSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum([
    "TODO",
    "IN_PROGRESS",
    "IN_REVIEW",
    "DONE",
    "BLOCKED",
  ]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(30)).optional(),
  position: z.number().int().min(0).optional(),
});

export const updateTask = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !taskId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const validation = updateTaskSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid task update",
        errors: validation.error.flatten(),
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const existingTask = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!existingTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
      },
      select: {
        role: true,
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    const canManageTasks =
      membership.role === "ADMIN" ||
      membership.role === "MANAGER";

    if (!canManageTasks) {
      const requestedFields = Object.keys(req.body ?? {});

      const hasRestrictedFields = requestedFields.some(
        (field) => field !== "status"
      );

      if (hasRestrictedFields) {
        return res.status(403).json({
          success: false,
          message: "Developers can only update task status",
        });
      }
    }

    const input = validation.data;

    const memberRole = await getOrganizationMemberRole(
      organizationId,
      userId
    );

    if (!memberRole) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    if (memberRole === "DEVELOPER") {
      const updateFields = Object.keys(input);

      if (
        updateFields.length !== 1 ||
        updateFields[0] !== "status"
      ) {
        return res.status(403).json({
          success: false,
          message: "Developers can only update task status",
        });
      }
    }

    if (
      memberRole !== "ADMIN" &&
      memberRole !== "MANAGER" &&
      memberRole !== "DEVELOPER"
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to update this task",
      });
    }

    if (input.assigneeId) {
      const member = await isOrganizationMember(
        organizationId,
        input.assigneeId
      );

      if (!member) {
        return res.status(400).json({
          success: false,
          message: "Assignee must belong to this organization",
        });
      }
    }

    if (input.status === "DONE") {
      const taskWithUnfinishedDependencies = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          dependsOn: {
            where: { status: { not: "DONE" } },
            select: { id: true, title: true, status: true },
          },
        },
      });

      const blockedBy = taskWithUnfinishedDependencies?.dependsOn ?? [];

      if (blockedBy.length > 0) {
        return res.status(409).json({
          success: false,
          message: "This task cannot be completed because its dependencies are not finished",
          dependencies: blockedBy,
        });
      }
    }

    const updateData: {
      title?: string;
      description?: string | null;
      status?: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "BLOCKED";
      priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
      dueDate?: Date | null;
      assigneeId?: string | null;
      labels?: string[];
      position?: number;
      completedAt?: Date | null;
    } = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;

    if (input.status !== undefined) {
      updateData.status = input.status;
      updateData.completedAt =
        input.status === "DONE" ? new Date() : null;
    }

    if (input.priority !== undefined) updateData.priority = input.priority;

    if (input.dueDate !== undefined) {
      updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    if (input.assigneeId !== undefined) {
      updateData.assigneeId = input.assigneeId;
    }

    if (input.labels !== undefined) updateData.labels = input.labels;
    if (input.position !== undefined) updateData.position = input.position;

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: taskInclude,
    });

    await prisma.activityLog.create({
      data: {
        action: "TASK_UPDATED",
        organizationId,
        userId,
        projectId,
        taskId,
      },
    });

    if (
      input.assigneeId &&
      input.assigneeId !== existingTask.assigneeId &&
      input.assigneeId !== userId
    ) {
      await prisma.notification.create({
        data: {
          title: "Task assigned to you",
          message: `You have been assigned to "${task.title}"`,
          type: "TASK_ASSIGNED",
          userId: input.assigneeId,
          taskId,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    console.error("Update task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update task",
    });
  }
};

// ---------------- DELETE TASK ----------------

export const deleteTask = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !taskId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    await prisma.activityLog.create({
      data: {
        action: "TASK_DELETED",
        organizationId,
        userId,
        projectId,
        taskId,
      },
    });

    await prisma.task.delete({
      where: { id: taskId },
    });

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
    });
  } catch (error) {
    console.error("Delete task error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete task",
    });
  }
};

// ---------------- ADD COMMENT ----------------

const commentSchema = z.object({
  content: z.string().trim().min(1).max(3000),
});

export const addTaskComment = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !taskId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const validation = commentSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Comment cannot be empty",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const comment = await prisma.comment.create({
      data: {
        content: validation.data.content,
        taskId,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        action: "COMMENT_ADDED",
        organizationId,
        userId,
        projectId,
        taskId,
      },
    });

    if (task.assigneeId && task.assigneeId !== userId) {
      await prisma.notification.create({
        data: {
          title: "New task comment",
          message: `A new comment was added to "${task.title}"`,
          type: "COMMENT_ADDED",
          userId: task.assigneeId,
          taskId,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment,
    });
  } catch (error) {
    console.error("Add comment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add comment",
    });
  }
};

// ---------------- GET TASK COMMENTS ----------------

export const getTaskComments = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);

    if (!organizationId || !projectId || !taskId) {
      return res.status(400).json({
        success: false,
        message: "Required IDs are missing",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.status(200).json({
      success: true,
      count: comments.length,
      comments,
    });
  } catch (error) {
    console.error("Get comments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
    });
  }
};

// ---------------- GET PROJECT ACTIVITY ----------------

export const getProjectActivity = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);

    if (!organizationId || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Required IDs are missing",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const activities = await prisma.activityLog.findMany({
      where: {
        organizationId,
        projectId,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        task: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return res.status(200).json({
      success: true,
      count: activities.length,
      activities,
    });
  } catch (error) {
    console.error("Get activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project activity",
    });
  }
};

// ---------------- TASK DEPENDENCIES ----------------

const dependencySchema = z.object({
  dependencyTaskId: z.string().uuid(),
});

export const addTaskDependency = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !taskId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { role: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Only admins and managers can manage task dependencies",
      });
    }

    const validation = dependencySchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "A valid dependencyTaskId is required",
        errors: validation.error.flatten(),
      });
    }

    const dependencyTaskId = validation.data.dependencyTaskId;

    const [task, dependency] = await Promise.all([
      prisma.task.findFirst({
        where: { id: taskId, projectId },
        select: { id: true },
      }),
      prisma.task.findFirst({
        where: { id: dependencyTaskId, projectId },
        select: { id: true, title: true },
      }),
    ]);

    if (!task || !dependency) {
      return res.status(404).json({
        success: false,
        message: "Task and dependency must both exist in this project",
      });
    }

    if (taskId === dependencyTaskId) {
      return res.status(400).json({
        success: false,
        message: "A task cannot depend on itself",
      });
    }

    const visited = new Set<string>();
    const pending = [dependencyTaskId];

    while (pending.length > 0) {
      const currentId = pending.pop()!;

      if (currentId === taskId) {
        return res.status(409).json({
          success: false,
          message: "This dependency would create a circular dependency",
        });
      }

      if (visited.has(currentId)) continue;

      visited.add(currentId);

      const current = await prisma.task.findUnique({
        where: { id: currentId },
        select: {
          dependsOn: {
            select: { id: true },
          },
        },
      });

      for (const prerequisite of current?.dependsOn ?? []) {
        if (!visited.has(prerequisite.id)) {
          pending.push(prerequisite.id);
        }
      }
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        dependsOn: {
          connect: { id: dependencyTaskId },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        action: "TASK_DEPENDENCY_ADDED",
        details: {
          dependencyTaskId,
          dependencyTitle: dependency.title,
        },
        organizationId,
        userId,
        projectId,
        taskId,
      },
    });

    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Task dependency added successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Add task dependency error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add task dependency",
    });
  }
};

// Remove a prerequisite from a task.
export const removeTaskDependency = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const dependencyTaskId = getParam(req.params.dependencyTaskId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !taskId || !dependencyTaskId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { role: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    if (membership.role !== "ADMIN" && membership.role !== "MANAGER") {
      return res.status(403).json({
        success: false,
        message: "Only admins and managers can manage task dependencies",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: {
        id: true,
        dependsOn: {
          where: { id: dependencyTaskId },
          select: { id: true },
        },
      },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (task.dependsOn.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Dependency not found on this task",
      });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: {
        dependsOn: {
          disconnect: { id: dependencyTaskId },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        action: "TASK_DEPENDENCY_REMOVED",
        details: { dependencyTaskId },
        organizationId,
        userId,
        projectId,
        taskId,
      },
    });

    const updatedTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Task dependency removed successfully",
      task: updatedTask,
    });
  } catch (error) {
    console.error("Remove task dependency error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove task dependency",
    });
  }
};

// ---------------- TASK ATTACHMENTS ----------------

export const uploadTaskAttachment = async (
  req: Request,
  res: Response
) => {
  const file = req.file;

  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !taskId || !userId) {
      if (file) await unlink(file.path).catch(() => undefined);

      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    });

    if (!membership) {
      if (file) await unlink(file.path).catch(() => undefined);

      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      if (file) await unlink(file.path).catch(() => undefined);

      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, title: true },
    });

    if (!task) {
      if (file) await unlink(file.path).catch(() => undefined);

      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Please select a file to upload",
      });
    }

    const attachment = await prisma.taskAttachment.create({
      data: {
        originalName: file.originalname,
        storageName: file.filename,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        taskId,
        uploadedById: userId,
      },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await prisma.activityLog.create({
      data: {
        action: "TASK_ATTACHMENT_ADDED",
        details: {
          attachmentName: file.originalname,
        },
        organizationId,
        userId,
        projectId,
        taskId,
      },
    }).catch((error) => {
      console.error("Attachment activity log error:", error);
    });

    return res.status(201).json({
      success: true,
      message: "Attachment uploaded successfully",
      attachment,
    });
  } catch (error) {
    console.error("Upload attachment error:", error);

    if (file) {
      await unlink(file.path).catch(() => undefined);
    }

    return res.status(500).json({
      success: false,
      message: "Failed to upload attachment",
    });
  }
};

// ---------------- GET TASK ATTACHMENTS ----------------

export const getTaskAttachments = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const userId = req.user?.userId;

    if (!organizationId || !projectId || !taskId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const attachments = await prisma.taskAttachment.findMany({
      where: { taskId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      success: true,
      count: attachments.length,
      attachments,
    });
  } catch (error) {
    console.error("Get attachments error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch attachments",
    });
  }
};

// ---------------- DOWNLOAD TASK ATTACHMENT ----------------

export const downloadTaskAttachment = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const attachmentId = getParam(req.params.attachmentId);
    const userId = req.user?.userId;

    if (
      !organizationId ||
      !projectId ||
      !taskId ||
      !attachmentId ||
      !userId
    ) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const attachment = await prisma.taskAttachment.findFirst({
      where: {
        id: attachmentId,
        taskId,
      },
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found",
      });
    }

    const filePath = path.resolve(
      process.cwd(),
      "uploads",
      "tasks",
      attachment.storageName
    );

    await access(filePath);

    res.setHeader("Content-Type", attachment.mimeType);

    return res.download(filePath, attachment.originalName);
  } catch (error) {
    console.error("Download attachment error:", error);

    if (!res.headersSent) {
      return res.status(404).json({
        success: false,
        message: "Attachment file not found",
      });
    }
  }
};

// ---------------- DELETE TASK ATTACHMENT ----------------

export const deleteTaskAttachment = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const projectId = getParam(req.params.projectId);
    const taskId = getParam(req.params.taskId);
    const attachmentId = getParam(req.params.attachmentId);
    const userId = req.user?.userId;

    if (
      !organizationId ||
      !projectId ||
      !taskId ||
      !attachmentId ||
      !userId
    ) {
      return res.status(400).json({
        success: false,
        message: "Required information is missing",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { role: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this organization",
      });
    }

    const project = await findProject(projectId, organizationId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true },
    });

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    const attachment = await prisma.taskAttachment.findFirst({
      where: { id: attachmentId, taskId },
    });

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: "Attachment not found",
      });
    }

    const canDelete =
      membership.role === "ADMIN" ||
      membership.role === "MANAGER" ||
      attachment.uploadedById === userId;

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You can only delete attachments uploaded by you",
      });
    }

    await prisma.taskAttachment.delete({
      where: { id: attachmentId },
    });

    const filePath = path.resolve(
      process.cwd(),
      "uploads",
      "tasks",
      attachment.storageName
    );

    await unlink(filePath).catch((error) => {
      console.error("Attachment file cleanup error:", error);
    });

    await prisma.activityLog.create({
      data: {
        action: "TASK_ATTACHMENT_DELETED",
        details: {
          attachmentName: attachment.originalName,
        },
        organizationId,
        userId,
        projectId,
        taskId,
      },
    }).catch((error) => {
      console.error("Attachment activity log error:", error);
    });

    return res.status(200).json({
      success: true,
      message: "Attachment deleted successfully",
    });
  } catch (error) {
    console.error("Delete attachment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete attachment",
    });
  }
};
