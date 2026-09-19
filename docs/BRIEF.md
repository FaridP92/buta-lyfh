# Brief · Buta.Lyfh

## 1. Pourquoi ce démonstrateur
L'annonce Responsable Performance de Butagaz Eco-énergie (Levallois-Perret, CDI, 7 à 10 ans) demande cinq choses : construire et fiabiliser le pilotage du lead à l'encaissement ; analyser et éclairer la décision (écarts de CA, marge, conversion, productivité, forecast, atterrissage) ; transformer l'analyse en plans d'action (funnel, qualité et allocation des leads, mix produit, panier moyen, remises, annulations, coûts d'acquisition, délais) ; professionnaliser les rituels (revues de performance, de pipe, de marge, de forecast) ; faire évoluer outils, référentiels, BI, automatisation, CRM. Le contexte : plusieurs entités rachetées (Sler, MG Habitat, Lumélio), des territoires, des canaux d'acquisition de maturité différente, un changement d'échelle.

Buta.Lyfh montre tout cela en fonctionnement, sur un réseau simulé de neuf agences calé sur le marché réel de leurs dix départements et du Douaisis. Le recruteur ouvre un lien et voit, en moins d'une minute, le poste tel que Frédéric le tiendrait.

## 2. Pour qui, dans quel ordre
1. Quentin (appel du mardi 22 septembre) : il reçoit le lien après l'appel. Il regarde deux minutes sur ordinateur ou téléphone, comprend sans explication, transmet.
2. Le Directeur Commerce et Opérations (entretien 2 probable) : il clique partout, cherche la faille, pose des questions au chiffre. L'application doit tenir ce regard : chaque chiffre a une définition, une source, une date.
3. Tout recruteur futur du secteur énergie ou réseau : l'application reste dans le portfolio avec RenovScope et CoPilote Atelier.

## 3. L'effet recherché, concrètement
Sept moments qui font dire « il a fait ça seul, en un week-end, et c'est exactement le poste » :
1. L'accueil : quatre compteurs qui s'animent, l'atterrissage de l'année face à l'objectif, trois alertes datées, et le badge « journée du 21 septembre intégrée ce matin à 06:02 par n8n » : le cockpit vit.
2. La carte de France : leurs dix départements et le Nord détourés, un indice de potentiel par département, un clic et on descend aux communes avec leurs agences et les installateurs RGE concurrents. Données réelles, sourcées.
3. Le funnel en diagramme de Sankey, du lead à l'encaissement, par canal, qui se redessine quand on change d'agence.
4. L'écart de chiffre d'affaires décomposé en volume, prix et mix (graphique en cascade), avec un bouton « Expliquer » qui produit trois phrases sourcées à partir des faits SQL.
5. Le forecast en éventail : bas, central, haut, avec le pipe pondéré visible et les hypothèses écrites.
6. La page Qualité : douze contrôles de cohérence exécutés chaque matin, l'histoire de l'intégration d'une agence rachetée lisible dans la courbe d'anomalies qui décroît.
7. La palette de commandes (Cmd K) : « quelle agence a le pire coût par vente en août ? » ; la requête SQL s'affiche, le résultat aussi, puis la réponse, avec le coût de l'appel en centimes.
Et l'export « pour Power BI » : un zip avec les tables au format CSV, un modèle en étoile documenté et un fichier de mesures DAX, pour dire « je sais aussi le faire dans votre outil ».

## 4. Périmètre par palier
- Palier A, en ligne dimanche 20 septembre au soir, dans cet ordre de valeur si le temps manque : Vue d'ensemble, Ventes et marge, Territoires, Méthode d'abord, puis Funnel, Forecast, Qualité : Vue d'ensemble, Territoires, Funnel et leads, Ventes et marge, Forecast et atterrissage, Qualité et référentiels, Méthode et auteur ; filtres globaux, palette de commandes, export CSV et XLSX, responsive, déployé sur https://buta.lyfh.fr avec la journée simulée quotidienne et les contrôles qualité en n8n.
- Palier B, lundi 21 septembre, seulement si le palier A est irréprochable : Pose et encaissement, Plans d'action et rituels (avec la revue hebdomadaire générée), Automatisations (journal n8n), Analyste (questions en langage naturel, explication des écarts), mesures DAX de l'export Power BI.
- Palier C, après l'entretien : mode présentation (touche P), journal des visites anonymisé, déploiement continu GitHub Actions, versions PDF des revues.
Ce qui n'est pas dans le palier A est retiré de la navigation avant mardi, jamais laissé « à venir ».

## 5. Ce qui est vrai et ce qui est simulé (à afficher tel quel)
- Vrai : le marché (Insee 2022, ADEME RGE, RTE registre, ADEME DPE). Cités une seule fois, sur la page Méthode, comme contexte public : les dix départements et huit agences publiés par Butagaz Eco-énergie sur son site (le rachat annoncé en mai 2026 n'est plus cité depuis le 19 septembre).
- Simulé : tout ce qui est activité (leads, rendez-vous, devis, ventes, poses, encaissements, coûts, charges, objectifs, effectifs, plans d'action). Les neuf agences simulées portent des noms de bassins, jamais ceux d'agences réelles ; les effectifs sont des codes ; aucune agence, personne ou entité réelle n'est associée à une performance simulée. Générateur déterministe, hypothèses écrites dans `DONNEES.md` et sur la page Méthode. Le mot « simulé » apparaît sur chaque écran d'activité, dans un badge discret mais constant.
- Jamais : un logo, une couleur, un chiffre présenté comme celui de Butagaz ; une recommandation d'implantation (« vous devriez ouvrir à ») ; un superlatif.

## 6. Critères de succès (vérifiés avant mardi)
1. Un inconnu ouvre le lien sur téléphone et comprend l'objet en 30 secondes sans explication.
2. Chaque indicateur a sa fiche (définition, formule, source, grain) accessible en un clic depuis l'écran.
3. Les sept histoires simulées sont visibles là où la fiche d'écran le prévoit, et l'analyste les retrouve quand on lui pose la question.
4. Temps de premier affichage inférieur à 2 secondes sur 4G, aucune erreur console, Lighthouse performance et accessibilité supérieurs à 90.
5. Zéro tiret long, zéro mention ambiguë sur l'origine des données, disclaimer visible sur chaque page.
6. La relecture par trois lentilles (faits, forme, recruteur simulé) ne laisse aucun point bloquant.

## 7. Comment en parler mardi
Une phrase, au moment de « pourquoi Butagaz » : « J'ai regardé vos dix départements avec les données ouvertes, maisons au fioul, parc solaire, installateurs RGE, et j'ai construit sur ce marché un cockpit de pilotage du lead à l'encaissement, avec les contrôles et l'automatisation. Je vous envoie le lien après notre échange. » Si Quentin est RH : s'arrêter là. Si c'est le manager : deux chiffres du marché, puis « je préfère vous laisser regarder ». Toujours « à titre personnel, données publiques et données simulées ». Si on demande « d'où sortez-vous nos agences ? » : « de votre site public et du registre RGE ; les agences simulées portent des noms de bassins, pas les vôtres, et rien de ce qui est affiché ne décrit votre activité ». À la première réserve exprimée par l'entreprise, le lien est retiré dans l'heure, et on le dit ainsi.

## 8. Calendrier
- Jeudi 17 au soir : ce dossier, création du dépôt, du sous-domaine, de la clé API.
- Vendredi 18 : session 1 (lots 0 et 1). Coquille en ligne le soir.
- Samedi 19 : session 2 (lots 2 et 3). Palier A fonctionnel le soir.
- Dimanche 20 : session 3, première partie (lot 4), relecture, mise en ligne du palier A propre.
- Lundi 21 : lot 5, palier B si le palier A est irréprochable, sinon polissage. Gel à 20 h.
- Mardi 22, 10 h 00 : appel. Lien envoyé dans le mail de remerciement.

## 9. Risques et parades
- Trop ambitieux pour trois jours : les paliers sont ordonnés par valeur ; un palier A irréprochable vaut mieux qu'un palier B bancal. Gel lundi 20 h.
- Chiffre contestable devant un contrôleur de gestion : chaque formule est écrite, testée, et la simulation est assumée comme telle.
- Paraître présomptueux : vocabulaire de lecture et d'hypothèses, jamais de recommandation stratégique.
- Panne le jour J : instantané statique embarqué (l'application affiche les données d'hier même si Supabase ne répond pas), test de santé n8n toutes les six heures, page d'accueil testée sur téléphone lundi soir.
- Confusion avec la marque : disclaimer, aucune identité visuelle empruntée, aucune agence ni personne réelle dans la simulation. Le nom Buta.Lyfh reprend la racine de la marque : c'est le choix de Frédéric, isolé dans une constante et un sous-domaine pour qu'un renommage (par exemple Reseau.Lyfh) prenne dix minutes si l'entreprise ou un relecteur y voit un problème.
