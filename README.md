<div align="center">

# ⚡ Omni-MCP

**🔌 The Universal MCP Resource Server**

_Mount any folder, URL, or database. Feed any AI. Zero code required._

[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 🚀 Highlights

- **📂 Folder Mounting** — Mount any directory with one command; `.txt` / `.md` files become instantly readable
- **🌐 Web Scraping** — Provide a URL, auto-convert to Markdown, cached and persisted
- **🗄️ SQLite Adapter** — Mount a database, auto-expose its schema, safely run SELECT queries
- **📟 TUI Dashboard** — Ink-powered terminal UI with real-time status, mounts, and AI activity
- **💾 Persistent Config** — Mount once, automatically restored on restart

---

## 🛠️ Quick Start

### 1. Install

```bash
git clone https://github.com/DEM-YU/omni-mcp.git
cd omni-mcp
npm install
```

### 2. Connect to Your AI Client

<details>
<summary>🌌 <b>Antigravity</b> (<code>~/.gemini/antigravity/mcp_config.json</code>)</summary>

```json
{
  "mcpServers": {
    "omni-mcp": {
      "command": "npx",
      "args": ["tsx", "/path/to/omni-mcp/src/index.ts"],
      "cwd": "/path/to/omni-mcp"
    }
  }
}
```

</details>

<details>
<summary>🧠 <b>Claude Desktop</b> (<code>claude_desktop_config.json</code>)</summary>

```json
{
  "mcpServers": {
    "omni-mcp": {
      "command": "npx",
      "args": ["tsx", "/path/to/omni-mcp/src/index.ts"],
      "cwd": "/path/to/omni-mcp"
    }
  }
}
```

</details>

### 3. Start Talking

Once connected, just tell your AI:

```
"Mount the folder /Users/me/research as a knowledge base"
"Scrape this page: https://example.com"
"Mount the database /path/to/data.db and query all users"
```

---

## 📂 Supported Sources

### Local Folders

| Tool             | Description                                         |
| ---------------- | --------------------------------------------------- |
| `mount_folder`   | Mount a local folder, exposing `.txt` / `.md` files |
| `add_new_source` | Alias for `mount_folder`                            |
| `unmount_folder` | Unmount a previously mounted folder                 |

### Web Pages

| Tool        | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| `mount_url` | Fetch a web page, convert to Markdown, cache and expose as a resource |

### SQLite Databases

| Tool           | Description                                                |
| -------------- | ---------------------------------------------------------- |
| `mount_sqlite` | Mount a SQLite database (read-only), auto-expose schema    |
| `query_sqlite` | Safely execute SELECT queries, returns JSON (max 100 rows) |

### General

| Tool          | Description                                        |
| ------------- | -------------------------------------------------- |
| `list_mounts` | List all mounted folders, web pages, and databases |

---

## 📟 TUI Dashboard

A live terminal dashboard renders on stderr at startup:

- **Status Indicator** — Server online / starting
- **📂 Folders** — Mounted folder tree
- **🌐 Web Pages** — Mounted URL list
- **🗄️ Databases** — Connected database list
- **⚡ Live Activity** — Flashes in real-time when AI reads a resource

> 💡 TUI renders to `stderr`; MCP JSON-RPC flows through `stdout/stdin` — zero interference.

---

## 📁 Project Structure

```
omni-mcp/
├── src/
│   ├── index.ts          # MCP Server + all tool handlers
│   ├── events.ts         # Event bus (Server ↔ Dashboard)
│   └── dashboard.tsx     # Ink TUI dashboard
├── test-resources/       # Sample files for testing
├── config.json           # Auto-generated persistence (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📄 License

MIT © Brooks

---

<div align="center">

**Built with 🧡 for the AI-native developer workflow.**

_If Omni-MCP saved you from copy-pasting, give it a ⭐_

</div>
