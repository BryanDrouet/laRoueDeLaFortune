// ====================================
// NETWORKING.JS - Gestion des rooms et synchronisation (Firebase)
// ====================================

import { firebaseConfig } from './firebase-config.js';

export class NetworkManager {
    constructor() {
        this.roomCode = null;
        this.playerData = null;
        this.updateCallbacks = [];
        this.heartbeatInterval = null;
        this.reconnectTimeout = null;
        this.db = null;
        this.roomRef = null;
        this.init();
    }

    async init() {
        // Initialiser Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        this.db = firebase.database();

        // Détecter la fermeture de la page
        window.addEventListener('beforeunload', () => {
            if (this.roomCode && this.playerData) {
                this.markPlayerDisconnected();
            }
        });

        // Heartbeat pour maintenir la connexion
        this.startHeartbeat();
    }

    // Écouter les changements d'une room
    listenToRoom(roomCode) {
        if (this.roomRef) {
            this.roomRef.off(); // Arrêter l'ancienne écoute
        }

        this.roomRef = this.db.ref(`rooms/${roomCode}`);
        this.roomRef.on('value', (snapshot) => {
            const roomData = snapshot.val();
            this.notifyUpdate(roomData);
        });
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
    async createRoom(hostName, role) {
        const code = this.generateRoomCode();
        
        // Vérifier que le code n'existe pas déjà
        const snapshot = await this.db.ref(`rooms/${code}`).once('value');
        if (snapshot.exists()) {
            // Code existe déjà, réessayer
            return this.createRoom(hostName, role);
        }

        const newPlayer = {
            name: hostName,
            role: role,
            id: this.generatePlayerId(),
            roundMoney: 0,
            totalMoney: 0,
            connected: true,
            lastHeartbeat: Date.now(),
            disconnectedAt: null
        };

        const roomData = {
            code: code,
            host: hostName,
            players: [newPlayer],
            state: 'lobby',
            currentRound: 0,
            currentPlayerIndex: 0,
            bannedPlayers: [],
            settings: {
                streamerMode: false,
                chromaKey: false,
                persistBans: false,
                filterBannedUsernames: true
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
            createdAt: Date.now(),
            lastUpdate: Date.now()
        };

        await this.db.ref(`rooms/${code}`).set(roomData);
        
        this.roomCode = code;
        this.playerData = newPlayer;
        this.listenToRoom(code);

        return { success: true, code: code, data: roomData };
    }

    async joinRoom(code, playerName, role) {
        const snapshot = await this.db.ref(`rooms/${code}`).once('value');
        const roomData = snapshot.val();
        
        if (!roomData) {
            return { success: false, error: 'Code de partie invalide' };
        }

        // Regarder si pseudo déjà pris
        const existingPlayer = roomData.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        if (existingPlayer) {
            if (!existingPlayer.connected) {
                // Cas reconnexion
                existingPlayer.connected = true;
                existingPlayer.lastHeartbeat = Date.now();
                existingPlayer.disconnectedAt = null;

                if (existingPlayer.role === 'host' && roomData.paused) {
                    roomData.paused = false;
                    roomData.pausedAt = null;
                    roomData.pauseReason = null;
                }

                await this.db.ref(`rooms/${code}`).update(roomData);
                
                this.roomCode = code;
                this.playerData = existingPlayer;
                this.listenToRoom(code);

                return { success: true, data: roomData, reconnected: true };
            } else {
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
        roomData.lastUpdate = Date.now();
        
        await this.db.ref(`rooms/${code}`).update(roomData);
        
        this.roomCode = code;
        this.playerData = newPlayer;
        this.listenToRoom(code);

        return { success: true, data: roomData };
    }
    // Quitter une room
    async leaveRoom() {
        if (!this.roomCode || !this.playerData) return;

        const snapshot = await this.db.ref(`rooms/${this.roomCode}`).once('value');
        const roomData = snapshot.val();
        
        if (!roomData) return;

        // Retirer le joueur
        roomData.players = roomData.players.filter(p => p.id !== this.playerData.id);

        if (roomData.players.length === 0) {
            // Supprimer la room si vide
            await this.db.ref(`rooms/${this.roomCode}`).remove();
        } else {
            // Si le host part, promouvoir un autre joueur
            const hasHost = roomData.players.some(p => p.role === 'host');
            if (!hasHost && roomData.players.length > 0) {
                roomData.players[0].role = 'host';
                roomData.host = roomData.players[0].name;
            }
            
            roomData.lastUpdate = Date.now();
            await this.db.ref(`rooms/${this.roomCode}`).update(roomData);
        }

        if (this.roomRef) {
            this.roomRef.off();
        }

        this.stopHeartbeat();
        this.roomCode = null;
        this.playerData = null;
    }

    // Marquer un joueur comme déconnecté (sans le retirer)
    async markPlayerDisconnected() {
        if (!this.roomCode || !this.playerData) return;

        const snapshot = await this.db.ref(`rooms/${this.roomCode}`).once('value');
        const roomData = snapshot.val();
        
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
            
            roomData.lastUpdate = Date.now();
            await this.db.ref(`rooms/${this.roomCode}`).update(roomData);
        }
    }

    // Exclure un joueur (uniquement pour le host)
    async kickPlayer(playerId) {
        if (!this.roomCode || !this.isHost()) return false;

        const snapshot = await this.db.ref(`rooms/${this.roomCode}`).once('value');
        const roomData = snapshot.val();
        
        if (!roomData) return false;

        // Ne pas pouvoir s'exclure soi-même
        if (playerId === this.playerData.id) return false;

        roomData.players = roomData.players.filter(p => p.id !== playerId);
        roomData.lastUpdate = Date.now();
        
        await this.db.ref(`rooms/${this.roomCode}`).update(roomData);
        
        return true;
    }

    // Vérifier les joueurs déconnectés et les supprimer après timeout
    checkDisconnectedPlayers() {
        // Plus nécessaire - le serveur gère cela automatiquement
    }

    // Heartbeat pour maintenir la connexion
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            if (this.roomCode && this.playerData) {
                const snapshot = await this.db.ref(`rooms/${this.roomCode}`).once('value');
                const roomData = snapshot.val();
                
                if (roomData) {
                    const player = roomData.players.find(p => p.id === this.playerData.id);
                    if (player) {
                        player.lastHeartbeat = Date.now();
                        player.connected = true;
                    }
                    
                    // Nettoyer les joueurs déconnectés depuis plus de 2 minutes
                    const now = Date.now();
                    const DISCONNECT_TIMEOUT = 120000;
                    
                    roomData.players = roomData.players.filter(p => {
                        if (!p.connected && p.disconnectedAt) {
                            return (now - p.disconnectedAt) <= DISCONNECT_TIMEOUT;
                        }
                        return true;
                    });
                    
                    roomData.lastUpdate = Date.now();
                    await this.db.ref(`rooms/${this.roomCode}`).update(roomData);
                }
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
        // Plus nécessaire - le serveur peut gérer cela si besoin
    }

    // Démarrer un vote
    startVote(question) {
        if (!this.roomCode) return;

        this.updateRoomState({
            vote: {
                active: true,
                question: question,
                startedAt: Date.now(),
                duration: 60000,
                votes: {},
                endedAt: null,
                result: null
            }
        });
    }

    // Voter
    castVote(playerId, vote) {
        if (!this.roomCode) return false;

        this.getRoomData(this.roomCode).then(roomData => {
            if (!roomData || !roomData.vote || !roomData.vote.active) return false;

            roomData.vote.votes[playerId] = vote;
            
            // Vérifier si tous les joueurs ont voté
            const players = roomData.players.filter(p => p.role === 'player' && p.connected);
            const votedCount = Object.keys(roomData.vote.votes).length;
            
            if (votedCount >= players.length) {
                this.endVote(roomData);
            } else {
                this.updateRoomState({ vote: roomData.vote });
            }
        });
        
        return true;
    }

    // Terminer un vote
    endVote(roomData) {
        if (!this.roomCode || !roomData) return;

        const votes = roomData.vote.votes;
        const yesVotes = Object.values(votes).filter(v => v === 'yes').length;
        const noVotes = Object.values(votes).filter(v => v === 'no').length;

        roomData.vote.active = false;
        roomData.vote.endedAt = Date.now();
        roomData.vote.result = yesVotes > noVotes ? 'yes' : 'no';

        const updates = { vote: roomData.vote };

        if (roomData.vote.result === 'yes') {
            // Arrêter la partie
            updates.state = 'finished';
            updates.paused = false;
            updates.pauseReason = 'vote_stopped';
        }

        this.updateRoomState(updates);
    }

    // Sauvegarder les données d'une room
    saveRoomData(code, data) {
        // Utilisé pour compatibilité - Firebase update en temps réel
    }

    // Récupérer les données d'une room
    async getRoomData(code) {
        const snapshot = await this.db.ref(`rooms/${code}`).once('value');
        return snapshot.val();
    }

    // Mettre à jour l'état de la room
    async updateRoomState(updates) {
        if (!this.roomCode) return false;

        const snapshot = await this.db.ref(`rooms/${this.roomCode}`).once('value');
        const roomData = snapshot.val();
        
        if (!roomData) return false;

        Object.assign(roomData, updates);
        roomData.lastUpdate = Date.now();

        // Gérer la fin de partie et les bannis
        if (roomData.state === 'finished' && !(roomData.settings && roomData.settings.persistBans)) {
            roomData.bannedPlayers = [];
        }

        await this.db.ref(`rooms/${this.roomCode}`).update(roomData);
        
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

    // Plus besoin de handleRoomUpdate avec Socket.IO
    // Le serveur envoie directement les mises à jour via roomUpdate

    // Envoyer un message dans le chat
    async sendChatMessage(message) {
        if (!this.roomCode || !this.playerData) return false;

        const snapshot = await this.db.ref(`rooms/${this.roomCode}`).once('value');
        const roomData = snapshot.val();
        
        if (!roomData) return false;

        if (!roomData.chatMessages) {
            roomData.chatMessages = [];
        }

        roomData.chatMessages.push({
            sender: this.playerData.name,
            message: message,
            timestamp: Date.now()
        });

        roomData.lastUpdate = Date.now();
        await this.db.ref(`rooms/${this.roomCode}`).update(roomData);
        
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