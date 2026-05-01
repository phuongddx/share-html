import { readFileSync, statSync } from "node:fs";
import { Command } from "commander";
import { ShareHtmlClient } from "../lib/api-client.js";
import * as spinner from "../lib/spinner.js";

export const updateCommand = new Command("update")
  .description("Update an existing share with new content")
  .argument("<slug>", "Share slug to update")
  .argument("<file>", "Path to new markdown file")
  .option("-t, --title <title>", "New title")
  .option("-f, --filename <name>", "New filename")
  .action(async (slug: string, file: string, opts: { title?: string; filename?: string }) => {
    try {
      const content = readFileSync(file, "utf-8");
      if (!content.trim()) {
        console.error("Error: File is empty.");
        process.exit(2);
      }
      if (statSync(file).size > 1024 * 1024) {
        console.error("Error: File exceeds 1MB limit.");
        process.exit(2);
      }

      spinner.start("Updating...");
      const client = new ShareHtmlClient();
      const result = await client.update(slug, content, {
        title: opts.title,
        filename: opts.filename,
      });
      spinner.succeed("Updated!");

      console.log(`  URL:       ${result.url}`);
      console.log(`  Updated:   ${new Date(result.updated_at).toLocaleString()}`);
      process.exit(0);
    } catch (err) {
      spinner.fail("Update failed");
      console.error(err instanceof Error ? err.message : err);
      process.exit(3);
    }
  });
