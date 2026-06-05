import { Database } from "bun:sqlite";
import {
  createSessionId,
  type SessionRecord,
  type SessionStoreAdapter,
} from "./session.ts";

export class SqliteSessionStore implements SessionStoreAdapter {
  private readonly db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        csrf_token TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  async create(input: {
    userId: string;
    csrfToken: string;
    expiresAt: number;
  }): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: createSessionId(),
      userId: input.userId,
      csrfToken: input.csrfToken,
      createdAt: Date.now(),
      expiresAt: input.expiresAt,
    };
    this.db.run(
      `INSERT INTO sessions (id, user_id, csrf_token, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
      [record.id, record.userId, record.csrfToken, record.createdAt, record.expiresAt],
    );
    return record;
  }

  async get(id: string): Promise<SessionRecord | null> {
    const row = this.db
      .query(
        `SELECT id, user_id, csrf_token, created_at, expires_at FROM sessions WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          user_id: string;
          csrf_token: string;
          created_at: number;
          expires_at: number;
        }
      | null;
    if (!row) return null;
    if (row.expires_at <= Date.now()) {
      await this.delete(id);
      return null;
    }
    return {
      id: row.id,
      userId: row.user_id,
      csrfToken: row.csrf_token,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  async delete(id: string): Promise<void> {
    this.db.run(`DELETE FROM sessions WHERE id = ?`, [id]);
  }
}
