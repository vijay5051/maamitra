/* eslint-disable */
// sw-version: 2 — bumped 2026-04-20 to force iOS PWA to drop the
// 1-year-cached old SW after the cache-control fix deployed.
/**
 * MaaMitra — Firebase Cloud Messaging service worker
 *
 * Served at /firebase-messaging-sw.js from Firebase Hosting. The FCM SDK
 * picks it up by convention (its path is not configurable). Handles
 * background / tab-closed pushes: when our dispatcher sends a FCM push to
 * a user whose tab is not active, this worker receives the payload and
 * renders the OS-level notification.
 *
 * Foreground pushes (tab is open) are handled in the web app itself by
 * services/push.ts → onMessage().
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Hard-coded public config — this file is served to browsers, there is
// nothing secret here. The apiKey in particular is a browser key and is
// rate-limited + origin-restricted by Firebase, not a server secret.
firebase.initializeApp({
  apiKey: 'AIzaSyDIpjUY-xIu5BIvKfuWylHlBJcQHkhbhW4',
  authDomain: 'maa-mitra-7kird8.firebaseapp.com',
  projectId: 'maa-mitra-7kird8',
  storageBucket: 'maa-mitra-7kird8.firebasestorage.app',
  messagingSenderId: '709650827583',
  appId: '1:709650827583:web:48d2e2739a37413a2b2b8a',
});

const messaging = firebase.messaging();

// Background payloads arrive here. We render an OS notification and —
// critically — attach `data.url` so click routes the user straight to
// the source post / thread / notifications page in the app.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'MaaMitra';
  const body = payload.notification?.body || payload.data?.body || '';
  const url = payload.data?.url || '/';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url },
    // Use a tag so a burst of related notifications (e.g. several
    // reactions on one post) collapses to the latest one instead of
    // stacking into an alert wall.
    tag: payload.data?.tag || 'maamitra',
    renotify: false,
  });
});

// Click → focus an existing tab if we have one, otherwise open a new tab
// at the target URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || '/';
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientsList) {
        try {
          if ('focus' in client) {
            await client.focus();
            if ('navigate' in client) client.navigate(target);
            return;
          }
        } catch (_) {
          /* ignore — try next */
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(target);
      }
    })(),
  );
});
