# Auth adapters

Opaque session cookie `luxel_session` (HttpOnly, SameSite=Lax). Session payload lives server-side only.

## Session store

Implement `SessionStoreAdapter` (`packages/luxel/src/auth/session.ts`):

- `create({ userId, csrfToken, expiresAt })`
- `get(id)` — returns null when expired
- `delete(id)`

Reference: `SqliteSessionStore` (`sqlite-session-store.ts`) for file-backed dev/tests.

## Auth provider

Implement `AuthProvider` (`provider.ts`):

- `authenticate({ email, password })` → `{ userId } | null`

Reference: `DevCredentialsProvider` (`dev@luxel.local` / `luxel-dev`) for integration tests only.

## HTTP

- `POST /__luxel/auth/login` — JSON credentials, `Set-Cookie` + `X-Luxel-CSRF`
- `POST /__luxel/auth/logout` — clears cookie + session row

Routes that reference `ctx.session` compile as dynamic SSR (`mode: ssr`), not SSG/ISR.
