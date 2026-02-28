/**
 * Event bus — decouples MCP handlers from the TUI dashboard.
 *
 * Events:
 *   server:online     → MCP transport connected
 *   resource:read     → Agent read a resource (payload: file name)
 *   mount:change      → Folder mount list changed (payload: current paths[])
 *   url:change        → URL mount list changed (payload: {url, title}[])
 *   sqlite:change     → SQLite mount list changed (payload: db paths[])
 */

import { EventEmitter } from "node:events";

export interface UrlInfo {
  url: string;
  title: string;
}

class OmniEventBus extends EventEmitter {
  serverOnline() {
    this.emit("server:online");
  }
  resourceRead(fileName: string) {
    this.emit("resource:read", fileName);
  }
  mountChange(mounts: string[]) {
    this.emit("mount:change", mounts);
  }
  urlChange(urls: UrlInfo[]) {
    this.emit("url:change", urls);
  }
  sqliteChange(dbs: string[]) {
    this.emit("sqlite:change", dbs);
  }
}

export const bus = new OmniEventBus();
