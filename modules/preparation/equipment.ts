type Task = { code: string; label: string; measurement: Record<string, unknown> };

export type MissionEquipment = { code: string; reason: string; required: boolean };

type EquipmentInput = {
  tasks: Task[];
  request: Record<string, unknown>;
  greenWaste: string;
};

const text = (value: unknown) => typeof value === "string" ? value : "";

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/gu, "").toLowerCase();
}

/**
 * Préparation opérationnelle : ces éléments deviennent une checklist de
 * mission dans le CRM. Les règles restent déterministes et lisibles : aucun
 * matériel n'est déduit par une IA opaque à partir du message du client.
 */
export function recommendMissionEquipment({ tasks, request, greenWaste }: EquipmentInput): MissionEquipment[] {
  const selected = new Set(tasks.map(({ code }) => code));
  const equipment = new Map<string, MissionEquipment>();
  const add = (code: string, reason: string, required = true) => {
    const existing = equipment.get(code);
    equipment.set(code, existing ? { ...existing, reason: `${existing.reason} · ${reason}` } : { code, reason, required });
  };

  add("VEHICULE_ATELIER", "Transport de l’équipe et du matériel");
  add("EPI_ENTRETIEN", "Équipements de protection individuelle");
  add("TROUSSE_SECOURS", "Sécurité de l’équipe");
  add("KIT_SIGNALISATION", "Balisage de la zone de travail");

  if (selected.has("MOWING")) {
    add("TONDEUSE", "Tonte de la pelouse");
    add("COUPE_BORDURES", "Finitions des bordures");
    add("SOUFFLEUR", "Nettoyage après tonte");
    if (text(tasks.find(({ code }) => code === "MOWING")?.measurement.grassState) !== "MAINTAINED") add("DEBROUSSAILLEUSE_FIL", "Herbe haute ou très haute");
  }
  if (selected.has("HEDGE_TRIMMING")) {
    add("TAILLE_HAIE", "Taille des haies");
    add("SECATEUR", "Finitions et coupes précises");
    add("EBRANCHEUR", "Branches trop épaisses pour le taille-haie");
    add("SOUFFLEUR", "Nettoyage après taille");
    const height = text(tasks.find(({ code }) => code === "HEDGE_TRIMMING")?.measurement.heightBand);
    if (["FROM_2_TO_2_5M", "FROM_2_5_TO_3M"].includes(height)) add("TAILLE_HAIE_PERCHE", "Haie entre 2 et 3 mètres");
  }
  if (selected.has("BRUSH_CLEARING")) {
    add("DEBROUSSAILLEUSE_LAME", "Débroussaillage de végétation dense");
    add("RATEAU", "Ramassage des végétaux coupés");
    add("BACHE_COLLECTE", "Regroupement des végétaux");
  }
  if (selected.has("FLOWER_BEDS")) {
    add("SERFOUETTE", "Désherbage manuel des massifs");
    add("COUTEAU_DESHERBAGE", "Finitions entre les plantations");
    add("RATEAU", "Remise au propre des massifs");
    add("BROUETTE", "Transport des végétaux et résidus");
  }
  if (selected.has("GARDEN_CLEANING")) {
    add("SOUFFLEUR", "Soufflage et nettoyage du jardin");
    add("RATEAU", "Ramassage manuel");
    add("BACHE_COLLECTE", "Regroupement des déchets végétaux");
    add("BROUETTE", "Transport sur place");
  }
  if (selected.has("COMPLETE_MAINTENANCE")) {
    add("TONDEUSE", "Entretien complet de la pelouse");
    add("COUPE_BORDURES", "Finitions d’entretien complet");
    add("TAILLE_HAIE", "Reprise des végétaux");
    add("SOUFFLEUR", "Nettoyage final");
    add("RATEAU", "Ramassage final");
    add("BROUETTE", "Transport sur place");
  }

  if (greenWaste === "SHRED_ON_SITE") add("BROYEUR_VEGETAUX", "Broyage demandé sur place");
  if (greenWaste === "REMOVE_1_TO_2M3") {
    add("REMORQUE", "Évacuation des déchets végétaux");
    add("SACS_DECHETS_VERTS", "Chargement des déchets végétaux");
  }

  const description = searchable(text(request.unknownDescription));
  const has = (...keywords: string[]) => keywords.some((keyword) => description.includes(keyword));
  if (has("olivier", "fruitier", "arbre fruitier", "taille d arbre", "taille arbre")) {
    add("SECATEUR", "Taille d’arbre ou d’olivier décrite par le client");
    add("EBRANCHEUR", "Taille d’arbre ou d’olivier décrite par le client");
    add("SCIE_ELAGAGE", "Taille d’arbre ou d’olivier décrite par le client");
    add("PERCHE_ELAGAGE", "Branches en hauteur signalées par le client");
  }
  if (has("elagage", "abattage", "grosse branche", "branche haute")) {
    add("TRONCONNEUSE", "Élagage ou grosses branches signalés — à valider avant départ");
    add("KIT_SECURISATION_ARBORICOLE", "Élagage signalé — à valider avant départ");
  }
  if (has("ronce", "ronces", "bambou", "lierre", "vegetation dense", "vegetation envahissante")) {
    add("DEBROUSSAILLEUSE_LAME", "Végétation dense décrite par le client");
    add("SCIE_ELAGAGE", "Végétation ligneuse décrite par le client");
  }
  if (has("feuille", "feuillage", "aiguille", "soufflage")) {
    add("SOUFFLEUR", "Feuilles ou aiguilles signalées par le client");
    add("RATEAU", "Ramassage de feuilles ou d’aiguilles");
    add("BACHE_COLLECTE", "Collecte des feuilles ou aiguilles");
  }
  if (has("plantation", "planter", "arbuste", "fleur", "massif")) {
    add("BECHE", "Plantation ou massif signalé par le client");
    add("TRANSPLANTOIR", "Plantation ou massif signalé par le client");
    add("BROUETTE", "Transport de végétaux et terre");
  }
  if (has("arrosage", "goutte a goutte", "irrigation")) {
    add("KIT_ARROSAGE", "Arrosage ou irrigation signalés par le client");
    add("OUTILLAGE_RESEAU_ARROSAGE", "Réglage ou réparation d’arrosage signalé");
  }
  if (has("souche")) add("ROGNEUSE_SOUCHE", "Souche à traiter signalée par le client");
  if (has("terrassement", "nivellement", "decaissement", "tranchee")) {
    add("MINI_PELLE", "Terrassement signalé — à valider avant départ");
    add("NIVEAU_LASER", "Nivellement ou terrassement signalé");
  }

  return [...equipment.values()].slice(0, 30);
}
