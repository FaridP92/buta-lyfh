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
  /** Écran complet dès le lot 0 (Méthode) ; les autres sont « à venir » jusqu'à leur lot. */
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
    disponible: true,
    palier: "A",
    lot: "2",
    objectif: "En trente secondes : où en est le réseau ce mois-ci, où sont les écarts, que faire.",
  },
  {
    chemin: "/territoires",
    libelle: "Territoires",
    icone: MapIcon,
    disponible: false,
    palier: "A",
    lot: "3",
    objectif: "Lire le marché réel des territoires couverts et alentour, département par département.",
  },
  {
    chemin: "/funnel",
    libelle: "Funnel et leads",
    icone: Waypoints,
    disponible: true,
    palier: "A",
    lot: "2",
    objectif: "Où se perd la conversion, quel canal vaut son coût, quels leads attendent.",
  },
  {
    chemin: "/ventes",
    libelle: "Ventes et marge",
    icone: TrendingUp,
    disponible: true,
    palier: "A",
    lot: "2",
    objectif: "Chiffre d'affaires, marge, panier, remises, mix produit, et l'explication des écarts.",
  },
  {
    chemin: "/forecast",
    libelle: "Forecast et atterrissage",
    icone: LineChart,
    disponible: true,
    palier: "A",
    lot: "2",
    objectif: "Où finit l'année, avec quelles hypothèses, quels risques et opportunités.",
  },
  {
    chemin: "/pose",
    libelle: "Pose et encaissement",
    icone: Truck,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Délai de pose, carnet de charge par agence, encaissement et aides en attente.",
  },
  {
    chemin: "/plans-action",
    libelle: "Plans d'action et rituels",
    icone: ListChecks,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Les leviers en cours, leurs propriétaires, le gain attendu, et le calendrier des revues.",
  },
  {
    chemin: "/qualite",
    libelle: "Qualité et référentiels",
    icone: ShieldCheck,
    disponible: false,
    palier: "A",
    lot: "3",
    objectif: "La confiance dans le chiffre, rendue visible : douze contrôles, fraîcheur, référentiels.",
  },
  {
    chemin: "/automatisations",
    libelle: "Automatisations",
    icone: Workflow,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Les workflows n8n, leur dernière exécution, le journal des automatisations.",
  },
  {
    chemin: "/analyste",
    libelle: "Analyste",
    icone: MessageSquare,
    disponible: false,
    palier: "B",
    lot: "4b",
    objectif: "Poser une question en français sur les indicateurs, avec la requête SQL et les sources.",
  },
  {
    chemin: "/methode",
    libelle: "Méthode et auteur",
    icone: BookOpenText,
    disponible: true,
    palier: "A",
    lot: "0",
    objectif: "Ce que c'est, ce que ce n'est pas, les sources, le modèle de simulation, l'auteur.",
  },
];
