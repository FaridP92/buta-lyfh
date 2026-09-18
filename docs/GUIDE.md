# Guide de présentation · Buta.Lyfh

Ce guide sert à présenter Buta.Lyfh de façon crédible : ce que c'est, à quoi ça sert, ce que chaque écran montre, d'où viennent les données, comment s'en servir, et surtout à quoi ressemble le quotidien d'un Responsable Performance avec un tel outil. Les chiffres cités sont ceux de la journée publiée du 17 septembre 2026 ; ils bougent chaque matin (voir §5.6), relire les écrans la veille de l'entretien.

Adresse : https://buta.lyfh.fr (sur ordinateur ou téléphone, sans compte).

## 1. En une page

**Ce que c'est.** Un cockpit de pilotage d'un réseau d'installateurs (photovoltaïque, pompes à chaleur, chauffe-eau thermodynamiques, poêles, bornes), du lead à l'encaissement : ventes, marge, funnel, forecast, qualité des données, territoires, automatisation. Construit seul, en trois jours, comme démonstrateur personnel à l'appui d'une candidature au poste de Responsable Performance chez Butagaz Eco-énergie.

**Ce que ce n'est pas.** Ni un outil Butagaz, ni une base de données Butagaz, ni une recommandation d'implantation. Aucun logo, aucune couleur de marque, aucun chiffre présenté comme celui de l'entreprise. Le nom reprend la racine de la marque par choix personnel ; il est isolé dans une constante et un sous-domaine, un renommage prend dix minutes.

**Deux familles de données, toujours distinguées à l'écran.**
- Le marché est réel et sourcé : Insee (Logement 2022), ADEME (installateurs RGE, base DPE), RTE (registre des installations solaires), contours Etalab. Chaque écran affiche source, licence et date de référence.
- L'activité est simulée : leads, rendez-vous, devis, ventes, poses, encaissements, coûts, charges, objectifs, effectifs. Un réseau de neuf agences nommées par bassin géographique, calé sur le marché réel de dix départements du Sud-Ouest et du Nord. Chaque écran d'activité porte le badge « simulé ».

**La règle qui fonde la crédibilité.** Aucun nombre affiché n'est calculé dans l'interface. Tout vient de vues SQL (`mart_`) ou d'une bibliothèque testée ; chaque indicateur a une fiche (définition, formule, grain, source) accessible en un clic par le bouton « i ». Le modèle de langage, quand il intervient, commente des faits calculés en SQL et ne produit jamais un chiffre.

**La phrase pour l'entretien.** « J'ai regardé vos dix départements avec les données ouvertes, maisons au fioul, parc solaire, installateurs RGE, et j'ai construit sur ce marché un cockpit de pilotage du lead à l'encaissement, avec les contrôles et l'automatisation. Je vous envoie le lien après notre échange. » Toujours ajouter : « à titre personnel, données publiques et données simulées ».

## 2. À quoi ça sert : le poste, rendu visible

L'annonce demande cinq choses. Chacune a son écran.

| Attente du poste | Où on le voit | Ce que ça montre |
|---|---|---|
| Construire et fiabiliser le pilotage du lead à l'encaissement | Vue d'ensemble, Funnel, Qualité | Un seul flux de données, des définitions écrites, douze contrôles de cohérence exécutés chaque matin, un badge de fraîcheur |
| Analyser et éclairer la décision (écarts de CA, marge, conversion, forecast) | Ventes et marge, Forecast | Cascade de l'écart (volume, mix, prix, remise), atterrissage en éventail avec probabilité d'atteinte, hypothèses écrites et testables au curseur |
| Transformer l'analyse en plans d'action (leads, mix, panier, remises, annulations, coûts d'acquisition, délais) | Funnel, Ventes et marge, Forecast (risques et opportunités) | Chaque anomalie est nommée, chiffrée, datée ; les plans d'action et rituels arrivent au palier B |
| Professionnaliser les rituels (revues de performance, de pipe, de marge, de forecast) | Vue d'ensemble (« Ce que dit le mois »), alertes du matin | Un ordre du jour qui se lit en trente secondes ; la revue hebdomadaire générée arrive au palier B |
| Faire évoluer outils, référentiels, BI, automatisation | Qualité (référentiels, lignage), Méthode (export Power BI), n8n | Réconciliation des libellés d'une agence intégrée, export en modèle en étoile pour Power BI, workflows quotidiens journalisés |

Le contexte du poste (plusieurs entités rachetées, territoires et canaux de maturité différente, changement d'échelle) est joué dans la simulation : une agence intégrée en juin 2026 avec ses écarts de référentiels, des départements couverts à distance, un canal de leads achetés qui dérape, une agence qui remise trop.

## 3. Les écrans, un par un

Convention commune : barre haute avec la période (mois, trimestre, année à date), la comparaison (objectif ou N-1), le filtre agence, la recherche (Cmd K ou Ctrl K), le bouton Exporter et le badge de fraîcheur. En bas de chaque écran, la ligne « Sources et hypothèses ». Chaque titre dit ce que l'écran permet de décider.

### 3.1 Vue d'ensemble · « Le réseau ce mois-ci »
La question : où en est le réseau ce mois-ci, où sont les écarts, que faire ce matin.
- Quatre compteurs : ventes signées, CA signé HT, taux de marge brute, conversion lead vers vente de la dernière cohorte mûre (« cohorte de mai, à 90 jours »). Le mois en cours est comparé à l'objectif au prorata des jours publiés (17 jours sur 30 le 17 septembre), sinon toute comparaison serait fausse.
- Atterrissage 2026 : réalisé à date, atterrissage central, bornes basse et haute, objectif, probabilité d'atteinte. Au 17 septembre : 24,8 M€ central pour 29,2 M€ d'objectif, soit -15 %, probabilité d'atteinte inférieure à 1 %. C'est voulu : l'objectif 2026 vaut le réalisé 2025 × 1,15 et l'écran montre un réseau qui ne l'atteindra pas, ce qui est exactement la situation où un Responsable Performance sert à quelque chose.
- Funnel de la cohorte du mois, grisé tant que la cohorte a moins de 90 jours (« taux provisoires »).
- Alertes du matin, calculées par règles et datées : coût par vente des leads achetés de Bordeaux Métropole +48 % vs premier trimestre, 123 dossiers à qualifier dans le Nord.
- Tableau des agences (ventes, écart à l'objectif, marge, statut), carte miniature des neuf agences simulées, et « Ce que dit le mois » : trois phrases assemblées par règles à partir des faits SQL (l'explication par le modèle de langage arrive au palier B).

Ce qu'on dit : « en trente secondes je sais ce qui a bougé, où, et de combien ; chaque chiffre a sa fiche ».

### 3.2 Ventes et marge · « D'où vient l'écart de chiffre d'affaires »
La question : pourquoi le CA n'est pas là où il devrait être, et qui gagne de l'argent.
- Six KPI : CA signé, CA posé, taux de marge brute, panier moyen, remise moyenne, taux d'annulation à 60 jours.
- Cascade de l'écart de CA contre l'objectif (ou N-1) : effet volume, effet mix, effet prix, effet remise, résiduel nul par construction (formule télescopique, écrite dans la fiche). L'axe est tronqué et l'écran le dit. Bouton « Expliquer » : constat, causes classées, action, sources, par règles.
- CA par produit sur douze mois avec le taux de marge en courbe (la saisonnalité se lit : photovoltaïque au printemps, chauffage à l'automne, août creux).
- « Quelle agence gagne de l'argent » : CA, écarts, marge brute, marge après acquisition, résultat d'agence, remise, annulations. Des agences gagnantes et perdantes, comme dans un vrai réseau.
- Matrice agence × produit (taille = CA, couleur = marge), annulations à distance contre sur place, boîtes à moustaches des remises par agence.
- La phrase sur les remises : une régression à effets fixes agence retrouve la pente plantée dans la simulation (0,84 point de signature par point de remise, intervalle à 95 % de 0,15 à 1,52) et en tire la lecture économique : à cette pente, aucune remise n'augmente la marge ; il faudrait 1,78 point de signature par point de remise pour qu'une remise de 8 % soit le bon niveau. Présentée comme une démonstration de méthode sur données simulées, jamais comme une règle applicable à un réseau réel.

Ce qu'on dit : « l'écart se décompose, la remise se mesure, la marge après acquisition dit qui gagne vraiment ».

### 3.3 Funnel et leads · « Où se perd la conversion »
La question : à quelle étape on perd, quel canal vaut son coût, quels leads attendent.
- Six KPI en cohortes (rattachées au mois de création du lead) : leads, taux de RDV, taux de devis, taux de signature, coût par lead, coût par vente. Les taux sont mesurés sur la dernière cohorte mûre (mai 2026 le 17 septembre : 41,8 % de RDV, 67,8 % de devis, 33,8 % de signature, 98 € par lead, 914 € par vente) ; les leads du mois en cours sont comparés à N-1 au prorata des jours publiés.
- Sankey du lead à l'encaissement avec les pertes en branches (sans suite, sans devis, refus, annulations) et les dossiers en attente en gris ; sélecteur de canal ; se redessine quand on change d'agence.
- Matrice canal × agence (conversion en couleur, volume en trait), vingt mois de leads par canal avec les ventes nettes en courbe, qualité des leads par canal (« à revoir » quand le coût par vente dépasse 1,3 fois la médiane des canaux à coût), leads sans rendez-vous planifié à 48 heures par agence et par cohorte.

Ce qu'on dit : « la cohorte est la seule façon honnête de mesurer une conversion ; un lead de septembre n'a pas fini de convertir ».

### 3.4 Forecast et atterrissage · « Où finit l'année 2026 »
La question : où on atterrit, avec quelles hypothèses, quels risques, quelles opportunités.
- Éventail cumulé : réalisé, objectif, atterrissage central, intervalle à 68 %, ligne de la journée publiée.
- Hypothèses écrites et chiffrées : devis en cours de moins de 90 jours et leur montant, taux de signature observés par tranche d'âge des devis, taux d'annulation à six mois, pipe pondéré, run-rate trois mois saisonnalisé, écart-type mensuel. Un curseur « taux de signature du pipe » recalcule l'atterrissage sans rien écrire en base : on peut tester « et si le pipe signait à 20 % ? ».
- Tableau par agence : réalisé, objectif, central, bas à haut, écart, probabilité d'atteinte, pipe pondéré, statut.
- Risques et opportunités calculés par règles avec le montant et la date de calcul.

Ce qu'on dit : « un forecast, c'est une formule visible, des hypothèses écrites et un intervalle, pas un chiffre magique ».

### 3.5 Territoires · « Où est le potentiel non servi »
La question : que dit le marché réel des territoires couverts et alentour.
- Carte de France des 96 départements colorée par un indice de potentiel (0 à 100, rangs centiles) ; les onze départements du périmètre simulé sont détourés. Survol : propriétaires occupants, résidences au fioul et au gaz citerne, maisons F ou G, installations solaires, installateurs RGE.
- Composantes de l'indice avec des curseurs de poids (volume de propriétaires 40 %, intensité fioul et citerne 30 %, intensité F ou G 30 %, pénalités de concurrence RGE et de saturation solaire 30 % chacune) ; recalcul à l'écran, bouton de réinitialisation, rappel que l'indice n'est pas une recommandation d'implantation.
- Tableau des 96 départements exportable, vue des communes d'un département (potentiel, agence simulée du bassin, installateurs RGE en points sans nom), carte du parc gaz en citerne (« un parc à convertir, à lire comme tel »).
- Rien n'est simulé sur cet écran, sauf la position des neuf agences simulées, placées au centre de leur bassin.

Ce qu'on dit : « le marché est public ; les dix départements comptent 2,0 millions de maisons, 1,76 million de propriétaires occupants, 221 000 résidences au fioul et 57 000 au gaz citerne (Insee 2022) ».

### 3.6 Qualité et référentiels · « Peut-on faire confiance au chiffre »
La question : la confiance dans le chiffre, rendue visible.
- Score du jour (part pondérée des contrôles réussis, poids 3 pour un contrôle bloquant) et courbe des journées ; le 17 septembre le score est à 68 parce que deux contrôles bloquants sont en échec, et l'écran le dit au lieu de le masquer.
- Douze contrôles de cohérence (dossier sans agence, dossier sans canal, statut incohérent avec les dates, dates non chronologiques, doublon probable, montant hors bornes, remise supérieure à 20 %, marge négative, libellé produit hors référentiel, objectif manquant, fraîcheur à 72 heures, funnel monotone par cohorte) avec la règle, le nombre de lignes, la tendance et un échantillon.
- Fraîcheur des six sources (date de référence, ingestion, prochaine mise à jour), lignage des sources aux écrans, référentiels (agences, canaux, produits, statuts) et la réconciliation des libellés produits de l'agence Nord (« avant, après »).

Ce qu'on dit : « un chiffre auquel on ne peut pas faire confiance ne sert à rien ; les contrôles tournent chaque matin et l'anomalie est portée à l'écran plutôt que cachée ».

### 3.7 Méthode et auteur
Ce que c'est et ce que ce n'est pas, les sources réelles avec liens, licences et dates, le modèle de simulation et les sept histoires, le contexte public cité une seule fois (dix départements et huit agences publiés par l'entreprise, rachat de Lumélio annoncé en mai 2026), l'architecture, l'export Power BI (zip de vingt tables CSV et modèle en étoile documenté), l'auteur et les liens (LinkedIn, CV, Courant, CoPilote Atelier).

## 4. D'où viennent les données

### 4.1 Le marché, réel
| Source | Ce qu'on en retient | Fraîcheur | Licence |
|---|---|---|---|
| Insee, Logement en 2022, à la commune | résidences principales, maisons, propriétaires occupants, chauffage au fioul, au gaz citerne ou bouteille, au gaz de ville, à l'électricité | millésime 2022 | Licence Ouverte 2.0 |
| ADEME, liste des entreprises RGE | installateurs qualifiés pompe à chaleur, photovoltaïque, chauffe-eau thermodynamique, géolocalisés, comptés par commune et département | quotidienne | Licence Ouverte 2.0 |
| RTE (ODRÉ), registre des installations de production | installations solaires et puissance raccordées, par commune | au 31 juillet 2026 | Licence Ouverte 2.0 |
| ADEME, DPE logements existants | maisons en étiquette F ou G, énergie de chauffage (fioul, GPL, propane, butane) | hebdomadaire | Licence Ouverte 2.0 |
| Etalab, contours administratifs | contours des départements et des communes du périmètre, simplifiés | annuelle | Licence Ouverte 2.0 |

Chiffres de contrôle vérifiés à l'ingestion (tolérance 0,5 %) : France 32,7 millions de résidences principales, 17,3 millions de maisons, 2,6 millions au fioul, 449 000 au gaz citerne ou bouteille ; 740 000 maisons F ou G en France, 31 600 dans le Nord, 10 800 en Charente-Maritime ; 23 500 installations solaires en Charente-Maritime, 23 400 dans le Nord ; 239 qualifications RGE pompe à chaleur et 113 photovoltaïque en Charente-Maritime.

### 4.2 L'activité, simulée
- Un générateur déterministe (graine fixe) produit 72 261 dossiers du 1er janvier 2025 au 31 décembre 2026 ; seule la part jusqu'à la veille est publiée, un workflow publie chaque matin la journée de la veille.
- Neuf agences nommées par bassin (Saintonge, Angoumois, Marensin, Born, Marsan, Bordeaux Métropole, Haute Gironde, Bassin d'Arcachon, Nord), 44 commerciaux et 52 techniciens désignés par des codes, jamais des noms. Aucune agence, personne ou entité réelle n'est associée à une performance simulée.
- Le volume de leads découle du marché réel (propriétaires occupants pondérés par les parts de territoire, plafonné par l'effectif commercial) : environ 3 000 leads par mois, 3 100 ventes et 2 800 poses par an, 27 M€ de CA signé annuel pour le réseau. Huit canaux d'acquisition, huit produits avec prix catalogue, taux de pose, marge cible, saisonnalité propre.
- Funnel de base par cohorte : 45 % de RDV tenus, 70 % de devis, 32 % de signature, 8 % d'annulations ; modificateurs par canal (le parrainage signe mieux, les leads achetés prennent moins de RDV), effet agence et effet commercial tirés une fois. Délais en lois log-normales (6 jours du lead au RDV, 12 du devis à la signature, 45 de la signature à la pose sur place, 75 à distance, 20 de la pose à l'encaissement).
- Coûts d'acquisition par canal (leads achetés 65 € le lead, terrain 12 000 € par mois et par agence, parrainage 300 € par vente, partenaires 8 % du CA apporté), commissions 4 % du CA, charges d'agence par effectif, aides en mandat financier. Ordres de grandeur écrits dans la documentation, présentés comme tels.
- Objectifs 2026 = réalisé 2025 × 1,15 ; le réseau ne les atteint pas, c'est le scénario voulu.

### 4.3 Les sept histoires plantées dans la simulation
Elles décrivent des situations classiques d'un réseau, jamais des faits réels, et chacune se retrouve à l'écran.
1. **H1 Marensin** : changement d'organisation commerciale en février 2026, taux RDV vers devis en retrait de 10 points de mars à juin, retour progressif ensuite (Funnel, Forecast).
2. **H2 Bordeaux Métropole** : leads achetés doublés à partir d'avril 2026, taux de RDV du canal en baisse, coût par vente du canal +40 à +50 % vs premier trimestre (alerte de la Vue d'ensemble, Funnel).
3. **H3 Saintonge** : remise moyenne de 4 % à 9 % à partir d'avril 2026, signature +4 points, marge -3 à -4 points : conversion gagnée, marge perdue (Ventes et marge).
4. **H4 Nord** : agence intégrée en juin 2026, écarts de référentiels typiques (dossiers sans statut, doublons, libellés produits divergents comme « PAC AIR EAU 11KW » contre « Pompe à chaleur air-eau »), réconciliés par un référentiel commun, anomalies décroissantes semaine après semaine (Qualité, alerte de la Vue d'ensemble). Formulée « dossiers à qualifier, référentiel en cours d'alignement », comme une réussite d'alignement.
5. **H5 Départements couverts à distance** (79, 85, 24, 47, 32, 64) : délai signature vers pose 75 jours contre 45, annulations 14 % contre 8 % (Ventes et marge).
6. **H6 Saisonnalité** : photovoltaïque au printemps, pompes à chaleur et poêles à l'automne, août creux (Ventes et marge, Funnel).
7. **H7 Bassin d'Arcachon** : capacité de pose réduite de 25 % de mai à août 2026, carnet de pose allongé, retards de pose de l'ordre de 20 jours, CA posé en retrait alors que le CA signé tient (Forecast, Vue d'ensemble).

Une suite de vingt tests SQL (un par histoire, plus des contrôles de cohérence des vues) vérifie que les sept histoires se retrouvent bien dans les vues (`npm run test:sql`).

### 4.4 Comment la vérité des chiffres est garantie
- Calculs en SQL dans des vues `mart_` (vingt vues), chaque vue et chaque colonne commentée ; les calculs qui doivent vivre dans l'interface (agrégation d'une période, recalcul du forecast au curseur, pondération de l'indice) sont dans une bibliothèque testée (87 tests unitaires).
- Chaque indicateur a une fiche : définition, formule, grain, unité, sens de lecture, source (bouton « i »).
- Mois en cours comparé au prorata des jours publiés ; les taux de cohorte ne sont affichés que pour les cohortes mûres (90 jours) ; les axes tronqués sont annoncés ; les seconds axes sont expliqués.
- Douze contrôles de cohérence exécutés chaque matin ; score et anomalies visibles.
- Le modèle de langage (palier B) rédige à partir de faits SQL qui lui sont transmis et ne calcule jamais ; un contrôle refuse tout nombre absent des faits.

## 5. Comment l'utiliser

### 5.1 Navigation
Rail à gauche (icônes, libellé au survol) : Vue d'ensemble, Territoires, Funnel, Ventes et marge, Forecast, Qualité, Méthode. Sur téléphone, un tiroir. Le monogramme en haut ramène à l'accueil.

### 5.2 Filtres globaux, dans l'adresse
Période (mois, trimestre, année à date), comparaison (objectif ou N-1), agence (toutes ou une). Les filtres vivent dans l'URL : un lien partagé montre la même vue (`?periode=2026-05&comparaison=n1&agence=SAI`). Le titre de chaque écran s'adapte à l'agence choisie.

### 5.3 Palette de commandes (Cmd K ou Ctrl K)
Écrans, agences (un choix filtre toute l'application) et indicateurs (un choix ouvre la fiche). Recherche sans accents, clavier complet.

### 5.4 Fiches, graphiques, tableaux
- Bouton « i » sur chaque KPI et chaque graphique : la fiche de l'indicateur.
- Menu de chaque graphique : plein écran, image PNG, export CSV, voir la requête SQL.
- Tableaux : tri par colonne, export CSV ou XLSX ; le bouton « Exporter » de la barre haute exporte le tableau principal de l'écran.
- Page Méthode : export Power BI (zip de vingt tables CSV et `modele_etoile.md` qui décrit le modèle en étoile, le grain et les clés).

### 5.5 Thème et mobile
Thème sombre par défaut, clair au bouton en haut à droite (les graphiques suivent). Tout se lit à 375 px sans zoom.

### 5.6 Fraîcheur et automatisation
Le badge « journée du JJ/MM intégrée à HH:MM » dit quelle journée simulée est publiée et quand. Chaque matin à 06:00 un workflow n8n publie la veille et rafraîchit les vues ; à 06:20 un second exécute les douze contrôles et envoie une synthèse par email si un contrôle bloquant échoue ; toutes les six heures un troisième vérifie que le site et l'API répondent. Si la base ne répond pas, l'application bascule sur un instantané statique embarqué et le badge le dit (« instantané du JJ/MM »).

## 6. Au quotidien : ce qu'un Responsable Performance en fait

### 6.1 Le matin, cinq minutes
1. Badge de fraîcheur : la journée d'hier est intégrée. Sinon, Qualité dit pourquoi.
2. Vue d'ensemble : les quatre compteurs contre l'objectif au prorata, l'atterrissage, les alertes du matin datées.
3. Qualité : score du jour, contrôles en échec, lignes concernées. Une anomalie de données se traite avant de lire un chiffre.
4. « Ce que dit le mois » : les trois phrases qui font l'ordre du jour du point quotidien.

### 6.2 Chaque semaine : la revue de pipe et de conversion
Funnel par agence et par canal : où se perd la conversion, quels leads attendent sans rendez-vous à 48 heures, quel canal dépasse 1,3 fois le coût par vente médian. Forecast : le pipe pondéré, les devis qui vieillissent, les risques et opportunités.

### 6.3 Chaque mois : revue de marge et de forecast
Ventes et marge : la cascade de l'écart (volume, mix, prix, remise), les agences qui gagnent ou perdent de l'argent après acquisition, la distribution des remises. Forecast : atterrissage, hypothèses, curseur pour tester un scénario, tableau par agence avec probabilité d'atteinte.

### 6.4 Chaque trimestre : revue de performance et territoires
Territoires : le marché réel, l'indice de potentiel avec les poids discutés en réunion, la couverture des départements à distance et ce qu'elle coûte en délais et en annulations. Export Power BI pour les directions qui travaillent dans leur propre outil.

### 6.5 Sept décisions que la simulation permet de jouer
| Constat à l'écran | Décision que l'outil éclaire |
|---|---|
| Bordeaux Métropole : coût par vente des leads achetés +48 % depuis le doublement des leads | Plafonner le volume acheté, renégocier le prix du lead, mesurer le taux de RDV du canal chaque semaine |
| Saintonge : remise passée de 4 à 9 %, conversion +4 points mais marge -3 à -4 points | Fixer un plafond de remise par produit, suivre la marge après remise plutôt que le taux de signature seul |
| Marensin : RDV vers devis -10 points de mars à juin | Accompagner l'organisation commerciale, suivre le taux par commercial (codes) et la reprise mois après mois |
| Nord : 123 dossiers à qualifier, libellés hors référentiel | Aligner les référentiels de l'entité intégrée, mesurer la décroissance des anomalies, ne pas comparer ses taux avant la réconciliation |
| Bassin d'Arcachon : carnet de pose allongé, retards de pose, CA posé en retrait | Redistribuer la capacité technique, prioriser les poses par ancienneté de signature, prévenir les clients |
| Départements à distance : 75 jours de pose contre 45, annulations 14 % contre 8 % | Chiffrer le coût de la distance, décider entre partenaire local, agence ou renoncement à certains produits |
| Atterrissage à -15 % de l'objectif avec probabilité d'atteinte sous 1 % | Redire l'objectif ou le plan : le forecast donne le montant à trouver, le pipe dit ce qui est déjà engagé |

Les chiffres sont simulés ; les gestes sont ceux du poste.

## 7. Sous le capot, en langage simple
- **Base** : Supabase (Postgres) avec un schéma dédié, vingt vues `mart_`, sécurité par rôle et par ligne : l'interface ne lit que des agrégats, jamais une ligne de dossier. Les clés secrètes ne quittent jamais le serveur.
- **Interface** : application React statique, déployée sur un VPS, graphiques ECharts, tests de bout en bout Playwright sur chaque route en 1280 et 375 px, audit Lighthouse (performance, accessibilité, bonnes pratiques, SEO à 99 ou 100 sur l'écran Ventes).
- **Automatisation** : n8n (journée simulée, contrôles qualité, santé, gestion des erreurs), chaque exécution journalisée en base ; email au troisième échec consécutif.
- **IA** (palier B) : un analyste qui répond aux questions en langage naturel en écrivant une requête SQL en lecture seule sur les vues autorisées, avec quotas et budget affiché ; une explication d'écart rédigée à partir des faits. Repli par règles si l'IA est indisponible.
- **BI** : export Power BI en modèle en étoile ; les mesures DAX arrivent au palier B.
- **Méthode de construction** : documentation écrite avant le code (brief, écrans, indicateurs, données, design, architecture, déploiement, automatisations, IA, backlog, vérification), journal des décisions et des écarts, un commit par lot, critères d'acceptation vérifiés.

## 8. Questions probables et réponses

**Ce sont nos données ?** Non. Le marché est public et sourcé (Insee, ADEME, RTE), l'activité est simulée par un générateur dont les hypothèses sont écrites. Rien de ce qui est affiché ne décrit l'activité de l'entreprise.

**D'où sortez-vous nos départements et nos agences ?** Du site public de l'entreprise et du registre RGE, cités une seule fois sur la page Méthode comme contexte. Les agences simulées portent des noms de bassins, pas les vôtres.

**Pourquoi simuler plutôt que prendre un jeu de données existant ?** Parce qu'un réseau d'installateurs n'a pas de jeu public, et parce qu'une simulation permet de planter des situations à retrouver (une agence qui remise trop, un canal qui dérape, une intégration) et de vérifier que les indicateurs les font remonter.

**Comment garantissez-vous les chiffres ?** Aucun calcul dans l'interface : tout est en SQL ou dans une bibliothèque testée, chaque indicateur a sa fiche avec la formule, le mois en cours est proratisé, les cohortes immatures ne sont pas comparées, douze contrôles tournent chaque matin, vingt tests SQL vérifient les vues et les histoires.

**Et avec des données réelles ?** Le modèle de données (dossier avec ses dates, agence, canal, produit, montants) est celui d'un CRM d'installateur ; l'ingestion remplacerait le générateur, les vues et les écrans resteraient. Les référentiels et les contrôles sont justement faits pour absorber plusieurs entités.

**Combien de temps ?** Trois jours, seul, avec une documentation écrite d'abord et des outils d'assistance au développement. Le temps est allé aux définitions, aux contrôles et aux tests, pas aux couleurs.

**Pourquoi ce nom ?** Un choix personnel qui reprend la racine de la marque ; il est isolé dans une constante et un sous-domaine, un renommage prend dix minutes, et à la première réserve exprimée le lien est retiré dans l'heure.

**L'IA calcule quoi ?** Rien. Elle commente des faits calculés en SQL qui lui sont transmis ; un contrôle refuse toute réponse qui contiendrait un nombre absent des faits. Elle est au palier B, avec quotas et budget affiché.

**Et Power BI ?** L'export fournit les tables au format CSV et un modèle en étoile documenté (grain, clés, mesures à recalculer depuis les sommes, jamais des moyennes de taux) ; les mesures DAX suivent.

**Combien ça coûte à faire tourner ?** Un VPS mutualisé, un projet Supabase, une instance n8n : quelques dizaines d'euros par mois, et un budget IA plafonné à 1,50 € par jour hors semaine de démonstration.

## 9. Glossaire des indicateurs (formules essentielles)
- **Ventes signées** : dossiers signés dans le mois, hors annulations connues à la journée publiée.
- **CA signé HT** : somme des montants HT nets de remise des ventes signées ; **CA posé** : idem au mois de pose ; **encaissé** : au mois d'encaissement.
- **Taux de marge brute** : (CA - matériel - pose) / CA ; **marge après acquisition** : marge brute - coûts d'acquisition - commissions ; **résultat d'agence** : marge après acquisition - charges d'agence.
- **Panier moyen** : CA signé / ventes ; **remise moyenne** : remises / prix catalogue, pondérée par les prix.
- **Taux d'annulation à 60 jours** : annulations dans les 60 jours de la signature / signatures.
- **Cohorte** : tous les leads créés un mois donné ; **taux de RDV** : RDV tenus / leads ; **taux de devis** : devis / RDV tenus ; **taux de signature** : signatures / devis ; **conversion** : ventes nettes / leads, sur une cohorte mûre (90 jours).
- **Coût par lead** : coûts d'acquisition du canal / leads ; **coût par vente** : coûts / ventes de la cohorte, hors commissions.
- **Écart de CA** : volume (ventes × prix de référence), mix (répartition par produit), prix (prix catalogue), remise, résiduel nul par construction.
- **Atterrissage** : réalisé + pipe pondéré (devis en cours × taux de signature par tranche d'âge × (1 - annulation)) + run-rate trois mois saisonnalisé sur les mois restants ; intervalle à un écart-type mensuel × racine des mois restants ; probabilité d'atteinte par loi normale.
- **Carnet de pose** : signatures non posées / capacité hebdomadaire des techniciens, en jours ouvrés.
- **Indice de potentiel** : (0,4 × volume + 0,3 × fioul et citerne + 0,3 × F ou G) × (1 - 0,3 × frein RGE / 100) × (1 - 0,3 × saturation solaire / 100), composantes en rangs centiles sur 96 départements.
- **Score de qualité** : 100 × poids des contrôles OK / poids total (3 pour un contrôle bloquant, 1 sinon).

## 10. Démonstration en trois minutes
1. **Accueil (30 s)** : « Le réseau ce mois-ci : quatre compteurs contre l'objectif au prorata, l'atterrissage de l'année, les alertes du matin datées. Tout est simulé, sauf le marché. »
2. **Ventes et marge (45 s)** : la cascade de l'écart (« -238 k€ de volume, -106 k€ de mix »), le tableau « quelle agence gagne de l'argent », la phrase sur les remises de Saintonge.
3. **Funnel (30 s)** : le Sankey, changer d'agence pour le voir se redessiner, la matrice canal × agence, le canal « à revoir ».
4. **Forecast (30 s)** : l'éventail, le curseur « taux de signature du pipe », la probabilité d'atteinte.
5. **Qualité (20 s)** : les douze contrôles, les deux en échec, la réconciliation des libellés du Nord.
6. **Territoires (20 s)** : la carte de France, l'indice, un clic vers les communes d'un département.
7. **Méthode (5 s)** : « tout est écrit là : sources, hypothèses, ce que c'est, ce que ce n'est pas ».

Puis une phrase : « c'est le poste tel que je le tiendrais ; les chiffres sont simulés, les gestes sont les bons ».
