/**
 * ============================================================================
 * LAST ZONE BRAWLS: Tactical Classroom Royale
 * Game Engine & State Manager (gameEngine.js)
 * ============================================================================
 * Handles game state, turn-based battle royale logic, timers, map scaling,
 * question management, duel resolution, particle & audio hooks.
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. ASSET HOOKS (SPRITES & SFX SYSTEM - READY FOR EXTENSION)
// ----------------------------------------------------------------------------
const audioManager = {
  muted: false,
  bgmVolume: 0.3,
  sfxVolume: 1.0,
  currentBGMKey: null,
  currentBGM: null,
  bgmElements: {},
  sfxElements: {},
  aliasMap: {
    clash: 'attack',
    shrink: 'zone',
    move: 'click'
  },

  init() {
    // Load persisted settings
    const savedMuted = localStorage.getItem('lzb_audio_muted');
    if (savedMuted !== null) {
      this.muted = savedMuted === 'true';
    }
    const savedBGM = localStorage.getItem('lzb_bgm_volume');
    if (savedBGM !== null) {
      const parsed = parseFloat(savedBGM);
      if (!isNaN(parsed)) this.bgmVolume = Math.max(0, Math.min(1, parsed));
    }
    const savedSFX = localStorage.getItem('lzb_sfx_volume');
    if (savedSFX !== null) {
      const parsed = parseFloat(savedSFX);
      if (!isNaN(parsed)) this.sfxVolume = Math.max(0, Math.min(1, parsed));
    }

    // Load BGM elements
    const bgmFiles = {
      lobby: 'assets/audio/bgm_lobby.mp3',
      combat: 'assets/audio/bgm_combat.mp3',
      victory: 'assets/audio/bgm_victory.mp3'
    };
    for (const [key, path] of Object.entries(bgmFiles)) {
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = this.muted ? 0 : this.bgmVolume;
      audio.preload = 'auto';
      // Continuous loop fallback listener
      audio.addEventListener('ended', () => {
        if (this.currentBGMKey === key && !this.muted) {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        }
      });
      this.bgmElements[key] = audio;
    }

    // Load SFX elements
    const sfxFiles = {
      click: 'assets/audio/sfx_click.mp3',
      correct: 'assets/audio/sfx_correct.mp3',
      wrong: 'assets/audio/sfx_wrong.mp3',
      attack: 'assets/audio/sfx_attack.mp3',
      airdrop: 'assets/audio/sfx_airdrop.mp3',
      zone: 'assets/audio/sfx_zone.mp3'
    };
    for (const [key, path] of Object.entries(sfxFiles)) {
      const audio = new Audio(path);
      audio.preload = 'auto';
      audio.volume = this.muted ? 0 : this.sfxVolume;
      this.sfxElements[key] = audio;
    }

    this.updateMuteUI();
  },

  playBGM(key) {
    if (!this.bgmElements[key]) return;

    // If already playing this BGM, ensure volume and playback
    if (this.currentBGMKey === key && this.currentBGM) {
      this.currentBGM.volume = this.muted ? 0 : this.bgmVolume;
      if (!this.muted && this.currentBGM.paused) {
        this.currentBGM.play().catch(() => {});
      }
      return;
    }

    // Stop current BGM
    this.stopBGM();

    this.currentBGMKey = key;
    this.currentBGM = this.bgmElements[key];
    this.currentBGM.loop = true;
    this.currentBGM.volume = this.muted ? 0 : this.bgmVolume;

    if (!this.muted) {
      this.currentBGM.currentTime = 0;
      this.currentBGM.play().catch(e => {
        console.warn(`[Audio] Autoplay blocked for ${key} BGM, waiting for user gesture:`, e);
      });
    }
  },

  stopBGM() {
    if (this.currentBGM) {
      try {
        this.currentBGM.pause();
        this.currentBGM.currentTime = 0;
      } catch (e) {}
    }
    this.currentBGM = null;
    this.currentBGMKey = null;
  },

  playSFX(key) {
    if (this.muted) return;
    const realKey = this.aliasMap[key] || key;
    if (realKey === 'victory') {
      this.playBGM('victory');
      return;
    }
    const audio = this.sfxElements[realKey];
    if (audio) {
      try {
        audio.volume = this.sfxVolume;
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } catch (e) {}
    }
  },

  // Alias for backward compatibility with existing code
  play(key) {
    this.playSFX(key);
  },

  setMuted(muted) {
    this.muted = !!muted;
    localStorage.setItem('lzb_audio_muted', this.muted ? 'true' : 'false');

    if (this.currentBGM) {
      if (this.muted) {
        this.currentBGM.pause();
      } else {
        this.currentBGM.volume = this.bgmVolume;
        this.currentBGM.play().catch(() => {});
      }
    }
    this.updateMuteUI();
  },

  setBGMVolume(vol) {
    const val = Math.max(0, Math.min(1, parseFloat(vol)));
    this.bgmVolume = val;
    localStorage.setItem('lzb_bgm_volume', val.toString());
    if (this.currentBGM && !this.muted) {
      this.currentBGM.volume = val;
    }
  },

  setSFXVolume(vol) {
    const val = Math.max(0, Math.min(1, parseFloat(vol)));
    this.sfxVolume = val;
    localStorage.setItem('lzb_sfx_volume', val.toString());
  },

  updateMuteUI() {
    const isMuted = this.muted;
    // Header Icon & Label
    const headerIcon = document.getElementById('header-audio-icon');
    if (headerIcon) {
      headerIcon.className = isMuted 
        ? 'fa-solid fa-volume-xmark text-rose-400 text-sm sm:text-base' 
        : 'fa-solid fa-volume-high text-cyan-300 text-sm sm:text-base';
    }
    const headerLabel = document.getElementById('header-audio-label');
    if (headerLabel) {
      headerLabel.textContent = isMuted ? 'Muted' : 'Audio';
    }

    // Lobby Icon
    const lobbyIcon = document.getElementById('lobby-audio-icon');
    if (lobbyIcon) {
      lobbyIcon.className = isMuted 
        ? 'fa-solid fa-volume-xmark text-rose-400 text-sm sm:text-base' 
        : 'fa-solid fa-volume-high text-cyan-300 text-sm sm:text-base';
    }

    // Settings Modal UI
    const settingsMuteIcon = document.getElementById('settings-mute-icon');
    if (settingsMuteIcon) {
      settingsMuteIcon.className = isMuted 
        ? 'fa-solid fa-volume-xmark text-rose-400 text-sm' 
        : 'fa-solid fa-volume-high text-cyan-400 text-sm';
    }
    const settingsMuteBtn = document.getElementById('settings-mute-btn');
    if (settingsMuteBtn) {
      settingsMuteBtn.textContent = isMuted ? 'UNMUTE' : 'MUTE';
      settingsMuteBtn.className = isMuted
        ? 'px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 text-xs font-bold transition active:scale-95 cursor-pointer'
        : 'px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/20 text-xs font-bold transition active:scale-95 cursor-pointer';
    }
  }
};

// Aliases & Global Exposure
const AudioManager = audioManager;
window.audioManager = audioManager;
window.AudioManager = audioManager;

const SpriteManager = {
  loaded: false,
  sprites: {},
  registerSprite(key, imageSrc) {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => { this.sprites[key] = img; };
  }
};

// ----------------------------------------------------------------------------
// 2. DYNAMIC MAP & REAL-TIME CLOCK STATE
// ----------------------------------------------------------------------------
let mapSize = 24;
let safeZone = { minX: 4, maxX: 19, minY: 4, maxY: 19, phase: 1 };
let showCoords = false;

let matchSecondsLeft = 20 * 60;
let shrinkIntervalSec = 120;
let shrinkSecondsLeft = 120;
let airdropIntervalSec = 120;
let airdropSecondsLeft = 120;
let isTimerPaused = false;
let gameClockInterval = null;

const AVATAR_TYPES = [
  { 
    id: 'soldier', 
    label: 'Soldier', 
    title: 'TACTICAL SOLDIER', 
    role: 'Core Crew • Frontline Assault', 
    color: '#06b6d4',
    palette: ['#06b6d4', '#16a34a', '#2563eb', '#f59e0b', '#e11d48']
  },
  { 
    id: 'dino', 
    label: 'Dino', 
    title: 'DINO BRAWLER', 
    role: 'Wild Beast • Rampage Breaker', 
    color: '#22c55e',
    palette: ['#22c55e', '#16a34a', '#eab308', '#06b6d4', '#ef4444']
  },
  { 
    id: 'mecha', 
    label: 'Mecha', 
    title: 'CYBER MECHA', 
    role: 'Titan Armor • Tech Heavyweight', 
    color: '#a855f7',
    palette: ['#a855f7', '#6366f1', '#06b6d4', '#ec4899', '#f59e0b']
  },
  { 
    id: 'fox', 
    label: 'Fox', 
    title: 'SHADOW FOX', 
    role: 'Speed Rogue • Trickster Scout', 
    color: '#f97316',
    palette: ['#f97316', '#ef4444', '#f59e0b', '#8b5cf6', '#10b981']
  },
  { 
    id: 'ninja', 
    label: 'Ninja', 
    title: 'STEALTH NINJA', 
    role: 'Silent Strike • Shadow Master', 
    color: '#f43f5e',
    palette: ['#f43f5e', '#06b6d4', '#e11d48', '#8b5cf6', '#eab308']
  },
  { 
    id: 'astro', 
    label: 'Astro', 
    title: 'COSMIC ASTRO', 
    role: 'Star Voyager • Orbit Specialist', 
    color: '#eab308',
    palette: ['#eab308', '#06b6d4', '#f59e0b', '#ec4899', '#10b981']
  }
];

// ----------------------------------------------------------------------------
// TACTICAL INVENTORY: 7 SPECIAL AIRDROP ITEMS DEFINITIONS
// ----------------------------------------------------------------------------
const TACTICAL_ITEMS = {
  awm: {
    id: 'awm',
    name: 'AWM (Orbital Strike)',
    shortName: 'AWM Strike',
    icon: 'fa-solid fa-crosshairs',
    emoji: '🎯',
    color: 'rose',
    textColor: 'text-rose-400',
    borderColor: 'border-rose-400/50',
    bgBadge: 'bg-rose-500/20',
    badgeText: 'Damage 20 LP',
    description: 'Serangan jarak jauh orbital. Pilih 1 tim lawan di peta tanpa harus berdekatan (Damage: 20 LP).'
  },
  emp: {
    id: 'emp',
    name: 'EMP Grenade',
    shortName: 'EMP Grenade',
    icon: 'fa-solid fa-bolt-lightning',
    emoji: '⚡',
    color: 'amber',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-400/50',
    bgBadge: 'bg-amber-500/20',
    badgeText: 'Skip Turn 1x',
    description: 'Granat elektromagnetik. Mengaktifkan mode target untuk membekukan tim lawan sehingga giliran mereka dilewati selama 1 putaran.'
  },
  armor: {
    id: 'armor',
    name: 'Level 3 Armor',
    shortName: 'Lv 3 Armor',
    icon: 'fa-solid fa-shield-halved',
    emoji: '🛡️',
    color: 'emerald',
    textColor: 'text-emerald-400',
    borderColor: 'border-emerald-400/50',
    bgBadge: 'bg-emerald-500/20',
    badgeText: 'Perisai 1x Pakai',
    description: 'Rompi tempur taktis. Kebal terhadap 1x serangan musuh berikutnya ATAU membatalkan 1x penalti LP jika salah menjawab soal (armor pecah setelah terpakai).'
  },
  ghillie: {
    id: 'ghillie',
    name: 'Ghillie Suit',
    shortName: 'Ghillie Suit',
    icon: 'fa-solid fa-eye-slash',
    emoji: '🌿',
    color: 'teal',
    textColor: 'text-teal-400',
    borderColor: 'border-teal-400/50',
    bgBadge: 'bg-teal-500/20',
    badgeText: 'Kamuflase 2 Turn',
    description: 'Kostum kamuflase rumput. Membuat tim transparan di peta dan tidak bisa ditargetkan oleh serangan musuh selama 2 putaran.'
  },
  adrenaline: {
    id: 'adrenaline',
    name: 'Adrenaline Syringe',
    shortName: 'Adrenaline',
    icon: 'fa-solid fa-syringe',
    emoji: '💉',
    color: 'cyan',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-400/50',
    bgBadge: 'bg-cyan-500/20',
    badgeText: '+2 MP Instan',
    description: 'Suntikan stimulan taktis. Langsung memberikan +2 Move Point (MP) instan secara cuma-cuma tanpa harus menjawab soal.'
  },
  smartglasses: {
    id: 'smartglasses',
    name: 'Kacamata Pintar (50:50)',
    shortName: 'Kacamata 50:50',
    icon: 'fa-solid fa-glasses',
    emoji: '👓',
    color: 'indigo',
    textColor: 'text-indigo-400',
    borderColor: 'border-indigo-400/50',
    bgBadge: 'bg-indigo-500/20',
    badgeText: 'Eliminasi 2 Opsi',
    description: 'Kacamata analitik AI. Saat kuis/soal aktif, menggunakan kacamata ini akan langsung mengeliminasi dan menyembunyikan 2 opsi jawaban yang salah.'
  },
  bandage: {
    id: 'bandage',
    name: 'Bandage',
    shortName: 'Bandage Kit',
    icon: 'fa-solid fa-kit-medical',
    emoji: '🩹',
    color: 'lime',
    textColor: 'text-lime-400',
    borderColor: 'border-lime-400/50',
    bgBadge: 'bg-lime-500/20',
    badgeText: 'Heal +20 LP',
    description: 'Perban medis darurat. Memulihkan +20 Life Point (LP). Menjadi satu-satunya sarana pemulihan darah di medan pertempuran!'
  }
};

let teams = [
  { id: 0, name: 'Team Alpha', pilot: 'Lucas & Ava', avatar: 'soldier', color: '#06b6d4', badge: 'A', x: 10, y: 13, renderX: 10, renderY: 13, hopZ: 0, isMoving: false, walkPhase: 0, facing: 1, prevX: 10, prevY: 13, lp: 100, mp: 2, maxMp: 2, score: 0, kills: 0, correct: 0, alive: true, isFrozen: false, skipTurn: false, hasArmor: false, stealthTurns: 0, item: null, smartGlassesArmed: false },
  { id: 1, name: 'Team Beta (Dino)', pilot: 'Maya K.', avatar: 'dino', color: '#22c55e', badge: 'B', x: 11, y: 13, renderX: 11, renderY: 13, hopZ: 0, isMoving: false, walkPhase: 0, facing: -1, prevX: 11, prevY: 13, lp: 100, mp: 2, maxMp: 2, score: 0, kills: 0, correct: 0, alive: true, isFrozen: false, skipTurn: false, hasArmor: false, stealthTurns: 0, item: null, smartGlassesArmed: false },
  { id: 2, name: 'Team Omega (Mecha)', pilot: 'Leo K.', avatar: 'mecha', color: '#a855f7', badge: 'Ω', x: 12, y: 9, renderX: 12, renderY: 9, hopZ: 0, isMoving: false, walkPhase: 0, facing: -1, prevX: 12, prevY: 9, lp: 100, mp: 2, maxMp: 2, score: 0, kills: 0, correct: 0, alive: true, isFrozen: false, skipTurn: false, hasArmor: false, stealthTurns: 0, item: null, smartGlassesArmed: false },
  { id: 3, name: 'Team Delta (Fox)', pilot: 'Sam T.', avatar: 'fox', color: '#f97316', badge: 'Δ', x: 14, y: 12, renderX: 14, renderY: 12, hopZ: 0, isMoving: false, walkPhase: 0, facing: -1, prevX: 14, prevY: 12, lp: 100, mp: 2, maxMp: 2, score: 0, kills: 0, correct: 0, alive: true, isFrozen: false, skipTurn: false, hasArmor: false, stealthTurns: 0, item: null, smartGlassesArmed: false }
];

let airdrops = [{ x: 10, y: 12 }, { x: 13, y: 8 }];
let dustParticles = [];
let floatingTexts = [];
let activeTeamIndex = 0;
let hasMovedThisTurn = false;
let selectedDropTeam = 0;
let isInputLocked = false;
let mapGrid = [];
const OUTFIELD_MARGIN = 4;
let outfieldGrid = {};

function getTileAt(x, y) {
  if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
    return mapGrid[y] && mapGrid[y][x];
  }
  return outfieldGrid[y] && outfieldGrid[y][x];
}

let questions = [
  { q: "Choose the correct passive form: 'The chef prepares the meal every morning.'", opts: ["The meal is prepared by the chef every morning.", "The meal was prepared by the chef.", "The meal is preparing by the chef.", "The chef is prepared the meal."], ans: 0, type: "regular" },
  { q: "What is the main purpose of an Analytical Exposition text?", opts: ["To retell past events", "To persuade the reader that an idea is important", "To describe how to make something", "To entertain the reader with a fable"], ans: 1, type: "regular" },
  { q: "If I ___ more time, I would learn 3D game modeling.", opts: ["have", "had", "has", "having"], ans: 1, type: "regular" },
  { q: "Which word is closest in meaning to 'Resilient'?", opts: ["Fragile", "Tough & flexible", "Temporary", "Hesitant"], ans: 1, type: "airdrop" },
  { q: "Identify the correct conditional sentence (Type 3):", opts: ["If she studies, she will pass.", "If she studied, she would pass.", "If she had studied, she would have passed.", "If she study, she passed."], ans: 2, type: "challenge" }
];

const isoCanvas = document.getElementById('iso-canvas');
const ctx = isoCanvas.getContext('2d');
let camX = 0;
let camY = 100;
let zoom = 0.92;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let hoveredTile = null;
let animTick = 0;

// ----------------------------------------------------------------------------
// 3. EXPOSE STATE ENGINE (FOR mapRenderer.js)
// ----------------------------------------------------------------------------
function isInsideSafeZone(x, y) {
  return x >= safeZone.minX && x <= safeZone.maxX && y >= safeZone.minY && y <= safeZone.maxY;
}

window.GameEngine = {
  getState: function() {
    return {
      mapSize,
      safeZone,
      showCoords,
      zoom,
      camX,
      camY,
      animTick,
      teams,
      activeTeamIndex,
      airdrops,
      dustParticles,
      floatingTexts,
      mapGrid,
      outfieldGrid,
      OUTFIELD_MARGIN,
      hoveredTile,
      isoCanvas,
      isInsideSafeZone,
      hasMovedThisTurn,
      isInputLocked
    };
  },
  getTileAt: getTileAt,
  AudioManager,
  SpriteManager
};

// ----------------------------------------------------------------------------
// 4. DYNAMIC MAP SCALING & REAL-TIME CLOCK ENGINE
// ----------------------------------------------------------------------------
function formatMMSS(totalSec) {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.floor(Math.max(0, totalSec) % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function applyMapAndTimerSettings() {
  const durMin = parseInt(document.getElementById('setting-duration').value) || 20;
  shrinkIntervalSec = parseInt(document.getElementById('setting-shrink').value) || 120;
  airdropIntervalSec = parseInt(document.getElementById('setting-airdrop').value) || 120;

  matchSecondsLeft = durMin * 60;
  shrinkSecondsLeft = shrinkIntervalSec;
  airdropSecondsLeft = airdropIntervalSec;

  let safeSpan = 16;
  if (durMin === 12) {
    mapSize = 16;
    safeSpan = 10;
  } else if (durMin === 20) {
    mapSize = 24;
    safeSpan = 16;
  } else {
    mapSize = 32;
    safeSpan = 24;
  }

  const margin = Math.floor((mapSize - safeSpan) / 2);
  safeZone = {
    minX: margin,
    maxX: mapSize - 1 - margin,
    minY: margin,
    maxY: mapSize - 1 - margin,
    phase: 1
  };

  const totalTiles = mapSize * mapSize;
  const headerMapBadge = document.getElementById('header-map-badge');
  if (headerMapBadge) {
    headerMapBadge.textContent = `MAP: ${mapSize}x${mapSize} (SAFE ZONE ${safeSpan}x${safeSpan})`;
  }
  const prepMapSummary = document.getElementById('prep-map-summary');
  if (prepMapSummary) {
    prepMapSummary.textContent = `Scale ${mapSize}x${mapSize} • Safe ${safeSpan}x${safeSpan}`;
  }
  const lobbyDurDisplay = document.getElementById('lobby-dur-display');
  if (lobbyDurDisplay) {
    lobbyDurDisplay.textContent = `${durMin} Menit`;
  }
  const dropMapInfo = document.getElementById('drop-map-info');
  if (dropMapInfo) {
    dropMapInfo.innerHTML = `Peta aktif berukuran <b>${mapSize}x${mapSize} tiles</b> dengan area aman awal <b>${safeSpan}x${safeSpan} tiles</b>. Klik tim lalu pilih titik terjun di area hijau.`;
  }

  const center = Math.floor(mapSize / 2);
  const offsets = [
    { dx: -2, dy: 1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: -2 },
    { dx: 2, dy: 1 },
    { dx: -2, dy: -2 },
    { dx: 2, dy: -1 }
  ];
  teams.forEach((t, idx) => {
    const off = offsets[idx % offsets.length];
    t.x = Math.min(safeZone.maxX - 1, Math.max(safeZone.minX + 1, center + off.dx));
    t.y = Math.min(safeZone.maxY - 1, Math.max(safeZone.minY + 1, center + off.dy));
    t.renderX = t.x;
    t.renderY = t.y;
    t.prevX = t.x;
    t.prevY = t.y;
  });

  airdrops = [
    { x: center - 2, y: center },
    { x: center + 1, y: center - 3 }
  ];

  generateTerrain();
  resetCamera();
  updateTimerHUDDisplay();
  if (typeof cachedIslandCanvas !== 'undefined') cachedIslandCanvas = null;
  drawDropRadar();
}

function startGameClock() {
  if (gameClockInterval) clearInterval(gameClockInterval);
  gameClockInterval = setInterval(() => {
    const isGameViewActive = !document.getElementById('view-game').classList.contains('hidden');
    const isModalOpen = !document.getElementById('question-modal').classList.contains('hidden') ||
                        !document.getElementById('challenge-modal').classList.contains('hidden');

    if (!isGameViewActive || isModalOpen || isTimerPaused) return;

    if (matchSecondsLeft > 0) {
      matchSecondsLeft--;
      if (matchSecondsLeft === 0) {
        switchView('end');
        return;
      }
    }

    if (shrinkSecondsLeft > 0) {
      shrinkSecondsLeft--;
      if (shrinkSecondsLeft === 0) {
        triggerZoneShrinkNow();
        shrinkSecondsLeft = shrinkIntervalSec;
      }
    }

    if (airdropSecondsLeft > 0) {
      airdropSecondsLeft--;
      if (airdropSecondsLeft === 0) {
        spawnRandomAirdrop();
        airdropSecondsLeft = airdropIntervalSec;
      }
    }

    updateTimerHUDDisplay();
  }, 1000);
}

function updateTimerHUDDisplay() {
  document.getElementById('hud-match-timer').textContent = formatMMSS(matchSecondsLeft);
  document.getElementById('hud-zone-timer').textContent = formatMMSS(shrinkSecondsLeft);
  document.getElementById('hud-airdrop-timer').textContent = formatMMSS(airdropSecondsLeft);

  const zoneBox = document.getElementById('zone-timer-box');
  if (shrinkSecondsLeft <= 15) {
    zoneBox.className = 'bg-rose-950/90 border-2 border-rose-500 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5 animate-pulse';
  } else {
    zoneBox.className = 'bg-purple-950/70 border border-purple-400/30 rounded-xl px-3.5 py-1.5 flex items-center gap-2.5';
  }
}

function togglePauseTimers() {
  isTimerPaused = !isTimerPaused;
  const icon = document.getElementById('pause-icon');
  icon.className = isTimerPaused ? 'fa-solid fa-play text-xs text-amber-400' : 'fa-solid fa-pause text-xs';
  AudioManager.play('click');
}

function triggerZoneShrinkNow() {
  const MR = window.MapRenderer;
  const currentSpan = safeZone.maxX - safeZone.minX;
  if (currentSpan <= 4) return;

  const shrinkStep = mapSize >= 32 ? 2 : 1;
  safeZone.minX += shrinkStep;
  safeZone.maxX -= shrinkStep;
  safeZone.minY += shrinkStep;
  safeZone.maxY -= shrinkStep;
  safeZone.phase += 1;
  shrinkSecondsLeft = shrinkIntervalSec;

  const center = Math.floor(mapSize / 2);
  MR.spawnFloatingText(center, center, `⚠️ ZONA AMAN MENGECIL! (FASE ${safeZone.phase})`, '#c084fc');
  AudioManager.play('shrink');

  teams.forEach(t => {
    if (t.alive && !isInsideSafeZone(t.x, t.y)) {
      MR.spawnFloatingText(t.x, t.y, '⚡ DI LUAR ZONA AMAN!', '#f43f5e');
    }
  });

  updateTimerHUDDisplay();
  renderHUD();
}

function spawnRandomAirdrop() {
  const MR = window.MapRenderer;
  const rx = Math.floor(safeZone.minX + 1 + Math.random() * Math.max(1, safeZone.maxX - safeZone.minX - 2));
  const ry = Math.floor(safeZone.minY + 1 + Math.random() * Math.max(1, safeZone.maxY - safeZone.minY - 2));
  if (mapGrid[ry] && mapGrid[ry][rx] && mapGrid[ry][rx].type !== 'water' && (!mapGrid[ry][rx].deco || !mapGrid[ry][rx].deco.startsWith('building_'))) {
    mapGrid[ry][rx].deco = null;
    airdrops.push({ x: rx, y: ry });
    MR.spawnFloatingText(rx, ry, '🪂 AIRDROP BARU MENDARAT!', '#facc15');
    AudioManager.play('airdrop');
  }
}

// ----------------------------------------------------------------------------
// 5. PROCEDURAL ISOMETRIC MAP GENERATOR
// ----------------------------------------------------------------------------
function seededRandom(x, y) {
  const sin = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return sin - Math.floor(sin);
}

function generateTerrain() {
  mapGrid = [];
  outfieldGrid = {};
  const half = mapSize / 2;
  const treeRingRadius = mapSize * 0.38;

  // Strategic Bridge X-coordinates where land crosses the river (matching Drop Point bridges)
  const bridge1X = Math.floor(mapSize * 0.36);
  const bridge2X = Math.floor(mapSize * 0.64);

  // 1. GENERATE MAIN ISLAND PLAYABLE GRID (0 .. mapSize-1)
  for (let y = 0; y < mapSize; y++) {
    let row = [];
    const ny = (y + 0.5) / mapSize;

    for (let x = 0; x < mapSize; x++) {
      const nx = (x + 0.5) / mapSize;
      const r = seededRandom(x, y);

      // Organic Island Landmass Shape (Matches Drop Point Island)
      const isBorder = (x === 0 || x === mapSize - 1 || y === 0 || y === mapSize - 1);
      const dx = (nx - 0.50) / 0.44;
      const dy = (ny - 0.44) / 0.40;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const noise = Math.sin(nx * 9.5 + ny * 7.2) * 0.13 + Math.cos(nx * 18.3 - ny * 14.7) * 0.07;
      const isLand = !isBorder && (1.0 - dist + noise > 0.06);

      // River Path (NW ➔ SE)
      const riverNormY = 0.34 + nx * 0.22 + Math.sin(nx * 5.5) * 0.035;
      const riverTileY = riverNormY * mapSize;
      const distToRiver = Math.abs(y - riverTileY);

      // Bridge crossing check
      const isBridge = isLand && (x === bridge1X || x === bridge1X + 1 || x === bridge2X || x === bridge2X + 1) && distToRiver < 1.4;

      let type = 'grass';
      let deco = null;
      let tint = (x + y) % 2 === 0 ? 0 : 1;

      if (!isLand) {
        type = 'water';
      } else if (distToRiver < 0.85 && !isBridge && x >= 1 && x <= mapSize - 2) {
        type = 'water';
      } else if (isBridge) {
        type = 'dirt';
      } else if (distToRiver < 1.5) {
        type = 'dirt'; // Sandy riverbank
      } else if (dist > 0.82) {
        type = 'dirt'; // Golden beach sand
      }

      // Rich Procedural Environment Props on Main Island
      if (type === 'grass') {
        const distCenter = Math.hypot(x - half, y - half);

        // A. Dense Outer Forests (Pines, Autumn Maples, Mossy Boulders)
        if (distCenter > treeRingRadius && r > 0.38) {
          if (r > 0.72) deco = 'pine';
          else if (r > 0.54) deco = 'tree_autumn';
          else if (r > 0.44) deco = 'mossy_rock';
          else if (r > 0.39) deco = 'bush';
        }
        // B. Mid-ring & Inland Groves (Oak/Apple Trees, Birches, Meadows, Campsites)
        else if (distCenter > 2.5) {
          if (r > 0.88) {
            deco = 'tree_oak'; // Chibi Apple/Oak Tree
          } else if (r > 0.80) {
            deco = 'tree_birch'; // White Birch Tree
          } else if (r > 0.73) {
            deco = 'flower_bush'; // Flower-dotted bush
          } else if (r > 0.62) {
            deco = 'flower_patch'; // Wildflower cluster
          } else if (r > 0.54) {
            deco = 'mushroom_patch'; // Cute toadstools
          } else if (r > 0.47) {
            deco = 'mossy_rock'; // Mossy boulder
          } else if (r > 0.42 && distCenter > 4) {
            deco = 'crystal_spire'; // Fantasy Mana Crystal
          }
        }
        // C. Central Open Battlegrounds (Light decorative flowers & shrubs)
        else {
          if (r > 0.84) deco = 'flower_patch';
          else if (r > 0.74) deco = 'flower_bush';
        }
      } else if (type === 'dirt') {
        if (!isBridge) {
          if (dist > 0.82) {
            // Golden Beach Shores: Tropical Palm Trees & Coastal Driftwood/Rocks
            if (r > 0.76) {
              deco = 'tree_palm';
            } else if (r > 0.58) {
              deco = 'rock';
            }
          } else if (distToRiver < 1.5) {
            // Sandy Riverbanks: Riverstones, Palms & Meadow Reeds
            if (r > 0.82) {
              deco = 'flower_patch';
            } else if (r > 0.68) {
              deco = 'mossy_rock';
            }
          }
        }
      }

      row.push({ x, y, type, deco, tint, r, isBridge, isOutfield: false });
    }
    mapGrid.push(row);
  }

  // 2. PLACE ICONIC CITY & VILLAGE BUILDINGS AT DROP POINT POI COORDINATES
  const POI_BUILDINGS = [
    { deco: 'building_school', normX: 0.68, normY: 0.36 }, // Academia Hall (School)
    { deco: 'building_house', normX: 0.48, normY: 0.52 },  // Echo Town (Village House 1)
    { deco: 'building_house', normX: 0.52, normY: 0.52 },  // Echo Town (Village House 2)
    { deco: 'building_house', normX: 0.50, normY: 0.18 },  // Nova Harbor Cottage
    { deco: 'building_house', normX: 0.24, normY: 0.32 },  // Cyber Port Warehouse/House
    { deco: 'building_radar', normX: 0.52, normY: 0.78 },  // Orion Base Radar
    { deco: 'building_power', normX: 0.78, normY: 0.62 },  // Quantum Power Reactor
    { deco: 'building_ruins', normX: 0.26, normY: 0.52 }   // Cyber Ruins Temple
  ];

  POI_BUILDINGS.forEach(b => {
    const tx = Math.min(mapSize - 2, Math.max(1, Math.round(b.normX * (mapSize - 1))));
    const ty = Math.min(mapSize - 2, Math.max(1, Math.round(b.normY * (mapSize - 1))));

    for (let dy = 0; dy <= 2; dy++) {
      for (let dx = 0; dx <= 2; dx++) {
        const px = tx + dx;
        const py = ty + dy;
        if (px >= 1 && px < mapSize - 1 && py >= 1 && py < mapSize - 1) {
          if (mapGrid[py] && mapGrid[py][px] && mapGrid[py][px].type === 'grass' && (!mapGrid[py][px].deco || !mapGrid[py][px].deco.startsWith('building_'))) {
            mapGrid[py][px].deco = b.deco;
            return;
          }
        }
      }
    }
  });

  // 3. PLACE CIVILIZATION PROPS (Bridge Signs, Lantern Posts, Windmill, Campfire Tent)
  const b1SignX = Math.max(1, bridge1X - 1);
  const b1SignY = Math.round((0.34 + (b1SignX / mapSize) * 0.22) * mapSize);
  if (mapGrid[b1SignY] && mapGrid[b1SignY][b1SignX] && mapGrid[b1SignY][b1SignX].type !== 'water') {
    mapGrid[b1SignY][b1SignX].deco = 'signpost';
  }

  const b2LanternX = Math.min(mapSize - 2, bridge2X + 2);
  const b2LanternY = Math.round((0.34 + (b2LanternX / mapSize) * 0.22) * mapSize);
  if (mapGrid[b2LanternY] && mapGrid[b2LanternY][b2LanternX] && mapGrid[b2LanternY][b2LanternX].type !== 'water') {
    mapGrid[b2LanternY][b2LanternX].deco = 'lantern_post';
  }

  // Hilltop Windmill
  const windX = Math.round(mapSize * 0.22);
  const windY = Math.round(mapSize * 0.20);
  if (mapGrid[windY] && mapGrid[windY][windX] && mapGrid[windY][windX].type === 'grass') {
    mapGrid[windY][windX].deco = 'windmill';
  }

  // Adventurer Scout Tent & Campfire in scenic grove
  const campX = Math.round(mapSize * 0.74);
  const campY = Math.round(mapSize * 0.22);
  if (mapGrid[campY] && mapGrid[campY][campX] && mapGrid[campY][campX].type === 'grass') {
    mapGrid[campY][campX].deco = 'camp_tent';
  }

  // Campus bench & fence near Academia Hall
  const benchX = Math.min(mapSize - 2, Math.round(0.68 * (mapSize - 1)) - 1);
  const benchY = Math.min(mapSize - 2, Math.round(0.36 * (mapSize - 1)) + 1);
  if (mapGrid[benchY] && mapGrid[benchY][benchX] && mapGrid[benchY][benchX].type === 'grass') {
    mapGrid[benchY][benchX].deco = 'park_bench';
  }

  // Tactical crate stack near Orion Base
  const crateX = Math.min(mapSize - 2, Math.round(0.52 * (mapSize - 1)) + 1);
  const crateY = Math.min(mapSize - 2, Math.round(0.78 * (mapSize - 1)) - 1);
  if (mapGrid[crateY] && mapGrid[crateY][crateX] && mapGrid[crateY][crateX].type !== 'water') {
    mapGrid[crateY][crateX].deco = 'crate_stack';
  }

  // 4. GENERATE OUTFIELD ARCHIPELAGO & SURROUNDING SCENERY
  const minCoord = -OUTFIELD_MARGIN;
  const maxCoord = mapSize + OUTFIELD_MARGIN - 1;

  for (let oy = minCoord; oy <= maxCoord; oy++) {
    outfieldGrid[oy] = {};
    for (let ox = minCoord; ox <= maxCoord; ox++) {
      if (ox >= 0 && ox < mapSize && oy >= 0 && oy < mapSize) {
        continue; // Handled by mapGrid
      }

      const r = seededRandom(ox + 888, oy + 888);
      let type = 'water';
      let deco = null;
      let tint = (Math.abs(ox + oy)) % 2 === 0 ? 0 : 1;

      // SATELLITE ISLET 1: North-East Pine Atoll
      if (ox >= mapSize + 1 && ox <= mapSize + 3 && oy >= -3 && oy <= -1) {
        type = (ox === mapSize + 2 && oy === -2) ? 'grass' : 'dirt';
        if (type === 'grass') deco = 'pine';
        else if (r > 0.45) deco = 'mossy_rock';
        else if (r > 0.25) deco = 'pine';
      }
      // SATELLITE ISLET 2: North-West Rocky Arch & Forest
      else if (ox >= -4 && ox <= -2 && oy >= -4 && oy <= -2) {
        if (ox === -3 && oy === -3) {
          type = 'grass';
          deco = 'tree_autumn';
        } else {
          type = 'dirt';
          deco = r > 0.5 ? 'pine' : 'rock';
        }
      }
      // SATELLITE ISLET 3: South-East Lighthouse Isle
      else if (ox >= mapSize + 1 && ox <= mapSize + 3 && oy >= mapSize + 1 && oy <= mapSize + 3) {
        type = (ox === mapSize + 2 && oy === mapSize + 2) ? 'grass' : 'dirt';
        if (ox === mapSize + 2 && oy === mapSize + 2) deco = 'lighthouse';
        else if (ox === mapSize + 1 && oy === mapSize + 2) deco = 'pine';
        else if (r > 0.4) deco = 'mossy_rock';
      }
      // SATELLITE ISLET 4: South-West Tropical Lagoon
      else if (ox >= -4 && ox <= -2 && oy >= mapSize + 1 && oy <= mapSize + 3) {
        type = 'dirt';
        if (ox === -3 && oy === mapSize + 2) deco = 'camp_tent';
        else if (ox === -2 && oy === mapSize + 2) deco = 'tree_palm';
        else if (r > 0.45) deco = 'tree_palm';
      }
      // OPEN OUTFIELD OCEAN WATER PROPS (Bobbing Boats, Beacons, Sea Stacks)
      else {
        if (r > 0.94) {
          deco = 'buoy';
        } else if (r > 0.89 && r <= 0.94) {
          deco = 'boat';
        } else if (r > 0.83 && r <= 0.89) {
          deco = 'rock';
        }
      }

      outfieldGrid[oy][ox] = { x: ox, y: oy, type, deco, tint, isOutfield: true };
    }
  }

  // 5. Ensure all teams and airdrops spawn safely on open grass/dirt land
  teams.forEach(t => {
    if (mapGrid[t.y] && mapGrid[t.y][t.x]) {
      const tile = mapGrid[t.y][t.x];
      if (tile.type === 'water' || (tile.deco && tile.deco.startsWith('building_'))) {
        for (let r = 1; r <= 4; r++) {
          let found = false;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const nx = Math.max(1, Math.min(mapSize - 2, t.x + dx));
              const ny = Math.max(1, Math.min(mapSize - 2, t.y + dy));
              const cand = mapGrid[ny] && mapGrid[ny][nx];
              if (cand && cand.type !== 'water' && (!cand.deco || !cand.deco.startsWith('building_'))) {
                t.x = nx;
                t.y = ny;
                t.renderX = nx;
                t.renderY = ny;
                t.prevX = nx;
                t.prevY = ny;
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (found) break;
        }
      }
      if (mapGrid[t.y][t.x] && !mapGrid[t.y][t.x].deco?.startsWith('building_')) {
        mapGrid[t.y][t.x].deco = null;
      }
    }
  });

  airdrops.forEach(ad => {
    if (mapGrid[ad.y] && mapGrid[ad.y][ad.x]) {
      const tile = mapGrid[ad.y][ad.x];
      if (tile.type === 'water' || (tile.deco && tile.deco.startsWith('building_'))) {
        ad.y = Math.max(1, ad.y - 2);
      }
      mapGrid[ad.y][ad.x].deco = null;
    }
  });
}

// ----------------------------------------------------------------------------
// 6. ANIMATION ENGINE
// ----------------------------------------------------------------------------
function animateTeamMovement(team, targetX, targetY, onComplete) {
  isInputLocked = true;
  team.isMoving = true;
  const startX = team.x;
  const startY = team.y;

  // Update facing direction based on isometric screen movement
  const dx = targetX - startX;
  const dy = targetY - startY;
  const screenDeltaX = dx - dy;
  if (screenDeltaX > 0) team.facing = 1;
  else if (screenDeltaX < 0) team.facing = -1;

  team.prevX = startX;
  team.prevY = startY;
  team.x = targetX;
  team.y = targetY;

  const MR = window.MapRenderer;
  MR.spawnDustPuff(startX, startY, 6);
  AudioManager.play('move');

  const duration = 360;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / duration);
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    team.renderX = startX + (targetX - startX) * ease;
    team.renderY = startY + (targetY - startY) * ease;
    team.walkPhase = t;
    team.hopZ = Math.sin(t * Math.PI) * 16 + Math.abs(Math.sin(t * Math.PI * 2)) * 4;

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      team.renderX = targetX;
      team.renderY = targetY;
      team.hopZ = 0;
      team.isMoving = false;
      team.walkPhase = 0;
      MR.spawnDustPuff(targetX, targetY, 5);
      isInputLocked = false;
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(step);
}

function getReachableTiles(team) {
  if (!team || !team.alive || team.mp <= 0 || team.isFrozen) return [];
  const reachable = [];
  const visited = new Set();
  visited.add(`${team.x},${team.y}`);

  const d1 = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
    { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
  ];

  const validStep1 = [];

  // Range 1 (Cost 1 MP)
  d1.forEach(d => {
    const nx = team.x + d.dx;
    const ny = team.y + d.dy;
    if (nx >= 0 && nx < mapSize && ny >= 0 && ny < mapSize) {
      const tile = mapGrid[ny] && mapGrid[ny][nx];
      const isSolid = tile && (tile.type === 'water' || (tile.deco && tile.deco.startsWith('building_')));
      if (tile && !isSolid) {
        reachable.push({ x: nx, y: ny, cost: 1, dist: 1 });
        validStep1.push({ x: nx, y: ny });
        visited.add(`${nx},${ny}`);
      }
    }
  });

  // Range 2 (Cost 2 MP - requires team.mp >= 2)
  if (team.mp >= 2) {
    validStep1.forEach(s1 => {
      d1.forEach(d => {
        const nx2 = s1.x + d.dx;
        const ny2 = s1.y + d.dy;
        const key = `${nx2},${ny2}`;
        if (nx2 >= 0 && nx2 < mapSize && ny2 >= 0 && ny2 < mapSize && !visited.has(key)) {
          const tile = mapGrid[ny2] && mapGrid[ny2][nx2];
          const isSolid = tile && (tile.type === 'water' || (tile.deco && tile.deco.startsWith('building_')));
          if (tile && !isSolid) {
            reachable.push({ x: nx2, y: ny2, cost: 2, dist: 2 });
            visited.add(key);
          }
        }
      });
    });
  }

  return reachable;
}

// ----------------------------------------------------------------------------
// 7. MAIN ARENA RENDER LOOP (THROTTLED AT 30 FPS + PRE-RENDERED BACKGROUND)
// ----------------------------------------------------------------------------
let lastRenderTime = 0;
const TARGET_FPS = 30;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // ~33.33ms

function renderArena(currentTime = 0) {
  requestAnimationFrame(renderArena);

  // Skip frame if not on gameplay screen (saves 100% CPU when in Lobby, Prep, or End screen)
  const gameView = document.getElementById('view-game');
  if (!gameView || gameView.classList.contains('hidden')) {
    return;
  }

  // Frame limiter: Throttle to maximum 30 FPS
  const elapsed = currentTime - lastRenderTime;
  if (elapsed < FRAME_INTERVAL_MS) {
    return;
  }
  lastRenderTime = currentTime - (elapsed % FRAME_INTERVAL_MS);

  const MR = window.MapRenderer;
  if (!MR) return;

  animTick++;

  // 1. Draw pre-rendered static background (Offscreen canvas blit!)
  // Draws all tiles, grid, water, and static environment props in ONE single GPU drawImage call!
  MR.drawStaticBackground(ctx);

  const currentTeam = teams[activeTeamIndex];

  // 2. Tactical Movement Highlights for Current Active Team (1 MP and 2 MP Reachable Tiles)
  if (currentTeam && currentTeam.alive && currentTeam.mp > 0 && !currentTeam.isMoving && !hasMovedThisTurn && !currentTeam.isFrozen) {
    const reachable = getReachableTiles(currentTeam);
    reachable.forEach(t => {
      MR.drawTacticalMoveHighlight(ctx, t.x, t.y, `${t.cost} MP`);
    });
  }

  // 3. Dynamic entities (Airdrops & Chibi Avatars)
  const renderables = [];
  airdrops.forEach(ad => {
    renderables.push({ depth: ad.x + ad.y + 0.1, type: 'airdrop', x: ad.x, y: ad.y });
  });

  teams.forEach((t, idx) => {
    if (t.alive) {
      renderables.push({ depth: t.renderX + t.renderY + 0.2, type: 'avatar', team: t, isTurn: idx === activeTeamIndex });
    }
  });

  renderables.sort((a, b) => a.depth - b.depth);
  renderables.forEach(item => {
    if (item.type === 'airdrop') MR.drawAirdropCrate(ctx, item.x, item.y);
    else if (item.type === 'avatar') MR.drawChibiTeamAvatar(ctx, item.team, item.isTurn);
  });

  // 4. Floating texts, Safe Zone Ring & Atmospheric clouds
  MR.updateAndDrawParticlesAndFloatingText(ctx);
  MR.drawSafeZoneBoundaryRing(ctx);
  if (typeof MR.drawAtmosphericClouds === 'function') {
    MR.drawAtmosphericClouds(ctx);
  }
}

// ----------------------------------------------------------------------------
// 8. 1v1 DUEL BATTLE STAGE
// ----------------------------------------------------------------------------
const duelCanvas = document.getElementById('duel-stage-canvas');
const duelCtx = duelCanvas.getContext('2d');
let duelState = {
  active: false,
  team1: null,
  team2: null,
  phase: 'idle',
  attackerSide: 1,
  progress: 0,
  shakeX: 0,
  shakeY: 0
};

function startDuelStageLoop(team1, team2) {
  duelState = {
    active: true,
    team1,
    team2,
    phase: 'idle',
    attackerSide: 1,
    progress: 0,
    shakeX: 0,
    shakeY: 0
  };
  const MR = window.MapRenderer;
  requestAnimationFrame(() => MR.renderDuelStage(duelCtx, duelCanvas, duelState));
}

function playDuelAttackAnimation(winnerTeam, loserTeam) {
  duelState.phase = 'attack';
  duelState.attackerSide = (winnerTeam.id === duelState.team1.id) ? 1 : 2;
  duelState.progress = 0;

  winnerTeam.isAttacking = true;
  loserTeam.isHurt = true;
  setTimeout(() => {
    winnerTeam.isAttacking = false;
    loserTeam.isHurt = false;
  }, 1800);

  const bannerWrap = document.getElementById('duel-Overlay-Banner');
  const bannerPill = document.getElementById('duel-banner-pill');
  bannerWrap.classList.remove('hidden');
  bannerPill.className = 'px-5 py-1.5 rounded-full font-game text-sm md:text-base tracking-wide text-white shadow-xl border border-amber-300/60 bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 animate-bounce';
  bannerPill.innerHTML = `⚔️ ${winnerTeam.name} menyerang ${loserTeam.name}! (-25 LP)`;
  AudioManager.play('clash');
}

// ----------------------------------------------------------------------------
// 9. HUD DISPLAY LOGIC
// ----------------------------------------------------------------------------
function renderHUD() {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const lbContainer = document.getElementById('hud-leaderboard');
  lbContainer.innerHTML = sorted.map((t, i) => `
    <div class="flex items-center justify-between px-2.5 py-1.5 rounded-xl ${t.id === activeTeamIndex ? 'bg-cyan-500/20 border border-cyan-400/40' : 'bg-slate-900/40'}">
      <div class="flex items-center gap-2">
        <span class="text-xs font-extrabold text-slate-400">#${i + 1}</span>
        <span class="w-2 h-2 rounded-full" style="background:${t.color}"></span>
        <span class="text-xs font-bold text-white truncate max-w-[95px]">${t.name.split(' ')[0]} ${t.name.split(' ')[1] || ''}</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="text-xs font-extrabold text-cyan-300">${t.score.toLocaleString()} PTS</span>
        <span class="text-[10px] text-slate-400">${t.kills} ⚔️</span>
      </div>
    </div>
  `).join('');

  document.getElementById('alive-counter').textContent = `${teams.filter(t => t.alive).length} TEAMS ALIVE`;

  const cardsContainer = document.getElementById('hud-team-cards');
  cardsContainer.innerHTML = teams.map((t, idx) => {
    const isTurn = idx === activeTeamIndex;
    const barColor = t.lp > 60 ? 'bg-emerald-400' : t.lp > 30 ? 'bg-amber-400' : 'bg-rose-500';

    let statusPills = '';
    if (t.hasArmor) {
      statusPills += '<span class="px-1.5 py-0.5 text-[8.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded shrink-0">🛡️ ARMOR</span>';
    }
    if (t.stealthTurns > 0) {
      statusPills += `<span class="px-1.5 py-0.5 text-[8.5px] font-black bg-teal-500/20 text-teal-300 border border-teal-400/30 rounded shrink-0">🌿 STEALTH (${t.stealthTurns})</span>`;
    }
    if (t.item && TACTICAL_ITEMS[t.item]) {
      const it = TACTICAL_ITEMS[t.item];
      statusPills += `<span class="px-1.5 py-0.5 text-[8.5px] font-bold ${it.bgBadge} ${it.textColor} border ${it.borderColor} rounded shrink-0" title="${it.name}">${it.emoji} ${it.shortName}</span>`;
    }

    return `
      <div class="glass-hud rounded-2xl p-3.5 transition-all ${isTurn ? 'border-2 border-cyan-400 shadow-lg shadow-cyan-500/20' : 'opacity-90'}">
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center font-game font-bold text-slate-950 text-sm shrink-0" style="background:${t.color}">
              ${t.badge}
            </div>
            <div class="min-w-0 truncate">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-xs text-white truncate">${t.name}</span>
                ${isTurn ? '<span class="px-1.5 py-0.5 text-[9px] font-extrabold bg-cyan-400 text-slate-950 rounded shrink-0">GILIRAN</span>' : ''}
                ${t.isFrozen || t.skipTurn ? '<span class="px-1.5 py-0.5 text-[9px] font-black bg-sky-400 text-slate-950 rounded animate-pulse shrink-0">❄️ SKIP TURN</span>' : ''}
                ${statusPills}
              </div>
              <div class="text-[10px] text-slate-400 truncate">Pilot: ${t.pilot} | Tile (${t.x},${t.y})</div>
            </div>
          </div>
          ${!isTurn && t.alive ? `<button onclick="openDiplomacyModal(${t.id})" title="Donasi Bantuan ke ${t.name}" class="px-2 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/40 border border-purple-400/40 text-[9.5px] font-bold text-purple-200 flex items-center gap-1 transition active:scale-95 shrink-0"><i class="fa-solid fa-gift text-[9px]"></i> Bantuan</button>` : ''}
        </div>

        <div class="space-y-1 mb-2">
          <div class="flex justify-between text-[10px] font-bold">
            <span class="text-slate-300">HEALTH (LP)</span>
            <span class="${t.lp <= 30 ? 'text-rose-400' : 'text-emerald-300'}">LP: ${t.lp}/100</span>
          </div>
          <div class="w-full h-2 bg-slate-950/90 rounded-full overflow-hidden border border-white/10">
            <div class="${barColor} h-full transition-all duration-300" style="width: ${Math.max(0, t.lp)}%"></div>
          </div>
        </div>

        <div class="flex items-center justify-between text-[11px] font-bold pt-1 border-t border-white/10">
          <span class="text-slate-400">MOVEMENT (MP)</span>
          <span class="text-cyan-300 flex items-center gap-1">
            <i class="fa-solid fa-bolt text-xs"></i> ${t.mp}/${t.maxMp} MP
          </span>
        </div>
      </div>
    `;
  }).join('');

  const activeTeam = teams[activeTeamIndex];
  if (activeTeam) {
    let actionMsg = '';
    if (activeTeam.isFrozen || activeTeam.skipTurn) {
      actionMsg = `GILIRAN: ${activeTeam.name.toUpperCase()} — ❄️ TER-FREEZE / EMP! GILIRAN DILEWATI...`;
    } else if (activeTeam.mp >= 2) {
      actionMsg = `GILIRAN: ${activeTeam.name.toUpperCase()} — PILIH 1 TILE [1 MP] ATAU 2 TILE [2 MP] / ALIANSI / TOKO`;
    } else if (activeTeam.mp === 1) {
      actionMsg = `GILIRAN: ${activeTeam.name.toUpperCase()} — PILIH 1 TILE [1 MP] / BUKA ALIANSI / TOKO / SKIP TURN`;
    } else {
      actionMsg = `GILIRAN: ${activeTeam.name.toUpperCase()} — MP HABIS! BUKA TOKO / MINTA BANTUAN ALIANSI / SKIP TURN`;
    }
    document.getElementById('hud-turn-banner').textContent = actionMsg;

    const sectorEl = document.getElementById('hud-sector-display');
    if (sectorEl && typeof findNearestPOI === 'function') {
      const poi = findNearestPOI(activeTeam.x, activeTeam.y);
      sectorEl.innerHTML = `SEKTOR: <b class="text-white">${poi.name.toUpperCase()}</b> • TILE (${activeTeam.x}, ${activeTeam.y})`;
    }

    // Dynamic Tactical Inventory Slot in Action Panel
    const invSlotEl = document.getElementById('hud-inventory-slot');
    if (invSlotEl) {
      if (!activeTeam.item) {
        invSlotEl.innerHTML = `
          <div class="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-dashed border-white/15 text-slate-500">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 text-xs">
                <i class="fa-solid fa-box-open"></i>
              </div>
              <div class="text-left">
                <span class="text-[11px] font-extrabold tracking-wider text-slate-400">KOSONG</span>
                <div class="text-[9px] text-slate-500">Ambil Airdrop untuk item</div>
              </div>
            </div>
            <span class="text-[8.5px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-bold uppercase">1 SLOT</span>
          </div>
        `;
      } else {
        const itemDef = TACTICAL_ITEMS[activeTeam.item];
        invSlotEl.innerHTML = `
          <div class="p-2 rounded-xl bg-gradient-to-r from-slate-900 to-slate-950 border-2 ${itemDef.borderColor} shadow-lg space-y-1.5 animate-pop">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-8 h-8 rounded-lg ${itemDef.bgBadge} border ${itemDef.borderColor} flex items-center justify-center text-sm shrink-0">
                  <i class="${itemDef.icon} ${itemDef.textColor}"></i>
                </div>
                <div class="min-w-0 truncate text-left">
                  <div class="font-bold text-xs text-white truncate">${itemDef.emoji} ${itemDef.shortName}</div>
                  <div class="text-[9px] ${itemDef.textColor} font-semibold truncate">${itemDef.badgeText}</div>
                </div>
              </div>
              <span class="text-[8.5px] px-1.5 py-0.5 rounded ${itemDef.bgBadge} ${itemDef.textColor} border ${itemDef.borderColor} font-bold uppercase shrink-0">1x PAKAI</span>
            </div>
            <button onclick="useActiveTeamItem()" class="w-full py-1.5 px-2 rounded-lg bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 font-game font-black text-[11px] tracking-wide shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fa-solid fa-play text-[10px]"></i> GUNAKAN ITEM
            </button>
          </div>
        `;
      }
    }
  }

  // Update Minimized Team Status HUD Trigger
  const minCountEl = document.getElementById('hud-team-min-count');
  if (minCountEl) minCountEl.textContent = `${teams.filter(t => t.alive).length}`;
  const minActiveEl = document.getElementById('hud-team-min-active');
  if (minActiveEl && activeTeam) {
    minActiveEl.innerHTML = `<span style="color:${activeTeam.color}">●</span> ${activeTeam.name.split(' ')[0]} Turn`;
  }
}

// ----------------------------------------------------------------------------
// TOGGLE TEAM STATUS HUD (MINIMIZE / MAXIMIZE)
// ----------------------------------------------------------------------------
let isTeamHUDExpanded = true;
function toggleTeamHUD(forceState) {
  if (typeof forceState === 'boolean') {
    isTeamHUDExpanded = forceState;
  } else {
    isTeamHUDExpanded = !isTeamHUDExpanded;
  }
  const expandedPanel = document.getElementById('hud-team-expanded-panel');
  const minBtn = document.getElementById('hud-team-minimized-btn');
  if (!expandedPanel || !minBtn) return;

  if (isTeamHUDExpanded) {
    expandedPanel.classList.remove('hidden');
    expandedPanel.classList.add('animate-pop');
    minBtn.classList.add('hidden');
    minBtn.classList.remove('flex', 'animate-pop');
    if (typeof AudioManager !== 'undefined') AudioManager.play('click');
  } else {
    expandedPanel.classList.add('hidden');
    expandedPanel.classList.remove('animate-pop');
    minBtn.classList.remove('hidden');
    minBtn.classList.add('flex', 'animate-pop');
    if (typeof AudioManager !== 'undefined') AudioManager.play('click');
  }
}
window.toggleTeamHUD = toggleTeamHUD;

// Keyboard shortcut (H) to toggle Team HUD visibility
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
  if (e.key === 'h' || e.key === 'H') {
    const gameSection = document.getElementById('view-game');
    if (gameSection && !gameSection.classList.contains('hidden')) {
      toggleTeamHUD();
    }
  }
});

// ----------------------------------------------------------------------------
// 10. MOUSE & TOUCH CONTROLS
// ----------------------------------------------------------------------------
isoCanvas.addEventListener('mousedown', e => {
  isDragging = true;
  dragStartX = e.clientX - camX;
  dragStartY = e.clientY - camY;
});

window.addEventListener('mousemove', e => {
  const MR = window.MapRenderer;
  if (!MR) return;
  const rect = isoCanvas.getBoundingClientRect();
  const t = MR.screenToTile(e.clientX - rect.left, e.clientY - rect.top);
  if (t.x >= 0 && t.x < mapSize && t.y >= 0 && t.y < mapSize) {
    hoveredTile = t;
    const sectorEl = document.getElementById('hud-sector-display');
    if (sectorEl && typeof findNearestPOI === 'function') {
      const poi = findNearestPOI(t.x, t.y);
      sectorEl.innerHTML = `SEKTOR: <b class="text-white">${poi.name.toUpperCase()}</b> • TILE (${t.x}, ${t.y})`;
    }
  } else {
    hoveredTile = null;
    const activeTeam = teams[activeTeamIndex];
    const sectorEl = document.getElementById('hud-sector-display');
    if (sectorEl && activeTeam && typeof findNearestPOI === 'function') {
      const poi = findNearestPOI(activeTeam.x, activeTeam.y);
      sectorEl.innerHTML = `SEKTOR: <b class="text-white">${poi.name.toUpperCase()}</b> • TILE (${activeTeam.x}, ${activeTeam.y})`;
    }
  }

  if (isDragging) {
    camX = e.clientX - dragStartX;
    camY = e.clientY - dragStartY;
    if (window.MapRenderer && window.MapRenderer.invalidateBackground) {
      window.MapRenderer.invalidateBackground();
    }
  }
});

window.addEventListener('mouseup', () => { isDragging = false; });

// Touch Drag Support for Smart TV / Interactive Whiteboards
isoCanvas.addEventListener('touchstart', e => {
  if (e.touches.length === 1) {
    isDragging = true;
    dragStartX = e.touches[0].clientX - camX;
    dragStartY = e.touches[0].clientY - camY;
  }
}, { passive: true });

window.addEventListener('touchmove', e => {
  if (isDragging && e.touches.length === 1) {
    camX = e.touches[0].clientX - dragStartX;
    camY = e.touches[0].clientY - dragStartY;
    if (window.MapRenderer && window.MapRenderer.invalidateBackground) {
      window.MapRenderer.invalidateBackground();
    }
  }
}, { passive: true });

window.addEventListener('touchend', () => { isDragging = false; });

isoCanvas.addEventListener('click', e => {
  const MR = window.MapRenderer;
  if (!MR || isInputLocked || hasMovedThisTurn || !hoveredTile) return;
  const team = teams[activeTeamIndex];
  if (!team || !team.alive || team.mp <= 0 || team.isFrozen) return;

  const reachable = getReachableTiles(team);
  const matched = reachable.find(t => t.x === hoveredTile.x && t.y === hoveredTile.y);
  if (!matched) return;

  const destX = matched.x;
  const destY = matched.y;
  team.mp -= matched.cost;
  hasMovedThisTurn = true;
  if (mapGrid[destY][destX].deco === 'bush') {
    mapGrid[destY][destX].deco = null;
    if (window.MapRenderer && window.MapRenderer.invalidateBackground) {
      window.MapRenderer.invalidateBackground();
    }
  }
  renderHUD();

  animateTeamMovement(team, destX, destY, () => {
    const enemy = teams.find(other => other.id !== team.id && other.alive && other.x === team.x && other.y === team.y);
    const adIdx = airdrops.findIndex(a => a.x === team.x && a.y === team.y);

    // Scenario 1: Both an Enemy Team AND an AirDrop are present on this tile!
    // Triggers Contested Airdrop Clash with Ready Screen
    if (enemy && adIdx !== -1) {
      triggerChallengeModal(team, enemy, { isAirdropClash: true, airdropIndex: adIdx });
      return;
    }

    // Scenario 2: Enemy Team on regular tile (1v1 Challenge with Ready Screen)
    if (enemy) {
      triggerChallengeModal(team, enemy, { isAirdropClash: false });
      return;
    }

    // Scenario 3: AirDrop tile without enemy
    if (adIdx !== -1) {
      airdrops.splice(adIdx, 1);
      triggerQuestionModal(team, 'airdrop');
      return;
    }

    // Scenario 4: Regular Tile Question
    triggerQuestionModal(team, 'regular');
  });
});

// ----------------------------------------------------------------------------
// 11. QUESTION MODAL CONTROLLER & OPTION RANDOMIZER
// ----------------------------------------------------------------------------
let activeModalQuestion = null;

/**
 * Randomize/shuffle options of a question on-the-fly when presented to players,
 * while safely keeping track of the updated correct answer index.
 * Does not mutate the master question bank array.
 */
function shuffleQuestionOptions(qObj) {
  if (!qObj || !Array.isArray(qObj.opts)) return qObj;

  const items = qObj.opts.map((optText, origIdx) => ({
    text: optText,
    isCorrect: origIdx === qObj.ans
  }));

  // Fisher-Yates modern shuffle
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  const newAnsIndex = items.findIndex(item => item.isCorrect);

  return {
    q: qObj.q,
    type: qObj.type,
    opts: items.map(item => item.text),
    ans: newAnsIndex >= 0 ? newAnsIndex : 0
  };
}

function triggerQuestionModal(team, mode) {
  const modal = document.getElementById('question-modal');
  const feedbackBox = document.getElementById('q-feedback-box');
  feedbackBox.classList.add('hidden');

  const pool = questions.filter(q => q.type === mode);
  const rawQ = (pool.length ? pool : questions)[Math.floor(Math.random() * (pool.length || questions.length))];
  const qObj = shuffleQuestionOptions(rawQ);
  activeModalQuestion = qObj;

  document.getElementById('q-modal-badge').textContent = mode === 'airdrop'
    ? '🎁 SPECIAL AIRDROP CRATE (+300 PTS, +1 MP, & 1 RANDOM TACTICAL ITEM)'
    : '❓ TILE QUESTION (BENAR: +100 PTS & +1 MP | SALAH: -20 LP)';
  document.getElementById('q-modal-team').textContent = team.name;
  document.getElementById('q-modal-text').textContent = qObj.q;

  const optsDiv = document.getElementById('q-modal-options');
  optsDiv.innerHTML = qObj.opts.map((opt, idx) => `
    <button id="q-opt-btn-${idx}" onclick="selectQuestionOption(${idx}, ${qObj.ans}, '${mode}')" class="w-full text-left px-4 py-3 rounded-xl bg-slate-900 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400 text-sm font-semibold transition flex items-center gap-3 cursor-pointer">
      <span class="w-7 h-7 rounded-lg bg-slate-800 text-cyan-300 flex items-center justify-center text-xs font-bold shrink-0">${['A','B','C','D'][idx]}</span>
      <span class="flex-1">${opt}</span>
    </button>
  `).join('');

  // Handle Smart Glasses (50:50)
  const glassesBox = document.getElementById('q-smartglasses-container');
  if (glassesBox) {
    if (team.smartGlassesArmed) {
      glassesBox.classList.add('hidden');
      team.smartGlassesArmed = false;
      setTimeout(() => applySmartGlassesElimination(qObj.ans), 350);
    } else if (team.item === 'smartglasses') {
      glassesBox.classList.remove('hidden');
    } else {
      glassesBox.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
  if (mode === 'airdrop') {
    audioManager.play('airdrop');
  }
}

function selectQuestionOption(selectedIdx, correctIdx, mode) {
  const MR = window.MapRenderer;
  const isCorrect = selectedIdx === correctIdx;
  const team = teams[activeTeamIndex];
  const letters = ['A', 'B', 'C', 'D'];

  // Hide 50:50 smart glasses button once option is clicked
  const glassesBox = document.getElementById('q-smartglasses-container');
  if (glassesBox) glassesBox.classList.add('hidden');

  let wasSavedByArmor = false;

  for (let i = 0; i < 4; i++) {
    const btn = document.getElementById(`q-opt-btn-${i}`);
    if (!btn) continue;
    btn.disabled = true;
    btn.onclick = null;
    if (i === correctIdx) {
      btn.className = 'w-full text-left px-4 py-3 rounded-xl bg-emerald-500/25 border-2 border-emerald-400 text-sm font-bold text-emerald-200 flex items-center gap-3';
    } else if (i === selectedIdx && !isCorrect) {
      btn.className = 'w-full text-left px-4 py-3 rounded-xl bg-rose-500/25 border-2 border-rose-500 text-sm font-bold text-rose-200 flex items-center gap-3';
    } else {
      btn.className = 'w-full text-left px-4 py-3 rounded-xl bg-slate-900/40 border border-white/5 text-sm text-slate-500 flex items-center gap-3 opacity-60';
    }
  }

  if (isCorrect) {
    team.correct += 1;
    AudioManager.play('correct');
    if (mode === 'airdrop') {
      const itemKeys = ['awm', 'emp', 'armor', 'ghillie', 'adrenaline', 'smartglasses', 'bandage'];
      const rolledKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
      const itemDef = TACTICAL_ITEMS[rolledKey];
      team.item = rolledKey;

      team.score += 300;
      team.mp = Math.min(team.maxMp, team.mp + 1);
      // NOTE: Automatic LP restoration from answering correctly or airdrop is replaced purely by Bandage per user prompt!
      MR.spawnFloatingText(team.x, team.y, `🎁 ${itemDef.emoji} ${itemDef.shortName.toUpperCase()}!`, '#facc15');
      MR.spawnFloatingText(team.x, team.y, '+300 PTS', '#4ade80');
    } else {
      team.score += 100;
      team.mp = Math.min(team.maxMp, team.mp + 1);
      MR.spawnFloatingText(team.x, team.y, '✓ BENAR! +100 PTS | +1 MP', '#4ade80');
    }
    team.isAttacking = true;
    setTimeout(() => { team.isAttacking = false; }, 1800);
  } else {
    AudioManager.play('wrong');
    if (mode === 'airdrop') {
      MR.spawnFloatingText(team.x, team.y, '✖ GAGAL AIRDROP! TERPENTAL', '#fb7185');
    } else {
      if (team.hasArmor) {
        team.hasArmor = false; // Level 3 Armor blocks penalty and breaks!
        wasSavedByArmor = true;
        MR.spawnFloatingText(team.x, team.y, '🛡️ ARMOR MENAHAN PENALTI LP! (PECAH)', '#34d399');
      } else {
        team.lp = Math.max(0, team.lp - 20);
        if (team.lp === 0) team.alive = false;
        MR.spawnFloatingText(team.x, team.y, '✖ SALAH! -20 LP', '#f43f5e');
      }
    }
    team.isHurt = true;
    setTimeout(() => { team.isHurt = false; }, 2500);
  }
  renderHUD();

  const feedbackBox = document.getElementById('q-feedback-box');
  const feedbackIcon = document.getElementById('q-feedback-icon');
  const feedbackTitle = document.getElementById('q-feedback-title');
  const feedbackDesc = document.getElementById('q-feedback-desc');
  const feedbackBtn = document.getElementById('q-feedback-btn');

  feedbackBox.classList.remove('hidden');

  if (isCorrect) {
    feedbackBox.className = 'rounded-2xl p-4 border-2 border-emerald-400/50 bg-emerald-950/60 space-y-3 animate-pop';
    feedbackIcon.className = 'w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center text-xl shrink-0';
    feedbackIcon.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
    feedbackTitle.className = 'font-game text-lg text-emerald-300';
    feedbackTitle.textContent = 'JAWABAN BENAR! LUAR BIASA!';
    if (mode === 'airdrop') {
      const it = TACTICAL_ITEMS[team.item];
      feedbackDesc.innerHTML = `${team.name} berhasil membuka Airdrop Crate!<br>Mendapatkan <b>+300 Skor</b>, <b>+1 MP</b>, dan <b>1 Tactical Item: <span class="text-amber-300 font-bold">${it ? it.emoji + ' ' + it.name : 'Tactical Item'}</span></b>! Cek inventory di Action Panel untuk menggunakannya.`;
    } else {
      feedbackDesc.textContent = `${team.name} mendapatkan +100 Skor dan tambahan +1 Move Point (MP) untuk giliran berikutnya!`;
    }
    feedbackBtn.className = 'w-full py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 font-game font-bold text-sm text-slate-950 shadow-lg cursor-pointer';
  } else {
    feedbackBox.className = 'rounded-2xl p-4 border-2 border-rose-500/50 bg-rose-950/60 space-y-3 animate-pop';
    feedbackIcon.className = 'w-11 h-11 rounded-2xl bg-rose-500/20 border border-rose-400 text-rose-300 flex items-center justify-center text-xl shrink-0';
    feedbackIcon.innerHTML = '<i class="fa-solid fa-circle-xmark"></i>';
    feedbackTitle.className = 'font-game text-lg text-rose-300';
    feedbackTitle.textContent = `JAWABAN SALAH! (Kunci: Opsi ${letters[correctIdx]})`;
    if (mode === 'airdrop') {
      feedbackDesc.textContent = `Sayang sekali! ${team.name} gagal membuka Airdrop dan terpental kembali ke tile sebelumnya.`;
    } else if (wasSavedByArmor) {
      feedbackDesc.textContent = `Jawaban salah, namun berkat LEVEL 3 ARMOR, ${team.name} tidak terkena pengurangan LP! Armor telah hancur setelah melindungi tim.`;
    } else {
      feedbackDesc.textContent = `Sayang sekali! ${team.name} menjawab salah (-20 LP) dan harus mundur ke posisi tile sebelumnya!`;
    }
    feedbackBtn.className = 'w-full py-2.5 rounded-xl bg-rose-400 hover:bg-rose-300 font-game font-bold text-sm text-slate-950 shadow-lg cursor-pointer';
  }

  feedbackBtn.onclick = () => {
    document.getElementById('question-modal').classList.add('hidden');
    if (!isCorrect) {
      animateTeamMovement(team, team.prevX, team.prevY, () => advanceToNextTeamTurn());
    } else {
      advanceToNextTeamTurn();
    }
  };
}

// ----------------------------------------------------------------------------
// 12. 1v1 CHALLENGE CONTROLLER & KNOCKBACK SYSTEM
// ----------------------------------------------------------------------------
let challengeTimerInterval = null;
let challengeTimeRemaining = 10;
let challengeRound = {
  active: false,
  team1: null,
  team2: null,
  qObj: null,
  t1Answered: false,
  t1Correct: false,
  t1Frozen: false,
  t2Answered: false,
  t2Correct: false,
  t2Frozen: false,
  resolved: false
};

function knockbackTeam(team, fromX, fromY) {
  // If team has a valid prevX, prevY different from current position, fling them back there!
  if (team.prevX !== undefined && (team.prevX !== team.x || team.prevY !== team.y)) {
    animateTeamMovement(team, team.prevX, team.prevY);
    return;
  }
  // Otherwise calculate 1 tile away opposite to attacker direction
  const dx = Math.sign(team.x - fromX) || 1;
  const dy = Math.sign(team.y - fromY) || 0;
  let targetX = Math.max(1, Math.min(mapSize - 2, team.x + dx));
  let targetY = Math.max(1, Math.min(mapSize - 2, team.y + dy));

  const targetTile = mapGrid[targetY] && mapGrid[targetY][targetX];
  if (targetTile && targetTile.type !== 'water') {
    animateTeamMovement(team, targetX, targetY);
  } else {
    const adj = [
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: -1, dy: 0 }
    ];
    for (let d of adj) {
      const tx = Math.max(1, Math.min(mapSize - 2, team.x + d.dx));
      const ty = Math.max(1, Math.min(mapSize - 2, team.y + d.dy));
      if (mapGrid[ty] && mapGrid[ty][tx] && mapGrid[ty][tx].type !== 'water') {
        animateTeamMovement(team, tx, ty);
        break;
      }
    }
  }
}

function triggerChallengeModal(team1, team2, options = {}) {
  const modal = document.getElementById('challenge-modal');
  document.getElementById('duel-Overlay-Banner').classList.add('hidden');
  document.getElementById('c-continue-wrap').classList.add('hidden');

  if (challengeTimerInterval) {
    clearInterval(challengeTimerInterval);
    challengeTimerInterval = null;
  }

  const isAirdropClash = !!options.isAirdropClash;
  const airdropIndex = options.airdropIndex !== undefined ? options.airdropIndex : -1;

  const rawQ = questions[Math.floor(Math.random() * questions.length)];
  const qObj = shuffleQuestionOptions(rawQ);

  challengeRound = {
    active: true,
    team1,
    team2,
    qObj,
    t1Answered: false,
    t1Correct: false,
    t1Frozen: false,
    t2Answered: false,
    t2Correct: false,
    t2Frozen: false,
    resolved: false,
    isAirdropClash,
    airdropIndex
  };

  // Badge styling based on clash type
  const badgeEl = document.getElementById('c-modal-badge');
  if (badgeEl) {
    if (isAirdropClash) {
      badgeEl.className = 'px-3.5 py-1 rounded-full text-xs font-black uppercase bg-amber-500/25 text-amber-300 border border-amber-400/50 flex items-center gap-1.5 shadow-md animate-pulse';
      badgeEl.innerHTML = '<i class="fa-solid fa-parachute-box text-amber-400 text-sm"></i> CLASH REBUTAN AIRDROP! (1v1 CONTEST)';
    } else {
      badgeEl.className = 'px-3.5 py-1 rounded-full text-xs font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1.5 shadow-md';
      badgeEl.innerHTML = '<i class="fa-solid fa-bolt text-rose-400"></i> CLASH IN THE SAME TILE! (1v1 CHALLENGE)';
    }
  }

  // Populate Ready Screen details
  const readyDesc = document.getElementById('c-ready-desc');
  if (readyDesc) {
    if (isAirdropClash) {
      readyDesc.innerHTML = `🎁 <b>PEREBUTAN AIRDROP!</b> Kedua tim berada di kotak Airdrop yang sama. Pemenang duel akan memukul mundur lawan (+250 Skor) dan langsung membuka kotak Airdrop (+300 Skor &amp; 1 Tactical Item)!`;
    } else {
      readyDesc.innerHTML = `⚔️ <b>BENTROKAN TILE!</b> Kedua tim berada di koordinat yang sama. Tim yang menjawab paling cepat &amp; tepat akan menang (+250 Skor) dan melempar tim lawan 1 tile ke belakang (-25 LP)!`;
    }
  }

  const rT1Badge = document.getElementById('c-ready-t1-badge');
  const rT1Name = document.getElementById('c-ready-t1-name');
  const rT1Pilot = document.getElementById('c-ready-t1-pilot');
  const rT1Lp = document.getElementById('c-ready-t1-lp');
  if (rT1Badge) { rT1Badge.style.backgroundColor = team1.color; rT1Badge.textContent = team1.badge; }
  if (rT1Name) rT1Name.textContent = team1.name;
  if (rT1Pilot) rT1Pilot.textContent = `Pilot: ${team1.pilot}`;
  if (rT1Lp) rT1Lp.textContent = `LP: ${team1.lp}/100`;

  const rT2Badge = document.getElementById('c-ready-t2-badge');
  const rT2Name = document.getElementById('c-ready-t2-name');
  const rT2Pilot = document.getElementById('c-ready-t2-pilot');
  const rT2Lp = document.getElementById('c-ready-t2-lp');
  if (rT2Badge) { rT2Badge.style.backgroundColor = team2.color; rT2Badge.textContent = team2.badge; }
  if (rT2Name) rT2Name.textContent = team2.name;
  if (rT2Pilot) rT2Pilot.textContent = `Pilot: ${team2.pilot}`;
  if (rT2Lp) rT2Lp.textContent = `LP: ${team2.lp}/100`;

  // Reset screen visibility: Show ready screen, hide battle options until "MULAI BATTLE" is clicked!
  const readyScreen = document.getElementById('c-ready-screen');
  const battleWrap = document.getElementById('c-active-battle-wrap');
  if (readyScreen) readyScreen.classList.remove('hidden');
  if (battleWrap) battleWrap.classList.add('hidden');

  // Timer pill displays standby state
  const timerSecs = document.getElementById('c-timer-seconds');
  const timerBar = document.getElementById('c-timer-bar');
  if (timerSecs) timerSecs.textContent = '10s (SIAP)';
  if (timerBar) timerBar.style.width = '100%';

  // Populate active battle options (revealed when Start is pressed)
  document.getElementById('c-modal-text').textContent = qObj.q;
  document.getElementById('c-team1-name').textContent = `${team1.name} (LP: ${team1.lp})`;
  document.getElementById('c-team2-name').textContent = `${team2.name} (LP: ${team2.lp})`;

  const t1Status = document.getElementById('c-t1-status');
  const t2Status = document.getElementById('c-t2-status');
  if (t1Status) t1Status.innerHTML = '<span class="text-cyan-300 font-bold">Pilih jawabanmu!</span>';
  if (t2Status) t2Status.innerHTML = '<span class="text-amber-300 font-bold">Pilih jawabanmu!</span>';

  document.getElementById('c-team1-opts').innerHTML = qObj.opts.map((opt, i) => `
    <button id="c-t1-opt-${i}" onclick="handleChallengePick(1, ${i})" class="w-full text-left p-2.5 rounded-xl bg-slate-950 hover:bg-cyan-500/20 border border-white/10 text-xs font-semibold transition cursor-pointer">
      <b>${['A','B','C','D'][i]}.</b> ${opt}
    </button>
  `).join('');

  document.getElementById('c-team2-opts').innerHTML = qObj.opts.map((opt, i) => `
    <button id="c-t2-opt-${i}" onclick="handleChallengePick(2, ${i})" class="w-full text-left p-2.5 rounded-xl bg-slate-950 hover:bg-amber-500/20 border border-white/10 text-xs font-semibold transition cursor-pointer">
      <b>${['A','B','C','D'][i]}.</b> ${opt}
    </button>
  `).join('');

  modal.classList.remove('hidden');
  startDuelStageLoop(team1, team2);
  if (isAirdropClash) {
    audioManager.play('airdrop');
  } else {
    audioManager.play('attack');
  }
}

function startChallengeBattle() {
  const readyScreen = document.getElementById('c-ready-screen');
  const battleWrap = document.getElementById('c-active-battle-wrap');
  if (readyScreen) readyScreen.classList.add('hidden');
  if (battleWrap) battleWrap.classList.remove('hidden');

  AudioManager.play('correct');

  // Start 10-Second Countdown Timer with Depleting Progress Bar
  challengeTimeRemaining = 10;
  const timerSecs = document.getElementById('c-timer-seconds');
  const timerBar = document.getElementById('c-timer-bar');
  if (timerSecs) timerSecs.textContent = '10s';
  if (timerBar) timerBar.style.width = '100%';

  if (challengeTimerInterval) {
    clearInterval(challengeTimerInterval);
    challengeTimerInterval = null;
  }

  challengeTimerInterval = setInterval(() => {
    challengeTimeRemaining -= 0.1;
    if (timerSecs) timerSecs.textContent = `${Math.max(0, Math.ceil(challengeTimeRemaining))}s`;
    if (timerBar) timerBar.style.width = `${Math.max(0, (challengeTimeRemaining / 10) * 100)}%`;

    if (challengeTimeRemaining <= 0) {
      clearInterval(challengeTimerInterval);
      challengeTimerInterval = null;
      onChallengeTimeExpired();
    }
  }, 100);
}

function handleChallengePick(side, pickedIdx) {
  if (!challengeRound.active || challengeRound.resolved) return;
  const qObj = challengeRound.qObj;
  const isCorrect = (pickedIdx === qObj.ans);

  if (side === 1) {
    if (challengeRound.t1Answered) return;
    challengeRound.t1Answered = true;
    challengeRound.t1Correct = isCorrect;

    // Highlight and disable Team 1's buttons
    for (let i = 0; i < 4; i++) {
      const b1 = document.getElementById(`c-t1-opt-${i}`);
      if (b1) {
        b1.disabled = true;
        b1.onclick = null;
        if (i === pickedIdx) {
          b1.className = isCorrect
            ? 'w-full text-left p-2.5 rounded-xl bg-emerald-500/30 border-2 border-emerald-400 text-xs font-bold text-emerald-200'
            : 'w-full text-left p-2.5 rounded-xl bg-rose-500/30 border-2 border-rose-500 text-xs font-bold text-rose-200';
        } else {
          b1.classList.add('opacity-40');
        }
      }
    }

    const t1Status = document.getElementById('c-t1-status');
    if (isCorrect) {
      if (t1Status) t1Status.innerHTML = '<span class="text-emerald-400 font-extrabold">✓ BENAR! MENANG DUEL!</span>';
      if (challengeTimerInterval) { clearInterval(challengeTimerInterval); challengeTimerInterval = null; }
      resolveChallengeVictory(challengeRound.team1, challengeRound.team2);
    } else {
      challengeRound.t1Frozen = true;
      if (t1Status) t1Status.innerHTML = '<span class="text-rose-400 font-extrabold">❄️ SALAH! TER-FREEZE (Menunggu Lawan)</span>';
      AudioManager.play('wrong');

      if (challengeRound.t2Answered && !challengeRound.t2Correct) {
        // Both teams answered wrong!
        if (challengeTimerInterval) { clearInterval(challengeTimerInterval); challengeTimerInterval = null; }
        resolveChallengeBothWrong();
      }
    }
  } else if (side === 2) {
    if (challengeRound.t2Answered) return;
    challengeRound.t2Answered = true;
    challengeRound.t2Correct = isCorrect;

    // Highlight and disable Team 2's buttons
    for (let i = 0; i < 4; i++) {
      const b2 = document.getElementById(`c-t2-opt-${i}`);
      if (b2) {
        b2.disabled = true;
        b2.onclick = null;
        if (i === pickedIdx) {
          b2.className = isCorrect
            ? 'w-full text-left p-2.5 rounded-xl bg-emerald-500/30 border-2 border-emerald-400 text-xs font-bold text-emerald-200'
            : 'w-full text-left p-2.5 rounded-xl bg-rose-500/30 border-2 border-rose-500 text-xs font-bold text-rose-200';
        } else {
          b2.classList.add('opacity-40');
        }
      }
    }

    const t2Status = document.getElementById('c-t2-status');
    if (isCorrect) {
      if (t2Status) t2Status.innerHTML = '<span class="text-emerald-400 font-extrabold">✓ BENAR! MENANG DUEL!</span>';
      if (challengeTimerInterval) { clearInterval(challengeTimerInterval); challengeTimerInterval = null; }
      resolveChallengeVictory(challengeRound.team2, challengeRound.team1);
    } else {
      challengeRound.t2Frozen = true;
      if (t2Status) t2Status.innerHTML = '<span class="text-rose-400 font-extrabold">❄️ SALAH! TER-FREEZE (Menunggu Lawan)</span>';
      AudioManager.play('wrong');

      if (challengeRound.t1Answered && !challengeRound.t1Correct) {
        // Both teams answered wrong!
        if (challengeTimerInterval) { clearInterval(challengeTimerInterval); challengeTimerInterval = null; }
        resolveChallengeBothWrong();
      }
    }
  }
}

function resolveChallengeVictory(winner, loser) {
  challengeRound.resolved = true;
  const MR = window.MapRenderer;

  winner.score += 250;
  winner.mp = Math.min(winner.maxMp, winner.mp + 1);
  winner.kills += 1;
  winner.correct += 1;

  let loserArmorAbsorbed = false;
  if (loser.hasArmor) {
    loser.hasArmor = false;
    loserArmorAbsorbed = true;
    if (MR) MR.spawnFloatingText(loser.x, loser.y, '🛡️ ARMOR MENAHAN DAMAGE DUEL! (PECAH)', '#34d399');
  } else {
    loser.lp = Math.max(0, loser.lp - 25);
    if (loser.lp === 0) loser.alive = false;
  }

  playDuelAttackAnimation(winner, loser);

  // Loser is flung back 1 tile backward!
  knockbackTeam(loser, winner.x, winner.y);

  // Handle Contested Airdrop Clash Loot!
  if (challengeRound.isAirdropClash) {
    // Delete Airdrop from map
    if (challengeRound.airdropIndex !== -1 && airdrops[challengeRound.airdropIndex]) {
      airdrops.splice(challengeRound.airdropIndex, 1);
    } else {
      const adIdx = airdrops.findIndex(a => (a.x === winner.x && a.y === winner.y) || (a.x === loser.x && a.y === loser.y));
      if (adIdx !== -1) airdrops.splice(adIdx, 1);
    }

    // Award Airdrop Loot to Winner!
    const itemKeys = ['awm', 'emp', 'armor', 'ghillie', 'adrenaline', 'smartglasses', 'bandage'];
    const rolledKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
    const itemDef = TACTICAL_ITEMS[rolledKey];
    winner.item = rolledKey;
    winner.score += 300;

    if (MR) {
      setTimeout(() => {
        MR.spawnFloatingText(winner.x, winner.y, `🎁 MEREBUT AIRDROP: ${itemDef.emoji} ${itemDef.shortName.toUpperCase()}! (+300 PTS)`, '#facc15');
      }, 700);
    }

    const bannerWrap = document.getElementById('duel-Overlay-Banner');
    const bannerPill = document.getElementById('duel-banner-pill');
    bannerWrap.classList.remove('hidden');
    bannerPill.className = 'px-5 py-1.5 rounded-full font-game text-xs md:text-sm tracking-wide text-slate-950 shadow-xl border border-amber-300 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 animate-bounce';
    bannerPill.innerHTML = `🏆 ${winner.name.toUpperCase()} MENANG & MEREBUT AIRDROP! (+300 PTS & ${itemDef.emoji} ${itemDef.shortName})`;
  }

  const t1Name = document.getElementById('c-team1-name');
  const t2Name = document.getElementById('c-team2-name');
  if (t1Name) t1Name.textContent = `${challengeRound.team1.name} (LP: ${challengeRound.team1.lp})`;
  if (t2Name) t2Name.textContent = `${challengeRound.team2.name} (LP: ${challengeRound.team2.lp})`;

  if (MR) {
    MR.spawnFloatingText(winner.x, winner.y, `⚔️ ${winner.name} MENANG DUEL! (+250 PTS)`, '#facc15');
    if (!loserArmorAbsorbed) {
      MR.spawnFloatingText(loser.x, loser.y, `💥 ${loser.name} TERPENTAL 1 TILE! (-25 LP)`, '#f43f5e');
    }
  }

  renderHUD();
  document.getElementById('c-continue-wrap').classList.remove('hidden');
}

function resolveChallengeBothWrong() {
  challengeRound.resolved = true;
  challengeRound.team1.isFrozen = true;
  challengeRound.team2.isFrozen = true;

  const bannerWrap = document.getElementById('duel-Overlay-Banner');
  const bannerPill = document.getElementById('duel-banner-pill');
  bannerWrap.classList.remove('hidden');
  bannerPill.className = 'px-5 py-1.5 rounded-full font-game text-xs md:text-sm tracking-wide text-white shadow-xl border border-sky-400/60 bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-600 animate-pulse';
  if (challengeRound.isAirdropClash) {
    bannerPill.innerHTML = `❄️ KEDUA TIM SALAH MENJAWAB! FREEZE (SKIP TURN 1X) & AIRDROP BELUM TERAMBIL!`;
  } else {
    bannerPill.innerHTML = `❄️ KEDUA TIM SALAH MENJAWAB! KEDUA TIM TER-FREEZE (SKIP TURN 1X)!`;
  }

  // Active team steps back 1 tile to prevX, prevY so they don't overlap
  const activeTeam = teams[activeTeamIndex];
  if (activeTeam) {
    animateTeamMovement(activeTeam, activeTeam.prevX, activeTeam.prevY);
  }

  const MR = window.MapRenderer;
  if (MR) {
    MR.spawnFloatingText(challengeRound.team1.x, challengeRound.team1.y, '❄️ FREEZE! (SKIP TURN)', '#38bdf8');
    MR.spawnFloatingText(challengeRound.team2.x, challengeRound.team2.y, '❄️ FREEZE! (SKIP TURN)', '#38bdf8');
  }

  renderHUD();
  document.getElementById('c-continue-wrap').classList.remove('hidden');
}

function onChallengeTimeExpired() {
  if (!challengeRound.active || challengeRound.resolved) return;
  challengeRound.resolved = true;
  challengeRound.team1.isFrozen = true;
  challengeRound.team2.isFrozen = true;

  for (let i = 0; i < 4; i++) {
    const b1 = document.getElementById(`c-t1-opt-${i}`);
    const b2 = document.getElementById(`c-t2-opt-${i}`);
    if (b1) { b1.disabled = true; b1.classList.add('opacity-40'); }
    if (b2) { b2.disabled = true; b2.classList.add('opacity-40'); }
  }

  const t1Status = document.getElementById('c-t1-status');
  const t2Status = document.getElementById('c-t2-status');
  if (t1Status) t1Status.innerHTML = '<span class="text-rose-400 font-extrabold">⏰ WAKTU HABIS!</span>';
  if (t2Status) t2Status.innerHTML = '<span class="text-rose-400 font-extrabold">⏰ WAKTU HABIS!</span>';

  AudioManager.play('wrong');

  const bannerWrap = document.getElementById('duel-Overlay-Banner');
  const bannerPill = document.getElementById('duel-banner-pill');
  bannerWrap.classList.remove('hidden');
  bannerPill.className = 'px-5 py-1.5 rounded-full font-game text-xs md:text-sm tracking-wide text-white shadow-xl border border-rose-400/60 bg-gradient-to-r from-rose-700 via-purple-700 to-rose-700 animate-pulse';
  if (challengeRound.isAirdropClash) {
    bannerPill.innerHTML = `⏰ WAKTU HABIS (10 DETIK)! KEDUA TIM TER-FREEZE & AIRDROP BELUM TERAMBIL!`;
  } else {
    bannerPill.innerHTML = `⏰ WAKTU HABIS (10 DETIK)! KEDUA TIM TER-FREEZE & SKIP TURN!`;
  }

  const activeTeam = teams[activeTeamIndex];
  if (activeTeam) {
    animateTeamMovement(activeTeam, activeTeam.prevX, activeTeam.prevY);
  }

  const MR = window.MapRenderer;
  if (MR) {
    MR.spawnFloatingText(challengeRound.team1.x, challengeRound.team1.y, '❄️ WAKTU HABIS! FREEZE', '#fb7185');
    MR.spawnFloatingText(challengeRound.team2.x, challengeRound.team2.y, '❄️ WAKTU HABIS! FREEZE', '#fb7185');
  }

  renderHUD();
  document.getElementById('c-continue-wrap').classList.remove('hidden');
}

function closeChallengeAndAdvanceTurn() {
  if (challengeTimerInterval) {
    clearInterval(challengeTimerInterval);
    challengeTimerInterval = null;
  }
  duelState.active = false;
  challengeRound.active = false;
  document.getElementById('challenge-modal').classList.add('hidden');
  advanceToNextTeamTurn();
}

// ----------------------------------------------------------------------------
// 13. TURN MANAGEMENT & EMERGENCY SHOP
// ----------------------------------------------------------------------------
function openShopModal() {
  const modal = document.getElementById('shop-modal');
  if (!modal) return;
  const currentTeam = teams[activeTeamIndex];
  if (!currentTeam) return;

  document.getElementById('shop-team-name').textContent = currentTeam.name;
  document.getElementById('shop-team-score').textContent = `${currentTeam.score.toLocaleString()} PTS`;
  document.getElementById('shop-team-mp').textContent = `${currentTeam.mp} / ${currentTeam.maxMp} MP`;

  const errorEl = document.getElementById('shop-error-msg');
  const buyBtn = document.getElementById('shop-buy-btn');

  if (currentTeam.mp >= currentTeam.maxMp) {
    errorEl.textContent = `⚠️ Move Point sudah maksimal (${currentTeam.maxMp}/${currentTeam.maxMp} MP).`;
    errorEl.classList.remove('hidden');
    buyBtn.disabled = true;
    buyBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else if (currentTeam.score < 150) {
    errorEl.textContent = `⚠️ Skor tidak mencukupi (Butuh 150 PTS, memiliki ${currentTeam.score} PTS).`;
    errorEl.classList.remove('hidden');
    buyBtn.disabled = true;
    buyBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    errorEl.classList.add('hidden');
    buyBtn.disabled = false;
    buyBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  modal.classList.remove('hidden');
  AudioManager.play('click');
}

function closeShopModal() {
  const modal = document.getElementById('shop-modal');
  if (modal) modal.classList.add('hidden');
}

function buyEmergencyMP() {
  const currentTeam = teams[activeTeamIndex];
  if (!currentTeam || currentTeam.score < 150 || currentTeam.mp >= currentTeam.maxMp) return;

  currentTeam.score -= 150;
  currentTeam.mp = Math.min(currentTeam.maxMp, currentTeam.mp + 1);

  const MR = window.MapRenderer;
  if (MR) {
    MR.spawnFloatingText(currentTeam.x, currentTeam.y, '🛒 +1 MP DARURAT (-150 PTS)', '#f59e0b');
  }
  AudioManager.play('correct');

  renderHUD();
  closeShopModal();
}

function skipTurnAction() {
  const MR = window.MapRenderer;
  if (isInputLocked) return;
  const current = teams[activeTeamIndex];
  if (current && current.alive) {
    current.mp = Math.min(current.maxMp, current.mp + 1);
    MR.spawnFloatingText(current.x, current.y, '⏭️ SKIP TURN (+1 MP)', '#38bdf8');
    AudioManager.play('click');
  }
  advanceToNextTeamTurn();
}

function advanceToNextTeamTurn() {
  const MR = window.MapRenderer;
  const current = teams[activeTeamIndex];
  if (current && current.alive && !isInsideSafeZone(current.x, current.y)) {
    current.lp = Math.max(0, current.lp - 15);
    MR.spawnFloatingText(current.x, current.y, '⚡ BLUE ZONE -15 LP!', '#c084fc');
    if (current.lp === 0) current.alive = false;
  }

  // Decrement Ghillie Suit stealth duration if active
  if (current && current.stealthTurns > 0) {
    current.stealthTurns--;
    if (current.stealthTurns === 0 && MR) {
      MR.spawnFloatingText(current.x, current.y, '🌿 STEALTH HABIS', '#94a3b8');
    }
  }

  const aliveTeams = teams.filter(t => t.alive);
  if (aliveTeams.length <= 1) {
    switchView('end');
    return;
  }

  let loops = 0;
  do {
    activeTeamIndex = (activeTeamIndex + 1) % teams.length;
    loops++;
  } while (!teams[activeTeamIndex].alive && loops < teams.length);

  hasMovedThisTurn = false;
  renderHUD();

  // If the next team is currently frozen or under EMP skipTurn, display notice and skip their turn!
  const nextTeam = teams[activeTeamIndex];
  if (nextTeam && (nextTeam.isFrozen || nextTeam.skipTurn)) {
    const isEmp = !!nextTeam.skipTurn;
    nextTeam.isFrozen = false; // consume freeze
    nextTeam.skipTurn = false; // consume EMP skipTurn
    renderHUD();
    const noticeText = isEmp ? `⚡ ${nextTeam.name} TERKENA EMP! SKIP TURN` : `❄️ ${nextTeam.name} TER-FREEZE! SKIP TURN`;
    if (MR) {
      MR.spawnFloatingText(nextTeam.x, nextTeam.y, noticeText, isEmp ? '#f59e0b' : '#38bdf8');
    }
    const bannerEl = document.getElementById('hud-turn-banner');
    if (bannerEl) {
      bannerEl.innerHTML = `<span class="${isEmp ? 'text-amber-300 font-black' : 'text-cyan-300 font-black'}">${noticeText} — GILIRAN DILEWATI...</span>`;
    }
    isInputLocked = true;
    setTimeout(() => {
      isInputLocked = false;
      advanceToNextTeamTurn();
    }, 1800);
  }
}

// ----------------------------------------------------------------------------
// 13B. CLASSROOM DIPLOMACY & ALLIANCE AID SYSTEM (TRANSFER MP / SCORE)
// ----------------------------------------------------------------------------
let diploSelectedDonorId = 0;
let diploSelectedRecipientId = 1;
let diploTransferType = 'mp'; // 'mp' or 'score'
let diploTransferAmount = 1;

function openDiplomacyModal(preselectedRecipientId = null) {
  const modal = document.getElementById('diplomacy-modal');
  if (!modal) return;

  const aliveTeams = teams.filter(t => t.alive);
  if (aliveTeams.length < 2) {
    alert("Bantuan Aliansi membutuhkan minimal 2 tim yang masih bertahan!");
    return;
  }

  const activeTeam = teams[activeTeamIndex];
  diploSelectedDonorId = (activeTeam && activeTeam.alive) ? activeTeam.id : aliveTeams[0].id;

  if (preselectedRecipientId !== null && preselectedRecipientId !== diploSelectedDonorId) {
    diploSelectedRecipientId = preselectedRecipientId;
  } else {
    const other = aliveTeams.find(t => t.id !== diploSelectedDonorId);
    diploSelectedRecipientId = other ? other.id : aliveTeams[0].id;
  }

  diploTransferType = 'mp';
  diploTransferAmount = 1;

  const donorSelect = document.getElementById('diplo-donor-select');
  if (donorSelect) {
    donorSelect.innerHTML = aliveTeams.map(t => `
      <option value="${t.id}" ${t.id === diploSelectedDonorId ? 'selected' : ''}>
        ${t.name} (${t.score} PTS | ${t.mp} MP)
      </option>
    `).join('');
  }

  updateDiplomacyModalUI();
  modal.classList.remove('hidden');
  AudioManager.play('click');
}

function closeDiplomacyModal() {
  const modal = document.getElementById('diplomacy-modal');
  if (modal) modal.classList.add('hidden');
}

function onDiplomacyDonorChange() {
  const select = document.getElementById('diplo-donor-select');
  if (!select) return;
  diploSelectedDonorId = parseInt(select.value);

  if (diploSelectedRecipientId === diploSelectedDonorId) {
    const other = teams.find(t => t.alive && t.id !== diploSelectedDonorId);
    if (other) diploSelectedRecipientId = other.id;
  }
  updateDiplomacyModalUI();
}

function setDiplomacyRecipient(recipientId) {
  diploSelectedRecipientId = recipientId;
  updateDiplomacyModalUI();
  AudioManager.play('click');
}

function setDiplomacyType(type, amount) {
  diploTransferType = type;
  diploTransferAmount = amount;
  updateDiplomacyModalUI();
  AudioManager.play('click');
}

function updateDiplomacyModalUI() {
  const donor = teams.find(t => t.id === diploSelectedDonorId);
  const recipient = teams.find(t => t.id === diploSelectedRecipientId);
  if (!donor) return;

  const donorScoreEl = document.getElementById('diplo-donor-score');
  const donorMpEl = document.getElementById('diplo-donor-mp');
  if (donorScoreEl) donorScoreEl.textContent = `${donor.score.toLocaleString()} PTS`;
  if (donorMpEl) donorMpEl.textContent = `${donor.mp} / ${donor.maxMp} MP`;

  // Render recipients list
  const recListEl = document.getElementById('diplo-recipients-list');
  if (recListEl) {
    const aliveRecipients = teams.filter(t => t.alive && t.id !== donor.id);
    recListEl.innerHTML = aliveRecipients.map(t => {
      const isSelected = t.id === diploSelectedRecipientId;
      return `
        <div onclick="setDiplomacyRecipient(${t.id})" class="cursor-pointer p-2 rounded-xl transition border text-left flex items-center justify-between gap-2 ${isSelected ? 'bg-purple-500/25 border-purple-400 shadow-md shadow-purple-500/20' : 'bg-slate-950/70 border-white/10 hover:border-purple-400/40'}">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${t.color}"></span>
            <div class="truncate">
              <div class="text-xs font-bold text-white truncate">${t.name}</div>
              <div class="text-[10px] text-slate-400">LP: ${t.lp} | MP: ${t.mp}/${t.maxMp}</div>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[10px] font-black text-amber-400">${t.score} PTS</div>
            ${isSelected ? '<span class="text-[9px] font-black text-purple-300">✓ TERPILIH</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Highlight transfer option buttons
  const optButtons = [
    { id: 'diplo-opt-mp', type: 'mp', amount: 1 },
    { id: 'diplo-opt-score-50', type: 'score', amount: 50 },
    { id: 'diplo-opt-score-100', type: 'score', amount: 100 },
    { id: 'diplo-opt-score-150', type: 'score', amount: 150 }
  ];

  optButtons.forEach(btn => {
    const el = document.getElementById(btn.id);
    if (!el) return;
    const isChosen = (diploTransferType === btn.type && diploTransferAmount === btn.amount);
    if (isChosen) {
      el.className = 'p-3 rounded-2xl border-2 border-purple-400 bg-purple-500/25 text-left transition space-y-1 shadow-lg shadow-purple-500/20';
    } else {
      el.className = 'p-3 rounded-2xl border border-white/10 bg-slate-900/80 hover:border-purple-400/50 text-left transition space-y-1 opacity-80';
    }
  });

  // Validation
  const feedbackEl = document.getElementById('diplo-feedback-msg');
  const sendBtn = document.getElementById('diplo-send-btn');
  let errorMsg = '';

  if (!recipient || !recipient.alive) {
    errorMsg = '⚠️ Silakan pilih tim penerima bantuan terlebih dahulu.';
  } else if (diploTransferType === 'mp') {
    if (donor.mp < 1) {
      errorMsg = `⚠️ ${donor.name} tidak memiliki Move Point (MP: 0) untuk ditransfer.`;
    } else if (recipient.mp >= recipient.maxMp) {
      errorMsg = `⚠️ ${recipient.name} sudah memiliki Move Point penuh (${recipient.maxMp}/${recipient.maxMp} MP).`;
    }
  } else if (diploTransferType === 'score') {
    if (donor.score < diploTransferAmount) {
      errorMsg = `⚠️ Skor ${donor.name} tidak mencukupi (Butuh ${diploTransferAmount} PTS, memiliki ${donor.score} PTS).`;
    }
  }

  if (feedbackEl && sendBtn) {
    if (errorMsg) {
      feedbackEl.textContent = errorMsg;
      feedbackEl.classList.remove('hidden');
      sendBtn.disabled = true;
      sendBtn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      feedbackEl.classList.add('hidden');
      sendBtn.disabled = false;
      sendBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

function executeDiplomacyTransfer() {
  const donor = teams.find(t => t.id === diploSelectedDonorId);
  const recipient = teams.find(t => t.id === diploSelectedRecipientId);
  if (!donor || !recipient || !donor.alive || !recipient.alive || donor.id === recipient.id) return;

  const MR = window.MapRenderer;
  let noticeMsg = '';

  if (diploTransferType === 'mp') {
    if (donor.mp < 1 || recipient.mp >= recipient.maxMp) return;
    donor.mp -= 1;
    recipient.mp = Math.min(recipient.maxMp, recipient.mp + 1);

    if (MR) {
      MR.spawnFloatingText(donor.x, donor.y, `🤝 -1 MP (${recipient.name})`, '#c084fc');
      MR.spawnFloatingText(recipient.x, recipient.y, `🤝 +1 MP Dari ${donor.name}!`, '#38bdf8');
    }
    noticeMsg = `🤝 DIPLOMASI: ${donor.name} mentransfer 1 MP kepada ${recipient.name}!`;
  } else if (diploTransferType === 'score') {
    const amount = diploTransferAmount;
    if (donor.score < amount) return;
    donor.score -= amount;
    recipient.score += amount;

    if (MR) {
      MR.spawnFloatingText(donor.x, donor.y, `🤝 -${amount} PTS (${recipient.name})`, '#c084fc');
      MR.spawnFloatingText(recipient.x, recipient.y, `🤝 +${amount} PTS Dari ${donor.name}!`, '#facc15');
    }
    noticeMsg = `🤝 DIPLOMASI: ${donor.name} mendonasikan ${amount} Skor kepada ${recipient.name}!`;
  }

  AudioManager.play('correct');

  const bannerEl = document.getElementById('hud-turn-banner');
  if (bannerEl && noticeMsg) {
    bannerEl.innerHTML = `<span class="text-purple-300 font-extrabold">${noticeMsg}</span>`;
  }

  renderHUD();
  closeDiplomacyModal();
}

// ----------------------------------------------------------------------------
// 13C. TACTICAL INVENTORY SYSTEM (AIRDROP GACHA & SPECIAL ITEMS)
// ----------------------------------------------------------------------------
let currentTargetingAction = null; // 'awm' or 'emp'

function openItemGuideModal() {
  const modal = document.getElementById('item-guide-modal');
  if (modal) modal.classList.remove('hidden');
  AudioManager.play('click');
}

function closeItemGuideModal() {
  const modal = document.getElementById('item-guide-modal');
  if (modal) modal.classList.add('hidden');
  AudioManager.play('click');
}

function useActiveTeamItem() {
  const activeTeam = teams[activeTeamIndex];
  if (!activeTeam || !activeTeam.item) return;
  audioManager.play('click');

  const itemKey = activeTeam.item;
  const itemDef = TACTICAL_ITEMS[itemKey];
  if (!itemDef) return;

  const MR = window.MapRenderer;

  switch (itemKey) {
    case 'awm':
      openTargetSelectModal('awm');
      break;

    case 'emp':
      openTargetSelectModal('emp');
      break;

    case 'armor':
      activeTeam.item = null;
      activeTeam.hasArmor = true;
      if (MR) MR.spawnFloatingText(activeTeam.x, activeTeam.y, '🛡️ LEVEL 3 ARMOR TERPASANG!', '#34d399');
      AudioManager.play('correct');
      renderHUD();
      break;

    case 'ghillie':
      activeTeam.item = null;
      activeTeam.stealthTurns = 2;
      if (MR) MR.spawnFloatingText(activeTeam.x, activeTeam.y, '🌿 GHILLIE SUIT AKTIF (2 TURN)!', '#2dd4bf');
      AudioManager.play('click');
      renderHUD();
      break;

    case 'adrenaline':
      activeTeam.item = null;
      activeTeam.mp = Math.min(activeTeam.maxMp, activeTeam.mp + 2);
      if (MR) MR.spawnFloatingText(activeTeam.x, activeTeam.y, '💉 +2 MOVE POINT INSTAN!', '#22d3ee');
      AudioManager.play('correct');
      renderHUD();
      break;

    case 'smartglasses':
      activeTeam.item = null;
      activeTeam.smartGlassesArmed = true;
      if (MR) MR.spawnFloatingText(activeTeam.x, activeTeam.y, '👓 KACAMATA 50:50 DIAKTIFKAN!', '#818cf8');
      AudioManager.play('correct');
      renderHUD();
      break;

    case 'bandage':
      activeTeam.item = null;
      activeTeam.lp = Math.min(100, activeTeam.lp + 20);
      if (MR) MR.spawnFloatingText(activeTeam.x, activeTeam.y, '🩹 BANDAGE: +20 LP!', '#a3e635');
      AudioManager.play('correct');
      renderHUD();
      break;
  }
}

function openTargetSelectModal(actionType) {
  currentTargetingAction = actionType;
  const modal = document.getElementById('target-select-modal');
  if (!modal) return;

  const activeTeam = teams[activeTeamIndex];
  const isAwm = actionType === 'awm';

  const iconBadge = document.getElementById('target-modal-icon-badge');
  const titleEl = document.getElementById('target-modal-title');
  const subEl = document.getElementById('target-modal-subtitle');
  const cardEl = document.getElementById('target-select-card');

  if (isAwm) {
    if (iconBadge) {
      iconBadge.className = 'w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-400/50 flex items-center justify-center text-rose-400 text-lg shadow';
      iconBadge.innerHTML = '<i class="fa-solid fa-crosshairs"></i>';
    }
    if (titleEl) titleEl.textContent = 'AWM (ORBITAL STRIKE)';
    if (subEl) subEl.textContent = 'Pilih 1 tim lawan di peta untuk dihantam rudal orbital (20 LP Damage).';
    if (cardEl) cardEl.className = 'glass-modal max-w-md w-full rounded-3xl p-5 md:p-6 space-y-4 border-2 border-rose-500/40 shadow-2xl relative animate-pop my-auto';
  } else {
    if (iconBadge) {
      iconBadge.className = 'w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 text-lg shadow';
      iconBadge.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i>';
    }
    if (titleEl) titleEl.textContent = 'EMP GRENADE';
    if (subEl) subEl.textContent = 'Pilih 1 tim lawan untuk dilumpuhkan sistemnya (skipTurn selama 1 putaran).';
    if (cardEl) cardEl.className = 'glass-modal max-w-md w-full rounded-3xl p-5 md:p-6 space-y-4 border-2 border-amber-500/40 shadow-2xl relative animate-pop my-auto';
  }

  const listEl = document.getElementById('target-modal-list');
  const enemies = teams.filter(t => t.id !== activeTeam.id && t.alive);

  if (enemies.length === 0) {
    listEl.innerHTML = `<div class="p-3 rounded-xl bg-slate-900 text-center text-xs text-slate-400">Tidak ada tim lawan hidup yang tersisa.</div>`;
  } else {
    listEl.innerHTML = enemies.map(enemy => {
      const isStealth = enemy.stealthTurns > 0;
      return `
        <div class="p-3 rounded-2xl bg-slate-900/90 border ${isStealth ? 'border-teal-500/30 opacity-70' : 'border-white/10 hover:border-cyan-400/50'} flex items-center justify-between gap-3 transition">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center font-game font-bold text-slate-950 text-sm shrink-0" style="background:${enemy.color}">
              ${enemy.badge}
            </div>
            <div class="min-w-0 truncate">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-xs text-white truncate">${enemy.name}</span>
                ${enemy.hasArmor ? '<span class="px-1.5 py-0.2 rounded text-[8.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">🛡️ ARMOR</span>' : ''}
                ${isStealth ? `<span class="px-1.5 py-0.2 rounded text-[8.5px] font-black bg-teal-500/20 text-teal-300 border border-teal-400/30">🌿 STEALTH (${enemy.stealthTurns})</span>` : ''}
              </div>
              <div class="text-[10px] text-slate-400 truncate">LP: ${enemy.lp}/100 | Tile (${enemy.x}, ${enemy.y})</div>
            </div>
          </div>

          ${isStealth ? `
            <button disabled class="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-500 text-[10px] font-bold border border-white/5 cursor-not-allowed">
              KEBAL (STEALTH)
            </button>
          ` : `
            <button onclick="executeTargetAction(${enemy.id}, '${actionType}')" class="px-3.5 py-1.5 rounded-xl ${isAwm ? 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white' : 'bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950'} font-game font-bold text-xs shadow-md transition active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0">
              <i class="${isAwm ? 'fa-solid fa-crosshairs' : 'fa-solid fa-bolt'} text-[10px]"></i> TARGET
            </button>
          `}
        </div>
      `;
    }).join('');
  }

  modal.classList.remove('hidden');
  AudioManager.play('click');
}

function closeTargetSelectModal() {
  const modal = document.getElementById('target-select-modal');
  if (modal) modal.classList.add('hidden');
  currentTargetingAction = null;
}

function executeTargetAction(targetId, actionType) {
  const activeTeam = teams[activeTeamIndex];
  const target = teams.find(t => t.id === targetId);
  if (!activeTeam || !target || !target.alive) return;
  if (target.stealthTurns > 0) return; // Protected by Ghillie Suit!

  const MR = window.MapRenderer;
  closeTargetSelectModal();

  activeTeam.item = null; // Single-use consumed!

  if (actionType === 'awm') {
    if (target.hasArmor) {
      target.hasArmor = false; // Armor absorbs hit completely and breaks!
      if (MR) MR.spawnFloatingText(target.x, target.y, '🛡️ ARMOR MENAHAN AWM! (PECAH)', '#34d399');
      audioManager.play('attack');
    } else {
      target.lp = Math.max(0, target.lp - 20);
      target.isHurt = true;
      setTimeout(() => { target.isHurt = false; }, 2200);
      if (MR) MR.spawnFloatingText(target.x, target.y, '🎯 AWM STRIKE! -20 LP', '#f43f5e');
      audioManager.play('attack');
      if (target.lp === 0) {
        target.alive = false;
        activeTeam.kills += 1;
        activeTeam.score += 200;
        if (MR) MR.spawnFloatingText(activeTeam.x, activeTeam.y, '💀 ELIMINASI! +200 PTS', '#facc15');
      }
    }
  } else if (actionType === 'emp') {
    target.skipTurn = true;
    target.isFrozen = true;
    if (MR) MR.spawnFloatingText(target.x, target.y, '⚡ EMP BLAST! SKIP TURN!', '#f59e0b');
    AudioManager.play('wrong');
  }

  renderHUD();
}

function useSmartGlassesInModal() {
  const team = teams[activeTeamIndex];
  if (!team || team.item !== 'smartglasses') return;
  team.item = null; // Consumed!

  const btnBox = document.getElementById('q-smartglasses-container');
  if (btnBox) btnBox.classList.add('hidden');

  if (activeModalQuestion) {
    applySmartGlassesElimination(activeModalQuestion.ans);
  }
  AudioManager.play('correct');
  renderHUD();
}

function applySmartGlassesElimination(correctAnsIdx) {
  const wrongIndices = [0, 1, 2, 3].filter(i => i !== correctAnsIdx);
  for (let i = wrongIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = wrongIndices[i];
    wrongIndices[i] = wrongIndices[j];
    wrongIndices[j] = temp;
  }
  const toEliminate = wrongIndices.slice(0, 2);

  toEliminate.forEach(idx => {
    const btn = document.getElementById(`q-opt-btn-${idx}`);
    if (btn) {
      btn.disabled = true;
      btn.onclick = null;
      btn.className = 'w-full text-left px-4 py-3 rounded-xl bg-slate-950/40 border border-white/5 text-slate-600 text-sm flex items-center justify-between opacity-30 pointer-events-none line-through';
      btn.innerHTML += `<span class="text-[9px] font-black uppercase text-rose-400 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-500/30 shrink-0">❌ 50:50 Tereliminasi</span>`;
    }
  });

  const MR = window.MapRenderer;
  const team = teams[activeTeamIndex];
  if (MR && team) {
    MR.spawnFloatingText(team.x, team.y, '👓 2 OPSI SALAH TERELIMINASI!', '#818cf8');
  }
}

// ----------------------------------------------------------------------------
// 13D. END THE GAME CONTROLLER & CONFIRMATION MODAL
// ----------------------------------------------------------------------------
function openEndGameConfirmModal() {
  const modal = document.getElementById('end-game-confirm-modal');
  if (modal) modal.classList.remove('hidden');
  AudioManager.play('click');
}

function closeEndGameConfirmModal() {
  const modal = document.getElementById('end-game-confirm-modal');
  if (modal) modal.classList.add('hidden');
  AudioManager.play('click');
}

function executeEndGame() {
  const modal = document.getElementById('end-game-confirm-modal');
  if (modal) modal.classList.add('hidden');
  isTimerPaused = true;
  switchView('end');
}

// ----------------------------------------------------------------------------
// 14. CAMERA CONTROLS
// ----------------------------------------------------------------------------
function zoomMap(factor) {
  zoom = Math.min(2.2, Math.max(0.45, zoom * factor));
  if (window.MapRenderer && window.MapRenderer.invalidateBackground) {
    window.MapRenderer.invalidateBackground();
  }
}

function resetCamera() {
  camX = isoCanvas.width / 2;
  if (mapSize >= 32) {
    zoom = 0.68;
    camY = isoCanvas.height * 0.12;
  } else if (mapSize === 24) {
    zoom = 0.88;
    camY = isoCanvas.height * 0.14;
  } else {
    zoom = 1.15;
    camY = isoCanvas.height * 0.18;
  }
  if (window.MapRenderer && window.MapRenderer.invalidateBackground) {
    window.MapRenderer.invalidateBackground();
  }
}

function toggleCoordLabels() {
  showCoords = !showCoords;
  if (window.MapRenderer && window.MapRenderer.invalidateBackground) {
    window.MapRenderer.invalidateBackground();
  }
}

// ----------------------------------------------------------------------------
// 15. AUTHENTICATION & VIEW SWITCHER
// ----------------------------------------------------------------------------
function isLicenseActive() {
  return localStorage.getItem('lzb_license_active') === 'true';
}

function initAuthCheck() {
  if (isLicenseActive()) {
    switchView('prep');
  } else {
    switchView('login');
  }
}

async function verifyLicense() {
  const input = document.getElementById('license-input-field');
  const feedback = document.getElementById('license-feedback-msg');
  const btn = document.getElementById('license-submit-btn');
  const btnText = document.getElementById('license-btn-text');
  const btnIcon = document.getElementById('license-btn-icon');
  if (!input || !btn) return;

  const code = (input.value || '').trim();
  if (!code) {
    if (feedback) {
      feedback.innerHTML = '<span class="text-amber-400 font-bold tracking-wider"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i>Silakan masukkan kode lisensi terlebih dahulu</span>';
    }
    input.classList.add('border-amber-500', 'ring-2', 'ring-amber-500/50', 'animate-shake');
    setTimeout(() => {
      input.classList.remove('animate-shake');
    }, 500);
    input.focus();
    return;
  }

  // Disable UI during fetch
  input.disabled = true;
  btn.disabled = true;
  btn.classList.add('opacity-80', 'cursor-not-allowed');

  if (btnText) btnText.textContent = 'MEMVERIFIKASI ENKRIPSI...';
  if (btnIcon) btnIcon.className = 'fa-solid fa-circle-notch fa-spin text-sm sm:text-base';
  if (feedback) {
    feedback.innerHTML = '<span class="text-cyan-400 font-semibold tracking-wider animate-pulse"><i class="fa-solid fa-satellite-dish mr-1.5"></i>Menghubungkan ke Tactical Security Server...</span>';
  }

  const endpoint = `https://script.google.com/macros/s/AKfycbwM2m1SO_eGQTnGPVXgNrdHsvDw_xUyzTJgPM0PhtIBb3xEuT_O9pHLarngNnl3t9qE/exec?kode=${encodeURIComponent(code)}`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json();

    if (data && data.valid === true) {
      localStorage.setItem('lzb_license_active', 'true');
      audioManager.playBGM('lobby');

      const successMsg = data.pesan || data.message || 'AKSES DITERIMA. MEMBUAT SESI PERMAINAN...';
      if (feedback) {
        feedback.innerHTML = `<span class="text-emerald-400 font-bold tracking-wider drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]"><i class="fa-solid fa-circle-check mr-1.5"></i>${successMsg}</span>`;
      }
      if (btnText) btnText.textContent = 'AKSES DITERIMA';
      if (btnIcon) btnIcon.className = 'fa-solid fa-lock-open text-sm sm:text-base text-emerald-950';
      btn.className = 'w-full py-2.5 sm:py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-400 to-green-500 text-slate-950 font-black text-sm sm:text-base tracking-wider uppercase shadow-[0_0_25px_rgba(52,211,153,0.7)] transition flex items-center justify-center gap-2 cursor-default';

      AudioManager.play('correct');

      setTimeout(() => {
        // Transition to preparation view
        switchView('prep');
      }, 1000);
    } else {
      // Validation failure from server
      const errMsg = (data && (data.pesan || data.message)) || 'KODE TIDAK VALID ATAU SUDAH TERPAKAI';
      if (feedback) {
        feedback.innerHTML = `<span class="text-red-400 font-bold tracking-wider"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i>${errMsg}</span>`;
      }

      input.disabled = false;
      btn.disabled = false;
      btn.classList.remove('opacity-80', 'cursor-not-allowed');
      if (btnText) btnText.textContent = 'AKTIVASI SISTEM';
      if (btnIcon) btnIcon.className = 'fa-solid fa-key text-sm sm:text-base';

      input.classList.add('border-red-500', 'ring-2', 'ring-red-500/50', 'animate-shake');
      setTimeout(() => {
        input.classList.remove('animate-shake');
      }, 500);

      AudioManager.play('wrong');
      input.focus();
    }
  } catch (err) {
    console.error('License Verification Error:', err);
    if (feedback) {
      feedback.innerHTML = '<span class="text-red-400 font-bold tracking-wider"><i class="fa-solid fa-triangle-exclamation mr-1.5"></i>Gagal terhubung ke server lisensi. Periksa koneksi internet Anda!</span>';
    }

    input.disabled = false;
    btn.disabled = false;
    btn.classList.remove('opacity-80', 'cursor-not-allowed');
    if (btnText) btnText.textContent = 'AKTIVASI SISTEM';
    if (btnIcon) btnIcon.className = 'fa-solid fa-key text-sm sm:text-base';

    input.classList.add('border-red-500', 'ring-2', 'ring-red-500/50', 'animate-shake');
    setTimeout(() => {
      input.classList.remove('animate-shake');
    }, 500);

    AudioManager.play('wrong');
    input.focus();
  }
}

function resetLicense() {
  localStorage.removeItem('lzb_license_active');
  switchView('login');
}

function switchView(view) {
  // Guard: if not authenticated, force view 'login'
  if (view !== 'login' && !isLicenseActive()) {
    view = 'login';
  }

  const topHeader = document.getElementById('top-header-bar');
  if (topHeader) {
    if (view === 'login') {
      topHeader.classList.add('hidden');
    } else {
      topHeader.classList.remove('hidden');
    }
  }

  ['login', 'prep', 'drop', 'game', 'end'].forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) el.classList.add('hidden');
    const tab = document.getElementById(`tab-${v}`);
    if (tab) {
      tab.classList.remove('bg-cyan-500', 'text-slate-950');
      tab.classList.add('text-slate-300');
    }
  });

  const activeEl = document.getElementById(`view-${view}`);
  if (activeEl) activeEl.classList.remove('hidden');
  const activeTab = document.getElementById(`tab-${view}`);
  if (activeTab) {
    activeTab.classList.add('bg-cyan-500', 'text-slate-950');
  }

  // Handle BGM Transitions
  if (view === 'prep' || view === 'drop') {
    audioManager.playBGM('lobby');
  } else if (view === 'game') {
    audioManager.playBGM('combat');
  } else if (view === 'end') {
    audioManager.playBGM('victory');
  } else if (view === 'login') {
    audioManager.stopBGM();
  }

  if (view === 'drop') drawDropRadar();
  if (view === 'game') {
    resizeIsoCanvas();
    resetCamera();
    renderHUD();
    updateTimerHUDDisplay();
  }
  if (view === 'end') {
    renderEndStandings();
  }
}

function renderPrepTeams() {
  const container = document.getElementById('teams-config-list');
  if (!container) return;

  const squadCounter = document.getElementById('squad-counter-tag');
  if (squadCounter) {
    squadCounter.textContent = `${teams.length} SQUADS READY`;
  }

  const teamTagStyles = [
    'bg-slate-700/80 text-slate-200 border-slate-500/40',
    'bg-amber-500/20 text-amber-300 border-amber-400/40',
    'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
    'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-400/40',
    'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
    'bg-rose-500/20 text-rose-300 border-rose-400/40'
  ];

  container.innerHTML = teams.map((t, idx) => {
    const avatarObj = AVATAR_TYPES.find(a => a.id === t.avatar) || AVATAR_TYPES[0];
    const tagClass = teamTagStyles[idx % teamTagStyles.length];

    return `
      <div class="bg-slate-900/85 border border-cyan-500/25 hover:border-cyan-400/50 rounded-xl p-2 md:p-2.5 flex items-center justify-between gap-2.5 transition shadow-sm group">
        <!-- Left: Team Tag Pill & Name Input -->
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border shrink-0 ${tagClass}">
            Team ${idx + 1}
          </span>
          <div class="flex-1 min-w-0">
            <input type="text" value="${t.name}" onchange="teams[${idx}].name=this.value" 
              class="bg-slate-950/90 border border-white/10 hover:border-cyan-400/40 focus:border-cyan-400 rounded-lg px-2 py-1 text-xs text-white font-bold w-full focus:outline-none transition" />
          </div>
        </div>

        <!-- Center: Mini Chibi Canvas Podium (with live idle animation) -->
        <div class="relative shrink-0 flex items-center justify-center">
          <canvas id="team-chibi-canvas-${idx}" width="46" height="46" class="rounded-xl border border-white/15 shadow-inner bg-slate-950/90"></canvas>
          <span class="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-slate-950 shadow" style="background:${t.color}"></span>
        </div>

        <!-- Right: EDIT AVATAR & Brush buttons -->
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="openAvatarModal(${idx})" title="Buka Subway Surfers Avatar Selector" 
            class="px-2.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-500/25 border border-cyan-400/40 hover:border-cyan-400 text-cyan-200 text-[11px] font-extrabold transition-all flex items-center gap-1.5 shadow-sm active:scale-95">
            <i class="fa-solid fa-user-pen text-cyan-400 text-[10px]"></i>
            <span class="hidden sm:inline">EDIT</span> AVATAR
          </button>
          
          <button onclick="cycleTeamColorDirectly(${idx})" title="Ganti Warna Cepat" 
            class="w-7 h-7 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-white/15 hover:border-white/30 text-amber-300 text-xs flex items-center justify-center transition active:scale-95 shadow">
            🎨
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateAllPrepTeamThumbnails();
}

function updateAllPrepTeamThumbnails() {
  const MR = window.MapRenderer;
  if (!MR || !MR.drawChibiThumbnail) return;
  teams.forEach((t, idx) => {
    const canvas = document.getElementById(`team-chibi-canvas-${idx}`);
    if (canvas) {
      MR.drawChibiThumbnail(canvas, t.avatar, t.color, false);
    }
  });
}

function cycleTeamColorDirectly(idx) {
  const team = teams[idx];
  if (!team) return;
  const avatarObj = AVATAR_TYPES.find(a => a.id === team.avatar) || AVATAR_TYPES[0];
  const palette = avatarObj.palette || [avatarObj.color, '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
  const curIdx = palette.findIndex(c => c.toLowerCase() === team.color.toLowerCase());
  const nextIdx = (curIdx + 1) % palette.length;
  team.color = palette[nextIdx];
  renderPrepTeams();
  if (typeof drawDropRadar === 'function') drawDropRadar();
  AudioManager.play('click');
}

// ----------------------------------------------------------------------------
// 15B. SUBWAY SURFERS AVATAR SELECTOR MODAL CONTROLLER
// ----------------------------------------------------------------------------
let editingTeamIndex = 0;
let previewAvatarId = 'soldier';
let previewColor = '#06b6d4';
let showcaseAnimId = null;
let showcaseTick = 0;

function openAvatarModal(teamIndex) {
  editingTeamIndex = teamIndex;
  const team = teams[teamIndex];
  if (!team) return;

  previewAvatarId = team.avatar || 'soldier';
  previewColor = team.color || '#06b6d4';

  const modal = document.getElementById('avatar-selector-modal');
  modal.classList.remove('hidden');

  document.getElementById('modal-team-target-badge').textContent = `${team.name} (Team #${teamIndex + 1})`;

  renderAvatarModalUI();
  startShowcaseLoop();
  AudioManager.play('click');
}

function closeAvatarModal() {
  const modal = document.getElementById('avatar-selector-modal');
  modal.classList.add('hidden');
  if (showcaseAnimId) {
    cancelAnimationFrame(showcaseAnimId);
    showcaseAnimId = null;
  }
  AudioManager.play('click');
}

function setPreviewAvatar(avatarId) {
  previewAvatarId = avatarId;
  const avatarObj = AVATAR_TYPES.find(a => a.id === avatarId);
  if (avatarObj && avatarObj.palette && avatarObj.palette.length > 0) {
    if (!avatarObj.palette.includes(previewColor)) {
      previewColor = avatarObj.palette[0];
    }
  }
  renderAvatarModalUI();
  AudioManager.play('click');
}

function setPreviewColor(colorHex) {
  previewColor = colorHex;
  renderAvatarModalUI();
  AudioManager.play('click');
}

function cycleShowcaseColor() {
  const avatarObj = AVATAR_TYPES.find(a => a.id === previewAvatarId);
  if (!avatarObj || !avatarObj.palette) return;
  const currIdx = avatarObj.palette.indexOf(previewColor);
  const nextIdx = (currIdx + 1) % avatarObj.palette.length;
  setPreviewColor(avatarObj.palette[nextIdx]);
}

function confirmAvatarSelection() {
  const team = teams[editingTeamIndex];
  if (!team) return;

  team.avatar = previewAvatarId;
  team.color = previewColor;

  renderPrepTeams();
  if (typeof drawDropRadar === 'function') {
    drawDropRadar();
  }

  AudioManager.play('correct');
  closeAvatarModal();
}

function renderAvatarModalUI() {
  const avatarObj = AVATAR_TYPES.find(a => a.id === previewAvatarId) || AVATAR_TYPES[0];
  const team = teams[editingTeamIndex];

  // 1. Update Title & Role Subtitle
  document.getElementById('modal-char-title').textContent = avatarObj.title || avatarObj.label.toUpperCase();
  document.getElementById('modal-char-role').textContent = avatarObj.role || 'Classroom Brawler';

  // 2. Render 3 Color / Outfit Swatches (Right side of stage)
  const swatchesContainer = document.getElementById('modal-color-swatches');
  const palette = avatarObj.palette || [avatarObj.color, '#3b82f6', '#10b981'];
  swatchesContainer.innerHTML = palette.map((colHex, sIdx) => {
    const isCurrentActive = colHex.toLowerCase() === previewColor.toLowerCase();
    return `
      <button onclick="setPreviewColor('${colHex}')" title="Pilih Kostum Warna ${sIdx + 1}"
        class="w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90 ${
          isCurrentActive
            ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-950 scale-110 shadow-emerald-500/40'
            : 'border border-white/20 hover:scale-105 opacity-80 hover:opacity-100'
        }" style="background:${colHex}">
        <i class="fa-solid fa-shirt text-xs ${isCurrentActive ? 'text-white' : 'text-slate-900/80'}"></i>
      </button>
    `;
  }).join('');

  // 3. Update Big SELECT Button State
  const isAlreadyEquipped = (team.avatar === previewAvatarId && team.color.toLowerCase() === previewColor.toLowerCase());
  const selectBtn = document.getElementById('modal-select-btn');
  if (isAlreadyEquipped) {
    selectBtn.innerHTML = '<i class="fa-solid fa-circle-check text-lg"></i> TERPILIH ✓';
    selectBtn.className = 'w-full max-w-xs py-3 rounded-2xl font-game text-base md:text-lg font-black uppercase tracking-wider text-emerald-300 shadow-lg bg-emerald-950/60 border-2 border-emerald-500/50 cursor-default flex items-center justify-center gap-2';
  } else {
    selectBtn.innerHTML = '<i class="fa-solid fa-check-circle text-lg"></i> SELECT';
    selectBtn.className = 'w-full max-w-xs py-3 rounded-2xl font-game text-base md:text-lg font-black uppercase tracking-wider text-slate-950 shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 hover:from-emerald-300 hover:to-teal-300 shadow-emerald-500/30 border border-emerald-300 animate-pulse';
  }

  // 4. Render Roster Grid at the Bottom
  const rosterGrid = document.getElementById('modal-roster-grid');
  rosterGrid.innerHTML = AVATAR_TYPES.map(av => {
    const isSelectedInStage = (av.id === previewAvatarId);
    const isEquippedByTeam = (av.id === team.avatar);
    return `
      <div onclick="setPreviewAvatar('${av.id}')"
        class="relative rounded-2xl p-1.5 flex flex-col items-center gap-1 cursor-pointer transition-all active:scale-95 ${
          isSelectedInStage
            ? 'bg-cyan-500/25 border-2 border-cyan-400 shadow-lg shadow-cyan-500/30 scale-105'
            : 'bg-slate-900/70 border border-white/10 hover:border-white/30 hover:bg-slate-800/80'
        }">
        <canvas id="roster-item-canvas-${av.id}" width="46" height="46" class="rounded-xl block"></canvas>
        <span class="text-[10px] font-bold truncate max-w-full ${isSelectedInStage ? 'text-cyan-200' : 'text-slate-300'}">${av.label}</span>
        ${
          isEquippedByTeam
            ? '<span class="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-500 text-slate-950 text-[9px] font-black flex items-center justify-center shadow">✓</span>'
            : ''
        }
      </div>
    `;
  }).join('');

  // Render thumbnails in the roster grid
  const MR = window.MapRenderer;
  if (MR && MR.drawChibiThumbnail) {
    AVATAR_TYPES.forEach(av => {
      const c = document.getElementById(`roster-item-canvas-${av.id}`);
      if (c) {
        const itemCol = (av.id === previewAvatarId) ? previewColor : av.color;
        MR.drawChibiThumbnail(c, av.id, itemCol, false);
      }
    });
  }
}

function startShowcaseLoop() {
  if (showcaseAnimId) cancelAnimationFrame(showcaseAnimId);
  function step() {
    showcaseTick++;
    const canvas = document.getElementById('avatar-showcase-canvas');
    const MR = window.MapRenderer;
    if (canvas && MR && MR.drawShowcaseStage) {
      MR.drawShowcaseStage(canvas, previewAvatarId, previewColor, showcaseTick);
    }
    const modal = document.getElementById('avatar-selector-modal');
    if (modal && !modal.classList.contains('hidden')) {
      showcaseAnimId = requestAnimationFrame(step);
    }
  }
  showcaseAnimId = requestAnimationFrame(step);
}

// Expose modal controller functions to window
window.openAvatarModal = openAvatarModal;
window.closeAvatarModal = closeAvatarModal;
window.setPreviewAvatar = setPreviewAvatar;
window.setPreviewColor = setPreviewColor;
window.cycleShowcaseColor = cycleShowcaseColor;
window.confirmAvatarSelection = confirmAvatarSelection;
window.renderPrepTeams = renderPrepTeams;
window.cycleTeamColorDirectly = cycleTeamColorDirectly;

function addTeam() {
  if (teams.length >= 6) {
    alert("Maksimal 6 Tim/Squad!");
    return;
  }
  const preset = AVATAR_TYPES[teams.length % AVATAR_TYPES.length];
  const c = Math.floor(mapSize / 2);
  teams.push({
    id: teams.length,
    name: `Team ${preset.label}`,
    pilot: `Squad #${teams.length + 1}`,
    avatar: preset.id,
    color: preset.color,
    badge: String.fromCharCode(65 + teams.length),
    x: c, y: c, renderX: c, renderY: c, hopZ: 0, isMoving: false, walkPhase: 0, facing: 1, prevX: c, prevY: c,
    lp: 100, mp: 2, maxMp: 2, score: 0, kills: 0, correct: 0, alive: true, isFrozen: false
  });
  renderPrepTeams();
  AudioManager.play('correct');
}

const questionIcons = [
  { icon: 'fa-pen-to-square', color: 'text-cyan-400 bg-cyan-500/20 border-cyan-400/40' },
  { icon: 'fa-lightbulb', color: 'text-amber-400 bg-amber-500/20 border-amber-400/40' },
  { icon: 'fa-bolt', color: 'text-rose-400 bg-rose-500/20 border-rose-400/40' },
  { icon: 'fa-brain', color: 'text-purple-400 bg-purple-500/20 border-purple-400/40' },
  { icon: 'fa-parachute-box', color: 'text-emerald-400 bg-emerald-500/20 border-emerald-400/40' },
  { icon: 'fa-masks-theater', color: 'text-fuchsia-400 bg-fuchsia-500/20 border-fuchsia-400/40' },
  { icon: 'fa-list-check', color: 'text-blue-400 bg-blue-500/20 border-blue-400/40' }
];

function renderPrepQuestions() {
  const countEl = document.getElementById('q-count');
  if (countEl) countEl.textContent = questions.length;
  const list = document.getElementById('questions-list');
  if (!list) return;

  list.innerHTML = questions.map((q, i) => {
    const iconObj = questionIcons[i % questionIcons.length];
    const typeLabel = q.type === 'airdrop' ? 'AIRDROP' : (q.type === 'challenge' ? 'DUEL' : 'REGULAR');
    const typeBadgeColor = q.type === 'airdrop' 
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
      : (q.type === 'challenge' 
          ? 'bg-rose-500/20 text-rose-300 border-rose-400/30' 
          : 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30');

    return `
      <div class="p-2 md:p-2.5 rounded-xl bg-slate-900/85 hover:bg-slate-800/90 border border-white/10 hover:border-cyan-400/40 text-xs flex justify-between items-center gap-2.5 transition group shadow-sm">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          <div class="w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 shadow-sm ${iconObj.color}">
            <i class="fa-solid ${iconObj.icon} text-[10px]"></i>
          </div>
          <div class="truncate flex-1">
            <span class="text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded border mr-1.5 ${typeBadgeColor}">
              ${typeLabel}
            </span>
            <span class="text-slate-200 font-medium">${q.q}</span>
          </div>
        </div>
        <button onclick="questions.splice(${i},1);renderPrepQuestions();AudioManager.play('click')" 
          title="Hapus Soal" 
          class="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 hover:text-rose-200 flex items-center justify-center text-xs transition active:scale-90 shrink-0">
          <i class="fa-solid fa-trash-can text-[10px]"></i>
        </button>
      </div>
    `;
  }).join('');
}

function openAddQuestionModal() {
  const modal = document.getElementById('add-question-modal');
  if (modal) modal.classList.remove('hidden');
  AudioManager.play('click');
}

function closeAddQuestionModal() {
  const modal = document.getElementById('add-question-modal');
  if (modal) modal.classList.add('hidden');
  AudioManager.play('click');
}

function addQuestion() {
  const qEl = document.getElementById('new-q-text');
  const aEl = document.getElementById('new-q-a');
  const bEl = document.getElementById('new-q-b');
  const cEl = document.getElementById('new-q-c');
  const dEl = document.getElementById('new-q-d');
  const ansEl = document.getElementById('new-q-ans');
  const typeEl = document.getElementById('new-q-type');

  if (!qEl || !aEl || !bEl) return;
  const q = qEl.value.trim();
  const a = aEl.value.trim();
  const b = bEl.value.trim();
  const c = cEl ? cEl.value.trim() : '';
  const d = dEl ? dEl.value.trim() : '';

  if (!q || !a || !b) {
    alert("Mohon isi pertanyaan dan minimal pilihan jawaban A dan B.");
    return;
  }

  questions.push({
    q,
    opts: [a, b, c || '-', d || '-'],
    ans: ansEl ? parseInt(ansEl.value) : 0,
    type: typeEl ? typeEl.value : 'regular'
  });

  qEl.value = '';
  if (aEl) aEl.value = '';
  if (bEl) bEl.value = '';
  if (cEl) cEl.value = '';
  if (dEl) dEl.value = '';

  renderPrepQuestions();
  closeAddQuestionModal();
  AudioManager.play('correct');
}

function handleQuestionsFileImport(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data) && data.length > 0) {
        questions = data;
        renderPrepQuestions();
        AudioManager.play('correct');
      } else {
        alert("File JSON harus berupa list pertanyaan yang valid.");
      }
    } catch (err) {
      alert("Gagal membaca file JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function exportQuestionsJSON() {
  const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bank-soal-last-zone.json';
  a.click();
  AudioManager.play('click');
}

function exportQuestionsExcel() {
  if (typeof XLSX === 'undefined') {
    alert("Library SheetJS (XLSX) belum dimuat.");
    return;
  }
  const letters = ['A', 'B', 'C', 'D'];
  const exportData = questions.map(q => ({
    "Pertanyaan": q.q,
    "Opsi A": (q.opts && q.opts[0]) || '',
    "Opsi B": (q.opts && q.opts[1]) || '',
    "Opsi C": (q.opts && q.opts[2]) || '',
    "Opsi D": (q.opts && q.opts[3]) || '',
    "Kunci Jawaban (A/B/C/D)": letters[q.ans] || 'A',
    "Tipe Soal": q.type || 'regular'
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  ws['!cols'] = [
    { wch: 65 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 35 },
    { wch: 25 },
    { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bank Soal");
  XLSX.writeFile(wb, "Bank_Soal_LastZone_Export.xlsx");
  AudioManager.play('correct');
}
window.exportQuestionsExcel = exportQuestionsExcel;

// ----------------------------------------------------------------------------
// EXCEL IMPORT & TEMPLATE MANAGEMENT (SHEETJS XLSX)
// ----------------------------------------------------------------------------
let pendingExcelQuestions = [];

function openImportChoiceModal() {
  const modal = document.getElementById('import-choice-modal');
  if (modal) modal.classList.remove('hidden');
  AudioManager.play('click');
}

function closeImportChoiceModal() {
  const modal = document.getElementById('import-choice-modal');
  if (modal) modal.classList.add('hidden');
  AudioManager.play('click');
}

function triggerJSONImport() {
  closeImportChoiceModal();
  const jsonInput = document.getElementById('import-questions-input');
  if (jsonInput) jsonInput.click();
}

function openExcelImportModal() {
  closeImportChoiceModal();
  const modal = document.getElementById('import-excel-modal');
  if (modal) {
    modal.classList.remove('hidden');
    resetExcelImportState();
  }
  AudioManager.play('click');
}

function closeExcelImportModal() {
  const modal = document.getElementById('import-excel-modal');
  if (modal) modal.classList.add('hidden');
  AudioManager.play('click');
}

function downloadQuestionsExcelTemplate() {
  if (typeof XLSX === 'undefined') {
    alert("Library SheetJS (XLSX) belum dimuat. Pastikan perangkat terhubung ke internet.");
    return;
  }

  const templateRows = [
    {
      "Pertanyaan": "Choose the correct passive form: 'The chef prepares the meal every morning.'",
      "Opsi A": "The meal is prepared by the chef every morning.",
      "Opsi B": "The meal was prepared by the chef.",
      "Opsi C": "The meal is preparing by the chef.",
      "Opsi D": "The chef is prepared the meal.",
      "Kunci Jawaban (A/B/C/D)": "A",
      "Tipe Soal": "regular"
    },
    {
      "Pertanyaan": "What is the main purpose of an Analytical Exposition text?",
      "Opsi A": "To retell past events",
      "Opsi B": "To persuade the reader that an idea is important",
      "Opsi C": "To describe how to make something",
      "Opsi D": "To entertain the reader with a fable",
      "Kunci Jawaban (A/B/C/D)": "B",
      "Tipe Soal": "regular"
    },
    {
      "Pertanyaan": "Which word is closest in meaning to 'Resilient'?",
      "Opsi A": "Fragile",
      "Opsi B": "Tough & flexible",
      "Opsi C": "Temporary",
      "Opsi D": "Hesitant",
      "Kunci Jawaban (A/B/C/D)": "B",
      "Tipe Soal": "airdrop"
    },
    {
      "Pertanyaan": "Identify the correct conditional sentence (Type 3):",
      "Opsi A": "If she studies, she will pass.",
      "Opsi B": "If she studied, she would pass.",
      "Opsi C": "If she had studied, she would have passed.",
      "Opsi D": "If she study, she passed.",
      "Kunci Jawaban (A/B/C/D)": "C",
      "Tipe Soal": "challenge"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateRows);
  ws['!cols'] = [
    { wch: 65 }, // Pertanyaan
    { wch: 35 }, // Opsi A
    { wch: 35 }, // Opsi B
    { wch: 35 }, // Opsi C
    { wch: 35 }, // Opsi D
    { wch: 25 }, // Kunci Jawaban
    { wch: 20 }  // Tipe Soal
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Bank Soal");
  XLSX.writeFile(wb, "Template_Bank_Soal_LastZone.xlsx");
  AudioManager.play('correct');
}

function handleExcelFileSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const infoEl = document.getElementById('excel-file-info');
  const btnProcess = document.getElementById('btn-process-excel-import');

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      if (typeof XLSX === 'undefined') {
        throw new Error("Library SheetJS (XLSX) belum dimuat.");
      }
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error("Sheet Excel pertama kosong atau tidak memiliki baris data.");
      }

      pendingExcelQuestions = [];

      for (let i = 0; i < rawRows.length; i++) {
        const row = rawRows[i];

        // 1. Ambil Pertanyaan
        const qText = findExcelCellValue(row, ['pertanyaan', 'soal', 'question', 'teks soal', 'q']);
        if (!qText || String(qText).trim() === '') continue;

        // 2. Ambil Opsi A-D
        const optA = findExcelCellValue(row, ['opsi a', 'pilihan a', 'a', 'jawaban a', 'option a', 'opsi_a']);
        const optB = findExcelCellValue(row, ['opsi b', 'pilihan b', 'b', 'jawaban b', 'option b', 'opsi_b']);
        const optC = findExcelCellValue(row, ['opsi c', 'pilihan c', 'c', 'jawaban c', 'option c', 'opsi_c']);
        const optD = findExcelCellValue(row, ['opsi d', 'pilihan d', 'd', 'jawaban d', 'option d', 'opsi_d']);

        const options = [
          String(optA !== undefined && optA !== '' ? optA : '-').trim(),
          String(optB !== undefined && optB !== '' ? optB : '-').trim(),
          String(optC !== undefined && optC !== '' ? optC : '-').trim(),
          String(optD !== undefined && optD !== '' ? optD : '-').trim()
        ];

        // 3. Konversi Kunci Jawaban A/B/C/D -> Indeks 0/1/2/3
        const keyRaw = findExcelCellValue(row, [
          'kunci jawaban (a/b/c/d)',
          'kunci jawaban',
          'kunci',
          'jawaban benar',
          'answer',
          'key',
          'ans',
          'kunci_jawaban'
        ]);
        const ansIndex = parseExcelAnswerKey(keyRaw, options);

        // 4. Konversi Tipe Soal
        const typeRaw = findExcelCellValue(row, [
          'tipe soal (regular/airdrop/challenge)',
          'tipe soal',
          'tipe',
          'type',
          'kategori',
          'tipe_soal'
        ]);
        let qType = 'regular';
        if (typeRaw) {
          const normType = String(typeRaw).toLowerCase().trim();
          if (normType.includes('airdrop') || normType.includes('peti')) {
            qType = 'airdrop';
          } else if (normType.includes('challenge') || normType.includes('duel') || normType.includes('tantangan')) {
            qType = 'challenge';
          }
        }

        pendingExcelQuestions.push({
          q: String(qText).trim(),
          opts: options,
          ans: ansIndex,
          type: qType
        });
      }

      if (pendingExcelQuestions.length === 0) {
        throw new Error("Tidak ditemukan baris pertanyaan yang valid pada file Excel.");
      }

      if (infoEl) {
        infoEl.innerHTML = `
          <div class="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs flex items-center justify-between">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-circle-check text-emerald-400 text-base"></i>
              <div>
                <div class="font-bold">${file.name}</div>
                <div class="text-[10px] text-emerald-200">${pendingExcelQuestions.length} Soal siap diimpor dari sheet "${firstSheetName}"</div>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[10px]">SIAP</span>
          </div>
        `;
      }
      if (btnProcess) {
        btnProcess.disabled = false;
        btnProcess.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      AudioManager.play('correct');

    } catch (err) {
      if (infoEl) {
        infoEl.innerHTML = `
          <div class="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs flex items-center gap-2">
            <i class="fa-solid fa-triangle-exclamation text-rose-400 text-base"></i>
            <div>
              <div class="font-bold">Gagal membaca Excel:</div>
              <div class="text-[10px] text-rose-200">${err.message}</div>
            </div>
          </div>
        `;
      }
      if (btnProcess) {
        btnProcess.disabled = true;
        btnProcess.classList.add('opacity-50', 'cursor-not-allowed');
      }
      AudioManager.play('wrong');
    }
  };
  reader.readAsArrayBuffer(file);
}

function findExcelCellValue(row, possibleKeys) {
  const rowKeys = Object.keys(row);
  for (const target of possibleKeys) {
    const matchedKey = rowKeys.find(k => k.trim().toLowerCase() === target.toLowerCase());
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return row[matchedKey];
    }
  }
  for (const target of possibleKeys) {
    const matchedKey = rowKeys.find(k => k.trim().toLowerCase().includes(target.toLowerCase()));
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return row[matchedKey];
    }
  }
  return '';
}

function parseExcelAnswerKey(rawKey, options) {
  if (rawKey === undefined || rawKey === null || rawKey === '') return 0;
  const str = String(rawKey).trim().toUpperCase();

  // 1. Direct letter check (A/B/C/D)
  if (str === 'A' || str === 'OPSI A' || str === 'PILIHAN A' || str.startsWith('A.') || str.startsWith('A -')) return 0;
  if (str === 'B' || str === 'OPSI B' || str === 'PILIHAN B' || str.startsWith('B.') || str.startsWith('B -')) return 1;
  if (str === 'C' || str === 'OPSI C' || str === 'PILIHAN C' || str.startsWith('C.') || str.startsWith('C -')) return 2;
  if (str === 'D' || str === 'OPSI D' || str === 'PILIHAN D' || str.startsWith('D.') || str.startsWith('D -')) return 3;

  // 2. 1-based number check (1->0, 2->1, 3->2, 4->3)
  if (str === '1') return 0;
  if (str === '2') return 1;
  if (str === '3') return 2;
  if (str === '4') return 3;

  // 3. 0-based number check
  if (str === '0') return 0;

  // 4. Exact text matching against options
  if (Array.isArray(options)) {
    const rawLower = String(rawKey).trim().toLowerCase();
    for (let idx = 0; idx < options.length; idx++) {
      if (options[idx].toLowerCase() === rawLower) {
        return idx;
      }
    }
  }

  // 5. Look for standalone A-D letter
  const letterMatch = str.match(/\b([A-D])\b/);
  if (letterMatch) {
    const l = letterMatch[1];
    return l === 'A' ? 0 : l === 'B' ? 1 : l === 'C' ? 2 : 3;
  }

  return 0;
}

function executeExcelImport() {
  if (!pendingExcelQuestions || pendingExcelQuestions.length === 0) {
    alert("Pilih file Excel terlebih dahulu.");
    return;
  }

  const replaceRadio = document.getElementById('excel-mode-replace');
  const isReplace = replaceRadio ? replaceRadio.checked : true;

  if (isReplace) {
    questions = [...pendingExcelQuestions];
  } else {
    questions = [...questions, ...pendingExcelQuestions];
  }

  renderPrepQuestions();
  closeExcelImportModal();
  AudioManager.play('correct');

  const feedbackMsg = isReplace
    ? `Berhasil mengimpor ${pendingExcelQuestions.length} soal baru dari Excel!`
    : `Berhasil menambahkan ${pendingExcelQuestions.length} soal dari Excel! Total soal: ${questions.length}`;
  alert(feedbackMsg);
}

function resetExcelImportState() {
  pendingExcelQuestions = [];
  const fileInput = document.getElementById('excel-questions-file');
  if (fileInput) fileInput.value = '';
  const infoEl = document.getElementById('excel-file-info');
  if (infoEl) {
    infoEl.innerHTML = `
      <div class="p-3 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 text-xs flex items-center gap-2">
        <i class="fa-solid fa-cloud-arrow-up text-cyan-400 text-base"></i>
        <span>Pilih file .xlsx atau .xls dari komputer / perangkat Anda.</span>
      </div>
    `;
  }
  const btnProcess = document.getElementById('btn-process-excel-import');
  if (btnProcess) {
    btnProcess.disabled = true;
    btnProcess.classList.add('opacity-50', 'cursor-not-allowed');
  }
}

function toggleLobbyNavMenu() {
  const dd = document.getElementById('lobby-nav-dropdown');
  if (dd) dd.classList.toggle('hidden');
  AudioManager.play('click');
}

function toggleAudioMute() {
  audioManager.setMuted(!audioManager.muted);
}

function openAudioSettingsModal() {
  const modal = document.getElementById('modal-audio-settings');
  if (!modal) return;

  const bgmSlider = document.getElementById('bgm-vol-slider');
  const bgmVal = document.getElementById('bgm-vol-val');
  if (bgmSlider && bgmVal) {
    const bgmPercent = Math.round(audioManager.bgmVolume * 100);
    bgmSlider.value = bgmPercent;
    bgmVal.textContent = `${bgmPercent}%`;
  }

  const sfxSlider = document.getElementById('sfx-vol-slider');
  const sfxVal = document.getElementById('sfx-vol-val');
  if (sfxSlider && sfxVal) {
    const sfxPercent = Math.round(audioManager.sfxVolume * 100);
    sfxSlider.value = sfxPercent;
    sfxVal.textContent = `${sfxPercent}%`;
  }

  audioManager.updateMuteUI();
  modal.classList.remove('hidden');
  audioManager.play('click');
}

function closeAudioSettingsModal() {
  const modal = document.getElementById('modal-audio-settings');
  if (modal) modal.classList.add('hidden');
  audioManager.play('click');
}

function onBGMVolumeSliderChange(val) {
  const floatVal = parseInt(val, 10) / 100;
  audioManager.setBGMVolume(floatVal);
  const display = document.getElementById('bgm-vol-val');
  if (display) display.textContent = `${val}%`;
}

function onSFXVolumeSliderChange(val) {
  const floatVal = parseInt(val, 10) / 100;
  audioManager.setSFXVolume(floatVal);
  const display = document.getElementById('sfx-vol-val');
  if (display) display.textContent = `${val}%`;
}

function testSFXSound() {
  audioManager.play('correct');
}

// ----------------------------------------------------------------------------
// 15C. LOBBY PARTICLES & LIVE CHIBI IDLE ANIMATIONS
// ----------------------------------------------------------------------------
let lobbyAnimTick = 0;
let lastLobbyAnimTime = 0;
function runLobbyChibiAnimLoop(now = 0) {
  requestAnimationFrame(runLobbyChibiAnimLoop);

  const prepView = document.getElementById('view-prep');
  if (!prepView || prepView.classList.contains('hidden')) return;

  if (now - lastLobbyAnimTime < 33) return; // 30 FPS throttle
  lastLobbyAnimTime = now;

  lobbyAnimTick++;
  const MR = window.MapRenderer;
  if (MR && MR.drawChibiThumbnail) {
    teams.forEach((t, idx) => {
      const canvas = document.getElementById(`team-chibi-canvas-${idx}`);
      if (canvas) {
        MR.drawChibiThumbnail(canvas, t.avatar, t.color, true, lobbyAnimTick + idx * 15);
      }
    });
  }
}

let lobbyParticles = [];
function initLobbyParticles() {
  const pCanvas = document.getElementById('lobby-bg-particles');
  if (!pCanvas) return;
  const pCtx = pCanvas.getContext('2d');

  function resizeParticlesCanvas() {
    const prepView = document.getElementById('view-prep');
    pCanvas.width = prepView ? Math.max(window.innerWidth, prepView.scrollWidth) : window.innerWidth;
    pCanvas.height = prepView ? Math.max(window.innerHeight, prepView.scrollHeight) : window.innerHeight;
  }
  resizeParticlesCanvas();
  window.addEventListener('resize', resizeParticlesCanvas);

  lobbyParticles = [];
  const count = 45;
  for (let i = 0; i < count; i++) {
    lobbyParticles.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      radius: Math.random() * 2.2 + 0.8,
      speedX: (Math.random() - 0.5) * 0.4,
      speedY: -(Math.random() * 0.6 + 0.3),
      alpha: Math.random() * 0.7 + 0.3,
      color: Math.random() > 0.4 ? 'rgba(6, 182, 212, ' : (Math.random() > 0.5 ? 'rgba(245, 158, 11, ' : 'rgba(168, 85, 247, ')
    });
  }

  let lastParticleTime = 0;
  function renderParticles(now = 0) {
    requestAnimationFrame(renderParticles);

    const prepView = document.getElementById('view-prep');
    if (!prepView || prepView.classList.contains('hidden')) return;

    if (now - lastParticleTime < 33) return; // 30 FPS throttle
    lastParticleTime = now;

    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    for (let p of lobbyParticles) {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.y < -10) {
        p.y = pCanvas.height + 10;
        p.x = Math.random() * pCanvas.width;
      }
      if (p.x < -10) p.x = pCanvas.width + 10;
      if (p.x > pCanvas.width + 10) p.x = -10;

      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      pCtx.fillStyle = p.color + p.alpha + ')';
      pCtx.fill();
    }
  }
  requestAnimationFrame(renderParticles);
}

// Expose functions to window for HTML event handlers
window.addTeam = addTeam;
window.renderPrepQuestions = renderPrepQuestions;
window.openAddQuestionModal = openAddQuestionModal;
window.closeAddQuestionModal = closeAddQuestionModal;
window.addQuestion = addQuestion;
window.handleQuestionsFileImport = handleQuestionsFileImport;
window.exportQuestionsJSON = exportQuestionsJSON;
window.openImportChoiceModal = openImportChoiceModal;
window.closeImportChoiceModal = closeImportChoiceModal;
window.triggerJSONImport = triggerJSONImport;
window.openExcelImportModal = openExcelImportModal;
window.closeExcelImportModal = closeExcelImportModal;
window.downloadQuestionsExcelTemplate = downloadQuestionsExcelTemplate;
window.handleExcelFileSelected = handleExcelFileSelected;
window.executeExcelImport = executeExcelImport;
window.resetExcelImportState = resetExcelImportState;
window.toggleLobbyNavMenu = toggleLobbyNavMenu;
window.toggleAudioMute = toggleAudioMute;

// ----------------------------------------------------------------------------
// 16. PUBG ERANGEL TACTICAL SATELLITE MINIMAP & DROP RADAR ENGINE
// ----------------------------------------------------------------------------

const POI_PRESETS = [
  { id: 'north_coast', defaultName: 'Nova Harbor', normX: 0.50, normY: 0.14, type: 'port', pool: ['Nova Harbor', 'Severny Bay', 'Polaris Pier', 'Glacier Port', 'Aurora Docks'] },
  { id: 'mountain', defaultName: 'Aether Peak', normX: 0.74, normY: 0.16, type: 'peak', pool: ['Aether Peak', 'Stalber Summit', 'Falcon Crest', 'Titan Ridge', 'Zenith Peak'] },
  { id: 'west_port', defaultName: 'Cyber Port', normX: 0.20, normY: 0.32, type: 'port', pool: ['Cyber Port', 'Vortex Docks', 'Cobalt Harbor', 'Anchor Bay', 'Hydra Haven'] },
  { id: 'shooting_range', defaultName: 'Apex Arena', normX: 0.38, normY: 0.22, type: 'military', pool: ['Apex Arena', 'Shooting Range', 'Target Field', 'Valor Grounds', 'Ranger Outpost'] },
  { id: 'capital', defaultName: 'Academia Hall', normX: 0.68, normY: 0.36, type: 'city', pool: ['Academia Hall', 'Metropolis Alpha', 'Nexus City', 'Omni Plaza', 'Chronos Hall'] },
  { id: 'crossroads', defaultName: 'Echo Town', normX: 0.48, normY: 0.52, type: 'town', pool: ['Echo Town', 'Pochinki Center', 'Brawl Central', 'Crossroads', 'Pulse Village'] },
  { id: 'ruins', defaultName: 'Cyber Ruins', normX: 0.26, normY: 0.52, type: 'ruins', pool: ['Cyber Ruins', 'Ancient Relics', 'Sanctuary Ruins', 'Shadow Valley', 'Ghost Hollow'] },
  { id: 'east_pier', defaultName: 'Zephyr Pier', normX: 0.84, normY: 0.52, type: 'pier', pool: ['Zephyr Pier', 'Solstice Beach', 'East Haven', 'Siren Point', 'Oasis Marina'] },
  { id: 'quarry', defaultName: 'Iron Quarry', normX: 0.24, normY: 0.72, type: 'quarry', pool: ['Iron Quarry', 'Obsidian Pit', 'Granite Excavation', 'Brimstone Mine', 'Echo Basin'] },
  { id: 'farm', defaultName: 'Solar Farm', normX: 0.70, normY: 0.62, type: 'farm', pool: ['Solar Farm', 'Verdant Fields', 'Valley Haven', 'Agro Complex', 'Harvest Acres'] },
  { id: 'power', defaultName: 'Quantum Power', normX: 0.88, normY: 0.68, type: 'facility', pool: ['Quantum Power', 'Fusion Reactor', 'Tesla Core', 'Helios Grid', 'Arc Station'] },
  { id: 'south_base', defaultName: 'Orion Base', normX: 0.52, normY: 0.84, type: 'military', pool: ['Orion Base', 'Sosnovka Barracks', 'Aegis Citadel', 'Fortress Prime', 'Command Bunker'] }
];

let activePOIs = POI_PRESETS.map(p => ({
  id: p.id,
  name: p.defaultName,
  normX: p.normX,
  normY: p.normY,
  type: p.type,
  pool: p.pool
}));

let flightPath = {
  start: { normX: 0.08, normY: 0.12 },
  end: { normX: 0.92, normY: 0.88 },
  label: 'NW ➔ SE'
};

let cachedIslandCanvas = null;
let cachedIslandKey = null;

function findNearestPOI(tileX, tileY) {
  const normX = (tileX + 0.5) / mapSize;
  const normY = (tileY + 0.5) / mapSize;
  let nearest = activePOIs[0];
  let minDist = Infinity;

  activePOIs.forEach(poi => {
    const dist = Math.hypot(poi.normX - normX, poi.normY - normY);
    if (dist < minDist) {
      minDist = dist;
      nearest = poi;
    }
  });

  return nearest;
}

function randomizePOINames() {
  activePOIs.forEach(poi => {
    if (poi.pool && poi.pool.length > 0) {
      const unused = poi.pool.filter(n => n !== poi.name);
      poi.name = unused[Math.floor(Math.random() * unused.length)] || poi.pool[0];
    }
  });
  cachedIslandCanvas = null;
  drawDropRadar();
  AudioManager.play('correct');
}

function randomizeFlightPath() {
  const angles = [
    { start: { normX: 0.08, normY: 0.12 }, end: { normX: 0.92, normY: 0.88 }, label: 'NW ➔ SE' },
    { start: { normX: 0.12, normY: 0.88 }, end: { normX: 0.88, normY: 0.12 }, label: 'SW ➔ NE' },
    { start: { normX: 0.50, normY: 0.05 }, end: { normX: 0.50, normY: 0.95 }, label: 'N ➔ S' },
    { start: { normX: 0.05, normY: 0.50 }, end: { normX: 0.95, normY: 0.50 }, label: 'W ➔ E' },
    { start: { normX: 0.92, normY: 0.15 }, end: { normX: 0.08, normY: 0.85 }, label: 'NE ➔ SW' }
  ];
  const choice = angles[Math.floor(Math.random() * angles.length)];
  flightPath = choice;
  drawDropRadar();
  AudioManager.play('click');
}

function getCachedIslandCanvas(targetSize = 512) {
  const currentKey = `${targetSize}_${activePOIs[0].name}_${activePOIs[1].name}`;
  if (cachedIslandCanvas && cachedIslandKey === currentKey) {
    return cachedIslandCanvas;
  }

  const offscreen = document.createElement('canvas');
  offscreen.width = targetSize;
  offscreen.height = targetSize;
  const oCtx = offscreen.getContext('2d');

  renderProceduralSatelliteIsland(oCtx, targetSize);

  cachedIslandCanvas = offscreen;
  cachedIslandKey = currentKey;
  return cachedIslandCanvas;
}

function renderProceduralSatelliteIsland(oCtx, size) {
  const imgData = oCtx.createImageData(size, size);
  const data = imgData.data;

  function getNoise(nx, ny) {
    return Math.sin(nx * 11.3 + ny * 7.7) * 0.14 +
           Math.cos(nx * 23.1 - ny * 17.9) * 0.07 +
           Math.sin(nx * 43.7 + ny * 37.1) * 0.035 +
           Math.cos(nx * 87.2 - ny * 79.5) * 0.018;
  }

  for (let py = 0; py < size; py++) {
    const ny = py / size;
    for (let px = 0; px < size; px++) {
      const nx = px / size;
      const idx = (py * size + px) * 4;

      // 1. Main Island (North/Center)
      const dx1 = (nx - 0.49) / 0.39;
      const dy1 = (ny - 0.38) / 0.32;
      const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
      let h1 = 1.0 - dist1 + getNoise(nx, ny);

      // 2. South Military Island (Sosnovka style)
      const dx2 = (nx - 0.52) / 0.27;
      const dy2 = (ny - 0.83) / 0.135;
      const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
      let h2 = 1.0 - dist2 + getNoise(nx * 1.5, ny * 1.5);

      // 3. Water strait separating North & South island
      if (ny >= 0.64 && ny <= 0.74) {
        const straitFactor = 1.0 - Math.abs(ny - 0.69) / 0.05;
        h1 -= straitFactor * 0.55;
        h2 -= straitFactor * 0.55;
      }

      // 4. River channel cutting across main island (west bay to Rozhok)
      const riverY = 0.36 + Math.sin(nx * 5.8) * 0.03;
      if (nx > 0.14 && nx < 0.65 && Math.abs(ny - riverY) < 0.018) {
        const rDist = Math.abs(ny - riverY) / 0.018;
        h1 -= (1.0 - rDist) * 0.6;
      }

      const h = Math.max(h1, h2);

      let r, g, b;

      if (h < 0) {
        // Ocean: Deep Ocean (#0b2239 to #133b5c) to Coastal Shelf (#1a4d75)
        if (h > -0.06) {
          const t = (h + 0.06) / 0.06;
          r = Math.floor(14 * (1 - t) + 26 * t);
          g = Math.floor(40 * (1 - t) + 77 * t);
          b = Math.floor(68 * (1 - t) + 117 * t);
        } else {
          const t = Math.min(1, Math.max(0, (h + 0.35) / 0.29));
          r = Math.floor(11 * (1 - t) + 19 * t);
          g = Math.floor(34 * (1 - t) + 59 * t);
          b = Math.floor(57 * (1 - t) + 92 * t);
        }
      } else if (h < 0.045) {
        // Sand / Shoreline beach (#8c7f65 to #a69575)
        const t = h / 0.045;
        r = Math.floor(140 * (1 - t) + 166 * t);
        g = Math.floor(127 * (1 - t) + 149 * t);
        b = Math.floor(101 * (1 - t) + 117 * t);
      } else if (h < 0.46) {
        // Lowlands: Grasslands (#384f2f) & Forests (#283d27)
        const fn = Math.sin(nx * 31 + ny * 29) + Math.cos(nx * 63 - ny * 57);
        if (fn > 0.35) {
          r = 40; g = 61; b = 39;
        } else if (fn < -0.3) {
          r = 68; g = 92; b = 51;
        } else {
          r = 56; g = 79; b = 47;
        }
      } else if (h < 0.62) {
        // Rocky foothills & slopes (#4a4e48)
        const t = (h - 0.46) / 0.16;
        r = Math.floor(56 * (1 - t) + 74 * t);
        g = Math.floor(79 * (1 - t) + 78 * t);
        b = Math.floor(47 * (1 - t) + 72 * t);
      } else {
        // High rocky mountain peaks (#5a574d to #73756c)
        const t = Math.min(1, (h - 0.62) / 0.25);
        r = Math.floor(90 * (1 - t) + 115 * t);
        g = Math.floor(87 * (1 - t) + 117 * t);
        b = Math.floor(77 * (1 - t) + 108 * t);
      }

      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }

  oCtx.putImageData(imgData, 0, 0);

  // Draw road network & bridges
  drawRoadNetworkAndBridges(oCtx, size);

  // Draw satellite building block clusters
  drawCityBuildingBlocks(oCtx, size);
}

function drawRoadNetworkAndBridges(oCtx, size) {
  const mainRoads = [
    [ [0.20, 0.32], [0.38, 0.22], [0.50, 0.14], [0.74, 0.16], [0.68, 0.36], [0.70, 0.62], [0.48, 0.52], [0.26, 0.52], [0.20, 0.32] ],
    [ [0.68, 0.36], [0.84, 0.52] ],
    [ [0.70, 0.62], [0.88, 0.68] ],
    [ [0.26, 0.52], [0.24, 0.72] ],
    [ [0.39, 0.60], [0.39, 0.66], [0.39, 0.74], [0.39, 0.78], [0.52, 0.84] ],
    [ [0.68, 0.62], [0.68, 0.66], [0.68, 0.74], [0.68, 0.78], [0.52, 0.84] ],
    [ [0.39, 0.78], [0.36, 0.86], [0.52, 0.88], [0.68, 0.86], [0.68, 0.78] ]
  ];

  oCtx.save();
  oCtx.lineCap = 'round';
  oCtx.lineJoin = 'round';

  // Outer dark road edge
  oCtx.strokeStyle = 'rgba(15, 23, 42, 0.85)';
  oCtx.lineWidth = 4.2;
  mainRoads.forEach(segment => {
    oCtx.beginPath();
    segment.forEach((pt, i) => {
      const px = pt[0] * size;
      const py = pt[1] * size;
      if (i === 0) oCtx.moveTo(px, py);
      else oCtx.lineTo(px, py);
    });
    oCtx.stroke();
  });

  // Inner light road pavement
  oCtx.strokeStyle = 'rgba(226, 232, 240, 0.9)';
  oCtx.lineWidth = 2.0;
  mainRoads.forEach(segment => {
    oCtx.beginPath();
    segment.forEach((pt, i) => {
      const px = pt[0] * size;
      const py = pt[1] * size;
      if (i === 0) oCtx.moveTo(px, py);
      else oCtx.lineTo(px, py);
    });
    oCtx.stroke();
  });

  // 2 Bridges crossing the strait
  const bridges = [
    { x: 0.39 * size, y1: 0.66 * size, y2: 0.74 * size },
    { x: 0.68 * size, y1: 0.66 * size, y2: 0.74 * size }
  ];

  bridges.forEach(b => {
    oCtx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    oCtx.fillRect(b.x - 3.5, b.y1, 7, b.y2 - b.y1);

    oCtx.fillStyle = '#94a3b8';
    oCtx.fillRect(b.x - 2.5, b.y1, 5, b.y2 - b.y1);

    oCtx.strokeStyle = '#ffffff';
    oCtx.lineWidth = 1.5;
    oCtx.beginPath();
    oCtx.moveTo(b.x, b.y1);
    oCtx.lineTo(b.x, b.y2);
    oCtx.stroke();

    oCtx.strokeStyle = '#475569';
    oCtx.lineWidth = 1;
    oCtx.strokeRect(b.x - 3, b.y1, 6, b.y2 - b.y1);
  });

  oCtx.restore();
}

function drawCityBuildingBlocks(oCtx, size) {
  oCtx.save();

  activePOIs.forEach(poi => {
    const cx = poi.normX * size;
    const cy = poi.normY * size;

    if (poi.id === 'south_base') {
      // Runway & hangars
      oCtx.fillStyle = '#334155';
      oCtx.fillRect(cx - 32, cy - 3, 64, 6);
      oCtx.strokeStyle = '#facc15';
      oCtx.lineWidth = 1;
      oCtx.setLineDash([3, 2]);
      oCtx.beginPath();
      oCtx.moveTo(cx - 30, cy);
      oCtx.lineTo(cx + 30, cy);
      oCtx.stroke();
      oCtx.setLineDash([]);

      oCtx.fillStyle = '#cbd5e1';
      for (let i = -2; i <= 2; i++) {
        oCtx.fillRect(cx + i * 12 - 4, cy - 10, 8, 5);
        oCtx.fillRect(cx + i * 12 - 4, cy + 6, 8, 5);
      }
      return;
    }

    if (poi.id === 'power') {
      // Cooling towers & substation
      oCtx.fillStyle = '#94a3b8';
      oCtx.beginPath();
      oCtx.arc(cx - 8, cy, 6, 0, Math.PI * 2);
      oCtx.arc(cx + 8, cy, 6, 0, Math.PI * 2);
      oCtx.fill();
      oCtx.fillStyle = '#0f172a';
      oCtx.beginPath();
      oCtx.arc(cx - 8, cy, 2.5, 0, Math.PI * 2);
      oCtx.arc(cx + 8, cy, 2.5, 0, Math.PI * 2);
      oCtx.fill();
      return;
    }

    // Standard city: 12-16 building blocks (#cbd5e1, #94a3b8)
    const count = 14;
    const colors = ['#cbd5e1', '#94a3b8', '#e2e8f0', '#f1f5f9'];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (i % 3);
      const rad = 6 + (i % 4) * 4.5;
      const bx = cx + Math.cos(angle) * rad;
      const by = cy + Math.sin(angle) * rad;
      const bw = 3.5 + (i % 3) * 1.5;
      const bh = 3.5 + ((i + 1) % 3) * 1.5;

      oCtx.fillStyle = 'rgba(15, 23, 42, 0.6)';
      oCtx.fillRect(bx + 1, by + 1, bw, bh);

      oCtx.fillStyle = colors[i % colors.length];
      oCtx.fillRect(bx, by, bw, bh);
    }
  });

  oCtx.restore();
}

function drawDropRadar() {
  const dCanvas = document.getElementById('drop-canvas');
  if (!dCanvas) return;
  const dCtx = dCanvas.getContext('2d');
  const w = dCanvas.width;
  const h = dCanvas.height;
  const cell = w / mapSize;

  dCtx.clearRect(0, 0, w, h);

  // 1. Draw cached satellite island topography
  const islandCanvas = getCachedIslandCanvas(w);
  dCtx.drawImage(islandCanvas, 0, 0, w, h);

  // 2. Draw tactical coordinate grid lines & labels (Letters A-H, Numbers 1-8)
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  dCtx.save();
  dCtx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  dCtx.lineWidth = 0.8;
  dCtx.font = 'bold 9px monospace';
  dCtx.fillStyle = 'rgba(255, 255, 255, 0.45)';

  for (let x = 0; x <= mapSize; x++) {
    const gx = x * cell;
    dCtx.beginPath();
    dCtx.moveTo(gx, 0);
    dCtx.lineTo(gx, h);
    dCtx.stroke();
    if (x < mapSize && (mapSize <= 16 || x % 2 === 0)) {
      dCtx.fillText(letters[x % letters.length], gx + 3, 10);
    }
  }

  for (let y = 0; y <= mapSize; y++) {
    const gy = y * cell;
    dCtx.beginPath();
    dCtx.moveTo(0, gy);
    dCtx.lineTo(w, gy);
    dCtx.stroke();
    if (y < mapSize && (mapSize <= 16 || y % 2 === 0)) {
      dCtx.fillText((y + 1).toString(), 3, gy + 10);
    }
  }
  dCtx.restore();

  // 3. Safe Zone Overlay & Glowing Boundary
  dCtx.save();
  dCtx.fillStyle = 'rgba(6, 12, 28, 0.62)';
  // Outside bands
  dCtx.fillRect(0, 0, w, safeZone.minY * cell);
  dCtx.fillRect(0, (safeZone.maxY + 1) * cell, w, h - (safeZone.maxY + 1) * cell);
  dCtx.fillRect(0, safeZone.minY * cell, safeZone.minX * cell, (safeZone.maxY - safeZone.minY + 1) * cell);
  dCtx.fillRect((safeZone.maxX + 1) * cell, safeZone.minY * cell, w - (safeZone.maxX + 1) * cell, (safeZone.maxY - safeZone.minY + 1) * cell);

  // Glowing boundary
  const sx = safeZone.minX * cell;
  const sy = safeZone.minY * cell;
  const sw = (safeZone.maxX - safeZone.minX + 1) * cell;
  const sh = (safeZone.maxY - safeZone.minY + 1) * cell;

  dCtx.setLineDash([7, 5]);
  dCtx.strokeStyle = '#22c55e';
  dCtx.lineWidth = 2.5;
  dCtx.strokeRect(sx, sy, sw, sh);
  dCtx.restore();

  // 4. Dropship Flight Path
  dCtx.save();
  dCtx.setLineDash([8, 6]);
  dCtx.strokeStyle = '#facc15';
  dCtx.lineWidth = 2.2;

  const startX = flightPath.start.normX * w;
  const startY = flightPath.start.normY * h;
  const endX = flightPath.end.normX * w;
  const endY = flightPath.end.normY * h;

  dCtx.beginPath();
  dCtx.moveTo(startX, startY);
  dCtx.lineTo(endX, endY);
  dCtx.stroke();

  // Airplane icon at 45% along the flight path
  const planeT = 0.45;
  const px = startX + (endX - startX) * planeT;
  const py = startY + (endY - startY) * planeT;
  const angle = Math.atan2(endY - startY, endX - startX);

  dCtx.translate(px, py);
  dCtx.rotate(angle);
  dCtx.fillStyle = '#fef08a';
  dCtx.beginPath();
  dCtx.moveTo(11, 0);
  dCtx.lineTo(-9, -10);
  dCtx.lineTo(-5, -2);
  dCtx.lineTo(-11, -4);
  dCtx.lineTo(-11, 4);
  dCtx.lineTo(-5, 2);
  dCtx.lineTo(-9, 10);
  dCtx.closePath();
  dCtx.fill();
  dCtx.restore();

  // 5. POI City Names with Bold Black Outline
  dCtx.save();
  dCtx.font = '900 11px system-ui, -apple-system, sans-serif';
  dCtx.textAlign = 'center';
  dCtx.textBaseline = 'bottom';
  dCtx.lineJoin = 'round';

  activePOIs.forEach(poi => {
    const cx = poi.normX * w;
    const cy = poi.normY * h;

    // Glowing city dot
    dCtx.fillStyle = 'rgba(253, 224, 71, 0.4)';
    dCtx.beginPath();
    dCtx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    dCtx.fill();
    dCtx.fillStyle = '#fde047';
    dCtx.beginPath();
    dCtx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    dCtx.fill();

    // Bold black outline text
    dCtx.strokeStyle = '#000000';
    dCtx.lineWidth = 3.5;
    dCtx.strokeText(poi.name, cx, cy - 6);

    // Text fill
    dCtx.fillStyle = '#ffffff';
    dCtx.fillText(poi.name, cx, cy - 6);
  });
  dCtx.restore();

  // 6. Team Drop Pins
  dCtx.save();
  teams.forEach((t, idx) => {
    const tx = (t.x + 0.5) * cell;
    const ty = (t.y + 0.5) * cell;
    const isSelected = (selectedDropTeam === idx);

    // Radar pulse ring for selected team
    if (isSelected) {
      dCtx.strokeStyle = '#22d3ee';
      dCtx.lineWidth = 2;
      dCtx.beginPath();
      dCtx.arc(tx, ty, Math.max(14, cell * 0.7), 0, Math.PI * 2);
      dCtx.stroke();
    }

    // Pin shadow
    dCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    dCtx.beginPath();
    dCtx.ellipse(tx, ty + 10, 8, 3, 0, 0, Math.PI * 2);
    dCtx.fill();

    // Pin body
    dCtx.fillStyle = t.color;
    dCtx.beginPath();
    dCtx.arc(tx, ty, 10, 0, Math.PI * 2);
    dCtx.fill();
    dCtx.strokeStyle = '#ffffff';
    dCtx.lineWidth = 2.5;
    dCtx.stroke();

    // Team badge
    dCtx.fillStyle = '#ffffff';
    dCtx.font = '900 10px system-ui, sans-serif';
    dCtx.textAlign = 'center';
    dCtx.textBaseline = 'middle';
    dCtx.fillText(t.badge || String.fromCharCode(65 + idx), tx, ty);

    // Team name pill above pin
    dCtx.font = 'bold 9px system-ui, sans-serif';
    const nameWidth = dCtx.measureText(t.name).width;
    dCtx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    dCtx.fillRect(tx - nameWidth / 2 - 4, ty - 22, nameWidth + 8, 12);
    dCtx.strokeStyle = t.color;
    dCtx.lineWidth = 1;
    dCtx.strokeRect(tx - nameWidth / 2 - 4, ty - 22, nameWidth + 8, 12);
    dCtx.fillStyle = '#ffffff';
    dCtx.fillText(t.name, tx, ty - 16);
  });
  dCtx.restore();

  // 7. Render Team Drop Selector in Left Panel with Nearest POI
  const selDiv = document.getElementById('drop-team-selector');
  if (selDiv) {
    selDiv.innerHTML = teams.map((t, idx) => {
      const nearest = findNearestPOI(t.x, t.y);
      const isSel = (selectedDropTeam === idx);
      return `
        <button onclick="selectedDropTeam=${idx};drawDropRadar();AudioManager.play('click')" 
          class="w-full p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs font-bold transition-all shadow-sm active:scale-98 ${
            isSel 
              ? 'bg-cyan-500/25 border-2 border-cyan-400 text-white shadow-cyan-500/20' 
              : 'bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-slate-300'
          }">
          <div class="flex items-center gap-2.5 min-w-0">
            <span class="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-black shadow shrink-0" style="background:${t.color}">
              ${t.badge || idx + 1}
            </span>
            <div class="text-left truncate">
              <div class="text-white font-extrabold truncate">${t.name}</div>
              <div class="text-[10px] text-amber-300 font-semibold truncate flex items-center gap-1">
                <i class="fa-solid fa-location-dot text-amber-400 text-[9px]"></i> Dekat ${nearest.name}
              </div>
            </div>
          </div>
          <div class="text-right shrink-0">
            <span class="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-slate-950 border border-white/10 text-cyan-300">
              Tile (${t.x}, ${t.y})
            </span>
          </div>
        </button>
      `;
    }).join('');
  }

  // Update Flight Path Badge
  const flightInfoEl = document.getElementById('flight-path-info');
  if (flightInfoEl) {
    flightInfoEl.innerHTML = `<i class="fa-solid fa-plane text-amber-400"></i> Rute: ${flightPath.label}`;
  }
}

// Click event listener on drop canvas for accurate drop coordinate selection
const dropCanvasEl = document.getElementById('drop-canvas');
if (dropCanvasEl) {
  dropCanvasEl.addEventListener('click', e => {
    const rect = dropCanvasEl.getBoundingClientRect();
    const scaleX = dropCanvasEl.width / rect.width;
    const scaleY = dropCanvasEl.height / rect.height;
    const canvasX = (e.clientX - rect.left) * scaleX;
    const canvasY = (e.clientY - rect.top) * scaleY;
    const cell = dropCanvasEl.width / mapSize;
    const tx = Math.floor(canvasX / cell);
    const ty = Math.floor(canvasY / cell);

    if (tx >= 0 && tx < mapSize && ty >= 0 && ty < mapSize) {
      if (isInsideSafeZone(tx, ty)) {
        teams[selectedDropTeam].x = tx;
        teams[selectedDropTeam].y = ty;
        teams[selectedDropTeam].renderX = tx;
        teams[selectedDropTeam].renderY = ty;
        teams[selectedDropTeam].prevX = tx;
        teams[selectedDropTeam].prevY = ty;
        drawDropRadar();
        AudioManager.play('click');
      } else {
        AudioManager.play('wrong');
        const MR = window.MapRenderer;
        if (MR && MR.spawnFloatingText) {
          MR.spawnFloatingText(tx, ty, '⚠️ Di Luar Safe Zone!', '#f43f5e');
        }
      }
    }
  });
}

function randomAllDrops() {
  teams.forEach(t => {
    const rx = Math.floor(safeZone.minX + 1 + Math.random() * Math.max(1, safeZone.maxX - safeZone.minX - 2));
    const ry = Math.floor(safeZone.minY + 1 + Math.random() * Math.max(1, safeZone.maxY - safeZone.minY - 2));
    t.x = rx; t.y = ry;
    t.renderX = rx; t.renderY = ry;
    t.prevX = rx; t.prevY = ry;
  });
  drawDropRadar();
  AudioManager.play('click');
}

function startBattleRoyale() {
  hasMovedThisTurn = false;
  isTimerPaused = false;
  teams.forEach(t => {
    t.item = null;
    t.hasArmor = false;
    t.stealthTurns = 0;
    t.skipTurn = false;
    t.isFrozen = false;
    t.smartGlassesArmed = false;
  });
  switchView('game');
}

// Expose drop radar functions to window
window.drawDropRadar = drawDropRadar;
window.randomizePOINames = randomizePOINames;
window.randomizeFlightPath = randomizeFlightPath;
window.randomAllDrops = randomAllDrops;
window.findNearestPOI = findNearestPOI;

// ----------------------------------------------------------------------------
// 17. FINAL STANDINGS & EXCEL EXPORT
// ----------------------------------------------------------------------------
function renderEndStandings() {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0] || teams[0];

  document.getElementById('winner-team-title').textContent = `${winner.name.toUpperCase()} VICTORY!`;
  document.getElementById('podium-badge').textContent = winner.badge;
  document.getElementById('podium-badge').style.backgroundColor = winner.color;
  document.getElementById('podium-name').textContent = winner.name;
  document.getElementById('podium-pilot').textContent = `Pilot: ${winner.pilot} | Soal Benar: ${winner.correct}`;
  document.getElementById('podium-score').textContent = `${winner.score.toLocaleString()} PTS`;

  const tbody = document.getElementById('end-leaderboard-body');
  tbody.innerHTML = sorted.map((t, i) => {
    const rankColor = i === 0 ? 'text-amber-400 font-black' : i === 1 ? 'text-slate-300 font-bold' : i === 2 ? 'text-amber-600 font-bold' : 'text-slate-500';
    const rowBg = i === 0 ? 'bg-amber-500/10' : 'hover:bg-white/5';
    return `
      <tr class="${rowBg} transition-colors">
        <td class="py-3 px-4 ${rankColor}">#${i + 1}</td>
        <td class="py-3 px-4 flex items-center gap-2 font-bold text-white">
          <span class="w-3 h-3 rounded-full shrink-0" style="background:${t.color}"></span>
          <span class="truncate">${t.name}</span>
        </td>
        <td class="py-3 px-4 text-emerald-300 font-semibold">${t.lp}/100 LP</td>
        <td class="py-3 px-4 text-cyan-200">${t.correct} Soal</td>
        <td class="py-3 px-4 text-right font-extrabold text-amber-300">${t.score.toLocaleString()} PTS</td>
      </tr>
    `;
  }).join('');
}

function exportResultsExcel() {
  const rows = teams.map((t, i) => ({
    Rank: i + 1,
    Team: t.name,
    Remaining_LP: t.lp,
    Correct_Answers: t.correct,
    Total_Score: t.score
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Standings");
  XLSX.writeFile(wb, "Last_Zone_Brawls_Result.xlsx");
}

// ----------------------------------------------------------------------------
// 18. CANVAS RESIZE & INIT
// ----------------------------------------------------------------------------
function resizeIsoCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 1.0); // Pixel ratio capped at 1.0 for Smart TVs!
  const displayW = window.innerWidth;
  const displayH = window.innerHeight - 48;

  isoCanvas.width = Math.floor(displayW * dpr);
  isoCanvas.height = Math.floor(displayH * dpr);
  isoCanvas.style.width = '100%';
  isoCanvas.style.height = `${displayH}px`;

  if (window.MapRenderer && window.MapRenderer.invalidateBackground) {
    window.MapRenderer.invalidateBackground();
  }
}

window.addEventListener('resize', resizeIsoCanvas);

// ----------------------------------------------------------------------------
// 19. LAN ACCESS & QR CODE CONTROLLER
// ----------------------------------------------------------------------------
let currentServerURL = 'http://10.143.37.187:3000';

function fetchServerInfo() {
  fetch('/api/server-info')
    .then(res => res.json())
    .then(data => {
      if (data && data.url) {
        currentServerURL = data.url;
      }
    })
    .catch(() => {
      if (window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1')) {
        currentServerURL = window.location.origin;
      }
    });
}

function openLANModal() {
  const modal = document.getElementById('lan-access-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  let targetURL = currentServerURL;
  if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    targetURL = `${window.location.protocol}//${window.location.hostname}:${window.location.port || '3000'}`;
  }

  const urlEl = document.getElementById('lan-access-url');
  if (urlEl) urlEl.textContent = targetURL;

  const qrImg = document.getElementById('lan-qr-code-img');
  if (qrImg) {
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetURL)}`;
  }

  AudioManager.play('click');
}

function closeLANModal() {
  const modal = document.getElementById('lan-access-modal');
  if (modal) modal.classList.add('hidden');
  AudioManager.play('click');
}

function copyLANUrl() {
  const urlEl = document.getElementById('lan-access-url');
  if (!urlEl) return;
  const text = urlEl.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('btn-copy-lan-url');
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin!';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    }
  });
  AudioManager.play('correct');
}

window.openLANModal = openLANModal;
window.closeLANModal = closeLANModal;
window.copyLANUrl = copyLANUrl;
window.openShopModal = openShopModal;
window.closeShopModal = closeShopModal;
window.buyEmergencyMP = buyEmergencyMP;
window.handleChallengePick = handleChallengePick;
window.startChallengeBattle = startChallengeBattle;
window.closeChallengeAndAdvanceTurn = closeChallengeAndAdvanceTurn;
window.selectQuestionOption = selectQuestionOption;
window.skipTurnAction = skipTurnAction;
window.openDiplomacyModal = openDiplomacyModal;
window.closeDiplomacyModal = closeDiplomacyModal;
window.onDiplomacyDonorChange = onDiplomacyDonorChange;
window.setDiplomacyRecipient = setDiplomacyRecipient;
window.setDiplomacyType = setDiplomacyType;
window.executeDiplomacyTransfer = executeDiplomacyTransfer;

// Tactical Inventory Window Exports
window.TACTICAL_ITEMS = TACTICAL_ITEMS;
window.openItemGuideModal = openItemGuideModal;
window.closeItemGuideModal = closeItemGuideModal;
window.useActiveTeamItem = useActiveTeamItem;
window.openTargetSelectModal = openTargetSelectModal;
window.closeTargetSelectModal = closeTargetSelectModal;
window.executeTargetAction = executeTargetAction;
window.useSmartGlassesInModal = useSmartGlassesInModal;

// End The Game Window Exports
window.openEndGameConfirmModal = openEndGameConfirmModal;
window.closeEndGameConfirmModal = closeEndGameConfirmModal;
window.executeEndGame = executeEndGame;

// Audio Settings & Manager Exports
window.audioManager = audioManager;
window.AudioManager = audioManager;
window.toggleAudioMute = toggleAudioMute;
window.openAudioSettingsModal = openAudioSettingsModal;
window.closeAudioSettingsModal = closeAudioSettingsModal;
window.onBGMVolumeSliderChange = onBGMVolumeSliderChange;
window.onSFXVolumeSliderChange = onSFXVolumeSliderChange;
window.testSFXSound = testSFXSound;

// Authentication & Digital Lock Exports
window.initAuthCheck = initAuthCheck;
window.verifyLicense = verifyLicense;
window.resetLicense = resetLicense;

// Autoplay bypass on first user gesture (for reloads when license is already active)
const unlockAudioOnFirstGesture = () => {
  if (isLicenseActive() && (!audioManager.currentBGMKey || audioManager.currentBGM?.paused)) {
    const curEnd = document.getElementById('view-end');
    const curGame = document.getElementById('view-game');
    if (curEnd && !curEnd.classList.contains('hidden')) {
      audioManager.playBGM('victory');
    } else if (curGame && !curGame.classList.contains('hidden')) {
      audioManager.playBGM('combat');
    } else {
      audioManager.playBGM('lobby');
    }
  }
  document.removeEventListener('click', unlockAudioOnFirstGesture);
  document.removeEventListener('touchstart', unlockAudioOnFirstGesture);
};
document.addEventListener('click', unlockAudioOnFirstGesture, { once: true });
document.addEventListener('touchstart', unlockAudioOnFirstGesture, { once: true });

// ----------------------------------------------------------------------------
// 20. FULLSCREEN CONTROLLER (SMART TV & IMMERSIVE BROWSER MODE)
// ----------------------------------------------------------------------------
function isFullscreenActive() {
  return !!(
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement
  );
}

function toggleFullscreen() {
  if (typeof audioManager !== 'undefined' && audioManager.play) {
    audioManager.play('click');
  }

  if (!isFullscreenActive()) {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
      docEl.requestFullscreen().catch(err => console.warn('Fullscreen request failed:', err));
    } else if (docEl.webkitRequestFullscreen) {
      docEl.webkitRequestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
      docEl.mozRequestFullScreen();
    } else if (docEl.msRequestFullscreen) {
      docEl.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(err => console.warn('Exit fullscreen failed:', err));
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function updateFullscreenUI() {
  const isFS = isFullscreenActive();

  // Header Fullscreen Button
  const hIcon = document.getElementById('header-fullscreen-icon');
  const hBtn = document.getElementById('header-fullscreen-btn');
  if (hIcon) {
    hIcon.className = isFS ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
  }
  if (hBtn) {
    hBtn.title = isFS ? 'Keluar Fullscreen (Esc)' : 'Layar Penuh (Fullscreen)';
  }

  // Lobby Fullscreen Button
  const lIcon = document.getElementById('lobby-fullscreen-icon');
  const lBtn = document.getElementById('lobby-fullscreen-btn');
  if (lIcon) {
    lIcon.className = isFS ? 'fa-solid fa-compress text-sm sm:text-base' : 'fa-solid fa-expand text-sm sm:text-base';
  }
  if (lBtn) {
    lBtn.title = isFS ? 'Keluar Fullscreen (Esc)' : 'Layar Penuh (Fullscreen)';
  }

  // Login Screen Fullscreen Button
  const loginIcon = document.getElementById('login-fullscreen-icon');
  const loginBtn = document.getElementById('login-fullscreen-btn');
  if (loginIcon) {
    loginIcon.className = isFS ? 'fa-solid fa-compress' : 'fa-solid fa-expand';
  }
  if (loginBtn) {
    loginBtn.title = isFS ? 'Keluar Fullscreen (Esc)' : 'Layar Penuh (Fullscreen)';
  }

  // Recalculate canvas resolution and refresh background
  if (typeof resizeIsoCanvas === 'function') {
    setTimeout(resizeIsoCanvas, 150);
  }
}

// Fullscreen Event Listeners (Handles F11, Esc, button clicks, or Smart TV gestures)
document.addEventListener('fullscreenchange', updateFullscreenUI);
document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
document.addEventListener('mozfullscreenchange', updateFullscreenUI);
document.addEventListener('MSFullscreenChange', updateFullscreenUI);

window.toggleFullscreen = toggleFullscreen;
window.updateFullscreenUI = updateFullscreenUI;

// Initialize Game
AudioManager.init();
fetchServerInfo();
resizeIsoCanvas();
applyMapAndTimerSettings();
renderPrepTeams();
renderPrepQuestions();
initLobbyParticles();
runLobbyChibiAnimLoop();
startGameClock();
initAuthCheck();
requestAnimationFrame(renderArena);
