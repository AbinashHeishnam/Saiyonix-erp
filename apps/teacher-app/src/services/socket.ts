import { io, Socket } from "socket.io-client";

import { API_ORIGIN, getAuthTokens } from "@saiyonix/api";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_ORIGIN, {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      autoConnect: false,
      auth: { token: getAuthTokens().accessToken },
    });
  }
  return socket;
}

export async function ensureSocketConnected() {
  const instance = getSocket();
  if (instance.connected) return instance;

  instance.auth = { token: getAuthTokens().accessToken };

  await new Promise<void>((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve();
    };
    const onError = (err: any) => {
      cleanup();
      reject(err);
    };
    const cleanup = () => {
      instance.off("connect", onConnect);
      instance.off("connect_error", onError);
    };

    instance.once("connect", onConnect);
    instance.once("connect_error", onError);
    instance.connect();
  });

  return instance;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}

