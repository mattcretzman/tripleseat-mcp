/**
 * Composite workflow tools — high-level operations that orchestrate
 * multiple TripleSeat API calls into single, high-value actions.
 */

import { ToolDefinition } from "./types.js";
import { tripleseatGet, tripleseatPost, formatDate } from "../tripleseat.js";
import {
  summarizeItem,
  summarizeList,
  truncateResponse,
  MAX_RESPONSE_CHARS,
  EVENT_SUMMARY_FIELDS,
  LEAD_SUMMARY_FIELDS,
  BOOKING_SUMMARY_FIELDS,
  CONTACT_SUMMARY_FIELDS,
  ACCOUNT_SUMMARY_FIELDS,
} from "./formatters.js";

function humanDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function extractEvents(data: any): any[] {
  if (Array.isArray(data)) return data;
  return (data as any)?.results || (data as any)?.data || [];
}

function computeAlerts(
  todayEvents: any[],
  weekEvents: any[],
  recentLeads: any[]
): string[] {
  const alerts: string[] = [];

  for (const ev of todayEvents) {
    if (!ev.guest_count) {
      alerts.push(
        `${ev.name || "Event #" + ev.id} today is missing a final guest count`
      );
    }
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const newLeads = recentLeads.filter((l) => {
    const created = l.created_at ? new Date(l.created_at) : null;
    return created && created >= oneDayAgo;
  });
  if (newLeads.length > 0) {
    alerts.push(
      `${newLeads.length} new lead(s) in the last 24 hours awaiting first contact`
    );
  }

  const byLocationAndDay = new Map<string, any[]>();
  for (const ev of weekEvents) {
    const loc = ev.location || ev.location_id || "unknown";
    const start = ev.event_start ? new Date(ev.event_start) : null;
    const dayKey = start
      ? `${loc}::${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`
      : null;
    if (dayKey) {
      const arr = byLocationAndDay.get(dayKey) || [];
      arr.push(ev);
      byLocationAndDay.set(dayKey, arr);
    }
  }

  for (const [key, evts] of byLocationAndDay) {
    if (evts.length < 2) continue;
    const sorted = evts
      .filter((e) => e.event_start && e.event_end)
      .sort(
        (a, b) =>
          new Date(a.event_start).getTime() -
          new Date(b.event_start).getTime()
      );

    for (let i = 0; i < sorted.length - 1; i++) {
      const endA = new Date(sorted[i].event_end);
      const startB = new Date(sorted[i + 1].event_start);
      const gapMs = startB.getTime() - endA.getTime();
      const gapHours = Math.round(gapMs / (60 * 60 * 1000));
      if (gapMs > 0 && gapHours <= 2) {
        const loc = sorted[i].location || key.split("::")[0];
        const dayStr = shortDate(new Date(sorted[i].event_start));
        alerts.push(
          `${dayStr} has back-to-back events at ${loc} — ${gapHours} hour turnover`
        );
      } else if (gapMs < 0) {
        const loc = sorted[i].location || key.split("::")[0];
        const dayStr = shortDate(new Date(sorted[i].event_start));
        alerts.push(
          `${dayStr} at ${loc} has overlapping time slots`
        );
      }
    }
  }

  return alerts;
}

export const workflowTools: ToolDefinition[] = [
  // ── 1. daily_briefing ──────────────────────────────────────────────
  {
    name: "daily_briefing",
    description:
      "Morning briefing — today's events, this week's events, recent leads, and alerts. One call to start your day.",
    inputSchema: {
      type: "object",
      properties: {
        location_id: {
          type: "string",
          description: "Filter to a specific venue (optional)",
        },
      },
    },
    execute: async (args) => {
      const now = new Date();
      const today = formatDate(now);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEndStr = formatDate(weekEnd);

      const baseParams: Record<string, string> = {};
      if (args.location_id) baseParams.location_id = args.location_id;

      const [todayRes, weekRes, leadsRes] = await Promise.all([
        tripleseatGet("/events/search", {
          ...baseParams,
          event_start_date: today,
          event_end_date: today,
          order: "event_start",
          sort_direction: "asc",
        }),
        tripleseatGet("/events/search", {
          ...baseParams,
          event_start_date: today,
          event_end_date: weekEndStr,
          order: "event_start",
          sort_direction: "asc",
        }),
        tripleseatGet("/leads/search", {
          ...baseParams,
          order: "created_at",
          sort_direction: "desc",
        }),
      ]);

      const todayEvents = extractEvents(todayRes.data);
      const weekEvents = extractEvents(weekRes.data);
      const recentLeads = extractEvents(leadsRes.data);

      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const newToday = recentLeads.filter((l) => {
        const created = l.created_at ? new Date(l.created_at) : null;
        return created && created >= oneDayAgo;
      });

      const alerts = computeAlerts(todayEvents, weekEvents, recentLeads);

      const briefing = {
        date: humanDate(now),
        today: {
          event_count: todayEvents.length,
          events: todayEvents.map((e) => summarizeItem(e, EVENT_SUMMARY_FIELDS)),
        },
        this_week: {
          event_count: weekEvents.length,
          events: weekEvents
            .slice(0, 15)
            .map((e) => summarizeItem(e, EVENT_SUMMARY_FIELDS)),
        },
        recent_leads: {
          count: recentLeads.length,
          new_today: newToday.length,
          leads: recentLeads
            .slice(0, 10)
            .map((l) => summarizeItem(l, LEAD_SUMMARY_FIELDS)),
        },
        alerts,
      };

      return truncateResponse(
        JSON.stringify(briefing, null, 2),
        "daily_briefing"
      );
    },
  },

  // ── 2. week_at_a_glance ────────────────────────────────────────────
  {
    name: "week_at_a_glance",
    description:
      "Calendar density view for the next 7 days — events grouped by day with conflict detection and turnover warnings.",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          description: "Start date (MM/DD/YYYY). Defaults to today.",
        },
        location_id: {
          type: "string",
          description: "Filter to a specific venue",
        },
      },
    },
    execute: async (args) => {
      const start = args.start_date ? new Date(args.start_date) : new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      const params: Record<string, string> = {
        event_start_date: formatDate(start),
        event_end_date: formatDate(end),
        order: "event_start",
        sort_direction: "asc",
      };
      if (args.location_id) params.location_id = args.location_id;

      const { data } = await tripleseatGet("/events/search", params);
      const events = extractEvents(data);

      const dayMap = new Map<string, any[]>();
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        dayMap.set(key, []);
      }

      for (const ev of events) {
        if (!ev.event_start) continue;
        const d = new Date(ev.event_start);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (dayMap.has(key)) {
          dayMap.get(key)!.push(ev);
        }
      }

      let totalEvents = 0;
      let busiestDay = "";
      let busiestCount = 0;
      const globalAlerts: string[] = [];

      const days: any[] = [];
      let dayIndex = 0;
      for (const [key, dayEvents] of dayMap) {
        const d = new Date(start);
        d.setDate(d.getDate() + dayIndex);
        dayIndex++;

        totalEvents += dayEvents.length;

        if (dayEvents.length > busiestCount) {
          busiestCount = dayEvents.length;
          busiestDay = `${shortDate(d)} (${dayEvents.length} events)`;
        }

        const notes: string[] = [];
        const sorted = dayEvents
          .filter((e: any) => e.event_start && e.event_end)
          .sort(
            (a: any, b: any) =>
              new Date(a.event_start).getTime() -
              new Date(b.event_start).getTime()
          );

        for (let i = 0; i < sorted.length - 1; i++) {
          const endA = new Date(sorted[i].event_end);
          const startB = new Date(sorted[i + 1].event_start);
          const gapMs = startB.getTime() - endA.getTime();
          const gapHours = Math.round(gapMs / (60 * 60 * 1000));

          if (gapMs < 0) {
            const note = `Overlapping events: ${sorted[i].name || "Event"} and ${sorted[i + 1].name || "Event"}`;
            notes.push(note);
            globalAlerts.push(`${shortDate(d)}: ${note}`);
          } else if (gapHours <= 2) {
            const endTime = endA.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            const startTime = startB.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
            });
            notes.push(
              `Back-to-back events — ${gapHours} hour turnover between ${endTime} and ${startTime}`
            );
          }
        }

        days.push({
          date: shortDate(d),
          event_count: dayEvents.length,
          events: dayEvents.map((e: any) =>
            summarizeItem(e, EVENT_SUMMARY_FIELDS)
          ),
          notes,
        });
      }

      const weekStartLabel = start.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      });
      const weekEndLabel = end.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });

      const result = {
        week_of: `${weekStartLabel} - ${weekEndLabel}`,
        total_events: totalEvents,
        days,
        busiest_day: busiestDay || "No events this week",
        alerts: globalAlerts,
      };

      return truncateResponse(
        JSON.stringify(result, null, 2),
        "week_at_a_glance"
      );
    },
  },

  // ── 3. lead_intake ─────────────────────────────────────────────────
  {
    name: "lead_intake",
    description:
      "Create a new lead with user-friendly field names and optionally check date availability in one call.",
    inputSchema: {
      type: "object",
      properties: {
        first_name: { type: "string" },
        last_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        event_date: {
          type: "string",
          description: "Requested event date (MM/DD/YYYY)",
        },
        guest_count: { type: "number" },
        event_description: {
          type: "string",
          description: "Type of event (wedding, reception, ceremony, etc.)",
        },
        location_id: {
          type: "number",
          description: "Preferred venue location ID",
        },
        additional_notes: { type: "string" },
        check_availability: {
          type: "boolean",
          description: "Also check if the requested date is available",
          default: true,
        },
      },
      required: ["first_name", "last_name", "email", "phone"],
    },
    execute: async (args) => {
      const leadPayload: Record<string, any> = {
        first_name: args.first_name,
        last_name: args.last_name,
        email_address: args.email,
        phone_number: args.phone,
      };
      if (args.event_date) leadPayload.event_date = args.event_date;
      if (args.guest_count) leadPayload.guest_count = args.guest_count;
      if (args.event_description)
        leadPayload.event_description = args.event_description;
      if (args.location_id) leadPayload.location_id = args.location_id;
      if (args.additional_notes)
        leadPayload.additional_information = args.additional_notes;

      const shouldCheck =
        args.check_availability !== false && args.event_date;

      const leadPromise = tripleseatPost("/leads", { lead: leadPayload });

      const availabilityPromise = shouldCheck
        ? tripleseatGet("/events/search", {
            event_start_date: args.event_date,
            event_end_date: args.event_date,
            order: "event_start",
            sort_direction: "asc",
          })
        : null;

      const [leadRes, availRes] = await Promise.all([
        leadPromise,
        availabilityPromise,
      ]);

      const result: Record<string, any> = {
        lead_created: true,
        lead: leadRes.data,
      };

      if (availRes) {
        const existingEvents = extractEvents(availRes.data);
        const eventDate = new Date(args.event_date);
        result.availability = {
          date: args.event_date,
          day_of_week: eventDate.toLocaleDateString("en-US", {
            weekday: "long",
          }),
          existing_event_count: existingEvents.length,
          available: existingEvents.length === 0,
          existing_events: existingEvents.map(
            (e: any) =>
              `${e.name || "Event #" + e.id} (${e.event_start || "unknown time"})`
          ),
        };
      }

      return truncateResponse(
        JSON.stringify(result, null, 2),
        "lead_intake"
      );
    },
  },

  // ── 4. smart_search ────────────────────────────────────────────────
  {
    name: "smart_search",
    description:
      "Cross-entity search — searches events, leads, bookings, contacts, and accounts simultaneously for a query.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search term — name, email, phone, event name",
        },
        entity_types: {
          type: "array",
          items: {
            type: "string",
            enum: ["events", "leads", "bookings", "contacts", "accounts"],
          },
          description: "Which entity types to search. Defaults to all.",
        },
      },
      required: ["query"],
    },
    execute: async (args) => {
      const types: string[] = args.entity_types || [
        "events",
        "leads",
        "bookings",
        "contacts",
        "accounts",
      ];

      const fieldMap: Record<string, string[]> = {
        events: EVENT_SUMMARY_FIELDS,
        leads: LEAD_SUMMARY_FIELDS,
        bookings: BOOKING_SUMMARY_FIELDS,
        contacts: CONTACT_SUMMARY_FIELDS,
        accounts: ACCOUNT_SUMMARY_FIELDS,
      };

      const endpointMap: Record<string, string> = {
        events: "/events/search",
        leads: "/leads/search",
        bookings: "/bookings/search",
        contacts: "/contacts/search",
        accounts: "/accounts/search",
      };

      const searches = types.map(async (type) => {
        try {
          const { data } = await tripleseatGet(endpointMap[type], {
            query: args.query,
          });
          const items = extractEvents(data);
          return {
            type,
            count: items.length,
            items: items
              .slice(0, 10)
              .map((item: any) => summarizeItem(item, fieldMap[type])),
          };
        } catch {
          return { type, count: 0, items: [], error: "Search failed" };
        }
      });

      const results = await Promise.all(searches);

      let totalResults = 0;
      const grouped: Record<string, any> = {};
      for (const r of results) {
        totalResults += r.count;
        grouped[r.type] = { count: r.count, items: r.items };
      }

      const response = {
        query: args.query,
        total_results: totalResults,
        results: grouped,
      };

      return truncateResponse(
        JSON.stringify(response, null, 2),
        "smart_search"
      );
    },
  },

  // ── 5. convert_lead ────────────────────────────────────────────────
  {
    name: "convert_lead",
    description:
      "Convert a lead into a booking — fetches the lead, extracts details, and creates a linked booking in one step.",
    inputSchema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "The lead ID to convert" },
        booking_name: {
          type: "string",
          description:
            "Name for the new booking (defaults to lead event_description or contact name)",
        },
        start_date: {
          type: "string",
          description:
            "Booking start date (MM/DD/YYYY). Defaults to lead's event_date.",
        },
        end_date: {
          type: "string",
          description:
            "Booking end date (MM/DD/YYYY). Defaults to start_date.",
        },
        location_id: {
          type: "number",
          description: "Location ID. Defaults to lead's location_id.",
        },
        status: {
          type: "string",
          description: "Initial booking status",
          default: "TENTATIVE",
        },
      },
      required: ["lead_id"],
    },
    execute: async (args) => {
      const { data: leadData } = await tripleseatGet(
        `/leads/${args.lead_id}`
      );

      const lead =
        (leadData as any)?.lead || (leadData as any)?.results?.[0] || leadData;

      const startDate =
        args.start_date || lead.event_date;
      if (!startDate) {
        return JSON.stringify({
          converted: false,
          error:
            "Lead has no event_date and no start_date was provided. Please supply a start_date.",
          lead: summarizeItem(lead, LEAD_SUMMARY_FIELDS),
        });
      }

      const endDate = args.end_date || startDate;
      const locationId = args.location_id || lead.location_id;
      const bookingName =
        args.booking_name ||
        lead.event_description ||
        `${lead.first_name || ""} ${lead.last_name || ""}`.trim() ||
        `Lead #${args.lead_id} Booking`;

      const bookingPayload: Record<string, any> = {
        name: bookingName,
        start_date: startDate,
        end_date: endDate,
        status: args.status || "TENTATIVE",
      };
      if (locationId) bookingPayload.location_id = locationId;
      if (lead.guest_count) bookingPayload.guest_count = lead.guest_count;
      if (lead.account_id) bookingPayload.account_id = lead.account_id;
      if (lead.contact_id) bookingPayload.contact_id = lead.contact_id;

      const { data: bookingData } = await tripleseatPost("/bookings", {
        booking: bookingPayload,
      });

      const notes: string[] = [
        `Booking created from lead #${args.lead_id}`,
      ];
      if (!args.start_date) {
        notes.push(
          `Start date set to ${startDate} from lead's requested event date`
        );
      }
      if (!args.location_id && locationId) {
        notes.push(`Location ID ${locationId} inherited from lead`);
      }

      const result = {
        converted: true,
        lead: summarizeItem(lead, LEAD_SUMMARY_FIELDS),
        booking: bookingData,
        notes,
      };

      return truncateResponse(
        JSON.stringify(result, null, 2),
        "convert_lead"
      );
    },
  },
];
