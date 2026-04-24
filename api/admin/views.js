"use strict";
/**
 * Admin dashboard HTML templates.
 * Server-rendered, dark mode, Linear/Vercel aesthetic.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginPage = loginPage;
exports.dashboardPage = dashboardPage;
const roles_js_1 = require("../roles.js");
// ── Shared Styles ──
const CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0a0a0a;
    --surface: #141414;
    --surface-hover: #1a1a1a;
    --border: #262626;
    --border-light: #333333;
    --text: #ededed;
    --text-secondary: #888888;
    --text-tertiary: #555555;
    --accent: #0070f3;
    --accent-hover: #0060d3;
    --accent-subtle: rgba(0, 112, 243, 0.1);
    --success: #00c853;
    --success-subtle: rgba(0, 200, 83, 0.1);
    --danger: #ff4444;
    --danger-subtle: rgba(255, 68, 68, 0.1);
    --warning: #f5a623;
    --radius: 8px;
    --radius-sm: 6px;
    --font: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    --mono: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, monospace;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .login-wrapper {
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; padding: 20px;
  }

  .login-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 12px; padding: 40px; width: 100%; max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  }

  .login-card h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }

  .login-card .subtitle {
    color: var(--text-secondary); font-size: 13px; margin-bottom: 28px;
  }

  .login-card label {
    display: block; font-size: 13px; font-weight: 500;
    color: var(--text-secondary); margin-bottom: 6px;
  }

  .login-card input[type="email"],
  .login-card input[type="password"] {
    width: 100%; padding: 10px 12px; background: var(--bg);
    border: 1px solid var(--border); border-radius: var(--radius-sm);
    color: var(--text); font-size: 14px; font-family: var(--font);
    outline: none; transition: border-color 0.15s; margin-bottom: 16px;
  }

  .login-card input:focus { border-color: var(--accent); }

  .login-error {
    background: var(--danger-subtle); color: var(--danger);
    padding: 10px 12px; border-radius: var(--radius-sm);
    font-size: 13px; margin-bottom: 16px;
    border: 1px solid rgba(255, 68, 68, 0.2);
  }

  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    padding: 8px 16px; font-size: 13px; font-weight: 500; font-family: var(--font);
    border-radius: var(--radius-sm); border: 1px solid transparent;
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }

  .btn-primary { background: var(--accent); color: white; border-color: var(--accent); }
  .btn-primary:hover { background: var(--accent-hover); }

  .btn-secondary { background: transparent; color: var(--text); border-color: var(--border); }
  .btn-secondary:hover { background: var(--surface-hover); border-color: var(--border-light); }

  .btn-danger { background: transparent; color: var(--danger); border-color: rgba(255, 68, 68, 0.3); }
  .btn-danger:hover { background: var(--danger-subtle); }

  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn-full { width: 100%; margin-top: 4px; padding: 10px 16px; }

  .shell { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 0; border-bottom: 1px solid var(--border); margin-bottom: 24px;
  }

  .header-left { display: flex; align-items: center; gap: 12px; }

  .header h1 { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }

  .header .badge {
    font-size: 11px; padding: 2px 8px; background: var(--accent-subtle);
    color: var(--accent); border-radius: 100px; font-weight: 500;
  }

  .header-right { display: flex; align-items: center; gap: 12px; }
  .header-right .status { font-size: 12px; color: var(--text-secondary); }

  .stats-bar { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 24px; }

  .stat-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 16px;
  }

  .stat-card .stat-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; margin-bottom: 6px; }
  .stat-card .stat-value { font-size: 24px; font-weight: 600; letter-spacing: -0.02em; }
  .stat-card .stat-sub { font-size: 11px; color: var(--text-tertiary); margin-top: 4px; }

  .tabs { display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 24px; }

  .tab {
    padding: 10px 20px; font-size: 13px; font-weight: 500;
    color: var(--text-secondary); cursor: pointer;
    border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s;
    background: none; border-top: none; border-left: none; border-right: none;
    font-family: var(--font);
  }

  .tab:hover { color: var(--text); }
  .tab.active { color: var(--text); border-bottom-color: var(--accent); }

  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .table-wrap {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); overflow: hidden;
  }

  table { width: 100%; border-collapse: collapse; }

  th {
    text-align: left; padding: 10px 16px; font-size: 12px; font-weight: 500;
    color: var(--text-secondary); background: var(--surface);
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }

  td {
    padding: 12px 16px; font-size: 13px;
    border-bottom: 1px solid var(--border); vertical-align: middle;
  }

  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--surface-hover); }

  .mono { font-family: var(--mono); font-size: 12px; }

  .status-active {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 500; color: var(--success);
  }
  .status-active::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--success);
  }

  .status-inactive {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 500; color: var(--text-tertiary);
  }
  .status-inactive::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%; background: var(--text-tertiary);
  }

  .inline-form {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px; margin-bottom: 16px; display: none;
  }
  .inline-form.visible { display: block; }

  .form-row { display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap; }

  .form-group { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 200px; }
  .form-group label { font-size: 12px; font-weight: 500; color: var(--text-secondary); }

  .form-group input,
  .form-group select {
    padding: 8px 10px; background: var(--bg); border: 1px solid var(--border);
    border-radius: var(--radius-sm); color: var(--text); font-size: 13px;
    font-family: var(--font); outline: none; transition: border-color 0.15s;
  }

  .form-group input:focus, .form-group select:focus { border-color: var(--accent); }

  .tool-chip {
    display: inline-block; padding: 2px 8px; background: var(--bg);
    border: 1px solid var(--border); border-radius: 100px;
    font-size: 11px; font-family: var(--mono); color: var(--text-secondary); margin: 2px 2px;
  }

  .tool-count { font-size: 12px; color: var(--text-secondary); cursor: pointer; }
  .tool-count:hover { color: var(--accent); }

  .tools-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 6px; padding: 12px 16px; background: var(--bg);
    border-radius: var(--radius-sm); margin-top: 8px; display: none;
  }
  .tools-grid.visible { display: grid; }

  .tools-grid label {
    display: flex; align-items: center; gap: 6px; font-size: 12px;
    font-family: var(--mono); color: var(--text-secondary);
    cursor: pointer; padding: 4px; border-radius: 4px;
  }
  .tools-grid label:hover { background: var(--surface); }
  .tools-grid input[type="checkbox"] { accent-color: var(--accent); }

  .filters { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: flex-end; }
  .filters .form-group { min-width: 150px; flex: 0 1 auto; }

  .status-ok { color: var(--success); }
  .status-err { color: var(--danger); }

  .empty-state { text-align: center; padding: 48px 20px; color: var(--text-secondary); }

  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .toolbar h2 { font-size: 15px; font-weight: 600; }

  .role-select-inline {
    padding: 4px 6px; background: var(--bg); border: 1px solid var(--border);
    border-radius: 4px; color: var(--text); font-size: 12px;
    font-family: var(--font); outline: none; cursor: pointer;
  }
  .role-select-inline:focus { border-color: var(--accent); }

  .confirm-overlay {
    position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6);
    display: flex; align-items: center; justify-content: center;
    z-index: 100; backdrop-filter: blur(4px);
  }

  .confirm-box {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 24px; max-width: 400px; width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .confirm-box h3 { font-size: 15px; margin-bottom: 8px; }
  .confirm-box p { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; }

  .confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }

  .table-scroll { overflow-x: auto; }

  .admin-badge {
    display: inline-block; padding: 1px 6px; background: var(--accent-subtle);
    color: var(--accent); border-radius: 4px; font-size: 10px; font-weight: 600;
    margin-left: 6px; vertical-align: middle;
  }

  .checkbox-row {
    display: flex; align-items: center; gap: 8px; margin-top: 8px;
  }
  .checkbox-row input[type="checkbox"] { accent-color: var(--accent); }
  .checkbox-row label { font-size: 13px; color: var(--text-secondary); cursor: pointer; }

  @media (max-width: 1024px) {
    .stats-bar { grid-template-columns: repeat(3, 1fr); }
  }

  @media (max-width: 768px) {
    .stats-bar { grid-template-columns: repeat(2, 1fr); }
    .form-row { flex-direction: column; }
    .form-group { min-width: 100%; }
    .filters { flex-direction: column; }
    .overview-grid { grid-template-columns: 1fr !important; }
  }

  .toast {
    position: fixed; bottom: 24px; right: 24px; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px 20px; font-size: 13px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 200; animation: slideUp 0.2s ease-out; max-width: 400px;
  }

  .toast.success { border-color: rgba(0, 200, 83, 0.3); color: var(--success); }
  .toast.error { border-color: rgba(255, 68, 68, 0.3); color: var(--danger); }

  @keyframes slideUp {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .stat-card .stat-value.success { color: var(--success); }
  .stat-card .stat-value.danger { color: var(--danger); }
  .stat-card .stat-value.warning { color: var(--warning); }

  .connection-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;
  }
  .connection-dot.ready { background: var(--success); box-shadow: 0 0 6px rgba(0, 200, 83, 0.4); }
  .connection-dot.warning { background: var(--warning); box-shadow: 0 0 6px rgba(245, 166, 35, 0.4); }
  .connection-dot.error { background: var(--danger); box-shadow: 0 0 6px rgba(255, 68, 68, 0.4); }

  .overview-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;
  }

  .overview-panel {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px;
  }

  .overview-panel h3 {
    font-size: 13px; font-weight: 600; color: var(--text-secondary);
    text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 16px;
  }

  .overview-panel-full { grid-column: 1 / -1; }

  .chart-container { position: relative; height: 180px; }

  .chart-bars {
    display: flex; align-items: flex-end; gap: 2px; height: 160px;
    padding-bottom: 20px; position: relative;
  }

  .chart-bar-group {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    position: relative; min-width: 0;
  }

  .chart-bar {
    width: 100%; background: var(--accent); border-radius: 3px 3px 0 0;
    min-height: 0; transition: all 0.2s; cursor: pointer; position: relative;
  }
  .chart-bar:hover { background: var(--accent-hover); }
  .chart-bar.zero { background: var(--border); min-height: 2px; }

  .chart-label {
    font-size: 9px; color: var(--text-tertiary); margin-top: 4px;
    white-space: nowrap; position: absolute; bottom: -18px;
  }

  .chart-tooltip {
    position: absolute; top: -28px; left: 50%; transform: translateX(-50%);
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 600;
    white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 0.15s;
    z-index: 10;
  }
  .chart-bar-group:hover .chart-tooltip { opacity: 1; }

  .chart-y-axis {
    position: absolute; top: 0; left: 0; bottom: 20px;
    display: flex; flex-direction: column; justify-content: space-between;
    pointer-events: none; padding-right: 8px;
  }
  .chart-y-label { font-size: 10px; color: var(--text-tertiary); text-align: right; }

  .h-bar-chart { display: flex; flex-direction: column; gap: 10px; }

  .h-bar-row { display: flex; align-items: center; gap: 10px; }

  .h-bar-label {
    width: 140px; font-size: 12px; font-family: var(--mono);
    color: var(--text-secondary); text-align: right; flex-shrink: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  .h-bar-track {
    flex: 1; height: 20px; background: var(--bg);
    border-radius: 4px; overflow: hidden; position: relative;
  }

  .h-bar-fill {
    height: 100%; background: var(--accent); border-radius: 4px;
    transition: width 0.3s ease; min-width: 2px;
  }

  .h-bar-value {
    width: 44px; font-size: 12px; font-weight: 600; text-align: left; flex-shrink: 0;
  }

  .top-users-list { display: flex; flex-direction: column; gap: 8px; }

  .top-user-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 12px; background: var(--bg); border-radius: var(--radius-sm);
  }

  .top-user-rank {
    width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; border-radius: 50%;
    background: var(--border); color: var(--text-secondary); margin-right: 10px; flex-shrink: 0;
  }
  .top-user-rank.rank-1 { background: var(--accent-subtle); color: var(--accent); }
  .top-user-rank.rank-2 { background: var(--accent-subtle); color: var(--accent); }
  .top-user-rank.rank-3 { background: var(--accent-subtle); color: var(--accent); }

  .top-user-name { font-size: 13px; font-weight: 500; flex: 1; }
  .top-user-count { font-size: 13px; font-weight: 600; color: var(--text-secondary); }

  .pagination {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-top: 1px solid var(--border);
    background: var(--surface); border-radius: 0 0 var(--radius) var(--radius);
  }

  .pagination-info { font-size: 12px; color: var(--text-secondary); }

  .pagination-controls { display: flex; gap: 4px; }

  .pagination-btn {
    padding: 4px 10px; font-size: 12px; font-family: var(--font);
    background: transparent; border: 1px solid var(--border);
    border-radius: 4px; color: var(--text-secondary); cursor: pointer;
    transition: all 0.15s;
  }
  .pagination-btn:hover:not(:disabled) { background: var(--surface-hover); color: var(--text); border-color: var(--border-light); }
  .pagination-btn:disabled { opacity: 0.3; cursor: default; }
  .pagination-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

  .health-card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 20px; margin-bottom: 16px;
  }

  .health-card h3 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }

  .health-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px;
  }
  .health-row:last-child { border-bottom: none; }

  .health-label { color: var(--text-secondary); }
  .health-value { font-weight: 500; }
  .health-value.ok { color: var(--success); }
  .health-value.warn { color: var(--warning); }
  .health-value.err { color: var(--danger); }
`;
// ── Login Page ──
function loginPage(error) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCP Admin - Login</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="login-wrapper">
    <div class="login-card">
      <h1>MCP Admin</h1>
      <p class="subtitle">TripleSeat MCP Server Management</p>
      ${error ? `<div class="login-error">${error}</div>` : ""}
      <form method="POST" action="/admin/login">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" placeholder="admin@example.com" autofocus required>
        <label for="password">Password</label>
        <input type="password" id="password" name="password" placeholder="Enter your password" required>
        <button type="submit" class="btn btn-primary btn-full">Sign In</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}
function dashboardPage(data) {
    const topTool = data.stats.top_tools.length > 0
        ? data.stats.top_tools[0].tool_name
        : "None yet";
    const activeUserCount = data.users.filter((u) => u.is_active).length;
    const toolOptions = roles_js_1.ALL_TOOLS.map((t) => `<option value="${t}">${t}</option>`).join("");
    const roleOptions = data.roles
        .map((r) => `<option value="${r.id}">${r.name}</option>`)
        .join("");
    const userOptions = data.users
        .map((u) => `<option value="${u.id}">${u.name}</option>`)
        .join("");
    const toolCheckboxes = roles_js_1.ALL_TOOLS.map((t) => `<label><input type="checkbox" value="${t}"> ${t}</label>`).join("\n");
    const errorRateClass = data.stats.error_rate > 10 ? "danger" : data.stats.error_rate > 5 ? "warning" : "success";
    const healthDot = data.health.tripleseat_status === "ready" ? "ready"
        : data.health.tripleseat_status === "needs_oauth_setup" ? "warning" : "error";
    const healthLabel = data.health.tripleseat_status === "ready" ? "Connected"
        : data.health.tripleseat_status === "needs_oauth_setup" ? "Setup Required" : "Not Configured";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MCP Admin - Dashboard</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="shell">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>MCP Admin</h1>
        <span class="badge">TripleSeat</span>
      </div>
      <div class="header-right">
        <span class="status">Logged in</span>
        <form method="POST" action="/admin/logout" style="margin:0">
          <button type="submit" class="btn btn-secondary btn-sm">Log Out</button>
        </form>
      </div>
    </div>

    <!-- Stats Bar -->
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-label">Active Users</div>
        <div class="stat-value">${activeUserCount}</div>
        <div class="stat-sub">${data.users.length} total</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">API Calls Today</div>
        <div class="stat-value">${data.stats.calls_today}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">This Week</div>
        <div class="stat-value">${data.stats.calls_this_week}</div>
        <div class="stat-sub">${data.stats.total_calls.toLocaleString()} all-time</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Error Rate</div>
        <div class="stat-value ${errorRateClass}">${data.stats.error_rate}%</div>
        <div class="stat-sub">${data.stats.error_count} errors total</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Avg Response</div>
        <div class="stat-value">${data.stats.avg_duration_ms}<span style="font-size: 12px; font-weight: 400; color: var(--text-secondary)">ms</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">TripleSeat</div>
        <div class="stat-value" style="font-size: 15px;"><span class="connection-dot ${healthDot}"></span>${healthLabel}</div>
        <div class="stat-sub">${data.health.active_session_count} active session${data.health.active_session_count !== 1 ? "s" : ""}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="users">Users</button>
      <button class="tab" data-tab="roles">Roles</button>
      <button class="tab" data-tab="activity">Activity</button>
      <button class="tab" data-tab="connections">Connections</button>
    </div>

    <!-- Overview Tab -->
    <div class="tab-content active" id="tab-overview">
      <div class="overview-panel overview-panel-full" style="margin-bottom: 16px">
        <h3>Usage Trends — Last 30 Days</h3>
        <div class="chart-container">
          <div class="chart-bars" id="usage-chart"></div>
        </div>
      </div>

      <div class="overview-grid">
        <div class="overview-panel">
          <h3>Top Tools</h3>
          <div id="tool-breakdown">
            ${data.stats.top_tools.length === 0
        ? '<div class="empty-state" style="padding:24px">No tool usage yet.</div>'
        : ""}
          </div>
        </div>

        <div class="overview-panel">
          <h3>Top Users</h3>
          <div id="top-users">
            ${data.stats.top_users.length === 0
        ? '<div class="empty-state" style="padding:24px">No user activity yet.</div>'
        : ""}
          </div>
        </div>
      </div>
    </div>

    <!-- Users Tab -->
    <div class="tab-content" id="tab-users">
      <div class="toolbar">
        <h2>Users</h2>
        <button class="btn btn-primary btn-sm" onclick="toggleForm('create-user-form')">Create User</button>
      </div>

      <div class="inline-form" id="create-user-form">
        <div class="form-row" style="margin-bottom: 12px">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="new-user-name" placeholder="Brian Smith">
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="new-user-email" placeholder="brian@example.com">
          </div>
        </div>
        <div class="form-row" style="margin-bottom: 12px">
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="new-user-password" placeholder="Temporary password">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select id="new-user-role">${roleOptions}</select>
          </div>
        </div>
        <div class="checkbox-row" style="margin-bottom: 16px">
          <input type="checkbox" id="new-user-admin">
          <label for="new-user-admin">Admin access (can manage users and roles)</label>
        </div>
        <div class="checkbox-row" style="margin-bottom: 16px">
          <input type="checkbox" id="new-user-invite" checked>
          <label for="new-user-invite">Send invite email with login credentials and setup instructions</label>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" id="create-user-btn" onclick="createUser()">Create &amp; Invite</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleForm('create-user-form')">Cancel</button>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Roles Tab -->
    <div class="tab-content" id="tab-roles">
      <div class="toolbar">
        <h2>Roles</h2>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary btn-sm" onclick="seedRoles()">Seed Defaults</button>
          <button class="btn btn-primary btn-sm" onclick="toggleForm('create-role-form')">Create Role</button>
        </div>
      </div>

      <div class="inline-form" id="create-role-form">
        <div class="form-row" style="margin-bottom:12px">
          <div class="form-group">
            <label>Name</label>
            <input type="text" id="new-role-name" placeholder="e.g. analyst">
          </div>
          <div class="form-group" style="flex:2">
            <label>Description</label>
            <input type="text" id="new-role-desc" placeholder="What this role can do">
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px">Allowed Tools</label>
          <div class="tools-grid visible" id="new-role-tools">
            ${toolCheckboxes}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="createRole()">Create Role</button>
          <button class="btn btn-secondary btn-sm" onclick="toggleForm('create-role-form')">Cancel</button>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Description</th>
                <th>Tools</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="roles-table-body">
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Activity Tab -->
    <div class="tab-content" id="tab-activity">
      <div class="toolbar">
        <h2>Activity Log</h2>
        <button class="btn btn-secondary btn-sm" onclick="exportActivityCSV()">Export CSV</button>
      </div>

      <div class="filters">
        <div class="form-group">
          <label>Time Range</label>
          <select id="activity-range" onchange="loadActivity()">
            <option value="1">Last 24 hours</option>
            <option value="7" selected>Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="0">All time</option>
          </select>
        </div>
        <div class="form-group">
          <label>User</label>
          <select id="activity-user" onchange="loadActivity()">
            <option value="">All users</option>
            ${userOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Tool</label>
          <select id="activity-tool" onchange="loadActivity()">
            <option value="">All tools</option>
            ${toolOptions}
          </select>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Tool</th>
                <th>Status</th>
                <th>Duration</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="activity-table-body">
            </tbody>
          </table>
        </div>
        <div class="pagination" id="activity-pagination" style="display:none">
          <div class="pagination-info" id="pagination-info"></div>
          <div class="pagination-controls" id="pagination-controls"></div>
        </div>
      </div>
    </div>
    <!-- Connections Tab -->
    <div class="tab-content" id="tab-connections">
      <div class="toolbar">
        <h2>Connections</h2>
      </div>

      <div class="health-card">
        <h3>TripleSeat API</h3>
        <div class="health-row">
          <span class="health-label">Status</span>
          <span class="health-value ${data.health.tripleseat_status === "ready" ? "ok" : data.health.tripleseat_status === "needs_oauth_setup" ? "warn" : "err"}">
            <span class="connection-dot ${healthDot}"></span>${healthLabel}
          </span>
        </div>
        <div class="health-row">
          <span class="health-label">Token Expires</span>
          <span class="health-value">${data.health.tripleseat_token_expires_at
        ? new Date(data.health.tripleseat_token_expires_at).toLocaleString()
        : "N/A"}</span>
        </div>
        <div class="health-row">
          <span class="health-label">Last Refreshed</span>
          <span class="health-value">${data.health.tripleseat_token_updated_at
        ? new Date(data.health.tripleseat_token_updated_at).toLocaleString()
        : "Never"}</span>
        </div>
        ${data.health.tripleseat_status !== "ready"
        ? '<div style="margin-top:12px"><a href="/auth/login" class="btn btn-primary btn-sm">Setup TripleSeat OAuth</a></div>'
        : ""}
      </div>

      <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">OAuth Clients</h3>
      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Client ID</th>
                <th>Registered</th>
                <th>Active Tokens</th>
                <th>Last Active</th>
              </tr>
            </thead>
            <tbody id="oauth-clients-body">
              <tr><td colspan="5"><div class="empty-state">Loading...</div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <div id="toast-container"></div>

  <script>
    let usersData = ${JSON.stringify(data.users)};
    let rolesData = ${JSON.stringify(data.roles)};
    const allTools = ${JSON.stringify([...roles_js_1.ALL_TOOLS])};
    const statsData = ${JSON.stringify(data.stats)};
    let activityData = [];
    let activityPage = 1;
    const PAGE_SIZE = 50;

    // ── Tabs ──
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'activity') loadActivity();
        if (tab.dataset.tab === 'connections') loadOAuthClients();
      });
    });

    // ── Helpers ──
    function toast(message, type = 'success') {
      const el = document.createElement('div');
      el.className = 'toast ' + type;
      el.textContent = message;
      document.getElementById('toast-container').appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }

    function toggleForm(id) {
      document.getElementById(id).classList.toggle('visible');
    }

    function timeAgo(dateStr) {
      if (!dateStr) return 'Never';
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return minutes + 'm ago';
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return hours + 'h ago';
      const days = Math.floor(hours / 24);
      if (days < 30) return days + 'd ago';
      return new Date(dateStr).toLocaleDateString();
    }

    function formatTime(dateStr) {
      if (!dateStr) return '-';
      const d = new Date(dateStr);
      return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    async function api(url, opts = {}) {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      return res.json();
    }

    function esc(s) {
      if (!s) return '';
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    // ── Users ──
    function renderUsers() {
      const tbody = document.getElementById('users-table-body');
      if (usersData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No users yet. Create one to get started.</div></td></tr>';
        return;
      }

      tbody.innerHTML = usersData.map(u => {
        const statusClass = u.is_active ? 'status-active' : 'status-inactive';
        const statusText = u.is_active ? 'Active' : 'Inactive';
        const roleName = u.role ? u.role.name : 'None';
        const adminBadge = u.is_admin ? '<span class="admin-badge">ADMIN</span>' : '';

        return '<tr>' +
          '<td><strong>' + esc(u.name) + '</strong>' + adminBadge + '</td>' +
          '<td style="color:var(--text-secondary)">' + esc(u.email) + '</td>' +
          '<td><select class="role-select-inline" onchange="changeUserRole(\\'' + u.id + '\\', this.value)" ' + (!u.is_active ? 'disabled' : '') + '>' +
            rolesData.map(r => '<option value="' + r.id + '"' + (r.id === u.role_id ? ' selected' : '') + '>' + r.name + '</option>').join('') +
          '</select></td>' +
          '<td><span class="' + statusClass + '">' + statusText + '</span></td>' +
          '<td style="color:var(--text-secondary);font-size:12px">' + timeAgo(u.last_active_at) + '</td>' +
          '<td style="display:flex;gap:6px">' +
            (u.is_active
              ? '<button class="btn btn-primary btn-sm" onclick="showResendInvite(\\'' + u.id + '\\', \\'' + esc(u.name) + '\\', \\'' + esc(u.email) + '\\')">Send Invite</button>' +
                '<button class="btn btn-secondary btn-sm" onclick="showResetPassword(\\'' + u.id + '\\', \\'' + esc(u.name) + '\\')">Reset PW</button>' +
                '<button class="btn btn-danger btn-sm" onclick="deactivateUser(\\'' + u.id + '\\', \\'' + esc(u.name) + '\\')">Deactivate</button>'
              : '<button class="btn btn-secondary btn-sm" onclick="reactivateUser(\\'' + u.id + '\\')">Reactivate</button>') +
          '</td>' +
        '</tr>';
      }).join('');
    }

    async function createUser() {
      const name = document.getElementById('new-user-name').value.trim();
      const email = document.getElementById('new-user-email').value.trim();
      const password = document.getElementById('new-user-password').value;
      const roleId = document.getElementById('new-user-role').value;
      const isAdmin = document.getElementById('new-user-admin').checked;
      const sendInvite = document.getElementById('new-user-invite').checked;

      if (!name || !email || !password) { toast('All fields are required', 'error'); return; }

      const btn = document.getElementById('create-user-btn');
      btn.disabled = true;
      btn.textContent = sendInvite ? 'Creating & sending...' : 'Creating...';

      try {
        const result = await api('/admin/api/users', {
          method: 'POST',
          body: JSON.stringify({ name, email, password, role_id: roleId, is_admin: isAdmin, send_invite: sendInvite }),
        });

        usersData = await api('/admin/api/users');
        renderUsers();
        toggleForm('create-user-form');
        document.getElementById('new-user-name').value = '';
        document.getElementById('new-user-email').value = '';
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-admin').checked = false;
        document.getElementById('new-user-invite').checked = true;

        if (sendInvite && result.invite_sent) {
          toast('User created and invite sent to ' + email);
        } else if (sendInvite && !result.invite_sent) {
          toast('User created but invite failed: ' + (result.invite_error || 'unknown error'), 'error');
        } else {
          toast('User created: ' + name);
        }
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Create & Invite';
      }
    }

    async function changeUserRole(userId, newRoleId) {
      try {
        await api('/admin/api/users/' + userId, {
          method: 'PATCH',
          body: JSON.stringify({ role_id: newRoleId }),
        });
        const u = usersData.find(u => u.id === userId);
        if (u) u.role_id = newRoleId;
        toast('Role updated');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    function showResetPassword(userId, name) {
      const html = '<div class="confirm-overlay" id="reset-pw-overlay">' +
        '<div class="confirm-box">' +
        '<h3>Reset Password: ' + esc(name) + '</h3>' +
        '<p>Enter a new password for this user. Share it with them directly.</p>' +
        '<div class="form-group" style="margin-bottom:16px">' +
          '<input type="password" id="reset-pw-input" placeholder="New password" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:var(--font);outline:none">' +
        '</div>' +
        '<div class="confirm-actions">' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\\'reset-pw-overlay\\').remove()">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" onclick="doResetPassword(\\'' + userId + '\\')">Reset Password</button>' +
        '</div></div></div>';

      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('reset-pw-input').focus();
    }

    async function doResetPassword(userId) {
      const password = document.getElementById('reset-pw-input').value;
      if (!password) { toast('Password is required', 'error'); return; }

      try {
        await api('/admin/api/users/' + userId + '/reset-password', {
          method: 'POST',
          body: JSON.stringify({ password }),
        });
        document.getElementById('reset-pw-overlay').remove();
        toast('Password reset successfully');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    function showResendInvite(userId, name, email) {
      const html = '<div class="confirm-overlay" id="resend-invite-overlay">' +
        '<div class="confirm-box">' +
        '<h3>Send Invite: ' + esc(name) + '</h3>' +
        '<p>Enter a password to include in the invite email to <strong>' + esc(email) + '</strong>. This will also reset their password.</p>' +
        '<div class="form-group" style="margin-bottom:16px">' +
          '<input type="password" id="resend-invite-pw" placeholder="Password for this user" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:var(--font);outline:none">' +
        '</div>' +
        '<div class="confirm-actions">' +
          '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\\'resend-invite-overlay\\').remove()">Cancel</button>' +
          '<button class="btn btn-primary btn-sm" id="resend-invite-btn" onclick="doResendInvite(\\'' + userId + '\\')">Send Invite</button>' +
        '</div></div></div>';

      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('resend-invite-pw').focus();
    }

    async function doResendInvite(userId) {
      const password = document.getElementById('resend-invite-pw').value;
      if (!password) { toast('Password is required', 'error'); return; }

      const btn = document.getElementById('resend-invite-btn');
      btn.disabled = true;
      btn.textContent = 'Sending...';

      try {
        // Reset the password first
        await api('/admin/api/users/' + userId + '/reset-password', {
          method: 'POST',
          body: JSON.stringify({ password }),
        });

        // Then send the invite
        await api('/admin/api/users/' + userId + '/send-invite', {
          method: 'POST',
          body: JSON.stringify({ password }),
        });

        document.getElementById('resend-invite-overlay').remove();
        toast('Invite email sent');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Send Invite';
      }
    }

    async function deactivateUser(userId, name) {
      if (!confirm('Deactivate user "' + name + '"? They will lose MCP access immediately.')) return;
      try {
        await api('/admin/api/users/' + userId + '/deactivate', { method: 'POST' });
        usersData = await api('/admin/api/users');
        renderUsers();
        toast('User deactivated');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    async function reactivateUser(userId) {
      try {
        await api('/admin/api/users/' + userId, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: true }),
        });
        usersData = await api('/admin/api/users');
        renderUsers();
        toast('User reactivated');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    // ── Roles ──
    function renderRoles() {
      const tbody = document.getElementById('roles-table-body');
      if (rolesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">No roles yet. Click "Seed Defaults" to create standard roles.</div></td></tr>';
        return;
      }

      tbody.innerHTML = rolesData.map(r => {
        const toolCount = (r.allowed_tools || []).length;
        const toolChips = (r.allowed_tools || []).map(t => '<span class="tool-chip">' + t + '</span>').join('');

        return '<tr>' +
          '<td><strong>' + esc(r.name) + '</strong></td>' +
          '<td style="color:var(--text-secondary)">' + esc(r.description) + '</td>' +
          '<td>' +
            '<span class="tool-count" onclick="this.nextElementSibling.classList.toggle(\\'visible\\')">' + toolCount + ' tools</span>' +
            '<div class="tools-grid">' + toolChips + '</div>' +
          '</td>' +
          '<td><button class="btn btn-secondary btn-sm" onclick="editRole(\\'' + r.id + '\\')">Edit</button></td>' +
        '</tr>';
      }).join('');
    }

    async function createRole() {
      const name = document.getElementById('new-role-name').value.trim();
      const desc = document.getElementById('new-role-desc').value.trim();
      const checks = document.querySelectorAll('#new-role-tools input[type=checkbox]:checked');
      const tools = Array.from(checks).map(c => c.value);

      if (!name) { toast('Name is required', 'error'); return; }
      if (tools.length === 0) { toast('Select at least one tool', 'error'); return; }

      try {
        await api('/admin/api/roles', {
          method: 'POST',
          body: JSON.stringify({ name, description: desc, allowed_tools: tools }),
        });
        rolesData = await api('/admin/api/roles');
        renderRoles();
        toggleForm('create-role-form');
        document.getElementById('new-role-name').value = '';
        document.getElementById('new-role-desc').value = '';
        document.querySelectorAll('#new-role-tools input[type=checkbox]').forEach(c => c.checked = false);
        toast('Role created');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    async function editRole(roleId) {
      const role = rolesData.find(r => r.id === roleId);
      if (!role) return;

      const tools = role.allowed_tools || [];
      const toolChecks = allTools.map(t =>
        '<label><input type="checkbox" value="' + t + '"' + (tools.includes(t) ? ' checked' : '') + '> ' + t + '</label>'
      ).join('');

      const html = '<div class="confirm-overlay" id="edit-role-overlay">' +
        '<div class="confirm-box" style="max-width:600px">' +
        '<h3>Edit Role: ' + esc(role.name) + '</h3>' +
        '<div class="form-group" style="margin-bottom:12px"><label>Description</label>' +
        '<input type="text" id="edit-role-desc" value="' + esc(role.description) + '" style="width:100%;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:13px;font-family:var(--font);outline:none"></div>' +
        '<div style="margin-bottom:16px"><label style="font-size:12px;font-weight:500;color:var(--text-secondary);display:block;margin-bottom:6px">Allowed Tools</label>' +
        '<div class="tools-grid visible" id="edit-role-tools">' + toolChecks + '</div></div>' +
        '<div class="confirm-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="document.getElementById(\\'edit-role-overlay\\').remove()">Cancel</button>' +
        '<button class="btn btn-primary btn-sm" onclick="saveRole(\\'' + roleId + '\\')">Save Changes</button>' +
        '</div></div></div>';

      document.body.insertAdjacentHTML('beforeend', html);
    }

    async function saveRole(roleId) {
      const desc = document.getElementById('edit-role-desc').value.trim();
      const checks = document.querySelectorAll('#edit-role-tools input[type=checkbox]:checked');
      const tools = Array.from(checks).map(c => c.value);

      try {
        await api('/admin/api/roles/' + roleId, {
          method: 'PATCH',
          body: JSON.stringify({ description: desc, allowed_tools: tools }),
        });
        rolesData = await api('/admin/api/roles');
        renderRoles();
        document.getElementById('edit-role-overlay').remove();
        toast('Role updated');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    async function seedRoles() {
      try {
        const result = await api('/admin/api/seed', { method: 'POST' });
        rolesData = await api('/admin/api/roles');
        renderRoles();
        // Update role select in user form
        const roleSelect = document.getElementById('new-user-role');
        roleSelect.innerHTML = rolesData.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('');
        if (result.created.length > 0) {
          toast('Roles created: ' + result.created.join(', '));
        } else {
          toast('Roles already up to date');
        }
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    // ── Activity ──
    async function loadActivity() {
      const days = document.getElementById('activity-range').value;
      const userId = document.getElementById('activity-user').value;
      const tool = document.getElementById('activity-tool').value;

      const params = new URLSearchParams();
      if (days !== '0') params.set('days', days);
      if (userId) params.set('user_id', userId);
      if (tool) params.set('tool_name', tool);
      params.set('limit', '500');

      try {
        activityData = await api('/admin/api/usage?' + params.toString());
        activityPage = 1;
        renderActivityPage();
      } catch (e) {
        toast('Failed to load activity: ' + e.message, 'error');
      }
    }

    function renderActivityPage() {
      const tbody = document.getElementById('activity-table-body');
      const paginationEl = document.getElementById('activity-pagination');

      if (activityData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No activity in this time range.</div></td></tr>';
        paginationEl.style.display = 'none';
        return;
      }

      const totalPages = Math.ceil(activityData.length / PAGE_SIZE);
      const start = (activityPage - 1) * PAGE_SIZE;
      const pageData = activityData.slice(start, start + PAGE_SIZE);

      tbody.innerHTML = pageData.map(l => {
        const userName = l.user ? l.user.name : 'System';
        const statusIcon = l.success ? '<span class="status-ok">OK</span>' : '<span class="status-err">ERR</span>';
        const duration = l.duration_ms ? l.duration_ms + 'ms' : '-';
        const errDetail = !l.success && l.error_message
          ? '<span style="color:var(--danger);font-size:11px;cursor:help" title="' + esc(l.error_message) + '">View</span>'
          : '<span style="color:var(--text-tertiary);font-size:11px">—</span>';
        return '<tr>' +
          '<td style="font-size:12px;color:var(--text-secondary);white-space:nowrap">' + formatTime(l.created_at) + '</td>' +
          '<td>' + esc(userName) + '</td>' +
          '<td><span class="mono">' + esc(l.tool_name) + '</span></td>' +
          '<td>' + statusIcon + '</td>' +
          '<td style="font-size:12px;color:var(--text-secondary)">' + duration + '</td>' +
          '<td>' + errDetail + '</td>' +
        '</tr>';
      }).join('');

      if (totalPages > 1) {
        paginationEl.style.display = 'flex';
        document.getElementById('pagination-info').textContent =
          'Showing ' + (start + 1) + '–' + Math.min(start + PAGE_SIZE, activityData.length) + ' of ' + activityData.length;

        let btns = '';
        btns += '<button class="pagination-btn" onclick="goToPage(1)" ' + (activityPage === 1 ? 'disabled' : '') + '>&laquo;</button>';
        btns += '<button class="pagination-btn" onclick="goToPage(' + (activityPage - 1) + ')" ' + (activityPage === 1 ? 'disabled' : '') + '>&lsaquo;</button>';

        const startPage = Math.max(1, activityPage - 2);
        const endPage = Math.min(totalPages, activityPage + 2);
        for (let i = startPage; i <= endPage; i++) {
          btns += '<button class="pagination-btn' + (i === activityPage ? ' active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
        }

        btns += '<button class="pagination-btn" onclick="goToPage(' + (activityPage + 1) + ')" ' + (activityPage === totalPages ? 'disabled' : '') + '>&rsaquo;</button>';
        btns += '<button class="pagination-btn" onclick="goToPage(' + totalPages + ')" ' + (activityPage === totalPages ? 'disabled' : '') + '>&raquo;</button>';
        document.getElementById('pagination-controls').innerHTML = btns;
      } else {
        paginationEl.style.display = 'none';
      }
    }

    function goToPage(page) {
      activityPage = page;
      renderActivityPage();
    }

    function exportActivityCSV() {
      if (activityData.length === 0) { toast('No data to export', 'error'); return; }

      const headers = ['Time', 'User', 'Tool', 'Status', 'Duration (ms)', 'Error'];
      const rows = activityData.map(l => [
        l.created_at,
        l.user ? l.user.name : 'System',
        l.tool_name,
        l.success ? 'OK' : 'ERR',
        l.duration_ms || '',
        l.error_message || '',
      ]);

      let csv = headers.join(',') + '\\n';
      rows.forEach(row => {
        csv += row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',') + '\\n';
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mcp-activity-' + new Date().toISOString().split('T')[0] + '.csv';
      a.click();
      URL.revokeObjectURL(url);
      toast('CSV exported');
    }

    // ── Overview Charts ──
    function renderUsageChart() {
      const container = document.getElementById('usage-chart');
      const data = statsData.calls_per_day || [];

      if (data.length === 0) {
        container.innerHTML = '<div class="empty-state" style="height:160px;display:flex;align-items:center;justify-content:center">No usage data yet.</div>';
        return;
      }

      const allDays = [];
      if (data.length > 0) {
        const startDate = new Date(data[0].date);
        const endDate = new Date(data[data.length - 1].date);
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
          const dateStr = d.toISOString().split('T')[0];
          const existing = data.find(r => r.date === dateStr);
          allDays.push({ date: dateStr, count: existing ? existing.count : 0 });
        }
      }

      const maxCount = Math.max(...allDays.map(d => d.count), 1);

      container.innerHTML = allDays.map((d, i) => {
        const pct = (d.count / maxCount) * 100;
        const dateObj = new Date(d.date + 'T12:00:00');
        const label = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const showLabel = allDays.length <= 14 || i % Math.ceil(allDays.length / 10) === 0;
        return '<div class="chart-bar-group">' +
          '<div class="chart-tooltip">' + d.count + ' calls</div>' +
          '<div class="chart-bar' + (d.count === 0 ? ' zero' : '') + '" style="height:' + Math.max(pct, 1) + '%"></div>' +
          (showLabel ? '<span class="chart-label">' + label + '</span>' : '') +
        '</div>';
      }).join('');
    }

    function renderToolBreakdown() {
      const container = document.getElementById('tool-breakdown');
      const tools = statsData.top_tools || [];
      if (tools.length === 0) return;

      const maxCount = tools[0].count;
      container.innerHTML = '<div class="h-bar-chart">' + tools.map(t => {
        const pct = (t.count / maxCount) * 100;
        return '<div class="h-bar-row">' +
          '<span class="h-bar-label">' + esc(t.tool_name) + '</span>' +
          '<div class="h-bar-track"><div class="h-bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="h-bar-value">' + t.count + '</span>' +
        '</div>';
      }).join('') + '</div>';
    }

    function renderTopUsers() {
      const container = document.getElementById('top-users');
      const users = statsData.top_users || [];
      if (users.length === 0) return;

      container.innerHTML = '<div class="top-users-list">' + users.map((u, i) => {
        const rankClass = i < 3 ? ' rank-' + (i + 1) : '';
        return '<div class="top-user-row">' +
          '<span class="top-user-rank' + rankClass + '">' + (i + 1) + '</span>' +
          '<span class="top-user-name">' + esc(u.name) + '</span>' +
          '<span class="top-user-count">' + u.count + ' calls</span>' +
        '</div>';
      }).join('') + '</div>';
    }

    // ── Connections ──
    let connectionsLoaded = false;
    async function loadOAuthClients() {
      if (connectionsLoaded) return;
      connectionsLoaded = true;

      try {
        const clients = await api('/admin/api/oauth-clients');
        const tbody = document.getElementById('oauth-clients-body');

        if (clients.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">No OAuth clients registered yet.</div></td></tr>';
          return;
        }

        tbody.innerHTML = clients.map(c => {
          const activeTokens = parseInt(c.active_tokens) || 0;
          const statusClass = activeTokens > 0 ? 'status-active' : 'status-inactive';
          const statusText = activeTokens > 0 ? activeTokens + ' active' : 'No active tokens';
          return '<tr>' +
            '<td><strong>' + esc(c.client_name || 'MCP Client') + '</strong></td>' +
            '<td><span class="mono" style="font-size:11px;color:var(--text-secondary)">' + esc(c.client_id.substring(0, 20)) + '…</span></td>' +
            '<td style="font-size:12px;color:var(--text-secondary)">' + formatTime(c.created_at) + '</td>' +
            '<td><span class="' + statusClass + '">' + statusText + '</span></td>' +
            '<td style="font-size:12px;color:var(--text-secondary)">' + (c.last_token_issued ? timeAgo(c.last_token_issued) : 'Never') + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        toast('Failed to load clients: ' + e.message, 'error');
      }
    }

    // ── Init ──
    renderUsers();
    renderRoles();
    renderUsageChart();
    renderToolBreakdown();
    renderTopUsers();
  </script>
</body>
</html>`;
}
