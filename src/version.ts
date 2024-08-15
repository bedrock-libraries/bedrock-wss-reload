/* eslint-disable @typescript-eslint/naming-convention */
import { task } from "just-scripts";

import { writeFileSync } from "fs";
import { v4 } from "uuid";

type incrementType = "minor" | "patch";

export function setManifestVersion(pack: any, setVersion?: number[]) {
  pack.header.version = setVersion;
  for (const module of pack.modules) {
    module.version = setVersion;
  }
  for (const dep of pack.dependencies) {
    if (dep.uuid) {
      dep.version = setVersion;
    }
  }
  return pack;
}
