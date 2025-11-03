// ====================================
// WHEEL.JS - Animation de la roue
// ====================================

export class WheelManager {
    constructor() {
        this.segments = [];
        this.isSpinning = false;
        this.wheelElement = null;
        this.init();
    }

    async init() {
        await this.loadSegments();
    }

    async loadSegments() {
        try {
            const response = await fetch('data/wheel-segments.json');
            const data = await response.json();
            // Ne pas mélanger ici, ce sera fait par GameEngine au début de chaque manche
            this.segments = data.segments;
        } catch (error) {
            // propagate error so caller (app) can show to player
            throw new Error('Erreur chargement segments: ' + (error?.message || error));
        }
    }

    // Mélanger un tableau aléatoirement (algorithme Fisher-Yates)
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Créer les segments de la roue
    createWheel(containerId) {
        this.wheelElement = document.getElementById(containerId);
        if (!this.wheelElement) return;

        this.wheelElement.innerHTML = '';

        const numSegments = this.segments.length;
        const segmentAngle = 360 / numSegments;

        this.segments.forEach((segment, index) => {
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'wheel-segment';
            segmentDiv.style.background = segment.color;
            
            // Appliquer la rotation du segment
            const rotation = index * segmentAngle;
            segmentDiv.style.transform = `rotate(${rotation}deg)`;
            
            // Calculer le clip-path pour créer une portion de tarte
            segmentDiv.style.clipPath = this.getClipPath(segmentAngle);

            const textDiv = document.createElement('div');
            textDiv.className = 'segment-text';
            textDiv.textContent = segment.value;
            
            // Ajuster la couleur du texte pour la lisibilité
            const lightColors = ['#FFFFFF', '#FFDD00', '#FFD700', '#FBB03B', '#92D050', '#00B0F0', '#FF9800'];
            if (lightColors.includes(segment.color)) {
                textDiv.style.color = '#000000';
            }

            segmentDiv.appendChild(textDiv);
            this.wheelElement.appendChild(segmentDiv);
        });
    }

    // Calculer le clip-path pour chaque segment (portion de tarte)
    getClipPath(segmentAngle) {
        // Créer une portion de tarte du centre vers le bord
        // Utiliser un angle légèrement plus petit pour créer un léger espace entre les segments
        const adjustedAngle = segmentAngle * 0.98; // 98% pour un léger espacement
        
        const endX = 50 + 50 * Math.sin((adjustedAngle * Math.PI) / 180);
        const endY = 50 - 50 * Math.cos((adjustedAngle * Math.PI) / 180);

        return `polygon(50% 50%, 50% 0%, ${endX}% ${endY}%)`;
    }

    // Faire tourner la roue
    spin(callback) {
        if (this.isSpinning || !this.wheelElement) return;

        this.isSpinning = true;

        // Choisir un segment aléatoire
        const randomIndex = Math.floor(Math.random() * this.segments.length);
        const selectedSegment = this.segments[randomIndex];

        // Calculer l'angle de rotation (dynamique selon le nombre de segments)
        const segmentAngle = 360 / this.segments.length;
        const targetAngle = randomIndex * segmentAngle;
        const spins = 5; // Nombre de tours complets
        const totalRotation = (360 * spins) + (360 - targetAngle) + (segmentAngle / 2);

        // Appliquer la rotation
        this.wheelElement.style.transform = `rotate(${totalRotation}deg)`;

        // Attendre la fin de l'animation
        setTimeout(() => {
            this.isSpinning = false;
            if (callback) {
                callback(selectedSegment);
            }
        }, 4000);
    }

    // Réinitialiser la roue
    reset() {
        if (this.wheelElement) {
            this.wheelElement.style.transform = 'rotate(0deg)';
        }
    }
}
