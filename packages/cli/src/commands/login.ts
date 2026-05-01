import { createInterface } from "node:readline";
import { Command } from "commander";
import { writeConfig, readConfig } from "../lib/config.js";

export const loginCommand = new Command("login")
  .description("Configure API key and base URL")
  .option("-k, --api-key <key>", "API key (shk_...)")
  .option("-u, --base-url <url>", "Base URL of your DropItX instance")
  .action(async (opts: { apiKey?: string; baseUrl?: string }) => {
    try {
      const existing = readConfig();
      const rl = createInterface({ input: process.stdin, output: process.stderr });

      const ask = (prompt: string, defaultVal?: string): Promise<string> =>
        new Promise((resolve) => {
          const suffix = defaultVal ? ` (${defaultVal})` : "";
          rl.question(`  ${prompt}${suffix}: `, (answer) => {
            resolve(answer.trim() || defaultVal || "");
          });
        });

      const baseUrl = opts.baseUrl || await ask("Base URL", existing.base_url || "https://your-app.vercel.app");
      const apiKey = opts.apiKey || await ask("API key (shk_...)");

      rl.close();

      if (!apiKey.startsWith("shk_")) {
        console.error("Error: API key must start with 'shk_'.");
        process.exit(1);
      }
      if (!baseUrl) {
        console.error("Error: Base URL is required.");
        process.exit(1);
      }

      writeConfig({ api_key: apiKey, base_url: baseUrl });
      console.log("  Saved! You can now use dropitx commands.");
      process.exit(0);
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
