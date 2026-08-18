import { AsyncLocalStorage } from "node:async_hooks";

export type RuntimeEnvironment = Record<string, unknown> & {
  DB?: D1Database;
};

const runtimeEnvironment = new AsyncLocalStorage<RuntimeEnvironment>();

export function withRuntimeEnvironment<T>(
  environment: RuntimeEnvironment,
  operation: () => T,
): T {
  return runtimeEnvironment.run(environment, operation);
}

export function getRuntimeEnvironment(): RuntimeEnvironment {
  const environment = runtimeEnvironment.getStore();
  if (!environment) throw new Error("RUNTIME_ENVIRONMENT_UNAVAILABLE");
  return environment;
}

export function runtimeValue(name: string): string {
  const environment = runtimeEnvironment.getStore();
  const boundValue = environment?.[name];
  if (typeof boundValue === "string" && boundValue.trim()) return boundValue.trim();
  return process.env[name]?.trim() ?? "";
}
