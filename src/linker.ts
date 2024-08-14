import { glob } from "glob";
import * as fsp from "fs/promises";
import * as path from "path";

interface LinkGameTestTaskOptions {
  autoRunOnWorldStart?: boolean;
  productionBuild?: boolean;
}

export function linkGameTestsTask(opts: LinkGameTestTaskOptions) {
  return async () => {
    const linkerFilePath = "scripts/linker.ts";
    const linkerFileContents: string[] = [];
    if (opts.productionBuild) {
      const gameTestFiles = await glob("scripts/**/*.test.ts");
      for (const gameTestFilePath of gameTestFiles) {
        const relPath = path.relative("scripts", gameTestFilePath);
        linkerFileContents.push(`import "./${relPath}";`);
      }
      if (opts.autoRunOnWorldStart) {
        linkerFileContents.push(
          `import { world } from "@minecraft/server";
      
      world.afterEvents.worldInitialize.subscribe(async () => {
        const overworld = world.getDimension("overworld");
        await overworld.runCommandAsync("gametest runset");
      });
      `
        );
      }
    }
    await fsp.writeFile(linkerFilePath, linkerFileContents.join("\n"));
  };
}
