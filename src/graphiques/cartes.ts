import { useEffect, useState } from "react";

const chargees = new Map<string, Promise<void>>();

/**
 * Enregistre un GeoJSON auprès d'ECharts (une seule fois par nom), en chargeant ECharts à la demande.
 * Les contours sont servis depuis /geo/ (générés au lot 1, moins de 300 Ko par département).
 */
export function chargerCarte(nom: string, url: string): Promise<void> {
  let promesse = chargees.get(nom);
  if (!promesse) {
    promesse = (async () => {
      const [{ echarts }, reponse] = await Promise.all([import("./GraphiqueInterne"), fetch(url)]);
      if (!reponse.ok) throw new Error(`contours ${nom} indisponibles (${reponse.status})`);
      const geojson = (await reponse.json()) as Parameters<typeof echarts.registerMap>[1];
      echarts.registerMap(nom, geojson);
    })();
    chargees.set(nom, promesse);
    promesse.catch(() => chargees.delete(nom));
  }
  return promesse;
}

/** Vrai quand la carte est enregistrée ; l'erreur éventuelle est renvoyée pour un message utile. */
export function useCarte(nom: string, url: string): { prete: boolean; erreur: string | null } {
  const [etat, setEtat] = useState<{ prete: boolean; erreur: string | null }>({ prete: false, erreur: null });
  useEffect(() => {
    let annule = false;
    chargerCarte(nom, url)
      .then(() => !annule && setEtat({ prete: true, erreur: null }))
      .catch((e: unknown) => !annule && setEtat({ prete: false, erreur: e instanceof Error ? e.message : String(e) }));
    return () => {
      annule = true;
    };
  }, [nom, url]);
  return etat;
}
