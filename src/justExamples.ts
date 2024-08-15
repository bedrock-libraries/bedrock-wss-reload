import { task, series, parallel, argv } from "just-scripts";
import {
  buildAllowedPacksForBdsTask,
  extractBdsTask,
  fetchBdsVersion,
  initializeBdsFromWorldTemplateTask,
  mapBdsOptions,
} from "./bds";
import { runAllGameTestsTask } from "./gameTest";
import { generateBpManifestTask } from "./manifest";

export function stableCiTasks() {
  const platformId = mapBdsOptions({ preview: false });
  task("assert-latest-bds", fetchBdsVersion(platformId));
  task(
    "extract-bds",
    extractBdsTask({ platformId: platformId, cleanBdsFolder: true })
  );
  task("init-bds-world", initializeBdsFromWorldTemplateTask());
  task("bds-allowed-packs", buildAllowedPacksForBdsTask());

  task(
    "install-latest-bds",
    series("assert-latest-bds", "extract-bds", "init-bds-world")
  );

  task(
    "generate-bp-manifest",
    generateBpManifestTask({ filterOutGameTestModule: argv().prd })
  );

  task("run-tests", runAllGameTestsTask());
}
