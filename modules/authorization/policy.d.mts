export type UserRole =
  | "CUSTOMER"
  | "PRO_CUSTOMER_ADMIN"
  | "FIELD_STAFF"
  | "DISPATCHER"
  | "ACCOUNTING"
  | "ADMIN";

export type Permission =
  | "customer.portal.access"
  | "customer.profile.manage_self"
  | "customer.gardens.manage_self"
  | "customer.orders.read_self"
  | "customer.invoices.read_self"
  | "organization.manage"
  | "field.portal.access"
  | "field.missions.read_assigned"
  | "field.reports.write_assigned"
  | "backoffice.access"
  | "planning.read"
  | "planning.write"
  | "orders.read"
  | "orders.write"
  | "customers.read"
  | "gardens.read"
  | "teams.read"
  | "teams.write"
  | "pricing.read"
  | "pricing.write"
  | "zones.read"
  | "zones.write"
  | "payments.read"
  | "payments.write"
  | "invoices.read"
  | "invoices.write"
  | "fiscality.read"
  | "fiscality.write"
  | "analytics.read"
  | "settings.read"
  | "settings.write"
  | "staff.manage"
  | "audit.read";

export const ROLES: readonly UserRole[];
export const STAFF_ROLES: readonly UserRole[];
export const PERMISSIONS: readonly Permission[];
export function isRole(value: unknown): value is UserRole;
export function isStaffRole(value: unknown): value is UserRole;
export function permissionsForRoles(roles: readonly string[]): Set<Permission>;
export function hasPermission(roles: readonly string[], permission: Permission): boolean;
export function hasAnyStaffRole(roles: readonly string[]): boolean;
export function defaultPortalForRoles(roles: readonly string[]): "/admin" | "/terrain" | "/espace-client";
export function canAccessOwnedUserResource(actor: { id?: string } | null, ownerUserId: string | null): boolean;
export function canAccessAssignedMission(actor: { id?: string; roles: readonly string[] } | null, assignedUserIds: readonly string[]): boolean;
