import { getDatabase } from "@/db/runtime";
import type { PreparedStatement } from "@/db/database";

export type CustomerType = "INDIVIDUAL" | "PROFESSIONAL";
export type TerrainSlope = "FLAT" | "GENTLE" | "STEEP" | "UNKNOWN";

export type CustomerProfile = {
  fullName: string;
  email: string;
  phone: string | null;
  customerType: CustomerType;
  organization: null | {
    legalName: string;
    tradeName: string | null;
    siren: string | null;
    vatNumber: string | null;
    billingEmail: string;
    billingAddress: AddressInput;
  };
};

export type AddressInput = {
  label: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
};

export type Garden = AddressInput & {
  id: string;
  label: string;
  addressLabel: string | null;
  surfaceM2: number | null;
  terrainSlope: TerrainSlope;
  accessWidthCm: number | null;
  hasAnimals: boolean;
  parkingNotes: string | null;
  publicNotes: string | null;
};

export class CustomerInputError extends Error {
  constructor(public code: string, public fields: Record<string, string> = {}) {
    super(code);
  }
}

export class CustomerConflictError extends Error {}
export class CustomerNotFoundError extends Error {}

function textValue(value: unknown, max: number, required = false): string | null {
  if (typeof value !== "string") return required ? null : null;
  const clean = value.trim().replace(/\s+/gu, " ");
  if (!clean) return required ? null : null;
  return clean.length <= max ? clean : null;
}

function requiredText(value: unknown, field: string, max: number, fields: Record<string, string>): string {
  const clean = textValue(value, max, true);
  if (!clean) fields[field] = `Ce champ est requis (maximum ${max} caractères).`;
  return clean ?? "";
}

function optionalText(value: unknown, field: string, max: number, fields: Record<string, string>): string | null {
  if (value === null || value === undefined || value === "") return null;
  const clean = textValue(value, max);
  if (!clean) fields[field] = `Maximum ${max} caractères.`;
  return clean;
}

function normalizePhone(value: unknown, fields: Record<string, string>): string | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const clean = String(value).trim();
  const digits = clean.replace(/\D/gu, "");
  if (!/^[+\d][\d .()-]*$/u.test(clean) || digits.length < 8 || digits.length > 15) {
    fields.phone = "Saisissez un numéro de téléphone valide.";
    return null;
  }
  return clean;
}

function normalizeEmail(value: unknown, field: string, fields: Record<string, string>): string {
  const clean = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(clean) || clean.length > 254) {
    fields[field] = "Saisissez une adresse email valide.";
  }
  return clean;
}

function normalizeAddress(input: unknown, prefix = "address"): AddressInput {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const fields: Record<string, string> = {};
  const line1 = requiredText(value.line1, `${prefix}.line1`, 160, fields);
  const line2 = optionalText(value.line2, `${prefix}.line2`, 160, fields);
  const postalCode = String(value.postalCode ?? "").replace(/\s/gu, "");
  if (!/^\d{5}$/u.test(postalCode)) fields[`${prefix}.postalCode`] = "Saisissez un code postal français à 5 chiffres.";
  const city = requiredText(value.city, `${prefix}.city`, 100, fields);
  const label = optionalText(value.label, `${prefix}.label`, 80, fields);
  if (Object.keys(fields).length) throw new CustomerInputError("ADDRESS_INVALID", fields);
  return { label, line1, line2, postalCode, city };
}

function departmentCode(postalCode: string): string {
  if (postalCode.startsWith("20")) return Number(postalCode.slice(0, 3)) < 202 ? "2A" : "2B";
  return postalCode.slice(0, 2);
}

export async function getCustomerWorkspace(userId: string): Promise<{ profile: CustomerProfile; gardens: Garden[] }> {
  const db = getDatabase();
  const [profileRow, gardensResult] = await Promise.all([
    db.prepare(`
      SELECT u.full_name AS fullName, u.email, u.phone,
             COALESCE(cp.customer_type, 'INDIVIDUAL') AS customerType,
             o.legal_name AS legalName, o.trade_name AS tradeName, o.siren, o.vat_number AS vatNumber,
             o.billing_email AS billingEmail, o.billing_address_snapshot AS billingAddress
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      LEFT JOIN organization_memberships om ON om.user_id = u.id AND om.role = 'ADMIN'
      LEFT JOIN organizations o ON o.id = om.organization_id AND o.status = 'ACTIVE'
      WHERE u.id = ?
      ORDER BY o.created_at DESC
      LIMIT 1
    `).bind(userId).first<Record<string, unknown>>(),
    db.prepare(`
      SELECT g.id, g.label, g.surface_m2 AS surfaceM2, g.terrain_slope AS terrainSlope,
             g.access_width_cm AS accessWidthCm, g.has_animals AS hasAnimals,
             g.parking_notes AS parkingNotes, g.public_notes AS publicNotes,
             a.label AS addressLabel, a.line1, a.line2, a.postal_code AS postalCode, a.city
      FROM gardens g JOIN addresses a ON a.id = g.address_id
      WHERE g.owner_user_id = ? AND g.archived_at IS NULL
      ORDER BY g.created_at DESC
    `).bind(userId).all<Record<string, unknown>>(),
  ]);
  if (!profileRow) throw new CustomerNotFoundError("CUSTOMER_NOT_FOUND");
  let billingAddress: AddressInput | null = null;
  if (typeof profileRow.billingAddress === "string") {
    try { billingAddress = JSON.parse(profileRow.billingAddress) as AddressInput; } catch { billingAddress = null; }
  } else if (profileRow.billingAddress && typeof profileRow.billingAddress === "object") {
    billingAddress = profileRow.billingAddress as AddressInput;
  }
  return {
    profile: {
      fullName: String(profileRow.fullName), email: String(profileRow.email),
      phone: profileRow.phone ? String(profileRow.phone) : null,
      customerType: profileRow.customerType === "PROFESSIONAL" ? "PROFESSIONAL" : "INDIVIDUAL",
      organization: profileRow.legalName && billingAddress ? {
        legalName: String(profileRow.legalName), tradeName: profileRow.tradeName ? String(profileRow.tradeName) : null,
        siren: profileRow.siren ? String(profileRow.siren) : null,
        vatNumber: profileRow.vatNumber ? String(profileRow.vatNumber) : null,
        billingEmail: String(profileRow.billingEmail), billingAddress,
      } : null,
    },
    gardens: gardensResult.results.map((row) => ({
      id: String(row.id), label: String(row.label), addressLabel: row.addressLabel ? String(row.addressLabel) : null,
      line1: String(row.line1), line2: row.line2 ? String(row.line2) : null,
      postalCode: String(row.postalCode), city: String(row.city),
      surfaceM2: row.surfaceM2 === null ? null : Number(row.surfaceM2),
      terrainSlope: ["FLAT", "GENTLE", "STEEP"].includes(String(row.terrainSlope)) ? row.terrainSlope as TerrainSlope : "UNKNOWN",
      accessWidthCm: row.accessWidthCm === null ? null : Number(row.accessWidthCm),
      hasAnimals: Boolean(row.hasAnimals), parkingNotes: row.parkingNotes ? String(row.parkingNotes) : null,
      publicNotes: row.publicNotes ? String(row.publicNotes) : null,
    })),
  };
}

export async function updateCustomerProfile(userId: string, input: unknown): Promise<CustomerProfile> {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const fields: Record<string, string> = {};
  const fullName = requiredText(value.fullName, "fullName", 120, fields);
  if (fullName && fullName.length < 2) fields.fullName = "Saisissez votre nom complet.";
  const phone = normalizePhone(value.phone, fields);
  const customerType: CustomerType = value.customerType === "PROFESSIONAL" ? "PROFESSIONAL" : "INDIVIDUAL";
  if (!["INDIVIDUAL", "PROFESSIONAL"].includes(String(value.customerType))) fields.customerType = "Choisissez particulier ou professionnel.";
  let organization: { legalName: string; tradeName: string | null; siren: string | null; vatNumber: string | null; billingEmail: string; billingAddress: AddressInput } | null = null;
  if (customerType === "PROFESSIONAL") {
    const rawOrg = value.organization && typeof value.organization === "object" ? value.organization as Record<string, unknown> : {};
    const legalName = requiredText(rawOrg.legalName, "organization.legalName", 160, fields);
    const tradeName = optionalText(rawOrg.tradeName, "organization.tradeName", 160, fields);
    const sirenRaw = String(rawOrg.siren ?? "").replace(/\s/gu, "");
    const siren = sirenRaw || null;
    if (siren && !/^\d{9}$/u.test(siren)) fields["organization.siren"] = "Le SIREN doit contenir 9 chiffres.";
    const vatRaw = String(rawOrg.vatNumber ?? "").replace(/[\s.-]/gu, "").toUpperCase();
    const vatNumber = vatRaw || null;
    if (vatNumber && !/^FR[0-9A-Z]{2}\d{9}$/u.test(vatNumber)) fields["organization.vatNumber"] = "Saisissez un numéro de TVA français valide.";
    const billingEmail = normalizeEmail(rawOrg.billingEmail, "organization.billingEmail", fields);
    let billingAddress: AddressInput | null = null;
    try { billingAddress = normalizeAddress(rawOrg.billingAddress, "organization.billingAddress"); }
    catch (error) { if (error instanceof CustomerInputError) Object.assign(fields, error.fields); else throw error; }
    if (!Object.keys(fields).length && billingAddress) organization = { legalName, tradeName, siren, vatNumber, billingEmail, billingAddress };
  }
  if (Object.keys(fields).length) throw new CustomerInputError("PROFILE_INVALID", fields);

  const db = getDatabase();
  const statements: PreparedStatement[] = [
    db.prepare(`UPDATE users SET full_name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(fullName, phone, userId),
    db.prepare(`
      INSERT INTO customer_profiles (user_id, customer_type) VALUES (?, ?)
      ON CONFLICT(user_id) DO UPDATE SET customer_type = excluded.customer_type, updated_at = CURRENT_TIMESTAMP
    `).bind(userId, customerType),
  ];
  if (organization) {
    const existing = await db.prepare(`
      SELECT o.id FROM organizations o JOIN organization_memberships om ON om.organization_id = o.id
      WHERE om.user_id = ? AND om.role = 'ADMIN' ORDER BY o.created_at DESC LIMIT 1
    `).bind(userId).first<{ id: string }>();
    const organizationId = existing?.id ?? crypto.randomUUID();
    if (existing) {
      statements.push(db.prepare(`
        UPDATE organizations SET legal_name = ?, trade_name = ?, siren = ?, vat_number = ?, billing_email = ?,
          billing_address_snapshot = ?, status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(organization.legalName, organization.tradeName, organization.siren, organization.vatNumber, organization.billingEmail, JSON.stringify(organization.billingAddress), organizationId));
    } else {
      statements.push(
        db.prepare(`INSERT INTO organizations (id, legal_name, trade_name, siren, vat_number, billing_email, billing_address_snapshot) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(organizationId, organization.legalName, organization.tradeName, organization.siren, organization.vatNumber, organization.billingEmail, JSON.stringify(organization.billingAddress)),
        db.prepare(`INSERT INTO organization_memberships (organization_id, user_id, role) VALUES (?, ?, 'ADMIN')`).bind(organizationId, userId),
      );
    }
    statements.push(db.prepare(`INSERT OR IGNORE INTO user_roles (user_id, role) VALUES (?, 'PRO_CUSTOMER_ADMIN')`).bind(userId));
  } else {
    statements.push(db.prepare(`DELETE FROM user_roles WHERE user_id = ? AND role = 'PRO_CUSTOMER_ADMIN'`).bind(userId));
  }
  statements.push(db.prepare(`
    INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id, metadata_json)
    VALUES (?, ?, 'USER', 'CUSTOMER_PROFILE_UPDATED', 'user', ?, ?)
  `).bind(crypto.randomUUID(), userId, userId, JSON.stringify({ customerType })));
  try { await db.batch(statements); }
  catch (error) {
    if (String(error).includes("UNIQUE") && String(error).includes("organizations.siren")) throw new CustomerConflictError("SIREN_ALREADY_USED");
    throw error;
  }
  return (await getCustomerWorkspace(userId)).profile;
}

function normalizeGarden(input: unknown): Omit<Garden, "id"> {
  const value = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const fields: Record<string, string> = {};
  const label = requiredText(value.label, "label", 80, fields);
  let address: AddressInput = { label: null, line1: "", line2: null, postalCode: "", city: "" };
  try { address = normalizeAddress(value.address); }
  catch (error) { if (error instanceof CustomerInputError) Object.assign(fields, error.fields); else throw error; }
  const surfaceRaw = value.surfaceM2 === "" || value.surfaceM2 === null || value.surfaceM2 === undefined ? null : Number(value.surfaceM2);
  const surfaceM2 = surfaceRaw === null ? null : Math.round(surfaceRaw);
  if (surfaceM2 !== null && (!Number.isFinite(surfaceM2) || surfaceM2 < 0 || surfaceM2 > 1_000_000)) fields.surfaceM2 = "La surface doit être comprise entre 0 et 1 000 000 m².";
  const terrainSlope: TerrainSlope = ["FLAT", "GENTLE", "STEEP", "UNKNOWN"].includes(String(value.terrainSlope)) ? value.terrainSlope as TerrainSlope : "UNKNOWN";
  const accessRaw = value.accessWidthCm === "" || value.accessWidthCm === null || value.accessWidthCm === undefined ? null : Number(value.accessWidthCm);
  const accessWidthCm = accessRaw === null ? null : Math.round(accessRaw);
  if (accessWidthCm !== null && (!Number.isFinite(accessWidthCm) || accessWidthCm < 30 || accessWidthCm > 2000)) fields.accessWidthCm = "La largeur doit être comprise entre 30 et 2 000 cm.";
  const parkingNotes = optionalText(value.parkingNotes, "parkingNotes", 500, fields);
  const publicNotes = optionalText(value.publicNotes, "publicNotes", 1000, fields);
  if (Object.keys(fields).length) throw new CustomerInputError("GARDEN_INVALID", fields);
  return { label, addressLabel: address.label, line1: address.line1, line2: address.line2, postalCode: address.postalCode, city: address.city, surfaceM2, terrainSlope, accessWidthCm, hasAnimals: value.hasAnimals === true, parkingNotes, publicNotes };
}

export async function createGarden(userId: string, input: unknown): Promise<Garden> {
  const data = normalizeGarden(input);
  const db = getDatabase();
  const gardenId = crypto.randomUUID();
  const addressId = crypto.randomUUID();
  await db.batch([
    db.prepare(`INSERT INTO addresses (id, owner_user_id, kind, label, line1, line2, postal_code, city, department_code, country_code) VALUES (?, ?, 'SERVICE', ?, ?, ?, ?, ?, ?, 'FR')`)
      .bind(addressId, userId, data.addressLabel, data.line1, data.line2, data.postalCode, data.city, departmentCode(data.postalCode)),
    db.prepare(`INSERT INTO gardens (id, owner_user_id, address_id, label, surface_m2, terrain_slope, access_width_cm, has_animals, parking_notes, public_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(gardenId, userId, addressId, data.label, data.surfaceM2, data.terrainSlope, data.accessWidthCm, data.hasAnimals ? 1 : 0, data.parkingNotes, data.publicNotes),
    db.prepare(`INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id) VALUES (?, ?, 'USER', 'GARDEN_CREATED', 'garden', ?)`)
      .bind(crypto.randomUUID(), userId, gardenId),
  ]);
  return { id: gardenId, ...data };
}

export async function updateGarden(userId: string, gardenId: string, input: unknown): Promise<Garden> {
  if (!/^[a-f0-9-]{20,50}$/iu.test(gardenId)) throw new CustomerNotFoundError("GARDEN_NOT_FOUND");
  const data = normalizeGarden(input);
  const db = getDatabase();
  const owned = await db.prepare(`SELECT address_id AS addressId FROM gardens WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL LIMIT 1`).bind(gardenId, userId).first<{ addressId: string }>();
  if (!owned) throw new CustomerNotFoundError("GARDEN_NOT_FOUND");
  await db.batch([
    db.prepare(`UPDATE addresses SET label = ?, line1 = ?, line2 = ?, postal_code = ?, city = ?, department_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?`)
      .bind(data.addressLabel, data.line1, data.line2, data.postalCode, data.city, departmentCode(data.postalCode), owned.addressId, userId),
    db.prepare(`UPDATE gardens SET label = ?, surface_m2 = ?, terrain_slope = ?, access_width_cm = ?, has_animals = ?, parking_notes = ?, public_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL`)
      .bind(data.label, data.surfaceM2, data.terrainSlope, data.accessWidthCm, data.hasAnimals ? 1 : 0, data.parkingNotes, data.publicNotes, gardenId, userId),
    db.prepare(`INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id) VALUES (?, ?, 'USER', 'GARDEN_UPDATED', 'garden', ?)`)
      .bind(crypto.randomUUID(), userId, gardenId),
  ]);
  return { id: gardenId, ...data };
}

export async function archiveGarden(userId: string, gardenId: string): Promise<void> {
  if (!/^[a-f0-9-]{20,50}$/iu.test(gardenId)) throw new CustomerNotFoundError("GARDEN_NOT_FOUND");
  const db = getDatabase();
  const exists = await db.prepare(`SELECT 1 AS found FROM gardens WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL`).bind(gardenId, userId).first<{ found: number }>();
  if (!exists) throw new CustomerNotFoundError("GARDEN_NOT_FOUND");
  const results = await db.batch([
    db.prepare(`UPDATE gardens SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ? AND archived_at IS NULL`).bind(gardenId, userId),
    db.prepare(`INSERT INTO audit_events (id, actor_user_id, actor_type, action, entity_type, entity_id) VALUES (?, ?, 'USER', 'GARDEN_ARCHIVED', 'garden', ?)`)
      .bind(crypto.randomUUID(), userId, gardenId),
  ]);
  if (Number(results[0]?.meta?.changes ?? 0) !== 1) throw new CustomerNotFoundError("GARDEN_NOT_FOUND");
}
