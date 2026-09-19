var revue = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: !0 });
  }, __copyProps = (to, from, except, desc) => {
    if (from && typeof from == "object" || typeof from == "function")
      for (let key of __getOwnPropNames(from))
        !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);

  // src/lib/revue.ts
  var revue_exports = {};
  __export(revue_exports, {
    analyserTexte: () => analyserTexte,
    deAgence: () => deAgence,
    redigerRevue: () => redigerRevue,
    versTexte: () => versTexte
  });

  // src/lib/format.ts
  function estVide(valeur) {
    return valeur == null || Number.isNaN(valeur);
  }
  function formatNombreFr(valeur, decimales) {
    return new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales
    }).format(valeur).replace(/\u202F/g, "\xA0");
  }
  function formatMontant(valeur) {
    if (estVide(valeur)) return "n. d.";
    let abs = Math.abs(valeur);
    return abs >= 1e6 ? `${formatNombreFr(valeur / 1e6, 1)}\xA0M\u20AC` : abs >= 1e4 ? `${formatNombreFr(valeur / 1e3, 1)}\xA0k\u20AC` : `${formatNombreFr(valeur, 0)}\xA0\u20AC`;
  }
  function formatTaux(valeur, decimales = 1) {
    return estVide(valeur) ? "n. d." : `${formatNombreFr(valeur, decimales)}\xA0%`;
  }
  function formatNombre(valeur) {
    return estVide(valeur) ? "n. d." : formatNombreFr(valeur, 0);
  }

  // src/lib/periode.ts
  function ecartPct(valeur, comparaison) {
    return valeur === null || comparaison === null || !comparaison ? null : Math.round((valeur - comparaison) / Math.abs(comparaison) * 1e3) / 10;
  }

  // src/lib/revue.ts
  var MOIS = ["janvier", "f\xE9vrier", "mars", "avril", "mai", "juin", "juillet", "ao\xFBt", "septembre", "octobre", "novembre", "d\xE9cembre"];
  function jourMois(date) {
    return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
  }
  function finDeSemaine(lundi) {
    let d = /* @__PURE__ */ new Date(`${lundi.slice(0, 10)}T00:00:00Z`);
    return d.setUTCDate(d.getUTCDate() + 6), d.toISOString().slice(0, 10);
  }
  function deAgence(nom) {
    return nom === "Nord" || nom.startsWith("Bassin ") ? `du ${nom}` : /^[AEIOUYÉÈÊ]/i.test(nom) ? `d'${nom}` : `de ${nom}`;
  }
  function signe(v) {
    return `${v > 0 ? "+" : ""}${formatTaux(v)}`;
  }
  function tendance(valeur, reference, nom, feminin = !1) {
    let e = ecartPct(valeur, reference);
    return e === null ? `${nom} : ${formatNombre(valeur)}, sans comparaison` : Math.abs(e) < 3 ? `${nom} stables sur une semaine (${formatNombre(valeur)} contre ${formatNombre(reference)})` : `${nom} ${e > 0 ? "en hausse" : "en retrait"} de ${formatTaux(Math.abs(e))} sur une semaine (${formatNombre(valeur)} contre ${formatNombre(reference)})`;
  }
  function redigerRevue(f) {
    let r = f.reseau, lundi = f.semaine.slice(0, 10), dimanche = finDeSemaine(lundi), agences = [...f.agences].sort((a, b) => b.ca_signe - a.ca_signe), meilleure = agences[0], plusFaible = agences.at(-1), reseauEcart = f.ecarts_mois.find((e) => e.agence === "RESEAU" && e.comparaison_disponible && e.ca_comparaison), ecartsAgences = f.ecarts_mois.filter((e) => e.agence !== "RESEAU" && e.comparaison_disponible && e.ca_comparaison && e.ecart_total !== null).map((e) => ({ ...e, pct: ecartPct(e.ca_realise, e.ca_comparaison) ?? 0, nom: f.agences.find((a) => a.agence === e.agence)?.nom_bassin ?? e.agence })).sort((a, b) => a.pct - b.pct), moisLibelle = reseauEcart ? `${MOIS[Number(reseauEcart.mois.slice(5, 7)) - 1] ?? reseauEcart.mois}` : null, comparaisonLibelle = reseauEcart?.comparaison === "n1" ? "N-1" : "l'objectif", faits = [
      `Semaine du ${jourMois(lundi)} au ${jourMois(dimanche)} : ${formatNombre(r.leads)} leads, ${formatNombre(r.rdv_tenus)} RDV tenus, ${formatNombre(r.signatures)} signatures pour ${formatMontant(r.ca_signe)} HT, ${formatNombre(r.poses)} poses, ${formatMontant(r.encaisse)} encaiss\xE9s.`,
      `Semaine pr\xE9c\xE9dente : ${formatNombre(r.leads_semaine_precedente)} leads, ${formatNombre(r.signatures_semaine_precedente)} signatures, ${formatMontant(r.ca_signe_semaine_precedente)} sign\xE9s.`
    ];
    meilleure && plusFaible && meilleure !== plusFaible && faits.push(`Agences : ${meilleure.nom_bassin} signe le plus (${formatNombre(meilleure.signatures)} signatures, ${formatMontant(meilleure.ca_signe)}), ${plusFaible.nom_bassin} le moins (${formatNombre(plusFaible.signatures)}, ${formatMontant(plusFaible.ca_signe)}).`), reseauEcart && reseauEcart.ca_comparaison && reseauEcart.ecart_total !== null && faits.push(`${moisLibelle ? moisLibelle.charAt(0).toUpperCase() + moisLibelle.slice(1) : "Mois"} \xE0 date : ${formatMontant(reseauEcart.ca_realise)} sign\xE9s contre ${formatMontant(reseauEcart.ca_comparaison)} pour ${comparaisonLibelle} (${signe(ecartPct(reseauEcart.ca_realise, reseauEcart.ca_comparaison) ?? 0)}) ; effet volume ${formatMontant(reseauEcart.effet_volume ?? 0)}, mix ${formatMontant(reseauEcart.effet_mix ?? 0)}, prix ${formatMontant(reseauEcart.effet_prix ?? 0)}, remise ${formatMontant(reseauEcart.effet_remise ?? 0)}.`), faits.push(f.alertes.length === 0 ? "Aucune alerte active \xE0 la date de publication." : `${formatNombre(f.alertes.length)} alerte${f.alertes.length > 1 ? "s" : ""} active${f.alertes.length > 1 ? "s" : ""} : ${f.alertes.map((a) => a.texte).join(" ; ")}.`);
    let lecture = [];
    lecture.push(`${tendance(r.leads, r.leads_semaine_precedente, "Leads")}.`);
    let eSign = ecartPct(r.signatures, r.signatures_semaine_precedente), eCa = ecartPct(r.ca_signe, r.ca_signe_semaine_precedente);
    if (eSign !== null && eCa !== null) {
      let sens = eSign < -20 ? "une semaine de conversion faible, \xE0 lire sur deux semaines avant de conclure" : eSign > 20 ? "une bonne semaine de conversion, \xE0 confirmer la semaine prochaine" : "une semaine dans la moyenne";
      lecture.push(`Signatures ${eSign >= 0 ? "en hausse" : "en retrait"} de ${formatTaux(Math.abs(eSign))} et CA sign\xE9 ${eCa >= 0 ? "en hausse" : "en retrait"} de ${formatTaux(Math.abs(eCa))} : ${sens}.`);
    } else
      lecture.push(`Signatures : ${formatNombre(r.signatures)}, sans semaine de comparaison.`);
    let sousObjectif = ecartsAgences.filter((e) => e.pct <= -20), auDessus = ecartsAgences.filter((e) => e.pct > 0);
    if (ecartsAgences.length > 0 && (lecture.push(sousObjectif.length > 0 ? `${formatNombre(sousObjectif.length)} agence${sousObjectif.length > 1 ? "s sont" : " est"} \xE0 plus de 20\xA0% sous ${comparaisonLibelle} au prorata du mois : ${sousObjectif.map((e) => `${e.nom} (${signe(e.pct)})`).join(", ")}.` : `Aucune agence n'est \xE0 plus de 20\xA0% sous ${comparaisonLibelle} au prorata du mois.`), lecture.push(auDessus.length > 0 ? `${auDessus.map((e) => `${e.nom} (${signe(e.pct)})`).join(", ")} d\xE9passe${auDessus.length > 1 ? "nt" : ""} ${comparaisonLibelle}.` : `Aucune agence ne d\xE9passe ${comparaisonLibelle} ce mois-ci.`)), reseauEcart && reseauEcart.ecart_total) {
      let effets = [
        { nom: "volume", v: reseauEcart.effet_volume ?? 0 },
        { nom: "mix", v: reseauEcart.effet_mix ?? 0 },
        { nom: "prix", v: reseauEcart.effet_prix ?? 0 },
        { nom: "remise", v: reseauEcart.effet_remise ?? 0 }
      ].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)), premier = effets[0], second = effets[1];
      if (premier) {
        let part = Math.round(100 * premier.v / reseauEcart.ecart_total);
        lecture.push(`L'\xE9cart du r\xE9seau tient d'abord au ${premier.nom} (${formatMontant(premier.v)}, ${formatNombre(part)}\xA0% de l'\xE9cart)${second ? ` puis au ${second.nom} (${formatMontant(second.v)})` : ""}.`);
      }
    }
    lecture.push(f.alertes.length === 0 ? "Aucune alerte n'appelle de d\xE9cision cette semaine." : `Les alertes du matin appellent une d\xE9cision : ${f.alertes.map((a) => a.nom_bassin).join(", ")}.`);
    let decisions = [];
    for (let a of f.alertes)
      a.code === "CPV_LEADS_ACHETES" ? decisions.push({ texte: `Plafonner les leads achet\xE9s ${deAgence(a.nom_bassin)} et ren\xE9gocier le prix du lead ; revoir le co\xFBt par vente dans quatre semaines.`, indicateur: "CPV" }) : a.code === "DOSSIERS_A_QUALIFIER" ? decisions.push({ texte: `Terminer l'alignement du r\xE9f\xE9rentiel ${deAgence(a.nom_bassin)} et qualifier les ${formatNombre(a.valeur ?? 0)} dossiers restants avant de comparer ses taux.`, indicateur: "QUALITE" }) : (a.code === "CARNET_POSE" || a.code === "POSES_EN_RETARD") && decisions.push({ texte: `Renfort de pose \xE0 ${a.nom_bassin} jusqu'\xE0 r\xE9sorption du carnet, poses prioris\xE9es par anciennet\xE9 de signature.`, indicateur: "CARNET" });
    let pire = sousObjectif[0];
    pire && decisions.push({ texte: `Revue de pipe avec ${pire.nom} : ${signe(pire.pct)} sur le mois, devis en attente \xE0 passer en revue cette semaine.`, indicateur: "TX_SIGN" }), eSign !== null && eSign < -20 && decisions.push({ texte: "Passer en revue les devis de plus de 30 jours de toutes les agences et relancer sous 48 heures les leads sans rendez-vous planifi\xE9.", indicateur: "ATTENTE48" }), decisions.push({ texte: "Confirmer la semaine prochaine que les leads sans rendez-vous \xE0 48 heures reculent dans chaque agence.", indicateur: "ATTENTE48" });
    let uniques = [];
    for (let d of decisions) uniques.some((u) => u.indicateur === d.indicateur) || uniques.push(d);
    return { faits, lecture: lecture.slice(0, 5), decisions: uniques.slice(0, 3) };
  }
  function versTexte(r) {
    return [
      "## Faits",
      ...r.faits.map((x) => `- ${x}`),
      "",
      "## Lecture",
      ...r.lecture,
      "",
      "## D\xE9cisions propos\xE9es",
      ...r.decisions.map((d) => `- ${d.texte} (indicateur : ${d.indicateur})`)
    ].join(`
`);
  }
  function analyserTexte(texte) {
    let blocs = {}, courant = null;
    for (let brute of texte.split(`
`)) {
      let ligne = brute.trim();
      if (ligne.startsWith("## ")) {
        courant = ligne.slice(3).trim().toLowerCase(), blocs[courant] = [];
        continue;
      }
      !ligne || !courant || blocs[courant]?.push(ligne.startsWith("- ") ? ligne.slice(2).trim() : ligne);
    }
    let faits = blocs.faits, lecture = blocs.lecture, decisions = blocs["d\xE9cisions propos\xE9es"] ?? blocs["decisions proposees"] ?? blocs.d\u00E9cisions;
    return !faits || !lecture || !decisions ? null : {
      faits,
      lecture,
      decisions: decisions.map((d) => {
        let m = /\(indicateur\s*:\s*([A-Z0-9_]+)\)\s*$/.exec(d);
        return m ? { texte: d.slice(0, m.index).trim(), indicateur: m[1] } : { texte: d, indicateur: "" };
      })
    };
  }
  return { analyserTexte, deAgence, redigerRevue, versTexte };
})();


// Faits de la semaine (RPC buta.faits_revue_hebdo, réponse complète : le JSON est dans body).
const faits = $input.first().json.body;
if (!faits || !faits.reseau) throw new Error("faits de la revue absents");
const r = revue.redigerRevue(faits);
const texteRegles = revue.versTexte(r);
// Nombres autorisés pour le modèle : ceux qui figurent dans la rédaction par règles (mêmes formats).
const jetons = (s) => (String(s).match(/\d[\d\u202f\u00a0 ]*(?:[.,]\d+)?/g) || []).map((t) => t.replace(/[\s\u202f\u00a0]/g, "").replace(/[.,]$/, ""));
const autorises = [...new Set(jetons(texteRegles))];
return [{ json: {
  semaine: faits.semaine,
  faits: r.faits,
  lecture_regles: r.lecture,
  decisions: r.decisions,
  texte_regles: texteRegles,
  faits_texte: r.faits.map((f) => "- " + f).join("\n"),
  autorises,
} }];
