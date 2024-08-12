import { getConfiguration } from "./utils";
import { MinecraftServer } from "./websocket";

export class AutoReloader {
  server!: MinecraftServer;
  output!: (message: any) => void;

  constructor() {
    this.init();
  }

  init() {
    this.output = console.log;
  }

  start() {
    const port = getConfiguration("port")!;
    this.#startServer(port);
    this.output(`Websocket server opened on port ${port}.`);
  }

  stop() {
    this.server.dispose();
    this.output(`Websocket server closed.`);
  }

  dispose() {
    this.server?.dispose();
  }

  #startServer(port: number) {
    this.server = new MinecraftServer(port);
  }

  async reload() {
    for (const client of this.server.clients) {
      const { status, message } = await this.server.sendCommand(
        client,
        "reload"
      );
      if (status === 0) {
        this.output("[Auto Reloader] Reloading was successful.");
      } else {
        this.output(`[Auto Reloader] Reload failed.\nError: ${message}`);
      }
    }
    this.output(`Reloaded`);
  }
}
