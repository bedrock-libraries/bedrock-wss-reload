/* eslint-disable @typescript-eslint/naming-convention */
import axios from "axios";
import * as path from "path";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as unzipper from "unzipper";
import * as os from "os";
import { FileSystem, PosixModeBits } from "@rushstack/node-core-library";

function getPlatform() {
  return os.platform() === "win32" ? "win" : "linux";
}

const testvilleTemplatePath = path.resolve(
  __dirname,
  "../bds-template/world_templates/Testville.mcworld"
);

const bdsServerPropertiesDefaultPath = path.resolve(
  __dirname,
  "../bds-template/server.properties"
);

export interface BdsOptions {
  preview?: boolean;
}

type BdsPlatformId =
  | "serverBedrockPreviewWindows"
  | "serverBedrockWindows"
  | "serverBedrockPreviewLinux"
  | "serverBedrockLinux";

export function mapBdsOptions(opts: BdsOptions): BdsPlatformId {
  if (getPlatform() === "win") {
    if (opts.preview) {
      return "serverBedrockPreviewWindows";
    } else {
      return "serverBedrockWindows";
    }
  } else {
    if (opts.preview) {
      return "serverBedrockPreviewLinux";
    } else {
      return "serverBedrockLinux";
    }
  }
}

const bdsLatestVersionCache = new Map<BdsPlatformId, string>();

export function fetchBdsVersion(desiredPlatform: BdsPlatformId) {
  return async () => {
    try {
      if (bdsLatestVersionCache.has(desiredPlatform)) {
        return;
      }
      const { data } = await axios.get(
        `https://www.minecraft.net/en-us/download/server/bedrock`,
        {
          timeout: 2000,
          headers: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          },
        }
      );

      const $ = cheerio.load(data);

      // Find the element with the matching 'data-platform' value and get the 'href' attribute
      const matchingElement = $(`[data-platform="${desiredPlatform}"]`);
      const href = matchingElement.attr("href");
      if (!href) {
        throw new Error("No Href");
      }

      console.log(`Href for platform ${desiredPlatform}:`, href);

      // Extract the file name from the href
      const fileName = path.basename(href);
      const filePath = path.join("dl", fileName);
      bdsLatestVersionCache.set(desiredPlatform, filePath);

      // Check if the file already exists
      if (fs.existsSync(filePath)) {
        console.log(`File already exists: ${filePath}`);
        return;
      }

      // Create the 'bds' directory if it doesn't exist
      if (!fs.existsSync(path.join("dl"))) {
        fs.mkdirSync(path.join("dl"));
      }

      // Download the file
      const writer = fs.createWriteStream(filePath);
      const response = await axios({
        url: href,
        method: "GET",
        responseType: "stream",
      });

      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on("finish", async () => {
          console.log(`File downloaded: ${filePath}`);
          resolve(filePath);
        });
        writer.on("error", reject);
      });
    } catch (error) {
      console.error("Error fetching BDS version:", error);
      throw error;
    }
  };
}

export function extractBdsTask(options: {
  cleanBdsFolder: boolean;
  platformId: BdsPlatformId;
}) {
  return async () => {
    if (options.cleanBdsFolder) {
      FileSystem.ensureEmptyFolder("bds");
    }
    const zipPath = bdsLatestVersionCache.get(options.platformId);
    if (!zipPath) {
      throw new Error(
        "BDS Extraction Failed, was fetchBdsVersion called before this task?"
      );
    }
    const dir = await unzipper.Open.file(zipPath);
    console.info(`Extracting ${zipPath} to 'bds' folder.`);
    await dir.extract({ path: "bds" });
    FileSystem.changePosixModeBits(
      "bds/bedrock_server",
      PosixModeBits.AllExecute
    );
    await fsp.copyFile(bdsServerPropertiesDefaultPath, "bds/server.properties");
  };
}

export function initializeBdsFromWorldTemplateTask(
  options: {
    mcworldPath: string;
  } = { mcworldPath: testvilleTemplatePath }
) {
  return async () => {
    const dir = await unzipper.Open.file(options.mcworldPath);
    console.info(`Creating world from template.`);
    await dir.extract({ path: "bds/worlds/Testville" });
  };
}

export function buildAllowedPacksForBdsTask() {
  return async () => {
    await writeAllowedPacks("bds");
  };
}

async function writeAllowedPacks(bdsDirPath: string) {
  const bpManifestPaths = ["./dist/manifest/behavior_pack/manifest.json"];
  const rpManifestPaths = ["resource_pack/manifest.json"];
  const worldBps = [];
  const worldRps = [];
  for (const bpPath of bpManifestPaths) {
    const bpData = JSON.parse((await fsp.readFile(bpPath)).toString());
    for (const module of bpData.modules) {
      const permissions = { allowed_modules: [] };
      for (const dep of bpData.dependencies) {
        if (dep.module_name) {
          //@ts-ignore
          permissions.allowed_modules.push(dep.module_name);
        }
      }
      const configDir = `${bdsDirPath}/config/${module.uuid}/`;
      try {
        await fsp.mkdir(configDir, { recursive: true });
      } catch (error) {}
      await fsp.writeFile(
        configDir + "permissions.json",
        JSON.stringify(permissions)
      );
    }
    //@ts-ignore
    worldBps.push({
      pack_id: bpData.header.uuid,
      version: bpData.header.version,
    });
  }
  for (const rpPath of rpManifestPaths) {
    const rpData = JSON.parse((await fsp.readFile(rpPath)).toString());
    //@ts-ignore
    worldRps.push({
      pack_id: rpData.header.uuid,
      version: rpData.header.version,
    });
  }
  await Promise.all([
    fsp.writeFile(
      `${bdsDirPath}/worlds/Testville/world_behavior_packs.json`,
      JSON.stringify(worldBps)
    ),
    fsp.writeFile(
      `${bdsDirPath}/worlds/Testville/world_resource_packs.json`,
      JSON.stringify(worldRps)
    ),
  ]);
}
