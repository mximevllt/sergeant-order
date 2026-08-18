import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";

const createdAt = () => text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () => text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const bool = (name: string) => integer(name, { mode: "boolean" }).notNull().default(false);
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export type UserRole =
  | "CUSTOMER"
  | "PRO_CUSTOMER_ADMIN"
  | "FIELD_STAFF"
  | "DISPATCHER"
  | "ACCOUNTING"
  | "ADMIN";

export const businessSettings = sqliteTable("business_settings", {
  id: text("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name").notNull(),
  legalForm: text("legal_form").notNull(),
  registeredOffice: json<Record<string, string>>("registered_office_json").notNull(),
  siren: text("siren").notNull(),
  siret: text("siret").notNull(),
  vatNumber: text("vat_number").notNull(),
  shareCapitalCents: integer("share_capital_cents").notNull(),
  registry: text("registry").notNull(),
  vatRateBasisPoints: integer("vat_rate_basis_points").notNull().default(2000),
  currency: text("currency").notNull().default("EUR"),
  timezone: text("timezone").notNull().default("Europe/Paris"),
  minimumLeadHours: integer("minimum_lead_hours").notNull().default(24),
  maximumAdvanceDays: integer("maximum_advance_days").notNull().default(31),
  workdays: json<number[]>("workdays_json").notNull(),
  workPeriods: json<Array<{ code: string; startsLocal: string; endsLocal: string }>>("work_periods_json").notNull(),
  aiciEnabled: integer("aici_enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_business_settings_siren").on(table.siren),
  uniqueIndex("uq_business_settings_siret").on(table.siret),
  check("ck_business_settings_capital", sql`${table.shareCapitalCents} >= 0`),
  check("ck_business_settings_vat", sql`${table.vatRateBasisPoints} BETWEEN 0 AND 10000`),
  check("ck_business_settings_booking_window", sql`${table.minimumLeadHours} >= 0 AND ${table.maximumAdvanceDays} >= 1`),
]);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  emailNormalized: text("email_normalized").notNull(),
  emailVerifiedAt: text("email_verified_at"),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  locale: text("locale").notNull().default("fr-FR"),
  status: text("status", { enum: ["INVITED", "ACTIVE", "SUSPENDED", "ARCHIVED"] }).notNull().default("INVITED"),
  lastLoginAt: text("last_login_at"),
  disabledAt: text("disabled_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_users_email_normalized").on(table.emailNormalized),
  index("idx_users_status").on(table.status),
]);

export const userRoles = sqliteTable("user_roles", {
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["CUSTOMER", "PRO_CUSTOMER_ADMIN", "FIELD_STAFF", "DISPATCHER", "ACCOUNTING", "ADMIN"] }).$type<UserRole>().notNull(),
  grantedByUserId: text("granted_by_user_id").references(() => users.id),
  grantedAt: text("granted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userId, table.role], name: "pk_user_roles" }),
  index("idx_user_roles_role").on(table.role),
]);

export const authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  kind: text("kind", { enum: ["CUSTOMER", "STAFF"] }).notNull(),
  expiresAt: text("expires_at").notNull(),
  lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  revokedAt: text("revoked_at"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uq_auth_sessions_token_hash").on(table.tokenHash),
  index("idx_auth_sessions_user_active").on(table.userId, table.expiresAt),
]);

export const magicLinkTokens = sqliteTable("magic_link_tokens", {
  id: text("id").primaryKey(),
  emailNormalized: text("email_normalized").notNull(),
  requestedName: text("requested_name"),
  tokenHash: text("token_hash").notNull(),
  purpose: text("purpose", { enum: ["SIGN_IN", "VERIFY_EMAIL", "CHANGE_EMAIL"] }).notNull(),
  returnTo: text("return_to"),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
  requestedIpHash: text("requested_ip_hash"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uq_magic_link_tokens_hash").on(table.tokenHash),
  index("idx_magic_link_tokens_email_expiry").on(table.emailNormalized, table.expiresAt),
  index("idx_magic_link_tokens_email_created").on(table.emailNormalized, table.createdAt),
  index("idx_magic_link_tokens_ip_created").on(table.requestedIpHash, table.createdAt),
]);

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  legalName: text("legal_name").notNull(),
  tradeName: text("trade_name"),
  siren: text("siren"),
  vatNumber: text("vat_number"),
  billingEmail: text("billing_email").notNull(),
  billingAddressSnapshot: json<Record<string, unknown>>("billing_address_snapshot").notNull(),
  status: text("status", { enum: ["ACTIVE", "SUSPENDED", "ARCHIVED"] }).notNull().default("ACTIVE"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_organizations_siren").on(table.siren).where(sql`${table.siren} IS NOT NULL`),
  index("idx_organizations_status").on(table.status),
]);

export const organizationMemberships = sqliteTable("organization_memberships", {
  organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["ADMIN", "BOOKER", "BILLING", "VIEWER"] }).notNull(),
  createdAt: createdAt(),
}, (table) => [
  primaryKey({ columns: [table.organizationId, table.userId], name: "pk_organization_memberships" }),
  index("idx_organization_memberships_user").on(table.userId),
]);

export const customerProfiles = sqliteTable("customer_profiles", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  customerType: text("customer_type", { enum: ["INDIVIDUAL", "PROFESSIONAL"] }).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  marketingConsentAt: text("marketing_consent_at"),
  termsAcceptedAt: text("terms_accepted_at"),
  privacyAcceptedAt: text("privacy_accepted_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_customer_profiles_stripe_customer").on(table.stripeCustomerId).where(sql`${table.stripeCustomerId} IS NOT NULL`),
  index("idx_customer_profiles_type").on(table.customerType),
]);

export const addresses = sqliteTable("addresses", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").references(() => users.id),
  organizationId: text("organization_id").references(() => organizations.id),
  kind: text("kind", { enum: ["SERVICE", "BILLING", "OTHER"] }).notNull(),
  label: text("label"),
  line1: text("line1").notNull(),
  line2: text("line2"),
  postalCode: text("postal_code").notNull(),
  city: text("city").notNull(),
  inseeCode: text("insee_code"),
  departmentCode: text("department_code").notNull(),
  countryCode: text("country_code").notNull().default("FR"),
  latitudeE6: integer("latitude_e6"),
  longitudeE6: integer("longitude_e6"),
  geocodingPrecision: text("geocoding_precision"),
  geocodingProviderId: text("geocoding_provider_id"),
  verifiedAt: text("verified_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("idx_addresses_owner").on(table.ownerUserId),
  index("idx_addresses_organization").on(table.organizationId),
  index("idx_addresses_location").on(table.departmentCode, table.postalCode, table.city),
  check("ck_addresses_owner", sql`${table.ownerUserId} IS NOT NULL OR ${table.organizationId} IS NOT NULL`),
]);

export const gardens = sqliteTable("gardens", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").references(() => users.id),
  organizationId: text("organization_id").references(() => organizations.id),
  addressId: text("address_id").notNull().references(() => addresses.id),
  label: text("label").notNull(),
  surfaceM2: integer("surface_m2"),
  terrainSlope: text("terrain_slope", { enum: ["FLAT", "GENTLE", "STEEP", "UNKNOWN"] }).notNull().default("UNKNOWN"),
  accessWidthCm: integer("access_width_cm"),
  hasAnimals: integer("has_animals", { mode: "boolean" }).notNull().default(false),
  parkingNotes: text("parking_notes"),
  publicNotes: text("public_notes"),
  internalNotes: text("internal_notes"),
  archivedAt: text("archived_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("idx_gardens_owner").on(table.ownerUserId, table.archivedAt),
  index("idx_gardens_organization").on(table.organizationId, table.archivedAt),
  index("idx_gardens_address").on(table.addressId),
  check("ck_gardens_owner", sql`${table.ownerUserId} IS NOT NULL OR ${table.organizationId} IS NOT NULL`),
  check("ck_gardens_surface", sql`${table.surfaceM2} IS NULL OR ${table.surfaceM2} >= 0`),
]);

export const gardenContacts = sqliteTable("garden_contacts", {
  id: text("id").primaryKey(),
  gardenId: text("garden_id").notNull().references(() => gardens.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  instructions: text("instructions"),
  isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
}, (table) => [index("idx_garden_contacts_garden").on(table.gardenId)]);

export const gardenAccessSecrets = sqliteTable("garden_access_secrets", {
  id: text("id").primaryKey(),
  gardenId: text("garden_id").notNull().references(() => gardens.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["GATE_CODE", "KEY_BOX", "ALARM", "OTHER"] }).notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  encryptionKeyVersion: text("encryption_key_version").notNull(),
  lastFourHint: text("last_four_hint"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [index("idx_garden_access_secrets_garden").on(table.gardenId)]);

export const catalogServices = sqliteTable("catalog_services", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  kind: text("kind", { enum: ["ONE_OFF", "RECURRING"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_catalog_services_code").on(table.code),
  index("idx_catalog_services_active_sort").on(table.active, table.sortOrder),
]);

export const catalogTasks = sqliteTable("catalog_tasks", {
  id: text("id").primaryKey(),
  serviceId: text("service_id").notNull().references(() => catalogServices.id),
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  measurementKind: text("measurement_kind", { enum: ["NONE", "SURFACE_M2", "LENGTH_M", "COUNT"] }).notNull(),
  eligibleSap: integer("eligible_sap", { mode: "boolean" }).notNull().default(true),
  requiredCapability: text("required_capability"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_catalog_tasks_service_code").on(table.serviceId, table.code),
  index("idx_catalog_tasks_active_sort").on(table.serviceId, table.active, table.sortOrder),
]);

export const pricingVersions = sqliteTable("pricing_versions", {
  id: text("id").primaryKey(),
  version: integer("version").notNull(),
  status: text("status", { enum: ["DRAFT", "ACTIVE", "ARCHIVED"] }).notNull().default("DRAFT"),
  label: text("label").notNull(),
  effectiveFrom: text("effective_from"),
  halfDayTtcCents: integer("half_day_ttc_cents").notNull(),
  vatRateBasisPoints: integer("vat_rate_basis_points").notNull().default(2000),
  currency: text("currency").notNull().default("EUR"),
  publishedByUserId: text("published_by_user_id").references(() => users.id),
  publishedAt: text("published_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_pricing_versions_version").on(table.version),
  uniqueIndex("uq_pricing_versions_single_active").on(table.status).where(sql`${table.status} = 'ACTIVE'`),
  check("ck_pricing_versions_amount", sql`${table.halfDayTtcCents} >= 0`),
  check("ck_pricing_versions_vat", sql`${table.vatRateBasisPoints} BETWEEN 0 AND 10000`),
]);

export const pricingRules = sqliteTable("pricing_rules", {
  id: text("id").primaryKey(),
  pricingVersionId: text("pricing_version_id").notNull().references(() => pricingVersions.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  ruleType: text("rule_type", { enum: ["BASE", "TASK", "MEASUREMENT", "CONDITION", "URGENCY", "DISCOUNT"] }).notNull(),
  priority: integer("priority").notNull().default(0),
  condition: json<Record<string, unknown>>("condition_json").notNull(),
  calculation: json<Record<string, unknown>>("calculation_json").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_pricing_rules_version_code").on(table.pricingVersionId, table.code),
  index("idx_pricing_rules_execution").on(table.pricingVersionId, table.active, table.priority),
]);

export const serviceZones = sqliteTable("service_zones", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  departmentCode: text("department_code").notNull(),
  minLeadHours: integer("min_lead_hours").notNull().default(24),
  maxAdvanceDays: integer("max_advance_days").notNull().default(31),
  surchargeTtcCents: integer("surcharge_ttc_cents").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  polygonGeoJson: json<Record<string, unknown>>("polygon_geojson"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_service_zones_code").on(table.code),
  index("idx_service_zones_department_active").on(table.departmentCode, table.active),
  check("ck_service_zones_lead", sql`${table.minLeadHours} >= 0 AND ${table.maxAdvanceDays} >= 1`),
  check("ck_service_zones_surcharge", sql`${table.surchargeTtcCents} >= 0`),
]);

export const zoneMunicipalities = sqliteTable("zone_municipalities", {
  zoneId: text("zone_id").notNull().references(() => serviceZones.id, { onDelete: "cascade" }),
  inseeCode: text("insee_code").notNull(),
  postalCode: text("postal_code").notNull(),
  cityName: text("city_name").notNull(),
  included: integer("included", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  primaryKey({ columns: [table.zoneId, table.inseeCode, table.postalCode], name: "pk_zone_municipalities" }),
  index("idx_zone_municipalities_lookup").on(table.postalCode, table.inseeCode, table.included),
]);

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  startAddressId: text("start_address_id").references(() => addresses.id),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [uniqueIndex("uq_teams_code").on(table.code), index("idx_teams_active").on(table.active)]);

export const teamMembers = sqliteTable("team_members", {
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  role: text("role", { enum: ["LEAD", "MEMBER"] }).notNull().default("MEMBER"),
  startsAt: text("starts_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  endsAt: text("ends_at"),
}, (table) => [
  primaryKey({ columns: [table.teamId, table.userId, table.startsAt], name: "pk_team_members" }),
  index("idx_team_members_user_active").on(table.userId, table.endsAt),
]);

export const teamCapabilities = sqliteTable("team_capabilities", {
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  capability: text("capability").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [primaryKey({ columns: [table.teamId, table.capability], name: "pk_team_capabilities" })]);

export const teamWeeklyHours = sqliteTable("team_weekly_hours", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id, { onDelete: "cascade" }),
  isoWeekday: integer("iso_weekday").notNull(),
  period: text("period", { enum: ["MORNING", "AFTERNOON"] }).notNull(),
  startsLocal: text("starts_local").notNull(),
  endsLocal: text("ends_local").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  uniqueIndex("uq_team_weekly_hours_slot").on(table.teamId, table.isoWeekday, table.period),
  index("idx_team_weekly_hours_lookup").on(table.isoWeekday, table.active),
  check("ck_team_weekly_hours_weekday", sql`${table.isoWeekday} BETWEEN 1 AND 7`),
]);

export const teamUnavailabilities = sqliteTable("team_unavailabilities", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull().references(() => teams.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  createdByUserId: text("created_by_user_id").notNull().references(() => users.id),
  createdAt: createdAt(),
}, (table) => [
  index("idx_team_unavailabilities_range").on(table.teamId, table.startsAt, table.endsAt),
  check("ck_team_unavailabilities_range", sql`${table.endsAt} > ${table.startsAt}`),
]);

export const quotes = sqliteTable("quotes", {
  id: text("id").primaryKey(),
  publicReference: text("public_reference").notNull(),
  customerUserId: text("customer_user_id").references(() => users.id),
  organizationId: text("organization_id").references(() => organizations.id),
  gardenId: text("garden_id").references(() => gardens.id),
  pricingVersionId: text("pricing_version_id").notNull().references(() => pricingVersions.id),
  status: text("status", { enum: ["DRAFT", "PRICED", "SLOT_HELD", "ACCEPTED", "EXPIRED", "CANCELLED"] }).notNull().default("DRAFT"),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  requestSnapshot: json<Record<string, unknown>>("request_snapshot").notNull(),
  pricingSnapshot: json<Record<string, unknown>>("pricing_snapshot"),
  pricingFingerprint: text("pricing_fingerprint"),
  recommendedHalfDays: integer("recommended_half_days"),
  selectedHalfDays: integer("selected_half_days"),
  subtotalHtCents: integer("subtotal_ht_cents"),
  vatCents: integer("vat_cents"),
  totalTtcCents: integer("total_ttc_cents"),
  eligibleSapCents: integer("eligible_sap_cents"),
  expiresAt: text("expires_at").notNull(),
  acceptedAt: text("accepted_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_quotes_public_reference").on(table.publicReference),
  uniqueIndex("uq_quotes_pricing_fingerprint").on(table.pricingFingerprint).where(sql`${table.pricingFingerprint} IS NOT NULL`),
  index("idx_quotes_customer_created").on(table.customerUserId, table.createdAt),
  index("idx_quotes_status_expiry").on(table.status, table.expiresAt),
  check("ck_quotes_duration", sql`(${table.recommendedHalfDays} IS NULL OR ${table.recommendedHalfDays} >= 1) AND (${table.selectedHalfDays} IS NULL OR ${table.selectedHalfDays} >= 1)`),
  check("ck_quotes_amounts", sql`(${table.subtotalHtCents} IS NULL OR ${table.subtotalHtCents} >= 0) AND (${table.vatCents} IS NULL OR ${table.vatCents} >= 0) AND (${table.totalTtcCents} IS NULL OR ${table.totalTtcCents} >= 0)`),
]);

export const quoteTasks = sqliteTable("quote_tasks", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  catalogTaskId: text("catalog_task_id").references(() => catalogTasks.id),
  codeSnapshot: text("code_snapshot").notNull(),
  labelSnapshot: text("label_snapshot").notNull(),
  priority: integer("priority").notNull().default(0),
  measurement: json<Record<string, unknown>>("measurement_json").notNull(),
  priceImpactTtcCents: integer("price_impact_ttc_cents").notNull().default(0),
}, (table) => [
  uniqueIndex("uq_quote_tasks_code").on(table.quoteId, table.codeSnapshot),
  index("idx_quote_tasks_priority").on(table.quoteId, table.priority),
]);

export const quoteAdjustments = sqliteTable("quote_adjustments", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  label: text("label").notNull(),
  kind: text("kind", { enum: ["BASE", "SURCHARGE", "DISCOUNT", "TAX"] }).notNull(),
  amountTtcCents: integer("amount_ttc_cents").notNull(),
  calculationSnapshot: json<Record<string, unknown>>("calculation_snapshot").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  uniqueIndex("uq_quote_adjustments_code").on(table.quoteId, table.code),
  index("idx_quote_adjustments_sort").on(table.quoteId, table.sortOrder),
]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  publicReference: text("public_reference").notNull(),
  quoteId: text("quote_id").notNull().references(() => quotes.id),
  customerUserId: text("customer_user_id").notNull().references(() => users.id),
  organizationId: text("organization_id").references(() => organizations.id),
  gardenId: text("garden_id").notNull().references(() => gardens.id),
  status: text("status", { enum: ["PENDING_PAYMENT_SETUP", "CONFIRMED", "TO_SCHEDULE", "SCHEDULED", "READY", "IN_PROGRESS", "COMPLETED", "CANCELLED", "PAYMENT_ACTION_REQUIRED", "PAYMENT_FAILED", "REFUND_PENDING", "REFUNDED", "DISPUTED"] }).notNull(),
  paymentMethod: text("payment_method", { enum: ["STRIPE", "AICI", "MANUAL"] }).notNull(),
  pricingSnapshot: json<Record<string, unknown>>("pricing_snapshot").notNull(),
  serviceAddressSnapshot: json<Record<string, unknown>>("service_address_snapshot").notNull(),
  billingIdentitySnapshot: json<Record<string, unknown>>("billing_identity_snapshot").notNull(),
  selectedHalfDays: integer("selected_half_days").notNull(),
  subtotalHtCents: integer("subtotal_ht_cents").notNull(),
  vatCents: integer("vat_cents").notNull(),
  totalTtcCents: integer("total_ttc_cents").notNull(),
  eligibleSapCents: integer("eligible_sap_cents").notNull().default(0),
  cancellationReason: text("cancellation_reason"),
  confirmedAt: text("confirmed_at"),
  cancelledAt: text("cancelled_at"),
  completedAt: text("completed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_orders_public_reference").on(table.publicReference),
  uniqueIndex("uq_orders_quote").on(table.quoteId),
  index("idx_orders_customer_created").on(table.customerUserId, table.createdAt),
  index("idx_orders_status_created").on(table.status, table.createdAt),
  index("idx_orders_garden_created").on(table.gardenId, table.createdAt),
  check("ck_orders_duration", sql`${table.selectedHalfDays} >= 1`),
  check("ck_orders_amounts", sql`${table.subtotalHtCents} >= 0 AND ${table.vatCents} >= 0 AND ${table.totalTtcCents} >= 0 AND ${table.eligibleSapCents} >= 0`),
]);

export const orderTasks = sqliteTable("order_tasks", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  catalogTaskId: text("catalog_task_id").references(() => catalogTasks.id),
  codeSnapshot: text("code_snapshot").notNull(),
  labelSnapshot: text("label_snapshot").notNull(),
  priority: integer("priority").notNull().default(0),
  measurementSnapshot: json<Record<string, unknown>>("measurement_snapshot").notNull(),
  priceImpactTtcCents: integer("price_impact_ttc_cents").notNull().default(0),
}, (table) => [
  uniqueIndex("uq_order_tasks_code").on(table.orderId, table.codeSnapshot),
  index("idx_order_tasks_priority").on(table.orderId, table.priority),
]);

export const orderStatusHistory = sqliteTable("order_status_history", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  reason: text("reason"),
  actorUserId: text("actor_user_id").references(() => users.id),
  metadata: json<Record<string, unknown>>("metadata_json"),
  createdAt: createdAt(),
}, (table) => [index("idx_order_status_history_order").on(table.orderId, table.createdAt)]);

export const scheduleReservations = sqliteTable("schedule_reservations", {
  id: text("id").primaryKey(),
  quoteId: text("quote_id").references(() => quotes.id),
  orderId: text("order_id").references(() => orders.id),
  kind: text("kind", { enum: ["HOLD", "ORDER", "BLOCK"] }).notNull(),
  status: text("status", { enum: ["ACTIVE", "RELEASED", "EXPIRED", "CANCELLED"] }).notNull().default("ACTIVE"),
  expiresAt: text("expires_at"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_schedule_reservations_idempotency").on(table.idempotencyKey),
  index("idx_schedule_reservations_quote").on(table.quoteId),
  index("idx_schedule_reservations_order").on(table.orderId),
  index("idx_schedule_reservations_expiry").on(table.status, table.expiresAt),
  check("ck_schedule_reservations_target", sql`${table.quoteId} IS NOT NULL OR ${table.orderId} IS NOT NULL OR ${table.kind} = 'BLOCK'`),
]);

export const scheduleReservationSlots = sqliteTable("schedule_reservation_slots", {
  id: text("id").primaryKey(),
  reservationId: text("reservation_id").notNull().references(() => scheduleReservations.id, { onDelete: "cascade" }),
  teamId: text("team_id").notNull().references(() => teams.id),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  status: text("status", { enum: ["ACTIVE", "RELEASED"] }).notNull().default("ACTIVE"),
}, (table) => [
  uniqueIndex("uq_schedule_slots_team_start_active").on(table.teamId, table.startsAt).where(sql`${table.status} = 'ACTIVE'`),
  uniqueIndex("uq_schedule_slots_reservation_start").on(table.reservationId, table.startsAt),
  index("idx_schedule_slots_range").on(table.teamId, table.startsAt, table.endsAt),
  check("ck_schedule_slots_range", sql`${table.endsAt} > ${table.startsAt}`),
]);

export const orderAssignments = sqliteTable("order_assignments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  teamId: text("team_id").notNull().references(() => teams.id),
  assignedByUserId: text("assigned_by_user_id").notNull().references(() => users.id),
  reason: text("reason"),
  startsAt: text("starts_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  endsAt: text("ends_at"),
}, (table) => [
  uniqueIndex("uq_order_assignments_current").on(table.orderId).where(sql`${table.endsAt} IS NULL`),
  index("idx_order_assignments_team_current").on(table.teamId, table.endsAt),
]);

export const interventions = sqliteTable("interventions", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  sequence: integer("sequence").notNull().default(1),
  teamId: text("team_id").notNull().references(() => teams.id),
  status: text("status", { enum: ["PLANNED", "TEAM_EN_ROUTE", "STARTED", "PAUSED", "COMPLETED", "REPORT_CLOSED"] }).notNull().default("PLANNED"),
  plannedStartsAt: text("planned_starts_at").notNull(),
  plannedEndsAt: text("planned_ends_at").notNull(),
  departedAt: text("departed_at"),
  arrivedAt: text("arrived_at"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
  actualMinutes: integer("actual_minutes"),
  missionSnapshot: json<Record<string, unknown>>("mission_snapshot").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_interventions_order_sequence").on(table.orderId, table.sequence),
  index("idx_interventions_team_planned").on(table.teamId, table.plannedStartsAt),
  index("idx_interventions_status_planned").on(table.status, table.plannedStartsAt),
  check("ck_interventions_planned_range", sql`${table.plannedEndsAt} > ${table.plannedStartsAt}`),
  check("ck_interventions_actual_minutes", sql`${table.actualMinutes} IS NULL OR ${table.actualMinutes} >= 0`),
]);

export const interventionTasks = sqliteTable("intervention_tasks", {
  id: text("id").primaryKey(),
  interventionId: text("intervention_id").notNull().references(() => interventions.id, { onDelete: "cascade" }),
  orderTaskId: text("order_task_id").notNull().references(() => orderTasks.id),
  status: text("status", { enum: ["TODO", "IN_PROGRESS", "DONE", "NOT_DONE", "BLOCKED"] }).notNull().default("TODO"),
  actualMeasurement: json<Record<string, unknown>>("actual_measurement_json"),
  notes: text("notes"),
  completedAt: text("completed_at"),
  completedByUserId: text("completed_by_user_id").references(() => users.id),
}, (table) => [
  uniqueIndex("uq_intervention_tasks_order_task").on(table.interventionId, table.orderTaskId),
  index("idx_intervention_tasks_status").on(table.interventionId, table.status),
]);

export const interventionEvents = sqliteTable("intervention_events", {
  id: text("id").primaryKey(),
  interventionId: text("intervention_id").notNull().references(() => interventions.id),
  eventType: text("event_type").notNull(),
  actorUserId: text("actor_user_id").references(() => users.id),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  publicNote: text("public_note"),
  internalNote: text("internal_note"),
  metadata: json<Record<string, unknown>>("metadata_json"),
}, (table) => [index("idx_intervention_events_timeline").on(table.interventionId, table.occurredAt)]);

export const interventionReports = sqliteTable("intervention_reports", {
  id: text("id").primaryKey(),
  interventionId: text("intervention_id").notNull().references(() => interventions.id),
  status: text("status", { enum: ["DRAFT", "READY_FOR_REVIEW", "CLOSED"] }).notNull().default("DRAFT"),
  customerSummary: text("customer_summary"),
  internalSummary: text("internal_summary"),
  incidentReported: bool("incident_reported"),
  incidentDetails: text("incident_details"),
  proposedTotalTtcCents: integer("proposed_total_ttc_cents"),
  closedByUserId: text("closed_by_user_id").references(() => users.id),
  closedAt: text("closed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_intervention_reports_intervention").on(table.interventionId),
  index("idx_intervention_reports_status").on(table.status, table.updatedAt),
  check("ck_intervention_reports_amount", sql`${table.proposedTotalTtcCents} IS NULL OR ${table.proposedTotalTtcCents} >= 0`),
]);

export const recurringPlans = sqliteTable("recurring_plans", {
  id: text("id").primaryKey(),
  customerUserId: text("customer_user_id").notNull().references(() => users.id),
  organizationId: text("organization_id").references(() => organizations.id),
  gardenId: text("garden_id").notNull().references(() => gardens.id),
  status: text("status", { enum: ["DRAFT", "ACTIVE", "PAUSED", "CANCELLED", "ENDED"] }).notNull().default("DRAFT"),
  frequency: text("frequency", { enum: ["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"] }).notNull(),
  intervalValue: integer("interval_value").notNull().default(1),
  preferredPeriod: text("preferred_period", { enum: ["MORNING", "AFTERNOON", "ANY"] }).notNull().default("ANY"),
  templateSnapshot: json<Record<string, unknown>>("template_snapshot").notNull(),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  nextOccurrenceOn: text("next_occurrence_on"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("idx_recurring_plans_due").on(table.status, table.nextOccurrenceOn),
  index("idx_recurring_plans_customer").on(table.customerUserId, table.status),
  check("ck_recurring_plans_interval", sql`${table.intervalValue} >= 1`),
]);

export const recurringOccurrences = sqliteTable("recurring_occurrences", {
  id: text("id").primaryKey(),
  recurringPlanId: text("recurring_plan_id").notNull().references(() => recurringPlans.id),
  occurrenceDate: text("occurrence_date").notNull(),
  orderId: text("order_id").references(() => orders.id),
  status: text("status", { enum: ["PENDING", "ORDER_CREATED", "SKIPPED", "FAILED"] }).notNull().default("PENDING"),
  lastError: text("last_error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_recurring_occurrences_plan_date").on(table.recurringPlanId, table.occurrenceDate),
  index("idx_recurring_occurrences_status_date").on(table.status, table.occurrenceDate),
]);

export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  customerUserId: text("customer_user_id").notNull().references(() => users.id),
  organizationId: text("organization_id").references(() => organizations.id),
  kind: text("kind", { enum: ["INVOICE", "CREDIT_NOTE"] }).notNull(),
  originalInvoiceId: text("original_invoice_id").references((): AnySQLiteColumn => invoices.id),
  status: text("status", { enum: ["DRAFT", "ISSUED", "PAYMENT_PENDING", "PARTIALLY_PAID", "PAID", "OVERDUE", "CREDITED", "CANCELLED_BEFORE_ISSUE"] }).notNull().default("DRAFT"),
  number: text("number"),
  series: text("series").notNull(),
  sequenceNumber: integer("sequence_number"),
  issueDate: text("issue_date"),
  servicePeriodStart: text("service_period_start"),
  servicePeriodEnd: text("service_period_end"),
  sellerSnapshot: json<Record<string, unknown>>("seller_snapshot").notNull(),
  customerSnapshot: json<Record<string, unknown>>("customer_snapshot").notNull(),
  serviceAddressSnapshot: json<Record<string, unknown>>("service_address_snapshot").notNull(),
  subtotalHtCents: integer("subtotal_ht_cents").notNull(),
  vatCents: integer("vat_cents").notNull(),
  totalTtcCents: integer("total_ttc_cents").notNull(),
  eligibleSapCents: integer("eligible_sap_cents").notNull().default(0),
  paidCents: integer("paid_cents").notNull().default(0),
  paymentMethod: text("payment_method", { enum: ["STRIPE", "AICI", "MANUAL"] }).notNull(),
  structuredData: json<Record<string, unknown>>("structured_data").notNull(),
  documentHash: text("document_hash"),
  pdfFileId: text("pdf_file_id"),
  issuedAt: text("issued_at"),
  paidAt: text("paid_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_invoices_number").on(table.number).where(sql`${table.number} IS NOT NULL`),
  uniqueIndex("uq_invoices_series_sequence").on(table.series, table.sequenceNumber).where(sql`${table.sequenceNumber} IS NOT NULL`),
  index("idx_invoices_customer_issue").on(table.customerUserId, table.issueDate),
  index("idx_invoices_status_issue").on(table.status, table.issueDate),
  index("idx_invoices_order").on(table.orderId),
  check("ck_invoices_amounts", sql`${table.subtotalHtCents} >= 0 AND ${table.vatCents} >= 0 AND ${table.totalTtcCents} >= 0 AND ${table.eligibleSapCents} >= 0 AND ${table.paidCents} >= 0`),
  check("ck_invoices_credit_link", sql`(${table.kind} = 'CREDIT_NOTE' AND ${table.originalInvoiceId} IS NOT NULL) OR (${table.kind} = 'INVOICE' AND ${table.originalInvoiceId} IS NULL)`),
]);

export const invoiceLines = sqliteTable("invoice_lines", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  description: text("description").notNull(),
  quantityMilliunits: integer("quantity_milliunits").notNull().default(1000),
  unitLabel: text("unit_label").notNull().default("forfait"),
  unitPriceHtCents: integer("unit_price_ht_cents").notNull(),
  vatRateBasisPoints: integer("vat_rate_basis_points").notNull(),
  lineHtCents: integer("line_ht_cents").notNull(),
  lineVatCents: integer("line_vat_cents").notNull(),
  lineTtcCents: integer("line_ttc_cents").notNull(),
  eligibleSap: integer("eligible_sap", { mode: "boolean" }).notNull().default(false),
  sourceOrderTaskId: text("source_order_task_id").references(() => orderTasks.id),
}, (table) => [
  uniqueIndex("uq_invoice_lines_position").on(table.invoiceId, table.position),
  check("ck_invoice_lines_quantity", sql`${table.quantityMilliunits} > 0`),
  check("ck_invoice_lines_amounts", sql`${table.unitPriceHtCents} >= 0 AND ${table.lineHtCents} >= 0 AND ${table.lineVatCents} >= 0 AND ${table.lineTtcCents} >= 0`),
]);

export const invoiceCounters = sqliteTable("invoice_counters", {
  series: text("series").notNull(),
  year: integer("year").notNull(),
  lastNumber: integer("last_number").notNull().default(0),
  updatedAt: updatedAt(),
}, (table) => [
  primaryKey({ columns: [table.series, table.year], name: "pk_invoice_counters" }),
  check("ck_invoice_counters_number", sql`${table.lastNumber} >= 0`),
]);

export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id),
  invoiceId: text("invoice_id").references(() => invoices.id),
  method: text("method", { enum: ["STRIPE", "AICI", "MANUAL"] }).notNull(),
  kind: text("kind", { enum: ["SETUP", "CHARGE", "GUARANTEE", "ADJUSTMENT"] }).notNull(),
  status: text("status", { enum: ["CREATED", "PENDING", "REQUIRES_ACTION", "SUCCEEDED", "FAILED", "CANCELLED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  providerReference: text("provider_reference"),
  idempotencyKey: text("idempotency_key").notNull(),
  failureCode: text("failure_code"),
  failureMessageSafe: text("failure_message_safe"),
  requiresActionUrl: text("requires_action_url"),
  succeededAt: text("succeeded_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_payments_idempotency").on(table.idempotencyKey),
  uniqueIndex("uq_payments_provider_reference").on(table.method, table.providerReference).where(sql`${table.providerReference} IS NOT NULL`),
  index("idx_payments_order_created").on(table.orderId, table.createdAt),
  index("idx_payments_status_updated").on(table.status, table.updatedAt),
  check("ck_payments_amount", sql`${table.amountCents} >= 0`),
]);

export const refunds = sqliteTable("refunds", {
  id: text("id").primaryKey(),
  paymentId: text("payment_id").notNull().references(() => payments.id),
  amountCents: integer("amount_cents").notNull(),
  status: text("status", { enum: ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"] }).notNull(),
  reason: text("reason").notNull(),
  providerReference: text("provider_reference"),
  idempotencyKey: text("idempotency_key").notNull(),
  createdByUserId: text("created_by_user_id").references(() => users.id),
  succeededAt: text("succeeded_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_refunds_idempotency").on(table.idempotencyKey),
  uniqueIndex("uq_refunds_provider_reference").on(table.providerReference).where(sql`${table.providerReference} IS NOT NULL`),
  index("idx_refunds_payment").on(table.paymentId, table.createdAt),
  check("ck_refunds_amount", sql`${table.amountCents} > 0`),
]);

export const aiciCustomers = sqliteTable("aici_customers", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  status: text("status", { enum: ["NOT_STARTED", "REGISTRATION_PENDING", "ACTION_REQUIRED", "ACTIVE", "REJECTED", "SUSPENDED"] }).notNull().default("NOT_STARTED"),
  urssafCustomerReference: text("urssaf_customer_reference"),
  encryptedRegistrationData: text("encrypted_registration_data"),
  encryptionKeyVersion: text("encryption_key_version"),
  consentAt: text("consent_at"),
  activatedAt: text("activated_at"),
  lastSynchronizedAt: text("last_synchronized_at"),
  lastErrorCode: text("last_error_code"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_aici_customers_user").on(table.userId),
  uniqueIndex("uq_aici_customers_reference").on(table.urssafCustomerReference).where(sql`${table.urssafCustomerReference} IS NOT NULL`),
  index("idx_aici_customers_status").on(table.status, table.updatedAt),
]);

export const aiciPaymentRequests = sqliteTable("aici_payment_requests", {
  id: text("id").primaryKey(),
  aiciCustomerId: text("aici_customer_id").notNull().references(() => aiciCustomers.id),
  orderId: text("order_id").notNull().references(() => orders.id),
  invoiceId: text("invoice_id").notNull().references(() => invoices.id),
  status: text("status", { enum: ["CREATED", "SUBMITTED", "CUSTOMER_ACTION_REQUIRED", "ACCEPTED", "REJECTED", "PAID", "CANCELLED"] }).notNull().default("CREATED"),
  eligibleAmountCents: integer("eligible_amount_cents").notNull(),
  customerChargeCents: integer("customer_charge_cents").notNull(),
  taxCreditCents: integer("tax_credit_cents").notNull(),
  providerReference: text("provider_reference"),
  idempotencyKey: text("idempotency_key").notNull(),
  submittedAt: text("submitted_at"),
  settledAt: text("settled_at"),
  rejectionCode: text("rejection_code"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_aici_payment_requests_idempotency").on(table.idempotencyKey),
  uniqueIndex("uq_aici_payment_requests_provider").on(table.providerReference).where(sql`${table.providerReference} IS NOT NULL`),
  index("idx_aici_payment_requests_status").on(table.status, table.updatedAt),
  index("idx_aici_payment_requests_invoice").on(table.invoiceId),
  check("ck_aici_payment_requests_amounts", sql`${table.eligibleAmountCents} >= 0 AND ${table.customerChargeCents} >= 0 AND ${table.taxCreditCents} >= 0 AND ${table.customerChargeCents} + ${table.taxCreditCents} = ${table.eligibleAmountCents}`),
]);

export const providerEvents = sqliteTable("provider_events", {
  id: text("id").primaryKey(),
  provider: text("provider", { enum: ["STRIPE", "URSSAF", "RESEND", "E_INVOICING"] }).notNull(),
  providerEventId: text("provider_event_id").notNull(),
  eventType: text("event_type").notNull(),
  signatureVerified: integer("signature_verified", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["RECEIVED", "PROCESSING", "PROCESSED", "IGNORED", "FAILED"] }).notNull().default("RECEIVED"),
  payload: json<Record<string, unknown>>("payload_json").notNull(),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("next_attempt_at"),
  processedAt: text("processed_at"),
  lastErrorSafe: text("last_error_safe"),
  receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("uq_provider_events_provider_id").on(table.provider, table.providerEventId),
  index("idx_provider_events_pending").on(table.status, table.nextAttemptAt),
  check("ck_provider_events_attempts", sql`${table.attempts} >= 0`),
]);

export const storedFiles = sqliteTable("stored_files", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id").references(() => users.id),
  organizationId: text("organization_id").references(() => organizations.id),
  gardenId: text("garden_id").references(() => gardens.id),
  orderId: text("order_id").references(() => orders.id),
  interventionId: text("intervention_id").references(() => interventions.id),
  invoiceId: text("invoice_id").references(() => invoices.id),
  kind: text("kind", { enum: ["CUSTOMER_PHOTO", "BEFORE_PHOTO", "AFTER_PHOTO", "INVOICE_PDF", "CREDIT_NOTE_PDF", "TAX_CERTIFICATE", "EXPORT", "ATTACHMENT"] }).notNull(),
  storageKey: text("storage_key").notNull(),
  originalName: text("original_name").notNull(),
  mediaType: text("media_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  sha256: text("sha256").notNull(),
  status: text("status", { enum: ["PENDING", "AVAILABLE", "QUARANTINED", "DELETED"] }).notNull().default("PENDING"),
  uploadedByUserId: text("uploaded_by_user_id").references(() => users.id),
  retentionUntil: text("retention_until"),
  deletedAt: text("deleted_at"),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex("uq_stored_files_storage_key").on(table.storageKey),
  index("idx_stored_files_owner").on(table.ownerUserId, table.createdAt),
  index("idx_stored_files_order_kind").on(table.orderId, table.kind),
  index("idx_stored_files_intervention_kind").on(table.interventionId, table.kind),
  index("idx_stored_files_retention").on(table.status, table.retentionUntil),
  check("ck_stored_files_size", sql`${table.sizeBytes} >= 0`),
  check("ck_stored_files_parent", sql`${table.ownerUserId} IS NOT NULL OR ${table.organizationId} IS NOT NULL OR ${table.orderId} IS NOT NULL OR ${table.interventionId} IS NOT NULL OR ${table.invoiceId} IS NOT NULL`),
]);

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: text("id").primaryKey(),
  channel: text("channel", { enum: ["EMAIL", "SMS"] }).notNull(),
  template: text("template").notNull(),
  templateVersion: integer("template_version").notNull(),
  recipient: text("recipient").notNull(),
  userId: text("user_id").references(() => users.id),
  orderId: text("order_id").references(() => orders.id),
  invoiceId: text("invoice_id").references(() => invoices.id),
  payload: json<Record<string, unknown>>("payload_json").notNull(),
  status: text("status", { enum: ["PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"] }).notNull().default("PENDING"),
  attempts: integer("attempts").notNull().default(0),
  nextAttemptAt: text("next_attempt_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  providerReference: text("provider_reference"),
  idempotencyKey: text("idempotency_key").notNull(),
  lastErrorSafe: text("last_error_safe"),
  sentAt: text("sent_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_notification_outbox_idempotency").on(table.idempotencyKey),
  index("idx_notification_outbox_pending").on(table.status, table.nextAttemptAt),
  index("idx_notification_outbox_user").on(table.userId, table.createdAt),
  check("ck_notification_outbox_attempts", sql`${table.attempts} >= 0`),
]);

export const idempotencyKeys = sqliteTable("idempotency_keys", {
  id: text("id").primaryKey(),
  scope: text("scope").notNull(),
  key: text("key").notNull(),
  requestHash: text("request_hash").notNull(),
  status: text("status", { enum: ["PROCESSING", "COMPLETED", "FAILED"] }).notNull().default("PROCESSING"),
  responseStatus: integer("response_status"),
  responseBody: json<Record<string, unknown>>("response_body_json"),
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  expiresAt: text("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("uq_idempotency_keys_scope_key").on(table.scope, table.key),
  index("idx_idempotency_keys_expiry").on(table.expiresAt),
]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  actorUserId: text("actor_user_id").references(() => users.id),
  actorType: text("actor_type", { enum: ["USER", "SYSTEM", "PROVIDER"] }).notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  requestId: text("request_id"),
  ipHash: text("ip_hash"),
  before: json<Record<string, unknown>>("before_json"),
  after: json<Record<string, unknown>>("after_json"),
  metadata: json<Record<string, unknown>>("metadata_json"),
}, (table) => [
  index("idx_audit_events_entity").on(table.entityType, table.entityId, table.occurredAt),
  index("idx_audit_events_actor").on(table.actorUserId, table.occurredAt),
  index("idx_audit_events_action").on(table.action, table.occurredAt),
]);
