import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const chatSchema = z.object({
  message: z.string().trim().min(2, "Enter a question").max(2000, "Question is too long"),
});

type AssistantTask = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: Date | null;
  assignee: { name: string } | null;
};

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const formatDate = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : "No due date";

const buildWorkspaceSnapshot = async (organizationId: string) => {
  const [organization, projects, members] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, description: true },
    }),
    prisma.project.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        name: true,
        description: true,
        dueDate: true,
        tasks: {
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: {
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            assignee: { select: { name: true } },
          },
        },
      },
    }),
    prisma.organizationMember.findMany({
      where: { organizationId },
      take: 100,
      select: {
        role: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  if (!organization) return null;

  const now = new Date();
  const tasks = projects.flatMap((project) =>
    project.tasks.map((task) => ({
      ...task,
      projectName: project.name,
    }))
  );

  const isOverdue = (task: AssistantTask) =>
    Boolean(
      task.dueDate &&
      task.status !== "DONE" &&
      task.dueDate.getTime() < now.getTime()
    );

  const metrics = {
    projectCount: projects.length,
    memberCount: members.length,
    taskCount: tasks.length,
    completedTasks: tasks.filter((task) => task.status === "DONE").length,
    inProgressTasks: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    reviewTasks: tasks.filter((task) => task.status === "IN_REVIEW").length,
    blockedTasks: tasks.filter((task) => task.status === "BLOCKED").length,
    overdueTasks: tasks.filter(isOverdue).length,
    urgentTasks: tasks.filter(
      (task) => task.priority === "URGENT" && task.status !== "DONE"
    ).length,
  };

  return {
    organization,
    projects: projects.map((project) => ({
      name: project.name,
      description: project.description,
      dueDate: formatDate(project.dueDate),
      tasks: project.tasks.map((task) => ({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: formatDate(task.dueDate),
        assignee: task.assignee?.name ?? "Unassigned",
      })),
    })),
    members: members.map((member) => ({
      name: member.user.name,
      role: member.role,
    })),
    metrics,
    overdueTaskDetails: tasks
      .filter(isOverdue)
      .slice(0, 12)
      .map((task) => ({
        title: task.title,
        project: task.projectName,
        dueDate: formatDate(task.dueDate),
        assignee: task.assignee?.name ?? "Unassigned",
      })),
    blockedTaskDetails: tasks
      .filter((task) => task.status === "BLOCKED")
      .slice(0, 12)
      .map((task) => ({
        title: task.title,
        project: task.projectName,
        assignee: task.assignee?.name ?? "Unassigned",
      })),
    urgentTaskDetails: tasks
      .filter((task) => task.priority === "URGENT" && task.status !== "DONE")
      .slice(0, 12)
      .map((task) => ({
        title: task.title,
        project: task.projectName,
        status: task.status,
        assignee: task.assignee?.name ?? "Unassigned",
      })),
  };
};

type WorkspaceSnapshot = NonNullable<
  Awaited<ReturnType<typeof buildWorkspaceSnapshot>>
>;

const buildLocalReply = (message: string, snapshot: WorkspaceSnapshot) => {
  const { metrics } = snapshot;
  const question = message.toLowerCase();
  const lines: string[] = [];

  if (question.includes("overdue") || question.includes("late")) {
    lines.push(`There are ${metrics.overdueTasks} overdue task(s) in ${snapshot.organization.name}.`);
    if (snapshot.overdueTaskDetails.length) {
      lines.push(
        ...snapshot.overdueTaskDetails.map(
          (task) => `• ${task.title} — ${task.project}; due ${task.dueDate}; assignee: ${task.assignee}.`
        )
      );
    } else {
      lines.push("No overdue tasks were found in the workspace data.");
    }
  } else if (question.includes("blocked") || question.includes("blocker")) {
    lines.push(`There are ${metrics.blockedTasks} blocked task(s).`);
    if (snapshot.blockedTaskDetails.length) {
      lines.push(
        ...snapshot.blockedTaskDetails.map(
          (task) => `• ${task.title} — ${task.project}; assignee: ${task.assignee}.`
        )
      );
    } else {
      lines.push("No blocked tasks were found in the workspace data.");
    }
  } else if (
    question.includes("urgent") ||
    question.includes("priority") ||
    question.includes("priorit")
  ) {
    lines.push(`There are ${metrics.urgentTasks} unfinished urgent task(s).`);
    if (snapshot.urgentTaskDetails.length) {
      lines.push(
        ...snapshot.urgentTaskDetails.map(
          (task) => `• ${task.title} — ${task.project}; status: ${task.status}; assignee: ${task.assignee}.`
        )
      );
    } else {
      lines.push("No unfinished urgent tasks were found.");
    }
  } else if (question.includes("team") || question.includes("member")) {
    lines.push(`The workspace has ${metrics.memberCount} member(s).`);
    if (snapshot.members.length) {
      lines.push(
        ...snapshot.members.map((member) => `• ${member.name} — ${member.role}.`)
      );
    }
  } else if (question.includes("project")) {
    lines.push(`There are ${metrics.projectCount} project(s) in ${snapshot.organization.name}.`);
    if (snapshot.projects.length) {
      lines.push(
        ...snapshot.projects.map((project) => {
          const completed = project.tasks.filter((task) => task.status === "DONE").length;
          return `• ${project.name}: ${project.tasks.length} tracked task(s), ${completed} completed; due ${project.dueDate}.`;
        })
      );
    }
  } else {
    lines.push(`Here's the current workspace overview for ${snapshot.organization.name}:`);
    lines.push(
      `• ${metrics.projectCount} projects and ${metrics.memberCount} members.`,
      `• ${metrics.taskCount} tracked tasks: ${metrics.completedTasks} completed, ${metrics.inProgressTasks} in progress, ${metrics.reviewTasks} in review.`,
      `• ${metrics.overdueTasks} overdue, ${metrics.blockedTasks} blocked, and ${metrics.urgentTasks} unfinished urgent tasks.`
    );
    if (metrics.overdueTasks > 0) {
      lines.push("Suggested next step: review overdue tasks with their assignees and agree on revised due dates.");
    } else if (metrics.blockedTasks > 0) {
      lines.push("Suggested next step: review the blocked tasks and record what is needed to unblock them.");
    } else if (metrics.urgentTasks > 0) {
      lines.push("Suggested next step: confirm ownership and deadlines for urgent tasks.");
    } else {
      lines.push("No overdue, blocked, or unfinished urgent tasks were detected in the available workspace data.");
    }
  }

  return lines.join("\n");
};

const getProviderReply = async (
  message: string,
  snapshot: WorkspaceSnapshot
): Promise<string | null> => {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) return null;

  const baseUrl = (
    process.env.AI_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
  const model = process.env.AI_MODEL?.trim() || "gpt-4o-mini";

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content:
            "You are TeamFlow's project management assistant. Answer using only the supplied workspace snapshot. Do not invent projects, people, dates, or task states. If the snapshot does not contain enough information, say so. Be concise, practical, and format answers with short headings or bullets when useful.",
        },
        {
          role: "user",
          content: `Workspace snapshot:\n${JSON.stringify(snapshot)}\n\nQuestion:\n${message}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const providerMessage = await response.text().catch(() => "");
    console.error(
      `AI provider returned ${response.status}:`,
      providerMessage.slice(0, 500)
    );
    throw new Error("The AI provider could not complete the request. Check your AI provider settings.");
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error("The AI provider returned an empty response.");
  }

  return content;
};

export const chatWithAssistant = async (req: Request, res: Response) => {
  try {
    const organizationId = getParam(req.params.organizationId);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "Organization ID is required",
      });
    }

    const validation = chatSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Enter a question between 2 and 2000 characters",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    const snapshot = await buildWorkspaceSnapshot(organizationId);
    if (!snapshot) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    const providerReply = await getProviderReply(validation.data.message, snapshot);
    const reply = providerReply ?? buildLocalReply(validation.data.message, snapshot);

    return res.status(200).json({
      success: true,
      reply,
      mode: providerReply ? "provider" : "local",
      metrics: snapshot.metrics,
    });
  } catch (error) {
    console.error("AI assistant error:", error);
    return res.status(502).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "The assistant could not process your request",
    });
  }
};
