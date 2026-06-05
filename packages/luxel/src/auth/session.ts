export type SessionRecord = {
  id: string;
  userId: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
};

export interface SessionStoreAdapter {
  create(input: {
    userId: string;
    csrfToken: string;
    expiresAt: number;
  }): Promise<SessionRecord>;
  get(id: string): Promise<SessionRecord | null>;
  delete(id: string): Promise<void>;
}

export function createSessionId(): string {
  return crypto.randomUUID();
}

export function createCsrfToken(): string {
  return crypto.randomUUID();
}

export const SESSION_COOKIE = "luxel_session";

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function sessionCookieHeader(sessionId: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
