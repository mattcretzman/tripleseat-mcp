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

  /* Layout */
  .login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 20px;
  }

  .login-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 40px;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
  }

  .login-card h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 4px;
  }

  .login-card .subtitle {
    color: var(--text-secondary);
    font-size: 13px;
    margin-bottom: 28px;
  }

  .login-card label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .login-card input[type="password"] {
    width: 100%;
    padding: 10px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 14px;
    font-family: var(--font);
    outline: none;
    transition: border-color 0.15s;
  }

  .login-card input[type="password"]:focus {
    border-color: var(--accent);
  }

  .login-error {
    background: var(--danger-subtle);
    color: var(--danger);
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    margin-bottom: 16px;
    border: 1px solid rgba(255, 68, 68, 0.2);
  }

  /* Buttons */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 500;
    font-family: var(--font);
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .btn-primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  .btn-primary:hover { background: var(--accent-hover); }

  .btn-secondary {
    background: transparent;
    color: var(--text);
    border-color: var(--border);
  }
  .btn-secondary:hover { background: var(--surface-hover); border-color: var(--border-light); }

  .btn-danger {
    background: transparent;
    color: var(--danger);
    border-color: rgba(255, 68, 68, 0.3);
  }
  .btn-danger:hover { background: var(--danger-subtle); }

  .btn-sm { padding: 5px 10px; font-size: 12px; }

  .btn-full { width: 100%; margin-top: 20px; padding: 10px 16px; }

  /* Shell */
  .shell {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 24px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header h1 {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .header .badge {
    font-size: 11px;
    padding: 2px 8px;
    background: var(--accent-subtle);
    color: var(--accent);
    border-radius: 100px;
    font-weight: 500;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .header-right .status {
    font-size: 12px;
    color: var(--text-secondary);
  }

  /* Stats Bar */
  .stats-bar {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 24px;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
  }

  .stat-card .stat-label {
    font-size: 12px;
    color: var(--text-secondary);
    font-weight: 500;
    margin-bottom: 6px;
  }

  .stat-card .stat-value {
    font-size: 24px;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .stat-card .stat-sub {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-top: 4px;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 24px;
  }

  .tab {
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: all 0.15s;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
    font-family: var(--font);
  }

  .tab:hover { color: var(--text); }

  .tab.active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }

  .tab-content { display: none; }
  .tab-content.active { display: block; }

  /* Tables */
  .table-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    text-align: left;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }

  td {
    padding: 12px 16px;
    font-size: 13px;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }

  tr:last-child td { border-bottom: none; }

  tr:hover td { background: var(--surface-hover); }

  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }

  /* Status badge */
  .status-active {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: var(--success);
  }

  .status-active::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--success);
  }

  .status-inactive {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-tertiary);
  }

  .status-inactive::before {
    content: '';
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-tertiary);
  }

  /* Forms */
  .inline-form {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    margin-bottom: 16px;
    display: none;
  }

  .inline-form.visible { display: block; }

  .form-row {
    display: flex;
    gap: 12px;
    align-items: flex-end;
    flex-wrap: wrap;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
    min-width: 200px;
  }

  .form-group label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .form-group input,
  .form-group select {
    padding: 8px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-size: 13px;
    font-family: var(--font);
    outline: none;
    transition: border-color 0.15s;
  }

  .form-group input:focus,
  .form-group select:focus {
    border-color: var(--accent);
  }

  /* Key reveal box */
  .key-reveal {
    background: var(--accent-subtle);
    border: 1px solid rgba(0, 112, 243, 0.3);
    border-radius: var(--radius);
    padding: 16px;
    margin-top: 12px;
    display: none;
  }

  .key-reveal.visible { display: block; }

  .key-reveal .key-text {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--accent);
    background: var(--bg);
    padding: 10px 12px;
    border-radius: var(--radius-sm);
    margin: 8px 0;
    word-break: break-all;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .key-reveal .key-warning {
    font-size: 12px;
    color: var(--warning);
    font-weight: 500;
    margin-top: 8px;
  }

  /* Tool chips */
  .tool-chip {
    display: inline-block;
    padding: 2px 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 100px;
    font-size: 11px;
    font-family: var(--mono);
    color: var(--text-secondary);
    margin: 2px 2px;
  }

  .tool-count {
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
  }

  .tool-count:hover { color: var(--accent); }

  /* Tool checkboxes */
  .tools-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 6px;
    padding: 12px 16px;
    background: var(--bg);
    border-radius: var(--radius-sm);
    margin-top: 8px;
    display: none;
  }

  .tools-grid.visible { display: grid; }

  .tools-grid label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-family: var(--mono);
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }

  .tools-grid label:hover { background: var(--surface); }

  .tools-grid input[type="checkbox"] {
    accent-color: var(--accent);
  }

  /* Filters */
  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filters .form-group {
    min-width: 150px;
    flex: 0 1 auto;
  }

  /* Status indicators in activity */
  .status-ok { color: var(--success); }
  .status-err { color: var(--danger); }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: 48px 20px;
    color: var(--text-secondary);
  }

  .empty-state .empty-icon {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.3;
  }

  /* Toolbar */
  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .toolbar h2 {
    font-size: 15px;
    font-weight: 600;
  }

  /* Role select inline */
  .role-select-inline {
    padding: 4px 6px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 12px;
    font-family: var(--font);
    outline: none;
    cursor: pointer;
  }

  .role-select-inline:focus { border-color: var(--accent); }

  /* Confirm dialog */
  .confirm-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .confirm-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    max-width: 400px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  }

  .confirm-box h3 { font-size: 15px; margin-bottom: 8px; }
  .confirm-box p { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  /* Scrollable */
  .table-scroll {
    overflow-x: auto;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .stats-bar { grid-template-columns: repeat(2, 1fr); }
    .form-row { flex-direction: column; }
    .form-group { min-width: 100%; }
    .filters { flex-direction: column; }
  }

  /* Toast */
  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px 20px;
    font-size: 13px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 200;
    animation: slideUp 0.2s ease-out;
    max-width: 400px;
  }

  .toast.success { border-color: rgba(0, 200, 83, 0.3); color: var(--success); }
  .toast.error { border-color: rgba(255, 68, 68, 0.3); color: var(--danger); }

  @keyframes slideUp {
    from { transform: translateY(12px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
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
        <label for="password">Admin Password</label>
        <input type="password" id="password" name="password" placeholder="Enter admin password" autofocus required>
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
    const activeKeyCount = data.keys.filter((k) => k.is_active).length;
    const toolOptions = roles_js_1.ALL_TOOLS.map((t) => `<option value="${t}">${t}</option>`).join("");
    const roleOptions = data.roles
        .map((r) => `<option value="${r.id}">${r.name}</option>`)
        .join("");
    const keyLabelOptions = data.keys
        .map((k) => `<option value="${k.id}">${k.label}</option>`)
        .join("");
    const toolCheckboxes = roles_js_1.ALL_TOOLS.map((t) => `<label><input type="checkbox" value="${t}"> ${t}</label>`).join("\n");
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
        <div class="stat-label">Active Keys</div>
        <div class="stat-value" id="stat-keys">${activeKeyCount}</div>
        <div class="stat-sub">${data.keys.length} total</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">API Calls Today</div>
        <div class="stat-value" id="stat-today">${data.stats.calls_today}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">API Calls This Week</div>
        <div class="stat-value" id="stat-week">${data.stats.calls_this_week}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Most Used Tool</div>
        <div class="stat-value" style="font-size: 16px; font-family: var(--mono);" id="stat-top-tool">${topTool}</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" data-tab="keys">Keys</button>
      <button class="tab" data-tab="roles">Roles</button>
      <button class="tab" data-tab="activity">Activity</button>
    </div>

    <!-- Keys Tab -->
    <div class="tab-content active" id="tab-keys">
      <div class="toolbar">
        <h2>API Keys</h2>
        <button class="btn btn-primary btn-sm" onclick="toggleForm('create-key-form')">Create New Key</button>
      </div>

      <div class="inline-form" id="create-key-form">
        <div class="form-row">
          <div class="form-group">
            <label>Label</label>
            <input type="text" id="new-key-label" placeholder="e.g. Claude Desktop">
          </div>
          <div class="form-group">
            <label>Role</label>
            <select id="new-key-role">${roleOptions}</select>
          </div>
          <div style="display:flex;gap:8px;padding-bottom:1px">
            <button class="btn btn-primary btn-sm" onclick="createKey()">Create</button>
            <button class="btn btn-secondary btn-sm" onclick="toggleForm('create-key-form')">Cancel</button>
          </div>
        </div>
        <div class="key-reveal" id="new-key-reveal">
          <div style="font-size:13px;font-weight:500;margin-bottom:4px">Your new API key:</div>
          <div class="key-text">
            <span id="new-key-value"></span>
            <button class="btn btn-secondary btn-sm" onclick="copyKey()">Copy</button>
          </div>
          <div class="key-warning">This key will only be shown once. Copy it now.</div>
        </div>
      </div>

      <div class="table-wrap">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Key</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Used</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="keys-table-body">
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
            ${keyLabelOptions}
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
              </tr>
            </thead>
            <tbody id="activity-table-body">
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast container -->
  <div id="toast-container"></div>

  <script>
    // ── State ──
    let keysData = ${JSON.stringify(data.keys)};
    let rolesData = ${JSON.stringify(data.roles)};
    const allTools = ${JSON.stringify([...roles_js_1.ALL_TOOLS])};

    // ── Tabs ──
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'activity') loadActivity();
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
      const form = document.getElementById(id);
      form.classList.toggle('visible');
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

    // ── Keys ──
    function renderKeys() {
      const tbody = document.getElementById('keys-table-body');
      if (keysData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">No API keys yet. Create one to get started.</div></td></tr>';
        return;
      }

      const roleOptHtml = rolesData.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('');

      tbody.innerHTML = keysData.map(k => {
        const statusClass = k.is_active ? 'status-active' : 'status-inactive';
        const statusText = k.is_active ? 'Active' : 'Inactive';
        const roleName = k.role ? k.role.name : 'Unknown';

        return '<tr data-key-id="' + k.id + '">' +
          '<td><strong>' + esc(k.label) + '</strong></td>' +
          '<td><span class="mono">' + esc(k.key_prefix) + '...</span></td>' +
          '<td><select class="role-select-inline" onchange="changeKeyRole(\\'' + k.id + '\\', this.value)" ' + (!k.is_active ? 'disabled' : '') + '>' +
            rolesData.map(r => '<option value="' + r.id + '"' + (r.id === k.role_id ? ' selected' : '') + '>' + r.name + '</option>').join('') +
          '</select></td>' +
          '<td><span class="' + statusClass + '">' + statusText + '</span></td>' +
          '<td style="color:var(--text-secondary);font-size:12px">' + timeAgo(k.last_used_at) + '</td>' +
          '<td style="color:var(--text-secondary);font-size:12px">' + timeAgo(k.created_at) + '</td>' +
          '<td>' +
            (k.is_active
              ? '<button class="btn btn-danger btn-sm" onclick="revokeKey(\\'' + k.id + '\\', \\'' + esc(k.label) + '\\')">Revoke</button>'
              : '<span style="color:var(--text-tertiary);font-size:12px">Revoked</span>') +
          '</td>' +
        '</tr>';
      }).join('');
    }

    function esc(s) {
      if (!s) return '';
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    }

    async function createKey() {
      const label = document.getElementById('new-key-label').value.trim();
      const roleId = document.getElementById('new-key-role').value;
      if (!label) { toast('Label is required', 'error'); return; }

      try {
        const result = await api('/admin/api/keys', {
          method: 'POST',
          body: JSON.stringify({ label, role_id: roleId }),
        });

        document.getElementById('new-key-value').textContent = result.key;
        document.getElementById('new-key-reveal').classList.add('visible');
        document.getElementById('new-key-label').value = '';

        // Refresh keys
        keysData = await api('/admin/api/keys');
        renderKeys();
        toast('API key created');
      } catch (e) {
        toast('Failed to create key: ' + e.message, 'error');
      }
    }

    function copyKey() {
      const key = document.getElementById('new-key-value').textContent;
      navigator.clipboard.writeText(key).then(() => toast('Copied to clipboard'));
    }

    async function changeKeyRole(keyId, newRoleId) {
      try {
        await api('/admin/api/keys/' + keyId, {
          method: 'PATCH',
          body: JSON.stringify({ role_id: newRoleId }),
        });
        const k = keysData.find(k => k.id === keyId);
        if (k) k.role_id = newRoleId;
        toast('Role updated');
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    async function revokeKey(keyId, label) {
      if (!confirm('Revoke key "' + label + '"? This cannot be undone.')) return;
      try {
        await api('/admin/api/keys/' + keyId, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: false }),
        });
        keysData = await api('/admin/api/keys');
        renderKeys();
        toast('Key revoked');
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
            '<span class="tool-count" onclick="this.nextElementSibling.classList.toggle(\\' visible\\')">' + toolCount + ' tools</span>' +
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
        '<label><input type=\\"checkbox\\" value=\\"' + t + '\\"' + (tools.includes(t) ? ' checked' : '') + '> ' + t + '</label>'
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
        if (result.skipped) {
          toast('Roles already exist, skipped seeding', 'error');
        } else {
          rolesData = await api('/admin/api/roles');
          renderRoles();
          // Also refresh role options for key creation
          const roleSelect = document.getElementById('new-key-role');
          roleSelect.innerHTML = rolesData.map(r => '<option value="' + r.id + '">' + r.name + '</option>').join('');
          toast('Default roles created: ' + result.created.join(', '));
        }
      } catch (e) {
        toast('Failed: ' + e.message, 'error');
      }
    }

    // ── Activity ──
    async function loadActivity() {
      const days = document.getElementById('activity-range').value;
      const keyId = document.getElementById('activity-user').value;
      const tool = document.getElementById('activity-tool').value;

      const params = new URLSearchParams();
      if (days !== '0') params.set('days', days);
      if (keyId) params.set('key_id', keyId);
      if (tool) params.set('tool_name', tool);
      params.set('limit', '200');

      try {
        const logs = await api('/admin/api/usage?' + params.toString());
        const tbody = document.getElementById('activity-table-body');

        if (logs.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">No activity in this time range.</div></td></tr>';
          return;
        }

        tbody.innerHTML = logs.map(l => {
          const label = l.api_key ? l.api_key.label : 'System';
          const statusIcon = l.success ? '<span class="status-ok">OK</span>' : '<span class="status-err">ERR</span>';
          const duration = l.duration_ms ? l.duration_ms + 'ms' : '-';
          return '<tr>' +
            '<td style="font-size:12px;color:var(--text-secondary);white-space:nowrap">' + formatTime(l.created_at) + '</td>' +
            '<td>' + esc(label) + '</td>' +
            '<td><span class="mono">' + esc(l.tool_name) + '</span></td>' +
            '<td>' + statusIcon + '</td>' +
            '<td style="font-size:12px;color:var(--text-secondary)">' + duration + '</td>' +
          '</tr>';
        }).join('');
      } catch (e) {
        toast('Failed to load activity: ' + e.message, 'error');
      }
    }

    // ── Init ──
    renderKeys();
    renderRoles();
  </script>
</body>
</html>`;
}
