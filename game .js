// --- 1. GAME DATA SYSTEM CONFIGURATIONS ---
let coins = 0;
let currentMode = 'trainer';
let currentSkin = 'default';
let inMatch = false;

// Custom customizable key actions mapping configuration 
let keyBinds = {
    forward: 'W',
    left: 'A',
    backward: 'S',
    right: 'D',
    buildWall: 'Q',
    buildRamp: 'E'
};

const skinColors = { default: 0xff3333, neon: 0x00ffff, shadow: 0x222222 };
const activeMovementKeys = {};

// --- 2. INITIALIZE 3D GRAPHICS SCENE CONTEXT ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Defaults to high-quality beautiful sunny sky blue

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gameCanvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Natural Sunlight setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(50, 100, 50);
scene.add(sunLight);

// Create Lobby Visual Showcase Model 
const lobbyPreviewMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2, 1.2),
    new THREE.MeshStandardMaterial({ color: skinColors.default })
);
lobbyPreviewMesh.position.set(0, 0, -5);
scene.add(lobbyPreviewMesh);

// Position camera for the background lobby view looking down at the avatar
camera.position.set(0, 1, 0);
camera.lookAt(new THREE.Vector3(0, 0, -5));

// --- 3. CORE GENERIC MULTIPLAYER POOLS & VARIABLES ---
let terrainFloor = null;
const bulletsArray = [];
const botEntitiesArray = [];
const structuresArray = [];

let mouseIsLocked = false;
let cameraYaw = 0;
let cameraPitch = 0;
const sensitivityScaler = 0.0025;

// --- 4. LOBBY NAVIGATION & TRANSACTION LOGIC ---
function selectMode(modeName) {
    currentMode = modeName;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function selectSkin(skinName) {
    currentSkin = skinName;
    lobbyPreviewMesh.material.color.setHex(skinColors[skinName]);
    document.querySelectorAll('.skin-card').forEach(c => c.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

function buySkin(skinName, cost) {
    const card = document.getElementById(`skin-${skinName}`);
    if (card.classList.contains('owned')) {
        selectSkin(skinName);
        return;
    }
    if (coins >= cost) {
        coins -= cost;
        document.getElementById('coinCount').innerText = coins;
        card.classList.add('owned');
        card.querySelector('.price-tag').innerText = "[OWNED]";
        selectSkin(skinName);
    } else {
        alert("Not enough coins! Win 1v1 matches to collect more.");
    }
}

function updateBinds() {
    keyBinds.forward = document.getElementById('bind-forward').value.toUpperCase();
    keyBinds.left = document.getElementById('bind-left').value.toUpperCase();
    keyBinds.backward = document.getElementById('bind-backward').value.toUpperCase();
    keyBinds.right = document.getElementById('bind-right').value.toUpperCase();
    keyBinds.buildWall = document.getElementById('bind-wall').value.toUpperCase();
    keyBinds.buildRamp = document.getElementById('bind-ramp').value.toUpperCase();
}

// --- 5. INITIALIZE LIVE COMBAT ARENA ENVIRONMENT ---
function startGame() {
    inMatch = true;
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('crosshair').classList.remove('hidden');
    document.getElementById('gameHUD').classList.remove('hidden');
    document.getElementById('hudModeText').innerText = currentMode.toUpperCase();

    scene.remove(lobbyPreviewMesh); // Clear the static view model
    document.body.requestPointerLock(); // Activate secure local mouse tracker context
    
    generateArenaMap();
}

function generateArenaMap() {
    // 1. Choose Theme Color (Random selection)
    let groundColor = 0x3b7a57; // Default Grass Green
    if (currentMode === 'freebuild') {
        groundColor = Math.random() > 0.5 ? 0xffffff : 0x4f7942; // Randomly choose Snow (White) or Grass (Green)
    }

    // Build Floor Mesh
    const floorGeo = new THREE.PlaneGeometry(300, 300);
    const floorMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.8 });
    terrainFloor = new THREE.Mesh(floorGeo, floorMat);
    terrainFloor.rotation.x = -Math.PI / 2;
    scene.add(terrainFloor);

    // Reset Player Spawn Position inside the environment boundaries
    camera.position.set(0, 2, 0);
    cameraYaw = 0; cameraPitch = 0;

    // 2. Populate Entities According to selected Game Mode Rule paths
    if (currentMode === 'trainer') {
        document.getElementById('hudObjective').innerText = "Shoot targets. Bots move and jump!";
        // Spawn standard Static Practice Target Dummies
        for(let i=0; i<15; i++) spawnBotEntity(true); 
        // Spawn active Moving / Jumping Tracker Bots
        for(let i=0; i<5; i++) spawnBotEntity(false);
    } else if (currentMode === '1v1') {
        document.getElementById('hudObjective').innerText = "Eliminate the Sweaty Bot to win 10 coins!";
        spawnBotEntity(false, true); // Spawn a super aggressive high health opponent
    } else {
        document.getElementById('hudObjective').innerText = "Build Mode Active. Use keybinds to construct objects.";
    }
}

// Spawn Engine Function for Enemy Entities
function spawnBotEntity(isStaticDummy = false, isSweatySweat = false) {
    const height = 2;
    const geo = new THREE.BoxGeometry(1, height, 1);
    const mat = new THREE.MeshStandardMaterial({ color: isSweatySweat ? 0xff0055 : (isStaticDummy ? 0xffaa00 : 0x9900ff) });
    const bot = new THREE.Mesh(geo, mat);

    // Randomize initial coordinate vectors
    const range = isSweatySweat ? 15 : 40;
    bot.position.set((Math.random() - 0.5) * range, height/2, -Math.random() * range - 5);
    
    // Attach behavior fields
    bot.userData = {
        isDummy: isStaticDummy,
        isSweat: isSweatySweat,
        health: isSweatySweat ? 100 : 30,
        moveDir: new THREE.Vector3((Math.random()-0.5), 0, (Math.random()-0.5)).normalize(),
        speed: isSweatySweat ? 0.12 : 0.05,
        velocityUp: 0,
        jumpTimer: Math.random() * 100
    };

    scene.add(bot);
    botEntitiesArray.push(bot);
}

// --- 6. PLAYER ACTIONS (POINTER LOCK, MOVEMENT, SHOOTING, & BUILDING) ---
document.addEventListener('pointerlockchange', () => {
    mouseIsLocked = (document.pointerLockElement === document.body);
    if (!mouseIsLocked && inMatch) {
        exitToLobby(); // Auto-safeguard fallback context route out
    }
});

// Capture and process mouse look movements
document.addEventListener('mousemove', (e) => {
    if (!mouseIsLocked) return;
    cameraYaw -= e.movementX * sensitivityScaler;
    cameraPitch -= e.movementY * sensitivityScaler;
    cameraPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, cameraPitch));

    camera.rotation.order = "YXZ";
    camera.rotation.y = cameraYaw;
    camera.rotation.x = cameraPitch;
});

// Map standard keyboard keystroke handlers to runtime memory cache
window.addEventListener('keydown', (e) => {
    const code = e.key.toUpperCase();
    activeMovementKeys[code] = true;

    // Trigger Building placement dynamically
    if (inMatch) {
        if (code === keyBinds.buildWall) placeStructure('wall');
        if (code === keyBinds.buildRamp) placeStructure('ramp');
    }
});
window.addEventListener('keyup', (e) => { activeMovementKeys[e.key.toUpperCase()] = false; });

// Handle Shooting/Click mechanisms
window.addEventListener('mousedown', (e) => {
    if (!mouseIsLocked || !inMatch || e.button !== 0) return;

    // Build Projectile Line path
    const bGeo = new THREE.SphereGeometry(0.15, 6, 6);
    const bMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const bullet = new THREE.Mesh(bGeo, bMat);
    bullet.position.copy(camera.position);

    // Track direction vector directly off look angles
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    bullet.userData = { dir: dir };

    scene.add(bullet);
    bulletsArray.push(bullet);
});

// Building Grid Engine Mechanic
function placeStructure(type) {
    const size = 4;
    // Pin structural position ahead of player view vector coordinates
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const targetPos = new THREE.Vector3().copy(camera.position).addScaledVector(forward, 4);

    // Snap to standard uniform Fortnite style block coordinate matrices
    const snapX = Math.round(targetPos.x / size) * size;
    const snapZ = Math.round(targetPos.z / size) * size;
    let snapY = Math.max(0.5, Math.round(targetPos.y / size) * size);

    let structGeo;
    if (type === 'wall') {
        structGeo = new THREE.BoxGeometry(size, size, 0.2);
    } else { // Ramp build setup
        structGeo = new THREE.BoxGeometry(size, 0.2, size * 1.4);
    }

    const structMat = new THREE.MeshStandardMaterial({ color: 0xbc8f8f, roughness: 0.6 });
    const structure = new THREE.Mesh(structGeo, structMat);
    structure.position.set(snapX, snapY + (type === 'wall' ? 1.5 : 0), snapZ);
    
    if (type === 'ramp') {
        structure.rotation.x = Math.PI / 4; // Angle the ramp up at 45 degrees
    }

    scene.add(structure);
    structuresArray.push(structure);
}

// --- 7. CORE TICK ANIMATION FRAME LOOP PROCESSING ENGINE ---
function animate() {
    requestAnimationFrame(animate);

    if (inMatch && mouseIsLocked) {
        // Compute movements relative to local tracking yaw angles
        const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        forwardVec.y = 0; forwardVec.normalize();
        const rightVec = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
