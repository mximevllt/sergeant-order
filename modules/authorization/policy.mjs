export const ROLES = Object.freeze([
  "CUSTOMER",
  "PRO_CUSTOMER_ADMIN",
  "FIELD_STAFF",
  "DISPATCHER",
  "ACCOUNTING",
  "ADMIN",
]);

export const STAFF_ROLES = Object.freeze([
  "FIELD_STAFF",
  "DISPATCHER",
  "ACCOUNTING",
  "ADMIN",
]);

export const PERMISSIONS = Object.freeze([
  "customer.portal.access",
  "customer.profile.manage_self",
  "customer.gardens.manage_self",
  "customer.orders.read_self",
  "customer.invoices.read_self",
  "organization.manage",
  "field.portal.access",
  "field.missions.read_assigned",
  "field.reports.write_assigned",
  "backoffice.access",
  "planning.read",
  "planning.write",
  "orders.read",
  "orders.write",
  "customers.read",
  "gardens.read",
  "teams.read",
  "teams.write",
  "pricing.read",
  "pricing.write",
  "zones.read",
  "zones.write",
  "payments.read",
  "payments.write",
  "invoices.read",
  "invoices.write",
  "fiscality.read",
  "fiscality.write",
  "analytics.read",
  "settings.read",
  "settings.write",
  "staff.manage",
  "audit.read",
]);

const ROLE_PERMISSIONS = Object.freeze({
  CUSTOMER: Object.freeze([
    "customer.portal.access",
    "customer.profile.manage_self",
    "customer.gardens.manage_self",
    "customer.orders.read_self",
    "customer.invoices.read_self",
  ]),
  PRO_CUSTOMER_ADMIN: Object.freeze([
    "customer.portal.access",
    "customer.profile.manage_self",
    "customer.gardens.manage_self",
    "customer.orders.read_self",
    "customer.invoices.read_self",
    "organization.manage",
  ]),
  FIELD_STAFF: Object.freeze([
    "field.portal.access",
    "field.missions.read_assigned",
    "field.reports.write_assigned",
  ]),
  DISPATCHER: Object.freeze([
    "backoffice.access",
    "planning.read",
    "planning.write",
    "orders.read",
    "orders.write",
    "customers.read",
    "gardens.read",
    "teams.read",
    "teams.write",
  ]),
  ACCOUNTING: Object.freeze([
    "backoffice.access",
    "customers.read",
    "payments.read",
    "payments.write",
    "invoices.read",
    "invoices.write",
    "fiscality.read",
    "fiscality.write",
    "analytics.read",
  ]),
  ADMIN: PERMISSIONS,
});

export function isRole(value) {
  return typeof value === "string" && ROLES.includes(value);
}

export function isStaffRole(value) {
  return typeof value === "string" && STAFF_ROLES.includes(value);
}

export function permissionsForRoles(roles) {
  const permissions = new Set();
  for (const role of roles ?? []) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) permissions.add(permission);
  }
  return permissions;
}

export function hasPermission(roles, permission) {
  return permissionsForRoles(roles).has(permission);
}

export function hasAnyStaffRole(roles) {
  return (roles ?? []).some(isStaffRole);
}

export function defaultPortalForRoles(roles) {
  if (hasPermission(roles, "backoffice.access")) return "/admin";
  if (hasPermission(roles, "field.portal.access")) return "/terrain";
  return "/espace-client";
}

export function canAccessOwnedUserResource(actor, ownerUserId) {
  return Boolean(actor?.id && ownerUserId && actor.id === ownerUserId);
}

export function canAccessAssignedMission(actor, assignedUserIds) {
  if (!actor?.id) return false;
  if (hasPermission(actor.roles, "orders.read")) return true;
  return hasPermission(actor.roles, "field.missions.read_assigned") && assignedUserIds.includes(actor.id);
}
