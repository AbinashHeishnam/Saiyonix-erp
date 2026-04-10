import { io, Socket } from "socket.io-client";

import { API_ORIGIN } from "./api/client";
let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_ORIGIN, {
      autoConnect: false,
      transports: ["websocket"],
      withCredentials: true,
    });
  }

  return socket;
}

export function ensureSocketConnected() {
  const instance = getSocket();
  if (!instance.connected) {
    instance.connect();
  }
  return instance;
}
