# Système de design · Buta.Lyfh

Intention : un cockpit nocturne, précis et calme. Pas de néons partout, pas de dégradés violets, pas de cartes flottantes génériques : de la lumière là où il y a une information, du silence ailleurs. La référence mentale : un poste de pilotage de nuit lu à un mètre, où chaque chiffre est lisible et chaque alerte se voit sans crier. Le skill `frontend-design` est mobilisé pour chaque écran, `ui-ux-pro-max` pour les revues, `visual-verdict` pour comparer les captures à cette page.

## 1. Tokens (CSS variables, thème sombre par défaut, thème clair complet)
Sombre : fond `--fond: #0B0F17` (avec un très léger grain, bruit à 3 % d'opacité, pour que le fond ne soit pas un aplat numérique) ; surface `--surface: #111827` ; surface haute `--surface-2: #161F2E` ; bordure `--bordure: rgba(255,255,255,0.08)` ; texte `--texte: #E6EAF2` ; texte secondaire `--texte-2: #9AA4B8` ; texte tertiaire `--texte-3: #808A9D` (5,5:1 sur le fond, 4,8:1 sur la surface haute ; la valeur initiale #6B7488 faisait 4,1:1) ; accent ambre `--ambre: #F5B700` (actions, sélection, réseau) ; accent menthe `--menthe: #2DD4BF` (PAC, positif) ; bleu `--bleu: #60A5FA` (photovoltaïque, information) ; violet `--violet: #A78BFA` (autres produits) ; alerte `--alerte: #FB7185` ; succès `--succes: #34D399` ; attention `--attention: #FBBF24`.
Clair : fond `#F7F8FB`, surface `#FFFFFF`, surface haute `#F1F3F8`, bordure `rgba(15,23,42,0.08)`, texte `#0F172A`, texte secondaire `#475569`, texte tertiaire `#5B677D`. Les accents sont assombris davantage que 10 % pour tenir le AA : ambre `#A67C00`, menthe `#127A70`, bleu `#2A63BD`, violet `#6E4FCB`, alerte `#C42D47`, succès `#157A55`, attention `#A36F00` (tous au moins 3:1 sur les trois fonds, ratios calculés au lot 0). Deux tokens dédiés au texte coloré, `--ambre-texte` et `--menthe-texte` (`#8A6500` et `#0F766E` en clair, identiques aux accents en sombre), parce qu'un accent à 3:1 suffit à un point ou une bordure mais pas à un libellé de 11 px (4,5:1).
Décision du 19 septembre (Frédéric, après le logo) : la lumière de l'interface est la menthe du logo, token `--accent` (`#2EE0C9` en sombre, `#0F9A8C` en clair, texte `#0B7A6F`) : sélection du rail et du tiroir, point du badge de fraîcheur, point du mot-marque, périmètre et agences sur les cartes, bouton primaire, curseurs, point de dernière valeur des mini courbes, numérotation des phrases, jauge d'atterrissage, éventail du forecast, courbe de qualité, première série des graphiques. L'ambre reste sémantique : badge « simulé », niveau « attention », paliers de charge du calendrier de pose. Palette des séries (ordre fixe) : accent menthe, bleu, violet, ambre, rose `#F472B6` (clair `#B0367A`), cyan `#22D3EE` (clair `#0E7F96`), gris `#94A3B8`, alerte ; les deux dernières ont été ajoutées le 18 septembre parce que huit produits et huit canaux se partageaient six couleurs. Huit séries maximum sur un graphique ; au-delà, regrouper en « autres ».
Bascule de thème dans la barre haute, respect de `prefers-color-scheme`, choix mémorisé en localStorage.

## 2. Typographie (polices auto-hébergées, fichiers Fontsource copiés dans `public/fonts/` et préchargés, aucune requête vers Google)
- Titres d'écran : Instrument Serif, 32 px desktop, 26 px mobile, interlettrage -0,01 em. Un seul titre serif par écran.
- Interface : Instrument Sans, 14 px de base, 15 px sur les tableaux, 12 px pour les métadonnées ; poids 400 et 600 seulement.
- Chiffres : JetBrains Mono, `font-variant-numeric: tabular-nums`, 28 px pour les KPI (36 px desktop), 13 px dans les tableaux. Les unités sont en Instrument Sans, texte secondaire.
- Format français : espace insécable (U+00A0, pas la fine U+202F qui se rend à 1,3 px dans Instrument Sans) avant `%`, avant l'unité et entre milliers, virgule décimale, « k€ » et « M€ » à partir de 10 000 et 1 000 000 avec une décimale.

## 3. Grille et composants
- Contenu maximal 1440 px, marges 24 px (16 px mobile), grille 12 colonnes, gouttière 16 px. Rail gauche 76 px (icônes 20 px, libellé au survol après 300 ms), barre haute 56 px collante.
- Carte : rayon 14 px, fond surface, bordure 1 px, ombre nulle en sombre, ombre douce en clair ; en-tête (titre 15 px 600, sous-titre 12 px secondaire, menu à droite) ; padding 20 px.
- Carte KPI : libellé, valeur mono, variation avec flèche et couleur sémantique, mini courbe 12 mois (ligne 1,5 px, aire 12 %), bouton « i ». Hauteur fixe 132 px.
- Tableau : lignes 40 px, en-tête collant, tri par colonne, chiffres alignés à droite en mono, zébrure 3 %, ligne survolée surface haute, pastille de statut 8 px.
- Pastilles : succès, attention, alerte, neutre ; toujours accompagnées d'un texte (jamais la couleur seule).
- Badges : « simulé » (bordure ambre, texte ambre, 11 px, majuscules espacées), « réel, source » (bordure menthe), « instantané » (bordure grise).
- Boutons : primaire ambre sur texte fond (contraste vérifié), secondaire bordure, fantôme ; hauteur 36 px, rayon 10 px ; état focus visible 2 px menthe.
- Palette de commandes : Cmd K, recherche d'écrans, d'agences, d'indicateurs, et « Poser une question » qui ouvre l'analyste avec la saisie ; cette entrée n'apparaît que si la route `/analyste` est active (drapeau unique partagé avec le rail).
- Info-bulles : 12 px, fond surface haute, délai 200 ms, flèche ; la fiche indicateur s'ouvre dans un panneau latéral 420 px.

## 4. Mouvement (Framer Motion ; désactivé si `prefers-reduced-motion`)
- Entrée d'écran : fondu et translation 8 px, 220 ms, décalage 40 ms par carte, au plus 8 cartes animées.
- Compteurs KPI : montée de 0 à la valeur en 700 ms, courbe ease-out, uniquement à la première apparition de la période.
- Graphiques ECharts : animation 600 ms à l'entrée, 300 ms aux changements de filtre ; jamais d'animation en boucle.
- Transitions de filtre : le contenu ne clignote pas ; squelette seulement si la requête dépasse 300 ms.
- Rien ne bouge sans action de l'utilisateur, sauf le badge de fraîcheur qui se met à jour au retour d'onglet.

## 5. Graphiques (ECharts 6, thème maison dans `src/graphiques/theme.ts`)
- Fond transparent, grilles à 6 % de blanc, axes sans ligne, étiquettes 12 px texte secondaire, info-bulle maison (fond surface haute, mono pour les chiffres, libellés en français).
- Types par usage : Sankey (funnel), cascade (écarts, en barres empilées avec segments transparents), aire empilée (CA par produit), éventail (forecast : trois aires bas, central, haut), heatmap (matrices, calendrier de charge), boîtes à moustaches (remises), barres horizontales (funnel du mois, composantes de l'indice), cartes geo (départements, communes) avec contours 0,6 px et couleur séquentielle ambre pour le potentiel.
- Toujours : titre de l'axe et unité, légende cliquable, valeur exacte au survol, export PNG et CSV dans le menu de la carte, hauteur 320 px desktop, 260 px mobile, redimensionnement à la fenêtre.
- Jamais : camembert (sauf mix produit en anneau fin, avec la valeur au centre), 3D, double axe non expliqué, échelle tronquée sans mention.
- Le skill `data-viz-dashboard-expert` valide le choix de chaque graphique avant implémentation.

## 6. Cartes géographiques
Rendu ECharts geo sur fond nuit sans tuiles (aucun service de tuiles, aucune clé). Contours fins, départements du périmètre détourés en ambre 1,5 px, agences en points ambre avec halo, installateurs RGE en points 3 px texte tertiaire, activables. Zoom molette limité, boutons plus et moins, bouton France. Sur mobile : la carte occupe 320 px de hauteur, les panneaux passent dessous.

## 7. Accessibilité et qualité
Contraste AA sur tous les textes (vérifié sur les deux thèmes), focus visible, navigation clavier complète (rail, filtres, tableaux, palette), rôles ARIA sur les graphiques avec description textuelle, tailles cibles 40 px sur mobile, aucune information portée par la couleur seule. Lighthouse accessibilité supérieur à 95.

## 8. Interdits
Tiret long ; superlatif ; icône décorative sans fonction ; texte en anglais dans l'interface (sauf noms d'outils) ; « Lorem ipsum » ; capture de police externe ; effet de verre flou sur plus d'un élément par écran ; bordures dégradées animées ; carrousel ; modale d'accueil ; logo ou couleurs Butagaz.

## 9. Ce qui trahit une interface générée par une IA, et ce qu'on fait à la place
Le niveau attendu est celui d'un produit conçu par un studio, pas d'un gabarit. Chaque écran est relu contre cette liste avant d'être déclaré fini.
| Signe qui trahit | Ce qu'on fait ici |
|---|---|
| Bandeau d'accueil centré avec titre en dégradé et phrase d'accroche | Pas de bandeau : l'écran s'ouvre directement sur les chiffres, le titre serif à gauche, la période à droite |
| Cartes toutes identiques, icône dans un rond coloré, trois colonnes de « fonctionnalités » | Grille asymétrique (panneau principal 8 colonnes, secondaire 4), cartes de tailles différentes selon l'importance, aucune icône dans un rond |
| Dégradés violets ou bleus, halos flous partout | Une seule lumière : la menthe du logo (l'ambre jusqu'au 19 septembre), posée sur ce qui compte (sélection, périmètre, point du mot-marque). Le reste est mat |
| Rayon de 16 px et ombre portée sur tout | Rayon 14 px sur les cartes seulement, bordures fines à 8 % de blanc, aucune ombre en sombre |
| Inter partout, mêmes tailles, mêmes poids | Trois voix typographiques : serif pour le titre d'écran, sans pour l'interface, mono pour les chiffres ; étiquettes en petites capitales espacées 0,08 em |
| Emoji comme icônes, icônes de styles mélangés | Lucide uniquement, trait 1,5 px, une seule taille par contexte, jamais d'emoji |
| Textes creux (« Bienvenue sur votre tableau de bord », « Insights ») | Chaque titre dit ce qu'on décide : « Où se perd la conversion », « Où finit l'année », « Quelle agence gagne de l'argent » |
| Graphiques aux couleurs par défaut de la bibliothèque, légendes automatiques | Thème ECharts maison, palette de six séries dans un ordre fixe, info-bulle maison, axes nus, unités écrites |
| Espacement uniforme, tout aligné sur 16 px | Échelle 4, 8, 12, 20, 32, 52 ; respiration plus large entre les sections qu'entre les cartes ; alignement des chiffres à droite en mono |
| États vides en gris avec une icône triste | Une phrase utile et un lien vers l'action, dans la même typographie que le reste |
| Animations d'apparition partout, sans lien avec le contenu | Le mouvement suit la donnée : une barre part de sa base, un chiffre monte, un flux coule, un contour se trace ; rien ne bouge sans raison |
| Densité faible, beaucoup de vide décoratif | Densité d'un poste de pilotage : plus d'information par écran, mais hiérarchisée, lisible à un mètre |
Détails qui font la différence : chiffres tabulaires partout ; séparateurs d'un pixel, jamais deux ; libellés d'axe abrégés à la française (« janv. », « févr. ») ; virgule décimale ; espace insécable avant % ; survol d'une ligne de tableau qui révèle une mini courbe ; raccourcis clavier indiqués en gris dans la palette ; curseur main uniquement sur ce qui est cliquable ; focus visible dessiné, pas le bleu par défaut du navigateur.

## 10. Identité et logo (livrés au lot 0, en SVG uniquement)
- Marque-mot « Buta.Lyfh » en Instrument Serif, le point médian remplacé par un point ambre légèrement plus grand que le corps (le signal, la donnée qui s'allume). Deux versions, fond sombre et fond clair, et une version monochrome.
- Monogramme pour le favicon et le rail replié : un carré aux angles 6 px, fond ambre, lettre « B » en serif fond nuit, avec le point ambre en réserve. Favicon SVG et PNG 32 et 180 px (Apple).
- Animation d'ouverture, 700 ms, une seule fois par session : le point s'allume (échelle 0 à 1 avec un léger dépassement), puis le mot apparaît lettre par lettre en fondu de gauche à droite ; le rail glisse depuis la gauche pendant les 300 dernières millisecondes. Désactivée avec `prefers-reduced-motion`.
- Le point ambre est le motif de l'application : il marque la sélection dans le rail, le périmètre sur la carte, l'agence active dans les tableaux, et pulse doucement (2 s) sur le badge de fraîcheur pendant les 10 secondes qui suivent une mise à jour.
- Interdits : flamme, goutte, éclair, bleu Butagaz, dégradé dans le logo, ombre portée. Rien qui puisse ressembler à l'identité d'un énergéticien.
- Décision du 19 septembre (Frédéric) : le monogramme ambre en SVG est remplacé, dans le rail et les favicons, par le logo fourni (`Logo.jpeg`, hors dépôt) : un monogramme « BL » fléché, dégradé bleu vers menthe, détouré en PNG dans `public/logo/` (512 et 96 px) et repris sur la couverture de la fiche de présentation. Le mot-marque devient celui du logo (demande du 19 septembre, 14 h 30) : « BUTA.LYFH » en capitales Montserrat 800 (auto-hébergée dans `public/fonts/`), point menthe, précédé du monogramme, dans la barre haute mobile, le tiroir, l'animation d'ouverture et sur la fiche ; la couleur du mot suit le texte du thème (le bleu nuit du visuel serait illisible sur fond sombre). La tagline anglaise du visuel n'est pas reprise (§8). Le dégradé est admis pour le seul monogramme.

## 11. Animations signature (une par écran, réglées à la main, 60 images par seconde, sans décalage de mise en page)
- Vue d'ensemble : les quatre compteurs montent avec un décalage de 80 ms, la jauge d'atterrissage se remplit de gauche à droite en 900 ms, la ligne « aujourd'hui » se pose ensuite.
- Territoires : les départements apparaissent par ordre d'indice croissant (le potentiel « s'allume » en dernier), le contour du périmètre se trace (stroke-dashoffset, 1 200 ms), les agences apparaissent en dernier avec un halo qui s'éteint.
- Funnel : le Sankey coule de gauche à droite en 800 ms ; au changement de filtre, les flux se réorganisent sans disparaître.
- Ventes et marge : les barres de la cascade tombent l'une après l'autre (120 ms d'écart), le résiduel en dernier ; la mini courbe de marge se dessine.
- Forecast : l'éventail pousse depuis la ligne « aujourd'hui » vers décembre en 1 000 ms, le central d'abord, puis les bornes.
- Qualité : le score s'affiche en compteur, les douze contrôles se cochent en cascade (60 ms d'écart).
- Cartes KPI, signaux (19 septembre, `src/lib/signaux.ts`) : quand le compteur s'est posé, une carte dont l'écart atteint -20 % (ou -5 points de taux) s'enflamme : bordure et halo chauds, langues de feu qui montent du bord bas et lèchent les côtés pendant une seconde, quelques braises qui s'éteignent (1 500 ms, décision du 19 septembre après un premier essai en éclats, jugé trop proche des confettis) ; une carte à +10 % (ou +3 points) verdit et lance trois gerbes de particules aux couleurs des séries (1 400 ms). Un indicateur « plus bas = mieux » inverse. Une seule fois par carte et par période, canvas posé au-dessus de la carte sans effet sur la mise en page, rien en mouvement réduit.
- Transitions de route : le contenu sortant s'efface en 120 ms, l'entrant arrive en 220 ms, le rail et la barre haute ne bougent jamais. Réalisées au lot 6 par l'API View Transitions du navigateur (`viewTransition` sur chaque lien et navigation, règles `::view-transition-*` dans base.css, rail et barre haute nommés) ; sans prise en charge, l'écran change d'un coup. L'entrée d'écran du §4 (fondu et translation de 8 px, 40 ms de décalage par carte, huit cartes au plus) est une animation CSS posée sur les cartes de l'écran (`.ecran-entree`), sans transformation résiduelle. `framer-motion` n'est plus une dépendance.
Tout est désactivé avec `prefers-reduced-motion`, et rien ne rejoue en boucle.

## 9. Ce que le recruteur doit ressentir
Que quelqu'un a pris soin de chaque écran comme d'un rapport remis à une direction : clair, dense sans être chargé, cohérent d'une page à l'autre, et que les chiffres sont justes parce qu'on les voit venir des sources.
