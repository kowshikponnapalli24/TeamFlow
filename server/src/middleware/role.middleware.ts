
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";

type MemberRole = "ADMIN" | "MANAGER" | "DEVELOPER";

export const authorizeOrganizationRoles = (
  ...allowedRoles: MemberRole[]
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      const organizationId = Array.isArray(req.params.organizationId)
  ? req.params.organizationId[0]
  : req.params.organizationId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      if (!organizationId) {
        return res.status(400).json({
          success: false,
          message: "Organization ID is required",
        });
      }

      // Find the user's membership in this organization
      const membership = await prisma.organizationMember.findFirst({
        where: {
          userId,
          organizationId,
        },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          message: "You are not a member of this organization",
        });
      }

      // Check whether the user's role is permitted
      if (!allowedRoles.includes(membership.role)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
        });
      }

      next();
    } catch (error) {
      console.error("Authorization error:", error);

      return res.status(500).json({
        success: false,
        message: "Authorization failed",
      });
    }
  };
};
