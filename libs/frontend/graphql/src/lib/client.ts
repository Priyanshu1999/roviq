import { ApolloClient, InMemoryCache } from '@apollo/client/core';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { ApolloLink } from '@apollo/client/link';
import { SetContextLink } from '@apollo/client/link/context';
import { ErrorLink } from '@apollo/client/link/error';
import { HttpLink } from '@apollo/client/link/http';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition, relayStylePagination } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

export interface ApolloClientConfig {
  httpUrl: string;
  wsUrl: string;
  getAccessToken: () => string | null;
  onAuthError: () => void;
  onNetworkError: (message: string) => void;
  /** Called when a GraphQL error with code IMPERSONATION_ENDED is received. */
  onImpersonationEnded?: () => void;
  /** Base API URL for ws-ticket endpoint. If provided, uses ticket-based WS auth. */
  apiUrl?: string;
  /** Called to refresh the access token. If provided, auth errors retry once after refresh. */
  onTokenRefresh?: () => Promise<string | null>;
}

export function createApolloClient(config: ApolloClientConfig) {
  const httpLink = new HttpLink({ uri: config.httpUrl });

  const authLink = new SetContextLink((prevContext) => {
    const token = config.getAccessToken();
    return {
      headers: {
        ...prevContext.headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const errorLink = new ErrorLink(({ error, forward, operation }) => {
    if (CombinedGraphQLErrors.is(error)) {
      for (const err of error.errors) {
        if (err.extensions?.code === 'IMPERSONATION_ENDED') {
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('roviq-impersonation-token');
          }
          config.onImpersonationEnded?.();
          return;
        }
        if (err.extensions?.code === 'UNAUTHENTICATED' || err.message === 'Unauthorized') {
          if (config.onTokenRefresh) {
            // Refresh the token and retry the operation once (ErrorLink auto-prevents infinite loops)
            config.onTokenRefresh().then((newToken) => {
              if (newToken) {
                operation.setContext({
                  headers: {
                    ...(operation.getContext().headers as Record<string, string>),
                    authorization: `Bearer ${newToken}`,
                  },
                });
              } else {
                config.onAuthError();
              }
            });
            return forward(operation);
          }
          config.onAuthError();
          return;
        }
      }
    } else {
      config.onNetworkError(error instanceof Error ? error.message : String(error));
    }
    return undefined;
  });

  const wsLink = new GraphQLWsLink(
    createClient({
      url: config.wsUrl,
      connectionParams: async () => {
        if (config.apiUrl) {
          const accessToken = config.getAccessToken();
          if (accessToken) {
            // The api-gateway uses a global prefix of `api` (set in main.ts),
            // so the controller `@Controller('auth')` resolves to
            // `/api/auth/ws-ticket`. Callers pass the bare origin
            // (e.g. `http://localhost:3000`) as `apiUrl`, so the prefix
            // must be added here. Stripping a possibly-already-suffixed
            // `/api` keeps this safe whether or not the caller pre-prefixed.
            const apiBase = config.apiUrl.replace(/\/api$/, '');
            const response = await fetch(`${apiBase}/api/auth/ws-ticket`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) {
              const { ticket } = await response.json();
              return { ticket };
            }
          }
        }
        return {};
      },
      shouldRetry: () => true,
      retryAttempts: Infinity,
      retryWait: async (retryCount) => {
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      },
    }),
  );

  const httpChain = errorLink.concat(authLink).concat(httpLink);

  const link = ApolloLink.split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    wsLink,
    httpChain,
  );

  const cache = new InMemoryCache({
    typePolicies: {
      Institute: { keyFields: ['id'] },
      User: { keyFields: ['id'] },
      Student: { keyFields: ['id'] },
      Section: { keyFields: ['id'] },
      Role: { keyFields: ['id'] },
      AuditLog: { keyFields: ['id'] },
      SubscriptionPlanModel: { keyFields: ['id'] },
      SubscriptionModel: { keyFields: ['id'] },
      InvoiceModel: { keyFields: ['id'] },
      Query: {
        fields: {
          auditLogs: relayStylePagination(['filter']),
          subscriptions: relayStylePagination(['filter']),
          invoices: relayStylePagination(['instituteId', 'filter']),
        },
      },
    },
  });

  return new ApolloClient({
    link,
    cache,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  });
}
