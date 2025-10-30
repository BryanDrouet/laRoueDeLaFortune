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

        const segmentAngle = 360 / this.segments.length;
        const halfSegmentAngle = segmentAngle / 2;

        this.segments.forEach((segment, index) => {
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'wheel-segment';
            segmentDiv.style.background = segment.color;
            segmentDiv.style.clipPath = this.getClipPath(index);

            const textDiv = document.createElement('div');
            textDiv.className = 'segment-text';
            textDiv.textContent = segment.value;
            textDiv.style.transform = `translateX(-50%) rotate(${halfSegmentAngle + (index * segmentAngle)}deg)`;
            
            // Ajuster la couleur du texte pour la lisibilité
            if (segment.color === '#FFFFFF' || segment.color === '#FFDD00' || segment.color === '#FFD700') {
                textDiv.style.color = '#000000';
            }

            segmentDiv.appendChild(textDiv);
            this.wheelElement.appendChild(segmentDiv);
        });
    }

    // Calculer le clip-path pour chaque segment (dynamique selon le nombre de segments)
    getClipPath(index) {
        const angle = 360 / this.segments.length;
        const startAngle = 0;
        const endAngle = angle;
        
        const startX = 50 + 50 * Math.sin((startAngle * Math.PI) / 180);
        const startY = 50 - 50 * Math.cos((startAngle * Math.PI) / 180);
        const endX = 50 + 50 * Math.sin((endAngle * Math.PI) / 180);
        const endY = 50 - 50 * Math.cos((endAngle * Math.PI) / 180);

        return `polygon(50% 50%, ${startX}% ${startY}%, ${endX}% ${endY}%)`;
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
