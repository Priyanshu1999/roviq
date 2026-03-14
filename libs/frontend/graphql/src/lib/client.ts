import { ApolloClient, from, HttpLink, InMemoryCache, split } from '@apollo/client/core';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition, relayStylePagination } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

export interface ApolloClientConfig {
  httpUrl: string;
  wsUrl: string;
  getAccessToken: () => string | null;
  onAuthError: () => void;
  onNetworkError: (message: string) => void;
}

export function createApolloClient(config: ApolloClientConfig) {
  const httpLink = new HttpLink({ uri: config.httpUrl });

  const authLink = setContext((_, { headers }) => {
    const token = config.getAccessToken();
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  const errorLink = onError(({ error }) => {
    if (CombinedGraphQLErrors.is(error)) {
      for (const err of error.errors) {
        if (err.extensions?.code === 'UNAUTHENTICATED' || err.message === 'Unauthorized') {
          config.onAuthError();
          return;
        }
      }
    } else {
      config.onNetworkError(error instanceof Error ? error.message : String(error));
    }
  });

  const wsLink = new GraphQLWsLink(
    createClient({
      url: config.wsUrl,
      connectionParams: () => {
        const token = config.getAccessToken();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      shouldRetry: () => true,
      retryAttempts: Infinity,
      retryWait: async (retryCount) => {
        const delay = Math.min(1000 * 2 ** retryCount, 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      },
    }),
  );

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
    },
    wsLink,
    from([errorLink, authLink, httpLink]),
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
          invoices: relayStylePagination(['organizationId', 'filter']),
        },
      },
    },
  });

  return new ApolloClient({
    link: splitLink,
    cache,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  });
}
