/**
 * TUI Dashboard — renders a live status panel to stderr
 * so it never interferes with MCP's JSON-RPC on stdout.
 */

import React, { useState, useEffect, type FC } from "react";
import { render, Box, Text } from "ink";
import figlet from "figlet";
import { Readable } from "node:stream";
import { bus, type UrlInfo } from "./events.js";

// ─── Activity log entry ────────────────────

interface ActivityEntry {
  id: number;
  fileName: string;
  timestamp: number;
}

let activityId = 0;

// ─── Dashboard Component ───────────────────

interface DashboardProps {
  initialMounts: string[];
  initialUrls: UrlInfo[];
  initialDbs: string[];
}

const Dashboard: FC<DashboardProps> = ({ initialMounts, initialUrls, initialDbs }) => {
  const [online, setOnline] = useState(false);
  const [mounts, setMounts] = useState<string[]>(initialMounts);
  const [urls, setUrls] = useState<UrlInfo[]>(initialUrls);
  const [dbs, setDbs] = useState<string[]>(initialDbs);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);

  // Subscribe to event bus
  useEffect(() => {
    const onOnline = () => setOnline(true);

    const onMount = (newMounts: string[]) => setMounts([...newMounts]);

    const onUrlChange = (newUrls: UrlInfo[]) => setUrls([...newUrls]);

    const onSqliteChange = (newDbs: string[]) => setDbs([...newDbs]);

    const onRead = (fileName: string) => {
      const entry: ActivityEntry = {
        id: ++activityId,
        fileName,
        timestamp: Date.now(),
      };
      setActivities((prev) => [...prev.slice(-4), entry]); // keep last 5

      // Auto-clear after 4 seconds
      setTimeout(() => {
        setActivities((prev) => prev.filter((a) => a.id !== entry.id));
      }, 4000);
    };

    bus.on("server:online", onOnline);
    bus.on("mount:change", onMount);
    bus.on("url:change", onUrlChange);
    bus.on("sqlite:change", onSqliteChange);
    bus.on("resource:read", onRead);

    return () => {
      bus.off("server:online", onOnline);
      bus.off("mount:change", onMount);
      bus.off("url:change", onUrlChange);
      bus.off("sqlite:change", onSqliteChange);
      bus.off("resource:read", onRead);
    };
  }, []);

  // Generate ASCII banner (cached on first render)
  const banner = figlet.textSync("Omni-MCP", { font: "Small" });

  /** Shorten a long string for display */
  const shorten = (s: string, max: number) =>
    s.length > max ? "…" + s.slice(s.length - (max - 1)) : s;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      {/* ── Title ── */}
      <Text color="cyan" bold>
        {banner}
      </Text>

      <Text> </Text>

      {/* ── Status bar ── */}
      <Box gap={1}>
        <Text color={online ? "green" : "yellow"} bold>
          {online ? "●" : "◌"}{" "}
          {online ? "Server Online" : "Server Starting…"}
        </Text>
        <Text color="gray">│</Text>
        <Text color="gray">stdio transport</Text>
        <Text color="gray">│</Text>
        <Text color="gray">v3.0.0</Text>
      </Box>

      <Text color="gray">{"━".repeat(52)}</Text>
      <Text> </Text>

      {/* ── Mounted Folders ── */}
      <Text bold color="white">
        📂 Folders ({mounts.length})
      </Text>
      {mounts.length === 0 ? (
        <Text color="gray">   (none)</Text>
      ) : (
        mounts.map((m, i) => {
          const isLast = i === mounts.length - 1 && urls.length === 0 && dbs.length === 0;
          const connector = isLast ? "└──" : "├──";
          return (
            <Text key={m} color="cyan">
              {"   "}
              {connector} {shorten(m, 45)}
            </Text>
          );
        })
      )}

      <Text> </Text>

      {/* ── Mounted URLs ── */}
      <Text bold color="white">
        🌐 Web Pages ({urls.length})
      </Text>
      {urls.length === 0 ? (
        <Text color="gray">   (none)</Text>
      ) : (
        urls.map((u, i) => {
          const isLast = i === urls.length - 1 && dbs.length === 0;
          const connector = isLast ? "└──" : "├──";
          return (
            <Text key={u.url} color="magenta">
              {"   "}
              {connector} {shorten(u.title, 25)} → {shorten(u.url, 30)}
            </Text>
          );
        })
      )}

      <Text> </Text>

      {/* ── Mounted Databases ── */}
      <Text bold color="white">
        🗄️  Databases ({dbs.length})
      </Text>
      {dbs.length === 0 ? (
        <Text color="gray">   (none)</Text>
      ) : (
        dbs.map((db, i) => {
          const isLast = i === dbs.length - 1;
          const connector = isLast ? "└──" : "├──";
          return (
            <Text key={db} color="yellow">
              {"   "}
              {connector} {shorten(db, 45)}
            </Text>
          );
        })
      )}

      <Text> </Text>

      {/* ── Activity Monitor ── */}
      <Text bold color="white">
        ⚡ Live Activity
      </Text>
      {activities.length === 0 ? (
        <Text color="gray">   └── waiting for agent activity…</Text>
      ) : (
        activities.map((a, i) => {
          const isLast = i === activities.length - 1;
          const age = Date.now() - a.timestamp;
          // Fade: bright → dim as the entry ages
          const color = age < 1000 ? "magentaBright" : age < 2500 ? "magenta" : "gray";
          return (
            <Text key={a.id} color={color}>
              {"   "}
              {isLast ? "└──" : "├──"} AI 正在读取: {a.fileName}
            </Text>
          );
        })
      )}
    </Box>
  );
};

// ─── Launcher ──────────────────────────────

/**
 * Start the TUI dashboard.
 * - Renders to stderr (stdout is reserved for MCP JSON-RPC)
 * - Uses a dummy stdin so ink never touches process.stdin
 * - Only renders the full TUI when stderr is a TTY;
 *   falls back to plain text logging otherwise.
 */
export function startDashboard(
  initialMounts: string[],
  initialUrls: UrlInfo[],
  initialDbs: string[],
): void {
  if (!process.stderr.isTTY) {
    // Non-TTY fallback: plain logging
    console.error("🚀 Omni-MCP server starting…");
    console.error(`📂 Folders: ${initialMounts.join(", ") || "(none)"}`);
    console.error(`🌐 URLs: ${initialUrls.map((u) => u.url).join(", ") || "(none)"}`);
    console.error(`🗄️  Databases: ${initialDbs.join(", ") || "(none)"}`);
    bus.on("server:online", () => console.error("✅ Server online"));
    bus.on("resource:read", (f: string) =>
      console.error(`⚡ AI reading: ${f}`)
    );
    return;
  }

  // Create a dummy readable so ink doesn't hijack process.stdin
  const dummyInput = new Readable({ read() {} });
  Object.assign(dummyInput, { isTTY: false, setRawMode: () => dummyInput });

  render(
    <Dashboard
      initialMounts={initialMounts}
      initialUrls={initialUrls}
      initialDbs={initialDbs}
    />,
    {
      stdout: process.stderr,
      stdin: dummyInput as any,
      exitOnCtrlC: false,
      patchConsole: false,
    },
  );
}
