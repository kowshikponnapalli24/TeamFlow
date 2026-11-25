
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { randomUUID } from "node:crypto";

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name must contain at least 2 characters"),
  description: z.string().trim().max(500).optional(),
});
const updateOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined || data.description !== undefined,
    {
      message: "At least one field must be provided",
    }
  );

// CREATE ORGANIZATION
export const createOrganization = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = createOrganizationSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { name, description } = result.data;

    // Create organization and make its creator an ADMIN
    // Generate a unique, URL-friendly organization slug
const baseSlug = name
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

const organization = await prisma.organization.create({
  data: {
    name,
    slug,
    description,
    createdBy: {
  connect: {
    id: userId,
  },
},
    members: {
      create: {
        userId,
        role: "ADMIN",
      },
    },
  },
  include: {
    members: true,
  },
});
    return res.status(201).json({
      success: true,
      message: "Organization created successfully",
      organization,
    });
  } catch (error) {
    console.error("Organization creation error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create organization",
    });
  }
};

// GET MY ORGANIZATIONS
export const getMyOrganizations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
      },
      orderBy: {
        joinedAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      count: memberships.length,
      organizations: memberships.map((membership) => ({
        ...membership.organization,
        role: membership.role,
        joinedAt: membership.joinedAt,
      })),
    });
  } catch (error) {
    console.error("Organization listing error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve organizations",
    });
  }
};



// GET ORGANIZATION DETAILS
export const getOrganizationDetails = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    return res.status(200).json({
      success: true,
      organization,
    });
  } catch (error) {
    console.error("Organization details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve organization",
    });
  }
};

// GET ORGANIZATION MEMBERS
export const getOrganizationMembers = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const members = await prisma.organizationMember.findMany({
      where: { organizationId },
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
    console.error("Organization members error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve organization members",
    });
  }
};

// ADD ORGANIZATION MEMBER
const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["MANAGER", "DEVELOPER"]),
});
const updateMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "DEVELOPER"]),
});
export const addOrganizationMember = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const result = addMemberSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid member details",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const { email, role } = result.data;

    // Find the existing user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No registered user found with this email",
      });
    }

    // Prevent duplicate membership
    const existingMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: user.id,
      },
    });

    if (existingMembership) {
      return res.status(409).json({
        success: false,
        message: "User is already a member of this organization",
      });
    }

    const membership = await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: user.id,
        role,
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
      message: "Member added successfully",
      membership,
    });
  } catch (error) {
    console.error("Add member error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add member",
    });
  }
};

// UPDATE ORGANIZATION MEMBER ROLE (ADMIN ONLY)
export const updateOrganizationMemberRole = async (
  req: Request,
  res: Response
) => {
  try {
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;

    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and User ID are required",
      });
    }

    const validation = updateMemberRoleSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const { role } = validation.data;

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: "Organization member not found",
      });
    }

    if (membership.role === role) {
      return res.status(200).json({
        success: true,
        message: "Member already has this role",
        membership,
      });
    }

    // Prevent demoting the last Admin.
    if (membership.role === "ADMIN" && role !== "ADMIN") {
      const adminCount = await prisma.organizationMember.count({
        where: {
          organizationId,
          role: "ADMIN",
        },
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: "The last Admin cannot be demoted",
        });
      }
    }

    const updatedMembership = await prisma.organizationMember.update({
      where: {
        id: membership.id,
      },
      data: {
        role,
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

    return res.status(200).json({
      success: true,
      message: "Member role updated successfully",
      membership: updatedMembership,
    });
  } catch (error) {
    console.error("Update member role error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update member role",
    });
  }
};
export const updateOrganization = async (
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

    const validation = updateOrganizationSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid organization details",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const existingOrganization =
      await prisma.organization.findUnique({
        where: { id: organizationId },
      });

    if (!existingOrganization) {
      return res.status(404).json({
        success: false,
        message: "Organization not found",
      });
    }

    const organization = await prisma.organization.update({
      where: { id: organizationId },
      data: validation.data,
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Workspace settings updated successfully",
      organization,
    });
  } catch (error) {
    console.error("Update organization error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update organization",
    });
  }
};
