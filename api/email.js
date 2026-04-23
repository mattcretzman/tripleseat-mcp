"use strict";
/**
 * Email service — sends user invite emails via Resend.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendInviteEmail = sendInviteEmail;
const resend_1 = require("resend");
const FROM_ADDRESS = "TripleSeat MCP <noreply@stormbreakerdigital.com>";
const MCP_URL = "https://tripleseat-mcp.vercel.app/mcp";
function getResend() {
    const key = process.env.RESEND_API_KEY;
    if (!key)
        throw new Error("RESEND_API_KEY environment variable not set");
    return new resend_1.Resend(key);
}
async function sendInviteEmail(params) {
    try {
        const resend = getResend();
        const { data, error } = await resend.emails.send({
            from: FROM_ADDRESS,
            to: params.to,
            subject: "You've been invited to TripleSeat MCP",
            html: inviteEmailHtml(params),
        });
        if (error) {
            console.error("[Email] Resend error:", error);
            return { success: false, error: error.message };
        }
        console.log("[Email] Invite sent to", params.to, "id:", data?.id);
        return { success: true };
    }
    catch (err) {
        console.error("[Email] Send failed:", err.message);
        return { success: false, error: err.message };
    }
}
function inviteEmailHtml(params) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#141414;border:1px solid #262626;border-radius:12px;padding:40px;margin-bottom:24px;">
      <h1 style="color:#ededed;font-size:22px;font-weight:600;margin:0 0 8px 0;">You're In</h1>
      <p style="color:#888;font-size:14px;margin:0 0 32px 0;">${esc(params.invitedBy)} invited you to access TripleSeat data through Claude AI.</p>

      <div style="background:#0a0a0a;border:1px solid #262626;border-radius:8px;padding:20px;margin-bottom:24px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 0;color:#888;font-size:13px;width:100px;">Email</td>
            <td style="padding:6px 0;color:#ededed;font-size:14px;font-family:'SF Mono','Fira Code',Menlo,monospace;">${esc(params.to)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#888;font-size:13px;">Password</td>
            <td style="padding:6px 0;color:#ededed;font-size:14px;font-family:'SF Mono','Fira Code',Menlo,monospace;">${esc(params.password)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:#888;font-size:13px;">Role</td>
            <td style="padding:6px 0;color:#ededed;font-size:14px;">${esc(params.roleName)}</td>
          </tr>
        </table>
      </div>

      <h2 style="color:#ededed;font-size:16px;font-weight:600;margin:0 0 16px 0;">How to Connect</h2>

      <div style="margin-bottom:16px;">
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
          <span style="background:#0070f3;color:white;font-size:12px;font-weight:600;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">1</span>
          <span style="color:#ededed;font-size:14px;line-height:22px;">Open <a href="https://claude.ai" style="color:#0070f3;text-decoration:none;">claude.ai</a> and go to <strong style="color:#ededed;">Settings &rarr; Connectors &rarr; Add Custom Connector</strong></span>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
          <span style="background:#0070f3;color:white;font-size:12px;font-weight:600;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">2</span>
          <span style="color:#ededed;font-size:14px;line-height:22px;">Paste this URL:</span>
        </div>
        <div style="background:#0a0a0a;border:1px solid #262626;border-radius:6px;padding:12px 16px;margin-left:34px;margin-bottom:12px;">
          <code style="color:#0070f3;font-size:13px;font-family:'SF Mono','Fira Code',Menlo,monospace;word-break:break-all;">${esc(MCP_URL)}</code>
        </div>
        <div style="display:flex;align-items:flex-start;margin-bottom:12px;">
          <span style="background:#0070f3;color:white;font-size:12px;font-weight:600;width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-right:12px;flex-shrink:0;">3</span>
          <span style="color:#ededed;font-size:14px;line-height:22px;">When prompted, sign in with the email and password above</span>
        </div>
      </div>

      <p style="color:#888;font-size:13px;margin:24px 0 0 0;">Once connected, just ask Claude about events, leads, bookings, or contacts and it will query TripleSeat in real time.</p>
    </div>

    <p style="color:#555;font-size:12px;text-align:center;margin:0;">
      TripleSeat MCP &middot; Stormbreaker Digital
    </p>
  </div>
</body>
</html>`;
}
function esc(s) {
    return s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
