import { startServer } from "./app";

const { port } = await startServer();
console.log(`[game-server] escuchando en http://localhost:${port} (ws en el mismo puerto)`);
