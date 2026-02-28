<div align="center">

# ⚡ Omni-MCP

**🔌 The Universal MCP Resource Server**

_Mount any folder, URL, or database. Feed any AI. Zero code required._

[![Node.js](https://img.shields.io/badge/Node.js-≥18-339933?logo=node.js)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 🚀 核心亮点

- **📂 文件夹挂载** — 一句话挂载任意目录，`.txt` / `.md` 文件即时可读
- **🌐 网页抓取** — 输入 URL，自动转 Markdown，缓存持久化
- **🗄️ SQLite 适配器** — 挂载数据库，自动暴露 Schema，安全执行 SELECT 查询
- **📟 TUI 仪表盘** — 基于 Ink 的终端 UI，实时显示状态、挂载源、AI 活动
- **💾 持久化配置** — 挂载一次，重启自动恢复

---

## 🛠️ 快速开始

### 1. 安装

```bash
git clone https://github.com/DEM-YU/omni-mcp.git
cd omni-mcp
npm install
```

### 2. 配置 MCP 客户端

<details>
<summary>🌌 <b>Antigravity</b>（<code>~/.gemini/antigravity/mcp_config.json</code>）</summary>

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
<summary>🧠 <b>Claude Desktop</b>（<code>claude_desktop_config.json</code>）</summary>

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

### 3. 开始对话

连接后，直接对 AI 说：

```
"请把 /Users/me/Documents 挂载为知识库"
"帮我把这个网页挂载：https://example.com"
"挂载数据库 /path/to/data.db，然后查询所有用户"
```

---

## 📂 支持的插槽

### 本地文件夹

| 工具             | 说明                                     |
| ---------------- | ---------------------------------------- |
| `mount_folder`   | 挂载本地文件夹，暴露 `.txt` / `.md` 文件 |
| `add_new_source` | `mount_folder` 的别名                    |
| `unmount_folder` | 卸载已挂载的文件夹                       |

### 网页

| 工具        | 说明                                      |
| ----------- | ----------------------------------------- |
| `mount_url` | 抓取网页，转为 Markdown，缓存并暴露为资源 |

### SQLite 数据库

| 工具           | 说明                                           |
| -------------- | ---------------------------------------------- |
| `mount_sqlite` | 挂载 SQLite 数据库（只读），自动暴露 Schema    |
| `query_sqlite` | 安全执行 SELECT 查询，JSON 返回（上限 100 行） |

### 通用

| 工具          | 说明                                 |
| ------------- | ------------------------------------ |
| `list_mounts` | 列出所有已挂载的文件夹、网页和数据库 |

---

## 📟 TUI 仪表盘

启动后在终端（stderr）渲染实时仪表盘：

- **状态指示** — 服务器在线 / 启动中
- **📂 Folders** — 已挂载文件夹列表
- **🌐 Web Pages** — 已挂载网页列表
- **🗄️ Databases** — 已连接数据库列表
- **⚡ Live Activity** — AI 读取资源时实时闪烁

> 💡 TUI 渲染在 `stderr`，MCP JSON-RPC 走 `stdout/stdin`，互不干扰。

---

## 📁 项目结构

```
omni-mcp/
├── src/
│   ├── index.ts          # MCP Server + 全部 Tool 逻辑
│   ├── events.ts         # EventBus（Server ↔ Dashboard）
│   └── dashboard.tsx     # Ink TUI 仪表盘
├── test-resources/       # 测试用文件
├── config.json           # 自动生成的持久化配置（已 gitignore）
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
