'use client';

import { ApolloProvider as BaseApolloProvider } from '@apollo/client/react';
import * as React from 'react';
import { toast } from 'sonner';
import { createApolloClient } from './client';

interface GraphQLProviderProps {
  httpUrl: string;
  wsUrl: string;
  getAccessToken: () => string | null;
  onAuthError: () => void;
  children: React.ReactNode;
}

export function GraphQLProvider({
  httpUrl,
  wsUrl,
  getAccessToken,
  onAuthError,
  children,
}: GraphQLProviderProps) {
  const clientRef = React.useRef<ReturnType<typeof createApolloClient> | null>(null);

  if (!clientRef.current) {
    clientRef.current = createApolloClient({
      httpUrl,
      wsUrl,
      getAccessToken,
      onAuthError,
      onNetworkError: (message) => {
        toast.error('Network Error', { description: message });
      },
    });
  }

  return <BaseApolloProvider client={clientRef.current}>{children}</BaseApolloProvider>;
}
