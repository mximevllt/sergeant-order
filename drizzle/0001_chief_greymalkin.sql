CREATE TABLE `business_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`trade_name` text NOT NULL,
	`legal_form` text NOT NULL,
	`registered_office_json` text NOT NULL,
	`siren` text NOT NULL,
	`siret` text NOT NULL,
	`vat_number` text NOT NULL,
	`share_capital_cents` integer NOT NULL,
	`registry` text NOT NULL,
	`vat_rate_basis_points` integer DEFAULT 2000 NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`timezone` text DEFAULT 'Europe/Paris' NOT NULL,
	`minimum_lead_hours` integer DEFAULT 24 NOT NULL,
	`maximum_advance_days` integer DEFAULT 31 NOT NULL,
	`workdays_json` text NOT NULL,
	`work_periods_json` text NOT NULL,
	`aici_enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ck_business_settings_capital" CHECK("business_settings"."share_capital_cents" >= 0),
	CONSTRAINT "ck_business_settings_vat" CHECK("business_settings"."vat_rate_basis_points" BETWEEN 0 AND 10000),
	CONSTRAINT "ck_business_settings_booking_window" CHECK("business_settings"."minimum_lead_hours" >= 0 AND "business_settings"."maximum_advance_days" >= 1)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_business_settings_siren` ON `business_settings` (`siren`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_business_settings_siret` ON `business_settings` (`siret`);
--> statement-breakpoint
INSERT OR IGNORE INTO `business_settings` (
	`id`, `legal_name`, `trade_name`, `legal_form`, `registered_office_json`,
	`siren`, `siret`, `vat_number`, `share_capital_cents`, `registry`,
	`vat_rate_basis_points`, `currency`, `timezone`, `minimum_lead_hours`,
	`maximum_advance_days`, `workdays_json`, `work_periods_json`, `aici_enabled`
) VALUES (
	'sergeant-paysage', 'SERGEANT PAYSAGE', 'SERGEANT PAYSAGE',
	'EURL — Entreprise unipersonnelle à responsabilité limitée',
	'{"line1":"22 chemin des Consacs","postalCode":"83170","city":"Brignoles","countryCode":"FR"}',
	'984585554', '98458555400020', 'FR71984585554', 500000,
	'984 585 554 R.C.S. Draguignan', 2000, 'EUR', 'Europe/Paris', 24, 31,
	'[1,2,3,4,5]',
	'[{"code":"MORNING","startsLocal":"08:00","endsLocal":"12:00"},{"code":"AFTERNOON","startsLocal":"13:00","endsLocal":"17:00"}]',
	1
);
--> statement-breakpoint
INSERT OR IGNORE INTO `teams` (`id`, `code`, `name`, `color`, `active`) VALUES
	('team-1', 'TEAM_1', 'Équipe 1', '#2f5a45', 1),
	('team-2', 'TEAM_2', 'Équipe 2', '#b66f3f', 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `team_weekly_hours`
	(`id`, `team_id`, `iso_weekday`, `period`, `starts_local`, `ends_local`, `active`) VALUES
	('team-1-d1-am', 'team-1', 1, 'MORNING', '08:00', '12:00', 1),
	('team-1-d1-pm', 'team-1', 1, 'AFTERNOON', '13:00', '17:00', 1),
	('team-1-d2-am', 'team-1', 2, 'MORNING', '08:00', '12:00', 1),
	('team-1-d2-pm', 'team-1', 2, 'AFTERNOON', '13:00', '17:00', 1),
	('team-1-d3-am', 'team-1', 3, 'MORNING', '08:00', '12:00', 1),
	('team-1-d3-pm', 'team-1', 3, 'AFTERNOON', '13:00', '17:00', 1),
	('team-1-d4-am', 'team-1', 4, 'MORNING', '08:00', '12:00', 1),
	('team-1-d4-pm', 'team-1', 4, 'AFTERNOON', '13:00', '17:00', 1),
	('team-1-d5-am', 'team-1', 5, 'MORNING', '08:00', '12:00', 1),
	('team-1-d5-pm', 'team-1', 5, 'AFTERNOON', '13:00', '17:00', 1),
	('team-2-d1-am', 'team-2', 1, 'MORNING', '08:00', '12:00', 1),
	('team-2-d1-pm', 'team-2', 1, 'AFTERNOON', '13:00', '17:00', 1),
	('team-2-d2-am', 'team-2', 2, 'MORNING', '08:00', '12:00', 1),
	('team-2-d2-pm', 'team-2', 2, 'AFTERNOON', '13:00', '17:00', 1),
	('team-2-d3-am', 'team-2', 3, 'MORNING', '08:00', '12:00', 1),
	('team-2-d3-pm', 'team-2', 3, 'AFTERNOON', '13:00', '17:00', 1),
	('team-2-d4-am', 'team-2', 4, 'MORNING', '08:00', '12:00', 1),
	('team-2-d4-pm', 'team-2', 4, 'AFTERNOON', '13:00', '17:00', 1),
	('team-2-d5-am', 'team-2', 5, 'MORNING', '08:00', '12:00', 1),
	('team-2-d5-pm', 'team-2', 5, 'AFTERNOON', '13:00', '17:00', 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `catalog_services`
	(`id`, `code`, `name`, `description`, `kind`, `active`, `sort_order`) VALUES
	('service-one-off', 'ONE_OFF_MAINTENANCE', 'Entretien ponctuel', 'Intervention réservée et tarifée à la demi-journée.', 'ONE_OFF', 1, 10),
	('service-recurring', 'REGULAR_MAINTENANCE', 'Entretien régulier', 'Programme récurrent adapté au jardin.', 'RECURRING', 1, 20);
--> statement-breakpoint
INSERT OR IGNORE INTO `catalog_tasks`
	(`id`, `service_id`, `code`, `label`, `description`, `measurement_kind`, `eligible_sap`, `required_capability`, `active`, `sort_order`) VALUES
	('task-mowing', 'service-one-off', 'MOWING', 'Tonte', 'Tonte, bordures et finitions.', 'SURFACE_M2', 1, 'MOWING', 1, 10),
	('task-hedges', 'service-one-off', 'HEDGE_TRIMMING', 'Taille de haies', 'Dessus, côtés et nettoyage.', 'LENGTH_M', 1, 'HEDGE_TRIMMING', 1, 20),
	('task-brush-clearing', 'service-one-off', 'BRUSH_CLEARING', 'Débroussaillage', 'Herbes hautes et végétation dense.', 'SURFACE_M2', 1, 'BRUSH_CLEARING', 1, 30),
	('task-beds', 'service-one-off', 'FLOWER_BEDS', 'Massifs', 'Désherbage et entretien soigné.', 'SURFACE_M2', 1, 'FLOWER_BEDS', 1, 40),
	('task-cleaning', 'service-one-off', 'GARDEN_CLEANING', 'Nettoyage', 'Ramassage, feuilles et finitions.', 'NONE', 1, 'GARDEN_CLEANING', 1, 50),
	('task-complete', 'service-one-off', 'COMPLETE_MAINTENANCE', 'Entretien complet', 'Entretien suivant les priorités du client.', 'NONE', 1, 'GENERAL_MAINTENANCE', 1, 60);
--> statement-breakpoint
INSERT OR IGNORE INTO `team_capabilities` (`team_id`, `capability`, `active`) VALUES
	('team-1', 'MOWING', 1),
	('team-1', 'HEDGE_TRIMMING', 1),
	('team-1', 'BRUSH_CLEARING', 1),
	('team-1', 'FLOWER_BEDS', 1),
	('team-1', 'GARDEN_CLEANING', 1),
	('team-1', 'GENERAL_MAINTENANCE', 1),
	('team-2', 'MOWING', 1),
	('team-2', 'HEDGE_TRIMMING', 1),
	('team-2', 'BRUSH_CLEARING', 1),
	('team-2', 'FLOWER_BEDS', 1),
	('team-2', 'GARDEN_CLEANING', 1),
	('team-2', 'GENERAL_MAINTENANCE', 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `pricing_versions`
	(`id`, `version`, `status`, `label`, `effective_from`, `half_day_ttc_cents`, `vat_rate_basis_points`, `currency`, `published_at`)
VALUES ('pricing-2026-v1', 1, 'ACTIVE', 'Barème validé 2026 — 329 € TTC', '2026-08-18', 32900, 2000, 'EUR', CURRENT_TIMESTAMP);
--> statement-breakpoint
INSERT OR IGNORE INTO `pricing_rules`
	(`id`, `pricing_version_id`, `code`, `label`, `rule_type`, `priority`, `condition_json`, `calculation_json`, `active`) VALUES
	('rule-base-half-day', 'pricing-2026-v1', 'BASE_HALF_DAY', '329 € TTC par demi-journée', 'BASE', 10, '{}', '{"operation":"multiply","unit":"HALF_DAY","amountTtcCents":32900}', 1),
	('rule-additional-task', 'pricing-2026-v1', 'ADDITIONAL_TASK', 'Tâche supplémentaire après la première', 'TASK', 20, '{"taskCount":{"greaterThan":1}}', '{"operation":"perUnitAfter","includedUnits":1,"amountTtcCents":900}', 1),
	('rule-grass-high', 'pricing-2026-v1', 'GRASS_HIGH', 'Pelouse haute', 'CONDITION', 30, '{"task":"MOWING","grassState":"HIGH"}', '{"operation":"fixed","amountTtcCents":2000}', 1),
	('rule-grass-very-high', 'pricing-2026-v1', 'GRASS_VERY_HIGH', 'Pelouse très haute', 'CONDITION', 31, '{"task":"MOWING","grassState":"VERY_HIGH"}', '{"operation":"fixed","amountTtcCents":6000}', 1),
	('rule-hedge-length', 'pricing-2026-v1', 'HEDGE_LENGTH_OVER_5M', 'Longueur de haie au-delà de 5 m', 'MEASUREMENT', 40, '{"task":"HEDGE_TRIMMING","lengthM":{"greaterThan":5}}', '{"operation":"perUnitAfter","includedUnits":5,"amountTtcCents":100}', 1),
	('rule-hedge-faces', 'pricing-2026-v1', 'HEDGE_FACES', 'Faces de haie', 'CONDITION', 41, '{"task":"HEDGE_TRIMMING"}', '{"operation":"map","field":"faces","amountsTtcCents":{"TOP":0,"ONE_SIDE":300,"TWO_SIDES":600,"THREE_FACES":900}}', 1),
	('rule-hedge-height', 'pricing-2026-v1', 'HEDGE_HEIGHT', 'Hauteur de haie', 'CONDITION', 42, '{"task":"HEDGE_TRIMMING"}', '{"operation":"map","field":"heightBand","amountsTtcCents":{"UNDER_1_5M":0,"FROM_1_5_TO_2M":0,"FROM_2_TO_2_5M":800,"FROM_2_5_TO_3M":1600,"OVER_3M":2500},"maximumTtcCents":2500}', 1),
	('rule-green-waste', 'pricing-2026-v1', 'GREEN_WASTE_1_TO_2M3', 'Évacuation de 1 à 2 m³', 'CONDITION', 50, '{"greenWaste":"REMOVE_1_TO_2M3"}', '{"operation":"fixed","amountTtcCents":2800}', 1),
	('rule-unattended', 'pricing-2026-v1', 'UNATTENDED_ACCESS', 'Jardin accessible sans présence', 'CONDITION', 60, '{"customerPresence":false}', '{"operation":"fixed","amountTtcCents":400}', 1),
	('rule-access-type', 'pricing-2026-v1', 'ACCESS_TYPE', 'Type d’accès en l’absence du client', 'CONDITION', 61, '{"customerPresence":false}', '{"operation":"map","field":"accessType","amountsTtcCents":{"OPEN_GATE":0,"KEY_BOX":400,"CODE":300,"OTHER":600}}', 1),
	('rule-parking', 'pricing-2026-v1', 'NO_NEARBY_PARKING', 'Absence de stationnement proche', 'CONDITION', 62, '{"nearbyParking":false}', '{"operation":"fixed","amountTtcCents":1200}', 1),
	('rule-distance', 'pricing-2026-v1', 'VEHICLE_DISTANCE', 'Distance entre le véhicule et le jardin', 'CONDITION', 63, '{}', '{"operation":"map","field":"vehicleDistanceBand","amountsTtcCents":{"UNDER_20M":0,"FROM_20_TO_50M":800,"OVER_50M":1800}}', 1),
	('rule-flexible', 'pricing-2026-v1', 'FLEXIBLE_DAY', 'Flexibilité matin ou après-midi', 'DISCOUNT', 70, '{"flexibleOnDay":true}', '{"operation":"fixed","amountTtcCents":-1000}', 1);
--> statement-breakpoint
INSERT OR IGNORE INTO `service_zones`
	(`id`, `code`, `name`, `department_code`, `min_lead_hours`, `max_advance_days`, `surcharge_ttc_cents`, `active`) VALUES
	('zone-var', 'VAR_ALL', 'Var — toutes les communes', '83', 24, 31, 0, 1),
	('zone-bdr', 'BOUCHES_DU_RHONE_TO_MARSEILLE', 'Bouches-du-Rhône jusqu’à Marseille incluse', '13', 24, 31, 0, 0),
	('zone-am', 'ALPES_MARITIMES_TO_NICE', 'Alpes-Maritimes jusqu’à Nice incluse', '06', 24, 31, 0, 0);
