// ====================================
// NETWORKING.JS - Gestion des rooms et synchronisation
// ====================================

export class NetworkManager {
    constructor() {
        this.roomCode = null;
        this.playerData = null;
        this.updateCallbacks = [];
        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        this.init();
    }

    init() {
        // Écouter les changements dans localStorage
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith('room_')) {
                this.handleRoomUpdate(e.key, e.newValue);
            }
        });

        // Polling pour les changements locaux (même onglet)
        setInterval(() => {
            if (this.roomCode) {
                const roomData = this.getRoomData(this.roomCode);
                // Si la room n'existe plus, notifier avec null
                if (!roomData) {
                    this.notifyUpdate(null);
                } else {
                    this.notifyUpdate(roomData);
                }
            }
        }, 500);

        // Détecter la fermeture de la page
        window.addEventListener('beforeunload', () => {
            if (this.roomCode && this.playerData) {
                this.markPlayerDisconnected();
            }
        });

        // Heartbeat pour maintenir la connexion
        this.startHeartbeat();
    }

    // Générer un code de room aléatoire
    generateRoomCode() {
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return code;
    }

    // Créer une nouvelle room
    createRoom(hostName, role) {
        const code = this.generateRoomCode();
        const roomData = {
            code: code,
            host: hostName,
            players: [{
                name: hostName,
                role: role,
                id: this.generatePlayerId(),
                roundMoney: 0,
                totalMoney: 0,
                connected: true,
                lastHeartbeat: Date.now(),
                disconnectedAt: null
            }],
            state: 'lobby',
            currentRound: 0,
            currentPlayerIndex: 0,
            // Liste des pseudos bannis (stockés en minuscules)
            bannedPlayers: [],
            settings: {
                streamerMode: false,
                chromaKey: false
                ,
                // Si true, conserver la liste des comptes bannis après la fin/dissolution de la partie
                persistBans: false
            },
            puzzle: null,
            revealedLetters: [],
            usedLetters: [],
            wheelResult: null,
            chatMessages: [],
            paused: false,
            pausedAt: null,
            pauseReason: null,
            vote: null,
            createdAt: Date.now()
        };

        this.saveRoomData(code, roomData);
        this.roomCode = code;
        this.playerData = roomData.players[0];
        return { success: true, code: code, data: roomData };
    }

    joinRoom(code, playerName, role) {
        const roomData = this.getRoomData(code);
        
        if (!roomData) {
            return { success: false, error: 'Code de partie invalide' };
        }

        // Regarder si pseudo déjà pris
        const existingPlayer = roomData.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (existingPlayer) {
            if (!existingPlayer.connected) {
                // Cas reconnexion, on reconnecte
                existingPlayer.connected = true;
                existingPlayer.lastHeartbeat = Date.now();
                existingPlayer.disconnectedAt = null;
                this.saveRoomData(code, roomData);
                this.roomCode = code;
                this.playerData = existingPlayer;

                if (existingPlayer.role === 'host' && roomData.paused) {
                    roomData.paused = false;
                    roomData.pausedAt = null;
                    roomData.pauseReason = null;
                    this.saveRoomData(code, roomData);
                }

                return { success: true, data: roomData, reconnected: true };
            } else {
                // Déjà connecté sous ce pseudo, erreur
                return { success: false, error: 'Pseudo déjà utilisé dans la partie.' };
            }
        }

        const hostPresent = roomData.players.some(p => p.role === 'host' && p.connected);
        const playersConnectedCount = roomData.players.filter(p => p.role === 'player' && p.connected).length;

        if (role === 'host' && hostPresent) {
            return { success: false, error: 'Le gérant est déjà dans la partie.' };
        }

        if (role === 'player' && playersConnectedCount >= 4) {
            return { success: false, error: 'La partie est pleine (4 joueurs max).' };
        }

        // Ajout comme nouveau joueur
        const newPlayer = {
            name: playerName,
            role: role,
            id: this.generatePlayerId(),
            roundMoney: 0,
            totalMoney: 0,
            connected: true,
            lastHeartbeat: Date.now(),
            disconnectedAt: null
        };

        roomData.players.push(newPlayer);
        this.saveRoomData(code, roomData);
        this.roomCode = code;
        this.playerData = newPlayer;

        return { success: true, data: roomData };
    }
    // Quitter une room
    leaveRoom() {
        if (!this.roomCode || !this.playerData) return;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData) return;

        // Retirer le joueur complètement
        roomData.players = roomData.players.filter(p => p.id !== this.playerData.id);

        if (roomData.players.length === 0) {
            // Supprimer la room si vide
            localStorage.removeItem(`room_${this.roomCode}`);
        } else {
            // Si le host part, promouvoir un autre joueur
            if (this.playerData.role === 'host') {
                const newHost = roomData.players.find(p => p.role === 'host') || roomData.players[0];
                if (newHost) {
                    newHost.role = 'host';
                    roomData.host = newHost.name;
                }
            }
            this.saveRoomData(this.roomCode, roomData);
        }

        this.stopHeartbeat();
        this.roomCode = null;
        this.playerData = null;
    }

    // Marquer un joueur comme déconnecté (sans le retirer)
    markPlayerDisconnected() {
        if (!this.roomCode || !this.playerData) return;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData) return;

        const player = roomData.players.find(p => p.id === this.playerData.id);
        if (player) {
            player.connected = false;
            player.disconnectedAt = Date.now();
            
            // Si c'est le host, mettre en pause
            if (player.role === 'host' && roomData.state === 'playing') {
                roomData.paused = true;
                roomData.pausedAt = Date.now();
                roomData.pauseReason = 'host_disconnected';
            }
            
            this.saveRoomData(this.roomCode, roomData);
        }
    }

    // Exclure un joueur (uniquement pour le host)
    kickPlayer(playerId) {
        if (!this.roomCode || !this.isHost()) return false;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData) return false;

        // Ne pas pouvoir s'exclure soi-même
        if (playerId === this.playerData.id) return false;

        roomData.players = roomData.players.filter(p => p.id !== playerId);
        this.saveRoomData(this.roomCode, roomData);
        return true;
    }

    // Vérifier les joueurs déconnectés et les supprimer après timeout
    checkDisconnectedPlayers() {
        if (!this.roomCode) return;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData) return;

        const now = Date.now();
        const DISCONNECT_TIMEOUT = 120000; // 2 minutes

        let playersRemoved = false;

        roomData.players.forEach((player, index) => {
            if (!player.connected && player.disconnectedAt) {
                const disconnectedTime = now - player.disconnectedAt;
                
                if (disconnectedTime > DISCONNECT_TIMEOUT) {
                    // Supprimer le joueur après 2 minutes
                    roomData.players.splice(index, 1);
                    playersRemoved = true;
                }
            }
        });

        if (playersRemoved) {
            this.saveRoomData(this.roomCode, roomData);
        }
    }

    // Heartbeat pour maintenir la connexion
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            if (this.roomCode && this.playerData) {
                const roomData = this.getRoomData(this.roomCode);
                if (roomData) {
                    const player = roomData.players.find(p => p.id === this.playerData.id);
                    if (player) {
                        player.lastHeartbeat = Date.now();
                        player.connected = true;
                        this.saveRoomData(this.roomCode, roomData);
                    }
                }
                
                // Vérifier les joueurs déconnectés
                this.checkDisconnectedPlayers();
                
                // Vérifier les votes en pause
                this.checkPauseVotes();
            }
        }, 5000); // Toutes les 5 secondes
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    // Vérifier les votes en pause
    checkPauseVotes() {
        if (!this.roomCode) return;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData || !roomData.paused || !roomData.pausedAt) return;

        const now = Date.now();
        const pausedTime = now - roomData.pausedAt;
        const FIRST_VOTE_TIME = 120000; // 2 minutes
        const REVOTE_TIME = 60000; // 1 minute

        // Si le host est reconnecté, annuler la pause
        const host = roomData.players.find(p => p.role === 'host');
        if (host && host.connected) {
            roomData.paused = false;
            roomData.pausedAt = null;
            roomData.pauseReason = null;
            roomData.vote = null;
            this.saveRoomData(this.roomCode, roomData);
            return;
        }

        // Lancer le premier vote après 2 minutes
        if (pausedTime > FIRST_VOTE_TIME && !roomData.vote) {
            this.startVote('Le présentateur est absent depuis 2 minutes. Voulez-vous arrêter la partie ?');
        }
        
        // Relancer un vote toutes les minutes après le premier
        if (roomData.vote && roomData.vote.endedAt) {
            const timeSinceLastVote = now - roomData.vote.endedAt;
            if (timeSinceLastVote > REVOTE_TIME && !roomData.vote.active) {
                this.startVote('Le présentateur est toujours absent. Voulez-vous arrêter la partie ?');
            }
        }
    }

    // Démarrer un vote
    startVote(question) {
        if (!this.roomCode) return;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData) return;

        roomData.vote = {
            active: true,
            question: question,
            startedAt: Date.now(),
            duration: 60000, // 1 minute
            votes: {},
            endedAt: null,
            result: null
        };

        this.saveRoomData(this.roomCode, roomData);
    }

    // Voter
    castVote(playerId, vote) {
        if (!this.roomCode) return false;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData || !roomData.vote || !roomData.vote.active) return false;

        roomData.vote.votes[playerId] = vote;
        this.saveRoomData(this.roomCode, roomData);
        
        // Vérifier si tous les joueurs ont voté
        const players = roomData.players.filter(p => p.role === 'player' && p.connected);
        const votedCount = Object.keys(roomData.vote.votes).length;
        
        if (votedCount >= players.length) {
            this.endVote();
        }
        
        return true;
    }

    // Terminer un vote
    endVote() {
        if (!this.roomCode) return;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData || !roomData.vote) return;

        const votes = roomData.vote.votes;
        const yesVotes = Object.values(votes).filter(v => v === 'yes').length;
        const noVotes = Object.values(votes).filter(v => v === 'no').length;

        roomData.vote.active = false;
        roomData.vote.endedAt = Date.now();
        roomData.vote.result = yesVotes > noVotes ? 'yes' : 'no';

        if (roomData.vote.result === 'yes') {
            // Arrêter la partie
            roomData.state = 'finished';
            roomData.paused = false;
            roomData.pauseReason = 'vote_stopped';
        }

        this.saveRoomData(this.roomCode, roomData);
    }

    // Sauvegarder les données d'une room
    saveRoomData(code, data) {
        data.lastUpdate = Date.now();
        localStorage.setItem(`room_${code}`, JSON.stringify(data));
    }

    // Récupérer les données d'une room
    getRoomData(code) {
        const data = localStorage.getItem(`room_${code}`);
        return data ? JSON.parse(data) : null;
    }

    // Mettre à jour l'état de la room
    updateRoomState(updates) {
        if (!this.roomCode) return false;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData) return false;

        Object.assign(roomData, updates);

        // Si la partie est terminée (state === 'finished') et que l'option de persistance des bans
        // n'est pas activée, on réinitialise la liste des bannis pour permettre à tout le monde
        // de revenir pour une nouvelle partie.
        try {
            if (roomData.state === 'finished' && !(roomData.settings && roomData.settings.persistBans)) {
                roomData.bannedPlayers = [];
            }
        } catch (e) {
            // ignore
        }

        this.saveRoomData(this.roomCode, roomData);
        this.notifyUpdate(roomData);
        return true;
    }

    // Générer un ID unique pour un joueur
    generatePlayerId() {
        return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Ajouter un callback pour les mises à jour
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    // Notifier tous les callbacks
    notifyUpdate(roomData) {
        this.updateCallbacks.forEach(callback => callback(roomData));
    }

    // Gérer les mises à jour de room
    handleRoomUpdate(key, newValue) {
        if (!this.roomCode) return;
        if (key !== `room_${this.roomCode}`) return;

        // Si newValue est null, la room a été supprimée
        if (!newValue) {
            this.notifyUpdate(null);
            return;
        }

        const roomData = JSON.parse(newValue);
        this.notifyUpdate(roomData);
    }

    // Envoyer un message dans le chat
    sendChatMessage(message) {
        if (!this.roomCode || !this.playerData) return false;

        const roomData = this.getRoomData(this.roomCode);
        if (!roomData) return false;

        roomData.chatMessages.push({
            sender: this.playerData.name,
            message: message,
            timestamp: Date.now()
        });

        this.saveRoomData(this.roomCode, roomData);
        return true;
    }

    // Obtenir le code de la room actuelle
    getCurrentRoomCode() {
        return this.roomCode;
    }

    // Obtenir les données du joueur actuel
    getCurrentPlayer() {
        return this.playerData;
    }

    // Vérifier si c'est le host
    isHost() {
        return this.playerData && this.playerData.role === 'host';
    }

    // Obtenir le temps de déconnexion restant
    getDisconnectTimeRemaining(player) {
        if (!player.disconnectedAt) return 0;
        const elapsed = Date.now() - player.disconnectedAt;
        const remaining = 120000 - elapsed; // 2 minutes
        return Math.max(0, Math.floor(remaining / 1000));
    }
}