import { AsyncLocalStorage } from "node:async_hooks";
import type { AppDatabase } from "@/db/database";

export type RuntimeEnvironment = Record<string, unknown> & {
  DB?: AppDatabase;
};

const runtimeEnvironment = new AsyncLocalStorage<RuntimeEnvironment>();

export function withRuntimeEnvironment<T>(
  environment: RuntimeEnvironment,
  operation: () => T,
): T {
  return runtimeEnvironment.run(environment, operation);
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  return runtimeEnvironment.getStore() ?? {};
}

export function runtimeValue(name: string): string {
  const environment = runtimeEnvironment.getStore();
  const boundValue = environment?.[name];
  if (typeof boundValue === "string" && boundValue.trim()) return boundValue.trim();
  return process.env[name]?.trim() ?? "";
}
