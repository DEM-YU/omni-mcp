<![CDATA[<div align="center">

```
   ___                    _       __  __    ___  ___
  / _ \  _ __    _ __   (_)     |  \/  |  / __|| _ \
 | (_) || '  \  | '  \  | |  _  | |\/| | | (__ |  _/
  \___/ |_|_|_| |_|_|_| |_| (_) |_|  |_|  \___||_|
```

**🔌 The Universal MCP Resource Server**

*Mount any folder. Feed any AI. Zero code required.*

[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?logo=node.js)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/Protocol-MCP-blue?logo=data:image/svg+xml;base64,)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 🤔 Why Omni-MCP?

Your AI agent is brilliant — but **blind**. It can't see your project docs, your research notes, or that CSV buried three folders deep. Every time you need it to read a file, you copy-paste like it's 2005.

**Omni-MCP changes that in one command.**

It turns any folder on your machine into a live knowledge base that AI agents can query directly through the [Model Context Protocol](https://modelcontextprotocol.io). No uploading. No embedding pipelines. No infrastructure. Just mount a folder and your agent sees everything — instantly.

> 💡 Think of it as a **USB drive for your AI's brain**.

---

## ⚡ Quick Start

### 1. Install

```bash
git clone https://github.com/brooks/omni-mcp.git
cd omni-mcp
npm install
```

### 2. Connect to Your AI Client

Add this to your MCP client configuration:

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

### 3. Start Talking to Your Agent

Once connected, simply tell your AI:

```
"请把 /Users/me/Documents 挂载为知识库"
```

or

```
"Mount the folder /Users/me/research as a new source"
```

The agent will call `mount_folder` (or its alias `add_new_source`), and every `.txt` and `.md` file becomes instantly readable. ✨

### 4. Run Standalone (Optional)

```bash
npm start
```

You'll see the **live TUI dashboard** on stderr showing server status, mounts, and real-time AI activity.

---

## ✨ Features

### 📂 Dynamic Folder Mounting
Mount any directory at runtime — no config files to edit, no restarts needed. Your agent can call `mount_folder` or `add_new_source` conversationally.

### 🎨 Live TUI Dashboard
A gorgeous terminal UI built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs):
- ASCII art banner
- Real-time server status indicator
- Mounted sources tree view
- Activity monitor — flashes when your AI reads a file

### 💾 Persistent Configuration
Mounted paths are saved to `config.json` and automatically restored on restart. Mount once, remember forever.

### 🛡️ Smart Duplicate Detection
Re-mounting the same path? Omni-MCP catches it and lets you know — no duplicates, no confusion.

### 🔒 Non-Blocking Architecture
The TUI renders to `stderr` while MCP JSON-RPC flows through `stdout/stdin`. Zero interference, zero dropped messages.

---

## 🛠️ Available Tools

| Tool | Description |
|---|---|
| `mount_folder` | Mount a local folder as a resource source |
| `add_new_source` | Alias for `mount_folder` |
| `unmount_folder` | Remove a previously mounted folder |
| `list_mounts` | Show all currently mounted directories |

---

## 📁 Project Structure

```
omni-mcp/
├── src/
│   ├── index.ts          # MCP server + tool handlers
│   ├── events.ts         # Event bus (server ↔ dashboard)
│   └── dashboard.tsx     # Ink TUI dashboard
├── test-resources/       # Sample files for testing
├── config.json           # Auto-generated mount persistence (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🗺️ Roadmap

| Status | Feature | Description |
|---|---|---|
| ✅ | Local File Mounting | Mount any folder, expose `.txt`/`.md` files |
| ✅ | TUI Dashboard | Live terminal UI with activity monitoring |
| ✅ | Persistent Config | `config.json` remembers your mounts |
| 🔜 | **Web Adapter** | Mount URLs and web pages as resources |
| 🔜 | **Database Connector** | Query SQLite / PostgreSQL directly from your agent |
| 🔜 | **File Watcher** | Hot-reload resources when files change on disk |
| 🔜 | **Custom Filters** | Mount with glob patterns (e.g. `*.py`, `docs/**`) |
| 💡 | **Multi-Agent Sync** | Share mounted resources across multiple agents |

---

## 📄 License

MIT © Brooks

---

<div align="center">

**Built with 🧡 for the AI-native developer workflow.**

*If Omni-MCP saved you from copy-pasting, give it a ⭐*

</div>
]]>
