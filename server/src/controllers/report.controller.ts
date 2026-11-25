import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const isOverdue = (task: {
  dueDate: Date | null;
  status: string;
}, now: Date) =>
  Boolean(task.dueDate && task.status !== "DONE" && task.dueDate.getTime() < now.getTime());

export const getOrganizationReports = async (req: Request, res: Response) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    const userId = req.user?.userId;

    if (!organizationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID and authenticated user are required",
      });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { organizationId, userId },
      select: { role: true },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace",
      });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const [projects, organizationMembers] = await Promise.all([
      prisma.project.findMany({
        where: { organizationId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          dueDate: true,
          team: { select: { name: true } },
          tasks: {
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              assigneeId: true,
              assignee: { select: { id: true, name: true } },
            },
          },
        },
      }),
      membership.role === "DEVELOPER"
        ? Promise.resolve([])
        : prisma.organizationMember.findMany({
            where: { organizationId },
            select: {
              role: true,
              user: { select: { id: true, name: true, email: true } },
            },
          }),
    ]);

    const now = new Date();
    const isDeveloper = membership.role === "DEVELOPER";

    const scopedProjects = projects
      .map((project) => ({
        ...project,
        tasks: isDeveloper
          ? project.tasks.filter((task) => task.assigneeId === userId)
          : project.tasks,
      }))
      .filter((project) => !isDeveloper || project.tasks.length > 0);

    const tasks = scopedProjects.flatMap((project) =>
      project.tasks.map((task) => ({
        ...task,
        projectId: project.id,
        projectName: project.name,
        teamName: project.team?.name ?? "Unassigned team",
      }))
    );

    const countStatus = (status: string) =>
      tasks.filter((task) => task.status === status).length;
    const countPriority = (priority: string) =>
      tasks.filter((task) => task.priority === priority).length;

    const completedTasks = countStatus("DONE");
    const overdueTasks = tasks.filter((task) => isOverdue(task, now)).length;

    const projectReports = scopedProjects.map((project) => {
      const projectTasks = project.tasks;
      const completed = projectTasks.filter((task) => task.status === "DONE").length;
      return {
        id: project.id,
        name: project.name,
        teamName: project.team?.name ?? "Unassigned team",
        dueDate: project.dueDate,
        totalTasks: projectTasks.length,
        completedTasks: completed,
        completionRate: projectTasks.length
          ? Math.round((completed / projectTasks.length) * 100)
          : 0,
        overdueTasks: projectTasks.filter((task) => isOverdue(task, now)).length,
      };
    });

    const memberReports = isDeveloper
      ? [{
          userId,
          name: (await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }))?.name ?? "You",
          email: "",
          role: membership.role,
          assignedTasks: tasks.length,
          completedTasks,
          inProgressTasks: countStatus("IN_PROGRESS"),
          overdueTasks,
        }]
      : organizationMembers.map((member) => {
          const assigned = tasks.filter((task) => task.assigneeId === member.user.id);
          return {
            userId: member.user.id,
            name: member.user.name,
            email: member.user.email,
            role: member.role,
            assignedTasks: assigned.length,
            completedTasks: assigned.filter((task) => task.status === "DONE").length,
            inProgressTasks: assigned.filter((task) => task.status === "IN_PROGRESS").length,
            overdueTasks: assigned.filter((task) => isOverdue(task, now)).length,
          };
        });

    const statusBreakdown = [
      { status: "TODO", label: "To do", count: countStatus("TODO") },
      { status: "IN_PROGRESS", label: "In progress", count: countStatus("IN_PROGRESS") },
      { status: "IN_REVIEW", label: "In review", count: countStatus("IN_REVIEW") },
      { status: "DONE", label: "Completed", count: completedTasks },
      { status: "BLOCKED", label: "Blocked", count: countStatus("BLOCKED") },
    ];

    const priorityBreakdown = [
      { priority: "URGENT", label: "Urgent", count: countPriority("URGENT") },
      { priority: "HIGH", label: "High", count: countPriority("HIGH") },
      { priority: "MEDIUM", label: "Medium", count: countPriority("MEDIUM") },
      { priority: "LOW", label: "Low", count: countPriority("LOW") },
    ];

    const upcomingDeadlines = tasks
      .filter((task) => task.dueDate && task.status !== "DONE")
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .slice(0, 10)
      .map((task) => ({
        id: task.id,
        title: task.title,
        projectName: task.projectName,
        dueDate: task.dueDate,
        status: task.status,
        priority: task.priority,
        assigneeName: task.assignee?.name ?? "Unassigned",
      }));

    return res.status(200).json({
      success: true,
      organization,
      scope: isDeveloper ? "personal" : "workspace",
      generatedAt: now.toISOString(),
      summary: {
        totalProjects: scopedProjects.length,
        totalTasks: tasks.length,
        completedTasks,
        todoTasks: countStatus("TODO"),
        inProgressTasks: countStatus("IN_PROGRESS"),
        inReviewTasks: countStatus("IN_REVIEW"),
        blockedTasks: countStatus("BLOCKED"),
        overdueTasks,
        urgentTasks: tasks.filter(
          (task) => task.priority === "URGENT" && task.status !== "DONE"
        ).length,
        completionRate: tasks.length
          ? Math.round((completedTasks / tasks.length) * 100)
          : 0,
      },
      statusBreakdown,
      priorityBreakdown,
      projects: projectReports,
      members: memberReports,
      upcomingDeadlines,
    });
  } catch (error) {
    console.error("Get organization reports error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate workspace reports",
    });
  }
};
