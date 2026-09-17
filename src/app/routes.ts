import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  Gauge,
  ListChecks,
  Map as MapIcon,
  MessageSquare,
  ShieldCheck,
  Truck,
  TrendingUp,
  Waypoints,
  Workflow,
  LineChart,
} from "lucide-react";

export interface DefinitionRoute {
  chemin: string;
  libelle: string;
  icone: LucideIcon;
  /** Ecran complet des le lot 0 (Methode) ; les autres sont "a venir" jusqu'a leur lot. */
  disponible: boolean;
  palier: "A" | "B";
  lot: string;
  objectif: string;
}

export const ROUTES: DefinitionRoute[] = [
  {
    chemin: "/",
    libelle: "Vue d'ensemble",
    icone: Gauge,
    disponible: false,
    palier: "A",
    lot: "2",
    objectif: "En trente secondes : ou en est le reseau ce mois-ci, ou sont les ecarts, que faire.",
  },
  {
    chemin: "/territoires",
    libelle: "Territoires",
    icone: MapIcon,
    disponible: false,
    palier: "A",
    lot: "3",
    objectif: "Lire le marche reel des territoires couverts et alentour, departement par departement.",
  },
  {
    chemin: "/funnel",
    libelle: "Funnel et leads",
    icone: Waypoints,
    disponible: false,
    palier: "A",
    lot: "2",
    objectif: "Ou se perd la conversion, quel canal vaut son cout, quels leads attendent.",
  },
  {
    chemin: "/ventes",
    libelle: "Ventes et marge",
    icone: TrendingUp,
    disponible: false,
    palier: "A",
    lot: "2",
    objectif: "Chiffre d'affaires, marge, panier, remises, mix produit, et l'explication des ecarts.",
  },
  {
    chemin: "/forecast",
    libelle: "Forecast et atterrissage",
    icone: LineChart,
    disponible: false,
    palier: "A",
    lot: "2",
    objectif: "Ou finit l'annee, avec quelles hypotheses, quels risques et opportunites.",
  },
  {
    chemin: "/pose",
    libelle: "Pose et encaissement",
    icone: Truck,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Delai de pose, carnet de charge par agence, encaissement et aides en attente.",
  },
  {
    chemin: "/plans-action",
    libelle: "Plans d'action et rituels",
    icone: ListChecks,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Les leviers en cours, leurs proprietaires, le gain attendu, et le calendrier des revues.",
  },
  {
    chemin: "/qualite",
    libelle: "Qualite et referentiels",
    icone: ShieldCheck,
    disponible: false,
    palier: "A",
    lot: "3",
    objectif: "La confiance dans le chiffre, rendue visible : douze controles, fraicheur, referentiels.",
  },
  {
    chemin: "/automatisations",
    libelle: "Automatisations",
    icone: Workflow,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Les workflows n8n, leur derniere execution, le journal des automatisations.",
  },
  {
    chemin: "/analyste",
    libelle: "Analyste",
    icone: MessageSquare,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Poser une question en francais sur les indicateurs, avec la requete SQL et les sources.",
  },
  {
    chemin: "/methode",
    libelle: "Methode et auteur",
    icone: BookOpenText,
    disponible: true,
    palier: "A",
    lot: "0",
    objectif: "Ce que c'est, ce que ce n'est pas, les sources, le modele de simulation, l'auteur.",
  },
];
