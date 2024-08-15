import axios from "axios";
import { ReloadServer, ReloadServerOptions } from "./reloadServer";
import { logger } from "just-scripts";

async function tryRequest(url: string) {
  try {
    await axios.get(url);
  } catch (error) {
    logger.info(`Skipping reload. Server not running.`);
  }
}

export function reloadAllRequestTask(config: ReloadServerOptions) {
  return async () => {
    await tryRequest(`http://localhost:${config.httpPort}/reload_all`);
  };
}

export function reloadRequestTask(config: ReloadServerOptions) {
  return async () => {
    await tryRequest(`http://localhost:${config.httpPort}/reload`);
  };
}

export function debuggerConnectRequestTask(config: ReloadServerOptions) {
  return async () => {
    await tryRequest(`http://localhost:${config.httpPort}/debugger_connect`);
  };
}

export function startReloadServerTask(config: ReloadServerOptions) {
  return async () => {
    await ReloadServer.getInstance(config);
  };
}
