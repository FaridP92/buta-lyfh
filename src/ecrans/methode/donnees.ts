export const SOURCES_REELLES = [
  {
    nom: "Insee, Logement en 2022",
    contenu: "Résidences principales, maisons, propriétaires, mode de chauffage, à la commune",
    licence: "Licence Ouverte 2.0",
    reference: "Millésime 2022, vérifié le 17 septembre 2026",
    lien: "https://www.insee.fr/fr/statistiques/fichier/8581474/base-cc-logement-2022_csv.zip",
  },
  {
    nom: "ADEME, liste des entreprises RGE",
    contenu: "Qualifications pompe à chaleur, photovoltaïque, chauffe-eau thermodynamique en cours de validité",
    licence: "Licence Ouverte 2.0",
    reference: "Vérifié le 17 septembre 2026, rejeu mensuel par script",
    lien: "https://data.ademe.fr/datasets/liste-des-entreprises-rge-2",
  },
  {
    nom: "RTE (ODRÉ), registre des installations",
    contenu: "Installations et puissance solaire raccordées, par commune",
    licence: "Licence Ouverte 2.0",
    reference: "Au 31 juillet 2026",
    lien: "https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege",
  },
  {
    nom: "ADEME, DPE logements existants",
    contenu: "Maisons étiquette F ou G, énergie de chauffage (fioul, GPL, propane, butane)",
    licence: "Licence Ouverte 2.0",
    reference: "Vérifié le 17 septembre 2026, rejeu mensuel par script",
    lien: "https://data.ademe.fr/datasets/dpe03existant",
  },
  {
    nom: "Contours géographiques",
    contenu: "Départements et communes du périmètre, simplifiés pour la carte",
    licence: "Licence Ouverte 2.0",
    reference: "Annuelle",
    lien: "https://geo.api.gouv.fr",
  },
] as const;

export const HISTOIRES = [
  {
    code: "H1",
    titre: "Marensin",
    texte:
      "Changement d'organisation commerciale en février 2026 : taux RDV vers devis en retrait de 10 points de mars à juin 2026, retour progressif ensuite.",
  },
  {
    code: "H2",
    titre: "Bordeaux Métropole",
    texte:
      "Leads achetés doublés à partir d'avril 2026 : volume en hausse, taux de RDV en baisse, coût par vente du canal en nette hausse vs premier trimestre.",
  },
  {
    code: "H3",
    titre: "Saintonge",
    texte: "Taux de remise porté de 4 % à 9 % à partir d'avril 2026 : conversion gagnée, marge perdue.",
  },
  {
    code: "H4",
    titre: "Nord",
    texte:
      "Agence intégrée en juin 2026 : écarts de référentiels typiques d'une intégration, réconciliés et décroissants semaine après semaine. Cas d'école simulé, sans lien avec une opération ou une entité réelle.",
  },
  {
    code: "H5",
    titre: "Départements couverts à distance",
    texte: "Délai de pose et taux d'annulation plus élevés que dans les départements avec agence sur place.",
  },
  {
    code: "H6",
    titre: "Saisonnalité",
    texte: "Photovoltaïque au printemps, pompes à chaleur et poêles à l'automne, août creux partout.",
  },
  {
    code: "H7",
    titre: "Bassin d'Arcachon",
    texte:
      "Capacité de pose réduite de 25 % de mai à août 2026 : carnet de pose allongé, CA posé en retrait alors que le CA signé tient.",
  },
] as const;

export const OUTILS = [
  { nom: "React, Vite, TypeScript", role: "Application statique, déployée sur le VPS" },
  { nom: "Supabase (Postgres, RLS, Edge Functions)", role: "Schéma buta, vues mart_, fonctions IA" },
  { nom: "n8n", role: "Automatisations quotidiennes et hebdomadaires, journalisées" },
  { nom: "Claude (repli Mistral)", role: "Rédige à partir de faits calculés en SQL, ne calcule jamais un chiffre ; n'intervient que si une clé est posée côté serveur, sinon les phrases sont produites par règles et l'écran le dit" },
  { nom: "ECharts", role: "Graphiques (Sankey, cascade, éventail, cartes)" },
] as const;
