/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');

// Firebase config is passed as URL query params when registering the service worker
// e.g. /firebase-messaging-sw.js?apiKey=...&projectId=...
const urlParams = new URLSearchParams(location.search);

const apiKey = urlParams.get('apiKey');
const projectId = urlParams.get('projectId');
const messagingSenderId = urlParams.get('messagingSenderId');
const appId = urlParams.get('appId');

if (apiKey && projectId && messagingSenderId && appId) {
  firebase.initializeApp({ apiKey, projectId, messagingSenderId, appId });

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || 'Notification';
    const options = {
      body: payload.notification?.body || '',
      icon: '/icon-192x192.png',
    };
    self.registration.showNotification(title, options);
  });
}
