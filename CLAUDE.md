@AGENTS.md

---

# Règles permanentes — Kelentane GPS

> Ajouté à la demande de l'équipe. Complète (ne remplace pas) l'`@AGENTS.md`
> généré par `create-expo-app`. But : réduire les allers-retours où c'est
> l'humain qui repère les bugs de cohérence.

## 1. Les docs sont vivants — vérifier avant d'agir, pas seulement au lancement

- `docs/mockup.jsx` et `docs/handoff.md` peuvent être modifiés **entre deux
  sessions**, y compris en cours d'implémentation d'une étape.
- **Avant de commencer une étape**, et **avant de déclarer une étape terminée**,
  vérifier si ces fichiers ont changé depuis la dernière lecture
  (`git log -1 --format=%cd -- docs/mockup.jsx docs/handoff.md`, ou comparer avec
  la dernière session).
- Si un changement est détecté : le lire en entier avant de continuer, et signaler
  explicitement ce qui a changé et ce que ça implique pour l'étape en cours — ne
  pas juste continuer sur la base de l'ancienne version en mémoire.

## 2. Auto-audit avant de déclarer "build vert"

Un build qui compile n'est pas un build correct. Avant de clore une étape :

- **Gating cohérent** : si un élément UI (écran, barre de navigation, bouton) doit
  être conditionné à un état (ex. `authStatus === "in"`), vérifier que **toutes**
  les instances de cet élément sont gated — pas seulement celles qui sautent aux
  yeux. Lister explicitement tous les rendus inconditionnels au niveau racine et
  se demander pour chacun s'il devrait l'être.
- **Pas de code mort ni de doublons** : après un remplacement de bloc, relire les
  lignes immédiatement après la zone éditée pour vérifier qu'aucun fragment de
  l'ancien code n'est resté orphelin (fermetures de balises, textes, boutons
  dupliqués).
- **Pas de texte fantôme** : si un bouton, un texte ou un lien référence une action
  ou un écran qui n'existe pas encore, soit le câbler, soit le signaler
  explicitement comme dette plutôt que de le laisser inerte silencieusement.
- **Imports inutilisés** : après ajout/retrait d'icônes ou de composants, vérifier
  qu'aucun import n'est devenu mort.

## 3. Signaler plutôt que supposer

- Si une instruction précédente semble entrer en conflit avec une décision plus
  récente (le handoff dit X mais le mockup fait Y), le signaler avant d'avancer
  plutôt que de trancher silencieusement.
- Si une étape touche une zone dépendante d'une décision produit pas encore prise,
  poser la question (courte, avec options) plutôt que de deviner et continuer.
- Toujours proposer un défaut raisonnable en même temps que la question, pour ne
  pas bloquer si l'utilisateur dit juste "go".

## 4. Discipline d'étape

- Une étape = un commit qui build (double ou triple gate selon la nature : `tsc`,
  `expo export`, `nest build`, tests fumée réels si endpoints concernés).
- Ne pas avancer à l'étape suivante sur un build cassé.
- Ne jamais committer de secret. `api/.env` reste ignoré ; toute clé sensible est
  vérifiée par script jetable, jamais affichée en clair dans le chat.
- La maquette (`docs/mockup.jsx`) fait autorité sur le comportement et le visuel ;
  tout écart doit être explicitement signalé et daté (quelle étape le résoudra).

## 5. À la fin de chaque étape, inclure un mini-résumé "risques"

En plus du récap habituel (livré / build vert / écarts), ajouter une ligne
**"Points à vérifier côté humain"** quand pertinent — ex. "vérifie que api/.env
est bien ignoré avant de coller une clé", "cet écran n'a pas pu être capturé
visuellement, vérifie le rendu sur device".
