import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessAssignedMission,
  canAccessOwnedUserResource,
  defaultPortalForRoles,
  hasAnyStaffRole,
  hasPermission,
  permissionsForRoles,
} from "../modules/authorization/policy.mjs";

test("applique une matrice de droits minimale et additive", () => {
  assert.equal(hasPermission(["CUSTOMER"], "customer.orders.read_self"), true);
  assert.equal(hasPermission(["CUSTOMER"], "orders.read"), false);
  assert.equal(hasPermission(["FIELD_STAFF"], "field.missions.read_assigned"), true);
  assert.equal(hasPermission(["FIELD_STAFF"], "customers.read"), false);
  assert.equal(hasPermission(["DISPATCHER"], "planning.write"), true);
  assert.equal(hasPermission(["DISPATCHER"], "payments.write"), false);
  assert.equal(hasPermission(["ACCOUNTING"], "payments.write"), true);
  assert.equal(hasPermission(["ACCOUNTING"], "planning.write"), false);
  assert.equal(hasPermission(["ADMIN"], "staff.manage"), true);
  assert.equal(permissionsForRoles(["DISPATCHER", "ACCOUNTING"]).has("payments.read"), true);
});

test("sépare les portails et la portée des ressources", () => {
  assert.equal(hasAnyStaffRole(["CUSTOMER"]), false);
  assert.equal(hasAnyStaffRole(["CUSTOMER", "FIELD_STAFF"]), true);
  assert.equal(defaultPortalForRoles(["FIELD_STAFF"]), "/terrain");
  assert.equal(defaultPortalForRoles(["DISPATCHER"]), "/admin");
  assert.equal(canAccessOwnedUserResource({ id: "client-a" }, "client-a"), true);
  assert.equal(canAccessOwnedUserResource({ id: "client-a" }, "client-b"), false);
  assert.equal(canAccessAssignedMission({ id: "terrain-a", roles: ["FIELD_STAFF"] }, ["terrain-a"]), true);
  assert.equal(canAccessAssignedMission({ id: "terrain-a", roles: ["FIELD_STAFF"] }, ["terrain-b"]), false);
  assert.equal(canAccessAssignedMission({ id: "planning", roles: ["DISPATCHER"] }, []), true);
});
