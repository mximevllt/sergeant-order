# Étape fonctionnelle 12 — zones d’intervention

## Résultat

La mention « zone desservie » n’est plus décorative. Toute adresse utilisée pour créer un devis ou enregistrer un jardin est contrôlée dans libSQL par le serveur.

Le périmètre actif est :

- l’intégralité du département du Var (codes postaux `83xxx`) ;
- 30 communes des Bouches-du-Rhône, jusqu’à Marseille incluse ;
- 40 communes des Alpes-Maritimes, jusqu’à Nice incluse.

Les codes INSEE, codes postaux et noms ont été vérifiés à partir du Code officiel géographique 2026 de l’Insee et de l’API Découpage administratif de l’État. Ils sont figés dans `drizzle/0004_service_area_municipalities.sql` afin qu’un changement externe ne modifie jamais silencieusement les réservations acceptées.

Sources officielles :

- https://www.insee.fr/fr/information/2560452
- https://geo.api.gouv.fr/decoupage-administratif/communes

## Communes des Bouches-du-Rhône

Aix-en-Provence, Allauch, Aubagne, Auriol, Belcodène, Bouc-Bel-Air, Cadolive, Carnoux-en-Provence, Cassis, Ceyreste, Cuges-les-Pins, Fuveau, Gardanne, Gémenos, Gréasque, La Bouilladisse, La Ciotat, La Destrousse, La Penne-sur-Huveaune, Marseille, Meyreuil, Peynier, Peypin, Plan-de-Cuques, Roquefort-la-Bédoule, Roquevaire, Rousset, Saint-Savournin, Septèmes-les-Vallons et Trets.

## Communes des Alpes-Maritimes

Antibes, Aspremont, Auribeau-sur-Siagne, Biot, Cabris, Cagnes-sur-Mer, Cannes, Carros, Châteauneuf-Grasse, Colomars, Gattières, Gourdon, Grasse, La Colle-sur-Loup, La Gaude, La Roquette-sur-Siagne, Le Bar-sur-Loup, Le Cannet, Le Rouret, Le Tignet, Mandelieu-la-Napoule, Mouans-Sartoux, Mougins, Nice, Opio, Pégomas, Peymeinade, Roquefort-les-Pins, Saint-Cézaire-sur-Siagne, Saint-Jeannet, Saint-Laurent-du-Var, Saint-Paul-de-Vence, Saint-Vallier-de-Thiey, Spéracèdes, Théoule-sur-Mer, Tourrettes-sur-Loup, Valbonne, Vallauris, Vence et Villeneuve-Loubet.

## Règles techniques

- Le Var est accepté par département, conformément à la règle « tout le Var ».
- Les départements 13 et 06 exigent une correspondance entre le code postal et la commune autorisée.
- Les accents, apostrophes, traits d’union et différences de casse sont normalisés pour la comparaison.
- Un code postal partagé par plusieurs communes ne suffit pas : le nom de la ville doit également correspondre.
- Le devis conserve un instantané de la zone, du code postal et de la commune reconnus.
- Une adresse non desservie est refusée côté serveur même si l’interface est contournée.
- Les réponses API ne sont pas mises en cache et les données d’adresse ne sont pas placées dans l’URL.

## Interface

Le configurateur indique quatre états : vérification en cours, adresse desservie, adresse non desservie ou service temporairement indisponible. L’enregistrement final reste désactivé tant que l’éligibilité n’est pas confirmée.

Le précédent bouton de géolocalisation fictif a été retiré : il renseignait une adresse de démonstration au lieu d’obtenir la position réelle. Une véritable géolocalisation nécessitera ultérieurement un consentement navigateur et un service officiel de géocodage inverse.

## Limite de cette étape

Cette étape valide le périmètre commercial, mais ne calcule pas encore les temps de trajet et ne bloque aucun créneau. Le moteur de disponibilités utilisera ensuite la zone reconnue, les équipes, leurs capacités et leurs indisponibilités.
