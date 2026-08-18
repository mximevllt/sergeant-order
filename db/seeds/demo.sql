-- DONNÉES STRICTEMENT FICTIVES — développement local uniquement.
-- Les identifiants, emails et références utilisent explicitement le préfixe demo.
INSERT OR IGNORE INTO users
  (id, email, email_normalized, email_verified_at, full_name, phone, status)
VALUES
  ('demo-customer', 'client.demo@sergeant-paysage.invalid', 'client.demo@sergeant-paysage.invalid', CURRENT_TIMESTAMP, '[DÉMO] Camille Jardin', '0600000000', 'ACTIVE'),
  ('demo-dispatcher', 'planning.demo@sergeant-paysage.invalid', 'planning.demo@sergeant-paysage.invalid', CURRENT_TIMESTAMP, '[DÉMO] Responsable planning', '0600000001', 'ACTIVE');

INSERT OR IGNORE INTO user_roles (user_id, role, granted_by_user_id) VALUES
  ('demo-customer', 'CUSTOMER', NULL),
  ('demo-dispatcher', 'DISPATCHER', NULL);

INSERT OR IGNORE INTO customer_profiles
  (user_id, customer_type, terms_accepted_at, privacy_accepted_at)
VALUES ('demo-customer', 'INDIVIDUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO addresses
  (id, owner_user_id, kind, label, line1, postal_code, city, insee_code, department_code, latitude_e6, longitude_e6, geocoding_precision, verified_at)
VALUES
  ('demo-address', 'demo-customer', 'SERVICE', 'Maison [DÉMO]', '28 rue Jules Ferry', '83170', 'Brignoles', '83023', '83', 43405400, 6061700, 'HOUSENUMBER', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO gardens
  (id, owner_user_id, address_id, label, surface_m2, terrain_slope, access_width_cm, has_animals, parking_notes, public_notes)
VALUES
  ('demo-garden', 'demo-customer', 'demo-address', 'Jardin principal [DÉMO]', 280, 'FLAT', 110, 0, 'Stationnement devant le portail.', 'Pelouse et haies accessibles.');

INSERT OR IGNORE INTO quotes
  (id, public_reference, customer_user_id, garden_id, pricing_version_id, status, contact_email, contact_phone,
   request_snapshot, pricing_snapshot, pricing_fingerprint, recommended_half_days, selected_half_days,
   subtotal_ht_cents, vat_cents, total_ttc_cents, eligible_sap_cents, expires_at, accepted_at)
VALUES
  ('demo-quote', 'DEVIS-DEMO-0001', 'demo-customer', 'demo-garden', 'pricing-2026-v1', 'ACCEPTED',
   'client.demo@sergeant-paysage.invalid', '0600000000',
   '{"demo":true,"tasks":["MOWING","HEDGE_TRIMMING"],"lawnSurfaceM2":280,"hedgeLengthM":18,"hedgeHeightBand":"FROM_1_5_TO_2M","hedgeFaces":"THREE_FACES"}',
   '{"version":1,"halfDayTtcCents":32900,"adjustmentsTtcCents":2200,"totalTtcCents":35100}',
   'demo-pricing-fingerprint-0001', 1, 1, 29250, 5850, 35100, 35100,
   '2099-01-01T00:00:00Z', CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO quote_tasks
  (id, quote_id, catalog_task_id, code_snapshot, label_snapshot, priority, measurement_json, price_impact_ttc_cents)
VALUES
  ('demo-quote-task-mowing', 'demo-quote', 'task-mowing', 'MOWING', 'Tonte', 1, '{"surfaceM2":280,"grassState":"MAINTAINED"}', 0),
  ('demo-quote-task-hedges', 'demo-quote', 'task-hedges', 'HEDGE_TRIMMING', 'Taille de haies', 2, '{"lengthM":18,"heightBand":"FROM_1_5_TO_2M","faces":"THREE_FACES"}', 2200);

INSERT OR IGNORE INTO orders
  (id, public_reference, quote_id, customer_user_id, garden_id, status, payment_method, pricing_snapshot,
   service_address_snapshot, billing_identity_snapshot, selected_half_days, subtotal_ht_cents, vat_cents,
   total_ttc_cents, eligible_sap_cents, confirmed_at)
VALUES
  ('demo-order', 'CMD-DEMO-0001', 'demo-quote', 'demo-customer', 'demo-garden', 'SCHEDULED', 'STRIPE',
   '{"version":1,"halfDayTtcCents":32900,"adjustmentsTtcCents":2200,"totalTtcCents":35100}',
   '{"line1":"28 rue Jules Ferry","postalCode":"83170","city":"Brignoles","countryCode":"FR"}',
   '{"name":"[DÉMO] Camille Jardin","email":"client.demo@sergeant-paysage.invalid"}',
   1, 29250, 5850, 35100, 35100, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO order_tasks
  (id, order_id, catalog_task_id, code_snapshot, label_snapshot, priority, measurement_snapshot, price_impact_ttc_cents)
VALUES
  ('demo-order-task-mowing', 'demo-order', 'task-mowing', 'MOWING', 'Tonte', 1, '{"surfaceM2":280,"grassState":"MAINTAINED"}', 0),
  ('demo-order-task-hedges', 'demo-order', 'task-hedges', 'HEDGE_TRIMMING', 'Taille de haies', 2, '{"lengthM":18,"heightBand":"FROM_1_5_TO_2M","faces":"THREE_FACES"}', 2200);

INSERT OR IGNORE INTO order_status_history
  (id, order_id, from_status, to_status, reason, actor_user_id)
VALUES
  ('demo-order-history-confirmed', 'demo-order', 'PENDING_PAYMENT_SETUP', 'CONFIRMED', 'Donnée de démonstration', 'demo-dispatcher'),
  ('demo-order-history-scheduled', 'demo-order', 'CONFIRMED', 'SCHEDULED', 'Donnée de démonstration', 'demo-dispatcher');

INSERT OR IGNORE INTO schedule_reservations
  (id, quote_id, order_id, kind, status, idempotency_key, created_by_user_id)
VALUES
  ('demo-reservation', 'demo-quote', 'demo-order', 'ORDER', 'ACTIVE', 'demo-schedule-reservation-0001', 'demo-dispatcher');

INSERT OR IGNORE INTO schedule_reservation_slots
  (id, reservation_id, team_id, starts_at, ends_at, status)
VALUES
  ('demo-slot', 'demo-reservation', 'team-1', '2099-01-05T07:00:00Z', '2099-01-05T11:00:00Z', 'ACTIVE');

INSERT OR IGNORE INTO order_assignments
  (id, order_id, team_id, assigned_by_user_id, reason)
VALUES
  ('demo-assignment', 'demo-order', 'team-1', 'demo-dispatcher', 'Affectation de démonstration');

INSERT OR IGNORE INTO interventions
  (id, order_id, sequence, team_id, status, planned_starts_at, planned_ends_at, mission_snapshot)
VALUES
  ('demo-intervention', 'demo-order', 1, 'team-1', 'PLANNED', '2099-01-05T07:00:00Z', '2099-01-05T11:00:00Z',
   '{"demo":true,"customer":"[DÉMO] Camille Jardin","garden":"Jardin principal [DÉMO]","tasks":["MOWING","HEDGE_TRIMMING"]}');

INSERT OR IGNORE INTO intervention_tasks
  (id, intervention_id, order_task_id, status)
VALUES
  ('demo-intervention-task-mowing', 'demo-intervention', 'demo-order-task-mowing', 'TODO'),
  ('demo-intervention-task-hedges', 'demo-intervention', 'demo-order-task-hedges', 'TODO');

INSERT OR IGNORE INTO audit_events
  (id, actor_user_id, actor_type, action, entity_type, entity_id, metadata_json)
VALUES
  ('demo-audit-seed', 'demo-dispatcher', 'SYSTEM', 'DEMO_DATA_CREATED', 'dataset', 'demo', '{"demo":true}');

PRAGMA optimize;
