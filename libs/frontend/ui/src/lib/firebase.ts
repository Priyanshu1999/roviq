import { getApps, initializeApp } from 'firebase/app';
import {
  getMessaging,
  getToken,
  isSupported,
  type MessagePayload,
  onMessage,
} from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp(firebaseConfig);
}

/**
 * Registers the Firebase messaging service worker, passing Firebase config as
 * URL query params so the SW can initialise without access to process.env.
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const { apiKey, projectId, messagingSenderId, appId } = firebaseConfig;
  const params = new URLSearchParams({
    apiKey: apiKey ?? '',
    projectId: projectId ?? '',
    messagingSenderId: messagingSenderId ?? '',
    appId: appId ?? '',
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
}

export async function getFcmToken(vapidKey: string): Promise<string | null> {
  const supported = await isSupported();
  if (!supported) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  const serviceWorkerRegistration = await registerServiceWorker();
  return getToken(messaging, { vapidKey, serviceWorkerRegistration });
}

export function onForegroundMessage(callback: (payload: MessagePayload) => void) {
  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  return onMessage(messaging, callback);
}
