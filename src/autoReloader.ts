import { logger } from "just-scripts";
import { MinecraftServer } from "./websocket";

export interface AutoReloaderConfiguration {
  wssPort: number;
}

export interface ReloadOptions {
  all?: boolean;
}

export interface ScriptDebuggerOptions {
  port: number;
  host: string;
}

export const defaultReloadOptions: ReloadOptions = { all: false };
export const defaultScriptDebuggerOptions: ScriptDebuggerOptions = {
  port: 19144,
  host: "localhost",
};

export class AutoReloader {
  private server!: MinecraftServer;
  private output!: (message: any) => void;

  constructor(private configuration: AutoReloaderConfiguration) {
    this.init();
  }

  private init() {
    this.output = logger.info;
    this.start();
  }

  private start() {
    const port = this.configuration.wssPort;
    this.#startServer(port);
    this.output(`Websocket server opened on port ${port}.`);
  }

  private stop() {
    this.server.dispose();
    this.output(`Websocket server closed.`);
  }

  dispose() {
    this.stop();
  }

  #startServer(port: number) {
    this.server = new MinecraftServer(port);
  }

  async reload(options: ReloadOptions = defaultReloadOptions) {
    const command = options.all ? "reload all" : "reload";
    for (const client of this.server.clients) {
      const { status, message } = await this.server.sendCommand(
        client,
        command
      );
      if (status === 0) {
        this.output("[Auto Reloader] Reloading was successful.");
      } else {
        this.output(`[Auto Reloader] Reload failed. Error: ${message}`);
      }
    }
    this.output(`Reloaded ${this.server.clients.keys.length} clients.`);
  }
  async connectScriptDebugger(
    options: ScriptDebuggerOptions = defaultScriptDebuggerOptions
  ) {
    const command = `script debugger connect ${options.host} ${options.port}`;
    for (const client of this.server.clients) {
      const { status, message } = await this.server.sendCommand(
        client,
        command
      );
      if (status === 0) {
        this.output("[Auto Reloader] Reloading was successful.");
      } else {
        this.output(`[Auto Reloader] Reload failed. Error: ${message}`);
      }
    }
    this.output(
      `Debugger Connect command sent to ${this.server.clients.keys.length} clients.`
    );
  }
}
