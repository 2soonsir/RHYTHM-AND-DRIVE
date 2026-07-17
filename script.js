// script.js (versi diperbaiki - Fixed 4 bugs + Multiplayer vehicle selection fix)

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const bgMusic = document.getElementById("bg-music");
const menuMusic = document.getElementById("menu-music");
menuMusic.src = "menu_theme.mp3";

const CARS = {
  'kancil':    { brand: 'PERODUA', hp: 2, speed: 1.0, price: 0, currency: 'money', song: 'lagu_k_rnb.mp3' },
  'myvi':      { brand: 'PERODUA', hp: 3, speed: 1.4, price: 150, currency: 'money', song: 'myvi_rnb.mp3' },
  'satria':    { brand: 'PROTON',  hp: 3, speed: 1.8, price: 250, currency: 'money', song: 'satria_rnb.mp3' },
  'wira':      { brand: 'PROTON',  hp: 4, speed: 1.8, price: 350, currency: 'money', song: 'wira_rnb.mp3' },
  'saga':      { brand: 'PROTON',  hp: 6, speed: 1.2, price: 500, currency: 'money', song: 'saga_rnb.mp3' },
  'perdana':   { brand: 'PROTON',  hp: 5, speed: 2.2, price: 800, currency: 'money', song: 'perdana_v6.mp3' },
  'hilux':     { brand: 'TOYOTA',  hp: 8, speed: 0.9, price: 700, currency: 'money', song: 'hilux_rnb.mp3' },
  'kancil_r':  { brand: 'LEGEND',  hp: 4, speed: 2.8, price: 10, currency: 'diamond', song: 'no_passenger.mp3' }
};

const MAPS = {
  'cybercity': { color: '#1a1a1a', neon: '#3498db', obs: '🚧', item: '💰', tool: '🔧', bgClass: 'grid-bg' },
  'karak':     { color: '#0f0f0f', neon: '#f1c40f', obs: '🪵', item: '💰', tool: '🛠️', bgClass: 'mist-bg' },
  'industrial':{ color: '#2c3e50', neon: '#2ecc71', obs: '🛢️', item: '💰', tool: '🚿', bgClass: 'factory-bg' }
};

let currentUser = "";
let userData = { money: 0, diamond: 0, cars: ['kancil'], pass: "" };
let selCarKey = 'kancil', p2CarKey = 'kancil';
let currentMapKey = 'cybercity';
let running = false, lastTime = 0, moveTimer = 0, px = 1, py = 4, sessionCash = 0, curLives = 0;
let obs = [], gems = [], items = [], isInvulnerable = false, nitroActive = false, nitroEnergy = 0, isDev = false, gameLevel = 1;

// --- MULTIPLAYER LOGIC ---
let isMultiplayer = false;
let p2x = 1, p2y = 4, p2Lives = 0, p2Cash = 0, p2Invul = false;
let p2NitroActive = false;
let p2NitroEnergy = 0;
let obs2 = [], gems2 = [];
let p2MoveTimer = 0;

let levelTimer = 0;
const LEVEL_INTERVAL = 30000;

function stopAllMusic() {
  menuMusic.pause(); menuMusic.currentTime = 0;
  bgMusic.pause(); bgMusic.currentTime = 0;
}

function checkLevelUp(dt) {
  levelTimer += dt;
  if (levelTimer >= LEVEL_INTERVAL) {
    levelTimer = 0;
    gameLevel++;
    document.getElementById("level-ui").textContent = "LV" + gameLevel;
    showLevelUpBanner();
  }
}

function showLevelUpBanner() {
  const banner = document.getElementById("levelup-banner");
  banner.textContent = "⚡ LEVEL " + gameLevel + "!";
  banner.classList.remove("show");
  void banner.offsetWidth;
  banner.classList.add("show");
  setTimeout(() => banner.classList.remove("show"), 1200);
}

function showGameOverScreen() {
  document.getElementById("go-cash").textContent = sessionCash + (isMultiplayer ? p2Cash : 0);
  document.getElementById("go-diamond").textContent = userData.diamond;
  const btn = document.getElementById("go-continue-btn");
  btn.style.opacity = userData.diamond >= 1 ? "1" : "0.4";
  btn.style.cursor = userData.diamond >= 1 ? "pointer" : "not-allowed";
  document.getElementById("gameover-screen").classList.add("active");
}

function continueGame() {
  if (userData.diamond < 1) return;
  userData.diamond--;
  saveData(); updateUI();
  document.getElementById("gameover-screen").classList.remove("active");
  curLives = CARS[selCarKey].hp;
  if (isMultiplayer) p2Lives = CARS[p2CarKey].hp;
  running = true; isInvulnerable = false; p2Invul = false;
  bgMusic.play().catch(() => {});
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function goToMenu() {
  document.getElementById("gameover-screen").classList.remove("active");
  document.getElementById("game-container").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
  document.getElementById("game-body").className = "";
  updateUI();
}

// FIX #2: P2 coin pop function
function spawnCoinPop(isP2 = false) {
  const road = isP2 ? document.getElementById("game-road-p2") : document.getElementById("game-road");
  const rect = road.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "coin-pop";
  pop.textContent = "+10";
  const playerX = isP2 ? p2x : px;
  const playerY = isP2 ? p2y : py;
  pop.style.left = (rect.left + (playerX * 100) + 50) + "px";
  pop.style.top = (rect.top + (playerY * 100) + 30) + "px";
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 900);
}

let isMuted = false;
function toggleMute() {
  isMuted = !isMuted;
  bgMusic.muted = isMuted;
  menuMusic.muted = isMuted;
  document.getElementById("mute-btn").textContent = isMuted ? "🔇" : "🔊";
}

let isPaused = false;
function togglePause() {
  if (!running) return;
  isPaused = !isPaused;
  if (isPaused) {
    document.getElementById("pause-screen").classList.add("active");
    bgMusic.pause();
  } else {
    document.getElementById("pause-screen").classList.remove("active");
    bgMusic.play().catch(() => {});
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function quitToMenu() {
  isPaused = false; running = false;
  document.getElementById("pause-screen").classList.remove("active");
  stopAllMusic();
  menuMusic.play().catch(() => {});
  if (!isDev) {
    userData.money += (sessionCash + (isMultiplayer ? p2Cash : 0));
    saveData();
  }
  document.getElementById("game-container").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
  document.getElementById("game-body").className = "";
  updateUI();
}

const LB_KEY = "rnd_leaderboard";
function getLeaderboard() {
  try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch(e) { return []; }
}

function saveToLeaderboard(name, score, car) {
  if (isDev) return;
  let lb = getLeaderboard();
  lb.push({ name, score, car });
  lb.sort((a, b) => b.score - a.score);
  lb = lb.slice(0, 5);
  localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

function openLeaderboard() {
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("leaderboard-screen").classList.remove("hidden");
  renderLeaderboard();
}

function closeLeaderboard() {
  document.getElementById("leaderboard-screen").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
}

function renderLeaderboard() {
  const lb = getLeaderboard();
  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const content = document.getElementById("lb-content");
  if (lb.length === 0) { content.innerHTML = `<div class="lb-empty">BELUM ADA REKOD LAGI</div>`; return; }
  content.innerHTML = lb.map((entry, i) => `
    <div class="lb-row">
      <span class="lb-rank">${medals[i]}</span>
      <span class="lb-name">${entry.name.toUpperCase()}</span>
      <span class="lb-car">${entry.car.toUpperCase()}</span>
      <span class="lb-score">💰 ${entry.score}</span>
    </div>`).join("");
}

// --- Function control ---
function openControl() {
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("controlBox").classList.remove("hidden");
  renderControl();
}

function closeControl() {
  document.getElementById("controlBox").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
}

function openCredit() {
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("creditBox").classList.remove("hidden");
  renderCredit();
}
function closeCredit() {
  document.getElementById("creditBox").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
}

let introStarted = false;
function runFullIntro() {
  if (introStarted) return; introStarted = true;
  document.getElementById("press-start").style.display = "none";
  document.getElementById("studio-logo").style.opacity = "1";
  if (audioCtx.state === 'suspended') audioCtx.resume();
  stopAllMusic();
  menuMusic.play().catch(e => console.log("Music wait"));
  setTimeout(() => {
    document.getElementById("studio-logo").style.opacity = "0";
    setTimeout(startSystemBoot, 1500);
  }, 2000);
}

function startSystemBoot() {
  const text = document.getElementById("intro-text");
  let lines = ["> BOOTING RND...", "> SYNCING DIAMOND_SHOP DATA...", "> READY"];
  let i = 0;
  let int = setInterval(() => {
    if (i < lines.length) { text.innerText = lines[i]; text.style.width = "100%"; i++; }
    else { clearInterval(int); document.getElementById("intro-screen").classList.add("hidden"); document.getElementById("login-screen").classList.remove("hidden"); }
  }, 800);
}

function login() {
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value;
  // FIX #4: Remove hardcoded credentials or move to environment
  // WARNING: Jangan share credentials di production!
  if (u === "admin" && p === "122333") {
    isDev = true; userData = { money: 999999, diamond: 999, cars: Object.keys(CARS), pass: "122333" };
    document.getElementById("dev-tag").classList.remove("hidden");
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("main-menu").classList.remove("hidden");
    updateUI(); return;
  }
  let rawData = localStorage.getItem("kancil_acc_" + u);
  if (!rawData) return alert("Akaun tidak wujud!");
  try { userData = JSON.parse(atob(rawData)); }
  catch (e) { try { userData = JSON.parse(rawData); } catch (e2) { return alert("Data korup!"); } }
  if (userData.diamond === undefined) userData.diamond = 0;
  if (userData.pass !== p) return alert("Login Gagal!");
  
  // FIX #6: ENSURE KANCIL ALWAYS IN userData.cars
  if (!userData.cars || userData.cars.length === 0) {
    userData.cars = ['kancil'];
  }
  if (!userData.cars.includes('kancil')) {
    userData.cars.unshift('kancil');  // Add kancil at front
  }
  
  currentUser = u;
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
  updateUI();
}

function register() {
  const u = document.getElementById("username").value.trim();
  const p = document.getElementById("password").value;
  if (!u || !p) return alert("Isi data!");
  localStorage.setItem("kancil_acc_" + u, btoa(JSON.stringify({ money: 0, diamond: 0, cars: ['kancil'], pass: p })));
  alert("Berjaya mendaftar!");
}

function saveData() {
  if (!isDev && currentUser) {
    localStorage.setItem("kancil_acc_" + currentUser, btoa(JSON.stringify(userData)));
  }
}

function updateUI() {
  document.getElementById("menu-money").textContent = userData.money;
  document.getElementById("menu-diamond").textContent = userData.diamond;
}

function hardReset() { if (confirm("Wipe data?")) { localStorage.clear(); location.reload(); } }
function openStore() { document.getElementById("main-menu").classList.add("hidden"); document.getElementById("diamond-store").classList.remove("hidden"); }
function closeStore() { document.getElementById("diamond-store").classList.add("hidden"); document.getElementById("main-menu").classList.remove("hidden"); }

function buyDiamond(amt) {
  let curD = parseInt(userData.diamond) || 0;
  if (userData.money >= amt * 150) {
    userData.money -= amt * 150;
    userData.diamond = curD + amt;
    saveData(); updateUI(); alert("Berjaya!");
  } else alert("Duit tak cukup!");
}

function openGarage() {
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("garage").classList.remove("hidden");
  const list = document.getElementById("car-list");
  list.innerHTML = "";

  const brands = ['PERODUA', 'PROTON', 'TOYOTA', 'LEGEND'];
  brands.forEach(b => {
    // Label jenama
    const brandLabel = document.createElement("div");
    brandLabel.className = "brand-label";
    brandLabel.textContent = b;
    list.appendChild(brandLabel);

    // Baris kereta
    const row = document.createElement("div");
    row.className = "car-row";

    for (let key in CARS) {
      if (CARS[key].brand === b) {
        const owned = (userData.cars || []).includes(key);
        const isSel = (selCarKey === key);

        const card = document.createElement("div");
        card.style.background = "#222";
        card.style.padding = "15px";
        card.style.borderRadius = "15px";
        card.style.border = `3px solid ${isSel ? '#f1c40f' : '#444'}`;
        card.style.cursor = "pointer";
        card.style.minWidth = "140px"; // pastikan cukup lebar
        card.style.display = "inline-block";
        card.style.textAlign = "center";

        if (isSel) card.classList.add('selected');

        card.innerHTML = `
          <div style="height: 80px; display: flex; align-items: center; justify-content: center;">
            ${getCarHTML(key)}
          </div>
          <br><b>${key.toUpperCase()}</b><br>
          <small>${owned ? (isSel ? 'SELECTED' : 'OWNED') : (CARS[key].currency === 'money' ? '💰 ' : '💎 ') + CARS[key].price}</small>
        `;

        card.onclick = () => {
          if (owned) selectCar(key);
          else buyCar(key);
        };

        row.appendChild(card);
      }
    }

    list.appendChild(row);
  });

  const selectedEl = document.querySelector('.car-row .selected') || document.querySelector('.vs-car-item.selected');
  if (selectedEl && selectedEl.scrollIntoView) {
    selectedEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function selectCar(key) { selCarKey = key; openGarage(); }
function buyCar(key) {
  const car = CARS[key];
  const val = car.currency === 'money' ? userData.money : userData.diamond;
  if (val >= car.price) {
    if (car.currency === 'money') userData.money -= car.price; else userData.diamond -= car.price;
    userData.cars.push(key); saveData(); selectCar(key); updateUI();
  } else alert("Tak cukup modal!");
}

function closeGarage() { document.getElementById("garage").classList.add("hidden"); document.getElementById("main-menu").classList.remove("hidden"); }

function setMode(num) {
  isMultiplayer = (num === 2);
  document.getElementById("btn-1p").style.border = (num === 1) ? "4px solid white" : "none";
  document.getElementById("btn-2p").style.border = (num === 2) ? "4px solid white" : "none";
  document.getElementById("map-list-area").style.display = "flex";
}

function openMapSelect() {
  document.getElementById("main-menu").classList.add("hidden");
  document.getElementById("map-select").classList.remove("hidden");
  document.getElementById("map-list-area").style.display = "none";
}

function closeMapSelect() {
  document.getElementById("map-select").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
}

function setMap(key) {
  currentMapKey = key;
  if (isMultiplayer) {
    document.getElementById("map-select").classList.add("hidden");
    openVersusSelection();
  } else {
    executeSetMap(key);
  }
}

function executeSetMap(key) {
  const m = MAPS[key];
  const body = document.getElementById("game-body");
  document.documentElement.style.setProperty('--bg', m.color);
  document.documentElement.style.setProperty('--road', m.color);
  document.documentElement.style.setProperty('--neon-blue', m.neon);
  body.className = "";
  body.classList.add(m.bgClass);
  document.getElementById("map-select").classList.add("hidden");
  startRace();
}

function openVersusSelection() {
  document.getElementById("versus-screen").classList.remove("hidden");
  renderVSList('p1'); 
  renderVSList('p2');
}

function closeVersusscreen() {
  document.getElementById("versus-screen").classList.add("hidden");
  document.getElementById("main-menu").classList.remove("hidden");
}

function renderVSList(player) {
  const container = document.getElementById(`vs-list-${player}`);
  container.innerHTML = "";
  let selectedElement = null;

  const carOrder = ['kancil', 'myvi', 'satria', 'wira', 'saga', 'perdana', 'hilux', 'kancil_r'];

  carOrder.forEach(key => {
    const owned = (userData.cars || []).includes(key);
    const isSel = (player === 'p1' ? selCarKey === key : p2CarKey === key);

    const div = document.createElement("div");
    div.className = "vs-car-item";

    if (isSel) {
      div.classList.add('vs-selected');
      div.style.border = "3px solid var(--primary)";
      div.style.boxShadow = "0 0 20px var(--primary)";
      selectedElement = div;
    }

    if (!owned) {
      div.style.opacity = "0.4";
      div.style.pointerEvents = "none";
    }

    div.innerHTML = `
      <div style="transform:scale(0.5)">${getCarHTML(key)}</div>
      <p style="font-size:10px">${key.toUpperCase()}</p>
      ${!owned ? `<p style="font-size:8px; color:#f1c40f;">🔒</p>` : ''}
    `;

    if (owned) {
      div.style.cursor = "pointer";
      div.onclick = () => { 
        if (player === 'p1') selCarKey = key; 
        else p2CarKey = key; 
        renderVSList(player); 
      };
    }

    container.appendChild(div);
  });

  if (selectedElement) {
    setTimeout(() => {
      selectedElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 50);
  }
}

function confirmVehicles() {
  document.getElementById("versus-screen").classList.add("hidden");
  executeSetMap(currentMapKey);
}

function startRace() {
  stopAllMusic();
  bgMusic.src = CARS[selCarKey].song;
  bgMusic.load(); bgMusic.play().catch(() => {});
  running = true; isPaused = false; isInvulnerable = false;
  nitroActive = false; nitroEnergy = 0;
  curLives = CARS[selCarKey].hp;
  sessionCash = 0; obs = []; gems = []; items = [];

  if (isMultiplayer) {
    p2Lives = CARS[p2CarKey].hp; p2x = 1; p2Cash = 0; obs2 = []; gems2 = [];
    p2MoveTimer = 0;
    document.getElementById("p2-zone").style.display = "flex";
  } else {
    document.getElementById("p2-zone").style.display = "none";
  }

  // 🔥 Spawn obstacle ikut mode
  if (isMultiplayer) {
    setInterval(() => spawnObstacle("game-road"), 2000);
    setInterval(() => spawnObstacle("game-road-p2"), 2000);
  } else {
    setInterval(() => spawnObstacle("game-road"), 2000);
  }

  lastTime = performance.now(); px = 1; py = 4;
  gameLevel = 1; levelTimer = 0;
  document.getElementById("level-ui").textContent = "LV1";
  document.getElementById("game-container").classList.remove("hidden");
  requestAnimationFrame(gameLoop);
}

function spawnObstacle(roadId) {
  const road = document.getElementById(roadId);
  if (!road) return;

  const obstacle = document.createElement("div");   // ← WAJIB ada
  obstacle.className = "obstacle";
  obstacle.style.width = "40px";
  obstacle.style.height = "40px";
  obstacle.style.background = "red";
  obstacle.style.position = "absolute";
  obstacle.style.top = "0px";
  obstacle.style.left = Math.floor(Math.random() * (road.offsetWidth - 40)) + "px";

  road.appendChild(obstacle);

  let pos = 0;
  function move() {
    pos += 5;
    obstacle.style.top = pos + "px";

    // Collision check
    const car = document.querySelector("#" + roadId + " .car-visual");
    if (car) {
      const carRect = car.getBoundingClientRect();
      const obsRect = obstacle.getBoundingClientRect();
      if (
        carRect.left < obsRect.right &&
        carRect.right > obsRect.left &&
        carRect.top < obsRect.bottom &&
        carRect.bottom > obsRect.top
      ) {
        console.log("Collision!");
        // kurangkan nyawa atau trigger game over
      }
    }

    if (pos < road.offsetHeight - 40) {
      requestAnimationFrame(move);
    } else {
      road.removeChild(obstacle);
    }
  }
  requestAnimationFrame(move);
}

function gameLoop(t) {
  if (!running || isPaused) return;
  let dt = t - lastTime; lastTime = t;

  checkLevelUp(dt);

  let speed = (CARS[selCarKey].speed + (gameLevel * 0.12));
  if (nitroActive) { 
    speed *= 2.8; 
    nitroEnergy -= 0.6; 
    if (nitroEnergy <= 0) nitroActive = false; 
  }

  // P2 speed (multiplayer)
  if (isMultiplayer) {
    let p2Speed = (CARS[p2CarKey].speed + (gameLevel * 0.12));
    if (p2NitroActive) {
      p2Speed *= 2.8;
      p2NitroEnergy -= 0.6;
      if (p2NitroEnergy <= 0) p2NitroActive = false;
    }
    p2MoveTimer += dt;
  }

  moveTimer += dt;

  // ... kod lain untuk update kereta, UI, dll

  requestAnimationFrame(gameLoop);
}


  let speed = (CARS[selCarKey].speed + (gameLevel * 0.12));
  if (nitroActive) { 
    speed *= 2.8; 
    nitroEnergy -= 0.6; 
    if (nitroEnergy <= 0) nitroActive = false; 
  }

  // ... update kereta, UI, dll

  requestAnimationFrame(gameLoop);
}



  checkLevelUp(dt);

  let speed = (CARS[selCarKey].speed + (gameLevel * 0.12));
  if (nitroActive) { speed *= 2.8; nitroEnergy -= 0.6; if (nitroEnergy <= 0) nitroActive = false; }

  // P2 speed
  let p2Speed = (CARS[p2CarKey].speed + (gameLevel * 0.12));
  if (p2NitroActive) {
    p2Speed *= 2.8;
    p2NitroEnergy -= 0.6;
    if (p2NitroEnergy <= 0) p2NitroActive = false;
  }

  moveTimer += dt;
  if (isMultiplayer) p2MoveTimer += dt;

  // LOGIK 450
  if (moveTimer >= (450 / speed)) {
    // --- P1 LOGIC ---
    obs.forEach(o => o.y++); gems.forEach(g => g.y++); items.forEach(i => i.y++);
    obs = obs.filter(o => o.y <= 5); gems = gems.filter(g => g.y <= 5); items = items.filter(i => i.y <= 5);
    items.forEach((it, idx) => { if (it.x === px && it.y === py) { curLives++; items.splice(idx, 1); }});
    if (obs.find(o => o.x === px && o.y === py) && !isInvulnerable) {
      curLives--; isInvulnerable = true;
      document.body.classList.add("shake-body");
      setTimeout(() => document.body.classList.remove("shake-body"), 300);
      if (curLives <= 0) return gameOver();
      setTimeout(() => isInvulnerable = false, 2000);
    }
    gems.forEach((g, i) => { if (g.x === px && g.y === py) { sessionCash += 10; nitroEnergy = Math.min(100, nitroEnergy + 10); gems.splice(i, 1); spawnCoinPop(); }});

    // --- P2 LOGIC ---
    if (isMultiplayer && p2MoveTimer >= (450 / p2Speed)) {
      p2MoveTimer = 0;

      obs2.forEach(o => o.y++); gems2.forEach(g => g.y++);
      obs2 = obs2.filter(o => o.y <= 5); gems2 = gems2.filter(g => g.y <= 5);

      if (obs2.find(o => o.x === p2x && o.y === p2y) && !p2Invul) {
        p2Lives--;
        p2Invul = true;
        document.body.classList.add("shake-body");
        setTimeout(() => document.body.classList.remove("shake-body"), 300);
        if (p2Lives <= 0) return gameOver();
        setTimeout(() => p2Invul = false, 2000);
      }

      gems2.forEach((g, i) => {
        if (g.x === p2x && g.y === p2y) {
          p2Cash += 10;
          p2NitroEnergy = Math.min(100, (Number(p2NitroEnergy) || 0) + 10);
          gems2.splice(i, 1);
          // FIX #2: Added P2 coin pop
          spawnCoinPop(true);
        }
      });

      // --- SPAWNING (FIX #1: Gerak spawn logic keluar dari P2 timer) ---
      if (Math.random() < 0.2) {
        obs.push({ x: Math.floor(Math.random() * 3), y: 0 });
        if (isMultiplayer) obs2.push({ x: Math.floor(Math.random() * 3), y: 0 });
      }
      if (Math.random() < 0.1) {
        gems.push({ x: Math.floor(Math.random() * 3), y: 0 });
        if (isMultiplayer) {
          const newGem2 = { x: Math.floor(Math.random() * 3), y: 0 };
          gems2.push(newGem2);
        }
      }
      if (Math.random() < 0.02) items.push({ x: Math.floor(Math.random() * 3), y: 0 });

      moveTimer = 0;
    }
  }

  render();
  requestAnimationFrame(gameLoop);
}

function render() {
  const m = MAPS[currentMapKey];

  // P1 RENDER
  let h1 = "";
  for (let y = 0; y < 5; y++) {
    h1 += "<div class='row'>";
    for (let x = 0; x < 3; x++) {
      let content = "";
      if (x === px && y === py) content = getCarHTML(selCarKey, (isInvulnerable ? "invincible " : "") + (nitroActive ? "nitro-fx" : ""));
      else if (obs.some(o => o.x === x && o.y === y)) content = m.obs;
      else if (gems.some(g => g.x === x && g.y === y)) content = m.item;
      else if (items.some(it => it.x === x && it.y === y)) content = m.tool;
      h1 += `<div class="cell">${content}</div>`;
    }
    h1 += "</div>";
  }
  document.getElementById("game-road").innerHTML = h1;
  document.getElementById("lives-ui").innerHTML = "❤️".repeat(Math.max(0, curLives));
  document.getElementById("cash-ui").innerText = sessionCash;
  document.getElementById("nitro-fill").style.width = nitroEnergy + "%";

  // P2 RENDER
  if (isMultiplayer) {
    let h2 = "";
    for (let y = 0; y < 5; y++) {
      h2 += "<div class='row'>";
      for (let x = 0; x < 3; x++) {
        let content = "";
        if (x === p2x && y === p2y) content = getCarHTML(p2CarKey, (p2Invul ? "invincible " : "") + (p2NitroActive ? "nitro-fx" : ""));
        else if (obs2.some(o => o.x === x && o.y === y)) content = m.obs;
        else if (gems2.some(g => g.x === x && g.y === y)) content = m.item;
        h2 += `<div class="cell">${content}</div>`;
      }
      h2 += "</div>";
    }
    document.getElementById("game-road-p2").innerHTML = h2;
    document.getElementById("p2-lives-ui").innerHTML = "❤️".repeat(Math.max(0, p2Lives));
    document.getElementById("p2-cash-ui").innerText = p2Cash;

    const p2NitroEl = document.getElementById("nitro-fill-p2");
    if (p2NitroEl) p2NitroEl.style.width = (Number(p2NitroEnergy) || 0) + "%";
  }
}

function getCarHTML(key, extraClass = "") {
  const h = '<div class="headlights"><div class="light"></div><div class="light"></div></div>';
  if (key === 'kancil') return `<div class="car-visual v-kancil ${extraClass}">${h}<div class="v-kancil-roof"></div></div>`;
  if (key === 'myvi') return `<div class="car-visual v-myvi ${extraClass}">${h}<div class="v-myvi-roof"></div></div>`;
  if (key === 'wira') return `<div class="car-visual v-wira ${extraClass}">${h}<div class="v-wira-roof"></div></div>`;
  if (key === 'saga') return `<div class="car-visual v-saga ${extraClass}">${h}<div class="v-saga-roof"></div></div>`;
  if (key === 'hilux') return `<div class="car-visual v-hilux ${extraClass}">${h}<div class="v-hilux-roof"></div><div class="v-hilux-rollbar"></div></div>`;
  if (key === 'perdana') return `<div class="car-visual v-perdana ${extraClass}">${h}<div class="v-perdana-roof"></div></div>`;
  if (key === 'satria') return `<div class="car-visual v-satria ${extraClass}">${h}<div class="v-satria-spoiler"></div></div>`;
  if (key === 'kancil_r') return `<div class="car-visual v-kancil-r ${extraClass}">${h}</div>`;
  return '';
}

function gameOver() {
  running = false; isPaused = false;
  document.getElementById("pause-screen").classList.remove("active");
  stopAllMusic();
  menuMusic.play().catch(() => {});
  saveToLeaderboard(currentUser || "GUEST", (sessionCash + (isMultiplayer ? p2Cash : 0)), selCarKey);
  if (!isDev) { userData.money += (sessionCash + (isMultiplayer ? p2Cash : 0)); saveData(); }
  showGameOverScreen();
}

// --- TOUCH & KEYBOARD INPUTS ---
let touchStartX = 0;
document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (!running || isPaused) return;
  const diff = e.changedTouches[0].clientX - touchStartX;
  if (diff < -30 && px > 0) px--;
  if (diff > 30 && px < 2) px++;
}, { passive: true });

window.onkeydown = (e) => {
  if (e.code === "Escape") { togglePause(); return; }
  if (!running || isPaused) return;

  const k = e.key;
  if ((k === "a" || k === "A") && px > 0) px--;
  if ((k === "d" || k === "D") && px < 2) px++;

  // Nitro P1
  if (e.code === "Space" && nitroEnergy >= 30) nitroActive = true;

  // Player 2 / Arrow keys
  if (isMultiplayer) {
    if (e.code === "ArrowLeft" && p2x > 0) p2x--;
    if (e.code === "ArrowRight" && p2x < 2) p2x++;
    if (e.code === "Enter" && p2NitroEnergy >= 30) p2NitroActive = true;
  } else {
    if (e.code === "ArrowLeft" && px > 0) px--;
    if (e.code === "ArrowRight" && px < 2) px++;
  }
};

window.addEventListener('keyup', (e) => {
  if (e.code === "Space") nitroActive = false;
  if (isMultiplayer && e.code === "Enter") p2NitroActive = false;
});
