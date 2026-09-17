export const SOURCES_REELLES = [
  {
    nom: "Insee, Logement en 2022",
    contenu: "Residences principales, maisons, proprietaires, mode de chauffage, a la commune",
    licence: "Licence Ouverte 2.0",
    reference: "Millesime 2022, verifie le 17 septembre 2026",
    lien: "https://www.insee.fr/fr/statistiques/fichier/8581474/base-cc-logement-2022_csv.zip",
  },
  {
    nom: "ADEME, liste des entreprises RGE",
    contenu: "Qualifications pompe a chaleur, photovoltaique, chauffe-eau thermodynamique en cours de validite",
    licence: "Licence Ouverte 2.0",
    reference: "Ingestion quotidienne",
    lien: "https://data.ademe.fr/datasets/liste-des-entreprises-rge-2",
  },
  {
    nom: "RTE (ODRE), registre des installations",
    contenu: "Installations et puissance solaire raccordees, par commune",
    licence: "Licence Ouverte 2.0",
    reference: "Au 31 juillet 2026",
    lien: "https://odre.opendatasoft.com/explore/dataset/registre-national-installation-production-stockage-electricite-agrege",
  },
  {
    nom: "ADEME, DPE logements existants",
    contenu: "Maisons etiquette F ou G, energie de chauffage (fioul, GPL, propane, butane)",
    licence: "Licence Ouverte 2.0",
    reference: "Ingestion hebdomadaire",
    lien: "https://data.ademe.fr/datasets/dpe03existant",
  },
  {
    nom: "Contours geographiques",
    contenu: "Departements et communes du perimetre, simplifies pour la carte",
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
      "Changement d'organisation commerciale en fevrier 2026 : taux RDV vers devis en retrait de 10 points de mars a juin 2026, retour progressif ensuite.",
  },
  {
    code: "H2",
    titre: "Bordeaux Metropole",
    texte:
      "Leads achetes doubles a partir d'avril 2026 : volume en hausse, taux de RDV en baisse, cout par vente du canal en nette hausse vs premier trimestre.",
  },
  {
    code: "H3",
    titre: "Saintonge",
    texte:
      "Taux de remise porte de 4 % a 9 % a partir d'avril 2026 : conversion gagnee, marge perdue.",
  },
  {
    code: "H4",
    titre: "Nord",
    texte:
      "Agence integree en juin 2026 : ecarts de referentiels typiques d'une integration, reconcilies et decroissants semaine apres semaine.",
  },
  {
    code: "H5",
    titre: "Departements couverts a distance",
    texte: "Delai de pose et taux d'annulation plus eleves que dans les departements avec agence sur place.",
  },
  {
    code: "H6",
    titre: "Saisonnalite",
    texte: "Photovoltaique au printemps, pompes a chaleur et poeles a l'automne, aout creux partout.",
  },
  {
    code: "H7",
    titre: "Bassin d'Arcachon",
    texte:
      "Capacite de pose reduite de 25 % de mai a aout 2026 : carnet de pose allonge, CA pose en retrait alors que le CA signe tient.",
  },
] as const;

export const OUTILS = [
  { nom: "React, Vite, TypeScript", role: "Application, statique, deployee sur le VPS" },
  { nom: "Supabase (Postgres, RLS, Edge Functions)", role: "Schema buta, vues mart_, fonctions IA" },
  { nom: "n8n", role: "Automatisations quotidiennes et hebdomadaires, journalisees" },
  { nom: "Claude (repli Mistral)", role: "Redige a partir de faits calcules en SQL, ne calcule jamais un chiffre" },
  { nom: "ECharts", role: "Graphiques (Sankey, cascade, eventail, cartes)" },
] as const;
