'use client';

import { gql, useMutation } from '@roviq/graphql';
import { getFcmToken } from '@roviq/ui/lib/firebase';
import { useEffect, useRef } from 'react';

const REGISTER_DEVICE_TOKEN = gql`
  mutation RegisterDeviceToken($token: String!) {
    registerDeviceToken(token: $token)
  }
`;

export function usePushNotifications() {
  const [registerToken] = useMutation(REGISTER_DEVICE_TOKEN);
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;

    getFcmToken(vapidKey)
      .then((token) => {
        if (token) {
          registered.current = true;
          registerToken({ variables: { token } });
        }
      })
      .catch(() => {
        // User denied permission or browser doesn't support push notifications — skip silently
      });
  }, [registerToken]);
}
