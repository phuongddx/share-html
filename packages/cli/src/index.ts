import { Command } from "commander";
import { publishCommand } from "./commands/publish.js";
import { updateCommand } from "./commands/update.js";
import { deleteCommand } from "./commands/delete.js";
import { listCommand } from "./commands/list.js";
import { loginCommand } from "./commands/login.js";
import { whoamiCommand } from "./commands/whoami.js";

const program = new Command();

program
  .name("dropitx")
  .description("Publish files to shareable URLs")
  .version("0.1.0");

program.addCommand(publishCommand);
program.addCommand(updateCommand);
program.addCommand(deleteCommand);
program.addCommand(listCommand);
program.addCommand(loginCommand);
program.addCommand(whoamiCommand);

program.parse();
