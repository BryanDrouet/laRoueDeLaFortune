// ====================================
// SERVER.JS - Serveur Node.js avec Socket.IO
// ====================================

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname)));

// Stockage des rooms en mémoire
const rooms = new Map();

// Fonction pour nettoyer les joueurs déconnectés
function cleanupDisconnectedPlayers(roomCode) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const now = Date.now();
    const DISCONNECT_TIMEOUT = 120000; // 2 minutes

    room.players = room.players.filter(player => {
        if (!player.connected && player.disconnectedAt) {
            const disconnectedTime = now - player.disconnectedAt;
            return disconnectedTime <= DISCONNECT_TIMEOUT;
        }
        return true;
    });

    // Supprimer la room si elle est vide
    if (room.players.length === 0) {
        rooms.delete(roomCode);
        return false;
    }

    return true;
}

// Fonction pour générer un code de room
function generateRoomCode() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Fonction pour générer un ID de joueur
function generatePlayerId() {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

io.on('connection', (socket) => {
    console.log('Nouveau client connecté:', socket.id);

    // Créer une nouvelle room
    socket.on('createRoom', (data, callback) => {
        const { playerName, role } = data;
        const code = generateRoomCode();

        const newPlayer = {
            name: playerName,
            role: role,
            id: generatePlayerId(),
            socketId: socket.id,
            roundMoney: 0,
            totalMoney: 0,
            connected: true,
            lastHeartbeat: Date.now(),
            disconnectedAt: null
        };

        const roomData = {
            code: code,
            host: playerName,
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

        rooms.set(code, roomData);
        socket.join(code);
        socket.roomCode = code;
        socket.playerId = newPlayer.id;

        console.log(`Room créée: ${code} par ${playerName}`);
        callback({ success: true, code: code, data: roomData });
    });

    // Rejoindre une room
    socket.on('joinRoom', (data, callback) => {
        const { code, playerName, role } = data;
        const roomData = rooms.get(code);

        if (!roomData) {
            callback({ success: false, error: 'Code de partie invalide' });
            return;
        }

        // Vérifier si c'est une reconnexion
        const existingPlayer = roomData.players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
        
        if (existingPlayer) {
            if (!existingPlayer.connected) {
                // Reconnexion
                existingPlayer.connected = true;
                existingPlayer.socketId = socket.id;
                existingPlayer.lastHeartbeat = Date.now();
                existingPlayer.disconnectedAt = null;

                socket.join(code);
                socket.roomCode = code;
                socket.playerId = existingPlayer.id;

                roomData.lastUpdate = Date.now();
                io.to(code).emit('roomUpdate', roomData);

                console.log(`${playerName} s'est reconnecté à la room ${code}`);
                callback({ success: true, data: roomData, reconnected: true });
                return;
            } else {
                callback({ success: false, error: 'Pseudo déjà utilisé dans la partie.' });
                return;
            }
        }

        // Vérifications pour nouveau joueur
        const hostPresent = roomData.players.some(p => p.role === 'host' && p.connected);
        const playersCount = roomData.players.filter(p => p.role === 'player' && p.connected).length;

        if (role === 'host' && hostPresent) {
            callback({ success: false, error: 'Le gérant est déjà dans la partie.' });
            return;
        }

        if (role === 'player' && playersCount >= 4) {
            callback({ success: false, error: 'La partie est pleine (4 joueurs max).' });
            return;
        }

        // Ajouter nouveau joueur
        const newPlayer = {
            name: playerName,
            role: role,
            id: generatePlayerId(),
            socketId: socket.id,
            roundMoney: 0,
            totalMoney: 0,
            connected: true,
            lastHeartbeat: Date.now(),
            disconnectedAt: null
        };

        roomData.players.push(newPlayer);
        roomData.lastUpdate = Date.now();

        socket.join(code);
        socket.roomCode = code;
        socket.playerId = newPlayer.id;

        io.to(code).emit('roomUpdate', roomData);

        console.log(`${playerName} a rejoint la room ${code}`);
        callback({ success: true, data: roomData });
    });

    // Quitter une room
    socket.on('leaveRoom', (data) => {
        const { roomCode, playerId } = data;
        const roomData = rooms.get(roomCode);

        if (!roomData) return;

        roomData.players = roomData.players.filter(p => p.id !== playerId);

        if (roomData.players.length === 0) {
            rooms.delete(roomCode);
            console.log(`Room ${roomCode} supprimée (vide)`);
        } else {
            // Promouvoir un nouveau host si nécessaire
            const hasHost = roomData.players.some(p => p.role === 'host');
            if (!hasHost && roomData.players.length > 0) {
                roomData.players[0].role = 'host';
                roomData.host = roomData.players[0].name;
            }

            roomData.lastUpdate = Date.now();
            io.to(roomCode).emit('roomUpdate', roomData);
        }

        socket.leave(roomCode);
    });

    // Mettre à jour l'état de la room
    socket.on('updateRoomState', (data) => {
        const { roomCode, updates } = data;
        const roomData = rooms.get(roomCode);

        if (!roomData) return;

        Object.assign(roomData, updates);
        roomData.lastUpdate = Date.now();

        // Gérer la fin de partie et les bannis
        if (roomData.state === 'finished' && !(roomData.settings && roomData.settings.persistBans)) {
            roomData.bannedPlayers = [];
        }

        io.to(roomCode).emit('roomUpdate', roomData);
    });

    // Heartbeat
    socket.on('heartbeat', (data) => {
        const { roomCode, playerId } = data;
        const roomData = rooms.get(roomCode);

        if (!roomData) return;

        const player = roomData.players.find(p => p.id === playerId);
        if (player) {
            player.lastHeartbeat = Date.now();
            player.connected = true;
        }

        // Nettoyer les joueurs déconnectés
        cleanupDisconnectedPlayers(roomCode);
    });

    // Récupérer les données d'une room
    socket.on('getRoomData', (roomCode, callback) => {
        const roomData = rooms.get(roomCode);
        callback(roomData || null);
    });

    // Envoyer un message de chat
    socket.on('sendChatMessage', (data) => {
        const { roomCode, playerName, message } = data;
        const roomData = rooms.get(roomCode);

        if (!roomData) return;

        roomData.chatMessages.push({
            sender: playerName,
            message: message,
            timestamp: Date.now()
        });

        roomData.lastUpdate = Date.now();
        io.to(roomCode).emit('roomUpdate', roomData);
    });

    // Exclure un joueur
    socket.on('kickPlayer', (data) => {
        const { roomCode, playerId } = data;
        const roomData = rooms.get(roomCode);

        if (!roomData) return;

        roomData.players = roomData.players.filter(p => p.id !== playerId);
        roomData.lastUpdate = Date.now();

        io.to(roomCode).emit('roomUpdate', roomData);
    });

    // Déconnexion
    socket.on('disconnect', () => {
        console.log('Client déconnecté:', socket.id);

        if (socket.roomCode && socket.playerId) {
            const roomData = rooms.get(socket.roomCode);
            if (roomData) {
                const player = roomData.players.find(p => p.id === socket.playerId);
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
                    io.to(socket.roomCode).emit('roomUpdate', roomData);
                }
            }
        }
    });
});

// Nettoyage périodique des rooms
setInterval(() => {
    const now = Date.now();
    const ROOM_TIMEOUT = 3600000; // 1 heure

    for (const [code, room] of rooms.entries()) {
        // Nettoyer les joueurs déconnectés
        if (!cleanupDisconnectedPlayers(code)) {
            console.log(`Room ${code} supprimée (timeout)`);
            continue;
        }

        // Supprimer les rooms inactives depuis trop longtemps
        if (now - room.lastUpdate > ROOM_TIMEOUT) {
            rooms.delete(code);
            console.log(`Room ${code} supprimée (inactivité)`);
        }
    }
}, 60000); // Toutes les minutes

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🎡 Serveur La Roue de la Fortune démarré sur le port ${PORT}`);
    console.log(`📡 Accédez au jeu sur http://localhost:${PORT}`);
});
