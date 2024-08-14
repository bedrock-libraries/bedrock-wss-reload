import { task, series, parallel } from "just-scripts";
import {
  buildAllowedPacksForBdsTask,
  extractBdsTask,
  fetchBdsVersion,
  initializeBdsFromWorldTemplateTask,
  mapBdsOptions,
} from "./bds";
import { runAllGameTestsTask } from "./gameTest";

export function stableCiTasks() {
  const platformId = mapBdsOptions({ preview: false });
  task("assert-latest-bds", fetchBdsVersion(platformId));
  task(
    "extract-bds",
    extractBdsTask({ platformId: platformId, cleanBdsFolder: true })
  );
  task("init-bds-world", initializeBdsFromWorldTemplateTask());
  task("configure-bds", buildAllowedPacksForBdsTask());

  task(
    "install-latest-bds",
    series(
      "assert-latest-bds",
      "extract-bds",
      "init-bds-world",
      "configure-bds"
    )
  );

  task("run-tests", runAllGameTestsTask());
  task("ci-test", series("install-latest-bds", "run-tests"));
}
