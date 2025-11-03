// ====================================
// GAME.JS - Logique du jeu
// ====================================

export class GameEngine {
    constructor(networkManager, wheelManager) {
        this.network = networkManager;
        this.wheel = wheelManager;
        this.config = null;
        this.puzzles = null;
        this.currentPuzzle = null;
        this.init();
    }

    async init() {
        await this.loadConfig();
        await this.loadPuzzles();
    }

    async loadConfig() {
        try {
            const response = await fetch('data/config.json');
            this.config = await response.json();
        } catch (error) {
            // propagate error so caller (app) can show to player
            throw new Error('Erreur chargement config: ' + (error?.message || error));
        }
    }

    async loadPuzzles() {
        try {
            const response = await fetch('data/puzzles.json');
            this.puzzles = await response.json();
        } catch (error) {
            // propagate error so caller (app) can show to player
            throw new Error('Erreur chargement puzzles: ' + (error?.message || error));
        }
    }

    // Démarrer une nouvelle partie
    startGame() {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData) return false;

        // Filtrer uniquement les joueurs connectés (pas le host)
        const players = roomData.players.filter(p => p.role === 'player' && p.connected);
        if (players.length < 2) return false;

        // Ne pas mélanger les segments - toutes les roues doivent être identiques
        // pour une synchronisation parfaite entre gérant, joueurs et overlay

        // Initialiser le jeu
        this.network.updateRoomState({
            state: 'playing',
            currentRound: 1,
            currentPlayerIndex: 0,
            puzzle: this.getRandomPuzzle(),
            revealedLetters: [],
            usedLetters: [],
            wheelResult: null,
            paused: false,
            pausedAt: null
        });

        return true;
    }

    // Obtenir un puzzle aléatoire
    getRandomPuzzle() {
        if (!this.puzzles || !this.puzzles.puzzles) return null;
        
        const randomIndex = Math.floor(Math.random() * this.puzzles.puzzles.length);
        const puzzle = this.puzzles.puzzles[randomIndex];
        
        return {
            category: puzzle.category,
            solution: puzzle.solution.toUpperCase(),
            words: puzzle.solution.toUpperCase().split(' ')
        };
    }

    // Proposer une lettre
    proposeLetter(letter) {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData || !roomData.puzzle || roomData.paused) return false;

        letter = letter.toUpperCase();
        
        // Vérifier si la lettre a déjà été utilisée
        if (roomData.usedLetters.includes(letter)) {
            return { success: false, reason: 'already_used' };
        }

        // Ajouter aux lettres utilisées
        const newUsedLetters = [...roomData.usedLetters, letter];

        // Vérifier si la lettre est dans la solution
        const count = (roomData.puzzle.solution.match(new RegExp(letter, 'g')) || []).length;

        if (count > 0) {
            // Lettre trouvée
            const newRevealedLetters = [...roomData.revealedLetters];
            if (!newRevealedLetters.includes(letter)) {
                newRevealedLetters.push(letter);
            }

            // Calculer les gains - l'argent de base a déjà été ajouté lors du spin
            const updates = {
                usedLetters: newUsedLetters,
                revealedLetters: newRevealedLetters
            };
            
            // Ajouter les gains multipliés par le nombre de lettres
            const wheelValue = parseInt(roomData.wheelResult);
            if (roomData.wheelResult && !isNaN(wheelValue)) {
                const currentPlayer = this.getCurrentPlayer(roomData);
                if (currentPlayer && currentPlayer.connected) {
                    // Ajouter l'argent multiplié par le nombre de lettres trouvées
                    currentPlayer.roundMoney += wheelValue * count;
                    updates.players = roomData.players;
                }
            }

            this.network.updateRoomState(updates);
            return { success: true, count: count, keepPlaying: true };
        } else {
            // Lettre non trouvée - réinitialiser wheelValue et passer au joueur suivant
            const currentPlayer = this.getCurrentPlayer(roomData);
            if (currentPlayer && currentPlayer.wheelValue) {
                currentPlayer.wheelValue = 0;
            }
            this.network.updateRoomState({ usedLetters: newUsedLetters, players: roomData.players });
            this.nextPlayer();
            return { success: false, count: 0, reason: 'not_found' };
        }
    }

    // Acheter une voyelle
    buyVowel(letter) {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData || roomData.paused) return { success: false, reason: 'paused' };

        const currentPlayer = this.getCurrentPlayer(roomData);
        if (!currentPlayer || !currentPlayer.connected) return { success: false, reason: 'no_player' };

        const vowelCost = this.config?.game?.vowelCost || 250;

        // Vérifier que le joueur a assez d'argent
        if (currentPlayer.roundMoney < vowelCost) {
            return { success: false, reason: 'not_enough_money' };
        }

        // Déduire le coût de la voyelle
        currentPlayer.roundMoney -= vowelCost;

        // Proposer la lettre (voyelle)
        const result = this.proposeLetter(letter);
        
        // Pas besoin de sauvegarder ici car proposeLetter le fait déjà
        
        return result;
    }

    // Résoudre le puzzle
    solvePuzzle(success) {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData || roomData.paused) return false;

        const currentPlayer = this.getCurrentPlayer(roomData);
        if (!currentPlayer || !success) {
            // Mauvaise réponse - passer au joueur suivant
            if (currentPlayer) {
                currentPlayer.roundMoney = 0;
                this.network.updateRoomState({ players: roomData.players });
            }
            this.nextPlayer();
            return false;
        }

        // Bonne réponse - le joueur garde ses gains
        currentPlayer.totalMoney += currentPlayer.roundMoney;

        // Réinitialiser tous les joueurs pour la manche suivante
        roomData.players.forEach(p => {
            if (p.role === 'player') {
                p.roundMoney = 0;
            }
        });

        // Passer à la manche suivante
        const updates = { players: roomData.players };
        
        if (roomData.currentRound < (this.config?.game?.roundsPerGame || 5)) {
            updates.currentRound = roomData.currentRound + 1;
            
            // Ne pas mélanger les segments - toutes les roues doivent rester identiques
            
            updates.puzzle = this.getRandomPuzzle();
            updates.revealedLetters = [];
            updates.usedLetters = [];
            updates.wheelResult = null;
            updates.currentPlayerIndex = 0;
        } else {
            // Fin de partie
            updates.state = 'finished';
            updates.winner = this.getWinner(roomData);
        }

        this.network.updateRoomState(updates);
        return true;
    }

    // Joueur suivant (en sautant les déconnectés)
    nextPlayer() {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData) return;

        const players = roomData.players.filter(p => p.role === 'player' && p.connected);
        if (players.length === 0) return;

        let nextIndex = (roomData.currentPlayerIndex + 1) % players.length;
        
        // Trouver le prochain joueur connecté
        let attempts = 0;
        while (!players[nextIndex].connected && attempts < players.length) {
            nextIndex = (nextIndex + 1) % players.length;
            attempts++;
        }

        roomData.currentPlayerIndex = nextIndex;

        this.network.updateRoomState({ 
            currentPlayerIndex: nextIndex,
            wheelResult: null
        });
    }

    // Obtenir le joueur actuel
    getCurrentPlayer(roomData) {
        const players = roomData.players.filter(p => p.role === 'player' && p.connected);
        if (players.length === 0) return null;
        return players[roomData.currentPlayerIndex];
    }

    // Banqueroute
    bankruptcy() {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData || roomData.paused) return;

        const currentPlayer = this.getCurrentPlayer(roomData);
        if (currentPlayer) {
            currentPlayer.roundMoney = 0;
        }

        this.nextPlayer();
    }

    // Hold Up
    holdUp(targetPlayerIndex) {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData || roomData.paused) return;

        const currentPlayer = this.getCurrentPlayer(roomData);
        const players = roomData.players.filter(p => p.role === 'player' && p.connected);
        const targetPlayer = players[targetPlayerIndex];

        if (currentPlayer && targetPlayer) {
            currentPlayer.roundMoney += targetPlayer.roundMoney;
            targetPlayer.roundMoney = 0;
        }

        this.network.updateRoomState({ players: roomData.players });
    }

    // Échange
    swapMoney(targetPlayerIndex) {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData || roomData.paused) return;

        const currentPlayer = this.getCurrentPlayer(roomData);
        const players = roomData.players.filter(p => p.role === 'player' && p.connected);
        const targetPlayer = players[targetPlayerIndex];

        if (currentPlayer && targetPlayer) {
            const temp = currentPlayer.roundMoney;
            currentPlayer.roundMoney = targetPlayer.roundMoney;
            targetPlayer.roundMoney = temp;
        }

        this.network.updateRoomState({ players: roomData.players });
    }

    // Diviseur
    divideOpponent(targetPlayerIndex) {
        const roomData = this.network.getRoomData(this.network.getCurrentRoomCode());
        if (!roomData || roomData.paused) return;

        const players = roomData.players.filter(p => p.role === 'player' && p.connected);
        const targetPlayer = players[targetPlayerIndex];

        if (targetPlayer) {
            targetPlayer.roundMoney = Math.floor(targetPlayer.roundMoney / 2);
        }

        this.network.updateRoomState({ players: roomData.players });
    }

    // Obtenir le gagnant
    getWinner(roomData) {
        const players = roomData.players.filter(p => p.role === 'player');
        if (players.length === 0) return null;
        
        let winner = players[0];

        players.forEach(player => {
            if (player.totalMoney > winner.totalMoney) {
                winner = player;
            }
        });

        return winner;
    }
}
