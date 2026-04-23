"use strict";
/**
 * Task tools — create tasks on leads, bookings, contacts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskTools = void 0;
const tripleseat_js_1 = require("../tripleseat.js");
const TASK_PROPERTIES = {
    body: { type: "string", description: "Task description" },
    due_date: { type: "string", description: "Due date/time in ISO 8601 format" },
    priority: { type: "number", enum: [1, 2, 3], description: "Priority: 1=Low, 2=Medium, 3=High" },
    task_type_id: { type: "number", description: "Task type ID (see Sites API for available types)" },
    assignee_ids: { type: "array", items: { type: "number" }, description: "User IDs to assign the task to" },
    site_id: { type: "number", description: "Site ID the record belongs to" },
};
const TASK_REQUIRED_FIELDS = ["body", "due_date", "priority", "task_type_id", "assignee_ids", "site_id"];
exports.taskTools = [
    {
        name: "create_lead_task",
        description: "Create a task on a lead in TripleSeat.",
        inputSchema: {
            type: "object",
            properties: {
                lead_id: { type: "string", description: "The lead ID to add the task to" },
                ...TASK_PROPERTIES,
            },
            required: ["lead_id", ...TASK_REQUIRED_FIELDS],
        },
        execute: async (args) => {
            const { lead_id, ...taskFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPost)(`/leads/${lead_id}/tasks`, taskFields);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "create_booking_task",
        description: "Create a task on a booking in TripleSeat.",
        inputSchema: {
            type: "object",
            properties: {
                booking_id: { type: "string", description: "The booking ID to add the task to" },
                ...TASK_PROPERTIES,
            },
            required: ["booking_id", ...TASK_REQUIRED_FIELDS],
        },
        execute: async (args) => {
            const { booking_id, ...taskFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPost)(`/bookings/${booking_id}/tasks`, taskFields);
            return JSON.stringify(data, null, 2);
        },
    },
    {
        name: "create_contact_task",
        description: "Create a task on a contact in TripleSeat.",
        inputSchema: {
            type: "object",
            properties: {
                contact_id: { type: "string", description: "The contact ID to add the task to" },
                ...TASK_PROPERTIES,
            },
            required: ["contact_id", ...TASK_REQUIRED_FIELDS],
        },
        execute: async (args) => {
            const { contact_id, ...taskFields } = args;
            const { data } = await (0, tripleseat_js_1.tripleseatPost)(`/contacts/${contact_id}/tasks`, taskFields);
            return JSON.stringify(data, null, 2);
        },
    },
];
