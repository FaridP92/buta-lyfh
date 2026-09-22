/**
 * Guide de lecture de chaque écran, pour un lecteur qui n'est pas du métier du pilotage :
 * ce que l'écran permet de décider, ce qu'on y trouve, d'où viennent les données, ce qu'il vise,
 * et ce qu'y lit chacun des quatre profils rencontrés dans un processus de recrutement
 * (direction des ressources humaines, direction régionale, direction commerciale, direction financière).
 *
 * Une seule source : le panneau « Comprendre cet écran » de l'application et la fiche de
 * présentation par écran (`npm run presentation`) lisent ce module. Aucun chiffre ici : les
 * valeurs bougent chaque matin, le guide décrit les mécanismes.
 */
export type CodeProfil = "drh" | "regional" | "commercial" | "cfo";

export interface Profil {
  code: CodeProfil;
  libelle: string;
  /** Ce que ce lecteur cherche en ouvrant le cockpit. */
  attente: string;
  /** Écrans à ouvrir en premier, dans l'ordre. */
  parcours: readonly string[];
}

export interface GuideEcran {
  chemin: string;
  libelle: string;
  /** La question à laquelle l'écran répond, telle que son titre la pose. */
  question: string;
  /** Ce que l'écran permet de décider, en une phrase. */
  decision: string;
  /** Ce qu'on y trouve, bloc par bloc. */
  contenu: readonly string[];
  /** D'où viennent les données affichées. */
  sources: readonly string[];
  /** Ce que l'écran vise, au-delà de l'affichage. */
  vise: readonly string[];
  /** Ce qu'y lit chaque profil. */
  lectures: Readonly<Record<CodeProfil, string>>;
}

export const PROFILS: readonly Profil[] = [
  {
    code: "drh",
    libelle: "Direction des ressources humaines",
    attente: "Comment le candidat structure un poste transverse : rituels, plans d'action avec propriétaires, lecture des équipes sans exposer les personnes, capacité à intégrer une entité nouvelle.",
    parcours: ["/", "/plans-action", "/qualite", "/pose", "/methode"],
  },
  {
    code: "regional",
    libelle: "Direction régionale",
    attente: "Ce que le cockpit dit d'une agence face aux autres : écarts, marge, carnet de pose, leads en attente, et les leviers concrets qui lui sont proposés.",
    parcours: ["/", "/ventes", "/funnel", "/pose", "/territoires", "/plans-action"],
  },
  {
    code: "commercial",
    libelle: "Direction commerciale",
    attente: "Où se perd la conversion, quel canal vaut son coût, ce que coûtent les remises, et où finit l'année avec quelles hypothèses.",
    parcours: ["/funnel", "/ventes", "/forecast", "/plans-action", "/analyste"],
  },
  {
    code: "cfo",
    libelle: "Direction financière",
    attente: "La fiabilité du chiffre : définitions écrites, contrôles quotidiens, décomposition des écarts, marge après acquisition et résultat par agence, trésorerie et forecast avec intervalle.",
    parcours: ["/qualite", "/ventes", "/forecast", "/pose", "/automatisations", "/methode"],
  },
];

const MARCHE = "Marché réel : Insee (Logement 2022), ADEME (installateurs RGE et base DPE), RTE (registre des installations solaires), contours Etalab ; Licence Ouverte 2.0, source et date de référence affichées en bas de l'écran.";
const SIMULE = "Activité simulée : leads, rendez-vous, devis, ventes, poses, encaissements, coûts et objectifs d'un réseau de neuf agences nommées par bassin géographique ; générateur déterministe dont les hypothèses sont écrites sur la page Méthode. Aucune donnée d'entreprise réelle.";
const VUES = "Chaque chiffre vient d'une vue SQL documentée (préfixe mart_), jamais d'un calcul dans l'interface ; le bouton « i » de chaque indicateur ouvre sa fiche : définition, formule, grain, source.";

export const GUIDES_ECRANS: readonly GuideEcran[] = [
  {
    chemin: "/",
    libelle: "Vue d'ensemble",
    question: "Le réseau ce mois-ci",
    decision: "Savoir en trente secondes où en est le réseau, où sont les écarts et quoi traiter ce matin.",
    contenu: [
      "Quatre compteurs : ventes signées, chiffre d'affaires signé hors taxes, taux de marge brute, conversion du lead à la vente. Le mois en cours est comparé à l'objectif au prorata des jours publiés, sinon la comparaison serait fausse.",
      "L'atterrissage de l'année : réalisé à date, atterrissage central, bornes basse et haute, objectif annuel et probabilité de l'atteindre.",
      "Le funnel du mois : leads, rendez-vous, devis, signatures, poses, encaissements, avec le taux entre chaque étape ; grisé tant que la cohorte a moins de quatre-vingt-dix jours.",
      "Les alertes du matin, calculées par règles et datées, le tableau des agences avec leur écart à l'objectif, et une carte des neuf agences simulées.",
      "« Ce que dit le mois » : trois phrases assemblées à partir des faits, et un bouton qui demande au modèle de langage une explication rédigée sur ces mêmes faits.",
    ],
    sources: [SIMULE, VUES],
    vise: [
      "Donner une lecture commune à toute la direction : les mêmes chiffres, définis de la même façon, à la même date.",
      "Faire remonter les anomalies avant qu'on les cherche : chaque alerte est datée et renvoie vers l'écran qui la détaille.",
      "Montrer que le pilotage tient debout même quand le réseau est sous l'objectif : c'est le scénario simulé.",
    ],
    lectures: {
      drh: "L'ordre du jour d'un point quotidien : trois phrases, des alertes nommées, aucune personne désignée (les effectifs sont des codes).",
      regional: "Le tableau des agences : qui tient l'objectif, qui décroche, et la carte qui situe chaque bassin.",
      commercial: "Les compteurs de ventes et de conversion, le funnel du mois, l'alerte sur le coût d'un canal d'acquisition.",
      cfo: "Le chiffre d'affaires contre l'objectif proratisé, la marge brute, l'atterrissage annuel avec son intervalle et sa probabilité.",
    },
  },
  {
    chemin: "/territoires",
    libelle: "Territoires",
    question: "Où est le potentiel non servi",
    decision: "Lire le marché réel des départements couverts et alentour, avec des poids que l'on peut discuter en réunion.",
    contenu: [
      "Une carte de France des quatre-vingt-seize départements colorée par un indice de potentiel de 0 à 100 ; les onze départements du périmètre simulé sont détourés. Au survol : propriétaires occupants, résidences au fioul et au gaz citerne, maisons classées F ou G, installations solaires, installateurs qualifiés RGE.",
      "Les composantes de l'indice avec des curseurs : volume de propriétaires, chauffage au fioul ou au gaz citerne, passoires thermiques, concurrence des installateurs RGE, saturation solaire. Le recalcul se fait à l'écran, un bouton remet les poids de référence.",
      "Le tableau des départements, triable et exportable, puis la vue des communes d'un département avec l'agence simulée du bassin et les installateurs RGE en points, sans nom.",
      "Le parc au gaz en citerne, carte à part : un mode de chauffage fréquent hors réseau de gaz, à lire comme un parc à convertir.",
    ],
    sources: [MARCHE, "Seule donnée simulée sur cet écran : la position des neuf agences, placées au centre de leur bassin. Les implantations réelles ne sont ni affichées ni nommées."],
    vise: [
      "Situer l'activité d'un réseau dans son marché : combien de maisons, combien de logements à convertir, combien de concurrents qualifiés.",
      "Rendre l'indice discutable plutôt qu'imposé : les poids se voient, se changent, se réinitialisent.",
      "Ne jamais glisser vers une recommandation d'implantation : l'écran le rappelle en toutes lettres.",
    ],
    lectures: {
      drh: "La taille de chaque territoire et sa distance à une agence : un point de départ pour parler dimensionnement des équipes et couverture.",
      regional: "Le potentiel département par département, la couverture à distance, et les communes d'un bassin en un clic.",
      commercial: "Où sont les propriétaires de maisons chauffées au fioul ou au gaz citerne, et où la concurrence RGE est déjà dense.",
      cfo: "Des données publiques, sourcées et datées, qui donnent un ordre de grandeur du marché adressable sans dépendre d'une étude achetée.",
    },
  },
  {
    chemin: "/funnel",
    libelle: "Funnel et leads",
    question: "Où se perd la conversion",
    decision: "Identifier l'étape où la conversion se perd, le canal qui ne vaut pas son coût et les leads qui attendent.",
    contenu: [
      "Six compteurs en cohortes : leads, taux de rendez-vous, taux de devis, taux de signature, coût par lead, coût par vente. Les taux se mesurent sur la dernière cohorte close à quatre-vingt-dix jours : un lead du mois n'a pas fini de convertir.",
      "Le diagramme de flux du lead à l'encaissement, avec les branches sortantes (sans rendez-vous, sans devis, devis non signés, annulations) ; il se redessine quand on change d'agence ou de canal.",
      "La matrice canal par agence (conversion en couleur, volume en trait) et vingt mois de leads par canal avec les ventes nettes en courbe.",
      "La qualité des leads par canal, avec une pastille « à revoir » quand le coût par vente dépasse 1,3 fois la médiane, et les leads sans rendez-vous planifié à quarante-huit heures, par agence.",
    ],
    sources: [SIMULE, VUES, "Les coûts d'acquisition par canal sont des ordres de grandeur écrits dans la documentation (prix d'un lead acheté, budget terrain mensuel, prime de parrainage, commission partenaire)."],
    vise: [
      "Mesurer la conversion honnêtement : par cohorte de création du lead, jamais en divisant les ventes d'un mois par les leads du même mois.",
      "Comparer les canaux à coût égal : un canal qui apporte du volume mais signe peu se voit au coût par vente.",
      "Donner un levier immédiat : les leads sans rendez-vous à quarante-huit heures sont une file d'attente à traiter, pas une statistique.",
    ],
    lectures: {
      drh: "La charge de qualification par agence (leads en attente) et l'effet d'un changement d'organisation commerciale sur les taux, lisible mois après mois.",
      regional: "La matrice canal par agence : ce que chaque agence convertit sur chaque canal, et la file des leads à rappeler.",
      commercial: "Le flux complet, les branches où l'on perd, le canal à revoir et le rythme de prise de rendez-vous.",
      cfo: "Le coût par vente par canal, calculé sur des cohortes mûres, et le poids de l'acquisition dans le chiffre d'affaires.",
    },
  },
  {
    chemin: "/ventes",
    libelle: "Ventes et marge",
    question: "D'où vient l'écart de chiffre d'affaires",
    decision: "Expliquer un écart de chiffre d'affaires par ses causes et dire quelle agence gagne de l'argent.",
    contenu: [
      "Six compteurs : chiffre d'affaires signé, chiffre d'affaires posé, taux de marge brute, panier moyen, remise moyenne, taux d'annulation à soixante jours (affiché « n. d. » tant que la période n'a pas soixante jours).",
      "La cascade de l'écart contre l'objectif ou l'année précédente : effet volume, effet mix produit, effet prix, effet remise, résiduel. Le bouton « Expliquer » demande au modèle une lecture rédigée à partir de ces faits.",
      "Le chiffre d'affaires par produit sur douze mois avec le taux de marge en courbe : la saisonnalité se lit (photovoltaïque au printemps, chauffage à l'automne).",
      "« Quelle agence gagne de l'argent » : chiffre d'affaires, écarts, marge brute, marge après coûts d'acquisition, résultat d'agence, ventes par commercial, remise, annulations.",
      "La matrice agence par produit, les annulations à distance contre sur place, et la distribution des remises par agence avec une phrase de méthode : combien de points de signature rapporte un point de remise, et à quel niveau la remise cesse de payer.",
    ],
    sources: [SIMULE, VUES, "Les coûts de revient (matériel, pose) sont fixés au prix catalogue de chaque dossier ; les charges d'agence sont des ordres de grandeur documentés."],
    vise: [
      "Remplacer « on est en retard » par « voilà d'où vient le retard » : volume, mix, prix ou remise, en euros.",
      "Lire la marge jusqu'au résultat d'agence, coûts d'acquisition et charges déduits, pour savoir qui gagne vraiment de l'argent.",
      "Mesurer la remise au lieu de la subir : la pente retrouvée par régression dit ce qu'un point de remise rapporte en signature.",
    ],
    lectures: {
      drh: "Les ventes par commercial (codes, jamais de noms) et l'effet d'une politique de remise sur la marge : matière à objectifs et à variable.",
      regional: "Son agence dans le tableau : écart, marge, résultat, remise moyenne, et la matrice produit qui montre ce qu'elle vend.",
      commercial: "La cascade de l'écart, la saisonnalité par produit, le panier moyen, et la phrase sur les remises qui chiffre le compromis conversion contre marge.",
      cfo: "La décomposition de l'écart, la marge après acquisition, le résultat par agence, les annulations, et l'explication du résultat négatif en cours de mois (coûts engagés avant la marge).",
    },
  },
  {
    chemin: "/forecast",
    libelle: "Forecast et atterrissage",
    question: "Où finit l'année",
    decision: "Dire où l'année atterrit, avec quelles hypothèses, quel intervalle, quels risques et quelles opportunités.",
    contenu: [
      "L'éventail d'atterrissage : réalisé cumulé, objectif, atterrissage central et intervalle à 68 %, avec la ligne de la journée publiée.",
      "Les hypothèses écrites et chiffrées : devis en cours et leur montant, taux de signature observés par âge du devis, taux d'annulation, pipe pondéré, run-rate saisonnalisé, part retenue au-delà des quarante-cinq jours couverts par le pipe. Réalisé plus pipe plus part retenue égale l'atterrissage central : on peut le refaire de tête.",
      "Un curseur « taux de signature du pipe » qui recalcule l'atterrissage sans rien écrire : « et si le pipe signait à 20 % ? ».",
      "Le tableau par agence : réalisé, objectif, central, bornes, écart, probabilité d'atteinte, pipe pondéré.",
      "Les risques et les opportunités calculés par règles, avec le montant et la date de calcul.",
    ],
    sources: [SIMULE, VUES, "La probabilité d'atteinte vient de tirages sur le run-rate (graine fixe) ; l'intervalle repose sur l'écart-type mensuel observé sur douze mois."],
    vise: [
      "Sortir du chiffre magique : un forecast, c'est une formule visible, des hypothèses écrites et un intervalle.",
      "Permettre de tester un scénario en réunion sans toucher à la base.",
      "Donner à chaque agence son atterrissage et sa probabilité, pour décider tôt où porter l'effort.",
    ],
    lectures: {
      drh: "Une méthode de prévision explicable, qui se transmet : les hypothèses tiennent dans un panneau et se rejouent au curseur.",
      regional: "L'atterrissage de son agence, son intervalle, ses poses en retard et son pipe : ce qui est engagé et ce qui manque.",
      commercial: "Le pipe pondéré par âge des devis, le curseur de taux de signature et les devis qui vieillissent.",
      cfo: "L'intervalle, la probabilité d'atteinte, la part de projection dans l'atterrissage et le montant à trouver par rapport à l'objectif.",
    },
  },
  {
    chemin: "/pose",
    libelle: "Pose et encaissement",
    question: "Ce qui est signé et pas encore posé",
    decision: "Suivre le délai entre signature et pose, la charge des équipes techniques et ce qui reste à encaisser.",
    contenu: [
      "Six compteurs : délai médian de la signature à la pose, poses dans les délais, carnet de pose en jours ouvrés, encaissé, en attente d'encaissement, aides en attente (avancées par l'installateur, hypothèse de simulation).",
      "Le calendrier de charge semaine par agence, en part de la capacité des techniciens : semaines réalisées, semaine en cours, semaines planifiées, surcharge au-delà de 100 % en rouge.",
      "Le délai de pose sur place contre à distance sur douze mois : la distance se paie en délai, puis en annulations.",
      "Une lecture du carnet par règles, et le tableau encaissement et carnet par agence (délai de la pose à l'encaissement, retards, aides en attente, poses en retard).",
    ],
    sources: [SIMULE, VUES, "La capacité de pose vient des techniciens actifs et de la durée de pose de chaque produit, écrites dans le référentiel de l'écran Qualité."],
    vise: [
      "Rappeler que le chiffre d'affaires signé ne vaut que s'il est posé puis encaissé.",
      "Rendre visible la capacité technique et sa saturation, semaine par semaine, agence par agence.",
      "Chiffrer le coût de la distance : délais plus longs et annulations plus fréquentes dans les départements sans agence.",
    ],
    lectures: {
      drh: "La charge des équipes de pose et sa saturation : où renforcer, où lisser, avant que les retards ne s'installent.",
      regional: "Son carnet, ses poses en retard, ses semaines en surcharge, et ce que la couverture à distance lui coûte.",
      commercial: "Les poses en retard qui menacent des ventes déjà signées, et le délai promis au client contre le délai tenu.",
      cfo: "L'encaissé, l'attente d'encaissement, les aides avancées en trésorerie, et le chiffre d'affaires posé qui décroche du signé quand la capacité manque.",
    },
  },
  {
    chemin: "/plans-action",
    libelle: "Plans d'action et rituels",
    question: "Ce qu'on a décidé de changer",
    decision: "Tenir la liste des leviers engagés, avec un propriétaire, un gain attendu, une échéance, et le calendrier des revues qui en parlent.",
    contenu: [
      "Douze plans d'action simulés, cohérents avec les situations plantées dans le jeu : levier, agence ou réseau, propriétaire (code), gain de marge attendu, statut, échéance, avancement déclaré, indicateur suivi.",
      "La revue hebdomadaire en trois blocs, faits, lecture, décisions proposées, rédigée à partir des faits SQL de la semaine (par règles, ou par le modèle chaque lundi matin avec chaque nombre vérifié), et l'archive des semaines précédentes.",
      "Quatre rituels : revue de pipe hebdomadaire, revue de marge mensuelle, revue de forecast mensuelle, revue de performance trimestrielle, chacun avec sa durée, ses participants, son ordre du jour et ses indicateurs.",
    ],
    sources: [SIMULE, "Les plans d'action sont des exemples écrits pour la simulation ; la revue hebdomadaire lit les vues SQL de la semaine et n'invente aucun nombre."],
    vise: [
      "Fermer la boucle : une analyse qui ne devient pas un plan avec un propriétaire et une date n'a pas servi.",
      "Donner un format de revue régulier, court, où les faits précèdent la lecture et la lecture précède la décision.",
      "Montrer les rituels d'un poste de pilotage tels qu'ils se tiendraient, avec les indicateurs de chacun.",
    ],
    lectures: {
      drh: "Des rituels avec participants, durée et ordre du jour ; des plans portés par un propriétaire identifié par un code, jamais par un nom.",
      regional: "Les leviers proposés pour son agence, leur avancement, et ce qu'on lui demandera à la prochaine revue de pipe.",
      commercial: "Les plans sur les leads, les remises, les relances à quarante-huit heures, et la revue hebdomadaire qui en suit l'effet.",
      cfo: "Le gain de marge attendu de chaque plan, distinct du chiffre d'affaires qu'il protège, et la revue mensuelle de marge et de forecast.",
    },
  },
  {
    chemin: "/qualite",
    libelle: "Qualité et référentiels",
    question: "Peut-on faire confiance au chiffre",
    decision: "Vérifier chaque matin que les données sont cohérentes, fraîches et alignées sur un référentiel commun avant de lire un chiffre.",
    contenu: [
      "Le score de qualité du jour (part pondérée des contrôles réussis, poids triple pour un contrôle bloquant) et sa courbe sur les journées publiées.",
      "Douze contrôles de cohérence : dossier sans agence ou sans canal, statut incohérent avec les dates, dates non chronologiques, doublon probable, montant hors bornes, remise excessive, marge négative, libellé produit hors référentiel, objectif manquant, fraîcheur, funnel monotone. Pour chacun : la règle, le résultat, les lignes concernées, la tendance, un échantillon.",
      "La fraîcheur des sources (date de référence, date d'ingestion, prochaine mise à jour) et le lignage : des sources aux écrans, rien n'est calculé ailleurs que dans les vues.",
      "Les référentiels (agences, canaux, produits, statuts) et la réconciliation des libellés produits d'une agence intégrée : « avant, après », dossiers concernés.",
    ],
    sources: [SIMULE, "Les contrôles tournent chaque matin après la publication de la journée simulée ; leurs résultats sont journalisés. L'agence simulée « Nord », intégrée en juin, porte volontairement des écarts de référentiel décroissants."],
    vise: [
      "Rendre la confiance visible : un chiffre qu'on ne peut pas vérifier ne sert à rien.",
      "Traiter une anomalie de données avant de lire un indicateur, et l'afficher plutôt que la masquer.",
      "Montrer comment une entité nouvelle s'aligne sur un référentiel commun sans casser les comparaisons.",
    ],
    lectures: {
      drh: "La méthode d'intégration d'une entité : référentiels alignés, anomalies suivies semaine après semaine, aucune comparaison de performance avant réconciliation.",
      regional: "Ce que les contrôles disent de ses dossiers : statuts manquants, doublons, libellés à qualifier.",
      commercial: "La fraîcheur de la journée publiée et les contrôles sur les dossiers commerciaux (dates, remises, montants).",
      cfo: "Les contrôles bloquants, le score du jour, la traçabilité des sources aux écrans : la base d'un chiffre auditable.",
    },
  },
  {
    chemin: "/automatisations",
    libelle: "Automatisations",
    question: "Ce qui tourne chaque matin",
    decision: "Savoir ce qui se fait sans personne, quand, et si cela a fonctionné.",
    contenu: [
      "Les workflows de l'orchestrateur n8n : publication de la journée simulée à 06 h 00, contrôles qualité à 06 h 20 avec courriel si un contrôle bloquant échoue, revue hebdomadaire le lundi à 07 h 00, test de santé toutes les six heures, gestion des erreurs. Pour chacun : dernière et prochaine exécution, durée, statut, message, export JSON.",
      "Le journal des dernières exécutions, toutes automatisations confondues.",
      "Le schéma du flux : de l'orchestrateur à la base de données, des vues aux écrans, et les fonctions serveur qui portent l'analyste et l'explication des écarts.",
    ],
    sources: ["Journal des exécutions écrit en base par chaque workflow ; aucune donnée d'activité sur cet écran."],
    vise: [
      "Montrer que le cockpit vit sans intervention manuelle, et que chaque exécution laisse une trace.",
      "Détecter une panne avant les utilisateurs : test de santé, courriel au troisième échec consécutif.",
      "Donner un exemple d'automatisation sobre : quelques workflows lisibles, exportés, journalisés.",
    ],
    lectures: {
      drh: "Le temps libéré par l'automatisation et la trace de ce qui a été fait : matière à définir un poste et ses astreintes.",
      regional: "L'assurance que les chiffres du matin sont ceux de la veille, intégrés à heure fixe.",
      commercial: "Quand la revue hebdomadaire arrive, et pourquoi elle contient toujours les mêmes faits vérifiés.",
      cfo: "La fiabilité opérationnelle : exécutions horodatées, statuts, durées, alertes, et un coût d'infrastructure de quelques dizaines d'euros par mois.",
    },
  },
  {
    chemin: "/analyste",
    libelle: "Analyste",
    question: "Vérifier un chiffre avant de décider",
    decision: "Obtenir une réponse à une question de fait posée en français, avec la requête et les lignes exactes qui la fondent.",
    contenu: [
      "Une question libre ou l'une des six suggestions. Le modèle de langage écrit une requête SQL en lecture seule sur les vues autorisées, la base l'exécute sous un rôle limité, le modèle rédige à partir des lignes obtenues sans jamais calculer.",
      "La réponse en trois cartes : la phrase en français avec ses sources et son coût, les chiffres (les lignes exactes, exportables), la requête exécutée (copiable).",
      "Un contrôle refuse toute phrase qui contiendrait un nombre absent des lignes, en chiffres ou en lettres, ou attribué à la mauvaise ligne : les lignes restent alors la réponse.",
      "Les refus explicites (conseil, hors périmètre, données non couvertes, écriture), l'historique de la session, les garde-fous et le budget du jour.",
    ],
    sources: [SIMULE, MARCHE, "Ce qui part chez le fournisseur du modèle : le catalogue des vues, la question, la requête et quelques dizaines de lignes d'agrégats ; jamais une ligne de dossier ni un nom de personne."],
    vise: [
      "Permettre à quelqu'un qui n'écrit pas de SQL de vérifier un chiffre, avec la même exigence de preuve que pour les écrans.",
      "Montrer un usage de l'IA borné et contrôlé : elle commente des faits calculés ailleurs, elle ne produit pas de chiffre.",
      "Rendre le coût et les limites visibles : quotas, budget quotidien, refus motivés.",
    ],
    lectures: {
      drh: "Un exemple d'IA au service d'un métier, avec des garde-fous écrits, un budget et une politique de données claire.",
      regional: "Une question en français sur son agence, et la réponse appuyée sur les lignes exactes.",
      commercial: "« Quel canal a le coût par vente le plus élevé sur les cohortes du printemps ? » : la réponse, les lignes, la requête.",
      cfo: "La traçabilité totale de la réponse (requête et lignes affichées), le coût par question, et le refus de tout nombre non retrouvé.",
    },
  },
  {
    chemin: "/methode",
    libelle: "Méthode et auteur",
    question: "Ce que c'est, ce que ce n'est pas",
    decision: "Comprendre le cadre du démonstrateur avant de s'en servir : origine des données, limites, hypothèses, auteur.",
    contenu: [
      "Ce que Buta.Lyfh est et n'est pas : un démonstrateur personnel, sans lien avec Butagaz, sans logo ni couleur de marque ni chiffre présenté comme celui de l'entreprise.",
      "Les sources réelles avec leurs liens, licences et dates ; le modèle de simulation et ses sept situations plantées, pour que le lecteur puisse vérifier qu'il les a vues.",
      "Le contexte public cité une seule fois, l'architecture technique, l'export vers Power BI (tables, modèle en étoile, mesures), les documents à télécharger et l'auteur.",
    ],
    sources: [MARCHE, "Les hypothèses du générateur sont écrites ici en langage courant et dans la documentation du projet."],
    vise: [
      "Dire les limites avant qu'on les cherche : données simulées, ordres de grandeur, aucune recommandation.",
      "Donner à un lecteur pressé les documents utiles : fiche complète, présentation par écran, synthèse d'une page, CV.",
      "Montrer la méthode de construction : documentation écrite avant le code, tests, journal des décisions.",
    ],
    lectures: {
      drh: "L'auteur, sa façon de travailler, et la prudence sur les données et les personnes.",
      regional: "Les hypothèses du réseau simulé : bassins, effectifs, canaux, produits, pour ne pas confondre la simulation avec son terrain.",
      commercial: "Les sept situations plantées dans la simulation, à retrouver sur les écrans de ventes et de funnel.",
      cfo: "Les sources, les licences, les hypothèses de coûts et l'export Power BI qui permet de reprendre les chiffres dans son propre outil.",
    },
  },
];

export function guideEcran(chemin: string): GuideEcran | undefined {
  return GUIDES_ECRANS.find((g) => g.chemin === chemin);
}

export function profil(code: CodeProfil): Profil {
  const p = PROFILS.find((x) => x.code === code);
  if (!p) throw new Error(`Profil inconnu : ${code}`);
  return p;
}
