/* eslint-disable no-undef */
/* global firebase */

// ===== IMPORT FIREBASE (LOCAL FILES ONLY) =====
importScripts("/firebase/firebase-app-compat.js");
importScripts("/firebase/firebase-messaging-compat.js");

// ===== INIT FIREBASE =====
try {
  if (!firebase.apps?.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyBptjK7xdme_BGc7I7XI1-oFb-JNEtfH8c",
      authDomain: "saiyonix-54dc7.firebaseapp.com",
      projectId: "saiyonix-54dc7",
      storageBucket: "saiyonix-54dc7.firebasestorage.app",
      messagingSenderId: "85967932075",
      appId: "1:85967932075:web:0f1ae1e632099cb8ed85ee",
      measurementId: "G-EQCC19G1JT",
    });
  }
} catch (err) {
  console.error("[FCM SW] firebase.initializeApp failed", err);
}

let messaging = null;
try {
  messaging = firebase.messaging();
} catch (err) {
  console.error("[FCM SW] firebase.messaging() init failed", err);
}

// ===== INSTALL =====
self.addEventListener("install", () => {
  console.log("[FCM SW] install");
  self.skipWaiting();
});

// ===== ACTIVATE =====
self.addEventListener("activate", (event) => {
  console.log("[FCM SW] activate");
  event.waitUntil(self.clients.claim());
});

// ===== BACKGROUND MESSAGE =====
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log("[FCM SW] background message:", payload);

    const title = payload.notification?.title || "Notification";
    const body = payload.notification?.body || "";

    const url = payload.fcmOptions?.link || payload.data?.link || payload.data?.url || "/";

    self.registration.showNotification(title, {
      body,
      data: { url },
    });
  });
}

// ===== CLICK HANDLER =====
self.addEventListener("notificationclick", (event) => {
  event.notification?.close();

  const targetUrl = event.notification?.data?.url || "/";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        try {
          if ("focus" in client) {
            await client.focus();
          }
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return;
        } catch {
          // try next client
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
