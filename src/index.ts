import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import TurndownService from "turndown";
import Database from "better-sqlite3";
import { bus, type UrlInfo } from "./events.js";
import { startDashboard } from "./dashboard.js";

// ──────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────

/** Default directory to watch on first run */
const DEFAULT_DIR = path.resolve("./test-resources");

/** Extensions we expose as MCP Resources */
const ALLOWED_EXTENSIONS = new Set([".txt", ".md"]);

/** Persistence file – stores mounted paths + URLs across restarts */
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.dirname(path.dirname(__filename));
const CONFIG_FILE = path.join(PROJECT_ROOT, "config.json");

/** Shape of the config.json file */
interface MountedUrlEntry {
  url: string;
  title: string;
  content: string;    // Cached Markdown
  fetchedAt: string;  // ISO timestamp
}

interface ConfigData {
  mountedPaths: string[];
  mountedUrls: MountedUrlEntry[];
  mountedDatabases: string[];
}

// ──────────────────────────────────────────────
// HTML → Markdown
// ──────────────────────────────────────────────

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

/** Strip scripts, styles, nav, footer, header from raw HTML */
function cleanHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, "")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, "")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, "");
}

/** Extract <title> text from HTML */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return match ? match[1].trim() : "";
}

/** Fetch a URL and convert its HTML to Markdown */
async function fetchAndConvert(url: string): Promise<{ title: string; content: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Omni-MCP/2.0 (Resource Fetcher)" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  const html = await res.text();
  const title = extractTitle(html) || new URL(url).hostname;
  const cleaned = cleanHtml(html);
  const content = turndown.turndown(cleaned);
  return { title, content };
}

// ──────────────────────────────────────────────
// Mount Registry
// ──────────────────────────────────────────────

/** Set of absolute paths that are currently mounted */
const mountedDirs = new Set<string>();

/** Map of URL → cached entry for mounted web pages */
const mountedUrls = new Map<string, MountedUrlEntry>();

/** Map of absolute DB path → better-sqlite3 Database instance */
const mountedDbs = new Map<string, InstanceType<typeof Database>>();

/** Load previously-persisted mounts from disk */
async function loadMounts(): Promise<void> {
  try {
    const raw = await fs.readFile(CONFIG_FILE, "utf-8");
    const data: ConfigData = JSON.parse(raw);
    if (Array.isArray(data.mountedPaths)) {
      for (const p of data.mountedPaths) {
        if (typeof p === "string") mountedDirs.add(p);
      }
    }
    if (Array.isArray(data.mountedUrls)) {
      for (const entry of data.mountedUrls) {
        if (entry && typeof entry.url === "string") {
          mountedUrls.set(entry.url, entry);
        }
      }
    }
    if (Array.isArray(data.mountedDatabases)) {
      for (const dbPath of data.mountedDatabases) {
        if (typeof dbPath === "string") {
          try {
            const db = new Database(dbPath, { readonly: true });
            mountedDbs.set(dbPath, db);
          } catch {
            // DB file may have been removed — skip silently
          }
        }
      }
    }
  } catch {
    // File doesn't exist yet or is invalid – that's fine
  }
}

/** Persist the current mount set to disk */
async function saveConfig(): Promise<void> {
  try {
    const config: ConfigData = {
      mountedPaths: [...mountedDirs],
      mountedUrls: [...mountedUrls.values()],
      mountedDatabases: [...mountedDbs.keys()],
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.error(`⚠️  Failed to save config: ${err}`);
  }
}

/** Helper: get UrlInfo[] for event bus */
function getUrlInfos(): UrlInfo[] {
  return [...mountedUrls.values()].map((e) => ({ url: e.url, title: e.title }));
}

// ──────────────────────────────────────────────
// File Helpers
// ──────────────────────────────────────────────

/** Recursively collect all files matching ALLOWED_EXTENSIONS under `dir` */
async function collectFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string) {
    let entries;
    try {
      entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (ALLOWED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

/** Collect files across ALL mounted directories */
async function collectAllFiles(): Promise<string[]> {
  const all: string[] = [];
  for (const dir of mountedDirs) {
    const files = await collectFiles(dir);
    all.push(...files);
  }
  return all;
}

/** Derive a human-friendly resource name from a file path */
function fileToResourceName(filePath: string): string {
  for (const dir of mountedDirs) {
    if (filePath.startsWith(dir)) {
      const dirBasename = path.basename(dir);
      const rel = path.relative(dir, filePath);
      return `${dirBasename}/${rel}`;
    }
  }
  return path.basename(filePath);
}

/** Guess a MIME type based on extension */
function mimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".md") return "text/markdown";
  return "text/plain";
}

// ──────────────────────────────────────────────
// SQLite Helpers
// ──────────────────────────────────────────────

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

/** Build a Markdown schema description for a database */
function buildSchemaMarkdown(db: InstanceType<typeof Database>): string {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];

  if (tables.length === 0) return "_No tables found._";

  const lines: string[] = [];
  for (const { name } of tables) {
    lines.push(`## Table: \`${name}\``);
    lines.push("");
    lines.push("| Column | Type | NOT NULL | PK | Default |");
    lines.push("|--------|------|----------|----|---------|");

    const cols = db.prepare(`PRAGMA table_info("${name}")`).all() as ColumnInfo[];
    for (const col of cols) {
      lines.push(
        `| \`${col.name}\` | ${col.type || "ANY"} | ${col.notnull ? "✓" : ""} | ${col.pk ? "✓" : ""} | ${col.dflt_value ?? ""} |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

// ──────────────────────────────────────────────
// MCP Server
// ──────────────────────────────────────────────

const server = new McpServer({
  name: "omni-mcp",
  version: "3.0.0",
});

// ─── Resource Template: Local Files ─────────

server.resource(
  "local-files",
  new ResourceTemplate("file:///{+path}", {
    list: async () => {
      const files = await collectAllFiles();
      return {
        resources: files.map((f) => ({
          uri: `file:///${f}`,
          name: fileToResourceName(f),
          description: `Local file: ${fileToResourceName(f)}`,
          mimeType: mimeType(f),
        })),
      };
    },
  }),
  {
    description: "Exposes .txt and .md files from all mounted directories",
  },
  async (uri, variables) => {
    const filePath = "/" + (variables.path as string);

    // Notify dashboard — flash activity indicator
    bus.resourceRead(path.basename(filePath));

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain",
            text: `[Error] Unable to read file: ${filePath}`,
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: mimeType(filePath),
          text: content,
        },
      ],
    };
  }
);

// ─── Resource Template: Web Pages ───────────

server.resource(
  "web-pages",
  new ResourceTemplate("web:///{+url}", {
    list: async () => ({
      resources: [...mountedUrls.values()].map((entry) => ({
        uri: `web:///${entry.url}`,
        name: `🌐 ${entry.title}`,
        description: `Web page: ${entry.url}`,
        mimeType: "text/markdown" as const,
      })),
    }),
  }),
  {
    description: "Web pages fetched and converted to Markdown",
  },
  async (uri, variables) => {
    const url = variables.url as string;
    const entry = mountedUrls.get(url) ?? mountedUrls.get(`https://${url}`);

    // Notify dashboard
    bus.resourceRead(`🌐 ${entry?.title ?? url}`);

    if (!entry) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain" as const,
            text: `[Error] URL not mounted: ${url}`,
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown" as const,
          text: `# ${entry.title}\n\n> Source: ${entry.url}  \n> Fetched: ${entry.fetchedAt}\n\n---\n\n${entry.content}`,
        },
      ],
    };
  }
);

// ─── Resource Template: SQLite Schema ───────

server.resource(
  "sqlite-schema",
  new ResourceTemplate("sqlite:///{+dbPath}", {
    list: async () => ({
      resources: [...mountedDbs.keys()].map((dbPath) => ({
        uri: `sqlite:///${dbPath}`,
        name: `🗄️ ${path.basename(dbPath)} schema`,
        description: `Schema for SQLite database: ${dbPath}`,
        mimeType: "text/markdown" as const,
      })),
    }),
  }),
  {
    description: "Auto-exposed schema of mounted SQLite databases",
  },
  async (uri, variables) => {
    const dbPath = "/" + (variables.dbPath as string);

    bus.resourceRead(`🗄️ ${path.basename(dbPath)} schema`);

    const db = mountedDbs.get(dbPath);
    if (!db) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/plain" as const,
            text: `[Error] Database not mounted: ${dbPath}`,
          },
        ],
      };
    }

    const schema = buildSchemaMarkdown(db);

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown" as const,
          text: `# Schema: ${path.basename(dbPath)}\n\n> Path: \`${dbPath}\`\n\n${schema}`,
        },
      ],
    };
  }
);

// ─── Shared folder mount handler ────────────

const mountSchema = {
  path: z.string().describe("Absolute path to the folder to mount, e.g. /Users/you/Documents"),
};

const MOUNT_DESCRIPTION =
  "Mount a local folder so its .txt and .md files become readable resources. " +
  "The mount is persisted across server restarts.";

async function handleMount({ path: inputPath }: { path: string }) {
  const resolvedPath = path.resolve(inputPath);

  // Validate that the path exists and is a directory
  try {
    const stat = await fs.stat(resolvedPath);
    if (!stat.isDirectory()) {
      return {
        content: [{ type: "text" as const, text: `❌ "${resolvedPath}" is not a directory.` }],
      };
    }
  } catch {
    return {
      content: [{ type: "text" as const, text: `❌ Path "${resolvedPath}" does not exist.` }],
    };
  }

  // Check if already mounted (duplicate detection)
  if (mountedDirs.has(resolvedPath)) {
    const files = await collectFiles(resolvedPath);
    return {
      content: [
        {
          type: "text" as const,
          text:
            `⚠️  "${resolvedPath}" is already mounted — skipping duplicate.\n` +
            `📄 ${files.length} resource file(s) already available.`,
        },
      ],
    };
  }

  // Mount it
  mountedDirs.add(resolvedPath);
  await saveConfig();
  bus.mountChange([...mountedDirs]);

  const files = await collectFiles(resolvedPath);
  const fileList =
    files.length > 0
      ? files.map((f) => `  • ${fileToResourceName(f)}`).join("\n")
      : "  (no .txt or .md files found)";

  return {
    content: [
      {
        type: "text" as const,
        text:
          `✅ Successfully mounted "${resolvedPath}".\n` +
          `📄 Found ${files.length} resource file(s):\n${fileList}\n\n` +
          `These files are now available as resources. Use resources/list to browse them.`,
      },
    ],
  };
}

// ─── Tool: mount_folder ─────────────────────

server.tool("mount_folder", MOUNT_DESCRIPTION, mountSchema, handleMount);

// ─── Tool: add_new_source (alias) ───────────

server.tool(
  "add_new_source",
  MOUNT_DESCRIPTION + " (Alias for mount_folder.)",
  mountSchema,
  handleMount
);

// ─── Tool: mount_url ────────────────────────

server.tool(
  "mount_url",
  "Fetch a web page, convert its HTML to Markdown, and expose it as an MCP resource. " +
    "The content is cached and persisted across server restarts.",
  {
    url: z.string().url().describe("Full URL of the web page to mount, e.g. https://example.com"),
  },
  async ({ url }) => {
    // Normalize URL
    const normalizedUrl = url.trim();

    // Duplicate check
    if (mountedUrls.has(normalizedUrl)) {
      const existing = mountedUrls.get(normalizedUrl)!;
      return {
        content: [
          {
            type: "text" as const,
            text:
              `⚠️  "${normalizedUrl}" is already mounted — skipping duplicate.\n` +
              `📄 Cached as: "${existing.title}" (fetched ${existing.fetchedAt})`,
          },
        ],
      };
    }

    // Fetch and convert
    try {
      const { title, content } = await fetchAndConvert(normalizedUrl);

      const entry: MountedUrlEntry = {
        url: normalizedUrl,
        title,
        content,
        fetchedAt: new Date().toISOString(),
      };

      mountedUrls.set(normalizedUrl, entry);
      await saveConfig();
      bus.urlChange(getUrlInfos());

      // Truncate preview
      const preview = content.length > 200 ? content.slice(0, 200) + "…" : content;

      return {
        content: [
          {
            type: "text" as const,
            text:
              `✅ Successfully mounted web page.\n` +
              `🌐 Title: "${title}"\n` +
              `🔗 URL: ${normalizedUrl}\n` +
              `📄 Content: ${content.length} characters (Markdown)\n\n` +
              `Preview:\n${preview}\n\n` +
              `This page is now available as a resource.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to fetch "${normalizedUrl}": ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  }
);

// ─── Tool: mount_sqlite ─────────────────────

server.tool(
  "mount_sqlite",
  "Mount a local SQLite database file. Its schema is automatically exposed as an MCP resource " +
    "so the AI knows the table structures. Use query_sqlite to run SELECT queries against it.",
  {
    path: z
      .string()
      .describe("Absolute path to the SQLite database file, e.g. /Users/you/data.db"),
  },
  async ({ path: inputPath }) => {
    const resolvedPath = path.resolve(inputPath);

    // Duplicate check
    if (mountedDbs.has(resolvedPath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `⚠️  "${resolvedPath}" is already mounted — skipping duplicate.`,
          },
        ],
      };
    }

    // Validate file exists
    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) {
        return {
          content: [
            { type: "text" as const, text: `❌ "${resolvedPath}" is not a file.` },
          ],
        };
      }
    } catch {
      return {
        content: [
          { type: "text" as const, text: `❌ File "${resolvedPath}" does not exist.` },
        ],
      };
    }

    // Open in read-only mode
    let db: InstanceType<typeof Database>;
    try {
      db = new Database(resolvedPath, { readonly: true });
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Failed to open database: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }

    mountedDbs.set(resolvedPath, db);
    await saveConfig();
    bus.sqliteChange([...mountedDbs.keys()]);

    // Summarize tables
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as { name: string }[];

    const tableList =
      tables.length > 0
        ? tables.map((t) => `  • ${t.name}`).join("\n")
        : "  (no user tables found)";

    return {
      content: [
        {
          type: "text" as const,
          text:
            `✅ Successfully mounted SQLite database.\n` +
            `🗄️  Path: ${resolvedPath}\n` +
            `📋 Tables (${tables.length}):\n${tableList}\n\n` +
            `The schema is now available as a resource. Use query_sqlite to run SELECT queries.`,
        },
      ],
    };
  }
);

// ─── Tool: query_sqlite ─────────────────────

server.tool(
  "query_sqlite",
  "Execute a read-only SQL query (SELECT only) against a mounted SQLite database " +
    "and return the results as JSON. Maximum 100 rows returned.",
  {
    path: z.string().describe("Absolute path to the mounted SQLite database file"),
    sql: z.string().describe("SQL SELECT query to execute"),
  },
  async ({ path: inputPath, sql }) => {
    const resolvedPath = path.resolve(inputPath);

    // Check DB is mounted
    const db = mountedDbs.get(resolvedPath);
    if (!db) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Database "${resolvedPath}" is not mounted. Use mount_sqlite first.`,
          },
        ],
      };
    }

    // Safety: only allow SELECT statements
    const trimmed = sql.trim();
    if (!/^SELECT\b/i.test(trimmed)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Only SELECT queries are allowed. Received: "${trimmed.split(/\s+/)[0]}"`,
          },
        ],
      };
    }

    // Execute
    try {
      bus.resourceRead(`🗄️ query → ${path.basename(resolvedPath)}`);

      const rows = db.prepare(trimmed).all();
      const capped = rows.slice(0, 100);
      const truncated = rows.length > 100;

      return {
        content: [
          {
            type: "text" as const,
            text:
              JSON.stringify(capped, null, 2) +
              (truncated ? `\n\n⚠️ Results truncated to 100 rows (${rows.length} total).` : ""),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Query failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  }
);

// ─── Tool: unmount_folder ───────────────────

server.tool(
  "unmount_folder",
  "Unmount a previously mounted folder so its files are no longer exposed as resources.",
  {
    path: z.string().describe("Absolute path of the folder to unmount"),
  },
  async ({ path: inputPath }) => {
    const resolvedPath = path.resolve(inputPath);

    if (!mountedDirs.has(resolvedPath)) {
      return {
        content: [
          { type: "text" as const, text: `ℹ️  "${resolvedPath}" is not currently mounted.` },
        ],
      };
    }

    mountedDirs.delete(resolvedPath);
    await saveConfig();
    bus.mountChange([...mountedDirs]);

    return {
      content: [
        {
          type: "text" as const,
          text: `✅ Successfully unmounted "${resolvedPath}". Its files are no longer exposed.`,
        },
      ],
    };
  }
);

// ─── Tool: list_mounts ─────────────────────

server.tool(
  "list_mounts",
  "List all currently mounted directories, URLs, and databases.",
  {},
  async () => {
    const lines: string[] = [];

    // Folders
    if (mountedDirs.size > 0) {
      lines.push("📂 Folders:");
      for (const dir of mountedDirs) {
        const files = await collectFiles(dir);
        lines.push(`   • ${dir}  (${files.length} file(s))`);
      }
    }

    // URLs
    if (mountedUrls.size > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("🌐 Web Pages:");
      for (const entry of mountedUrls.values()) {
        lines.push(`   • ${entry.title}  →  ${entry.url}`);
      }
    }

    // Databases
    if (mountedDbs.size > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("🗄️  Databases:");
      for (const dbPath of mountedDbs.keys()) {
        lines.push(`   • ${dbPath}`);
      }
    }

    if (lines.length === 0) {
      return {
        content: [{ type: "text" as const, text: "No directories, URLs, or databases are currently mounted." }],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Currently mounted sources:\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// ──────────────────────────────────────────────
// Boot
// ──────────────────────────────────────────────

async function main() {
  // Load persisted mounts
  await loadMounts();

  // Always include the default directory
  mountedDirs.add(DEFAULT_DIR);

  // Launch TUI dashboard (renders to stderr; falls back to plain text if non-TTY)
  startDashboard([...mountedDirs], getUrlInfos(), [...mountedDbs.keys()]);

  // Connect MCP transport (uses stdout/stdin)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Signal dashboard that we're online
  bus.serverOnline();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
