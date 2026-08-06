// Rapido Arcade Bike Taxi Game Engine (60 FPS HTML5 Canvas Physics)

const WORLD_SIZE = 3200;

// Game State Store
const gameState = {
    isRunning: false,
    isPaused: false,
    money: 0,
    passengersServed: 0,
    timeLeft: 180,
    rating: 5.0,
    timerInterval: null,
    
    // Upgrades
    equippedBike: 'standard', // 'standard', 'ev', 'hyper'
    unlockedBikes: ['standard', 'ev', 'hyper'],

    // Floating FX Text popups
    popups: [],
    particles: []
};

// Player Rapido Bike Object
const player = {
    x: 1600,
    y: 1600,
    vx: 0,
    vy: 0,
    angle: 0,
    speed: 0,
    maxSpeed: 8.5,
    accel: 0.35,
    friction: 0.96,
    steerSpeed: 0.055,
    nitro: 100,
    maxNitro: 100,
    health: 100,
    isNitroActive: false,
    hasPassenger: false
};

// Keys pressed
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    nitro: false
};

// Target Mission Data (Passenger / Drop point)
const targetMission = {
    type: 'PICKUP', // 'PICKUP' or 'DROP'
    passengerName: 'Rahul Sharma',
    x: 1800,
    y: 1400,
    fare: 120,
    radius: 50
};

// Traffic Vehicles
let trafficCars = [];

// Canvas & Context setup
let canvas, ctx;

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupInputListeners();
    setupTouchListeners();
    initTrafficCars();
    spawnNewPassenger();
});

function resizeCanvas() {
    if (!canvas) return;
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}

// Keyboard Listeners
function setupInputListeners() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
        if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.nitro = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.up = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.down = false;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
        if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.nitro = false;
    });
}

// Touch Button Listeners
function setupTouchListeners() {
    const bindTouch = (id, keyName) => {
        const btn = document.getElementById(id);
        if (!btn) return;

        const start = (e) => { e.preventDefault(); keys[keyName] = true; btn.classList.add('pressed'); };
        const end = (e) => { e.preventDefault(); keys[keyName] = false; btn.classList.remove('pressed'); };

        btn.addEventListener('touchstart', start);
        btn.addEventListener('touchend', end);
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
    };

    bindTouch('btn-touch-up', 'up');
    bindTouch('btn-touch-down', 'down');
    bindTouch('btn-touch-left', 'left');
    bindTouch('btn-touch-right', 'right');
    bindTouch('btn-touch-nitro', 'nitro');
}

// Generate Traffic AI Cars
function initTrafficCars() {
    trafficCars = [];
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#A855F7', '#F59E0B'];

    for (let i = 0; i < 16; i++) {
        trafficCars.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            angle: Math.floor(Math.random() * 4) * (Math.PI / 2),
            speed: 2 + Math.random() * 3,
            color: colors[i % colors.length],
            width: 50,
            height: 26
        });
    }
}

// Spawn Passenger Location
function spawnNewPassenger() {
    const names = ['Rahul Sharma', 'Priya Patel', 'Ankit Verma', 'Sneha Reddy', 'Vikram Das', 'Kavya Nair'];
    targetMission.type = 'PICKUP';
    targetMission.passengerName = names[Math.floor(Math.random() * names.length)];

    // Place passenger on random road location
    targetMission.x = 400 + Math.random() * (WORLD_SIZE - 800);
    targetMission.y = 400 + Math.random() * (WORLD_SIZE - 800);
    targetMission.fare = Math.floor(80 + Math.random() * 100);

    player.hasPassenger = false;
}

function spawnDropDestination() {
    targetMission.type = 'DROP';
    targetMission.x = 400 + Math.random() * (WORLD_SIZE - 800);
    targetMission.y = 400 + Math.random() * (WORLD_SIZE - 800);
}

// Start Main Game Loop
function startGameLoop() {
    document.getElementById('start-game-modal').classList.remove('active');
    gameState.isRunning = true;
    gameState.isPaused = false;

    window.soundManager.startEngine();

    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(() => {
        if (gameState.isRunning && !gameState.isPaused) {
            gameState.timeLeft--;
            document.getElementById('hud-timer').innerText = `${gameState.timeLeft}s`;
            if (gameState.timeLeft <= 0) {
                gameOver();
            }
        }
    }, 1000);

    requestAnimationFrame(gameUpdateLoop);
}

// Main Frame Loop
function gameUpdateLoop() {
    if (gameState.isRunning && !gameState.isPaused) {
        updatePhysics();
        updateTraffic();
        checkTargetInteractions();
        updateHUD();
    }

    renderGameCanvas();

    if (gameState.isRunning) {
        requestAnimationFrame(gameUpdateLoop);
    }
}

// Physics & Controls Update
function updatePhysics() {
    // Top Speed based on bike model
    let currentMaxSpeed = player.maxSpeed;
    if (gameState.equippedBike === 'ev') currentMaxSpeed = 11.0;
    if (gameState.equippedBike === 'hyper') currentMaxSpeed = 14.0;

    // Nitro Boost
    if (keys.nitro && player.nitro > 5) {
        currentMaxSpeed *= 1.45;
        player.nitro -= 0.8;
        player.isNitroActive = true;
        window.soundManager.playNitroSound();

        // Create Nitro Particle
        gameState.particles.push({
            x: player.x - Math.cos(player.angle) * 20,
            y: player.y - Math.sin(player.angle) * 20,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            radius: 5 + Math.random() * 5,
            color: '#00E5FF',
            life: 1.0
        });
    } else {
        player.isNitroActive = false;
        if (player.nitro < player.maxNitro) player.nitro += 0.15; // Slow regen
    }

    // Acceleration / Braking
    if (keys.up) {
        player.speed = Math.min(player.speed + player.accel, currentMaxSpeed);
    } else if (keys.down) {
        player.speed = Math.max(player.speed - player.accel, -currentMaxSpeed * 0.4);
    } else {
        player.speed *= player.friction;
    }

    // Steering (Steer only when moving)
    if (Math.abs(player.speed) > 0.2) {
        const steerDir = player.speed >= 0 ? 1 : -1;
        if (keys.left) player.angle -= player.steerSpeed * steerDir;
        if (keys.right) player.angle += player.steerSpeed * steerDir;
    }

    // Move player
    player.x += Math.cos(player.angle) * player.speed;
    player.y += Math.sin(player.angle) * player.speed;

    // World Boundary check
    player.x = Math.max(100, Math.min(WORLD_SIZE - 100, player.x));
    player.y = Math.max(100, Math.min(WORLD_SIZE - 100, player.y));

    // Update audio engine pitch
    const speedRatio = Math.abs(player.speed) / currentMaxSpeed;
    window.soundManager.updateEnginePitch(speedRatio);
}

// Traffic Cars Logic & Collision
function updateTraffic() {
    trafficCars.forEach(car => {
        car.x += Math.cos(car.angle) * car.speed;
        car.y += Math.sin(car.angle) * car.speed;

        // Wrap around boundary
        if (car.x < 100) car.x = WORLD_SIZE - 100;
        if (car.x > WORLD_SIZE - 100) car.x = 100;
        if (car.y < 100) car.y = WORLD_SIZE - 100;
        if (car.y > WORLD_SIZE - 100) car.y = 100;

        // Collision detection with player bike
        const dist = Math.hypot(player.x - car.x, player.y - car.y);
        if (dist < 38) {
            // Impact!
            window.soundManager.playCrashSound();
            player.speed = -player.speed * 0.5;
            player.health = Math.max(0, player.health - 12);
            gameState.rating = Math.max(3.0, (gameState.rating - 0.1).toFixed(1));

            // Floating Text
            addFloatingText("CRASH! -12 HP", player.x, player.y, '#EF4444');

            // Knockback car slightly
            car.x += Math.cos(player.angle) * 20;
            car.y += Math.sin(player.angle) * 20;
        }
    });
}

// Pickup & Drop Interactions
function checkTargetInteractions() {
    const distToTarget = Math.hypot(player.x - targetMission.x, player.y - targetMission.y);

    if (distToTarget < targetMission.radius) {
        if (targetMission.type === 'PICKUP') {
            // Pick up passenger!
            window.soundManager.playPickupSound();
            player.hasPassenger = true;
            addFloatingText(`PASSENGER ONBOARD!`, player.x, player.y, '#FFC600');
            spawnDropDestination();
        } else if (targetMission.type === 'DROP') {
            // Complete Drop!
            window.soundManager.playCashSound();
            gameState.money += targetMission.fare;
            gameState.passengersServed++;
            player.nitro = Math.min(100, player.nitro + 40);
            gameState.rating = Math.min(5.0, (parseFloat(gameState.rating) + 0.1).toFixed(1));

            addFloatingText(`+₹${targetMission.fare}! RIDE COMPLETED`, player.x, player.y, '#10B981');
            spawnNewPassenger();
        }
    }
}

// Add Floating Popup Text
function addFloatingText(text, x, y, color) {
    gameState.popups.push({
        text, x, y, color, opacity: 1.0, life: 60
    });
}

// Update HUD & Compass
function updateHUD() {
    document.getElementById('hud-money').innerText = `₹${gameState.money}`;
    document.getElementById('hud-passengers').innerText = gameState.passengersServed;
    document.getElementById('hud-rating').innerText = `⭐ ${gameState.rating}`;
    document.getElementById('hud-speed').innerText = Math.round(Math.abs(player.speed) * 12);

    document.getElementById('nitro-bar-fill').style.width = `${player.nitro}%`;
    document.getElementById('nitro-pct-text').innerText = `${Math.round(player.nitro)}%`;

    document.getElementById('health-bar-fill').style.width = `${player.health}%`;
    document.getElementById('health-pct-text').innerText = `${Math.round(player.health)}%`;

    // Navigation Compass Arrow Math
    const dx = targetMission.x - player.x;
    const dy = targetMission.y - player.y;
    const distMeters = Math.round(Math.hypot(dx, dy));
    const targetAngle = Math.atan2(dy, dx) * 180 / Math.PI;

    const arrowIcon = document.getElementById('compass-arrow-icon');
    const targetText = document.getElementById('compass-target-text');

    if (arrowIcon) arrowIcon.style.transform = `rotate(${targetAngle + 45}deg)`;
    if (targetText) {
        const actionLabel = targetMission.type === 'PICKUP' ? `Pickup ${targetMission.passengerName}` : `Dropoff Checkpoint`;
        targetText.innerText = `${actionLabel} • ${distMeters}m`;
    }
}

// Canvas Render Engine
function renderGameCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Camera center on player
    ctx.translate(canvas.width / 2 - player.x, canvas.height / 2 - player.y);

    // 1. Draw World Background & Grid Asphalt Roads
    drawCityMap();

    // 2. Draw Target Mission Rings (Pickup / Drop)
    drawTargetCheckpoints();

    // 3. Draw Traffic AI Cars
    drawTrafficCars();

    // 4. Draw Player Bike
    drawPlayerBike();

    // 5. Draw Particles & Text Popups
    drawParticlesAndPopups();

    ctx.restore();
}

// Draw Procedural City Terrain & Grid Roads
function drawCityMap() {
    // Grass Ground
    ctx.fillStyle = '#0F1923';
    ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

    // Draw Grid Roads
    ctx.fillStyle = '#1A2332';
    const roadWidth = 160;
    const gridSpacing = 600;

    for (let x = 0; x < WORLD_SIZE; x += gridSpacing) {
        ctx.fillRect(x, 0, roadWidth, WORLD_SIZE);
    }
    for (let y = 0; y < WORLD_SIZE; y += gridSpacing) {
        ctx.fillRect(0, y, WORLD_SIZE, roadWidth);
    }

    // Road Dash Lines
    ctx.strokeStyle = 'rgba(255, 198, 0, 0.4)';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);

    for (let x = 0; x < WORLD_SIZE; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x + roadWidth / 2, 0);
        ctx.lineTo(x + roadWidth / 2, WORLD_SIZE);
        ctx.stroke();
    }
    for (let y = 0; y < WORLD_SIZE; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y + roadWidth / 2);
        ctx.lineTo(WORLD_SIZE, y + roadWidth / 2);
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset line dash
}

// Draw Target Checkpoints
function drawTargetCheckpoints() {
    ctx.save();
    ctx.translate(targetMission.x, targetMission.y);

    const color = targetMission.type === 'PICKUP' ? '#FFC600' : '#EF4444';

    // Glowing Pulse Ring
    const time = Date.now() * 0.005;
    const pulseRadius = targetMission.radius + Math.sin(time) * 8;

    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;

    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center Pin Icon
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draw Traffic Cars
function drawTrafficCars() {
    trafficCars.forEach(car => {
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);

        ctx.fillStyle = car.color;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillRect(-car.width / 2, -car.height / 2, car.width, car.height);

        // Windshield
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-car.width / 4, -car.height / 2 + 3, car.width / 3, car.height - 6);

        ctx.restore();
    });
}

// Draw Player Rapido Bike
function drawPlayerBike() {
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    // Bike Body Color based on equipped bike
    let bikeColor = '#FFC600';
    if (gameState.equippedBike === 'ev') bikeColor = '#00E5FF';
    if (gameState.equippedBike === 'hyper') bikeColor = '#EF4444';

    // Wheels
    ctx.fillStyle = '#000';
    ctx.fillRect(-18, -12, 10, 6);
    ctx.fillRect(-18, 6, 10, 6);
    ctx.fillRect(10, -12, 10, 6);
    ctx.fillRect(10, 6, 10, 6);

    // Bike Body Chassis
    ctx.fillStyle = bikeColor;
    ctx.shadowColor = bikeColor;
    ctx.shadowBlur = player.isNitroActive ? 25 : 10;
    ctx.fillRect(-16, -9, 32, 18);

    // Captain Helmet Top-down
    ctx.fillStyle = '#FFC600';
    ctx.beginPath();
    ctx.arc(-2, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Passenger if onboard
    if (player.hasPassenger) {
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(-12, 0, 7, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

// Render Particles & Popups
function drawParticlesAndPopups() {
    // Particles
    for (let i = gameState.particles.length - 1; i >= 0; i--) {
        const p = gameState.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;

        if (p.life <= 0) {
            gameState.particles.splice(i, 1);
            continue;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // Floating Text Popups
    for (let i = gameState.popups.length - 1; i >= 0; i--) {
        const txt = gameState.popups[i];
        txt.y -= 1.2;
        txt.life--;

        if (txt.life <= 0) {
            gameState.popups.splice(i, 1);
            continue;
        }

        ctx.fillStyle = txt.color;
        ctx.font = "900 16px Outfit";
        ctx.textAlign = "center";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 8;
        ctx.fillText(txt.text, txt.x, txt.y);
    }
}

// Game Controls & Modals
function togglePauseGame() {
    gameState.isPaused = !gameState.isPaused;
}

function toggleGameAudio() {
    const isMuted = window.soundManager.toggleMute();
    document.getElementById('audio-icon').className = isMuted ? 'fa-solid fa-volume-xmark' : 'fa-solid fa-volume-high';
}

function openGarageModal() {
    gameState.isPaused = true;
    document.getElementById('garage-modal').classList.add('active');
}

function closeGarageModal() {
    document.getElementById('garage-modal').classList.remove('active');
    gameState.isPaused = false;
}

function equipBike(type) {
    gameState.equippedBike = type;
    document.querySelectorAll('.garage-card').forEach(c => c.classList.remove('equipped'));
    document.getElementById(`bike-card-${type}`).classList.add('equipped');
}

function buyOrEquipBike(type, cost) {
    equipBike(type);
}

function gameOver() {
    gameState.isRunning = false;
    window.soundManager.stopEngine();

    document.getElementById('final-earnings').innerText = `₹${gameState.money}`;
    document.getElementById('final-passengers').innerText = gameState.passengersServed;
    document.getElementById('final-rating').innerText = `⭐ ${gameState.rating}`;

    document.getElementById('game-over-modal').classList.add('active');
}

function restartGame() {
    document.getElementById('game-over-modal').classList.remove('active');
    gameState.money = 0;
    gameState.passengersServed = 0;
    gameState.timeLeft = 180;
    gameState.rating = 5.0;
    player.health = 100;
    player.nitro = 100;
    player.x = 1600;
    player.y = 1600;
    player.speed = 0;

    startGameLoop();
}
