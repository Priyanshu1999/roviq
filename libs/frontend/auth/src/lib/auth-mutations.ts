import type { AuthUser, LoginInput, LoginResult, PasskeyAuthOptions, SessionInfo } from './types';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const USER_FIELDS = 'id username email scope tenantId resellerId membershipId roleId abilityRules';

// AuthPayload fields — used by adminLogin, resellerLogin
const AUTH_PAYLOAD_FIELDS = `
  accessToken
  refreshToken
  user { ${USER_FIELDS} }
`;

// InstituteLoginResult fields — used by instituteLogin (superset of AuthPayload)
const INSTITUTE_LOGIN_FIELDS = `
  accessToken
  refreshToken
  user { ${USER_FIELDS} }
  requiresInstituteSelection
  userId
  selectionToken
  memberships { membershipId tenantId roleId instituteName instituteSlug instituteLogoUrl roleName }
`;

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
  function createScopedLogin(mutationName: string, fields: string) {
    const query = `mutation ${mutationName}($username: String!, $password: String!) {
      ${mutationName}(username: $username, password: $password) { ${fields} }
    }`;

    return async (input: LoginInput): Promise<LoginResult> => {
      const data = await graphqlFetch<Record<string, LoginResult>>(graphqlUrl, query, {
        username: input.username,
        password: input.password,
      });
      return data[mutationName];
    };
  }

  const adminLogin = createScopedLogin('adminLogin', AUTH_PAYLOAD_FIELDS);
  const resellerLogin = createScopedLogin('resellerLogin', AUTH_PAYLOAD_FIELDS);
  const instituteLogin = createScopedLogin('instituteLogin', INSTITUTE_LOGIN_FIELDS);

  return {
    adminLogin,
    resellerLogin,
    instituteLogin,

    async selectInstitute(selectionToken: string, membershipId: string): Promise<AuthResponse> {
      const data = await graphqlFetch<{ selectInstitute: AuthResponse }>(
        graphqlUrl,
        `mutation SelectInstitute($selectionToken: String!, $membershipId: String!) {
          selectInstitute(selectionToken: $selectionToken, membershipId: $membershipId) {
            accessToken
            refreshToken
            user { ${USER_FIELDS} }
          }
        }`,
        { selectionToken, membershipId },
      );
      return data.selectInstitute;
    },

    async switchInstitute(
      membershipId: string,
      accessToken: string,
      currentRefreshToken: string,
    ): Promise<AuthResponse> {
      const data = await graphqlFetch<{ switchInstitute: AuthResponse }>(
        graphqlUrl,
        `mutation SwitchInstitute($membershipId: String!, $currentRefreshToken: String!) {
          switchInstitute(membershipId: $membershipId, currentRefreshToken: $currentRefreshToken) {
            accessToken
            refreshToken
            user { ${USER_FIELDS} }
          }
        }`,
        { membershipId, currentRefreshToken },
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.switchInstitute;
    },

    async refresh(refreshToken: string): Promise<AuthResponse> {
      const data = await graphqlFetch<{ refreshToken: AuthResponse }>(
        graphqlUrl,
        `mutation RefreshToken($token: String!) {
          refreshToken(token: $token) {
            accessToken
            refreshToken
            user { ${USER_FIELDS} }
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

    // Session management
    async mySessions(accessToken: string): Promise<SessionInfo[]> {
      const data = await graphqlFetch<{ mySessions: SessionInfo[] }>(
        graphqlUrl,
        `query MySessions {
          mySessions {
            id
            ipAddress
            userAgent
            lastUsedAt
            createdAt
            isCurrent
          }
        }`,
        undefined,
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.mySessions;
    },

    async revokeSession(sessionId: string, accessToken: string): Promise<boolean> {
      const data = await graphqlFetch<{ revokeSession: boolean }>(
        graphqlUrl,
        `mutation RevokeSession($sessionId: String!) {
          revokeSession(sessionId: $sessionId)
        }`,
        { sessionId },
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.revokeSession;
    },

    async revokeAllOtherSessions(accessToken: string): Promise<boolean> {
      const data = await graphqlFetch<{ revokeAllOtherSessions: boolean }>(
        graphqlUrl,
        `mutation RevokeAllOtherSessions {
          revokeAllOtherSessions
        }`,
        undefined,
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.revokeAllOtherSessions;
    },

    // Passkey mutations
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
            ${INSTITUTE_LOGIN_FIELDS}
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

    async changePassword(
      currentPassword: string,
      newPassword: string,
      accessToken: string,
    ): Promise<boolean> {
      const data = await graphqlFetch<{ changePassword: boolean }>(
        graphqlUrl,
        `mutation ChangePassword($currentPassword: String!, $newPassword: String!) {
          changePassword(currentPassword: $currentPassword, newPassword: $newPassword)
        }`,
        { currentPassword, newPassword },
        { Authorization: `Bearer ${accessToken}` },
      );
      return data.changePassword;
    },
  };
}
