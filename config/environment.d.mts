export type AppEnvironment = "development" | "staging" | "production";

export interface EnvironmentInspection {
  valid: boolean;
  environment: AppEnvironment;
  publicConfiguration: {
    appUrl: string;
    timezone: string;
    emailDeliveryMode: string;
    paymentMode: string;
    aiciMode: string;
  };
  integrations: Record<string, {
    configured: boolean;
    complete: boolean;
    required: boolean;
  }>;
  errors: string[];
  warnings: string[];
}

export const APP_ENVIRONMENTS: readonly AppEnvironment[];
export const CORE_VARIABLES: readonly string[];
export const SECRET_VARIABLES: readonly string[];
export const INTEGRATION_GROUPS: Readonly<Record<string, readonly string[]>>;

export function inspectEnvironment(
  source?: Record<string, unknown>,
  options?: {
    environment?: string;
    allowDevelopmentDefaults?: boolean;
    requireIntegrations?: string[] | "all";
  },
): EnvironmentInspection;
