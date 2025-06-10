import * as THREE from 'three';

// import gambar dari folder src/textures
import skyImg       from './textures/sky.png';
import mountainsImg from './textures/mountains.png';
import cloudsImg    from './textures/clouds.png';
import hillsImg     from './textures/hills.png';

// — SETUP SCENE, CAMERA, RENDERER —
const scene = new THREE.Scene();
const aspect = window.innerWidth / window.innerHeight;
const camera = new THREE.OrthographicCamera(
  -aspect * 10, aspect * 10,
   10, -10,
   0.1, 100
);
camera.position.z = 10;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// ① Buat langit langsung lewat clearColor (bukan mesh)
renderer.setClearColor(0x87ceeb);
// atau: scene.background = new THREE.Color(0x87ceeb);

document.body.appendChild(renderer.domElement);

// Array background layer
const bgLayers = [];

// Fungsi helper untuk membuat layer ber‐texture
function createTextureLayer(texture, width, height, yPos, depth, speedFactor, repeatX = 1) {
  // atur agar texture bisa diulang
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, 1);

  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, yPos, depth);
  scene.add(mesh);
  bgLayers.push({ mesh, speedFactor });
}

// — 1) Load semua texture dulu —
const loader = new THREE.TextureLoader();
const skyTex       = loader.load(skyImg);
const mountainsTex = loader.load(mountainsImg);
const cloudsTex    = loader.load(cloudsImg);
const hillsTex     = loader.load(hillsImg);

// — 2) Buat layer dari texture —
// Lebar plane harus cukup untuk cover area; repeatX = how many times tile in X
createTextureLayer(skyTex,       200, 200,   0,  -50, 0,   2);   // sky dua kali tile
createTextureLayer(mountainsTex, 300,  50,  -2,  -40, 0.1, 3);   // gunung 3x tile
createTextureLayer(cloudsTex,    300,  30,   6,  -30, 0.3, 4);   // awan 4x tile
createTextureLayer(hillsTex,     300,  40,  -6,  -20, 0.5, 2);   // bukit 2x tile

// — SCORE UI —
let score = 0;
const scoreEl = document.getElementById('score');
function updateScore() {
  scoreEl.textContent = `Score: ${score}`;
}

// — PLAYER —
const playerSize = 1;
const player = new THREE.Mesh(
  new THREE.BoxGeometry(playerSize, playerSize, 0.1),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
player.position.set(0, 2, 0);
scene.add(player);

// — PLATFORMS —
const platforms = [];
function createPlatform(x, y, width = 5, height = 0.5, color = 0x654321) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, 0.1),
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.set(x, y, 0);
  scene.add(mesh);
  platforms.push({ mesh, width, height });
}
// ground & platforms
createPlatform(0, -1, 40, 1, 0x00aa00);
createPlatform(5, 2);
createPlatform(10, 4);
createPlatform(15, 1);

// — COINS —
const coins = [];
function createCoin(x, y) {
  const geo = new THREE.CircleGeometry(0.3, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
  const coin = new THREE.Mesh(geo, mat);
  coin.position.set(x, y, 0);
  scene.add(coin);
  coins.push(coin);
}
// letakkan koin
createCoin(5, 2 + 0.8);
createCoin(10, 4 + 0.8);
createCoin(12, 4 + 0.8);
createCoin(15, 1 + 0.8);

// — ENEMY —
const enemySize = 1;
const enemy = new THREE.Mesh(
  new THREE.BoxGeometry(enemySize, enemySize, 0.1),
  new THREE.MeshBasicMaterial({ color: 0x0000ff })
);
enemy.position.set(8, 1 + enemySize/2, 0);
scene.add(enemy);
let enemyDir = 1, enemySpeed = 0.05;
const leftBound = 5, rightBound = 10;

// — GAME STATE & INPUT —
let velocityY = 0, gravity = -0.03;
let isOnGround = false, gameOver = false;
const keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup',   e => keys[e.key] = false);

// — GAME LOOP —
function animate() {
  requestAnimationFrame(animate);
  if (gameOver) return;

  // — PARALLAX BACKGROUND UPDATE —
  bgLayers.forEach(({ mesh, speedFactor }) => {
    mesh.position.x = camera.position.x * speedFactor;
  });

  // — HORIZONTAL MOVE & SIDE COLLISION —
  let deltaX = 0;
  if (keys['ArrowRight']) deltaX = 0.2;
  if (keys['ArrowLeft'])  deltaX = -0.2;
  if (deltaX !== 0) {
    const prevX = player.position.x, newX = prevX + deltaX;
    const halfP = playerSize/2, topYp = player.position.y + halfP, botYp = player.position.y - halfP;
    let blocked = false;
    for (let { mesh, width, height } of platforms) {
      const halfH = height/2, topY = mesh.position.y + halfH, botY = mesh.position.y - halfH;
      const leftX = mesh.position.x - width/2, rightX = mesh.position.x + width/2;
      if (topYp > botY && botYp < topY) {
        const prevR = prevX+halfP, prevL = prevX-halfP;
        const newR  = newX+halfP, newL  = newX-halfP;
        if (deltaX>0 && prevR<=leftX && newR>leftX) { blocked=true; break; }
        if (deltaX<0 && prevL>=rightX && newL<rightX) { blocked=true; break; }
      }
    }
    if (!blocked) player.position.x = newX;
  }

  // — JUMP —
  if (keys[' '] && isOnGround) { velocityY = 0.6; isOnGround = false; }

  // — GRAVITY & HEAD-BUMP —
  const prevY = player.position.y;
  velocityY += gravity;
  player.position.y += velocityY;
  const halfP = playerSize/2, pLeft = player.position.x-halfP, pRight = player.position.x+halfP;
  if (velocityY > 0) {
    for (let { mesh, width, height } of platforms) {
      const halfH = height/2, bottomY = mesh.position.y-halfH;
      const pTopPrev = prevY+halfP, pTop = player.position.y+halfP;
      const leftX = mesh.position.x-width/2, rightX = mesh.position.x+width/2;
      if (pTopPrev<=bottomY && pTop>=bottomY && pRight>leftX && pLeft<rightX) {
        player.position.y = bottomY - halfP;
        velocityY = 0;
        break;
      }
    }
  }

  // — FALL-OFF DETECTION —
  if (player.position.y < -10) { console.log('Game Over: You fell!'); gameOver = true; return; }

  // — ENEMY MOVE —
  enemy.position.x += enemyDir * enemySpeed;
  if (enemy.position.x > rightBound || enemy.position.x < leftBound) enemyDir *= -1;

  // — LANDING COLLISION —
  isOnGround = false;
  for (let { mesh, width, height } of platforms) {
    const halfH = height/2, topY = mesh.position.y+halfH;
    const leftX = mesh.position.x-width/2, rightX = mesh.position.x+width/2;
    const botPrev = prevY-halfP, botNow = player.position.y-halfP;
    if (botPrev>=topY && botNow<=topY && player.position.x+halfP>leftX && player.position.x-halfP<rightX && velocityY<=0) {
      player.position.y = topY+halfP;
      velocityY = 0; isOnGround = true;
      break;
    }
  }

  // — COIN COLLECTION —
  const playerBox = new THREE.Box3().setFromObject(player);
  for (let i = coins.length-1; i >= 0; i--) {
    const coinBox = new THREE.Box3().setFromObject(coins[i]);
    if (playerBox.intersectsBox(coinBox)) {
      scene.remove(coins[i]); coins.splice(i,1);
      score += 10; updateScore();
    }
  }

  // — ENEMY COLLISION —
  const enemyBox = new THREE.Box3().setFromObject(enemy);
  if (playerBox.intersectsBox(enemyBox)) {
    console.log('Game Over: Hit enemy!'); gameOver = true; return;
  }

  // — CAMERA FOLLOW & RENDER —
  camera.position.x = player.position.x;
  renderer.render(scene, camera);
}

animate();
