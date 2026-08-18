import { drizzle } from "drizzle-orm/libsql";
import { getLibsqlClient } from "./runtime";
import * as schema from "./schema";

export function getDb() {
  return drizzle(getLibsqlClient(), { schema });
}
