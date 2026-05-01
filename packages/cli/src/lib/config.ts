import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const LEGACY_DIR = join(homedir(), ".share-html");
const CONFIG_DIR = join(homedir(), ".dropitx");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

// Migrate config from legacy ~/.share-html on first run of renamed CLI
if (existsSync(LEGACY_DIR) && !existsSync(CONFIG_DIR)) {
  try {
    renameSync(LEGACY_DIR, CONFIG_DIR);
    console.log("Migrated config from ~/.share-html to ~/.dropitx");
  } catch {
    console.warn("Warning: could not migrate config from ~/.share-html — continuing with legacy path");
  }
}

export interface Config {
  api_key?: string;
  base_url?: string;
}

export function readConfig(): Config {
  if (!existsSync(CONFIG_PATH)) return {};
  return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
}

export function writeConfig(partial: Config): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  const existing = readConfig();
  const merged = { ...existing, ...partial };
  writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2), { mode: 0o600 });
}

export function isLoggedIn(): boolean {
  const config = readConfig();
  return !!config.api_key && !!config.base_url;
}

export function requireAuth(): { apiKey: string; baseUrl: string } {
  const config = readConfig();
  if (!config.api_key || !config.base_url) {
    console.error("Not authenticated. Run: dropitx login");
    process.exit(1);
  }
  return { apiKey: config.api_key, baseUrl: config.base_url };
}
