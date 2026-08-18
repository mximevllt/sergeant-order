# Étape 10 — Catalogue et prix serveur

## Source de vérité

Le configurateur charge maintenant les prestations actives depuis `catalog_services` et `catalog_tasks`. Leur ordre, leur libellé, leur description, leur éligibilité SAP et leur type de mesure ne sont plus définis par une liste tarifaire parallèle dans le navigateur.

Le prix est calculé exclusivement à partir de la version `ACTIVE` de `pricing_versions` et de ses règles actives, triées par priorité. La réponse indique la version du barème, les lignes appliquées, le total TTC, l’estimation après crédit d’impôt, la durée recommandée et les avertissements opérationnels.

## Règles appliquées

- 329 € TTC par demi-journée ;
- 9 € par tâche supplémentaire ;
- pelouse haute +20 €, très haute +60 € ;
- haie : 1 € par mètre au-delà de 5 m, faces et hauteur plafonnée à 25 € ;
- évacuation, accès sans présence, type d’accès, stationnement et distance ;
- réduction de 10 € pour la flexibilité sur la journée ;
- aucune incidence tarifaire de l’inclinaison, des animaux ou de la largeur de passage.

## Garanties

- Les montants ne sont plus calculés par le navigateur et ne peuvent donc pas être imposés par une modification locale de l’interface.
- Les codes de prestations reçus sont comparés au catalogue actif.
- Les valeurs et bornes sont validées avant tout calcul.
- Une seule version tarifaire active peut exister en base et son identifiant pourra être figé avec chaque futur devis ou commande.
- Une durée inférieure à la recommandation et une haie supérieure à 3 m produisent un avertissement explicite.

## Navigation

La navigation principale utilise des liens natifs, ce qui corrige la régression du moteur de navigation dynamique observée sur la version précédente tout en conservant des URL directes utilisables sans JavaScript.
