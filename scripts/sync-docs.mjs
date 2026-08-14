import { cpSync, rmSync } from "node:fs";

cpSync("dist/index.html", "docs/index.html");
rmSync("docs/assets", { recursive: true, force: true });
cpSync("dist/assets", "docs/assets", { recursive: true });
