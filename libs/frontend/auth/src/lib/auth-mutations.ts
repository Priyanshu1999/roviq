import type {
  AuthUser,
  LoginInput,
  LoginResult,
  MembershipInfo,
  PasskeyAuthOptions,
} from './types';

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
            user { id username email scope tenantId resellerId membershipId roleId abilityRules }
            platformToken
            memberships { tenantId roleId instituteName instituteSlug instituteLogoUrl roleName }
          }
        }`,
        { username: input.username, password: input.password },
      );
      return data.login;
    },

    async selectInstitute(tenantId: string, platformToken: string): Promise<AuthResponse> {
      const data = await graphqlFetch<{ selectInstitute: AuthResponse }>(
        graphqlUrl,
        `mutation SelectInstitute($tenantId: String!) {
          selectInstitute(tenantId: $tenantId) {
            accessToken
            refreshToken
            user { id username email scope tenantId resellerId membershipId roleId abilityRules }
          }
        }`,
        { tenantId },
        { Authorization: `Bearer ${platformToken}` },
      );
      return data.selectInstitute;
    },

    async refresh(refreshToken: string): Promise<AuthResponse> {
      const data = await graphqlFetch<{ refreshToken: AuthResponse }>(
        graphqlUrl,
        `mutation RefreshToken($token: String!) {
          refreshToken(token: $token) {
            accessToken
            refreshToken
            user { id username email scope tenantId resellerId membershipId roleId abilityRules }
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

    async generatePasskeyAuthOptions(): Promise<PasskeyAuthOptions> {
      const data = await graphqlFetch<{ generatePasskeyAuthOptions: PasskeyAuthOptions }>(
        graphqlUrl,
        `mutation GeneratePasskeyAuthOptions {
          generatePasskeyAuthOptions {
            optionsJSON
            challengeId
          }
        }`,
      );
      return data.generatePasskeyAuthOptions;
    },

    async verifyPasskeyAuth(
      challengeId: string,
      credential: Record<string, unknown>,
    ): Promise<LoginResult> {
      const data = await graphqlFetch<{ verifyPasskeyAuth: LoginResult }>(
        graphqlUrl,
        `mutation VerifyPasskeyAuth($input: VerifyPasskeyAuthInput!) {
          verifyPasskeyAuth(input: $input) {
            accessToken
            refreshToken
            user { id username email scope tenantId resellerId membershipId roleId abilityRules }
            platformToken
            memberships { tenantId roleId instituteName instituteSlug instituteLogoUrl roleName }
          }
        }`,
        { input: { challengeId, credential } },
      );
      return data.verifyPasskeyAuth;
    },

    async generatePasskeyRegistrationOptions(
      password: string,
      accessToken: string,
    ): Promise<Record<string, unknown>> {
      const data = await graphqlFetch<{
        generatePasskeyRegistrationOptions: Record<string, unknown>;
      }>(
        graphqlUrl,
        `mutation GeneratePasskeyRegistrationOptions($input: GeneratePasskeyRegistrationInput!) {
          generatePasskeyRegistrationOptions(input: $input)
        }`,
        { input: { password } },
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.generatePasskeyRegistrationOptions;
    },

    async verifyPasskeyRegistration(
      credential: Record<string, unknown>,
      name: string | undefined,
      accessToken: string,
    ): Promise<{
      id: string;
      name: string;
      deviceType: string;
      backedUp: boolean;
      registeredAt: string;
    }> {
      const data = await graphqlFetch<{
        verifyPasskeyRegistration: {
          id: string;
          name: string;
          deviceType: string;
          backedUp: boolean;
          registeredAt: string;
        };
      }>(
        graphqlUrl,
        `mutation VerifyPasskeyRegistration($input: VerifyPasskeyRegistrationInput!) {
          verifyPasskeyRegistration(input: $input) {
            id
            name
            deviceType
            backedUp
            registeredAt
          }
        }`,
        { input: { credential, name } },
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.verifyPasskeyRegistration;
    },

    async myPasskeys(accessToken: string): Promise<
      {
        id: string;
        name: string;
        deviceType: string;
        backedUp: boolean;
        registeredAt: string;
        lastUsedAt?: string;
      }[]
    > {
      const data = await graphqlFetch<{
        myPasskeys: {
          id: string;
          name: string;
          deviceType: string;
          backedUp: boolean;
          registeredAt: string;
          lastUsedAt?: string;
        }[];
      }>(
        graphqlUrl,
        `query MyPasskeys {
          myPasskeys {
            id
            name
            deviceType
            backedUp
            registeredAt
            lastUsedAt
          }
        }`,
        undefined,
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.myPasskeys;
    },

    async removePasskey(passkeyId: string, accessToken: string): Promise<boolean> {
      const data = await graphqlFetch<{ removePasskey: boolean }>(
        graphqlUrl,
        `mutation RemovePasskey($passkeyId: String!) {
          removePasskey(passkeyId: $passkeyId)
        }`,
        { passkeyId },
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.removePasskey;
    },
  };
}
