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

        // Mélanger les segments de la roue pour la première manche
        if (this.wheel && this.wheel.segments) {
            this.wheel.segments = this.wheel.shuffleArray(this.wheel.segments);
        }

        // Initialiser le jeu
        // Désactiver temporairement les manches énigme
        const roundType = 'normale';
        
        this.network.updateRoomState({
            state: 'playing',
            currentRound: 1,
            roundType: roundType,
            currentPlayerIndex: 0,
            puzzle: this.getRandomPuzzle(),
            revealedLetters: [],
            usedLetters: [],
            wheelResult: null,
            paused: false,
            pausedAt: null,
            buzzerActive: false,
            letterRevealPaused: false
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

        // Si la révélation des lettres est en pause (buzzer actif), empêcher la proposition
        if (roomData.letterRevealPaused) {
            return { success: false, reason: 'buzzer_active' };
        }

        letter = letter.toUpperCase();
        
        // Vérifier si la lettre a déjà été utilisée
        if (roomData.usedLetters.includes(letter)) {
            return { success: false, reason: 'already_used' };
        }

        // Ajouter aux lettres utilisées
        roomData.usedLetters.push(letter);

        // Vérifier si la lettre est dans la solution
        const count = (roomData.puzzle.solution.match(new RegExp(letter, 'g')) || []).length;

        if (count > 0) {
            // Lettre trouvée
            if (!roomData.revealedLetters.includes(letter)) {
                roomData.revealedLetters.push(letter);
            }

            // Calculer les gains
            if (roomData.wheelResult && typeof roomData.wheelResult === 'number') {
                const currentPlayer = this.getCurrentPlayer(roomData);
                if (currentPlayer && currentPlayer.connected) {
                    currentPlayer.roundMoney += roomData.wheelResult * count;
                }
            }

            this.network.saveRoomData(this.network.getCurrentRoomCode(), roomData);
            return { success: true, count: count, keepPlaying: true };
        } else {
            // Lettre non trouvée - passer au joueur suivant
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
        
        // Sauvegarder l'état même si la lettre n'est pas trouvée
        this.network.saveRoomData(this.network.getCurrentRoomCode(), roomData);
        
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
        if (roomData.currentRound < (this.config?.game?.roundsPerGame || 5)) {
            roomData.currentRound++;
            
            // Mélanger les segments de la roue pour la nouvelle manche
            if (this.wheel && this.wheel.segments) {
                this.wheel.segments = this.wheel.shuffleArray(this.wheel.segments);
            }
            
            // Désactiver temporairement les manches énigme
            roomData.roundType = 'normale';
            roomData.puzzle = this.getRandomPuzzle();
            roomData.revealedLetters = [];
            roomData.usedLetters = [];
            roomData.wheelResult = null;
            roomData.currentPlayerIndex = 0;
            roomData.letterRevealPaused = false;
            roomData.buzzerProposal = null;
        } else {
            // Fin de partie
            roomData.state = 'finished';
            roomData.winner = this.getWinner(roomData);
        }

        this.network.saveRoomData(this.network.getCurrentRoomCode(), roomData);
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
        roomData.wheelResult = null;

        this.network.saveRoomData(this.network.getCurrentRoomCode(), roomData);
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

        this.network.saveRoomData(this.network.getCurrentRoomCode(), roomData);
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

        this.network.saveRoomData(this.network.getCurrentRoomCode(), roomData);
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

        this.network.saveRoomData(this.network.getCurrentRoomCode(), roomData);
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
