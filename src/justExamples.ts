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
