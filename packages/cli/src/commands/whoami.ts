import { Command } from "commander";
import { ShareHtmlClient } from "../lib/api-client.js";
import { readConfig } from "../lib/config.js";
import * as spinner from "../lib/spinner.js";

export const whoamiCommand = new Command("whoami")
  .description("Verify current authentication")
  .action(async () => {
    try {
      const config = readConfig();
      if (!config.api_key) {
        console.log("  Not authenticated. Run: dropitx login");
        process.exit(1);
      }

      spinner.start("Verifying...");
      const client = new ShareHtmlClient();
      await client.whoami();
      spinner.succeed("Authenticated!");

      console.log(`  Base URL: ${config.base_url}`);
      console.log(`  Key:      ${config.api_key?.slice(0, 12)}...`);
      process.exit(0);
    } catch (err) {
      spinner.fail("Authentication failed");
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });
