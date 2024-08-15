/* eslint-disable @typescript-eslint/naming-convention */
import { FileSystem, JsonFile, JsonSchema } from "@rushstack/node-core-library";
import { parse } from "semver";
import * as path from "path";
import { v4 } from "uuid";
import { argv, logger } from "just-scripts";


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

type McNumberVersion = [number, number, number];

interface BpCustomDependency {
  uuid: string;
  version: McNumberVersion;
}

type Dependency = BpMcDependency | BpCustomDependency;

export interface GenerateBpManifestTaskOptions {
  filterOutGameTestModule?: boolean;
}

const PackJsonSchema = JsonSchema.fromFile(
  path.resolve(__dirname, "../schema/pack.json")
);

type PackJsonManifestSection = {
  uuid: string;
};
type PackJsonBpManifestSection = PackJsonManifestSection & {
  depends_on_resource_pack: boolean;
};
type PackJsonRpManifestSection = PackJsonManifestSection & {
  depends_on_behavior_pack: boolean;
};

export interface PackJson {
  behavior_pack: PackJsonBpManifestSection;
  script_module: {
    uuid: string;
  };
  resource_pack: PackJsonRpManifestSection;
  resource_pack_module: {
    uuid: string;
  };
  min_engine_version: McNumberVersion;
  name: string;
  description: string;
  authors: string[];
}

function readPackJson() {
  return JsonFile.loadAndValidate("pack.json", PackJsonSchema) as PackJson;
}

export function generateBpManifestTask(options: GenerateBpManifestTaskOptions) {
  return async () => {
    const bpManifestPath = "dist/packs/behavior_pack/manifest.json";
    const rpManifestPath = "dist/packs/resource_pack/manifest.json";
    const bp = JsonFile.load(bpManifestPath);
    const rp = JsonFile.load(rpManifestPath);
    const configJson = readPackJson();
    const packageJson = JsonFile.load("package.json");
    const currentPackageJsonVersion = packageJson.version
      .split(".")
      .map((s: string) => {
        return Number(s);
      }) as McNumberVersion;
    rp.modules = [
      {
        description: configJson.description,
        type: "resources",
        uuid: configJson.resource_pack_module.uuid,
        version: currentPackageJsonVersion,
      },
    ];
    bp.modules = [
      {
        description: configJson.description,
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

    const stringVersion = currentPackageJsonVersion.join(".");

    bp.header.uuid = configJson.behavior_pack.uuid;
    bp.header.version = currentPackageJsonVersion;
    bp.header.name = `${configJson.name} [BP] - ${stringVersion}`;
    bp.header.description = configJson.description;
    bp.header.min_engine_version = configJson.min_engine_version;
    bp.metadata.authors = configJson.authors;

    rp.header.uuid = configJson.resource_pack.uuid;
    rp.header.version = currentPackageJsonVersion;
    rp.header.name = `${configJson.name} [BP] - ${stringVersion}`;
    rp.header.description = configJson.description;
    rp.header.min_engine_version = configJson.min_engine_version;
    rp.metadata.authors = configJson.authors;

    JsonFile.save(bp, bpManifestPath);
    JsonFile.save(rp, rpManifestPath);
  };
}

export function generateNewUUIDsTask() {
  return async () => {
    const pack = readPackJson();

    pack.behavior_pack.uuid = v4();
    pack.script_module.uuid = v4();

    pack.resource_pack.uuid = v4();
    pack.resource_pack_module.uuid = v4();

    JsonFile.save(pack, "pack.json");
  };
}
