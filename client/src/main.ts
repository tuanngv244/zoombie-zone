import { SceneManager } from './scene/SceneManager';
import { CameraController } from './scene/CameraController';
import { GridRenderer } from './scene/GridRenderer';
import { CastleRenderer } from './entities/CastleRenderer';
import { BuildingRenderer } from './entities/BuildingRenderer';
import { EnemyRenderer } from './entities/EnemyRenderer';
import { ProjectileRenderer } from './entities/ProjectileRenderer';
import { HUD } from './ui/HUD';
import { BuildPanel } from './ui/BuildPanel';
import { MiniMap } from './ui/MiniMap';
import { WarningOverlay } from './ui/WarningOverlay';
import { GameOverScreen } from './ui/GameOverScreen';
import { LobbyScreen } from './ui/LobbyScreen';
import { ParticleSystem } from './effects/ParticleSystem';
import { DamageNumbers } from './effects/DamageNumbers';
import { DayNightCycle } from './effects/DayNightCycle';
import { InputManager } from './input/InputManager';
import { DragDropHandler } from './input/DragDropHandler';
import { AudioManager } from './audio/AudioManager';
import { MusicManager } from './audio/MusicManager';
import { getBuildingDef, TOTAL_ZOMBIE_WAVES } from './config/clientConfig';
import { LocalGameEngine } from './game/LocalGameEngine';
import { BuildingSnapshot, EnemySnapshot } from './game/LocalGameEngine';

// ── Bootstrap ──

async function init() {
  // Preload GLB models for renderers that still use them
  await EnemyRenderer.preload();

  const canvasContainer = document.getElementById('canvas-container')!;
  const uiOverlay = document.getElementById('ui-overlay')!;

  // ── Local Game Engine ──
  const gameEngine = new LocalGameEngine();

  // ── 3D Scene ──
  const sceneManager = new SceneManager(canvasContainer);
  const cameraController = new CameraController(
    sceneManager.getCamera(),
    canvasContainer,
  );
  const gridRenderer = new GridRenderer(sceneManager.getScene());
  const castleRenderer = new CastleRenderer(sceneManager.getScene());
  const buildingRenderer = new BuildingRenderer(sceneManager.getScene());
  const enemyRenderer = new EnemyRenderer(sceneManager.getScene());
  const projectileRenderer = new ProjectileRenderer(sceneManager.getScene());

  // ── Projectile impact effects ──
  projectileRenderer.onImpactCallback = (x, y, z, type) => {
    switch (type) {
      case 'arrow':
        particleSystem.emit('dust', x, y, z, 4);
        break;
      case 'cannonball':
        particleSystem.emit('explosion', x, 0.3, z, 12);
        particleSystem.emit('shockwave', x, 0.1, z, 16);
        particleSystem.emit('smoke', x, 0.5, z, 6);
        audioManager.playSound('explosion');
        break;
      case 'bolt':
        particleSystem.emit('spark', x, y, z, 8);
        break;
      case 'bomb':
        particleSystem.emit('explosion', x, 0.5, z, 20);
        particleSystem.emit('fire', x, 0.3, z, 12);
        particleSystem.emit('shockwave', x, 0.1, z, 24);
        particleSystem.emit('debris', x, 0.5, z, 10);
        particleSystem.emit('smoke', x, 1.0, z, 10);
        audioManager.playSound('explosion');
        break;
    }
  };

  // ── Effects ──
  const particleSystem = new ParticleSystem(sceneManager.getScene());
  const damageNumbers = new DamageNumbers(uiOverlay);
  const dayNightCycle = new DayNightCycle(sceneManager);

  // ── UI ──
  const hud = new HUD(uiOverlay);
  const buildPanel = new BuildPanel(uiOverlay);
  const miniMap = new MiniMap(uiOverlay);
  const warningOverlay = new WarningOverlay(uiOverlay);
  const gameOverScreen = new GameOverScreen(uiOverlay);
  const lobbyScreen = new LobbyScreen(uiOverlay);

  // ── Input ──
  const inputManager = new InputManager(
    sceneManager.getRenderer(),
    sceneManager.getCamera(),
  );
  const dragDropHandler = new DragDropHandler(
    null, // No socket for single-player
    inputManager,
    gridRenderer,
    buildingRenderer,
    buildPanel,
  );

  // ── Audio ──
  const audioManager = new AudioManager();
  const musicManager = new MusicManager();
  audioManager.init();
  musicManager.init();

  // ── Initial UI state ──
  hud.hide();
  buildPanel.hide();
  miniMap.hide();

  // Local player ID for single-player
  const localPlayerId = 'local_player';
  dragDropHandler.setLocalPlayerId(localPlayerId);

  // ── Game state tracking ──
  let currentPhase: 'lobby' | 'preparation' | 'wave' | 'wave_break' | 'ended' = 'lobby';
  let currentGold = 500;

  // ── Single-player lobby callback ──
  lobbyScreen.onStartSinglePlayer(() => {
    // Start game immediately in single-player mode
    lobbyScreen.hide();
    hud.show();
    buildPanel.show();
    miniMap.show();
    
    // Initialize game engine
    gameEngine.init('Player');
    currentPhase = 'preparation';
    currentGold = 500;
    
    // Update UI with initial gold
    hud.updateGold(500);
    buildPanel.updateGold(500);
    dragDropHandler.updateGold(500);
    
    // Play music
    musicManager.playTrack('ambient_prep');
    
    // Show wave warning
    warningOverlay.showWarning('Wave 1 Incoming!', 'normal');
    audioManager.playSound('warning_horn');
  });

  // ── Build panel callback ──
  buildPanel.onSelect((type) => {
    if (type) {
      dragDropHandler.startPlacement(type);
    } else {
      dragDropHandler.cancelPlacement();
    }
  });

  // ── Building destroyed handler (local) ──
  gameEngine.onBuildingDestroyed = (data) => {
    buildingRenderer.removeBuilding(data.id);
    audioManager.playSound('explosion');
  };

  // ── Double-click to move a building ──
  inputManager.onGridDoubleClick((gx, gy) => {
    const buildingId = dragDropHandler.findBuildingAt(gx, gy);
    if (buildingId) {
      const state = gameEngine.getState();
      const building = state.buildings.find(b => b.id === buildingId);
      if (building) {
        dragDropHandler.startMoveBuilding(buildingId, building.type);
      }
    }
  });

  // ── Game Over callback ──
  gameOverScreen.onReplay(() => {
    gameOverScreen.hide();
    lobbyScreen.show();
    hud.hide();
    buildPanel.hide();
    miniMap.hide();
    musicManager.stop();
    
    // Reset game state
    currentPhase = 'lobby';
    buildingRenderer.clearAll();
    enemyRenderer.clearAll();
    castleRenderer.updateHp(1000, 1000);
  });

  // ── Game engine callbacks ──
  gameEngine.onGoldChanged = (data) => {
    currentGold = data.gold;
    hud.updateGold(data.gold);
    buildPanel.updateGold(data.gold);
    dragDropHandler.updateGold(data.gold);
  };

  gameEngine.onCastleUpdated = (data) => {
    castleRenderer.updateHp(data.hp, data.maxHp);
    hud.updateCastleHp(data.hp, data.maxHp);
  };

  gameEngine.onEnemySpawned = (data: EnemySnapshot) => {
    enemyRenderer.spawnEnemy(data);
  };

  gameEngine.onEnemyDied = (data) => {
    const pos = enemyRenderer.getEnemyPosition(data.id);
    if (pos) {
      damageNumbers.showGold(data.goldReward, pos.x, pos.y + 0.5, pos.z);
      particleSystem.emit('smoke', pos.x, pos.y, pos.z, 8);
      audioManager.playSound('gold_chime');
    }
  };

  gameEngine.onWaveWarning = (data) => {
    let severity: 'normal' | 'boss' | 'general' = 'normal';
    let text = `Wave ${data.waveNumber} Incoming!`;

    if (data.waveType === 'invader') {
      severity = 'general';
      text = `Invaders Approaching!`;
    } else if (data.waveNumber === TOTAL_ZOMBIE_WAVES) {
      severity = 'boss';
      text = 'BOSS WAVE!';
    }

    warningOverlay.showWarning(text, severity);
    audioManager.playSound('warning_horn');
  };

  gameEngine.onWaveStart = (data) => {
    hud.updateWave(data.waveNumber, 0);
    if (data.waveType === 'zombie') {
      musicManager.crossfadeTo('combat_normal');
      audioManager.playSound('war_drums');
    }
  };

  gameEngine.onGameOver = (data) => {
    gameOverScreen.show(data.result, data.stats, []);
    hud.hide();
    buildPanel.hide();
    miniMap.hide();
    musicManager.stop();
    currentPhase = 'ended';
  };

  gameEngine.onDamageDealt = (event) => {
    if (event.targetType === 'enemy') {
      const pos = enemyRenderer.getEnemyPosition(event.targetId);
      if (pos) {
        damageNumbers.showDamage(event.amount, pos.x, pos.y + 0.5, pos.z);
        particleSystem.emit('blood', pos.x, pos.y + 0.3, pos.z, 5);
        audioManager.playSound('arrow_hit');

        // Handle special attacks
        if (event.sourceType === 'castle_king') {
          castleRenderer.fireLightning(pos.x, pos.y + 0.3, pos.z);
          particleSystem.emit('spark', pos.x, pos.y + 0.3, pos.z, 10);
        } else if (event.sourceType === 'building' && event.sourceId) {
          const state = gameEngine.getState();
          const b = state.buildings.find(b => b.id === event.sourceId);
          if (b) {
            buildingRenderer.triggerAttack(b.id);
            const def = getBuildingDef(b.type);
            if (def) {
              const bx = b.gridX + def.gridWidth / 2;
              const bz = b.gridY + def.gridHeight / 2;

              if (b.type === 'explosive_mine') {
                particleSystem.emit('explosion', bx, 0.3, bz, 15);
                particleSystem.emit('shockwave', bx, 0.1, bz, 20);
                particleSystem.emit('fire', bx, 0.2, bz, 8);
                audioManager.playSound('explosion');
              } else {
                const projectileTypeMap: Record<string, 'arrow' | 'cannonball' | 'bolt' | 'bomb'> = {
                  arrow_tower: 'arrow',
                  cannon: 'cannonball',
                  ballista: 'bolt',
                  hot_air_balloon: 'bomb',
                };
                const projectileType = projectileTypeMap[b.type];
                if (projectileType) {
                  projectileRenderer.fireProjectile(bx, bz, pos.x, pos.z, projectileType);
                }
              }
            }
          }
        }
      }
    } else if (event.targetType === 'building') {
      particleSystem.emit('debris', 0, 0.5, 0, 8);
    } else if (event.targetType === 'castle') {
      particleSystem.emit('debris', 20, 1.0, 20, 12);
      particleSystem.emit('fire', 20, 0.5, 20, 6);
    }
  };

  // ── State sync for single-player ──
  gameEngine.onStateChanged = () => {
    const state = gameEngine.getState();
    
    // Update phase
    if (state.phase !== currentPhase) {
      const prevPhase = currentPhase;
      currentPhase = state.phase;
      
      if (currentPhase === 'preparation') {
        musicManager.crossfadeTo('ambient_prep');
      } else if (currentPhase === 'wave_break') {
        musicManager.crossfadeTo('ambient_prep');
      } else if (currentPhase === 'ended') {
        musicManager.stop();
      }
    }
    
    // Update HUD
    hud.updateGold(state.gold);
    hud.updateWave(state.currentZombieWave, state.currentInvaderWave);
    hud.updateTimer(state.phase, state.timeRemaining);
    hud.updateCastleHp(state.castleHp, state.castleMaxHp);
    hud.updatePlayers(state.players);
    
    // Update build panel gold
    buildPanel.updateGold(state.gold);
    dragDropHandler.updateGold(state.gold);
    
    // Update castle
    castleRenderer.updateHp(state.castleHp, state.castleMaxHp);
    if (state.castles.length > 0) {
      castleRenderer.updateMultipleCastles(state.castles);
    }
    
    // Sync buildings
    buildingRenderer.syncAll(state.buildings);
    dragDropHandler.syncOccupied(state.buildings, state.castles);
    
    // Update enemies
    enemyRenderer.updateEnemies(state.enemies);
    
    // Update mini-map
    miniMap.update(state.buildings as any, state.enemies as any, state.castles as any, []);
    
    // Day/night cycle
    dayNightCycle.setWaveProgress(state.currentZombieWave, TOTAL_ZOMBIE_WAVES);
    dayNightCycle.update();
  };

  // Set up local callbacks for building operations
  dragDropHandler.setLocalCallbacks(
    (type, gridX, gridY) => {
      // Place building
      const result = gameEngine.handlePlaceBuilding(type, gridX, gridY, localPlayerId);
      if (result.success && result.building) {
        buildingRenderer.syncBuilding(result.building);
        dragDropHandler.syncOccupied([result.building], []);
        miniMap.update(
          [result.building] as any,
          [] as any,
          [],
          []
        );
      }
    },
    (buildingId) => {
      // Sell building
      const result = gameEngine.handleSellBuilding(buildingId, localPlayerId);
      if (result.success) {
        buildingRenderer.removeBuilding(buildingId);
      }
    },
    (buildingId, gridX, gridY) => {
      // Move building - remove from old position
      const state = gameEngine.getState();
      const building = state.buildings.find(b => b.id === buildingId);
      if (building) {
        buildingRenderer.removeBuilding(buildingId);
      }
      // Place at new position
      if (building) {
        const result = gameEngine.handlePlaceBuilding(building.type, gridX, gridY, localPlayerId);
        if (result.success && result.building) {
          buildingRenderer.syncBuilding(result.building);
          dragDropHandler.syncOccupied([result.building], []);
        }
      }
    }
  );

  // Initial gold update
  hud.updateGold(500);
  buildPanel.updateGold(500);

  // ── Animation loop ──
  let lastTime = performance.now();
  
  sceneManager.onAnimate((dt) => {
    const currentTime = performance.now();
    const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
    lastTime = currentTime;
    
    // Update game engine
    if (currentPhase !== 'lobby' && currentPhase !== 'ended') {
      gameEngine.tick(deltaTime);
    }
    
    // Update renderers
    cameraController.update(dt);
    castleRenderer.update(dt);
    buildingRenderer.updateAnimations(dt);
    enemyRenderer.update(dt);
    projectileRenderer.update(dt);
    particleSystem.update(dt);
    damageNumbers.update(sceneManager.getCamera());
    dragDropHandler.update();
    inputManager.update();
  });
}

// Start the app
init().catch((err) => {
  console.error('[Init] Failed to initialize:', err);
});
