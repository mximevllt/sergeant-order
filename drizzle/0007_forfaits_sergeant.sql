-- Nouveau barème forfaitaire : le déplacement est inclus dans la durée réservée.
UPDATE pricing_versions
SET status = 'ARCHIVED', updated_at = CURRENT_TIMESTAMP
WHERE status = 'ACTIVE';
--> statement-breakpoint
INSERT INTO pricing_versions
  (id, version, status, label, effective_from, half_day_ttc_cents, vat_rate_basis_points, currency, published_at)
VALUES
  ('pricing-2026-v2', 2, 'ACTIVE', 'Forfaits 2026 — déplacement inclus', '2026-09-07', 52000, 2000, 'EUR', CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT INTO pricing_rules
  (id, pricing_version_id, code, label, rule_type, priority, condition_json, calculation_json, active)
VALUES
  ('rule-package-2026-v2', 'pricing-2026-v2', 'PACKAGE', 'Forfait intervention TTC', 'BASE', 10, '{}', '{"operation":"map","field":"packageCode","amountsTtcCents":{"TWO_HOURS":35000,"HALF_DAY":52000,"FULL_DAY":98000,"TWO_DAYS":190000}}', 1);
