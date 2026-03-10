import type { AuthUser, LoginInput, LoginResult, MembershipInfo } from './types';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

async function graphqlFetch<T>(
  url: string,
  query: string,
  variables?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();

  if (json.errors?.length) {
    throw new Error(json.errors[0].message ?? 'GraphQL error');
  }

  return json.data;
}

export function createAuthMutations(graphqlUrl: string) {
  return {
    async login(input: LoginInput): Promise<LoginResult> {
      const data = await graphqlFetch<{
        login: {
          accessToken?: string;
          refreshToken?: string;
          user?: AuthUser;
          platformToken?: string;
          memberships?: MembershipInfo[];
        };
      }>(
        graphqlUrl,
        `mutation Login($username: String!, $password: String!) {
          login(username: $username, password: $password) {
            accessToken
            refreshToken
            user { id username email tenantId roleId abilityRules }
            platformToken
            memberships { tenantId roleId orgName orgSlug orgLogoUrl roleName }
          }
        }`,
        { username: input.username, password: input.password },
      );
      return data.login;
    },

    async selectOrganization(tenantId: string, platformToken: string): Promise<AuthResponse> {
      const data = await graphqlFetch<{ selectOrganization: AuthResponse }>(
        graphqlUrl,
        `mutation SelectOrganization($tenantId: String!) {
          selectOrganization(tenantId: $tenantId) {
            accessToken
            refreshToken
            user { id username email tenantId roleId abilityRules }
          }
        }`,
        { tenantId },
        { Authorization: `Bearer ${platformToken}` },
      );
      return data.selectOrganization;
    },

    async refresh(refreshToken: string): Promise<AuthResponse> {
      const data = await graphqlFetch<{ refreshToken: AuthResponse }>(
        graphqlUrl,
        `mutation RefreshToken($token: String!) {
          refreshToken(token: $token) {
            accessToken
            refreshToken
            user { id username email tenantId roleId abilityRules }
          }
        }`,
        { token: refreshToken },
      );
      return data.refreshToken;
    },

    async logout(): Promise<void> {
      try {
        await graphqlFetch(graphqlUrl, 'mutation Logout { logout }');
      } catch {
        // Ignore — tokens are cleared client-side regardless
      }
    },
  };
}
