interface JwtPayload {
  sub: string;
  tenantId: string;
  roleId: string;
  exp: number;
  iat: number;
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, bufferSeconds = 30): boolean {
  const payload = decodeJwt(token);
  if (!payload) return true;
  const now = Math.floor(Date.now() / 1000);
  return payload.exp - bufferSeconds <= now;
}
