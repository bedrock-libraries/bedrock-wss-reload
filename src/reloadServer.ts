import { fastify } from "fastify";
import { AutoReloader, AutoReloaderConfiguration } from "./autoReloader";

export interface ReloadServerOptions {
  httpPort: number;
  wssPort: number;
}

export class ReloadServer {
  private static instance: Promise<ReloadServer>;
  private server = fastify({});
  private wss: AutoReloader;

  private constructor(config: ReloadServerOptions) {
    this.wss = new AutoReloader({ wssPort: config.wssPort });

    this.server.get("/reload", async (_request, _reply) => {
      await this.wss.reload();
      return { result: "OK" };
    });

    this.server.get("/reload_all", async (_request, _reply) => {
      await this.wss.reload({ all: true });
      return { result: "OK" };
    });

    this.server.get("/debugger_connect", async (_request, _reply) => {
      setTimeout(() => {
        this.wss.connectScriptDebugger();
      }, 3000);
      return { result: "OK" };
    });

    this.initializeServer(config);
  }

  private async initializeServer(config: ReloadServerOptions) {
    try {
      await this.server.listen({ port: config.httpPort });
    } catch (err) {
      this.server.log.error(err);
      process.exit(1);
    }
  }

  public static async getInstance(
    config: ReloadServerOptions
  ): Promise<ReloadServer> {
    if (!ReloadServer.instance) {
      ReloadServer.instance = new Promise(async (resolve) => {
        const instance = new ReloadServer(config);
        resolve(instance);
      });
    }
    return ReloadServer.instance;
  }
}
