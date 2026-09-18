# Catalogue des indicateurs

Chaque indicateur a une fiche : définition, formule, grain, vue SQL, source, unité, sens de lecture. La fiche est accessible depuis l'écran (bouton « i »). Les vues `mart_` sont la seule origine des chiffres affichés ; `src/lib/` ne recalcule que ce qui dépend d'un réglage interactif (poids de l'indice, taux de signature du pipe), avec tests Vitest sur des jeux d'essai calculés à la main.

## Conventions
- Deux familles de mesures, à ne jamais mélanger dans un même graphique sans le dire :
  - Mesures d'événement : rattachées au mois de l'événement (vente au mois de signature, pose au mois de pose, encaissement au mois d'encaissement). Elles servent au chiffre d'affaires, à la marge, à la production, à la trésorerie.
  - Mesures de cohorte : toutes les étapes rattachées au mois de création du lead (`date_lead`). Elles servent au funnel et aux taux de conversion. Une cohorte est mature à 90 jours : les taux d'une cohorte de moins de 90 jours sont affichés en grisé avec la mention « cohorte en cours ».
- Comparaison : objectif (table `objectif`, grain mois × agence × produit) ou N-1 (même mois de l'année précédente). N-1 n'existe pas pour 2025 : afficher « n. d., pas d'historique 2024 ».
- Mois en cours au prorata : la journée publiée tombe en cours de mois. `mart_kpi_mensuel` et `mart_ecarts` portent `prorata` (jours publiés / jours du mois), `jours_publies` et `jours_mois` ; l'objectif, le N-1, les coûts d'acquisition et les charges d'agence du mois en cours sont multipliés par ce prorata avant comparaison (`buta.prorata_mois`). Les mois clos ont un prorata de 1. L'écran l'écrit : « vs objectif prorata (17 j sur 30) ».
- Base de l'objectif et de l'atterrissage : chiffre d'affaires signé HT net de remise. Le chiffre d'affaires posé sert au suivi de production et de trésorerie.
- Unités : taux en pourcentage à une décimale, montants en euros HT sans décimale (k€ et M€ à partir de 10 000 et 1 000 000), délais en jours (médiane). Une valeur non calculable affiche « n. d. » avec la raison au survol, jamais 0.
- Pastilles : verte au-dessus de l'objectif, ambre entre 0 et -5 %, rouge en dessous ; un indicateur « plus bas = mieux » inverse la couleur. Toujours un texte avec la couleur.

## Funnel et acquisition (cohortes, `mart_funnel`, grain mois de création × agence × canal)
| Code | Indicateur | Formule | Lecture |
|---|---|---|---|
| LEADS | Leads | dossiers créés dans le mois | volume |
| TX_RDV | Taux de RDV | dossiers avec RDV tenu / leads de la cohorte | plus haut = mieux |
| TX_DEVIS | Taux de devis | devis émis / RDV tenus | plus haut = mieux |
| TX_SIGN | Taux de signature | signatures / devis | plus haut = mieux |
| TX_CONV | Conversion lead vers vente | signatures nettes d'annulation à 90 jours / leads ; sur la Vue d'ensemble, la valeur affichée est celle de la dernière cohorte close à 90 jours, libellée par son mois de création (« cohorte de mai, à 90 jours » pour une journée publiée au 17 septembre) | plus haut = mieux |
| ATTENTE48 | Leads sans RDV planifié | leads créés depuis plus de 48 h sans `date_rdv_planifie`, à date | plus bas = mieux |
| D_LEAD_RDV | Délai lead vers RDV | médiane (date RDV tenu - date lead) | plus bas = mieux |
| CPL | Coût par lead | coût du canal / leads du canal (`mart_couts_acquisition`) | plus bas = mieux |
| CPV | Coût par vente | coût du canal / signatures nettes de la cohorte issue du canal | plus bas = mieux |
| TX_CAC | Poids de l'acquisition | coûts d'acquisition du mois / CA signé du mois | plus bas = mieux, 15 à 20 % attendu dans la simulation |

## Ventes et marge (événements, `mart_ventes_produit`, grain mois de signature × agence × produit)
| Code | Indicateur | Formule | Lecture |
|---|---|---|---|
| VENTES | Ventes signées | signatures du mois hors annulées à date | volume |
| TX_ANNUL | Taux d'annulation | annulés après signature / signatures (cohorte de signature, à 60 jours) | plus bas = mieux |
| CA_SIGNE | CA signé HT | somme des montants HT nets de remise | montant |
| CA_POSE | CA posé HT | somme des montants HT des poses du mois (`mart_pose`) | montant |
| PANIER | Panier moyen | CA signé / ventes | montant |
| REMISE | Taux de remise | somme des remises / somme des prix catalogue | plus bas = mieux, sous réserve de conversion |
| MIX | Mix produit | part de chaque produit dans le CA signé | structure |
| MARGE | Marge brute | CA signé HT moins coût matériel moins coût de pose (main d'œuvre) | montant |
| TX_MARGE | Taux de marge brute | marge brute / CA signé | plus haut = mieux |
| MARGE_ACQ | Marge après acquisition | marge brute moins coûts d'acquisition du mois (`fait_cout_canal`) moins commissions commerciales | montant |
| RESULTAT | Résultat d'agence | marge après acquisition moins charges d'agence (`charge_agence` : masse salariale commerciale et technique hors commissions, structure, véhicules) | montant ; répond à « quelle agence gagne de l'argent » |
| PROD_COM | Productivité commerciale | signatures nettes / commerciaux actifs (`mart_kpi_mensuel`) | plus haut = mieux |

### ECART_CA, décomposition de l'écart de chiffre d'affaires (`mart_ecarts`, mois × agence)
Notation : V = nombre de ventes, part_p = part du produit p dans les ventes, cat_p = prix catalogue moyen du produit p, tx = taux de remise, PN = prix net moyen = Σ part_p × cat_p × (1 - tx). Indice 1 = réalisé, 0 = comparaison (objectif ou N-1). Tous les termes sont en euros.
- Effet volume = (V1 - V0) × PN0
- Effet mix = V1 × Σ_p (part1_p - part0_p) × cat0_p × (1 - tx0)
- Effet prix = V1 × Σ_p part1_p × (cat1_p - cat0_p) × (1 - tx0)
- Effet remise = V1 × (Σ_p part1_p × cat1_p) × (tx0 - tx1)
- Résiduel = écart total - (volume + mix + prix + remise) ; il ne contient que les termes croisés et doit rester inférieur à 3 % de l'écart total, contrôlé par test SQL.
La table `objectif` porte, par mois, agence et produit : ventes, prix catalogue cible et taux de remise cible, ce qui fournit V0, part0, cat0 et tx0 pour la comparaison « objectif ».

### ELAST_REMISE, pente de la remise (`src/lib/remise.ts`, à partir de `mart_remises`)
Sur les couples agence × mois de devis clos (`periode_complete`, au moins 20 devis), régression pondérée par les devis, à effets fixes agence (centrage de x et y par agence : seule la variation de remise à l'intérieur d'une agence compte, les niveaux de signature propres à chaque agence n'entrent pas), du taux de signature des devis sur le taux de remise moyen. Sortie : pente b en points de signature par point de remise, erreur type, intervalle à 95 %. Lecture économique sous ce modèle linéaire : la marge totale D × s(r) × (m - r), avec m la marge avant remise (prix catalogue moins coûts, en part du prix catalogue), est maximale en r* = (m + r0) / 2 - s0 / (2 b) ; si r* est négatif, aucune remise ne se paie. La phrase de méthode donne la pente retrouvée avec son intervalle, la compare à l'hypothèse du générateur (H3 : +4 points de signature pour +5 points de remise), et dit soit le niveau optimal, soit la pente qu'il faudrait pour qu'une remise de référence de 8 % soit le bon niveau (b = s0 / (m + r0 - 16)). C'est une démonstration de méthode sur des données simulées, jamais une règle de gestion applicable à un réseau réel.

## Délais, pose et encaissement (`mart_delais`, `mart_pose`, `mart_encaissement`)
| Code | Indicateur | Formule | Lecture |
|---|---|---|---|
| D_SIGN_POSE | Délai signature vers pose | médiane (date pose - date signature), par agence et par département | plus bas = mieux |
| POSE_DELAI | Poses dans les délais | poses à moins de 60 jours de la signature / poses | plus haut = mieux |
| CARNET | Carnet de pose | charge restante en jours-technicien (ventes signées non posées × durée de pose du produit, `dim_produit.duree_pose_jt`) / (techniciens actifs × 0,8), en jours ouvrés | plus bas = mieux ; la durée de pose retenue par produit (`dim_produit.duree_pose_jt`) se lit dans le référentiel produits de l'écran Qualité ; alerte quand le carnet dépasse 1,3 fois la médiane des douze semaines précédentes de l'agence |
| PROD_TECH | Productivité pose | jours-technicien posés / (techniciens actifs × 5) par semaine | plus haut = mieux |
| ENCAISSE | Encaissé | somme des encaissements du mois | montant |
| D_ENCAISSE | Délai pose vers encaissement | médiane (date encaissement - date pose) | plus bas = mieux |
| AIDES_ATT | Aides en attente | montant des aides simulées non versées à date, en mandat financier (l'installateur avance l'aide et la porte en créance ; hypothèse écrite à l'écran) | montant, à surveiller |

## Forecast (`mart_forecast`, année × agence)
| Code | Indicateur | Formule | Lecture |
|---|---|---|---|
| PIPE_POND | Pipe pondéré | Σ devis en cours de moins de 90 jours : montant réel du devis × taux de signature observé pour sa tranche d'âge (0 à 30, 31 à 60, 61 à 90 jours, sur 12 mois) × (1 - taux d'annulation 6 mois) | montant |
| ATTERR | Atterrissage | réalisé à date + pipe pondéré (qui couvre les 45 prochains jours) + projection × (mois restants - 1,5) / mois restants, où projection = Σ sur les mois restants de (run-rate 3 mois × coefficient de saisonnalité du mois) ; le panneau Hypothèses affiche la projection entière et la part retenue, et leur somme avec le réalisé et le pipe redonne le central ; bornes bas et haut = central ± σ_mensuel × racine du nombre de mois restants (intervalle à 68 %), σ estimé sur 12 mois | prévision, hypothèses affichées |
| P_ATTEINTE | Probabilité d'atteinte | part des 500 tirages (run-rate bruité par σ, graine fixe) dont l'atterrissage dépasse l'objectif, arrondie à 5 points | pourcentage |

## Qualité et marché (`mart_qualite`, `mart_marche_departement`, `mart_marche_commune`)
| Code | Indicateur | Formule | Lecture |
|---|---|---|---|
| QUALITE | Score de qualité | 100 × somme pondérée des contrôles OK / somme des poids ; poids 3 pour les contrôles bloquants, 1 pour les autres (`mart_qualite`) | plus haut = mieux |
| INDICE | Indice de potentiel territorial | chaque composante en rang centile (0 à 100) sur les 96 départements métropolitains : volume = propriétaires occupants ; intensité fioul et citerne = part des résidences principales au fioul ou au gaz citerne ; intensité F ou G = part des maisons F ou G parmi les maisons diagnostiquées ; frein = installateurs RGE PAC ou PV pour 10 000 maisons ; saturation = installations solaires pour 1 000 maisons. Indice = (0,4 × volume + 0,3 × intensité fioul et citerne + 0,3 × intensité F ou G) × (1 - 0,3 × frein / 100) × (1 - 0,3 × saturation / 100). Le tableau affiche toujours les deux lectures, volume et intensité, à côté de l'indice. Poids modifiables à l'écran (`src/lib/indice.ts`) | plus haut = plus de potentiel non servi ; ce n'est pas une recommandation |

Grains : `mart_marche_departement` = un département (96, métropole), avec `perimetre` vrai pour les onze du réseau simulé, les agences simulées couvrantes, les parts (fioul et citerne, maisons F ou G) et les ratios pour 1 000 et 10 000 maisons ; `mart_marche_commune` = une commune des onze départements, mêmes colonnes, centiles et indice calculés parmi ces communes.

## Vues de service (pas d'indicateur propre, une fiche par vue)
| Vue | Grain | Contenu | Écran |
|---|---|---|---|
| `mart_alertes` | une alerte à la journée publiée | code, agence, gravité, valeur numérique, texte assemblé en SQL (coût par vente des leads achetés au-delà de +30 % vs T1, dossiers à qualifier, carnet de pose au-delà de 40 jours ouvrés, poses en retard), date de calcul | Vue d'ensemble, Forecast |
| `mart_automatisation` | une exécution n8n | workflow, début, fin, durée en secondes, statut, message, lignes, rang (1 = dernière exécution du workflow) | Automatisations |
| `mart_plans_action` | un plan d'action | levier, agence et bassin, propriétaire (code), gain attendu en euros, statut, échéance, avancement en pourcentage, indicateur suivi | Plans d'action et rituels |
| `mart_revue_hebdo` | une semaine (lundi) | faits calculés en SQL (jsonb), texte rédigé, modèle, coût en euros, date de publication, libellé de semaine | Plans d'action et rituels |
| `mart_remises` | période (mois, trimestre ou année de devis, colonne `grain`) × agence (et RESEAU) | devis émis, signatures obtenues à date, taux de signature des devis, taux de remise moyen et centiles 10, 25, 50, 75, 90, marge avant remise des dossiers signés, prix catalogue moyen, `periode_complete` (fin de période à plus de 45 jours de la journée publiée) | Ventes et marge (boîtes à moustaches, ELAST_REMISE) |
| `mart_objectif_mensuel` | mois × agence (et RESEAU), toute l'année | objectif de ventes et de CA signé HT net de remise (ventes cibles × prix catalogue cible × (1 - remise cible)), y compris les mois à venir | Forecast (trajectoire cumulée de l'objectif) |
| `mart_reconciliation_libelles` | agence × libellé produit source | libellés reçus hors référentiel, produit résolu et libellé de référence, nombre de dossiers, premier et dernier lead (H4, agence Nord) | Qualité (référentiels, « avant, après ») |
| `mart_ia_usage` | jour × fonction IA (analyste, expliquer-ecart) | appels, tokens en entrée et en sortie, coût en euros (tarif indicatif dans une constante versionnée) | Analyste (compteur « coût du jour ») |
| `mart_fraicheur` | une source de données | date de référence telle qu'affichée (pour `journee_simulee`, la journée publiée plafonnée à la veille en heure de Paris), date jusqu'à laquelle les dossiers sont publiés d'avance, date et heure d'intégration, prochaine mise à jour | Badge de fraîcheur, Qualité |
