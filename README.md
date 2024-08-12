# Minecraft Auto Reloader

Websocket server for automatically reloading Minecraft: Bedrock scripts.

Example usage:

```ts
import { AutoReloader } from "@bedrock-libraries/minecraft-auto-reloader";

const wss = new AutoReloader({
  wssPort: 6464;
});

// connect minecraft client to WSS

wss.reload()
```
