
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(50),
  description: z.string().trim().max(500).optional(),
});

// Create a team inside an organization
export const createTeam = async (req: Request, res: Response) => {
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

    const validation = createTeamSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid team details",
        errors: validation.error.flatten(),
      });
    }

    const { name, description } = validation.data;

    const team = await prisma.team.create({
      data: {
        name,
        description,
        organizationId,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Team created successfully",
      team,
    });
  } catch (error) {
    console.error("Create team error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create team",
    });
  }
};


export const getOrganizationTeams = async (
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

    const teams = await prisma.team.findMany({
      where: {
        organizationId,
      },
      include: {
        _count: {
          select: {
            members: true,
            projects: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: teams.length,
      teams,
    });
  } catch (error) {
    console.error("Get organization teams error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve teams",
    });
  }
};


const addTeamMemberSchema = z.object({
  email: z.string().email(),
});

export const addTeamMember = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const teamId = Array.isArray(req.params.teamId)
      ? req.params.teamId[0]
      : req.params.teamId;

    if (!organizationId || !teamId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and Team ID are required",
      });
    }

    const validation = addTeamMemberSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid member details",
        errors: validation.error.flatten(),
      });
    }

    const email = validation.data.email.toLowerCase();

    // Check whether the team belongs to this organization
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

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Ask them to register first.",
      });
    }

    // Check organization membership
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

    // Prevent duplicate team membership
    const existingMembership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId: user.id,
        },
      },
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: "User is already a member of this team",
      });
    }

    const membership = await prisma.teamMember.create({
      data: {
        teamId,
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
      message: "Team member added successfully",
      membership,
    });
  } catch (error) {
    console.error("Add team member error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add team member",
    });
  }
};
export const getTeamMembers = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const teamId = Array.isArray(req.params.teamId)
      ? req.params.teamId[0]
      : req.params.teamId;

    if (!organizationId || !teamId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and Team ID are required",
      });
    }

    // Verify that the team belongs to this organization
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

    const members = await prisma.teamMember.findMany({
      where: {
        teamId,
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
      orderBy: {
        joinedAt: "asc",
      },
    });

    return res.status(200).json({
      success: true,
      count: members.length,
      members,
    });
  } catch (error) {
    console.error("Get team members error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch team members",
    });
  }
};
export const removeTeamMember = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const teamId = Array.isArray(req.params.teamId)
      ? req.params.teamId[0]
      : req.params.teamId;

    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    if (!organizationId || !teamId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID, Team ID and User ID are required",
      });
    }

    // Verify that the team belongs to this organization
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

    // Check whether the user belongs to this team
    const membership = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "User is not a member of this team",
      });
    }

    await prisma.teamMember.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: "Team member removed successfully",
    });
  } catch (error) {
    console.error("Remove team member error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove team member",
    });
  }
};
// Delete a team (Admin only)
export const deleteTeam = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const teamId = Array.isArray(req.params.teamId)
      ? req.params.teamId[0]
      : req.params.teamId;

    if (!organizationId || !teamId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and Team ID are required",
      });
    }

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

    await prisma.$transaction(async (tx) => {
      await tx.teamMember.deleteMany({
        where: { teamId },
      });

      await tx.team.delete({
        where: { id: teamId },
      });
    });

    return res.status(200).json({
      success: true,
      message: "Team deleted successfully",
    });
  } catch (error) {
    console.error("Delete team error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete team",
    });
  }
};
