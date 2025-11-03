// ====================================
// APP.JS - Point d'entrée principal
// ====================================

import { NetworkManager } from './networking.js';
import { GameEngine } from './game.js';
import { WheelManager } from './wheel.js';
import { UIManager } from './ui.js';

class RoueDeLaFortune {
    detectPage() {
        const path = window.location.pathname;
        if (path.includes('dashboard.html')) return 'dashboard';
        if (path.includes('wheel-overlay.html')) return 'wheel';
        if (path.includes('puzzle-overlay.html')) return 'puzzle';
        if (path.includes('players-overlay.html')) return 'players';
        if (path.includes('game-overlay.html')) return 'game-overlay';
        return 'index';
    }
    constructor() {
        this.network = new NetworkManager();
        this.wheel = new WheelManager();
        this.game = new GameEngine(this.network, this.wheel);
        this.ui = new UIManager(this.network);
        this.currentPage = this.detectPage();
        // Démarrer l'initialisation asynchrone
        this.init();
    }

    async init() {
        // Charger les modules dépendants (jeu / roue) — erreurs affichées à l'utilisateur
        try {
            await this.game.init();
        } catch (e) {
            this.ui.showMessage('errorMessage', 'Erreur lors du chargement de la configuration du jeu : ' + (e.message || e), 'error');
            console.error(e);
            return;
        }

        try {
            await this.wheel.init();
        } catch (e) {
            this.ui.showMessage('errorMessage', 'Erreur lors du chargement de la roue : ' + (e.message || e), 'error');
            console.error(e);
            return;
        }

        // Initialiser la page courante
        switch (this.currentPage) {
            case 'index':
                this.initIndexPage();
                break;
            case 'dashboard':
                this.initDashboard();
                break;
            case 'wheel':
                this.initWheelOverlay();
                break;
            case 'puzzle':
                this.initPuzzleOverlay();
                break;
            case 'players':
                this.initPlayersOverlay();
                break;
            case 'game-overlay':
                this.initGameOverlay();
                break;
        }

        // Écoute des mises à jour de la room
        this.network.onUpdate(roomData => this.handleRoomUpdate(roomData));

        if (this.currentPage === 'index') {
            this.setupCodeToggleAndCopy();
        }
    }

    async updateDefaultBannedWordsUI() {
        
        const listElem = document.getElementById('defaultBannedWordsList');
        const toggleBtn = document.getElementById('toggleBannedWordsBtn');
        const wrapper = document.getElementById('defaultBannedWordsListWrapper');
        const searchInput = document.getElementById('bannedWordsSearch');
    const sortSelect = document.getElementById('bannedWordsSort');
    const toggleRegexCheckbox = document.getElementById('bannedWordsShowRegex');
        const statusElem = document.getElementById('defaultBannedWordsStatus');
        const missing = [];
        if (!listElem) missing.push('defaultBannedWordsList');
        if (!toggleBtn) missing.push('toggleBannedWordsBtn');
        if (!wrapper) missing.push('defaultBannedWordsListWrapper');
        if (!searchInput) missing.push('bannedWordsSearch');
        if (!sortSelect) missing.push('bannedWordsSort');
        if (missing.length) {
            console.warn('updateDefaultBannedWordsUI: missing DOM elements:', missing.join(', '));
            if (statusElem) statusElem.textContent = 'État : éléments manquants - voir console';
            return;
        }

    let bannedWords = [];
    let bannedPatterns = [];
    let lastSearch = '';
    let lastSort = 'az';
        let showRegex = true;
        // initialize from checkbox if present
        if (toggleRegexCheckbox) {
            showRegex = !!toggleRegexCheckbox.checked;
        }

        // Enable/disable sort options that rely on regex presence
        function updateSortOptionsState() {
            try {
                const optRegexFirst = sortSelect.querySelector('option[value="regexFirst"]');
                const optRegexLast = sortSelect.querySelector('option[value="regexLast"]');
                if (optRegexFirst) optRegexFirst.disabled = !showRegex;
                if (optRegexLast) optRegexLast.disabled = !showRegex;
                // If regex options become unavailable while selected, fall back to A-Z
                if (!showRegex && (lastSort === 'regexFirst' || lastSort === 'regexLast')) {
                    lastSort = 'az';
                    if (sortSelect) sortSelect.value = 'az';
                }
            } catch (e) {
                // ignore UI update errors
            }
        }

        // Gestion du toggle
        toggleBtn.onclick = () => {
            if (statusElem) statusElem.textContent = 'État : clic détecté';
            const isVisible = !wrapper.classList.contains('hidden');
            wrapper.classList.toggle('hidden');
            toggleBtn.textContent = isVisible ? 'Afficher la liste' : 'Masquer la liste';
            if (!isVisible) {
                // when becoming visible, mark loading
                if (statusElem) statusElem.textContent = 'État : affichage — chargement...';
            }
        };
        wrapper.classList.add('hidden');
        toggleBtn.textContent = 'Afficher la liste';

        // Fonction d'affichage (mots et regex dans une seule liste)
        function render() {
            
            let items = [];
            bannedWords.forEach(w => items.push({ type: 'word', value: w }));
            bannedPatterns.forEach(p => items.push({ type: 'regex', value: p }));
            let search = lastSearch.trim();
            if (search) {
                try {
                    let re = new RegExp(search, 'i');
                    items = items.filter(item => re.test(item.value));
                } catch {
                    // Si regex invalide, ne rien filtrer
                }
            }
            if (lastSort === 'az') {
                items.sort((a, b) => a.value.localeCompare(b.value));
            } else if (lastSort === 'za') {
                items.sort((a, b) => b.value.localeCompare(a.value));
            } else if (lastSort === 'regexFirst') {
                items.sort((a, b) => {
                    if (a.type === b.type) return a.value.localeCompare(b.value);
                    return a.type === 'regex' ? -1 : 1;
                });
            } else if (lastSort === 'regexLast') {
                items.sort((a, b) => {
                    if (a.type === b.type) return a.value.localeCompare(b.value);
                    return a.type === 'regex' ? 1 : -1;
                });
            }
            // Option: hide regex entries when requested
            if (!showRegex) {
                items = items.filter(it => it.type !== 'regex');
            }
            listElem.innerHTML = items.length
                ? items.map(item => item.type === 'word'
                    ? `<li>"${item.value}"</li>`
                    : `<li><span style="color:var(--color-danger);">[regex]</span> <code>${item.value}</code></li>`
                ).join('')
                : '<li>Aucun résultat</li>';
            if (statusElem) statusElem.textContent = `État : affiché (${items.length} éléments)`;
        }

        searchInput.addEventListener('input', e => {
            lastSearch = e.target.value;
            render();
        });
        sortSelect.addEventListener('change', e => {
            lastSort = e.target.value;
            render();
        });

        // Checkbox to show/hide regex patterns in the list
        if (toggleRegexCheckbox) {
            toggleRegexCheckbox.checked = !!showRegex;
            // ensure sort options state matches initial checkbox
            updateSortOptionsState();
            toggleRegexCheckbox.addEventListener('change', (e) => {
                showRegex = !!e.target.checked;
                // update which sort options are selectable
                updateSortOptionsState();
                render();
            });
        } else {
            // if no checkbox present, still ensure options reflect current state
            updateSortOptionsState();
        }

    listElem.innerHTML = '<li>Chargement...</li>';
        if (statusElem) statusElem.textContent = 'État : chargement...';
        try {
            fetch('data/banned-words.json').then(r => r.json()).then(data => {
                
                bannedWords = Array.isArray(data.bannedWords) ? data.bannedWords.slice() : [];
                bannedPatterns = Array.isArray(data.bannedPatterns) ? data.bannedPatterns.slice() : [];
                render();
                
            }).catch(() => {
                console.error('Erreur lors du fetch des banned-words.json (catch)');
                listElem.innerHTML = '<li>Erreur de chargement</li>';
                if (statusElem) statusElem.textContent = 'État : erreur de chargement';
            });
        } catch {
            console.error('Erreur lors du fetch des banned-words.json (try/catch)');
            listElem.innerHTML = '<li>Erreur de chargement</li>';
            if (statusElem) statusElem.textContent = 'État : erreur de chargement';
        }
    }

    // ...existing code...

    setupCodeToggleAndCopy() {
        const toggleCodeBtn = document.getElementById('toggleCodeBtn');
        const displayCode = document.getElementById('displayRoomCode');
        const copyBtn = document.getElementById('copyCodeBtn');

        if (!toggleCodeBtn || !displayCode || !copyBtn) return;

        // Variable pour stocker le code réel
        this.realRoomCode = null;

        // Mettre à jour l'affichage avec code caché initialement
        displayCode.textContent = '******';
        displayCode.classList.add('room-code-hidden');

        // Basculer affichage clair / caché
        toggleCodeBtn.addEventListener('click', () => {
            if (displayCode.classList.contains('room-code-hidden')) {
                // Afficher code réel
                displayCode.textContent = this.realRoomCode || '******';
                displayCode.classList.remove('room-code-hidden');
                displayCode.classList.add('room-code-visible');
                toggleCodeBtn.textContent = '🙈 Masquer';
            } else {
                // Cacher le code
                displayCode.textContent = '******';
                displayCode.classList.add('room-code-hidden');
                displayCode.classList.remove('room-code-visible');
                toggleCodeBtn.textContent = '👁️ Afficher';
            }
        });

        // Copier le code réel dans le presse-papiers
        copyBtn.addEventListener('click', () => {
            if (this.realRoomCode) {
                navigator.clipboard.writeText(this.realRoomCode).then(() => {
                    // success feedback (non-critical) — use UI success message
                    this.ui.showMessage('errorMessage', 'Code copié dans le presse-papiers', 'success');
                }).catch(() => {
                    // show error to player
                    this.ui.showMessage('errorMessage', 'Erreur lors de la copie', 'error');
                });
            } else {
                this.ui.showMessage('errorMessage', 'Aucun code disponible à copier', 'error');
            }
        });
    }

    updateLobby(roomData) {
        const currentPlayer = this.network.getCurrentPlayer();
        const isHost = this.network.isHost();

        // Stocker le vrai code à afficher dans app.js
        this.realRoomCode = roomData.code;

        // Affichage du code à ****** ou clair suivant état
        const displayCode = document.getElementById('displayRoomCode');
        const toggleCodeBtn = document.getElementById('toggleCodeBtn');
        if (displayCode && toggleCodeBtn) {
            // compute desired value but only update DOM if it actually changed
            const desired = displayCode.classList.contains('room-code-visible') ? (this.realRoomCode || '******') : '******';
            if (String(displayCode.textContent) !== String(desired)) {
                displayCode.textContent = desired;
            }
        }

        // Met à jour compteur joueurs connectés (uniquement joueurs pas le host)
        const playerCountElem = document.getElementById('playerCount');
        if (playerCountElem) {
            const connectedPlayers = roomData.players.filter(p => p.role === 'player' && p.connected).length;
            playerCountElem.textContent = connectedPlayers.toString();
        }

        this.ui.updatePlayersList(roomData, currentPlayer?.id, isHost);
        
        // Gérer la reconnexion même dans le lobby
        this.handleReconnectionUI(roomData);

        this.handleReconnectionUI(roomData);
        this.handlePauseUI(roomData);

        // communication mode feature removed

        // Mettre à jour l'affichage des paramètres de la room (lecture seule)
        try {
            const persistElem = document.getElementById('displayPersistBans');
            const filterElem = document.getElementById('displayFilterPseudos');
            const settings = roomData.settings || {};
            const persist = !!settings.persistBans;
            const filter = settings.filterBannedUsernames === undefined ? true : !!settings.filterBannedUsernames;

            // Mettre à jour seulement si les settings ont changé pour éviter d'écrire partout
            const last = this._lastRoomSettings || {};
            if (last.persistBans !== persist || last.filterBannedUsernames !== filter) {
                if (persistElem) {
                    persistElem.textContent = persist ? 'Activé' : 'Désactivé';
                }
                if (filterElem) {
                    filterElem.textContent = filter ? 'Activé' : 'Désactivé';
                }
                this._lastRoomSettings = { persistBans: persist, filterBannedUsernames: filter };
                // Mettre à jour les toggles dans la lobby si présents (host peut modifier)
                try {
                    const persistToggle = document.getElementById('persistBansToggle');
                    const filterToggle = document.getElementById('filterBannedToggle');
                    if (persistToggle) {
                        persistToggle.checked = persist;
                        persistToggle.disabled = !isHost;
                    }
                    if (filterToggle) {
                        filterToggle.checked = filter;
                        filterToggle.disabled = !isHost;
                    }
                } catch (e) {
                    // ignore
                }
            }
        } catch (e) {
            // ignore UI update errors
            console.error('Erreur lors de la mise à jour de l\'affichage des paramètres de room:', e);
        }

        // Mise à jour de la liste des joueurs avec contrôles
    // Mettre à jour la liste des bannis affichée si présent
    this.updateBannedListUI(roomData);

        const playersList = document.getElementById('playersList');
        if (playersList) {
            playersList.innerHTML = '';
            roomData.players.forEach(player => {
                const li = document.createElement('li');
                const classes = [];
                
                // Classe pour le rôle
                if (player.role === 'host') classes.push('host');
                
                // Classe pour soi-même
                if (player.id === currentPlayer?.id) classes.push('self');
                
                // Classe pour déconnecté
                if (!player.connected) classes.push('disconnected');
                
                li.className = classes.join(' ');
                
                const playerName = document.createElement('span');
                playerName.className = 'player-name';
                playerName.textContent = player.name;
                li.appendChild(playerName);

                const playerRole = document.createElement('span');
                playerRole.className = 'player-role';
                playerRole.textContent = player.role === 'host' ? '👑 Présentateur' : '🎮 Joueur';
                li.appendChild(playerRole);

                // Status de connexion
                if (!player.connected) {
                    const status = document.createElement('span');
                    status.className = 'player-status player-disconnected';
                    const remainingTime = this.network.getDisconnectTimeRemaining(player);
                    status.textContent = `Déconnecté (${remainingTime}s)`;
                    li.appendChild(status);
                }

                // Contrôles pour le présentateur uniquement
                if (isHost && player.role !== 'host') {
                    const controls = document.createElement('div');
                    controls.className = 'player-controls';

                    const kickBtn = document.createElement('button');
                    kickBtn.className = 'btn btn-warning';
                    kickBtn.textContent = 'Exclure';
                    kickBtn.onclick = () => this.network.kickPlayer(player.id);
                    controls.appendChild(kickBtn);

                    const banBtn = document.createElement('button');
                    banBtn.className = 'btn btn-danger';
                    banBtn.textContent = 'Bannir';
                    banBtn.onclick = () => this.handlePlayerBan(player.name);
                    controls.appendChild(banBtn);

                    li.appendChild(controls);
                }

                playersList.appendChild(li);
            });
        }

            // Le toggle de persistance des bannis n'est pas modifiable en pleine partie
        // communication mode feature removed
    }

    // Correction logique JoinRoom avec gestion d'erreur coté client
    async joinRoom() {
        const playerName = document.getElementById('playerNameJoin')?.value.trim();
        const playerRole = document.getElementById('playerRoleJoin')?.value;
        const roomCode = document.getElementById('roomCode')?.value.trim().toUpperCase();

        if (!playerName || !roomCode) {
            this.ui.showMessage('errorMessage', 'Veuillez remplir tous les champs', 'error');
            return;
        }

        // Vérifier la room (besoin des settings pour appliquer les filtres)
        const roomData = await this.network.getRoomDataAsync(roomCode);
        if (!roomData) {
            this.ui.showMessage('errorMessage', 'Partie inexistante avec ce code.', 'error');
            return;
        }

        // Lire les settings de la room (persistBans contrôle la prise en compte des bannis)
        const persistBans = roomData.settings ? !!roomData.settings.persistBans : true;

        // Filtre de pseudos bannis configurable dans les settings de la room
        const filterPseudos = roomData.settings ? !!roomData.settings.filterBannedUsernames : true;
        if (filterPseudos) {
            const hasBannedWords = await this.checkBannedWords(playerName);
            if (hasBannedWords) {
                this.ui.showMessage('errorMessage', 'Ce pseudo contient des mots interdits. Veuillez en choisir un autre.', 'error');
                return;
            }
        }

        // Vérifier si le pseudo existe déjà dans la partie (pour reconnexion)
        const existingPlayer = roomData.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        
        // Si le joueur veut rejoindre en tant que host
        if (playerRole === 'host') {
            // Vérifier s'il y a déjà un host déconnecté avec ce pseudo (reconnexion autorisée)
            if (existingPlayer && existingPlayer.role === 'host' && !existingPlayer.connected) {
                // C'est une reconnexion du host, autoriser
            } else {
                // Sinon, interdire de rejoindre en tant que host
                this.ui.showMessage('errorMessage', 'Impossible de rejoindre cette partie en tant que présentateur. Sélectionnez "Joueur" pour rejoindre.', 'error');
                return;
            }
        }

        // Si le joueur était dans la file d'attente et a été débanni entre-temps
        const player = roomData.players.find(
            p => p.name.toLowerCase() === playerName.toLowerCase() && !p.connected && p.disconnectedAt
        );
        const isInQueue = player && this.network.getDisconnectTimeRemaining(player) > 0;

        // Vérifier la liste des bannis stockée côté room (source de vérité unique)
        // Si le joueur n'est pas actuellement dans la file d'attente (débanni pendant l'attente)
        if (!isInQueue && persistBans && roomData.bannedPlayers && roomData.bannedPlayers.some(b => b.toLowerCase() === playerName.toLowerCase())) {
            this.ui.showMessage('errorMessage', 'Vous avez été banni de cette partie.', 'error');
            return;
        }

        // Vérification déjà faite plus haut - existingPlayer est déjà défini
        if (existingPlayer) {
            // Si le joueur est déconnecté, autoriser la reconnexion
            if (!existingPlayer.connected) {
                // Le joueur va se reconnecter, continuer le processus
            } else {
                // Le joueur est déjà connecté, interdire
                this.ui.showMessage('errorMessage', 'Ce pseudo est déjà utilisé dans la partie', 'error');
                return;
            }
        }

        // Interdire rejoindre si gérant déjà présent et connecté (et que le joueur veut être gérant sans être une reconnexion)
        const hostPresent = roomData.players.some(p => p.role === 'host' && p.connected);
        if (playerRole === 'host' && hostPresent) {
            this.ui.showMessage('errorMessage', 'Le gérant est déjà dans la partie.', 'error');
            return;
        }

        // Partie pleine si 4 joueurs connectés
        const connectedPlayersCount = roomData.players.filter(p => p.role === 'player' && p.connected).length;
        if (playerRole === 'player' && connectedPlayersCount >= 4) {
            this.ui.showMessage('errorMessage', 'La partie est pleine (4 joueurs max).', 'error');
            return;
        }

        const result = await this.network.joinRoom(roomCode, playerName, playerRole);
        if (result.success) {
            document.getElementById('displayRoomCode').textContent = '******';
            this.ui.hide('joinRoomScreen');
            this.ui.hide('createRoomScreen');
            this.ui.show('lobbyScreen');

            if (playerRole === 'host') {
                this.ui.show('hostControls');
                // Le host peut voir la section settings
                const settingsSection = document.getElementById('settings');
                if (settingsSection) settingsSection.classList.remove('hidden');
                // Masquer les contrôles de débannissement et suppression en salle d'attente
                const unbanSection = document.getElementById('unbanLocalSection');
                const clearBtn = document.getElementById('clearLocalBansBtn');
                const warningMsg = document.getElementById('lobbyBanWarning');
                if (unbanSection) unbanSection.classList.add('hidden');
                if (clearBtn) clearBtn.classList.add('hidden');
                if (warningMsg) warningMsg.classList.remove('hidden');
                // Rafraîchir l'affichage de la liste des bannis pour masquer les boutons "Retirer"
                this.updateLocalBannedListUI();
            } else {
                this.ui.hide('hostControls');
                // Les joueurs ne peuvent pas voir la section settings
                const settingsSection = document.getElementById('settings');
                if (settingsSection) settingsSection.classList.add('hidden');
            }
            this.updateLobby(result.data);

            if (result.reconnected) {
                if (result.isHost) {
                    this.ui.showMessage('errorMessage', '✅ Reconnexion réussie ! La partie reprend.', 'success');
                } else {
                    this.ui.showMessage('errorMessage', 'Bienvenue de nouveau ! Votre reconnexion a été prise en compte.', 'success');
                }
            }
        } else {
            this.ui.showMessage('errorMessage', result.error, 'error');
        }
    }
    
    detectPreviousReconnectAttempt() {
        const playerName = document.getElementById('playerNameJoin')?.value.trim();
        const roomCode = document.getElementById('roomCode')?.value.trim().toUpperCase();
        if (!playerName || !roomCode) return;

        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) return;

        const player = roomData.players.find(
            p => p.name === playerName && !p.connected && p.disconnectedAt
        );
        if (player && this.network.getDisconnectTimeRemaining(player) > 0) {
            this.rejoinDisconnected(playerName, roomCode);
        }
    }

    rejoinDisconnected(playerName, roomCode) {
        const result = this.network.joinRoom(roomCode, playerName, 'player');
        if (result.success || result.reconnected) {
            document.getElementById('displayRoomCode').textContent = '******';
            this.ui.hide('joinRoomScreen');
            this.ui.hide('createRoomScreen');
            this.ui.show('lobbyScreen');
            // Les joueurs ne peuvent pas voir la section settings
            const settingsSection = document.getElementById('settings');
            if (settingsSection) settingsSection.classList.add('hidden');
            this.updateLobby(result.data);
            this.ui.showMessage('errorMessage', 'Votre reconnexion a été prise en compte.', 'success');
        }
    }

    // ==============================
    // PAGE INDEX
    // ==============================
    handlePlayerBan(playerName) {
        if (!this.network.isHost()) return;
        
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomCode) return;

        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) return;

        // Stocker les pseudos bannis avec leur casse originale mais vérifier en lowercase
        const existing = Array.isArray(roomData.bannedPlayers) ? roomData.bannedPlayers.slice() : [];
        const lower = playerName.toLowerCase();
        
        // Vérifier si déjà banni (insensible à la casse)
        const alreadyBanned = existing.some(b => b.toLowerCase() === lower);
        if (!alreadyBanned) {
            existing.push(playerName); // Stocker le pseudo avec sa casse originale
            this.network.updateRoomState({ bannedPlayers: existing });
        }

        // Maintenir côté client aussi (avec casse originale)
        // Retirer d'abord toute variante existante
        for (const b of Array.from(this.bannedPlayers)) {
            if (b.toLowerCase() === lower) {
                this.bannedPlayers.delete(b);
            }
        }
        this.bannedPlayers.add(playerName);
        try {
            localStorage.setItem('bannedPlayers', JSON.stringify(Array.from(this.bannedPlayers)));
        } catch (e) {
            console.error('Impossible de sauvegarder la liste des bannis localement :', e);
        }
        // Mettre à jour l'affichage local des bannis
        try { this.updateLocalBannedListUI(); } catch (e) { /* ignore */ }

        // Expulser le joueur s'il est connecté (insensible à la casse)
        const player = roomData.players.find(p => p.name.toLowerCase() === lower);
        if (player) {
            this.network.kickPlayer(player.id);
        }
    }

    // Met à jour l'affichage de la liste des pseudos bannis (host voit les contrôles)
    updateBannedListUI(roomData) {
        const bannedList = document.getElementById('bannedPlayersList');
        if (!bannedList) return;

        bannedList.innerHTML = '';
        const currentPlayer = this.network.getCurrentPlayer();
        const isHost = this.network.isHost();

        // Prefer roomData.bannedPlayers if available, else local set
        const bannedArray = Array.isArray(roomData?.bannedPlayers) ? roomData.bannedPlayers.slice() : Array.from(this.bannedPlayers || []);

        bannedArray.forEach(name => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.className = 'ban-name';
            span.textContent = name;
            li.appendChild(span);

            if (isHost) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-small unban-btn';
                btn.textContent = 'Retirer';
                btn.onclick = () => this.removeBannedPlayer(name);
                li.appendChild(btn);
            }

            bannedList.appendChild(li);
        });

        // Clear all button
        const clearBtn = document.getElementById('clearBansBtn');
        if (clearBtn) {
            clearBtn.disabled = !isHost || bannedArray.length === 0;
        }
    }

    // Met à jour l'affichage des bannis locaux stockés sur cet appareil
    updateLocalBannedListUI() {
        const localList = document.getElementById('localBannedList');
        if (!localList) return;
        localList.innerHTML = '';
        const arr = Array.from(this.bannedPlayers || []);
        
        // Vérifier si on est en salle d'attente
        const lobbyScreen = document.getElementById('lobbyScreen');
        const isInLobby = lobbyScreen && !lobbyScreen.classList.contains('hidden');
        
        arr.forEach(name => {
            const li = document.createElement('li');
            // Pseudo left, in quotes
            const span = document.createElement('span');
            span.className = 'ban-name';
            span.textContent = `"${name}"`;
            li.appendChild(span);
            
            // Afficher le bouton "Retirer" seulement si on n'est PAS en salle d'attente
            if (!isInLobby) {
                const btn = document.createElement('button');
                btn.className = 'btn btn-small unban-local-btn';
                btn.textContent = 'Retirer';
                btn.onclick = () => {
                    // Retirer le pseudo exact (pas besoin de toLowerCase ici)
                    if (this.bannedPlayers.has(name)) {
                        this.bannedPlayers.delete(name);
                        try { localStorage.setItem('bannedPlayers', JSON.stringify(Array.from(this.bannedPlayers))); } catch (e) { console.error(e); }
                        this.updateLocalBannedListUI();
                        this.ui.showMessage('errorMessage', `Le pseudo "${name}" a été retiré des bannissements locaux.`, 'success');
                    }
                };
                li.appendChild(btn);
            }
            localList.appendChild(li);
        });
        // disable/enable clear local button
        const clearLocalBtn = document.getElementById('clearLocalBansBtn');
        if (clearLocalBtn) clearLocalBtn.disabled = arr.length === 0;
    }

    // Affiche la liste des mots bannis par défaut (lecture seule, tri, recherche, regex)
    // ...existing code...

    

    // Supprimer un pseudo de la liste des bannis (host action)
    removeBannedPlayer(name) {
        if (!this.network.isHost()) return;
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomCode) return;
        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) return;

        const lower = name.toLowerCase();
        const existing = Array.isArray(roomData.bannedPlayers) ? roomData.bannedPlayers.slice() : [];
        // Filtrer en comparant en lowercase
        const filtered = existing.filter(b => b.toLowerCase() !== lower);
        this.network.updateRoomState({ bannedPlayers: filtered });

        // maintain local set (retirer toutes les variantes)
        for (const b of Array.from(this.bannedPlayers)) {
            if (b.toLowerCase() === lower) {
                this.bannedPlayers.delete(b);
            }
        }
        try {
            localStorage.setItem('bannedPlayers', JSON.stringify(Array.from(this.bannedPlayers)));
        } catch (e) {
            console.error('Impossible de sauvegarder la liste des bannis localement :', e);
        }
        // update UI immediately (room and local)
        this.updateBannedListUI(this.network.getRoomData(this.network.getCurrentRoomCode()) || {});
        try { this.updateLocalBannedListUI(); } catch (e) { /* ignore */ }
    }

    // Supprimer tous les pseudos bannis (host action)
    clearAllBannedPlayers() {
        if (!this.network.isHost()) return;
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomCode) return;
        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) return;

        this.network.updateRoomState({ bannedPlayers: [] });
        // clear local set as well
        this.bannedPlayers.clear();
        try {
            localStorage.setItem('bannedPlayers', JSON.stringify(Array.from(this.bannedPlayers)));
        } catch (e) {
            console.error('Impossible de sauvegarder la liste des bannis localement :', e);
        }
        this.updateBannedListUI(this.network.getRoomData(this.network.getCurrentRoomCode()) || {});
        try { this.updateLocalBannedListUI(); } catch (e) { /* ignore */ }
    }

    async checkBannedWords(text) {
        try {
            const response = await fetch('data/banned-words.json');
            const data = await response.json();
            const lower = text.toLowerCase();

            // Vérifier si le pseudo contient un des mots interdits (substring match)
            for (const bw of data.bannedWords || []) {
                const b = (bw || '').toLowerCase();
                if (!b) continue;
                if (lower.includes(b)) return true;
            }

            // Vérifier les motifs (patterns) — patterns peuvent contenir des jokers '*'
            return (data.bannedPatterns || []).some(pattern => {
                const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
                return regex.test(text);
            });
        } catch {
            return false;
        }
    }

    initIndexPage() {        
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const startBtn = document.getElementById('startGameBtn');
    const leaveBtn = document.getElementById('leaveLobbyBtn');
        
        // Charger la liste des bannis du localStorage
        const savedBannedPlayers = localStorage.getItem('bannedPlayers');
        if (savedBannedPlayers) {
            try {
                this.bannedPlayers = new Set(JSON.parse(savedBannedPlayers));
                // Mettre à jour l'affichage local des bannis
                this.updateLocalBannedListUI();
            } catch (e) {
                // Afficher l'erreur au joueur
                this.ui.showMessage('errorMessage', 'Erreur lors du chargement de la liste des bannis : ' + (e?.message || e), 'error');
                console.error('Erreur lors du chargement de la liste des bannis:', e);
            }
        }

        // Afficher la liste des mots bannis par défaut
        this.updateDefaultBannedWordsUI();

        // Gestionnaire du bouton de bannissement
        const banBtn = document.getElementById('banPlayerBtn');
        const banInput = document.getElementById('banPlayerInput');
        if (banBtn && banInput) {
            banBtn.addEventListener('click', () => {
                const playerName = banInput.value.trim();
                if (playerName) {
                    this.handlePlayerBan(playerName);
                    banInput.value = '';
                }
            });
        }

        // Controls for local ban, unban, and clearing local bans (device only)
        const banLocalBtn = document.getElementById('banLocalBtn');
        const banLocalInput = document.getElementById('banLocalInput');
        const unbanLocalBtn = document.getElementById('unbanLocalBtn');
        const unbanLocalInput = document.getElementById('unbanLocalInput');
        const clearLocalBansBtn = document.getElementById('clearLocalBansBtn');

        if (banLocalBtn && banLocalInput) {
            banLocalBtn.addEventListener('click', () => {
                const name = banLocalInput.value.trim();
                if (!name) {
                    this.ui.showMessage('errorMessage', 'Veuillez saisir un pseudo à bannir localement.', 'error');
                    return;
                }
                const lower = name.toLowerCase();
                // Vérifier si déjà banni (insensible à la casse)
                const alreadyBanned = Array.from(this.bannedPlayers).some(b => b.toLowerCase() === lower);
                if (alreadyBanned) {
                    this.ui.showMessage('errorMessage', 'Ce pseudo est déjà banni localement.', 'error');
                    return;
                }
                // Stocker avec la casse originale
                this.bannedPlayers.add(name);
                try { localStorage.setItem('bannedPlayers', JSON.stringify(Array.from(this.bannedPlayers))); } catch (e) { console.error(e); }
                this.updateLocalBannedListUI();
                this.ui.showMessage('errorMessage', `Le pseudo "${name}" a été ajouté aux bannissements locaux.`, 'success');
                banLocalInput.value = '';
            });
        }

        if (unbanLocalBtn && unbanLocalInput) {
            unbanLocalBtn.addEventListener('click', () => {
                const name = unbanLocalInput.value.trim();
                if (!name) {
                    this.ui.showMessage('errorMessage', 'Veuillez saisir un pseudo à débannir localement.', 'error');
                    return;
                }
                const lower = name.toLowerCase();
                // Trouver et supprimer toutes les variantes (insensible à la casse)
                let found = false;
                for (const b of Array.from(this.bannedPlayers)) {
                    if (b.toLowerCase() === lower) {
                        this.bannedPlayers.delete(b);
                        found = true;
                    }
                }
                if (!found) {
                    this.ui.showMessage('errorMessage', 'Ce pseudo n\'est pas présent dans la liste des bannis locaux.', 'error');
                    return;
                }
                try { localStorage.setItem('bannedPlayers', JSON.stringify(Array.from(this.bannedPlayers))); } catch (e) { console.error(e); }
                this.updateLocalBannedListUI();
                this.ui.showMessage('errorMessage', `Le pseudo "${name}" a été retiré des bannissements locaux.`, 'success');
                unbanLocalInput.value = '';
            });
        }

        if (clearLocalBansBtn) {
            clearLocalBansBtn.addEventListener('click', () => {
                this.bannedPlayers.clear();
                try { localStorage.setItem('bannedPlayers', JSON.stringify(Array.from(this.bannedPlayers))); } catch (e) { console.error(e); }
                this.updateLocalBannedListUI();
                this.ui.showMessage('errorMessage', 'Tous les pseudos bannis stockés sur cet appareil ont été supprimés.', 'success');
            });
        }

        // communication mode removed

        const playerName = document.getElementById('playerNameJoin')?.value.trim();
        const roomCode = document.getElementById('roomCode')?.value.trim().toUpperCase();
        if (playerName && roomCode) {
            this.detectPreviousReconnectAttempt();
        }

        if (createBtn) {
            createBtn.addEventListener('click', () => this.createRoom());
        }

        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.joinRoom());
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startGame());
        }

        if (leaveBtn) {
            leaveBtn.addEventListener('click', () => this.leaveRoom());
        }

        // Clear bans button wiring (host-only)
        const clearBansBtn = document.getElementById('clearBansBtn');
        if (clearBansBtn) {
            clearBansBtn.addEventListener('click', () => this.clearAllBannedPlayers());
        }

        // Lobby toggles for settings (host can change)
        const persistToggle = document.getElementById('persistBansToggle');
        const filterToggle = document.getElementById('filterBannedToggle');
        if (persistToggle) {
            persistToggle.addEventListener('change', (e) => {
                // Only allow the host to change room settings
                if (!this.network.isHost()) {
                    // reset to room value
                    const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
                    persistToggle.checked = !!(roomData && roomData.settings && roomData.settings.persistBans);
                    return;
                }
                const roomCode = this.network.getCurrentRoomCode();
                if (!roomCode) return;
                const roomData = this.network.getRoomData(roomCode) || {};
                const newSettings = { ...(roomData.settings || {}), persistBans: !!e.target.checked };
                this.network.updateRoomState({ settings: newSettings });
            });
        }

        if (filterToggle) {
            filterToggle.addEventListener('change', (e) => {
                if (!this.network.isHost()) {
                    const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
                    filterToggle.checked = !!(roomData && roomData.settings && roomData.settings.filterBannedUsernames);
                    return;
                }
                const roomCode = this.network.getCurrentRoomCode();
                if (!roomCode) return;
                const roomData = this.network.getRoomData(roomCode) || {};
                const newSettings = { ...(roomData.settings || {}), filterBannedUsernames: !!e.target.checked };
                this.network.updateRoomState({ settings: newSettings });
            });
        }

        // Collapse handler for room settings (compact view)
        const toggleRoomSettings = document.getElementById('toggleRoomSettings');
        const roomSettingsElem = document.getElementById('roomSettings');
        if (toggleRoomSettings && roomSettingsElem) {
            toggleRoomSettings.addEventListener('click', () => {
                roomSettingsElem.classList.toggle('collapsed');
            });
        }
        // Le paramètre de persistance des bannis ne peut pas être changé ici en pleine partie


    }

    async createRoom() {
        const playerName = document.getElementById('playerNameCreate')?.value.trim();
        const nameRegex = /^[a-zA-Z0-9 À-ÿ'.-]{1,20}$/u;

        if (!playerName) {
            this.ui.showMessage('errorMessage', 'Veuillez entrer votre nom', 'error');
            return;
        }

        if (!nameRegex.test(playerName)) {
            this.ui.showMessage('errorMessage', 'Le nom doit contenir jusqu\'à 20 caractères alphanumériques, espaces et certains signes autorisés.', 'error');
            return;
        }

        const existingCode = document.getElementById('roomCode')?.value.trim();
        if (existingCode) {
            this.ui.showMessage('errorMessage', 'Pour créer une partie, ne saisissez pas de code.', 'error');
            return;
        }

        // Vérifier si on est déjà dans une room (éviter la double vérification)
        const currentRoomCode = this.network.getCurrentRoomCode();
        if (currentRoomCode) {
            const roomData = await this.network.getRoomDataAsync(currentRoomCode);
            if (roomData && roomData.players.some(p => p.name.toLowerCase() === playerName.toLowerCase())) {
                this.ui.showMessage('errorMessage', 'Ce pseudo est déjà utilisé dans la partie', 'error'); 
                return;
            }
        }
        
        const result = await this.network.createRoom(playerName, 'host');
        if (!result.success) {
            this.ui.showMessage('errorMessage', 'Erreur lors de la création de la partie', 'error');
            return;
        }
        
        // Charger les pseudos bannis du localStorage et les ajouter à la nouvelle partie
        try {
            const savedBannedPlayers = localStorage.getItem('bannedPlayers');
            if (savedBannedPlayers) {
                const bannedArray = JSON.parse(savedBannedPlayers);
                if (Array.isArray(bannedArray) && bannedArray.length > 0) {
                    // Mettre à jour l'état de la room avec les bannis du localStorage
                    this.network.updateRoomState({ bannedPlayers: bannedArray });
                }
            }
        } catch (e) {
            console.error('Erreur lors du chargement des bannis depuis localStorage:', e);
        }
        
        document.getElementById('displayRoomCode').textContent = '******';
        this.ui.hide('joinRoomScreen');
        this.ui.hide('createRoomScreen');
        this.ui.show('lobbyScreen');
        this.ui.show('hostControls');
        // Le host peut voir la section settings
        const settingsSection = document.getElementById('settings');
        if (settingsSection) settingsSection.classList.remove('hidden');
        // Masquer les contrôles de débannissement et suppression en salle d'attente
        const unbanSection = document.getElementById('unbanLocalSection');
        const clearBtn = document.getElementById('clearLocalBansBtn');
        const warningMsg = document.getElementById('lobbyBanWarning');
        if (unbanSection) unbanSection.classList.add('hidden');
        if (clearBtn) clearBtn.classList.add('hidden');
        if (warningMsg) warningMsg.classList.remove('hidden');
        // Rafraîchir l'affichage de la liste des bannis pour masquer les boutons "Retirer"
        this.updateLocalBannedListUI();
        // Appliquer la valeur par défaut de persistance des bannis sélectionnée lors de la création
        try {
            const persistCheckbox = document.getElementById('persistBansCreate');
            if (persistCheckbox && result.data) {
                const persist = !!persistCheckbox.checked;
                // Lire aussi le paramètre de filtre de pseudos
                const filterCheckbox = document.getElementById('filterBannedCreate');
                const filterFlag = !!(filterCheckbox ? filterCheckbox.checked : true);
                // Mettre à jour les settings de la room fraîchement créée
                const currentSettings = result.data.settings || {};
                this.network.updateRoomState({ 
                    settings: { 
                        ...currentSettings, 
                        persistBans: persist, 
                        filterBannedUsernames: filterFlag 
                    } 
                });
            }
        } catch (e) {
            console.error('Impossible de définir persistBans à la création :', e);
        }
    }

    startGame() {
        const canStart = this.game.startGame();
        if (canStart) {
            // Sauvegarder les infos de session avant la redirection
            const roomCode = this.network.getCurrentRoomCode();
            const playerData = this.network.getCurrentPlayer();
            if (roomCode && playerData) {
                sessionStorage.setItem('currentRoomCode', roomCode);
                sessionStorage.setItem('currentPlayerData', JSON.stringify(playerData));
            }
            // Ne pas revenir à l'accueil, rediriger vers dashboard.html
            window.location.href = 'dashboard.html?room=' + encodeURIComponent(roomCode);
        } else {
            alert(
                'Pour démarrer la partie, il faut au moins 2 joueurs connectés.'
            );
        }
    }

    leaveRoom() {
        this.network.leaveRoom();
        window.location.reload();
    }

    // ==============================
    // DASHBOARD
    // ==============================
    initDashboard() {
        // Récupérer le code de room depuis l'URL ou sessionStorage
        const urlParams = new URLSearchParams(window.location.search);
        let roomCode = urlParams.get('room');
        
        if (!roomCode) {
            roomCode = sessionStorage.getItem('currentRoomCode');
        }
        
        if (!roomCode) {
            window.location.href = 'index.html';
            return;
        }
        
        // Restaurer les données du joueur
        const savedPlayerData = sessionStorage.getItem('currentPlayerData');
        if (savedPlayerData) {
            try {
                this.network.playerData = JSON.parse(savedPlayerData);
            } catch (e) {
                console.error('Erreur lors de la restauration des données du joueur:', e);
            }
        }
        
        // Restaurer le code de room dans le network manager
        this.network.roomCode = roomCode;
        
        // Commencer à écouter la room
        this.network.listenToRoom(roomCode);

        // Vérifier si l'utilisateur est le host ou un joueur
        const isHost = this.network.isHost();
        
        // Afficher la vue appropriée
        if (isHost) {
            document.getElementById('dashboardTitle').textContent = '🎬 DASHBOARD GÉRANT 🎬';
            document.getElementById('hostView').classList.remove('hidden');
            document.getElementById('playerView').classList.add('hidden');
            // Cacher l'identité personnelle pour le gérant
            const selfIdentity = document.querySelector('.self-identity');
            if (selfIdentity) selfIdentity.classList.add('hidden');
            this.initHostDashboard();
        } else {
            document.getElementById('dashboardTitle').textContent = '🎮 TABLEAU DE JEU 🎮';
            document.getElementById('hostView').classList.add('hidden');
            document.getElementById('playerView').classList.remove('hidden');
            // Afficher et initialiser l'identité personnelle pour le joueur
            const selfIdentity = document.querySelector('.self-identity');
            const selfNameEl = document.getElementById('playerSelfName');
            const currentPlayer = this.network.getCurrentPlayer();
            if (selfIdentity) selfIdentity.classList.remove('hidden');
            if (selfNameEl && currentPlayer) selfNameEl.textContent = currentPlayer.name;
            this.initPlayerDashboard();
        }

        // Attendre que les données initiales soient chargées avant de mettre à jour
        const waitForData = () => {
            const roomData = this.network.getRoomData(roomCode);
            if (roomData) {
                this.updateDashboard(roomData);
            } else {
                // Réessayer dans 100ms
                setTimeout(waitForData, 100);
            }
        };
        waitForData();
    }

    initHostDashboard() {
        console.log('[DEBUG] initHostDashboard - Début');
        // Initialiser le système de rotation pour l'overlay
        this.wheelRotation = 0;
        this.lastWheelResult = null;
        console.log('[DEBUG] initHostDashboard - wheelRotation et lastWheelResult initialisés');

        // Créer la roue dans le dashboard (vérifier que les segments sont chargés)
        const createWheelWhenReady = () => {
            if (this.wheel.segments && this.wheel.segments.length > 0) {
                console.log('[DEBUG] initHostDashboard - Création de la roue avec', this.wheel.segments.length, 'segments');
                this.wheel.createWheel('wheelElement');
            } else {
                console.log('[DEBUG] initHostDashboard - Segments pas encore chargés, réessai dans 100ms');
                // Réessayer après un court délai
                setTimeout(createWheelWhenReady, 100);
            }
        };
        createWheelWhenReady();

        const spinBtn = document.getElementById('spinWheelBtn');
        const validateBtn = document.getElementById('validateLetterBtn');
        const buyVowelBtn = document.getElementById('buyvowelBtn');
        const solveBtn = document.getElementById('solvePuzzleBtn');
        const nextBtn = document.getElementById('nextPlayerBtn');

        if (spinBtn) {
            spinBtn.addEventListener('click', () => this.spinWheel());
        }

        if (validateBtn) {
            validateBtn.addEventListener('click', () => this.validateLetter());
        }

        if (buyVowelBtn) {
            buyVowelBtn.addEventListener('click', () => this.buyVowel());
        }

        if (solveBtn) {
            solveBtn.addEventListener('click', () => this.solvePuzzle());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.game.nextPlayer());
        }

        // Actions spéciales
        document.getElementById('holdupBtn')?.addEventListener('click', () => this.promptHoldUp());
        document.getElementById('swapBtn')?.addEventListener('click', () => this.promptSwap());
        document.getElementById('divideBtn')?.addEventListener('click', () => this.promptDivide());

        // Changer de présentateur
        document.getElementById('changeHostBtn')?.addEventListener('click', () => this.promptChangeHost());

        // Arrêter la partie immédiatement
        document.getElementById('stopGameBtn')?.addEventListener('click', () => this.stopGame());

        // Paramètres
        document.getElementById('streamerModeToggle')?.addEventListener('change', (e) => {
            this.toggleStreamerMode(e.target.checked);
        });

        document.getElementById('chromaKeyToggle')?.addEventListener('change', (e) => {
            // Mettre à jour le state pour synchroniser avec les overlays
            // Le chroma key s'applique UNIQUEMENT aux overlays, pas au dashboard
            const roomCode = this.network.getCurrentRoomCode();
            const roomData = this.network.getRoomData(roomCode);
            if (!roomData) return; // Attendre que les données soient chargées
            
            const currentSettings = roomData.settings || {};
            
            this.network.updateRoomState({ 
                settings: { ...currentSettings, chromaKey: e.target.checked }
            });
        });

        document.getElementById('newGameBtn')?.addEventListener('click', () => {
            if (confirm('Relancer une nouvelle partie ?')) {
                this.game.startGame();
            }
        });

        document.getElementById('exitGameBtn')?.addEventListener('click', () => {
            this.network.leaveRoom();
            window.location.href = 'index.html';
        });

        // Clavier de lettres - Clic
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('letter-key') && !e.target.classList.contains('used') && !e.target.classList.contains('vowel') && !e.target.disabled) {
                this.selectedLetter = e.target.dataset.letter;
                document.querySelectorAll('.letter-key').forEach(btn => btn.classList.remove('selected'));
                e.target.classList.add('selected');
                // Afficher la lettre sélectionnée
                const selectedLetterValue = document.getElementById('selectedLetterValue');
                if (selectedLetterValue) {
                    selectedLetterValue.textContent = this.selectedLetter;
                }
            }
        });

        // Clavier de lettres - Touches clavier
        document.addEventListener('keydown', (e) => {
            const letter = e.key.toUpperCase();
            if (/^[A-Z]$/.test(letter)) {
                const letterBtn = document.querySelector(`.letter-key[data-letter="${letter}"]`);
                const isVowel = ['A','E','I','O','U','Y'].includes(letter);
                if (letterBtn && !letterBtn.classList.contains('used') && !isVowel && !letterBtn.disabled) {
                    this.selectedLetter = letter;
                    document.querySelectorAll('.letter-key').forEach(btn => btn.classList.remove('selected'));
                    letterBtn.classList.add('selected');
                    // Afficher la lettre sélectionnée
                    const selectedLetterValue = document.getElementById('selectedLetterValue');
                    if (selectedLetterValue) {
                        selectedLetterValue.textContent = this.selectedLetter;
                    }
                }
            }
        });
    }

    initPlayerDashboard() {
        // Initialiser le système de rotation pour l'overlay joueur
        this.wheelRotationPlayer = 0;
        this.lastWheelResultPlayer = null;
        
        // Créer la roue dans le dashboard joueur (vérifier que les segments sont chargés)
        const createWheelWhenReady = () => {
            if (this.wheel.segments && this.wheel.segments.length > 0) {
                this.wheel.createWheel('wheelElementPlayer');
            } else {
                // Réessayer après un court délai
                setTimeout(createWheelWhenReady, 100);
            }
        };
        createWheelWhenReady();
    }

    spinWheel() {
        console.log('[DEBUG] spinWheel - Début');
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData) {
            console.error('[DEBUG] spinWheel - roomData est null');
            alert('Chargement en cours, veuillez patienter...');
            return;
        }
        console.log('[DEBUG] spinWheel - roomData OK', roomData);

        // Vérifier que les segments sont chargés
        if (!this.wheel.segments || this.wheel.segments.length === 0) {
            console.error('[DEBUG] spinWheel - Segments pas chargés');
            alert('La roue est en cours de chargement, veuillez patienter...');
            return;
        }
        console.log('[DEBUG] spinWheel - Segments OK:', this.wheel.segments.length);

        // Désactiver le bouton pendant le tour
        const spinBtn = document.getElementById('spinWheelBtn');
        if (spinBtn) {
            console.log('[DEBUG] spinWheel - Désactivation du bouton');
            spinBtn.disabled = true;
        }

        // Choisir un segment aléatoire
        const randomIndex = Math.floor(Math.random() * this.wheel.segments.length);
        const selectedSegment = this.wheel.segments[randomIndex];
        console.log('[DEBUG] spinWheel - Segment sélectionné:', selectedSegment);

        // Mettre à jour le résultat dans roomData - cela déclenchera l'animation de TOUTES les roues
        // (dashboard gérant, dashboard joueurs, et overlay) via handleRoomUpdate()
        console.log('[DEBUG] spinWheel - Mise à jour wheelResult dans Firebase');
        this.network.updateRoomState({ wheelResult: selectedSegment.value });

        // Attendre la fin de l'animation (4 secondes) avant d'activer les boutons
        setTimeout(() => {
            console.log('[DEBUG] spinWheel - Fin de l\'animation, affichage du résultat');
            // Afficher le résultat dans l'UI du gérant
            this.ui.displayWheelResult(selectedSegment);
            
            if (spinBtn) spinBtn.disabled = false;

            // Activer les boutons appropriés
            if (selectedSegment.type === 'money') {
                document.getElementById('validateLetterBtn').disabled = false;
                document.getElementById('buyvowelBtn').disabled = false;
                document.getElementById('solvePuzzleBtn').disabled = false;
            } else {
                // Cas spécial
                this.handleSpecialCase(selectedSegment);
            }
        }, 4000);
    }

    validateLetter() {
        if (!this.selectedLetter) {
            alert('Veuillez sélectionner une lettre');
            return;
        }

        const result = this.game.proposeLetter(this.selectedLetter);
        
        if (result.success) {
            if (!result.keepPlaying) {
                document.getElementById('validateLetterBtn').disabled = true;
                document.getElementById('nextPlayerBtn').disabled = false;
            }
        } else {
            if (result.reason === 'already_used') {
                alert('Cette lettre a déjà été proposée');
            }
        }

        // Réinitialiser la sélection
        this.selectedLetter = null;
        const selectedLetterValue = document.getElementById('selectedLetterValue');
        if (selectedLetterValue) {
            selectedLetterValue.textContent = '-';
        }
        // Retirer la classe 'selected' de toutes les lettres
        document.querySelectorAll('.letter-key').forEach(btn => btn.classList.remove('selected'));
    }

    buyVowel() {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData) return;

        const isVowel = (ch) => ['A','E','I','O','U','Y'].includes((ch||'').toUpperCase());

        // Demander une voyelle explicitement
        const input = prompt('Acheter une voyelle (A, E, I, O, U, Y) pour 250€ :');
        if (!input) return;
        
        const vowel = input.toUpperCase();
        if (!isVowel(vowel)) {
            alert('Veuillez saisir une voyelle valide (A, E, I, O, U, Y).');
            return;
        }

        // Vérifier si la voyelle a déjà été utilisée
        if (roomData.usedLetters && roomData.usedLetters.includes(vowel)) {
            alert('Cette voyelle a déjà été proposée.');
            return;
        }

        const result = this.game.buyVowel(vowel);
        
        if (!result.success) {
            if (result.reason === 'not_enough_money') {
                alert('Pas assez d\'argent pour acheter une voyelle (250€ requis dans la cagnotte de la manche).');
            } else if (result.reason === 'already_used') {
                alert('Cette voyelle a déjà été proposée.');
            }
        } else if (result.count === 0) {
            alert(`La voyelle ${vowel} n'est pas dans le puzzle. Tour suivant !`);
        } else {
            alert(`La voyelle ${vowel} apparaît ${result.count} fois dans le puzzle !`);
        }

        this.selectedLetter = null;
    }

    solvePuzzle() {
        // Demander si le joueur actuel a donné la bonne réponse
        const success = confirm('Le joueur actuel a-t-il donné la bonne réponse ?');
        this.game.solvePuzzle(success);
    }

    handleSpecialCase(result) {
        switch (result.effect) {
            case 'lose_round_money':
                // Banqueroute automatique
                this.game.bankruptcy();
                this.ui.showMessage('gameStatus', 'BANQUEROUTE ! Le joueur perd sa cagnotte du tour.', 'error');
                setTimeout(() => this.game.nextPlayer(), 2000);
                break;
            case 'lose_turn':
                this.game.nextPlayer();
                this.ui.showMessage('gameStatus', 'PASSE TON TOUR ! On passe au joueur suivant.', 'warning');
                break;
            default:
                this.ui.showMessage('gameStatus', `Cas spécial : ${result.value}`, 'info');
        }
    }

    promptChangeHost() {
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomCode) {
            alert('Code de room non disponible.');
            return;
        }
        
        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) {
            alert('Chargement des données en cours, veuillez patienter...');
            return;
        }
        
        const players = roomData.players.filter(p => p.role === 'player');
        
        if (players.length === 0) {
            alert('Aucun joueur disponible pour devenir présentateur.');
            return;
        }
        
        const choice = prompt(`CHANGER DE PRÉSENTATEUR\nChoisissez un joueur (0-${players.length - 1}) :\n` +
            players.map((p, i) => `${i}: ${p.name}`).join('\n'));
        
        if (choice !== null && choice !== '') {
            const index = parseInt(choice);
            if (!isNaN(index) && index >= 0 && index < players.length) {
                const newHost = players[index];
                const currentHost = roomData.players.find(p => p.role === 'host');
                
                if (currentHost && newHost) {
                    // Échanger les rôles
                    currentHost.role = 'player';
                    newHost.role = 'host';
                    
                    this.network.updateRoomState({ players: roomData.players });
                    alert(`${newHost.name} est maintenant le présentateur !`);
                    
                    // Recharger la page pour appliquer le nouveau rôle
                    setTimeout(() => window.location.reload(), 1000);
                }
            } else {
                alert('Choix invalide.');
            }
        }
    }

    stopGame() {
        if (!confirm('Voulez-vous vraiment arrêter la partie immédiatement ? Tous les joueurs seront déconnectés et toutes les données seront effacées.')) {
            return;
        }

        const roomCode = this.network.getCurrentRoomCode();
        const roomData = this.network.getRoomData(roomCode);
        
        if (!roomCode || !roomData) return;

        // Déconnecter tous les joueurs et le host
        roomData.players.forEach(player => {
            player.connected = false;
            player.disconnectedAt = Date.now();
        });

        // Sauvegarder l'état avec tous les joueurs déconnectés
        this.network.updateRoomState({ players: roomData.players });

        // Attendre un instant pour que la mise à jour soit propagée
        setTimeout(async () => {
            // Supprimer complètement les données de la room de Firebase
            await this.network.db.ref(`rooms/${roomCode}`).remove();

            // Nettoyer les données de session
            sessionStorage.removeItem('currentRoomCode');
            sessionStorage.removeItem('currentPlayerData');

            alert('La partie a été arrêtée, tous les joueurs ont été déconnectés et toutes les données ont été effacées. Redirection vers l\'accueil...');
            window.location.href = 'index.html';
        }, 500);
    }

    promptHoldUp() {
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomCode) {
            alert('Code de room non disponible.');
            return;
        }
        
        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) {
            alert('Chargement des données en cours, veuillez patienter...');
            return;
        }
        
        const players = roomData.players.filter(p => p.role === 'player');
        
        const choice = prompt(`HOLD UP ! Choisissez un joueur (0-${players.length - 1}) :\n` +
            players.map((p, i) => `${i}: ${p.name}`).join('\n'));
        
        if (choice !== null) {
            this.game.holdUp(parseInt(choice));
        }
    }

    promptSwap() {
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomCode) {
            alert('Code de room non disponible.');
            return;
        }
        
        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) {
            alert('Chargement des données en cours, veuillez patienter...');
            return;
        }
        
        const players = roomData.players.filter(p => p.role === 'player');
        
        const choice = prompt(`ÉCHANGE ! Choisissez un joueur (0-${players.length - 1}) :\n` +
            players.map((p, i) => `${i}: ${p.name}`).join('\n'));
        
        if (choice !== null) {
            this.game.swapMoney(parseInt(choice));
        }
    }

    promptDivide() {
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomCode) {
            alert('Code de room non disponible.');
            return;
        }
        
        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) {
            alert('Chargement des données en cours, veuillez patienter...');
            return;
        }
        
        const players = roomData.players.filter(p => p.role === 'player');
        
        const choice = prompt(`DIVISEUR ! Choisissez un joueur (0-${players.length - 1}) :\n` +
            players.map((p, i) => `${i}: ${p.name}`).join('\n'));
        
        if (choice !== null) {
            this.game.divideOpponent(parseInt(choice));
        }
    }

    toggleStreamerMode(enabled) {
        console.log('[DEBUG] toggleStreamerMode - Début, enabled:', enabled);
        const roomCode = this.network.getCurrentRoomCode();
        const roomData = this.network.getRoomData(roomCode);
        if (!roomData) {
            console.warn('[DEBUG] toggleStreamerMode - roomData null, réessai dans 100ms');
            // Réessayer après un court délai
            setTimeout(() => this.toggleStreamerMode(enabled), 100);
            return;
        }
        console.log('[DEBUG] toggleStreamerMode - roomData OK');
        
        // S'assurer que settings existe
        const currentSettings = roomData.settings || {};
        console.log('[DEBUG] toggleStreamerMode - currentSettings:', currentSettings);
        
        this.network.updateRoomState({
            settings: { ...currentSettings, streamerMode: enabled }
        });
        console.log('[DEBUG] toggleStreamerMode - État mis à jour dans Firebase');

        if (enabled) {
            const baseUrl = window.location.origin + window.location.pathname.replace('dashboard.html', '');
            console.log('[DEBUG] toggleStreamerMode - Affichage des URLs, baseUrl:', baseUrl);
            document.getElementById('gameOverlayUrl').textContent = baseUrl + 'game-overlay.html?room=' + encodeURIComponent(roomCode);
            document.getElementById('wheelOverlayUrl').textContent = baseUrl + 'wheel-overlay.html?room=' + encodeURIComponent(roomCode);
            document.getElementById('puzzleOverlayUrl').textContent = baseUrl + 'puzzle-overlay.html?room=' + encodeURIComponent(roomCode);
            document.getElementById('playersOverlayUrl').textContent = baseUrl + 'players-overlay.html?room=' + encodeURIComponent(roomCode);
            this.ui.show('overlayLinks');
        } else {
            this.ui.hide('overlayLinks');
        }
    }

    sendChat() {
        const input = document.getElementById('chatInput');
        if (!input || !input.value.trim()) return;

        this.network.sendChatMessage(input.value.trim());
        input.value = '';
    }

    updateDashboard(roomData) {
        console.log('[DEBUG] updateDashboard - Début', roomData);
        const isHost = this.network.isHost();
        console.log('[DEBUG] updateDashboard - isHost:', isHost);
        
        // Détecter changement de manche pour réinitialiser le résultat de la roue
        if (!this.currentDashboardRound || this.currentDashboardRound !== roomData.currentRound) {
            console.log('[DEBUG] updateDashboard - Changement de manche:', this.currentDashboardRound, '->', roomData.currentRound);
            this.currentDashboardRound = roomData.currentRound;
            // Réinitialiser l'affichage du résultat de la roue
            const wheelValue = document.getElementById('wheelValue');
            if (wheelValue) {
                wheelValue.textContent = '-';
            }
            const playerWheelValue = document.getElementById('playerWheelValue');
            if (playerWheelValue) {
                playerWheelValue.textContent = '-';
            }
            
            // Réinitialiser lastWheelResult pour permettre une nouvelle détection
            this.lastWheelResult = null;
            console.log('[DEBUG] updateDashboard - lastWheelResult réinitialisé');
            
            // Recréer les roues avec les nouveaux segments mélangés
            if (isHost) {
                console.log('[DEBUG] updateDashboard - Recréation de la roue host');
                this.wheelRotation = 0;
                const wheelElement = document.getElementById('wheelElement');
                if (wheelElement) {
                    wheelElement.style.transition = 'none';
                    wheelElement.style.transform = 'rotate(0deg)';
                    wheelElement.offsetHeight;
                    this.wheel.createWheel('wheelElement');
                }
            } else {
                this.wheelRotationPlayer = 0;
                const wheelElementPlayer = document.getElementById('wheelElementPlayer');
                if (wheelElementPlayer) {
                    wheelElementPlayer.style.transition = 'none';
                    wheelElementPlayer.style.transform = 'rotate(0deg)';
                    wheelElementPlayer.offsetHeight;
                    this.wheel.createWheel('wheelElementPlayer');
                }
            }
        }
        
        // Animer la roue si le résultat change (même logique que l'overlay)
        if (roomData.wheelResult && roomData.wheelResult !== this.lastWheelResult) {
            console.log('[DEBUG] updateDashboard - Nouveau wheelResult détecté:', roomData.wheelResult, '(ancien:', this.lastWheelResult, ')');
            this.lastWheelResult = roomData.wheelResult;
            
            const targetSegment = this.wheel.segments.find(seg => seg.value === roomData.wheelResult);
            if (targetSegment) {
                const segmentIndex = this.wheel.segments.indexOf(targetSegment);
                console.log('[DEBUG] updateDashboard - Segment trouvé à l\'index:', segmentIndex);
                
                if (isHost) {
                    console.log('[DEBUG] updateDashboard - Animation roue host');
                    this.animateDashboardWheel('wheelElement', 'wheelResult', segmentIndex, roomData.wheelResult, 'wheelRotation');
                } else {
                    console.log('[DEBUG] updateDashboard - Animation roue joueur');
                    this.animateDashboardWheel('wheelElementPlayer', 'wheelResultPlayer', segmentIndex, roomData.wheelResult, 'wheelRotationPlayer');
                }
            } else {
                console.error('[DEBUG] updateDashboard - Segment non trouvé pour:', roomData.wheelResult);
            }
        }
        
        // Mise à jour de la manche
        const roundElement = document.getElementById('currentRound');
        if (roundElement) {
            roundElement.textContent = roomData.currentRound || 1;
        }

        // Joueur actuel
        const players = roomData.players.filter(p => p.role === 'player');
        const currentPlayer = players[roomData.currentPlayerIndex];
        const playerNameElement = document.getElementById('currentPlayerName');
        if (playerNameElement && currentPlayer) {
            playerNameElement.textContent = currentPlayer.name;
        }

        // Joueurs
        this.ui.updateDashboardPlayers(roomData);

        // Puzzle
        if (roomData.puzzle) {
            this.ui.createPuzzleGrid(roomData);
        }

        // Clavier
        this.ui.createLetterKeyboard(roomData);

        // Synchroniser les toggles avec l'état actuel (uniquement pour le host)
        if (isHost && roomData.settings) {
            const streamerToggle = document.getElementById('streamerModeToggle');
            if (streamerToggle) {
                streamerToggle.checked = roomData.settings.streamerMode || false;
                // Activer le toggle maintenant que les données sont disponibles
                streamerToggle.disabled = false;
                
                // Afficher/masquer les overlay links
                if (roomData.settings.streamerMode) {
                    const roomCode = this.network.getCurrentRoomCode();
                    const baseUrl = window.location.origin + window.location.pathname.replace('dashboard.html', '');
                    document.getElementById('gameOverlayUrl').textContent = baseUrl + 'game-overlay.html?room=' + encodeURIComponent(roomCode);
                    document.getElementById('wheelOverlayUrl').textContent = baseUrl + 'wheel-overlay.html?room=' + encodeURIComponent(roomCode);
                    document.getElementById('puzzleOverlayUrl').textContent = baseUrl + 'puzzle-overlay.html?room=' + encodeURIComponent(roomCode);
                    document.getElementById('playersOverlayUrl').textContent = baseUrl + 'players-overlay.html?room=' + encodeURIComponent(roomCode);
                    this.ui.show('overlayLinks');
                } else {
                    this.ui.hide('overlayLinks');
                }
            }
            
            const chromaToggle = document.getElementById('chromaKeyToggle');
            if (chromaToggle) {
                chromaToggle.checked = roomData.settings.chromaKey || false;
                // Activer le toggle maintenant que les données sont disponibles
                chromaToggle.disabled = false;
            }
        }

        // Vue joueur - mise à jour des sections spécifiques
        if (!isHost) {
            this.updatePlayerView(roomData);
        }

        // Chat (uniquement pour le host)
        if (isHost) {
            this.ui.updateChat(roomData);
        }
    }

    updatePlayerView(roomData) {
        // Mise à jour de la catégorie du puzzle
        const categoryElement = document.getElementById('playerPuzzleCategory');
        if (categoryElement && roomData.puzzle) {
            categoryElement.textContent = roomData.puzzle.category || 'CATÉGORIE';
        }


        // Mise à jour du puzzle dans la vue joueur
        const playerPuzzleGrid = document.getElementById('playerPuzzleGrid');
        if (playerPuzzleGrid && roomData.puzzle) {
            playerPuzzleGrid.innerHTML = '';
            const puzzleGrid = document.getElementById('puzzleGrid');
            if (puzzleGrid) {
                playerPuzzleGrid.innerHTML = puzzleGrid.innerHTML;
            }
        }

        // Mise à jour du résultat de la roue
        if (!this.lastPlayerRound || this.lastPlayerRound !== roomData.currentRound) {
            // Nouvelle manche : réinitialiser l'affichage
            this.lastPlayerRound = roomData.currentRound;
            const wheelValueElement = document.getElementById('playerWheelValue');
            if (wheelValueElement) {
                wheelValueElement.textContent = '-';
            }
        } else if (roomData.wheelResult) {
            // Afficher le résultat après la fin de l'animation de la roue (4s)
            if (this.lastPlayerWheelResult !== roomData.wheelResult) {
                this.lastPlayerWheelResult = roomData.wheelResult;
                // Réinitialiser affichage immédiatement
                const wheelValueElement = document.getElementById('playerWheelValue');
                if (wheelValueElement) wheelValueElement.textContent = '-';

                if (this.playerWheelTimer) clearTimeout(this.playerWheelTimer);
                this.playerWheelTimer = setTimeout(() => {
                    const el = document.getElementById('playerWheelValue');
                    if (el) {
                        el.textContent = roomData.wheelResult + (this.isMoneyValue(roomData.wheelResult) ? '€' : '');
                    }
                }, 4000);
            }
        }

        // Mise à jour des scores des joueurs
        const playerScoresContainer = document.getElementById('playerScoresDisplay');
        if (playerScoresContainer) {
            const players = roomData.players.filter(p => p.role === 'player');
            playerScoresContainer.innerHTML = '';
            
            players.forEach((player, index) => {
                const isActive = index === roomData.currentPlayerIndex;
                const scoreCard = document.createElement('div');
                scoreCard.className = `player-score-card ${isActive ? 'active' : ''}`;
                scoreCard.innerHTML = `
                    <div class="player-score-name">${player.name}</div>
                    <div class="player-score-money">${player.score || 0}€</div>
                `;
                playerScoresContainer.appendChild(scoreCard);
            });
        }

        // Notification de tour pour le joueur actif
        const currentPlayer = this.network.getCurrentPlayer();
        const turnNotification = document.getElementById('playerTurnNotification');
        if (turnNotification && currentPlayer && currentPlayer.role === 'player') {
            const players = roomData.players.filter(p => p.role === 'player');
            const currentPlayerIndex = players.findIndex(p => p.id === currentPlayer.id);
            
            if (currentPlayerIndex === roomData.currentPlayerIndex) {
                // C'est le tour de ce joueur
                turnNotification.classList.remove('hidden');
            } else {
                // Ce n'est pas le tour de ce joueur
                turnNotification.classList.add('hidden');
            }
        }
    }

    // Helper pour vérifier si une valeur est un montant d'argent
    isMoneyValue(value) {
        return !isNaN(parseInt(value));
    }

    // ==============================
    // WHEEL OVERLAY
    // ==============================
    initWheelOverlay() {
        this.wheelRotation = 0; // Tracker la rotation actuelle de la roue
        
        // Créer la roue quand les segments sont prêts
        const createWheelWhenReady = () => {
            if (this.wheel.segments && this.wheel.segments.length > 0) {
                this.wheel.createWheel('wheelElement');
            } else {
                setTimeout(createWheelWhenReady, 100);
            }
        };
        createWheelWhenReady();

        // Récupérer le code de room depuis l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        
        if (roomCode) {
            this.network.roomCode = roomCode;
            
            // Initialiser lastWheelResult avec la valeur actuelle pour éviter l'animation au chargement
            const roomData = this.network.getRoomData(roomCode);
            this.lastWheelResult = roomData?.wheelResult || null;
            this.lastRound = roomData?.currentRound || 1;
        } else {
            this.lastWheelResult = null;
            this.lastRound = 1;
        }
    }

    updateWheelOverlay(roomData) {
        // Si roomData est null, la room a été supprimée
        if (!roomData) {
            document.body.innerHTML = '';
            document.body.style.background = 'white';
            return;
        }
        
        // Vérifier si la manche a changé pour recréer la roue avec les nouveaux segments
        if (roomData.currentRound !== this.lastRound) {
            this.lastRound = roomData.currentRound;
            this.wheelRotation = 0; // Réinitialiser la rotation pour la nouvelle manche
            
            const wheelElement = document.getElementById('wheelElement');
            if (wheelElement) {
                wheelElement.style.transition = 'none';
                wheelElement.style.transform = 'rotate(0deg)';
                // Force reflow pour appliquer immédiatement
                wheelElement.offsetHeight;
            }
            
            this.wheel.createWheel('wheelElement'); // Recréer la roue avec les segments mélangés
        }
        
        // Détecter si le résultat de la roue a changé
        if (roomData.wheelResult && roomData.wheelResult !== this.lastWheelResult) {
            this.lastWheelResult = roomData.wheelResult;
            
            // Trouver le segment correspondant au résultat
            const targetSegment = this.wheel.segments.find(seg => seg.value === roomData.wheelResult);
            if (targetSegment) {
                const segmentIndex = this.wheel.segments.indexOf(targetSegment);
                
                // Lancer l'animation de la roue vers ce segment
                this.animateWheelToSegment(segmentIndex, roomData.wheelResult);
            }
        }
    }

    animateWheelToSegment(segmentIndex, resultValue) {
        const wheelElement = document.getElementById('wheelElement');
        const resultElement = document.getElementById('wheelResult');
        
        if (!wheelElement) return;

        // Calculer l'angle de rotation pour atteindre le segment
        const segmentAngle = 360 / this.wheel.segments.length;
        const targetAngle = segmentIndex * segmentAngle;
        
        // Nombre minimum de tours complets (au moins 5 tours)
        const minSpins = 5;
        
        // Calculer la rotation totale en tournant toujours dans le sens horaire
        const additionalRotation = (360 * minSpins) + targetAngle;
        this.wheelRotation += additionalRotation;

        // Appliquer la rotation avec animation (toujours dans le sens horaire, positif)
        wheelElement.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheelElement.style.transform = `rotate(${this.wheelRotation}deg)`;

        // Afficher le résultat après l'animation avec effet pop
        setTimeout(() => {
            if (resultElement) {
                resultElement.textContent = resultValue;
                resultElement.classList.remove('hidden');
                resultElement.style.animation = 'resultPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                
                // Masquer le résultat après 3 secondes
                setTimeout(() => {
                    resultElement.style.animation = '';
                    resultElement.classList.add('hidden');
                }, 3000);
            }
        }, 4000);
    }

    animateDashboardWheel(wheelElementId, resultElementId, segmentIndex, resultValue, rotationProperty) {
        console.log('[DEBUG] animateDashboardWheel - Début:', wheelElementId, 'segment:', segmentIndex, 'valeur:', resultValue);
        const wheelElement = document.getElementById(wheelElementId);
        const resultElement = document.getElementById(resultElementId);
        
        if (!wheelElement) {
            console.error('[DEBUG] animateDashboardWheel - wheelElement introuvable:', wheelElementId);
            return;
        }
        console.log('[DEBUG] animateDashboardWheel - wheelElement trouvé');

        // Calculer l'angle de rotation pour atteindre le segment
        const segmentAngle = 360 / this.wheel.segments.length;
        const targetAngle = segmentIndex * segmentAngle;
        console.log('[DEBUG] animateDashboardWheel - segmentAngle:', segmentAngle, 'targetAngle:', targetAngle);
        
        // Nombre minimum de tours complets (au moins 5 tours)
        const minSpins = 5;
        
        // Calculer la rotation totale en tournant toujours dans le sens horaire
        const additionalRotation = (360 * minSpins) + targetAngle;
        this[rotationProperty] += additionalRotation;
        console.log('[DEBUG] animateDashboardWheel - Rotation totale:', this[rotationProperty]);

        // Appliquer la rotation avec animation
        wheelElement.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheelElement.style.transform = `rotate(${this[rotationProperty]}deg)`;
        console.log('[DEBUG] animateDashboardWheel - Animation appliquée');

        // Afficher le résultat après l'animation avec effet pop
        setTimeout(() => {
            console.log('[DEBUG] animateDashboardWheel - Affichage du résultat après 4s');
            if (resultElement) {
                resultElement.textContent = resultValue;
                resultElement.classList.remove('hidden');
                resultElement.style.animation = 'resultPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
                
                // Masquer le résultat après 3 secondes
                setTimeout(() => {
                    resultElement.style.animation = '';
                    resultElement.classList.add('hidden');
                }, 3000);
            }
        }, 4000);
    }

    // ==============================
    // PUZZLE OVERLAY
    // ==============================
    initPuzzleOverlay() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        
        if (roomCode) {
            this.network.roomCode = roomCode;
        }
    }

    // ==============================
    // PLAYERS OVERLAY
    // ==============================
    initPlayersOverlay() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        
        if (roomCode) {
            this.network.roomCode = roomCode;
        }
    }

    // ==============================
    // GAME OVERLAY (COMPLET)
    // ==============================
    initGameOverlay() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomCode = urlParams.get('room');
        
        if (roomCode) {
            this.network.roomCode = roomCode;
        }
        
        // Initialiser la roue
        this.wheelRotation = 0;
        this.lastWheelResult = null;
        this.lastRound = 1;
        
        const createWheelWhenReady = () => {
            if (this.wheel.segments && this.wheel.segments.length > 0) {
                this.wheel.createWheel('wheelElement');
            } else {
                setTimeout(createWheelWhenReady, 100);
            }
        };
        createWheelWhenReady();
    }

    updateGameOverlay(roomData) {
        if (!roomData) {
            document.body.innerHTML = '';
            document.body.style.background = 'white';
            return;
        }
        
        // Manche
        const roundElement = document.getElementById('currentRound');
        if (roundElement) {
            roundElement.textContent = roomData.currentRound || 1;
        }
        
        // Joueur actuel
        const players = roomData.players.filter(p => p.role === 'player');
        const currentPlayer = players[roomData.currentPlayerIndex];
        const playerNameElement = document.getElementById('currentPlayerName');
        if (playerNameElement && currentPlayer) {
            playerNameElement.textContent = currentPlayer.name;
        }
        
        // Puzzle
        this.ui.createPuzzleGrid(roomData);
        
        // Joueurs
        const playersContainer = document.getElementById('playersContainer');
        if (playersContainer && players.length > 0) {
            playersContainer.innerHTML = '';
            players.forEach((player, index) => {
                const playerCard = document.createElement('div');
                playerCard.className = `player-card player-${index + 1}`;
                if (roomData.currentPlayerIndex === index) {
                    playerCard.classList.add('active');
                }
                
                playerCard.innerHTML = `
                    <div class="player-name">${player.name}</div>
                    <div class="player-round-money">${player.roundMoney}€</div>
                    <div class="player-total-money">Total: ${player.totalMoney}€</div>
                `;
                
                playersContainer.appendChild(playerCard);
            });
        }
        
        // Animation de la roue
        if (roomData.currentRound !== this.lastRound) {
            this.lastRound = roomData.currentRound;
            this.wheelRotation = 0;
            
            const wheelElement = document.getElementById('wheelElement');
            if (wheelElement) {
                wheelElement.style.transition = 'none';
                wheelElement.style.transform = 'rotate(0deg)';
                wheelElement.offsetHeight;
            }
            
            this.wheel.createWheel('wheelElement');
        }
        
        if (roomData.wheelResult && roomData.wheelResult !== this.lastWheelResult) {
            this.lastWheelResult = roomData.wheelResult;
            
            const targetSegment = this.wheel.segments.find(seg => seg.value === roomData.wheelResult);
            if (targetSegment) {
                const segmentIndex = this.wheel.segments.indexOf(targetSegment);
                this.animateWheelToSegment(segmentIndex, roomData.wheelResult);
            }
        }
    }

    // ==============================
    // GESTION DES MISES À JOUR
    // ==============================
    handleRoomUpdate(roomData) {
        console.log('[DEBUG] handleRoomUpdate - Début', roomData ? 'roomData OK' : 'roomData NULL');
        // Vérifier si la room existe toujours
        const roomCode = this.network.getCurrentRoomCode();
        if (!roomData && roomCode) {
            console.warn('[DEBUG] handleRoomUpdate - Room supprimée, redirection');
            // La room a été supprimée - expulser le joueur
            alert('La partie a été arrêtée par le présentateur.');
            sessionStorage.removeItem('currentRoomCode');
            sessionStorage.removeItem('currentPlayerData');
            window.location.href = 'index.html';
            return;
        }
        
        if (!roomData) return;
        
        // Vérifier si le joueur a été exclu (le serveur local supprime le joueur de la room)
        const currentPlayer = this.network.getCurrentPlayer();
        if (currentPlayer) {
            const stillInRoom = roomData.players.some(p => p.id === currentPlayer.id);
            if (!stillInRoom) {
                // Forcer le rafraîchissement (équivalent à appuyer sur F5)
                this.ui.showMessage('errorMessage', 'Vous avez été exclu de la partie. La page va maintenant se recharger.', 'error');
                // Petit délai pour laisser le message s'afficher
                setTimeout(() => window.location.reload(), 800);
                return;
            }
        }

        // Rediriger automatiquement vers le dashboard quand la partie démarre
        if (this.currentPage === 'index' && roomData.state === 'playing' && currentPlayer) {
            const roomCode = this.network.getCurrentRoomCode();
            if (roomCode && currentPlayer) {
                sessionStorage.setItem('currentRoomCode', roomCode);
                sessionStorage.setItem('currentPlayerData', JSON.stringify(currentPlayer));
                window.location.href = 'dashboard.html?room=' + encodeURIComponent(roomCode);
                return;
            }
        }

        // Afficher les notifications système pour les joueurs sur le dashboard
        if (this.currentPage === 'dashboard' && currentPlayer && currentPlayer.role === 'player') {
            this.checkSystemNotifications(roomData);
        }

        switch (this.currentPage) {
            case 'index':
                console.log('[DEBUG] handleRoomUpdate - Mise à jour page index');
                this.updateLobby(roomData);
                break;
            case 'dashboard':
                console.log('[DEBUG] handleRoomUpdate - Mise à jour dashboard');
                this.updateDashboard(roomData);
                break;
            case 'wheel':
                console.log('[DEBUG] handleRoomUpdate - Mise à jour wheel overlay');
                this.updateWheelOverlay(roomData);
                break;
            case 'puzzle':
                console.log('[DEBUG] handleRoomUpdate - Mise à jour puzzle overlay');
                this.ui.createPuzzleGrid(roomData);
                // Si roomData est null, la room a été supprimée
                if (!roomData) {
                    document.body.innerHTML = '';
                    document.body.style.background = 'white';
                }
                break;
            case 'players':
                this.ui.updatePlayersOverlay(roomData);
                // Si roomData est null, la room a été supprimée
                if (!roomData) {
                    document.body.innerHTML = '';
                    document.body.style.background = 'white';
                }
                break;
            case 'game-overlay':
                this.updateGameOverlay(roomData);
                break;
        }

        // Chroma key - appliquer UNIQUEMENT aux overlays (pas au dashboard)
        // Les overlays (wheel, puzzle, players, game-overlay) ont le fond magenta quand activé
        if (roomData.settings && (this.currentPage === 'wheel' || this.currentPage === 'puzzle' || this.currentPage === 'players' || this.currentPage === 'game-overlay')) {
            this.ui.toggleChromaKey(roomData.settings.chromaKey || false);
        }
    }

    checkSystemNotifications(roomData) {
        if (!roomData.chatMessages || roomData.chatMessages.length === 0) return;

        // Récupérer le dernier message système non affiché
        const lastMessage = roomData.chatMessages[roomData.chatMessages.length - 1];
        
        if (lastMessage.isSystemMessage && lastMessage.timestamp !== this.lastSystemMessageTimestamp) {
            this.lastSystemMessageTimestamp = lastMessage.timestamp;
            
            // Afficher une notification visuelle temporaire
            const gameStatus = document.getElementById('gameStatus');
            if (gameStatus) {
                gameStatus.textContent = lastMessage.message;
                gameStatus.className = 'game-status';
                
                // Déterminer le style selon le type de message
                if (lastMessage.message.includes('déconnecté')) {
                    gameStatus.classList.add('paused');
                } else if (lastMessage.message.includes('reconnecté')) {
                    gameStatus.classList.add('playing');
                }
                
                // Masquer après 5 secondes
                setTimeout(() => {
                    gameStatus.textContent = '';
                    gameStatus.className = 'game-status';
                }, 5000);
            }
        }
    }

    handleReconnectionUI(roomData) {
        const reconnectModal = document.getElementById('reconnectModal');
        if (!reconnectModal) return;

        const currentPlayer = this.network.getCurrentPlayer();
        if (!currentPlayer) return;

        if (!currentPlayer.connected) {
            reconnectModal.classList.remove('hidden');

            const timerDisplay = document.getElementById('reconnectTimer');
            const progressFill = document.getElementById('reconnectProgress');
            let remaining = this.network.getDisconnectTimeRemaining(currentPlayer);

            if (timerDisplay && progressFill) {
                timerDisplay.textContent = remaining;
                progressFill.style.width = `${(remaining / 120) * 100}%`;

                if (this.reconnectTimer) clearInterval(this.reconnectTimer);
                this.reconnectTimer = setInterval(() => {
                    remaining--;
                    if (remaining <= 0) {
                        clearInterval(this.reconnectTimer);
                        reconnectModal.classList.add('hidden');
                    } else {
                        timerDisplay.textContent = remaining;
                        progressFill.style.width = `${(remaining / 120) * 100}%`;
                    }
                }, 1000);
            }

            const reconnectBtn = document.getElementById('reconnectBtn');
            if (reconnectBtn) {
                reconnectBtn.onclick = () => {
                    window.location.reload();
                };
            }
        } else {
            reconnectModal.classList.add('hidden');
            if (this.reconnectTimer) clearInterval(this.reconnectTimer);
        }
    }

    handlePauseUI(roomData) {
        const pauseModal = document.getElementById('pauseModal');
        const gameStatus = document.getElementById('gameStatus');

        if (roomData.paused && roomData.pauseReason === 'host_disconnected') {
            pauseModal.classList.remove('hidden');

            let remaining = 120 - Math.floor((Date.now() - roomData.pausedAt) / 1000);
            if (remaining < 0) remaining = 0;

            const pauseTimer = document.getElementById('pauseTimer');
            const pauseProgress = document.getElementById('pauseProgress');

            const updateTimer = () => {
                if (pauseTimer && pauseProgress) {
                    pauseTimer.textContent = remaining;
                    pauseProgress.style.width = `${(remaining / 120) * 100}%`;
                    if (remaining > 0) {
                        remaining--;
                    }
                }
            };

            updateTimer();

            if (this.pauseTimer) clearInterval(this.pauseTimer);
            this.pauseTimer = setInterval(() => {
                updateTimer();
            }, 1000);

            if (gameStatus) {
                gameStatus.textContent = 'PARTIE EN PAUSE - Présentateur déconnecté';
                gameStatus.classList.add('paused');
                gameStatus.classList.remove('playing');
            }
        } else {
            pauseModal.classList.add('hidden');
            if (this.pauseTimer) clearInterval(this.pauseTimer);

            if (gameStatus) {
                gameStatus.textContent = 'PARTIE EN COURS';
                gameStatus.classList.remove('paused');
                gameStatus.classList.add('playing');
            }
        }
    }
}

// Initialiser l'application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RoueDeLaFortune();
});
