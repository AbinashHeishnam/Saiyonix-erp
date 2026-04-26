import { io, Socket } from "socket.io-client";

import { API_ORIGIN, getAuthTokens } from "@saiyonix/api";

const SOCKET_URL = /localhost|127.0.0.1/.test(API_ORIGIN) ? "https://api.kangleicareersolution.co.in" : API_ORIGIN;
const SOCKET_PATH = "/socket.io" as const;
type SocketPath = typeof SOCKET_PATH;
type TransportMode = "websocket_only" | "polling_fallback";

let socket: Socket | null = null;
let connectPromise: Promise<Socket> | null = null;
let transportMode: TransportMode = "websocket_only";
let hasEverConnected = false;

function createSocket(path: SocketPath, mode: TransportMode) {
  const bootstrapToken = getAuthTokens().accessToken;
  console.log("[SOCKET INIT]", { url: SOCKET_URL, path, mode });
  const instance = io(SOCKET_URL, {
    path,
    transports: mode === "websocket_only" ? ["websocket"] : ["polling", "websocket"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    autoConnect: false,
    auth: { token: bootstrapToken },
  });

  instance.io.on("reconnect_attempt", () => {
    instance.auth = { token: getAuthTokens().accessToken };
  });

  instance.on("connect", () => {
    hasEverConnected = true;
    const activeTransport = (instance.io.engine as any)?.transport?.name;
    console.log("[SOCKET CONNECT STATE]", { connected: instance.connected, id: instance.id, path, mode, activeTransport });
  });

  instance.on("connect_error", (err) => {
    const anyErr = err as any;
    console.log("[SOCKET ERROR]", anyErr?.message ?? "connect_error", {
      path,
      description: anyErr?.description,
      context: anyErr?.context,
      type: anyErr?.type,
      code: anyErr?.code,
      err,
    });
  });

  instance.on("disconnect", (reason) => {
    console.log("[SOCKET DISCONNECTED]", reason);
    console.log("[SOCKET CONNECT STATE]", { connected: instance.connected, id: instance.id, path });
  });

  return instance;
}

function resetSocket(nextMode: TransportMode) {
  if (socket) socket.disconnect();
  transportMode = nextMode;
  hasEverConnected = false;
  connectPromise = null;
  socket = createSocket(SOCKET_PATH, transportMode);
  return socket;
}

export function getSocket() {
  if (!socket) {
    socket = createSocket(SOCKET_PATH, transportMode);
  }
  return socket;
}

function isLikelyWebsocketUpgradeBlocked(err: unknown) {
  const msg = (err as any)?.description?.message ?? (err as any)?.message;
  return typeof msg === "string" && msg.includes("Expected HTTP 101 response");
}

export async function ensureSocketConnected() {
  const accessToken = getAuthTokens().accessToken;
  if (!accessToken) {
    throw new Error("Missing access token for socket authentication.");
  }

  const attemptConnect = async (instance: Socket) => {
    if (instance.connected) return instance;
    if (connectPromise) return await connectPromise;

    instance.auth = { token: accessToken };

    console.log("[SOCKET CONNECT STATE]", {
      connected: instance.connected,
      id: instance.id,
      path: SOCKET_PATH,
      mode: transportMode,
    });

    connectPromise = new Promise<Socket>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve(instance);
      };
      const onError = (err: any) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        instance.off("connect", onConnect);
        instance.off("connect_error", onError);
        connectPromise = null;
      };

      instance.once("connect", onConnect);
      instance.once("connect_error", onError);
      instance.connect();
    });

    return await connectPromise;
  };

  try {
    return await attemptConnect(getSocket());
  } catch (err) {
    if (!hasEverConnected && transportMode === "websocket_only" && isLikelyWebsocketUpgradeBlocked(err)) {
      console.log("[SOCKET TRANSPORT FALLBACK]", { from: "websocket_only", to: "polling_fallback" });
      return await attemptConnect(resetSocket("polling_fallback"));
    }
    throw err;
  }
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  connectPromise = null;
  transportMode = "websocket_only";
  hasEverConnected = false;
}
