import { describe, expect, it } from "vitest";
import { analyserTexte, deAgence, redigerRevue, versTexte, type FaitsRevue } from "@/lib/revue";

const FAITS: FaitsRevue = {
  semaine: "2026-09-07",
  reseau: { leads: 961, rdv_tenus: 315, signatures: 35, ca_signe: 284507, poses: 43, encaisse: 534680, leads_semaine_precedente: 868, signatures_semaine_precedente: 52, ca_signe_semaine_precedente: 451253 },
  agences: [
    { agence: "SAI", nom_bassin: "Saintonge", leads: 200, signatures: 12, ca_signe: 90000, poses: 10 },
    { agence: "MSN", nom_bassin: "Marsan", leads: 60, signatures: 1, ca_signe: 6500, poses: 3 },
    { agence: "BDX", nom_bassin: "Bordeaux Métropole", leads: 180, signatures: 8, ca_signe: 60000, poses: 8 },
    { agence: "HGI", nom_bassin: "Haute Gironde", leads: 90, signatures: 5, ca_signe: 40000, poses: 4 },
  ],
  ecarts_mois: [
    { agence: "RESEAU", mois: "2026-09-01", comparaison: "objectif", ca_realise: 924690, ca_comparaison: 1279928, ecart_total: -355238, effet_volume: -237947, effet_mix: -106173, effet_prix: 2905, effet_remise: -14023, comparaison_disponible: true },
    { agence: "MSN", mois: "2026-09-01", comparaison: "objectif", ca_realise: 20883, ca_comparaison: 84695, ecart_total: -63812, effet_volume: -57188, effet_mix: -6197, effet_prix: -460, effet_remise: 33, comparaison_disponible: true },
    { agence: "SAI", mois: "2026-09-01", comparaison: "objectif", ca_realise: 238553, ca_comparaison: 259906, ecart_total: -21353, effet_volume: -25174, effet_mix: 16212, effet_prix: 2129, effet_remise: -14520, comparaison_disponible: true },
    { agence: "HGI", mois: "2026-09-01", comparaison: "objectif", ca_realise: 124561, ca_comparaison: 95021, ecart_total: 29540, effet_volume: 21544, effet_mix: 6795, effet_prix: 451, effet_remise: 749, comparaison_disponible: true },
  ],
  alertes: [
    { code: "CPV_LEADS_ACHETES", agence: "BDX", nom_bassin: "Bordeaux Métropole", gravite: "alerte", valeur: 48, texte: "Bordeaux Métropole : coût par vente des leads achetés +48 % vs T1 (cohortes jusqu'à 05/2026)" },
    { code: "DOSSIERS_A_QUALIFIER", agence: "NOR", nom_bassin: "Nord", gravite: "attention", valeur: 123, texte: "Nord : 123 dossiers à qualifier, référentiel en cours d'alignement" },
  ],
  mention: "données d'activité simulées",
};

describe("redigerRevue", () => {
  const r = redigerRevue(FAITS);
  it("liste les faits transmis sans en inventer", () => {
    expect(r.faits[0]).toBe("Semaine du 07/09 au 13/09 : 961 leads, 315 RDV tenus, 35 signatures pour 284,5 k€ HT, 43 poses, 534,7 k€ encaissés.");
    expect(r.faits[1]).toBe("Semaine précédente : 868 leads, 52 signatures, 451,3 k€ signés.");
    expect(r.faits[2]).toBe("Agences : Saintonge signe le plus (12 signatures, 90,0\u202fk€), Marsan le moins (1, 6\u202f500\u202f€).");
    expect(r.faits[3]).toContain("Septembre à date : 924,7 k€ signés contre 1,3 M€ pour l'objectif (-27,8 %)");
    expect(r.faits[4]).toContain("2 alertes actives : Bordeaux Métropole : coût par vente");
  });
  it("écrit cinq phrases de lecture à partir des écarts entre faits", () => {
    expect(r.lecture).toHaveLength(5);
    expect(r.lecture[0]).toBe("Leads en hausse de 10,7 % sur une semaine (961 contre 868).");
    expect(r.lecture[1]).toContain("Signatures en retrait de 32,7 % et CA signé en retrait de 37,0 % : une semaine de conversion faible");
    expect(r.lecture[2]).toBe("1 agence est à plus de 20 % sous l'objectif au prorata du mois : Marsan (-75,3 %).");
    expect(r.lecture[3]).toBe("Haute Gironde (+31,1\u202f%) dépasse l'objectif.");
    expect(r.lecture[4]).toContain("L'écart du réseau tient d'abord au volume (-237,9 k€, 67 % de l'écart) puis au mix");
  });
  it("propose trois décisions distinctes, chacune avec son indicateur", () => {
    expect(r.decisions.map((d) => d.indicateur)).toEqual(["CPV", "QUALITE", "TX_SIGN"]);
    expect(r.decisions[0]?.texte).toContain("Plafonner les leads achetés de Bordeaux Métropole");
    expect(r.decisions[1]?.texte).toContain("qualifier les 123 dossiers restants");
    expect(r.decisions[2]?.texte).toContain("Revue de pipe avec Marsan");
  });
  it("le texte au format commun se relit à l'identique", () => {
    const texte = versTexte(r);
    expect(texte.startsWith("## Faits\n- Semaine du 07/09")).toBe(true);
    expect(texte).toContain("## Décisions proposées\n- Plafonner");
    expect(analyserTexte(texte)).toEqual(r);
    expect(analyserTexte("texte libre sans titres")).toBeNull();
    expect(texte).not.toMatch(/[–—―]/);
  });
  it("reste lisible sans alerte ni comparaison", () => {
    const sans = redigerRevue({ ...FAITS, alertes: [], ecarts_mois: [], agences: [] });
    expect(sans.faits.at(-1)).toBe("Aucune alerte active à la date de publication.");
    expect(sans.lecture.at(-1)).toBe("Aucune alerte n'appelle de décision cette semaine.");
    expect(sans.decisions.map((d) => d.indicateur)).toEqual(["ATTENTE48"]);
  });
  it("accorde la préposition au nom du bassin", () => {
    expect(deAgence("Nord")).toBe("du Nord");
    expect(deAgence("Bassin d'Arcachon")).toBe("du Bassin d'Arcachon");
    expect(deAgence("Angoumois")).toBe("d'Angoumois");
    expect(deAgence("Saintonge")).toBe("de Saintonge");
    expect(redigerRevue(FAITS).decisions[1]?.texte).toContain("référentiel du Nord");
  });
});
