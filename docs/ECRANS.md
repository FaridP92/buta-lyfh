# Écrans · Buta.Lyfh

Conventions communes à tous les écrans : monogramme en haut du rail (marque-mot complète au survol du rail et sur la page Méthode) ; rail de navigation à gauche (icônes, libellé au survol, libellé complet sur mobile dans un tiroir) ; barre haute avec le sélecteur de période (mois, trimestre, année à date), la comparaison (objectif, N-1), le filtre agence ou territoire, la palette de commandes (Cmd K), le bouton Exporter, le badge de fraîcheur (« journée du JJ/MM intégrée à HH:MM ») ; en bas de chaque écran, la ligne Sources et hypothèses (source, licence, date de référence, badge « données d'activité simulées » quand il y a lieu) ; en pied de page, la mention réglementaire de CLAUDE.md. Les filtres vivent dans l'URL (`?periode=2026-09&comparaison=objectif&agence=MER`) pour qu'un lien partagé montre la même vue. Chaque carte KPI a un bouton « i » qui ouvre la fiche de l'indicateur (INDICATEURS.md). Chaque graphique a un menu : plein écran, télécharger PNG, exporter CSV, voir la requête. Depuis le lot 6 : un bouton « Comprendre cet écran » dans la barre haute ouvre un panneau de 480 px (ce que l'écran permet de décider, ce qu'on y trouve, d'où viennent les données, ce qu'il vise, ce qu'y lit chaque direction ; contenu de `src/lib/guideEcrans.ts`, le même que la présentation par écran servie à `/presentation.pdf`) ; un bouton de présentation (ou la touche P) passe en mode présentation (plein écran, rail et barre masqués, flèches pour changer d'écran, Échap pour sortir) ; sur téléphone, les trois filtres globaux sont dans le tiroir de navigation. Au changement d'écran, la page revient en haut ; un changement de filtre conserve la position de lecture.

États : chargement (squelettes de la forme exacte du contenu), erreur (message en français et bouton Réessayer, bascule automatique sur l'instantané statique avec un badge « instantané du JJ/MM »), vide (phrase utile, jamais un écran blanc).

Mobile (375 px) : une colonne, KPI en cartes empilées, graphiques en hauteur fixe 260 px, tableaux en cartes ou défilement horizontal explicite, navigation par tiroir. Tout se lit sans zoom.

## 1. Vue d'ensemble (`/`)
Objectif : en trente secondes, où en est le réseau ce mois-ci, où sont les écarts, que faire.
- Bandeau : titre « Le réseau ce mois-ci », période et comparaison actives, badge de fraîcheur.
- Rangée 1, quatre KPI animés (compteur, variation vs comparaison en points ou en pourcentage, mini courbe 12 mois) : Ventes signées, Chiffre d'affaires signé HT, Taux de marge brute, Conversion de la dernière cohorte mature (libellée « cohorte de juin, à 90 jours »).
- Rangée 2, deux blocs : Atterrissage de l'année (jauge horizontale : réalisé à date, atterrissage central, objectif, avec bornes bas et haut) et Funnel de la cohorte du mois (barres horizontales lead, RDV, devis, signature, pose, encaissement avec les taux entre étapes ; étapes rattachées au mois de création du lead, cohorte grisée tant qu'elle n'est pas mature).
- Rangée 3, trois blocs : Alertes du matin (liste datée issue des contrôles et des seuils : « Bordeaux Métropole : coût par vente des leads achetés +42 % vs T1 », « Nord : 41 dossiers à qualifier, référentiel en cours d'alignement », « Bassin d'Arcachon : carnet de pose à 14 jours ouvrés (+40 % sur douze semaines) »), Agences (tableau compact : agence, ventes, écart objectif, marge brute, résultat d'agence, délai de pose, une pastille de statut), Carte miniature (les neuf agences simulées au centre de leur bassin sur les onze départements, taille du point = ventes du mois ; clic vers Territoires).
- Rangée 4 : « Ce que dit le mois » : trois phrases générées par la fonction expliquer-ecart sur le réseau entier (faits SQL, prose modèle, sources) ; si l'IA est indisponible, trois phrases calculées par règles (modèle de phrases dans `src/lib/phrases.ts`).
Histoires visibles : H2 (alerte coût par vente Bordeaux Métropole), H4 (alerte Nord), H7 (alerte pose Bassin d'Arcachon).

## 2. Territoires (`/territoires`)
Objectif : lire le marché réel des territoires couverts et alentour.
- Carte de France par département (ECharts geo, fond nuit, contours fins) colorée par l'indice de potentiel (0 à 100). Les onze départements du périmètre simulé (qui reprend les bassins publiés par Butagaz Eco-énergie, sans en nommer les agences) sont détourés en ambre. Survol : département, indice, maisons propriétaires, résidences au fioul, au gaz citerne, maisons F ou G, installations solaires, installateurs RGE PAC et PV. Clic : zoom communes.
- Panneau droit « Composantes de l'indice » : cinq barres en rang centile (volume de propriétaires, intensité fioul et citerne, intensité F ou G, frein concurrence, saturation solaire) avec les poids, curseurs pour modifier les poids (recalcul dans `src/lib/indice.ts`, testé), bouton « Réinitialiser ». Un lien « Méthode » explique la formule et rappelle que l'indice n'est pas une recommandation.
- Sous la carte, tableau des départements triable et exportable : les onze du périmètre en tête, puis les autres. Colonnes : département, indice, volume (propriétaires), intensité (part fioul et citerne, part F ou G), maisons, fioul, citerne, solaire pour 1 000 maisons, RGE PAC et PV pour 10 000 maisons, agence simulée couvrant.
- Vue communes (après clic) : carte des communes du département colorée par potentiel, point de l'agence simulée du bassin et, en option, les installateurs RGE PAC ou PV (points fins, sans mise en avant d'aucun nom), liste des vingt premières communes, retour au niveau France.
- Bloc « Le parc gaz en citerne » : carte de chaleur des départements par résidences au gaz citerne ou bouteille, texte : « mode de chauffage fréquent hors réseau de gaz, souvent en maison individuelle : un parc à convertir, à lire comme tel ». Aucune allusion à une base clients d'un groupe.
Sources affichées : Insee Logement 2022 (Licence Ouverte 2.0), ADEME liste RGE (date du jour de l'ingestion), RTE registre au 31 juillet 2026, ADEME DPE (date d'ingestion). Aucune donnée simulée sur cet écran, sauf la position des neuf agences simulées, placées au centre de leur bassin et étiquetées « agence simulée ». Les implantations réelles ne sont ni affichées ni nommées.

## 3. Funnel et leads (`/funnel`)
Objectif : où se perd la conversion, quel canal vaut son coût, quels leads attendent.
- KPI : Leads, Taux de RDV, Taux de devis, Taux de signature, Coût par lead, Coût par vente.
- Sankey lead vers RDV vers devis vers signature vers pose vers encaissement, avec les branches sortantes (sans RDV, sans devis, devis non signés, annulations ; en gris « à date » tant que la cohorte n'a pas 90 jours, la donnée ne distinguant pas un refus d'un devis pas encore signé) ; filtre canal et agence ; animation de redessin.
- Matrice canal × agence : taux de conversion global avec couleur, volume en taille de cellule ; tri par colonne.
- Courbe 20 mois : leads et ventes par canal (empilé), avec l'objectif de leads.
- Tableau « Qualité des leads par canal » : leads, taux RDV, taux signature, coût, coût par vente, délai lead vers RDV, avec une pastille « à revoir » quand coût par vente supérieur à 1,3 fois la médiane.
- Bloc « Leads sans RDV planifié » : nombre de leads créés depuis plus de 48 h sans rendez-vous planifié, par agence, courbe 8 semaines, lien vers le plan d'action correspondant.
Histoires : H2 (Bordeaux Métropole, leads achetés), H1 (Marensin, RDV vers devis en baisse de mars à juin 2026), H6 (saisonnalité par produit visible sur la courbe).

## 4. Ventes et marge (`/ventes`)
Objectif : CA, marge, panier, remises, mix, et l'explication des écarts.
- KPI : CA signé HT, CA posé HT, Taux de marge brute, Panier moyen, Remise moyenne, Taux d'annulation.
- Cascade de l'écart de CA vs comparaison : effet volume, effet mix, effet prix, effet remise, résiduel (formule ECART_CA d'INDICATEURS.md, résiduel sous 3 %) ; « n. d. » avec la raison quand la comparaison n'existe pas ; bouton « Expliquer » (Edge Function) qui rend constat, causes, action, sources ; repli par règles.
- Barres empilées mensuelles par produit (CA) et courbe du taux de marge.
- Matrice agence × produit : marge en couleur, CA en taille.
- Tableau des agences : CA, écart objectif, écart N-1, marge brute, marge après acquisition, résultat d'agence, remise, annulations, avec tri et export. C'est le tableau qui répond à « quelle agence gagne de l'argent ».
- Bloc « Remises » : distribution des remises par agence (boîtes à moustaches sur les devis de la période, moustaches aux 10e et 90e centiles) et phrase de méthode assemblée depuis `src/lib/remise.ts` : pente retrouvée par régression à effets fixes agence avec son intervalle à 95 %, comparée à l'hypothèse posée dans le générateur (Saintonge : +4 points de signature pour +5 points de remise), puis la lecture économique (niveau de remise qui maximise la marge, ou pente qu'il faudrait pour qu'une remise de 8 % soit le bon niveau) (ELAST_REMISE, INDICATEURS.md). Jamais formulée comme une règle applicable à un réseau réel.
Histoires : H3 (Saintonge, remises), H5 (annulations élevées dans les départements couverts à distance), H6.

## 5. Forecast et atterrissage (`/forecast`)
Objectif : où finit l'année, avec quelles hypothèses, quels risques et opportunités.
- Graphique en éventail : réalisé mensuel, atterrissage bas, central, haut, objectif annuel, ligne « aujourd'hui ».
- Panneau hypothèses : pipe pondéré par tranche d'âge des devis (montants réels, taux de signature observés à 0 à 30, 31 à 60, 61 à 90 jours), run-rate trois mois saisonnalisé au-delà des 45 jours couverts par le pipe, écart-type mensuel et intervalle à 68 %, avec les valeurs et un curseur « taux de signature du pipe » pour tester une hypothèse (recalcul dans `src/lib/forecast.ts`, testé, sans écrire en base).
- Tableau par agence : réalisé à date, objectif, atterrissage central, écart, probabilité d'atteinte (part des scénarios au-dessus de l'objectif), pastille.
- Bloc « Risques et opportunités » : listes calculées par règles (« Bassin d'Arcachon : 31 poses en retard, CA posé à risque 380 k€ », « Saintonge : pipe devis +18 % vs N-1 ») avec le montant et la date de calcul.
Histoires : H7 (Bassin d'Arcachon), H1, H3.

## 6. Pose et encaissement (`/pose`) (palier B)
- KPI : Délai signature vers pose (médiane), Poses dans les délais, Carnet de pose (jours ouvrés), Encaissé, En attente d'encaissement, Aides en attente (montant simulé, mandat financier).
- Calendrier de charge par agence (heatmap semaine × agence : poses planifiées vs capacité).
- Courbe du délai de pose par département (agence sur place vs département couvert à distance).
- Tableau encaissement : délai pose vers encaissement par agence, retards, aides en attente.
Histoires : H5, H7.

## 7. Plans d'action et rituels (`/plans-action`) (palier B)
- Tableau des plans d'action : levier, agence, propriétaire, gain attendu chiffré, statut, échéance, avancement, lien vers l'indicateur suivi. Douze plans simulés, cohérents avec les histoires (« Bordeaux Métropole : plafonner les leads achetés à 60 par mois, gain attendu +9 k€ de marge »).
- Rituels : calendrier des revues (pipe hebdomadaire, marge mensuelle, forecast mensuel, performance trimestrielle) avec l'ordre du jour type et les indicateurs de chaque revue.
- Revue hebdomadaire générée : dernière revue (lundi 07:00, n8n) en trois blocs (faits, lecture, décisions proposées), archive des précédentes, bouton PDF (palier C).

## 8. Qualité et référentiels (`/qualite`)
Objectif : la confiance dans le chiffre, rendue visible.
- Score de qualité du jour (0 à 100, part des contrôles OK pondérée) et courbe 90 jours.
- Douze contrôles (DONNEES.md §4.6) : nom, règle, résultat du matin (OK, alerte, KO), nombre de lignes concernées, tendance, lien vers les lignes (échantillon).
- Fraîcheur des sources : Insee, RGE, RTE, DPE, journée simulée : date de référence, date d'ingestion, prochaine mise à jour.
- Référentiels : agences, canaux, produits, statuts avec version et date ; l'agence Nord montre la réconciliation des libellés produits (avant, après).
- Lignage : schéma sources vers staging vers mart vers écrans (SVG animé simple).
Histoire : H4.

## 9. Automatisations (`/automatisations`) (palier B)
- Cinq workflows n8n : nom, déclencheur, dernière exécution, durée, statut, prochaine exécution, description en une phrase, lien vers l'export JSON.
- Journal des 50 dernières exécutions (table `automatisation_run`).
- Schéma du flux : n8n vers Supabase (RPC) vers vues vers application, Edge Functions pour l'IA.

## 10. Analyste (`/analyste`) (palier B)
- Titre « Vérifier un chiffre avant de décider ». Sous-titre : ce qu'on peut demander (questions de fait sur les indicateurs, agences, canaux, produits, périodes, qualité, marché des territoires) et où va le pourquoi d'un écart (bouton Expliquer de Ventes et marge). La question se suffit : les filtres de la barre haute ne sont pas transmis.
- Zone de question avec six suggestions cliquables ; réponse en trois cartes, dans cet ordre : la réponse en français (badge simulé ou marché réel calculé depuis les vues citées, pastille « aucun nombre hors des lignes », sources calculées par le programme : vues, période bornée à la journée publiée, nature des données, puis modèle, durée en secondes, coût), les chiffres (tableau des lignes exactes, en-têtes en alias SQL, codes traduits en libellés), la requête SQL exécutée (carte repliée, mise en forme d'affichage, bouton « Copier la requête »).
- Historique de session (local, heure et statut), garde-fous affichés (mécanisme, lecture seule, SELECT validé, contrôle des nombres en chiffres, en lettres et en signe, refus, quotas) avec le budget du jour en dernière ligne.
- Refus explicites, motif fixe seul : conseil (renvoi vers Territoires), hors périmètre, données non couvertes (renvoi vers Méthode), écriture. Statut « quota » à part (« Analyste en pause »), repli (« Analyste indisponible »), erreur (« Pas de réponse »).

## 11. Méthode et auteur (`/methode`)
- Ce que c'est, ce que ce n'est pas (disclaimer complet).
- Les sources réelles avec liens, licences, dates.
- Le modèle de simulation : agences nommées par bassin (jamais celles d'un réseau réel), effectifs codés, canaux, produits, règles, ordres de grandeur à vérifier, les sept histoires listées explicitement (le recruteur peut vérifier qu'il les a vues), et la phrase : « aucune agence, personne ou entité réelle n'est associée à une performance simulée ».
- Le contexte public, cité une seule fois : les dix départements et huit agences publiés par Butagaz Eco-énergie sur son site (aucun rachat réel n'est cité depuis le 19 septembre) ; le maillage simulé reprend ces bassins, pas ces agences.
- L'architecture en un schéma, les outils (Supabase, n8n, Edge Functions, Claude ou Mistral, React, ECharts), le principe « faits SQL, prose modèle ».
- Documents : liens vers la fiche de présentation (`/fiche.pdf`) et la synthèse d'une page (`/synthese.pdf`), copiées depuis `docs/FICHE.pdf` et `docs/SYNTHESE.pdf` à la construction par `scripts/copier-documents.ts`.
- L'auteur : trois lignes, lien LinkedIn, lien CV PDF, lien RenovScope et CoPilote Atelier, adresse de contact.
- Export Power BI : bouton zip (CSV des vues mart et `modele_etoile.md` au palier A ; `mesures.dax` et `LISEZMOI.md` ajoutés au palier B).
