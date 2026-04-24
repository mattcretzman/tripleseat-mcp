/**
 * Automation tools — task generation from templates, batch updates, bulk task creation.
 */

import { ToolDefinition } from "./types.js";
import { tripleseatGet, tripleseatPost, tripleseatPut } from "../tripleseat.js";
import { truncateResponse } from "./formatters.js";

const BATCH_LIMIT = 25;

interface TaskTemplate {
  body: string;
  days_before: number;
  priority: 1 | 2 | 3;
}

const WEDDING_STANDARD: TaskTemplate[] = [
  { body: "Send initial proposal and pricing package", days_before: 90, priority: 2 },
  { body: "Follow up on proposal — schedule venue tour if not done", days_before: 60, priority: 2 },
  { body: "Collect signed contract and deposit", days_before: 45, priority: 3 },
  { body: "Menu tasting scheduling", days_before: 30, priority: 2 },
  { body: "Final menu selections due", days_before: 21, priority: 2 },
  { body: "Final walkthrough with client", days_before: 14, priority: 3 },
  { body: "Final BEO due — send to all departments", days_before: 10, priority: 3 },
  { body: "Final guest count due from client", days_before: 7, priority: 3 },
  { body: "Confirm all vendor arrivals and load-in times", days_before: 3, priority: 2 },
  { body: "Day-before setup and final checks", days_before: 1, priority: 3 },
];

const RECEPTION_ONLY: TaskTemplate[] = [
  { body: "Send initial proposal and pricing package", days_before: 60, priority: 2 },
  { body: "Follow up on proposal — schedule venue tour if not done", days_before: 45, priority: 2 },
  { body: "Collect signed contract and deposit", days_before: 30, priority: 3 },
  { body: "Menu tasting scheduling", days_before: 21, priority: 2 },
  { body: "Final menu selections due", days_before: 14, priority: 2 },
  { body: "Final walkthrough with client", days_before: 10, priority: 3 },
  { body: "Final BEO due — send to all departments", days_before: 7, priority: 3 },
  { body: "Final guest count due from client", days_before: 5, priority: 3 },
  { body: "Confirm all vendor arrivals and load-in times", days_before: 3, priority: 2 },
  { body: "Day-before setup and final checks", days_before: 1, priority: 3 },
];

const CEREMONY_ONLY: TaskTemplate[] = [
  { body: "Send initial proposal and pricing package", days_before: 60, priority: 2 },
  { body: "Collect signed contract and deposit", days_before: 30, priority: 3 },
  { body: "Schedule rehearsal", days_before: 21, priority: 2 },
  { body: "Final walkthrough with client", days_before: 14, priority: 3 },
  { body: "Day-of coordination and setup", days_before: 1, priority: 3 },
];

const TEMPLATES: Record<string, TaskTemplate[]> = {
  wedding_standard: WEDDING_STANDARD,
  reception_only: RECEPTION_ONLY,
  ceremony_only: CEREMONY_ONLY,
};

function parseEventDate(dateStr: string): Date {
  if (dateStr.includes("/")) {
    const [month, day, year] = dateStr.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

export const automationTools: ToolDefinition[] = [
  {
    name: "auto_create_tasks",
    description:
      "Generate a standard task sequence for a booking based on event date. Uses built-in wedding templates or accepts custom task lists. Automatically calculates due dates relative to the event and skips past-due tasks.",
    inputSchema: {
      type: "object",
      properties: {
        booking_id: { type: "string", description: "The booking ID to create tasks for" },
        event_date: {
          type: "string",
          description:
            "The event date (MM/DD/YYYY) — used to calculate due dates. If not provided, will be fetched from the booking.",
        },
        assignee_ids: {
          type: "array",
          items: { type: "number" },
          description: "User IDs to assign tasks to",
        },
        site_id: { type: "number", description: "Site ID for the tasks" },
        task_type_id: { type: "number", description: "Task type ID to use for all generated tasks" },
        template: {
          type: "string",
          enum: ["wedding_standard", "reception_only", "ceremony_only", "custom"],
          description: "Task template to use. Defaults to wedding_standard.",
          default: "wedding_standard",
        },
        custom_tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              body: { type: "string" },
              days_before: { type: "number", description: "Days before event date this task is due" },
              priority: { type: "number", enum: [1, 2, 3] },
            },
          },
          description: "Custom task list (only used with template='custom')",
        },
      },
      required: ["booking_id", "assignee_ids", "site_id", "task_type_id"],
    },
    execute: async (args) => {
      const {
        booking_id,
        assignee_ids,
        site_id,
        task_type_id,
        template = "wedding_standard",
        custom_tasks,
      } = args;

      let eventDateStr: string | undefined = args.event_date;

      if (!eventDateStr) {
        try {
          const { data } = await tripleseatGet(`/bookings/${booking_id}`);
          const booking = (data as any)?.booking ?? data;
          eventDateStr =
            booking?.event_date ??
            booking?.start_date ??
            booking?.event_start ??
            booking?.event?.event_start;
        } catch {
          // fall through — will error below
        }

        if (!eventDateStr) {
          return JSON.stringify({
            error:
              "Could not determine event date from booking. Please provide event_date explicitly.",
          });
        }
      }

      const eventDate = parseEventDate(eventDateStr);
      if (isNaN(eventDate.getTime())) {
        return JSON.stringify({ error: `Invalid event_date: ${eventDateStr}` });
      }

      let tasks: TaskTemplate[];
      if (template === "custom") {
        if (!custom_tasks || custom_tasks.length === 0) {
          return JSON.stringify({
            error: "custom_tasks is required when template is 'custom'.",
          });
        }
        tasks = custom_tasks;
      } else {
        tasks = TEMPLATES[template];
        if (!tasks) {
          return JSON.stringify({
            error: `Unknown template: ${template}. Use wedding_standard, reception_only, ceremony_only, or custom.`,
          });
        }
      }

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const created: Array<{ body: string; due_date: string; priority: number; status: string }> = [];
      const skipped: Array<{ body: string; due_date: string; reason: string }> = [];

      for (const task of tasks) {
        const dueDate = subtractDays(eventDate, task.days_before);
        const dueDateStr = toISODate(dueDate);

        if (dueDate < now) {
          skipped.push({ body: task.body, due_date: dueDateStr, reason: "Due date already passed" });
          continue;
        }

        try {
          await tripleseatPost(`/bookings/${booking_id}/tasks`, {
            body: task.body,
            due_date: dueDate.toISOString(),
            priority: task.priority,
            task_type_id,
            assignee_ids,
            site_id,
          });
          created.push({ body: task.body, due_date: dueDateStr, priority: task.priority, status: "created" });
        } catch (err: any) {
          created.push({
            body: task.body,
            due_date: dueDateStr,
            priority: task.priority,
            status: `failed: ${err.message ?? "unknown error"}`,
          });
        }
      }

      const formattedEventDate =
        `${eventDate.getMonth() + 1}/${String(eventDate.getDate()).padStart(2, "0")}/${eventDate.getFullYear()}`;

      const result = {
        booking_id,
        event_date: formattedEventDate,
        template,
        tasks_created: created.filter((t) => t.status === "created").length,
        tasks_skipped: skipped.length,
        skipped_reason: skipped.length > 0 ? "Due date already passed" : undefined,
        tasks: [...created, ...skipped.map((s) => ({ ...s, priority: 0, status: "skipped" }))],
      };

      return truncateResponse(JSON.stringify(result, null, 2), "auto_create_tasks");
    },
  },

  {
    name: "batch_update_events",
    description:
      "Update multiple events at once — status changes, descriptions, guest counts. Processes sequentially with detailed success/failure tracking. Capped at 25 events per batch.",
    inputSchema: {
      type: "object",
      properties: {
        event_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of event IDs to update",
        },
        updates: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["DEFINITE", "TENTATIVE", "PROSPECT", "CLOSED", "LOST"],
            },
            description: { type: "string" },
            guest_count: { type: "number" },
          },
          description: "Fields to update on all specified events",
        },
      },
      required: ["event_ids", "updates"],
    },
    execute: async (args) => {
      const { event_ids, updates } = args;

      if (!event_ids || event_ids.length === 0) {
        return JSON.stringify({ error: "event_ids must not be empty." });
      }
      if (!updates || Object.keys(updates).length === 0) {
        return JSON.stringify({ error: "updates must contain at least one field." });
      }
      if (event_ids.length > BATCH_LIMIT) {
        return JSON.stringify({
          error: `Batch limited to ${BATCH_LIMIT} events. Received ${event_ids.length}.`,
        });
      }

      const results: Array<{
        event_id: string;
        status: string;
        changes?: Record<string, any>;
        error?: string;
      }> = [];

      for (const event_id of event_ids) {
        try {
          await tripleseatPut(`/events/${event_id}`, { event: updates });
          results.push({ event_id, status: "updated", changes: updates });
        } catch (err: any) {
          results.push({ event_id, status: "failed", error: err.message ?? "unknown error" });
        }
      }

      const succeeded = results.filter((r) => r.status === "updated").length;
      const failed = results.filter((r) => r.status === "failed").length;

      return truncateResponse(
        JSON.stringify({ total: event_ids.length, succeeded, failed, results }, null, 2),
        "batch_update_events",
      );
    },
  },

  {
    name: "batch_update_leads",
    description:
      "Update multiple leads at once — status, additional information, location. Processes sequentially with detailed success/failure tracking. Capped at 25 leads per batch.",
    inputSchema: {
      type: "object",
      properties: {
        lead_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of lead IDs to update",
        },
        updates: {
          type: "object",
          properties: {
            status: { type: "string" },
            additional_information: { type: "string" },
            location_id: { type: "number" },
          },
          description: "Fields to update on all specified leads",
        },
      },
      required: ["lead_ids", "updates"],
    },
    execute: async (args) => {
      const { lead_ids, updates } = args;

      if (!lead_ids || lead_ids.length === 0) {
        return JSON.stringify({ error: "lead_ids must not be empty." });
      }
      if (!updates || Object.keys(updates).length === 0) {
        return JSON.stringify({ error: "updates must contain at least one field." });
      }
      if (lead_ids.length > BATCH_LIMIT) {
        return JSON.stringify({
          error: `Batch limited to ${BATCH_LIMIT} leads. Received ${lead_ids.length}.`,
        });
      }

      const results: Array<{
        lead_id: string;
        status: string;
        changes?: Record<string, any>;
        error?: string;
      }> = [];

      for (const lead_id of lead_ids) {
        try {
          await tripleseatPut(`/leads/${lead_id}`, { lead: updates });
          results.push({ lead_id, status: "updated", changes: updates });
        } catch (err: any) {
          results.push({ lead_id, status: "failed", error: err.message ?? "unknown error" });
        }
      }

      const succeeded = results.filter((r) => r.status === "updated").length;
      const failed = results.filter((r) => r.status === "failed").length;

      return truncateResponse(
        JSON.stringify({ total: lead_ids.length, succeeded, failed, results }, null, 2),
        "batch_update_leads",
      );
    },
  },

  {
    name: "batch_create_tasks",
    description:
      "Create the same task across multiple bookings at once. Useful for adding a task to every event in a date range. Processes sequentially with detailed success/failure tracking. Capped at 25 bookings per batch.",
    inputSchema: {
      type: "object",
      properties: {
        booking_ids: {
          type: "array",
          items: { type: "string" },
          description: "Booking IDs to create tasks on",
        },
        task: {
          type: "object",
          properties: {
            body: { type: "string", description: "Task description" },
            due_date: { type: "string", description: "Due date in ISO 8601" },
            priority: { type: "number", enum: [1, 2, 3] },
            task_type_id: { type: "number" },
            assignee_ids: { type: "array", items: { type: "number" } },
            site_id: { type: "number" },
          },
          required: ["body", "due_date", "priority", "task_type_id", "assignee_ids", "site_id"],
        },
      },
      required: ["booking_ids", "task"],
    },
    execute: async (args) => {
      const { booking_ids, task } = args;

      if (!booking_ids || booking_ids.length === 0) {
        return JSON.stringify({ error: "booking_ids must not be empty." });
      }
      if (booking_ids.length > BATCH_LIMIT) {
        return JSON.stringify({
          error: `Batch limited to ${BATCH_LIMIT} bookings. Received ${booking_ids.length}.`,
        });
      }

      const results: Array<{
        booking_id: string;
        status: string;
        error?: string;
      }> = [];

      for (const booking_id of booking_ids) {
        try {
          await tripleseatPost(`/bookings/${booking_id}/tasks`, task);
          results.push({ booking_id, status: "created" });
        } catch (err: any) {
          results.push({ booking_id, status: "failed", error: err.message ?? "unknown error" });
        }
      }

      const succeeded = results.filter((r) => r.status === "created").length;
      const failed = results.filter((r) => r.status === "failed").length;

      return truncateResponse(
        JSON.stringify(
          { total: booking_ids.length, succeeded, failed, task_body: task.body, results },
          null,
          2,
        ),
        "batch_create_tasks",
      );
    },
  },
];
