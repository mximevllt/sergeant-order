import { createClient, type Client, type InValue, type ResultSet } from "@libsql/client";
import { getRuntimeEnvironment, runtimeValue } from "@/config/runtime-environment";
import type { AppDatabase, DatabaseResult, DatabaseValue, PreparedStatement } from "./database";

let client: Client | undefined;
let database: AppDatabase | undefined;

function databaseUrl(): string {
  return runtimeValue("TURSO_DATABASE_URL") || "file:./sergeant-paysage.local.db";
}

export function getLibsqlClient(): Client {
  if (!client) {
    client = createClient({
      url: databaseUrl(),
      authToken: runtimeValue("TURSO_AUTH_TOKEN") || undefined,
    });
  }
  return client;
}

function inputValue(value: DatabaseValue): InValue {
  return typeof value === "boolean" ? (value ? 1 : 0) : value;
}

function result<T>(value: ResultSet): DatabaseResult<T> {
  return {
    results: value.rows as T[],
    success: true,
    meta: {
      changes: value.rowsAffected,
      lastRowId: value.lastInsertRowid?.toString(),
    },
  };
}

class LibsqlPreparedStatement implements PreparedStatement {
  constructor(
    private readonly client: Client,
    readonly sql: string,
    readonly values: DatabaseValue[] = [],
  ) {}

  bind(...values: DatabaseValue[]): PreparedStatement {
    return new LibsqlPreparedStatement(this.client, this.sql, values);
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const executed = await this.execute();
    const row = executed.rows[0];
    if (!row) return null;
    return (columnName ? row[columnName] : row) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>> {
    return result<T>(await this.execute());
  }

  async run<T = Record<string, unknown>>(): Promise<DatabaseResult<T>> {
    return result<T>(await this.execute());
  }

  execute(): Promise<ResultSet> {
    return this.client.execute({ sql: this.sql, args: this.values.map(inputValue) });
  }

  statement() {
    return { sql: this.sql, args: this.values.map(inputValue) };
  }
}

class LibsqlDatabase implements AppDatabase {
  constructor(private readonly client: Client) {}

  prepare(query: string): PreparedStatement {
    return new LibsqlPreparedStatement(this.client, query);
  }

  async batch<T = Record<string, unknown>>(statements: PreparedStatement[]): Promise<DatabaseResult<T>[]> {
    const commands = statements.map((statement) => {
      if (!(statement instanceof LibsqlPreparedStatement)) {
        throw new TypeError("DATABASE_STATEMENT_INCOMPATIBLE");
      }
      return statement.statement();
    });
    const results = await this.client.batch(commands, "write");
    return results.map((item) => result<T>(item));
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const startedAt = performance.now();
    await this.client.executeMultiple(query);
    return { count: 0, duration: performance.now() - startedAt };
  }
}

export function getDatabase(): AppDatabase {
  const injected = getRuntimeEnvironment().DB;
  if (injected) return injected;
  if (!database) database = new LibsqlDatabase(getLibsqlClient());
  return database;
}
