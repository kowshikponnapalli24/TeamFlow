
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

// ---------------- CREATE PROJECT ----------------


const validDateString = z.string().refine(
  (value) => !Number.isNaN(Date.parse(value)),
  { message: "Invalid date format" }
);

const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).optional(),
  startDate: validDateString.optional(),
  dueDate: validDateString.optional(),
  teamId: z.string().uuid().optional(),
});


export const createProject = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and authenticated user are required",
      });
    }

    const validation = createProjectSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid project details",
        errors: validation.error.flatten(),
      });
    }

    const {
      name,
      description,
      startDate,
      dueDate,
      teamId,
    } = validation.data;

    if (
      startDate &&
      dueDate &&
      new Date(dueDate) < new Date(startDate)
    ) {
      return res.status(400).json({
        success: false,
        message: "Due date cannot be earlier than start date",
      });
    }

    // Verify that the optional team belongs to this organization
    if (teamId) {
      const team = await prisma.team.findFirst({
        where: {
          id: teamId,
          organizationId,
        },
      });

      if (!team) {
        return res.status(404).json({
          success: false,
          message: "Team not found in this organization",
        });
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        organizationId,
        createdById: userId,
        teamId: teamId ?? null,
      },
      include: {
        team: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      project,
    });
  } catch (error) {
    console.error("Create project error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create project",
    });
  }
};

// ---------------- GET ORGANIZATION PROJECTS ----------------

export const getOrganizationProjects = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const projects = await prisma.project.findMany({
      where: {
        organizationId,
      },
      include: {
        team: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error("Get projects error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch projects",
    });
  }
};

// ---------------- GET PROJECT DETAILS ----------------

export const getProjectDetails = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    if (!organizationId || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and Project ID are required",
      });
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
      include: {
        team: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
            tasks: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    return res.status(200).json({
      success: true,
      project,
    });
  } catch (error) {
    console.error("Get project details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch project details",
    });
  }
};

// ---------------- ADD PROJECT MEMBER ----------------

const addProjectMemberSchema = z.object({
  email: z.string().email(),
});

export const addProjectMember = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    if (!organizationId || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and Project ID are required",
      });
    }

    const validation = addProjectMemberSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid member details",
        errors: validation.error.flatten(),
      });
    }

    const email = validation.data.email.toLowerCase();

    // Verify project belongs to this organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found in this organization",
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Ask them to register first.",
      });
    }

    // User must already belong to the organization
    const organizationMembership =
      await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: user.id,
        },
      });

    if (!organizationMembership) {
      return res.status(400).json({
        success: false,
        message: "User must belong to the organization first",
      });
    }

    // Prevent duplicate project membership
    const existingMembership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: "User is already a project member",
      });
    }

    const membership = await prisma.projectMember.create({
      data: {
        projectId,
        userId: user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: "Project member added successfully",
      membership,
    });
  } catch (error) {
    console.error("Add project member error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add project member",
    });
  }
};

// ---------------- REMOVE PROJECT MEMBER ----------------

export const removeProjectMember = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const projectId = Array.isArray(req.params.projectId)
      ? req.params.projectId[0]
      : req.params.projectId;

    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    if (!organizationId || !projectId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID, Project ID and User ID are required",
      });
    }

    // Verify project belongs to this organization
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found in this organization",
      });
    }

    // Verify project membership exists
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "User is not a member of this project",
      });
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Project member removed successfully",
    });
  } catch (error) {
    console.error("Remove project member error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove project member",
    });
  }
};
