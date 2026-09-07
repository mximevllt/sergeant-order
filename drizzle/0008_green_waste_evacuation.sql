-- L'évacuation reste une option payante ; le broyage est l'alternative gratuite sur place.
INSERT INTO pricing_rules
  (id, pricing_version_id, code, label, rule_type, priority, condition_json, calculation_json, active)
VALUES
  ('rule-green-waste-2026-v2', 'pricing-2026-v2', 'GREEN_WASTE_1_TO_2M3', 'Évacuation de 1 à 2 m³', 'CONDITION', 20, '{"greenWaste":"REMOVE_1_TO_2M3"}', '{"operation":"fixed","amountTtcCents":2800}', 1);
