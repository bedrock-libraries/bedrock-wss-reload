/* eslint-disable @typescript-eslint/naming-convention */
import { FileSystem, JsonFile } from "@rushstack/node-core-library";
import { parse } from "semver";

const minecraftModules = new Set([
  "@minecraft/server",
  "@minecraft/server-gametest",
  "@minecraft/server-net",
  "@minecraft/server-ui",
  "@minecraft/server-admin",
]);

interface BpDependency {
  module_name: string;
  version: string;
}

export interface GenerateBpManifestTaskOptions {
  filterOutGameTestModule?: boolean;
}

export function generateBpManifestTask(options: GenerateBpManifestTaskOptions) {
  return async () => {
    const bpManifestPath = "behavior_pack/manifest.json";
    const bp = JsonFile.load(bpManifestPath);
    const packageJson = JsonFile.load("package.json");
    const deps: BpDependency[] = bp.dependencies.filter((f: BpDependency) => {
      if (minecraftModules.has(f.module_name)) {
        return false;
      } else {
        return true;
      }
    });
    for (const key in packageJson.dependencies) {
      if (
        key === "@minecraft/server-gametest" &&
        options.filterOutGameTestModule
      ) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(packageJson.dependencies, key)) {
        const versionStr = packageJson.dependencies[key];
        const version = versionStr.replace("^", "");
        if (minecraftModules.has(key)) {
          const semver = parse(version);
          const preRelease = version.includes("beta") ? "-beta" : "";
          deps.push({
            module_name: key,
            version: `${semver!.major}.${semver!.minor}.${
              semver!.patch
            }${preRelease}`,
          });
        }
      }
    }
    bp.dependencies = deps.sort();
    FileSystem.ensureEmptyFolder("./dist/manifest/behavior_pack");
    JsonFile.save(bp, "./dist/manifest/behavior_pack/manifest.json");
  };
}
