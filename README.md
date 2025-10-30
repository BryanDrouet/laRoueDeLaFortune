# 🎡 LA ROUE DE LA FORTUNE M6 🎡
## Jeu multijoueur complet présenté par Éric Antoine

---

## 📋 DESCRIPTION

Application web complète du célèbre jeu télévisé "La Roue de la Fortune" de M6. Jouez en ligne ou en local avec vos amis, avec ou sans streaming sur Twitch/YouTube !

### ✨ Caractéristiques principales

- ✅ **Multijoueur en ligne et local** via système de codes de partie
- ✅ **2 à 4 joueurs + 1 présentateur obligatoire**
- ✅ **Roue 100% CSS** avec 22 segments (pas d'images)
- ✅ **Mode streameur** avec overlays séparés pour OBS
- ✅ **Fonds verts** activables pour chroma key
- ✅ **3 modes de communication**: Discord, Chat intégré, Silencieux
- ✅ **Toutes les règles officielles** du jeu télévisé
- ✅ **Compatible GitHub Pages** - pas de serveur nécessaire
- ✅ **Responsive** - fonctionne sur mobile et desktop

---

## 🗂️ STRUCTURE DES FICHIERS

```
roue-fortune-m6/
│
├── index.html                  # Page d'accueil - Créer/rejoindre partie
├── dashboard.html              # Interface du gérant/présentateur
├── wheel-overlay.html          # Overlay de la roue (streaming)
├── puzzle-overlay.html         # Overlay du puzzle (streaming)
├── players-overlay.html        # Overlay des cagnottes (streaming)
│
├── css/
│   ├── colors.css             # Palette de couleurs (à importer en 1er)
│   ├── main.css               # Styles globaux
│   ├── wheel.css              # Styles de la roue
│   ├── puzzle.css             # Styles du puzzle
│   └── dashboard.css          # Styles du dashboard
│
├── js/
│   ├── networking.js          # Gestion rooms et synchronisation
│   ├── game.js                # Logique du jeu et règles
│   ├── wheel.js               # Animation de la roue
│   ├── ui.js                  # Gestion de l'interface
│   └── app.js                 # Point d'entrée principal
│
├── data/
│   ├── config.json            # Configuration du jeu
│   ├── wheel-segments.json    # Segments de la roue (22)
│   └── puzzles.json           # Base de données d'énigmes
│
└── README.md                   # Ce fichier
```

**TOTAL: 5 HTML + 5 CSS + 5 JS + 3 JSON = 18 fichiers**

---

## 🚀 INSTALLATION

### Option 1: GitHub Pages (recommandé)

1. Créez un nouveau repository GitHub
2. Uploadez tous les fichiers dans le repository
3. Allez dans Settings > Pages
4. Activez GitHub Pages (branch: main, folder: root)
5. Votre jeu est accessible à : `https://votre-username.github.io/nom-du-repo/`

### Option 2: Local (développement)

1. Téléchargez tous les fichiers
2. Ouvrez `index.html` dans un navigateur moderne
3. **Important**: Utilisez un serveur local pour éviter les erreurs CORS
   - Python: `python -m http.server 8000`
   - Node.js: `npx http-server`
   - VS Code: Extension "Live Server"

---

## 🎮 COMMENT JOUER

### 1️⃣ Créer une partie

1. Ouvrez `index.html`
2. Entrez votre nom
3. Choisissez votre rôle: **Présentateur** ou **Joueur**
4. Cliquez sur "Créer une nouvelle partie"
5. **Partagez le code à 6 caractères** avec vos amis

### 2️⃣ Rejoindre une partie

1. Ouvrez `index.html`
2. Entrez votre nom
3. Choisissez votre rôle: **Joueur** (ou Présentateur si aucun)
4. Entrez le **code de la partie**
5. Cliquez sur "Rejoindre une partie"

### 3️⃣ Démarrer le jeu

- Une partie nécessite **1 présentateur + 2 à 4 joueurs**
- Le présentateur clique sur "Démarrer la partie"
- Le présentateur est redirigé vers le **Dashboard**
- Les joueurs restent sur leur écran pour voir les mises à jour

### 4️⃣ Jouer une manche

**Côté Présentateur (Dashboard):**

1. Cliquez sur "🎡 FAIRE TOURNER LA ROUE"
2. Attendez que la roue s'arrête
3. Le résultat s'affiche automatiquement
4. **Si valeur monétaire:**
   - Le joueur actif propose une **consonne**
   - Cliquez sur la lettre dans le clavier
   - Cliquez "✓ Valider la lettre"
   - Si trouvée: gains = valeur × occurrences
   - Le joueur peut **acheter une voyelle** (250€)
   - Le joueur peut **tenter de résoudre**
5. **Si case spéciale:**
   - Appliquez l'effet correspondant (voir règles)

---

## 📜 RÈGLES DU JEU

### Déroulement

- **5 manches** par partie
- Chaque manche a un **puzzle à résoudre**
- Le joueur dont c'est le tour fait tourner la roue
- Selon le résultat, il propose une lettre ou subit un effet

### Valeurs monétaires

- **25€ à 5000€** : Proposer une consonne
- Si la lettre est présente: **gains = valeur × nombre d'occurrences**
- Le joueur peut continuer (acheter voyelle ou résoudre)
- Si la lettre n'est pas présente: **tour suivant**

### Voyelles

- Coûtent **250€** à acheter
- Déduites de la cagnotte du tour

### Cases spéciales

| Case | Effet |
|------|-------|
| **BANQUEROUTE** ⚫ | Perd toute sa cagnotte du tour |
| **PASSE TON TOUR** ⚪ | Passe au joueur suivant |
| **HOLD UP** 🔴 | Vole la cagnotte d'un adversaire |
| **ÉCHANGE** 🟢 | Échange sa cagnotte avec un adversaire |
| **DIVISEUR** 🔵 | Divise par 2 la cagnotte d'un adversaire |
| **MINI-ROUE** 🟠 | Bonus surprise |
| **CAVERNE** 🟣 | 20 secondes pour attraper des cadeaux |
| **FILET GARNI** 🟤 | Cadeaux mystère |

### Fin de manche

- Seul le joueur qui **résout l'énigme** garde ses gains
- Les autres joueurs perdent leur cagnotte du tour
- Le gagnant sécurise son argent dans sa cagnotte totale

### Fin de partie

- Après **5 manches**, le joueur avec la **cagnotte totale la plus élevée** gagne
- Possibilité de relancer une nouvelle partie

---

## 🎥 MODE STREAMEUR

### Activation

1. Le présentateur ouvre le **Dashboard**
2. Active "Mode Streameur" dans les paramètres
3. **3 URLs** d'overlays s'affichent:
   - `wheel-overlay.html` - La roue
   - `puzzle-overlay.html` - Le puzzle
   - `players-overlay.html` - Les cagnottes

### Configuration OBS

Pour chaque overlay:

1. Ajoutez une **source Navigateur**
2. Collez l'URL de l'overlay
3. Réglez les dimensions recommandées:
   - Roue: **1920×1080**
   - Puzzle: **1920×400**
   - Joueurs: **1920×300**

### Chroma Key (Fond vert)

1. Activez "Fond vert" dans les paramètres du dashboard
2. Dans OBS, ajoutez un **filtre Chroma Key** sur chaque source
3. Couleur: **#00FF00** (vert pur)
4. Positionnez les overlays sur votre stream

Les overlays se **synchronisent automatiquement** avec le dashboard !

---

## 💬 MODES DE COMMUNICATION

### 1. Discord (recommandé)

- Les joueurs communiquent via **Discord vocal**
- Le présentateur anime le jeu
- Mode par défaut

### 2. Chat intégré

- Un **chat textuel** apparaît dans le dashboard
- Les joueurs peuvent écrire leurs propositions
- Utile sans micro

### 3. Silencieux

- Jeu **purement visuel**
- Pas de communication nécessaire
- Idéal pour streaming sans interaction

---

## ⚙️ PARAMÈTRES AVANCÉS

### Changer de présentateur

- Le présentateur actuel peut céder sa place
- Un autre joueur devient présentateur
- Utile pour faire tourner les rôles

### Nouvelle partie

- Relance une partie avec les mêmes joueurs
- Réinitialise les scores
- Génère de nouveaux puzzles

### Quitter

- Quitte la partie en cours
- Les autres joueurs peuvent continuer

---

## 🛠️ TECHNOLOGIES UTILISÉES

- **HTML5** - Structure sémantique
- **CSS3** - Animations, transforms, gradients (100% CSS, pas d'images)
- **JavaScript ES6+** - Modules, classes, async/await
- **localStorage API** - Synchronisation multijoueur
- **JSON** - Configuration et données

### Compatibilité

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

---

## 📱 RESPONSIVE

L'application s'adapte automatiquement:

- **Desktop**: Vue complète avec tous les éléments
- **Tablette**: Disposition optimisée
- **Mobile**: Interface simplifiée mais fonctionnelle

---

## 🐛 DÉPANNAGE

### Les joueurs ne voient pas les mises à jour

- Vérifiez que tous les joueurs ont autorisé le **localStorage**
- Rafraîchissez la page (F5)
- Assurez-vous d'être dans la **même partie** (même code)

### La roue ne tourne pas

- Vérifiez la console du navigateur (F12)
- Assurez-vous que `wheel-segments.json` est bien chargé
- Videz le cache du navigateur

### Les overlays ne se synchronisent pas

- Ajoutez `?room=VOTRE_CODE` à l'URL de chaque overlay
- Exemple: `wheel-overlay.html?room=ABC123`
- Vérifiez que le mode streameur est activé

### Erreur "Code de partie invalide"

- Le code est **sensible à la casse** (majuscules uniquement)
- Vérifiez qu'il n'y a pas d'espaces
- La partie existe peut-être plus (timeout 60 min)

---

## 🎨 PERSONNALISATION

### Couleurs

Modifiez `css/colors.css` pour changer les couleurs:

```css
:root {
    --color-primary: #0066CC;      /* Bleu principal */
    --color-secondary: #FFD700;    /* Or */
    --color-background: #1a1a2e;   /* Fond sombre */
    /* ... */
}
```

### Segments de la roue

Modifiez `data/wheel-segments.json`:

```json
{
  "segments": [
    {"id": 1, "value": 100, "type": "money", "color": "#FF6B35"},
    {"id": 2, "value": "BONUS", "type": "special", "color": "#FFD700", "effect": "bonus"}
  ]
}
```

### Énigmes

Ajoutez vos propres énigmes dans `data/puzzles.json`:

```json
{
  "puzzles": [
    {"category": "VOTRE CATÉGORIE", "solution": "VOTRE SOLUTION"}
  ]
}
```

---

## 📈 FONCTIONNALITÉS FUTURES

- [ ] Système de sauvegarde des parties
- [ ] Statistiques des joueurs
- [ ] Mode entraînement solo
- [ ] Effets sonores
- [ ] Animations de victoire
- [ ] Support WebRTC pour vrai multijoueur en ligne
- [ ] Application mobile native

---

## 👨‍💻 DÉVELOPPEMENT

### Structure du code

- **networking.js**: Gestion des rooms via localStorage (simulation de serveur)
- **game.js**: Toute la logique métier (règles, scores, manches)
- **wheel.js**: Animation CSS de la roue (rotation, segments)
- **ui.js**: Manipulation du DOM (affichage, mises à jour)
- **app.js**: Orchestration de tous les modules

### Ajouter une fonctionnalité

1. Modifiez le module approprié
2. Mettez à jour `app.js` si nécessaire
3. Testez en local
4. Committez et pushez sur GitHub Pages

---

## 📄 LICENCE

Ce projet est un fan-game éducatif basé sur l'émission "La Roue de la Fortune" de M6.

**Tous les droits de l'émission appartiennent à M6 et à ses producteurs.**

Ce code est fourni à des fins éducatives et ne doit pas être utilisé commercialement.

---

## 🙏 CRÉDITS

- **Émission originale**: La Roue de la Fortune (M6)
- **Présentateur**: Éric Antoine
- **Développement**: Projet open-source communautaire

---

## 📞 SUPPORT

Pour toute question ou problème:

1. Vérifiez d'abord la section **DÉPANNAGE**
2. Consultez la console du navigateur (F12)
3. Ouvrez une issue sur GitHub
4. Partagez vos captures d'écran et messages d'erreur

---

## 🎉 AMUSEZ-VOUS BIEN !

Que le meilleur gagne ! Bonne chance à tous les candidats ! 🎡✨

---

**Version 1.0** - Octobre 2025
