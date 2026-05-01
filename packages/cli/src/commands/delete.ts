import { createInterface } from "node:readline";
import { Command } from "commander";
import { ShareHtmlClient } from "../lib/api-client.js";
import * as spinner from "../lib/spinner.js";

export const deleteCommand = new Command("delete")
  .description("Delete a share")
  .argument("<slug>", "Share slug to delete")
  .option("-y, --yes", "Skip confirmation prompt")
  .action(async (slug: string, opts: { yes?: boolean }) => {
    try {
      if (!opts.yes) {
        const confirmed = await confirm(`Delete share "${slug}"? (y/N) `);
        if (!confirmed) {
          console.log("Cancelled.");
          process.exit(0);
        }
      }

      spinner.start("Deleting...");
      const client = new ShareHtmlClient();
      await client.delete(slug);
      spinner.succeed("Deleted!");
      process.exit(0);
    } catch (err) {
      spinner.fail("Delete failed");
      console.error(err instanceof Error ? err.message : err);
      process.exit(3);
    }
  });

function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}
