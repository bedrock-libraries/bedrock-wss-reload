/* eslint-disable @typescript-eslint/naming-convention */
import { FileSystem, JsonFile } from "@rushstack/node-core-library";
import { parse } from "semver";
import { setManifestVersion } from "./version";

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
    const rpManifestPath = "resource_pack/manifest.json";
    const bp = JsonFile.load(bpManifestPath);
    const rp = JsonFile.load(rpManifestPath);
    const packageJson = JsonFile.load("package.json");
    const currentPackageJsonVersion = packageJson.version
      .split(".")
      .map((s: string) => {
        return Number(s);
      });
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
    setManifestVersion(bp, currentPackageJsonVersion);
    setManifestVersion(rp, currentPackageJsonVersion);
    FileSystem.ensureEmptyFolder("./dist/manifest/behavior_pack");
    FileSystem.ensureEmptyFolder("./dist/manifest/resource_pack");
    JsonFile.save(bp, "./dist/manifest/behavior_pack/manifest.json");
    JsonFile.save(rp, "./dist/manifest/resource_pack/manifest.json");
  };
}
