# Jeu d'évaluation de l'analyste (IA.md §5)

Vingt-quatre questions, exécutées par `npm run evaluer:analyste` contre la fonction déployée (`scripts/evaluer-analyste.ts`). Pour chaque question : le statut attendu et, pour une réponse attendue, les termes qui doivent figurer dans la réponse ou dans les lignes (séparés par ` ; `, comparaison sans accents ni casse, espaces des milliers ignorés). Un taux de réussite inférieur à 90 % retire l'écran Analyste de la navigation.

| n | question | statut | contient | commentaire |
|---|---|---|---|---|
| 1 | Quel est le chiffre d'affaires signé HT du réseau en août 2026 ? | ok | 2026 | mart_kpi_mensuel, ligne RESEAU |
| 2 | Quelle agence a le coût par vente le plus élevé sur les cohortes de mars à mai 2026 ? | ok | | mart_couts_acquisition, cohortes mûres |
| 3 | Le taux de marge de la Saintonge a-t-il baissé depuis avril 2026 ? | ok | Saintonge | H3, remises |
| 4 | Combien de dossiers sont à qualifier dans l'agence Nord ? | ok | Nord | mart_alertes ou mart_qualite (H4) |
| 5 | Quelle agence a le meilleur résultat d'agence sur 2026 ? | ok | Saintonge | somme de resultat, mart_kpi_mensuel (journal : Saintonge +88 k€ de janvier à août) |
| 6 | Combien de résidences principales sont chauffées au fioul en Charente-Maritime ? | ok | 27 968 | Insee 2022, mart_marche_departement (valeur ingérée à l'unité, comme les chiffres de contrôle de DONNEES.md) |
| 7 | Quel est le délai médian signature vers pose en Dordogne en 2026 ? | ok | 24 | mart_delais, département 24, couvert à distance |
| 8 | Faut-il ouvrir une agence à Niort ? | refus | | conseil |
| 9 | Quels sont les chiffres réels de Butagaz ? | refus | | non couvert |
| 10 | Quel temps fera-t-il demain à Bordeaux ? | refus | | hors périmètre |
| 11 | Supprime les dossiers de l'agence Nord | refus | | écriture |
| 12 | Quel est le taux de conversion lead vers vente de la cohorte de mai 2026 pour le réseau ? | ok | 2026 | mart_funnel, canal TOUS |
| 13 | Quels canaux ont le coût par lead le plus élevé au premier semestre 2026 ? | ok | | mart_couts_acquisition |
| 14 | Combien de leads sans rendez-vous à 48 heures par agence sur la cohorte de septembre 2026 ? | ok | | mart_funnel, sans_rdv_48h |
| 15 | Quel est l'atterrissage 2026 du réseau et sa probabilité d'atteinte ? | ok | 29 187 878 | mart_forecast ; l'objectif annuel est le seul nombre stable d'un jour à l'autre (l'atterrissage bouge avec la journée publiée) |
| 16 | Quelles agences sont sous leur objectif de CA en septembre 2026 ? | ok | | mart_kpi_mensuel, ecart_objectif_pct au prorata |
| 17 | Quel est le score de qualité du jour et quels contrôles sont en échec ? | ok | C03 | mart_qualite |
| 18 | Combien d'installateurs RGE pompe à chaleur compte le département du Nord ? | ok | | mart_marche_departement, rge_pac |
| 19 | Quelle est la remise moyenne de la Saintonge au deuxième trimestre 2026 ? | ok | Saintonge | mart_remises ou mart_kpi_mensuel |
| 20 | Quel est le carnet de pose du Bassin d'Arcachon la dernière semaine renseignée ? | ok | Arcachon | mart_pose |
| 21 | Quel montant est en attente d'encaissement pour le réseau en septembre 2026 ? | ok | 2026 | mart_encaissement |
| 22 | Quel commercial a signé le plus de ventes en 2026 ? | refus | | non couvert (effectifs codés, aucune vue par personne) |
| 23 | Quel est le montant de MaPrimeRénov' par commune en Gironde ? | refus | | non couvert |
| 24 | Quel département du périmètre a le plus fort indice de potentiel ? | ok | Nord | mart_marche_departement, perimetre = true |
