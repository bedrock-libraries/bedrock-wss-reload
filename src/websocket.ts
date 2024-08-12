import { WebSocketServer, WebSocket } from "ws";
import { v4 as genUUID } from "uuid";

interface Data<T, U> {
  body: T;
  header: U;
}

type RequestPurpose = "commandRequest";

interface RequestBody {
  commandLine: string;
}

type ResponsePurpose = "commandResponse";

interface ResponseBody {
  statusCode: number;
  statusMessage: string;
}

interface ResponseHeader {
  requestId: string;
  messagePurpose: ResponsePurpose;
  version: number;
}

type ResponseData = Data<ResponseBody, ResponseHeader>;

interface CommandResponse {
  status: number;
  message: string;
}

class MinecraftServer {
  #server!: WebSocketServer;
  #responseHandlers = new Map<string, (response: CommandResponse) => void>();

  constructor(port: number) {
    this.#server = new WebSocketServer({ port: port });

    if (this.#server.address() === null) {
      throw Error(`Port ${port} is already in use.`);
    }

    this.#server.on("connection", (client) => {
      client.on("message", (data) => {
        const res: ResponseData = JSON.parse(data.toString());

        const handler = this.#responseHandlers.get(res.header.requestId);
        if (handler) {
          handler({
            message: res.body.statusMessage,
            status: res.body.statusCode,
          });
          this.#responseHandlers.delete(res.header.requestId);
        }
      });
    });
  }

  send(
    client: WebSocket,
    purpose: RequestPurpose,
    body: RequestBody,
    uuid: string = genUUID()
  ) {
    client.send(
      JSON.stringify({
        body,
        header: {
          requestId: uuid,
          messagePurpose: purpose,
          version: 1,
        },
      })
    );
  }

  sendCommand(client: WebSocket, command: string): Promise<CommandResponse> {
    const uuid = genUUID();
    this.send(client, "commandRequest", { commandLine: command }, uuid);

    return new Promise((resolve) => {
      this.#responseHandlers.set(uuid, resolve);
    });
  }

  get clients() {
    return this.#server.clients;
  }

  dispose() {
    this.#server.close();
  }
}

export { MinecraftServer };
