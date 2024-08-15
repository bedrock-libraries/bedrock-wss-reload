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

interface BpMcDependency {
  module_name: string;
  version: string;
}

interface BpCustomDependency {
  uuid: string;
  version: [number, number, number];
}

type Dependency = BpMcDependency | BpCustomDependency;

export interface GenerateBpManifestTaskOptions {
  filterOutGameTestModule?: boolean;
}

export interface PackJson {
  behavior_pack: {
    uuid: string;
    depends_on_resource_pack: boolean;
  };
  script_module: {
    uuid: string;
    description: string;
  };
  resource_pack: {
    uuid: string;
    depends_on_behavior_pack: boolean;
  };
  resource_pack_module: {
    uuid: string;
    description: string;
  };
}

export function generateBpManifestTask(options: GenerateBpManifestTaskOptions) {
  return async () => {
    const bpManifestPath = "dist/packs/behavior_pack/manifest.json";
    const rpManifestPath = "dist/packs/resource_pack/manifest.json";
    const bp = JsonFile.load(bpManifestPath);
    const rp = JsonFile.load(rpManifestPath);
    const configJson = JsonFile.load("pack.json") as PackJson;
    const packageJson = JsonFile.load("package.json");
    const currentPackageJsonVersion = packageJson.version
      .split(".")
      .map((s: string) => {
        return Number(s);
      });
    rp.modules = [
      {
        description: configJson.resource_pack_module.description,
        type: "resources",
        uuid: configJson.resource_pack_module.uuid,
        version: currentPackageJsonVersion,
      },
    ];
    bp.modules = [
      {
        description: configJson.script_module.description,
        language: "javascript",
        type: "script",
        uuid: configJson.script_module.uuid,
        version: currentPackageJsonVersion,
        entry: "scripts/main.js",
      },
    ];
    const bpDeps: Dependency[] = [];
    const rpDeps: Dependency[] = [];
    if (configJson.behavior_pack.depends_on_resource_pack) {
      bpDeps.push({
        uuid: configJson.resource_pack.uuid,
        version: currentPackageJsonVersion,
      });
    }
    if (configJson.resource_pack.depends_on_behavior_pack) {
      rpDeps.push({
        uuid: configJson.behavior_pack.uuid,
        version: currentPackageJsonVersion,
      });
    }
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
          bpDeps.push({
            module_name: key,
            version: `${semver!.major}.${semver!.minor}.${
              semver!.patch
            }${preRelease}`,
          });
        }
      }
    }
    bp.dependencies = bpDeps.sort();
    rp.dependencies = rpDeps.sort();

    bp.header.uuid = configJson.behavior_pack.uuid;
    bp.header.version = currentPackageJsonVersion;

    rp.header.uuid = configJson.resource_pack.uuid;
    rp.header.version = currentPackageJsonVersion;

    JsonFile.save(bp, bpManifestPath);
    JsonFile.save(rp, rpManifestPath);
  };
}
