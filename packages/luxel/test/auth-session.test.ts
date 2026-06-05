import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { SqliteSessionStore } from "../src/auth/sqlite-session-store.ts";

describe("session store", () => {
  test("SQLite adapter persists session across reopen", async () => {
    const dir = await mkdtemp(join(tmpdir(), "luxel-session-"));
    const dbPath = join(dir, "sessions.sqlite");
    const store = new SqliteSessionStore(dbPath);
    const created = await store.create({
      userId: "user-1",
      csrfToken: "csrf-abc",
      expiresAt: Date.now() + 60_000,
    });
    expect(created.id).toBeString();

    const reopened = new SqliteSessionStore(dbPath);
    const loaded = await reopened.get(created.id);
    expect(loaded?.userId).toBe("user-1");
    expect(loaded?.csrfToken).toBe("csrf-abc");
  });
});
