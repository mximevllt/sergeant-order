export type DatabaseValue = string | number | bigint | boolean | null | Uint8Array;

export type DatabaseResult<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta: {
    changes: number;
    lastRowId?: string | number;
  };
};

export interface PreparedStatement {
  bind(...values: DatabaseValue[]): PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
  run<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
}

export interface AppDatabase {
  prepare(query: string): PreparedStatement;
  batch<T = Record<string, unknown>>(statements: PreparedStatement[]): Promise<DatabaseResult<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}
