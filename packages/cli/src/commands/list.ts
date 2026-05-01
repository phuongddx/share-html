import { Command } from "commander";
import { ShareHtmlClient } from "../lib/api-client.js";
import * as spinner from "../lib/spinner.js";

export const listCommand = new Command("list")
  .description("List your published documents")
  .option("-n, --limit <number>", "Number of results", "20")
  .option("-o, --offset <number>", "Offset for pagination", "0")
  .action(async (opts: { limit: string; offset: string }) => {
    try {
      spinner.start("Fetching documents...");
      const client = new ShareHtmlClient();
      const result = await client.list(parseInt(opts.limit, 10), parseInt(opts.offset, 10));
      spinner.succeed(`Found ${result.total} document${result.total !== 1 ? "s" : ""}`);

      if (result.documents.length === 0) {
        console.log("  No documents found.");
        process.exit(0);
      }

      for (const doc of result.documents) {
        const privacy = doc.is_private ? "🔒 " : "   ";
        const title = doc.title || doc.filename;
        const date = new Date(doc.created_at).toLocaleDateString();
        console.log(`  ${privacy}${doc.slug}  ${title}  (${doc.view_count} views, ${date})`);
      }

      if (result.total > result.documents.length) {
        console.log(`\n  Showing ${result.documents.length} of ${result.total}. Use --offset to see more.`);
      }
      process.exit(0);
    } catch (err) {
      spinner.fail("List failed");
      console.error(err instanceof Error ? err.message : err);
      process.exit(3);
    }
  });
