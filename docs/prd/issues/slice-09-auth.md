## Parent

https://github.com/SynCROSS/luxel/issues/34

## What to build

**Auth (C4c) v1.0:** opaque session cookie → **session store adapter** with **SQLite file** implementation. **Provider adapter interface** + **one reference provider** (dev credentials or email/password stub) for tests. Postgres session adapter and OAuth **out of scope** (post-v1.0). JWT not default.

## Acceptance criteria

- [ ] Session created on login, cleared on logout; cookie httpOnly/sameSite documented
- [ ] SQLite adapter persists sessions across server restart in dev
- [ ] Reference provider login flow works in integration test
- [ ] Routes that read session force dynamic SSR (prerender inference respects session reads)
- [ ] Provider and session adapters documented for custom implementations

## Blocked by

- https://github.com/SynCROSS/luxel/issues/35
