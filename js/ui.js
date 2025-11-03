// ====================================
// UI.JS - Gestion de l'interface utilisateur
// ====================================

export class UIManager {
    constructor(networkManager) {
        this.network = networkManager;
    }

    // Afficher/Cacher des éléments
    show(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.classList.remove('hidden');
    }

    hide(elementId) {
        const element = document.getElementById(elementId);
        if (element) element.classList.add('hidden');
    }

    // Afficher un message temporaire
    showMessage(elementId, message, type = 'info') {
        const element = document.getElementById(elementId);
        if (!element) return;

        element.textContent = message;
        element.className = `message ${type}`;
        element.classList.remove('hidden');

        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    }

    // Mettre à jour la liste des joueurs dans le lobby (avec bouton exclure si host)
    updatePlayersList(roomData, currentPlayerId, isHost) {
        const playersList = document.getElementById('playersList');
        if (!playersList) return;

        playersList.innerHTML = '';

        roomData.players.forEach(player => {
            const li = document.createElement('li');
            li.className = 'player-item';
            if (!player.connected) {
                li.classList.add('disconnected');
            }
            if (player.role === 'host') {
                li.classList.add('host');
            }
            if (player.id === currentPlayerId) {
                li.classList.add('active');
            }

            li.innerHTML = `
                <span>
                    <strong>${player.name}</strong>
                    ${player.role === 'host' ? '👨‍💼 Présentateur' : '🎮 Joueur'} ${!player.connected ? '<span class="player-status">(Déconnecté)</span>' : ''}
                </span>
            `;

            if (isHost && player.id !== currentPlayerId) {
                // Ajouter bouton exclure
                const kickBtn = document.createElement('button');
                kickBtn.className = 'kick-btn';
                kickBtn.textContent = 'Exclure';
                kickBtn.addEventListener('click', () => this.handleKick(player.id));
                li.appendChild(kickBtn);
            }

            playersList.appendChild(li);
        });

    }

    // Confirmation avant exclusion du joueur
    handleKick(playerId) {
        if (confirm('Voulez-vous vraiment exclure ce joueur ?')) {
            if (this.network.kickPlayer(playerId)) {
                // afficher succès via UI
                this.showMessage('errorMessage', 'Joueur exclu.', 'success');
            } else {
                // afficher erreur via UI
                this.showMessage('errorMessage', 'Erreur lors de l\'exclusion.', 'error');
            }
        }
    }

    // Mettre à jour les joueurs dans le dashboard
    updateDashboardPlayers(roomData) {
        const container = document.getElementById('dashboardPlayers');
        if (!container) return;

        container.innerHTML = '';

        const players = roomData.players.filter(p => p.role === 'player');

        players.forEach((player, index) => {
            const isActive = index === roomData.currentPlayerIndex;
            const isDisconnected = !player.connected;

            const div = document.createElement('div');
            div.className = `dashboard-player player-${index + 1}`;
            if (isActive) div.classList.add('active');
            if (isDisconnected) div.classList.add('disconnected');

            div.innerHTML = `
                <div class="player-name">${player.name}</div>
                <div class="player-money">
                    <div class="round-money">${player.roundMoney}€</div>
                    <div class="money-label">Tour</div>
                </div>
                <div class="player-money">
                    <div class="total-money">${player.totalMoney}€</div>
                    <div class="money-label">Total</div>
                </div>
                ${!isDisconnected && !player.isHost ? '' : '<div class="player-status">Déconnecté</div>'}
            `;

            // Ajouter bouton exclure dans dashboard seulement pour le gérant (sera géré dans app.js)
            container.appendChild(div);
        });
    }

    // Créer le clavier de lettres
    createLetterKeyboard(roomData) {
        const container = document.getElementById('letterKeyboard');
        if (!container) return;

        // Lettres en ordre alphabétique
        const allLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
        const vowels = ['A', 'E', 'I', 'O', 'U', 'Y'];

        if (container.dataset.initialized === '1' && container.children.length === allLetters.length) {
            // Mettre à jour l'état sans recréer les boutons pour éviter de relancer les animations
            allLetters.forEach(letter => {
                const btn = container.querySelector(`.letter-key[data-letter="${letter}"]`);
                if (!btn) return;
                const isVowel = vowels.includes(letter);
                // Voyelles toujours désactivées visuellement
                if (isVowel) {
                    btn.classList.add('vowel');
                    btn.disabled = true;
                    btn.setAttribute('aria-disabled', 'true');
                }
                // Consonnes: désactiver si déjà utilisées
                if (roomData.usedLetters && roomData.usedLetters.includes(letter)) {
                    if (!btn.classList.contains('used')) {
                        // Ajouter la classe 'used' une seule fois (déclenche l'animation une fois)
                        btn.classList.add('used');
                    }
                    btn.disabled = true;
                } else if (!isVowel) {
                    btn.classList.remove('used');
                    btn.disabled = false;
                }
            });
        } else {
            // Construire une seule fois
            container.innerHTML = '';
            allLetters.forEach(letter => {
                const btn = document.createElement('button');
                btn.className = 'letter-key';
                btn.textContent = letter;
                btn.dataset.letter = letter;

                if (vowels.includes(letter)) {
                    btn.classList.add('vowel');
                    // Par défaut, les voyelles ne sont pas cliquables (achat via bouton dédié)
                    btn.disabled = true;
                    btn.setAttribute('aria-disabled', 'true');
                } else {
                    btn.classList.add('consonant');
                }

                if (roomData.usedLetters && roomData.usedLetters.includes(letter)) {
                    btn.classList.add('used');
                    btn.disabled = true;
                }

                container.appendChild(btn);
            });
            container.dataset.initialized = '1';
        }
    }

    // Créer la grille de puzzle
    createPuzzleGrid(roomData) {
        const container = document.getElementById('puzzleGrid');
        const categoryElement = document.getElementById('puzzleCategory');
        
        if (!container || !roomData.puzzle) return;

        if (categoryElement) {
            categoryElement.textContent = roomData.puzzle.category;
        }

    // Sauvegarder les lettres précédemment révélées (par valeur)
    const previouslyRevealed = this.lastRevealedLetters || [];
    this.lastRevealedLetters = roomData.revealedLetters || [];

        container.innerHTML = '';

        let letterIndex = 0;
        roomData.puzzle.words.forEach((word, wordIndex) => {
            const wordDiv = document.createElement('div');
            wordDiv.className = 'puzzle-word';

            for (let letter of word) {
                const letterDiv = document.createElement('div');
                letterDiv.className = 'puzzle-letter';

                if (letter === ' ') {
                    letterDiv.classList.add('space');
                } else {
                    const isRevealed = roomData.revealedLetters && roomData.revealedLetters.includes(letter);
                    
                    if (isRevealed) {
                        letterDiv.classList.add('revealed');
                        letterDiv.textContent = letter;
                        
                        // Animer seulement les nouvelles lettres révélées (pas celles déjà affichées)
                        if (!previouslyRevealed.includes(letter)) {
                            letterDiv.classList.add('just-revealed');
                            letterDiv.style.animationDelay = `${letterIndex * 0.1}s`;
                            letterIndex++;
                        } else {
                            // Désactiver toute animation pour les lettres déjà révélées
                            letterDiv.style.animation = 'none';
                        }
                    } else {
                        letterDiv.classList.add('hidden');
                    }
                }

                wordDiv.appendChild(letterDiv);
            }

            container.appendChild(wordDiv);
        });
    }

    // Mettre à jour l'overlay des joueurs
    updatePlayersOverlay(roomData) {
        const container = document.getElementById('playersOverlay');
        if (!container) return;

        container.innerHTML = '';

        const players = roomData.players.filter(p => p.role === 'player');
        
        players.forEach((player, index) => {
            const isActive = index === roomData.currentPlayerIndex;
            
            const card = document.createElement('div');
            card.className = `player-card player-${index + 1}`;
            if (isActive) card.classList.add('active');

            card.innerHTML = `
                <div class="player-card-name">${player.name}</div>
                <div class="player-card-round-money">${player.roundMoney}€</div>
                <div class="money-label">Tour</div>
                <div class="player-card-total-money">${player.totalMoney}€</div>
                <div class="money-label">Total</div>
            `;

            container.appendChild(card);
        });
    }

    // Afficher le résultat de la roue
    displayWheelResult(result) {
        const wheelValue = document.getElementById('wheelValue');
        if (wheelValue) {
            wheelValue.textContent = result.value + (result.type === 'money' ? '€' : '');
        }

        const wheelResult = document.getElementById('wheelResult');
        if (wheelResult) {
            wheelResult.textContent = result.value + (result.type === 'money' ? '€' : '');
            wheelResult.classList.remove('hidden');
        }
    }

    // Mettre à jour le chat
    updateChat(roomData) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages || !roomData.chatMessages) return;

        chatMessages.innerHTML = '';

        roomData.chatMessages.slice(-50).forEach(msg => {
            const div = document.createElement('div');
            div.className = 'chat-message';
            div.innerHTML = `
                <span class="chat-sender">${msg.sender}:</span>
                <span>${msg.message}</span>
            `;
            chatMessages.appendChild(div);
        });

        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Afficher ou masquer le fond chroma key (fond magenta)
    toggleChromaKey(enabled) {
        if (enabled) {
            document.body.classList.add('chroma-key');
            document.body.style.background = '#FF00FF'; // Magenta pour éviter les conflits avec les couleurs vertes de la roue
        } else {
            document.body.classList.remove('chroma-key');
            // Restaurer le fond par défaut défini dans colors.css
            document.body.style.background = 'var(--color-background)';
        }
    }
}
