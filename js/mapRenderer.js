/**
 * mapRenderer.js — Layered 3D Isometric Rendering Engine
 * LAST ZONE BRAWLS: Tactical Classroom Royale
 * 
 * Handles all canvas drawing: terrain tiles, environment props,
 * chibi character sprites, airdrop crates, and zone boundaries.
 * 
 * Dependencies: Requires GameEngine global state (zoom, camX, camY, etc.)
 */

// ─────────────────────────────────────────────
// ▸ TILE CONSTANTS
// ─────────────────────────────────────────────
const TILE_W = 64;
const TILE_H = 32;
const BLOCK_DEPTH = 13;

// ─────────────────────────────────────────────
// ▸ COORDINATE CONVERSION
// ─────────────────────────────────────────────

/**
 * Convert tile grid coordinates to screen pixel coordinates.
 * Uses current zoom level and camera offset from GameEngine.
 */
function tileToScreen(tx, ty) {
  const state = window.GameEngine.getState();
  const sx = (tx - ty) * (TILE_W / 2) * state.zoom + state.camX;
  const sy = (tx + ty) * (TILE_H / 2) * state.zoom + state.camY;
  return { x: sx, y: sy };
}

/**
 * Convert screen pixel coordinates back to tile grid coordinates.
 * Inverse of tileToScreen.
 */
function screenToTile(sx, sy) {
  const state = window.GameEngine.getState();
  const adjX = (sx - state.camX) / state.zoom;
  const adjY = (sy - state.camY) / state.zoom;
  const tx = Math.floor((adjX / (TILE_W / 2) + adjY / (TILE_H / 2)) / 2);
  const ty = Math.floor((adjY / (TILE_H / 2) - adjX / (TILE_W / 2)) / 2);
  return { x: tx, y: ty };
}

// ─────────────────────────────────────────────
// ▸ ISOMETRIC TILE BLOCK RENDERER
// ─────────────────────────────────────────────

/**
 * Draw a single isometric tile block with 3D depth.
 * Handles grass/water/dirt coloring, safe vs danger zone,
 * animated water waves, grass specks, hover highlight, and coord labels.
 */
function drawIsometricTileBlock(ctx, tx, ty, tile) {
  const state = window.GameEngine.getState();
  const { x, y } = tileToScreen(tx, ty);
  const isoCanvas = state.isoCanvas;
  if (x < -120 || x > isoCanvas.width + 120 || y < -120 || y > isoCanvas.height + 120) return;

  const hw = (TILE_W / 2) * state.zoom;
  const hh = (TILE_H / 2) * state.zoom;
  const isSafe = state.isInsideSafeZone(tx, ty);

  const recess = tile.type === 'water' ? 4 * state.zoom : 0;
  const topY = y + recess;
  const depth = (BLOCK_DEPTH * state.zoom) - recess;

  let topColor, leftColor, rightColor, strokeColor;

  if (tile.type === 'water') {
    if (tile.isOutfield) {
      topColor = '#0f2942';
      leftColor = '#0a1d30';
      rightColor = '#071524';
      strokeColor = 'rgba(56, 189, 248, 0.18)';
    } else {
      topColor = isSafe ? '#0284c7' : '#1e3a5f';
      leftColor = '#0369a1';
      rightColor = '#075985';
      strokeColor = 'rgba(56, 189, 248, 0.35)';
    }
  } else if (tile.type === 'dirt') {
    if (tile.isBridge) {
      topColor = isSafe ? '#b45309' : '#78350f'; // Warm wood plank bridge
      leftColor = '#92400e';
      rightColor = '#78350f';
      strokeColor = 'rgba(253, 230, 138, 0.45)';
    } else {
      topColor = isSafe ? (tile.tint ? '#d4b996' : '#c8ad88') : '#524335'; // Warm golden beach sand
      leftColor = '#b59a76';
      rightColor = '#9e8462';
      strokeColor = 'rgba(254, 243, 199, 0.25)';
    }
  } else {
    // Grassland (Lush emerald green inside safe zone, dramatic moody cyber blue storm outside)
    if (isSafe) {
      topColor = tile.tint === 0 ? '#44b869' : '#3ca85e';
      leftColor = '#2b8246';
      rightColor = '#1e6333';
      strokeColor = 'rgba(134, 239, 172, 0.22)';
    } else {
      topColor = tile.tint === 0 ? '#1e3a5f' : '#172e4d';
      leftColor = '#13233b';
      rightColor = '#0c1829';
      strokeColor = 'rgba(56, 189, 248, 0.2)';
    }
  }

  // Top diamond face
  ctx.beginPath();
  ctx.moveTo(x, topY - hh);
  ctx.lineTo(x + hw, topY);
  ctx.lineTo(x, topY + hh);
  ctx.lineTo(x - hw, topY);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  // If this tile is a wooden bridge, draw cute wood plank lines
  if (tile.isBridge) {
    ctx.save();
    ctx.strokeStyle = 'rgba(69, 26, 3, 0.7)';
    ctx.lineWidth = 1.4 * state.zoom;
    for (let p = -1; p <= 1; p++) {
      const px = x + p * 8 * state.zoom;
      const py = topY + p * 4 * state.zoom;
      ctx.beginPath();
      ctx.moveTo(px - 9 * state.zoom, py);
      ctx.lineTo(px + 9 * state.zoom, py);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Left face (depth)
  ctx.beginPath();
  ctx.moveTo(x - hw, topY);
  ctx.lineTo(x, topY + hh);
  ctx.lineTo(x, topY + hh + depth);
  ctx.lineTo(x - hw, topY + depth);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();

  // Right face (depth)
  ctx.beginPath();
  ctx.moveTo(x + hw, topY);
  ctx.lineTo(x, topY + hh);
  ctx.lineTo(x, topY + hh + depth);
  ctx.lineTo(x + hw, topY + depth);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();

  // Water waves or grass specks
  const animTick = state.animTick;
  if (tile.type === 'water') {
    const waveOffset = Math.sin(animTick * 0.05 + tx + ty) * 3 * state.zoom;
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.45)';
    ctx.lineWidth = 1.5 * state.zoom;
    ctx.beginPath();
    ctx.moveTo(x - 10 * state.zoom + waveOffset, topY - 2 * state.zoom);
    ctx.lineTo(x + 6 * state.zoom + waveOffset, topY - 2 * state.zoom);
    ctx.stroke();
  } else if (tile.r > 0.3 && isSafe) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.arc(x + (tile.r - 0.5) * 18 * state.zoom, topY + (tile.r - 0.5) * 8 * state.zoom, 1.8 * state.zoom, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hover highlight & Sector Tooltip
  const hoveredTile = state.hoveredTile;
  if (hoveredTile && hoveredTile.x === tx && hoveredTile.y === ty) {
    ctx.beginPath();
    ctx.moveTo(x, topY - hh);
    ctx.lineTo(x + hw, topY);
    ctx.lineTo(x, topY + hh);
    ctx.lineTo(x - hw, topY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.6 * state.zoom;
    ctx.stroke();

    // Floating Sector Tooltip above hovered tile
    if (typeof window.findNearestPOI === 'function') {
      const poi = window.findNearestPOI(tx, ty);
      const text = `📍 ${poi.name} (${tx}, ${ty})`;
      ctx.save();
      ctx.font = `bold ${Math.max(9, 10 * state.zoom)}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(text).width;
      const bx = x;
      const by = topY - hh - 12 * state.zoom;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(bx - tw / 2 - 6 * state.zoom, by - 10 * state.zoom, tw + 12 * state.zoom, 15 * state.zoom, 4 * state.zoom);
      ctx.fill();
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx, by - 2 * state.zoom);
      ctx.restore();
    }
  }

  // Coord labels
  if (state.showCoords && !tile.isOutfield) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `${Math.max(7, 8.5 * state.zoom)}px Plus Jakarta Sans`;
    ctx.textAlign = 'center';
    ctx.fillText(`${tx},${ty}`, x, topY + 3 * state.zoom);
  }
}

// ─────────────────────────────────────────────
// ▸ TACTICAL MOVE HIGHLIGHT
// ─────────────────────────────────────────────

/**
 * Draw cyan/red pulsing diamond highlights on tiles the active team can move to.
 * Red highlights indicate enemy-occupied tiles (duel triggers).
 */
function drawTacticalMoveHighlight(ctx, tx, ty, costLabel) {
  const state = window.GameEngine.getState();
  const { x, y } = tileToScreen(tx, ty);
  const hw = (TILE_W / 2) * state.zoom;
  const hh = (TILE_H / 2) * state.zoom;
  const pulse = 0.55 + Math.sin(state.animTick * 0.08) * 0.2;
  const hasEnemy = state.teams.some((t, idx) => idx !== state.activeTeamIndex && t.alive && t.x === tx && t.y === ty);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y - hh);
  ctx.lineTo(x + hw, y);
  ctx.lineTo(x, y + hh);
  ctx.lineTo(x - hw, y);
  ctx.closePath();

  const is2MP = costLabel && costLabel.includes('2');
  ctx.fillStyle = hasEnemy
    ? `rgba(244, 63, 94, ${pulse * 0.55})`
    : (is2MP ? `rgba(245, 158, 11, ${pulse * 0.45})` : `rgba(6, 182, 212, ${pulse * 0.45})`);
  ctx.fill();
  ctx.lineWidth = 2 * state.zoom;
  ctx.strokeStyle = hasEnemy ? '#fb7185' : (is2MP ? '#f59e0b' : '#22d3ee');
  ctx.stroke();

  // Cost label pill
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.beginPath();
  ctx.roundRect(x - 18 * state.zoom, y - 13 * state.zoom, 36 * state.zoom, 13 * state.zoom, 4 * state.zoom);
  ctx.fill();

  ctx.fillStyle = hasEnemy ? '#fda4af' : (is2MP ? '#fde047' : '#67e8f9');
  ctx.font = `bold ${8.5 * state.zoom}px Plus Jakarta Sans`;
  ctx.textAlign = 'center';
  ctx.fillText(hasEnemy ? '⚔️ DUEL' : costLabel, x, y - 4 * state.zoom);

  // Arrow indicator
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8 * state.zoom;
  ctx.beginPath();
  ctx.moveTo(x - 5 * state.zoom, y + 6 * state.zoom);
  ctx.lineTo(x, y + 2 * state.zoom);
  ctx.lineTo(x + 5 * state.zoom, y + 6 * state.zoom);
  ctx.stroke();
  ctx.restore();
}

// ─────────────────────────────────────────────
// ▸ ENVIRONMENT PROPS (Trees, Rocks, Bushes)
// ─────────────────────────────────────────────

/**
 * Draw decorative environment props on the isometric map.
 * Supports: 'pine' (layered pine tree), 'rock' (polygon boulder), 'bush' (clustered circles).
 * Colors adapt to safe zone vs danger zone.
 */
function drawEnvironmentProp(ctx, tx, ty, decoType) {
  const state = window.GameEngine.getState();
  const { x, y } = tileToScreen(tx, ty);
  const isoCanvas = state.isoCanvas;
  if (x < -100 || x > isoCanvas.width + 100 || y < -100 || y > isoCanvas.height + 100) return;
  const isSafe = state.isInsideSafeZone(tx, ty);
  const zoom = state.zoom;

  ctx.save();
  if (decoType === 'pine') {
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 4 * zoom, y + 2 * zoom, 15 * zoom, 8 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#5c4033';
    ctx.fillRect(x - 3.5 * zoom, y - 10 * zoom, 7 * zoom, 11 * zoom);

    // Foliage layers
    const foliageColors = isSafe
      ? ['#166534', '#15803d', '#22c55e']
      : ['#1e293b', '#27374d', '#334155'];

    for (let i = 0; i < 3; i++) {
      const baseW = (20 - i * 3.5) * zoom;
      const topY = y - (36 + i * 11) * zoom;
      const botY = y - (8 + i * 10) * zoom;

      ctx.fillStyle = foliageColors[i];
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x + baseW, botY);
      ctx.lineTo(x, botY + 4 * zoom);
      ctx.lineTo(x - baseW, botY);
      ctx.closePath();
      ctx.fill();
    }
  } else if (decoType === 'rock') {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * zoom, 13 * zoom, 6 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rock body
    ctx.fillStyle = isSafe ? '#64748b' : '#334155';
    ctx.beginPath();
    ctx.moveTo(x - 11 * zoom, y + 2 * zoom);
    ctx.lineTo(x - 5 * zoom, y - 11 * zoom);
    ctx.lineTo(x + 7 * zoom, y - 9 * zoom);
    ctx.lineTo(x + 12 * zoom, y + 2 * zoom);
    ctx.lineTo(x, y + 6 * zoom);
    ctx.closePath();
    ctx.fill();

    // Rock highlight face
    ctx.fillStyle = isSafe ? '#94a3b8' : '#475569';
    ctx.beginPath();
    ctx.moveTo(x - 5 * zoom, y - 11 * zoom);
    ctx.lineTo(x + 7 * zoom, y - 9 * zoom);
    ctx.lineTo(x, y + 6 * zoom);
    ctx.closePath();
    ctx.fill();
  } else if (decoType === 'bush') {
    ctx.fillStyle = isSafe ? '#22c55e' : '#334155';
    ctx.beginPath();
    ctx.arc(x, y - 4 * zoom, 9 * zoom, 0, Math.PI * 2);
    ctx.arc(x - 6 * zoom, y - 2 * zoom, 6 * zoom, 0, Math.PI * 2);
    ctx.arc(x + 6 * zoom, y - 2 * zoom, 6 * zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (decoType === 'building_school') {
    // 1. Academia Hall / Cute Isometric Schoolhouse Building
    // Soft Ground Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * zoom, y + 4 * zoom, 26 * zoom, 13 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    const bw = 24 * zoom;
    const bh = 22 * zoom;

    // Foundation stone base
    ctx.fillStyle = '#64748b';
    ctx.fillRect(x - bw / 2, y - 4 * zoom, bw, 6 * zoom);

    // Left wall (shaded)
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(x - bw / 2, y - 4 * zoom);
    ctx.lineTo(x, y + 2 * zoom);
    ctx.lineTo(x, y - bh);
    ctx.lineTo(x - bw / 2, y - bh - 6 * zoom);
    ctx.closePath();
    ctx.fill();

    // Right wall (lit)
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(x, y + 2 * zoom);
    ctx.lineTo(x + bw / 2, y - 4 * zoom);
    ctx.lineTo(x + bw / 2, y - bh - 6 * zoom);
    ctx.lineTo(x, y - bh);
    ctx.closePath();
    ctx.fill();

    // Front door on right wall
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.roundRect(x + 4 * zoom, y - 10 * zoom, 6 * zoom, 10 * zoom, 2 * zoom);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 8 * zoom, y - 5 * zoom, 1.5 * zoom, 1.5 * zoom);

    // Arched Windows with cyan glass
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x - 9 * zoom, y - 14 * zoom, 4.5 * zoom, 5.5 * zoom);
    ctx.fillRect(x + 12 * zoom, y - 14 * zoom, 4.5 * zoom, 5.5 * zoom);

    // Terracotta Pitched Roof
    // Left roof slope
    ctx.fillStyle = '#be123c';
    ctx.beginPath();
    ctx.moveTo(x - bw / 2 - 2 * zoom, y - bh - 6 * zoom);
    ctx.lineTo(x, y - bh + 1 * zoom);
    ctx.lineTo(x, y - bh - 18 * zoom);
    ctx.lineTo(x - bw / 2 - 2 * zoom, y - bh - 24 * zoom);
    ctx.closePath();
    ctx.fill();

    // Right roof slope
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(x, y - bh + 1 * zoom);
    ctx.lineTo(x + bw / 2 + 2 * zoom, y - bh - 6 * zoom);
    ctx.lineTo(x + bw / 2 + 2 * zoom, y - bh - 24 * zoom);
    ctx.lineTo(x, y - bh - 18 * zoom);
    ctx.closePath();
    ctx.fill();

    // Bell Tower / Cupola on the roof ridge
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x - 4 * zoom, y - bh - 28 * zoom, 8 * zoom, 10 * zoom);
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(x - 5 * zoom, y - bh - 28 * zoom);
    ctx.lineTo(x + 5 * zoom, y - bh - 28 * zoom);
    ctx.lineTo(x, y - bh - 36 * zoom);
    ctx.closePath();
    ctx.fill();

    // Golden Bell
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y - bh - 23 * zoom, 2.2 * zoom, 0, Math.PI * 2);
    ctx.fill();

    // School Flag
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2 * zoom;
    ctx.beginPath();
    ctx.moveTo(x, y - bh - 36 * zoom);
    ctx.lineTo(x, y - bh - 43 * zoom);
    ctx.stroke();
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.moveTo(x, y - bh - 43 * zoom);
    ctx.lineTo(x + 6 * zoom, y - bh - 40 * zoom);
    ctx.lineTo(x, y - bh - 37 * zoom);
    ctx.closePath();
    ctx.fill();
  } else if (decoType === 'building_house') {
    // 2. Cute Village House / Cottage (Echo Town / Port)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * zoom, y + 3 * zoom, 22 * zoom, 11 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    const hw = 19 * zoom;
    const hh = 16 * zoom;

    // Left wall
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.moveTo(x - hw / 2, y - 2 * zoom);
    ctx.lineTo(x, y + 2 * zoom);
    ctx.lineTo(x, y - hh);
    ctx.lineTo(x - hw / 2, y - hh - 4 * zoom);
    ctx.closePath();
    ctx.fill();

    // Right wall
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.moveTo(x, y + 2 * zoom);
    ctx.lineTo(x + hw / 2, y - 2 * zoom);
    ctx.lineTo(x + hw / 2, y - hh - 4 * zoom);
    ctx.lineTo(x, y - hh);
    ctx.closePath();
    ctx.fill();

    // Door
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.roundRect(x + 2 * zoom, y - 8 * zoom, 5 * zoom, 8 * zoom, 1.5 * zoom);
    ctx.fill();

    // Window
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(x - 7 * zoom, y - 10 * zoom, 4 * zoom, 4 * zoom);

    // Pitched Roof (Cobalt / Sky Blue)
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.moveTo(x - hw / 2 - 2 * zoom, y - hh - 4 * zoom);
    ctx.lineTo(x, y - hh + 1 * zoom);
    ctx.lineTo(x, y - hh - 14 * zoom);
    ctx.lineTo(x - hw / 2 - 2 * zoom, y - hh - 19 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.moveTo(x, y - hh + 1 * zoom);
    ctx.lineTo(x + hw / 2 + 2 * zoom, y - hh - 4 * zoom);
    ctx.lineTo(x + hw / 2 + 2 * zoom, y - hh - 19 * zoom);
    ctx.lineTo(x, y - hh - 14 * zoom);
    ctx.closePath();
    ctx.fill();

    // Brick Chimney with smoke puff
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x - 6 * zoom, y - hh - 21 * zoom, 4 * zoom, 8 * zoom);
    const smokeOffset = (state.animTick * 0.05) % 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.arc(x - 4 * zoom, y - hh - 23 * zoom - smokeOffset * 8 * zoom, (2 + smokeOffset * 2) * zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (decoType === 'building_radar') {
    // 3. Military Radar Outpost / Bunker (Orion Base)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * zoom, y + 4 * zoom, 24 * zoom, 12 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bunker Base
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 12 * zoom, y - 6 * zoom, 24 * zoom, 8 * zoom);
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - 10 * zoom, y - 14 * zoom, 20 * zoom, 8 * zoom);

    // Hazard Stripes
    ctx.fillStyle = '#facc15';
    ctx.fillRect(x - 8 * zoom, y - 4 * zoom, 3 * zoom, 4 * zoom);
    ctx.fillRect(x - 2 * zoom, y - 4 * zoom, 3 * zoom, 4 * zoom);
    ctx.fillRect(x + 4 * zoom, y - 4 * zoom, 3 * zoom, 4 * zoom);

    // Lattice Mast
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.8 * zoom;
    ctx.beginPath();
    ctx.moveTo(x, y - 14 * zoom);
    ctx.lineTo(x, y - 28 * zoom);
    ctx.stroke();

    // Rotating Radar Dish
    const dishAngle = state.animTick * 0.04;
    const dishW = Math.cos(dishAngle) * 12 * zoom;
    ctx.fillStyle = '#e2e8f0';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.2 * zoom;
    ctx.beginPath();
    ctx.ellipse(x, y - 28 * zoom, Math.abs(dishW) + 2 * zoom, 5 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pulsing Red Warning Beacon
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x, y - 35 * zoom, 2.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else if (decoType === 'building_power') {
    // 4. Quantum Power Reactor Core
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * zoom, y + 4 * zoom, 24 * zoom, 12 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Silo Base
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.roundRect(x - 13 * zoom, y - 16 * zoom, 26 * zoom, 18 * zoom, 4 * zoom);
    ctx.fill();

    // Glowing Reactor Ring
    const corePulse = 0.65 + Math.sin(state.animTick * 0.08) * 0.35;
    ctx.fillStyle = `rgba(6, 182, 212, ${corePulse})`;
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(x - 9 * zoom, y - 12 * zoom, 18 * zoom, 7 * zoom, 2 * zoom);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Dome Top
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(x, y - 16 * zoom, 10 * zoom, Math.PI, 0);
    ctx.fill();

    // Antenna
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(x, y - 26 * zoom);
    ctx.lineTo(x, y - 33 * zoom);
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x, y - 33 * zoom, 2 * zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (decoType === 'building_ruins') {
    // 5. Ancient Stone Ruins (Cyber Ruins)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * zoom, y + 3 * zoom, 22 * zoom, 10 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone Plinth
    ctx.fillStyle = '#475569';
    ctx.fillRect(x - 14 * zoom, y - 2 * zoom, 28 * zoom, 4 * zoom);

    // Columns
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(x - 11 * zoom, y - 20 * zoom, 5 * zoom, 18 * zoom);
    ctx.fillRect(x + 6 * zoom, y - 16 * zoom, 5 * zoom, 14 * zoom);

    // Broken Beam
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(x - 14 * zoom, y - 22 * zoom);
    ctx.lineTo(x + 2 * zoom, y - 18 * zoom);
    ctx.lineTo(x + 1 * zoom, y - 14 * zoom);
    ctx.lineTo(x - 14 * zoom, y - 18 * zoom);
    ctx.closePath();
    ctx.fill();

    // Ivy Vines
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(x - 8 * zoom, y - 8 * zoom, 3 * zoom, 0, Math.PI * 2);
    ctx.arc(x - 9 * zoom, y - 14 * zoom, 2.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (decoType === 'tree_oak' || decoType === 'chibi_tree') {
    // 6. Lush Chibi Oak/Apple Tree
    ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
    ctx.beginPath();
    ctx.ellipse(x + 3 * zoom, y + 2 * zoom, 18 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Trunk
    ctx.fillStyle = '#6b4423';
    ctx.beginPath();
    ctx.moveTo(x - 4.5 * zoom, y + 2 * zoom);
    ctx.lineTo(x - 3 * zoom, y - 14 * zoom);
    ctx.lineTo(x + 3 * zoom, y - 14 * zoom);
    ctx.lineTo(x + 4.5 * zoom, y + 2 * zoom);
    ctx.closePath();
    ctx.fill();

    // Canopy
    const canGrad = ctx.createRadialGradient(x - 6 * zoom, y - 28 * zoom, 4 * zoom, x, y - 24 * zoom, 22 * zoom);
    if (isSafe) {
      canGrad.addColorStop(0, '#4ade80');
      canGrad.addColorStop(0.5, '#16a34a');
      canGrad.addColorStop(1, '#14532d');
    } else {
      canGrad.addColorStop(0, '#64748b');
      canGrad.addColorStop(0.5, '#334155');
      canGrad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = canGrad;
    ctx.beginPath();
    ctx.arc(x - 8 * zoom, y - 22 * zoom, 11 * zoom, 0, Math.PI * 2);
    ctx.arc(x + 8 * zoom, y - 22 * zoom, 11 * zoom, 0, Math.PI * 2);
    ctx.arc(x, y - 31 * zoom, 13 * zoom, 0, Math.PI * 2);
    ctx.fill();

    // Red Apples
    if (isSafe) {
      const apples = [
        { dx: -7, dy: -20 },
        { dx: 6, dy: -23 },
        { dx: -1, dy: -32 },
        { dx: 3, dy: -18 }
      ];
      apples.forEach(a => {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(x + a.dx * zoom, y + a.dy * zoom, 2.5 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fecaca';
        ctx.beginPath();
        ctx.arc(x + (a.dx - 0.7) * zoom, y + (a.dy - 0.7) * zoom, 0.8 * zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  } else if (decoType === 'tree_palm') {
    // 7. Tropical Beach Palm Tree
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 5 * zoom, y + 2 * zoom, 16 * zoom, 7 * zoom, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Curved Trunk
    ctx.save();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 4 * zoom;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y + 2 * zoom);
    ctx.quadraticCurveTo(x + 8 * zoom, y - 18 * zoom, x + 5 * zoom, y - 34 * zoom);
    ctx.stroke();
    ctx.restore();

    const topX = x + 5 * zoom;
    const topY = y - 34 * zoom;

    // Coconuts
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(topX - 2 * zoom, topY + 2 * zoom, 2.2 * zoom, 0, Math.PI * 2);
    ctx.arc(topX + 2 * zoom, topY + 2 * zoom, 2.2 * zoom, 0, Math.PI * 2);
    ctx.fill();

    // Arching Fronds
    const frondAngles = [-2.5, -1.8, -1.0, -0.3, 0.4, 1.2];
    ctx.save();
    ctx.strokeStyle = isSafe ? '#16a34a' : '#475569';
    ctx.lineWidth = 2.4 * zoom;
    ctx.lineCap = 'round';
    frondAngles.forEach(ang => {
      const fx = topX + Math.cos(ang) * 16 * zoom;
      const fy = topY + Math.sin(ang) * 11 * zoom + 3 * zoom;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.quadraticCurveTo(topX + Math.cos(ang) * 9 * zoom, topY - 7 * zoom, fx, fy);
      ctx.stroke();
    });
    ctx.restore();
  } else if (decoType === 'tree_autumn') {
    // 8. Fiery Amber Autumn Maple
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 3 * zoom, y + 2 * zoom, 16 * zoom, 8 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5c4033';
    ctx.fillRect(x - 3 * zoom, y - 12 * zoom, 6 * zoom, 14 * zoom);

    const fallGrad = ctx.createRadialGradient(x - 5 * zoom, y - 26 * zoom, 3 * zoom, x, y - 22 * zoom, 20 * zoom);
    fallGrad.addColorStop(0, '#fde047');
    fallGrad.addColorStop(0.4, '#f97316');
    fallGrad.addColorStop(1, '#b91c1c');
    ctx.fillStyle = fallGrad;
    ctx.beginPath();
    ctx.arc(x - 8 * zoom, y - 20 * zoom, 10 * zoom, 0, Math.PI * 2);
    ctx.arc(x + 8 * zoom, y - 20 * zoom, 10 * zoom, 0, Math.PI * 2);
    ctx.arc(x, y - 28 * zoom, 12 * zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (decoType === 'tree_birch') {
    // 9. White Birch Tree
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * zoom, y + 2 * zoom, 14 * zoom, 7 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x - 2.5 * zoom, y - 16 * zoom, 5 * zoom, 18 * zoom);
    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 2.5 * zoom, y - 12 * zoom, 3 * zoom, 1.4 * zoom);
    ctx.fillRect(x, y - 6 * zoom, 2.5 * zoom, 1.4 * zoom);

    ctx.fillStyle = isSafe ? '#a3e635' : '#475569';
    ctx.beginPath();
    ctx.arc(x, y - 26 * zoom, 11 * zoom, 0, Math.PI * 2);
    ctx.arc(x - 5 * zoom, y - 19 * zoom, 8 * zoom, 0, Math.PI * 2);
    ctx.arc(x + 5 * zoom, y - 19 * zoom, 8 * zoom, 0, Math.PI * 2);
    ctx.fill();
  } else if (decoType === 'flower_patch' || decoType === 'flowers') {
    // 10. Wildflower Meadow Patch
    const flowers = [
      { dx: -7, dy: 1, c: '#f43f5e' },
      { dx: -2, dy: -3, c: '#38bdf8' },
      { dx: 5, dy: 0, c: '#facc15' },
      { dx: 2, dy: 3, c: '#c084fc' },
      { dx: -4, dy: 4, c: '#fb923c' }
    ];
    flowers.forEach(fl => {
      ctx.strokeStyle = '#15803d';
      ctx.lineWidth = 1.2 * zoom;
      ctx.beginPath();
      ctx.moveTo(x + fl.dx * zoom, y + fl.dy * zoom);
      ctx.lineTo(x + fl.dx * zoom, y + (fl.dy - 5) * zoom);
      ctx.stroke();

      ctx.fillStyle = isSafe ? fl.c : '#94a3b8';
      ctx.beginPath();
      ctx.arc(x + fl.dx * zoom, y + (fl.dy - 5) * zoom, 2.2 * zoom, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(x + fl.dx * zoom, y + (fl.dy - 5) * zoom, 0.8 * zoom, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (decoType === 'flower_bush') {
    // 11. Flower-dotted Bush
    ctx.fillStyle = isSafe ? '#15803d' : '#334155';
    ctx.beginPath();
    ctx.arc(x, y - 4 * zoom, 10 * zoom, 0, Math.PI * 2);
    ctx.arc(x - 7 * zoom, y - 2 * zoom, 7 * zoom, 0, Math.PI * 2);
    ctx.arc(x + 7 * zoom, y - 2 * zoom, 7 * zoom, 0, Math.PI * 2);
    ctx.fill();

    if (isSafe) {
      const blooms = [
        { dx: -5, dy: -5, c: '#f472b6' },
        { dx: 2, dy: -8, c: '#fef08a' },
        { dx: 6, dy: -3, c: '#67e8f9' },
        { dx: -1, dy: -1, c: '#f472b6' }
      ];
      blooms.forEach(b => {
        ctx.fillStyle = b.c;
        ctx.beginPath();
        ctx.arc(x + b.dx * zoom, y + b.dy * zoom, 2 * zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  } else if (decoType === 'mushroom_patch') {
    // 12. Cute Toadstool Mushrooms
    const shrooms = [
      { dx: -4, dy: 0, r: 4.5, h: 7 },
      { dx: 3, dy: 2, r: 3.2, h: 5 }
    ];
    shrooms.forEach(s => {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(x + (s.dx - 1.2) * zoom, y + (s.dy - s.h) * zoom, 2.4 * zoom, s.h * zoom);

      ctx.fillStyle = isSafe ? '#ef4444' : '#64748b';
      ctx.beginPath();
      ctx.arc(x + s.dx * zoom, y + (s.dy - s.h) * zoom, s.r * zoom, Math.PI, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x + (s.dx - 1.5) * zoom, y + (s.dy - s.h - 1.5) * zoom, 0.8 * zoom, 0, Math.PI * 2);
      ctx.arc(x + (s.dx + 1.2) * zoom, y + (s.dy - s.h - 1.5) * zoom, 0.8 * zoom, 0, Math.PI * 2);
      ctx.arc(x + s.dx * zoom, y + (s.dy - s.h - 3) * zoom, 0.9 * zoom, 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (decoType === 'mossy_rock') {
    // 13. Mossy River Stone
    ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * zoom, 14 * zoom, 7 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isSafe ? '#475569' : '#1e293b';
    ctx.beginPath();
    ctx.moveTo(x - 12 * zoom, y + 2 * zoom);
    ctx.lineTo(x - 6 * zoom, y - 12 * zoom);
    ctx.lineTo(x + 8 * zoom, y - 10 * zoom);
    ctx.lineTo(x + 13 * zoom, y + 2 * zoom);
    ctx.lineTo(x, y + 6 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isSafe ? '#64748b' : '#334155';
    ctx.beginPath();
    ctx.moveTo(x - 6 * zoom, y - 12 * zoom);
    ctx.lineTo(x + 8 * zoom, y - 10 * zoom);
    ctx.lineTo(x, y + 5 * zoom);
    ctx.closePath();
    ctx.fill();

    if (isSafe) {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(x - 2 * zoom, y - 7 * zoom, 4.5 * zoom, 0, Math.PI * 2);
      ctx.arc(x + 3 * zoom, y - 8 * zoom, 3.5 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (decoType === 'crystal_spire') {
    // 14. Fantasy Mana Crystal
    ctx.fillStyle = 'rgba(6, 182, 212, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * zoom, 12 * zoom, 6 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    const animTick = state.animTick;
    const pulse = 0.8 + Math.sin(animTick * 0.08 + tx * 3) * 0.2;
    ctx.save();
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 10 * pulse * zoom;

    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(x, y - 24 * zoom);
    ctx.lineTo(x + 6 * zoom, y - 4 * zoom);
    ctx.lineTo(x, y + 3 * zoom);
    ctx.lineTo(x - 6 * zoom, y - 4 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#cffafe';
    ctx.beginPath();
    ctx.moveTo(x, y - 24 * zoom);
    ctx.lineTo(x + 6 * zoom, y - 4 * zoom);
    ctx.lineTo(x, y + 3 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(x + 7 * zoom, y - 14 * zoom);
    ctx.lineTo(x + 11 * zoom, y - 2 * zoom);
    ctx.lineTo(x + 6 * zoom, y + 2 * zoom);
    ctx.lineTo(x + 3 * zoom, y - 2 * zoom);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (decoType === 'camp_tent') {
    // 15. Scout Tent & Campfire
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x - 2 * zoom, y + 3 * zoom, 18 * zoom, 9 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    // Left lit side
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(x - 12 * zoom, y + 2 * zoom);
    ctx.lineTo(x, y - 18 * zoom);
    ctx.lineTo(x - 2 * zoom, y + 5 * zoom);
    ctx.closePath();
    ctx.fill();

    // Right shaded side
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(x, y - 18 * zoom);
    ctx.lineTo(x + 12 * zoom, y - 3 * zoom);
    ctx.lineTo(x + 8 * zoom, y + 3 * zoom);
    ctx.lineTo(x - 2 * zoom, y + 5 * zoom);
    ctx.closePath();
    ctx.fill();

    // Dark entrance opening
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.moveTo(x - 10 * zoom, y + 2 * zoom);
    ctx.lineTo(x - 1 * zoom, y - 14 * zoom);
    ctx.lineTo(x - 3 * zoom, y + 4 * zoom);
    ctx.closePath();
    ctx.fill();

    // Ridgepole
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.8 * zoom;
    ctx.beginPath();
    ctx.moveTo(x - 1 * zoom, y - 20 * zoom);
    ctx.lineTo(x + 13 * zoom, y - 4 * zoom);
    ctx.stroke();

    // Campfire beside tent
    const fireX = x + 15 * zoom;
    const fireY = y + 4 * zoom;
    ctx.fillStyle = '#64748b';
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fireX + Math.cos(ang) * 5 * zoom, fireY + Math.sin(ang) * 2.5 * zoom, 1.8 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    const flameH = (5 + Math.sin(state.animTick * 0.25) * 2) * zoom;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 1 * zoom, 3 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(fireX - 2.5 * zoom, fireY);
    ctx.lineTo(fireX, fireY - flameH);
    ctx.lineTo(fireX + 2.5 * zoom, fireY);
    ctx.closePath();
    ctx.fill();
  } else if (decoType === 'campfire') {
    // 16. Standalone Campfire
    const fireX = x;
    const fireY = y + 2 * zoom;
    ctx.fillStyle = '#64748b';
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fireX + Math.cos(ang) * 6 * zoom, fireY + Math.sin(ang) * 3 * zoom, 2.2 * zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    const flameH = (7 + Math.sin(state.animTick * 0.28) * 3) * zoom;
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(fireX, fireY - 1 * zoom, 4 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(fireX - 3.5 * zoom, fireY);
    ctx.lineTo(fireX, fireY - flameH);
    ctx.lineTo(fireX + 3.5 * zoom, fireY);
    ctx.closePath();
    ctx.fill();
  } else if (decoType === 'lantern_post') {
    // 17. Street Lantern Post
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * zoom, 6 * zoom, 3 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5c4033';
    ctx.fillRect(x - 2 * zoom, y - 22 * zoom, 4 * zoom, 24 * zoom);
    ctx.fillRect(x - 2 * zoom, y - 22 * zoom, 9 * zoom, 3 * zoom);

    const lx = x + 6 * zoom;
    const ly = y - 18 * zoom;

    ctx.save();
    const glow = ctx.createRadialGradient(lx, ly, 2 * zoom, lx, ly, 16 * zoom);
    glow.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
    glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.25)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lx, ly, 16 * zoom, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(lx - 3 * zoom, ly - 4 * zoom, 6 * zoom, 8 * zoom);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(lx - 2 * zoom, ly - 3 * zoom, 4 * zoom, 6 * zoom);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(lx - 4 * zoom, ly - 4 * zoom);
    ctx.lineTo(lx, ly - 7 * zoom);
    ctx.lineTo(lx + 4 * zoom, ly - 4 * zoom);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (decoType === 'signpost') {
    // 18. Wooden Signpost
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 1 * zoom, 5 * zoom, 2.5 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - 1.8 * zoom, y - 18 * zoom, 3.6 * zoom, 20 * zoom);

    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.moveTo(x - 6 * zoom, y - 17 * zoom);
    ctx.lineTo(x + 7 * zoom, y - 17 * zoom);
    ctx.lineTo(x + 11 * zoom, y - 14 * zoom);
    ctx.lineTo(x + 7 * zoom, y - 11 * zoom);
    ctx.lineTo(x - 6 * zoom, y - 11 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(x + 6 * zoom, y - 10 * zoom);
    ctx.lineTo(x - 7 * zoom, y - 10 * zoom);
    ctx.lineTo(x - 11 * zoom, y - 7 * zoom);
    ctx.lineTo(x - 7 * zoom, y - 4 * zoom);
    ctx.lineTo(x + 6 * zoom, y - 4 * zoom);
    ctx.closePath();
    ctx.fill();
  } else if (decoType === 'crate_stack') {
    // 19. Stack of Wooden Supply Crates
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3 * zoom, 16 * zoom, 8 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    function drawIsoBox(cx, cy, sz, col1, col2, col3) {
      ctx.fillStyle = col1;
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz * 0.5);
      ctx.lineTo(cx + sz, cy);
      ctx.lineTo(cx, cy + sz * 0.5);
      ctx.lineTo(cx - sz, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = col2;
      ctx.beginPath();
      ctx.moveTo(cx - sz, cy);
      ctx.lineTo(cx, cy + sz * 0.5);
      ctx.lineTo(cx, cy + sz * 0.5 + sz * 0.8);
      ctx.lineTo(cx - sz, cy + sz * 0.8);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = col3;
      ctx.beginPath();
      ctx.moveTo(cx + sz, cy);
      ctx.lineTo(cx, cy + sz * 0.5);
      ctx.lineTo(cx, cy + sz * 0.5 + sz * 0.8);
      ctx.lineTo(cx + sz, cy + sz * 0.8);
      ctx.closePath();
      ctx.fill();
    }

    drawIsoBox(x - 4 * zoom, y - 4 * zoom, 7 * zoom, '#f59e0b', '#b45309', '#d97706');
    drawIsoBox(x + 5 * zoom, y - 2 * zoom, 6.5 * zoom, '#f59e0b', '#b45309', '#d97706');
    drawIsoBox(x, y - 10 * zoom, 6.5 * zoom, '#fbbf24', '#b45309', '#d97706');
  } else if (decoType === 'wooden_fence') {
    // 20. Rustic Wooden Fence
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * zoom, 15 * zoom, 5 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#854d0e';
    ctx.fillRect(x - 12 * zoom, y - 10 * zoom, 24 * zoom, 2.5 * zoom);
    ctx.fillRect(x - 12 * zoom, y - 5 * zoom, 24 * zoom, 2.5 * zoom);

    ctx.fillStyle = '#a16207';
    ctx.fillRect(x - 10 * zoom, y - 14 * zoom, 4 * zoom, 16 * zoom);
    ctx.fillRect(x + 6 * zoom, y - 14 * zoom, 4 * zoom, 16 * zoom);
  } else if (decoType === 'park_bench') {
    // 21. Campus Bench
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * zoom, 14 * zoom, 6 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.fillRect(x - 9 * zoom, y - 6 * zoom, 2 * zoom, 8 * zoom);
    ctx.fillRect(x + 7 * zoom, y - 6 * zoom, 2 * zoom, 8 * zoom);

    ctx.fillStyle = '#b45309';
    ctx.fillRect(x - 11 * zoom, y - 7 * zoom, 22 * zoom, 4 * zoom);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x - 11 * zoom, y - 14 * zoom, 22 * zoom, 4 * zoom);
  } else if (decoType === 'windmill') {
    // 22. Miniature Rustic Windmill with Rotating Sails
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(x + 2 * zoom, y + 3 * zoom, 20 * zoom, 10 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(x - 8 * zoom, y + 2 * zoom);
    ctx.lineTo(x - 5 * zoom, y - 26 * zoom);
    ctx.lineTo(x + 5 * zoom, y - 26 * zoom);
    ctx.lineTo(x + 8 * zoom, y + 2 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.moveTo(x - 7 * zoom, y - 26 * zoom);
    ctx.lineTo(x, y - 36 * zoom);
    ctx.lineTo(x + 7 * zoom, y - 26 * zoom);
    ctx.closePath();
    ctx.fill();

    const rotorAng = state.animTick * 0.03;
    const rx = x;
    const ry = y - 26 * zoom;
    ctx.save();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.8 * zoom;
    for (let i = 0; i < 4; i++) {
      const ang = rotorAng + (i * Math.PI) / 2;
      const sailLen = 18 * zoom;
      const sx = rx + Math.cos(ang) * sailLen;
      const sy = ry + Math.sin(ang) * sailLen;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(sx, sy);
      ctx.stroke();

      ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
      ctx.beginPath();
      ctx.moveTo(rx + Math.cos(ang) * 4 * zoom, ry + Math.sin(ang) * 4 * zoom);
      ctx.lineTo(sx, sy);
      ctx.lineTo(sx - Math.sin(ang) * 5 * zoom, sy + Math.cos(ang) * 5 * zoom);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(rx, ry, 2.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (decoType === 'lighthouse') {
    // 23. Outfield Lighthouse with Rotating Beam
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(x + 3 * zoom, y + 3 * zoom, 22 * zoom, 11 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.fillRect(x - 9 * zoom, y - 2 * zoom, 18 * zoom, 5 * zoom);

    const bands = [
      { bot: 0, top: 8, c: '#ef4444' },
      { bot: 8, top: 16, c: '#ffffff' },
      { bot: 16, top: 24, c: '#ef4444' },
      { bot: 24, top: 32, c: '#ffffff' }
    ];
    bands.forEach(b => {
      const w1 = 8 - (b.bot / 32) * 2.5;
      const w2 = 8 - (b.top / 32) * 2.5;
      ctx.fillStyle = b.c;
      ctx.beginPath();
      ctx.moveTo(x - w1 * zoom, y - b.bot * zoom);
      ctx.lineTo(x - w2 * zoom, y - b.top * zoom);
      ctx.lineTo(x + w2 * zoom, y - b.top * zoom);
      ctx.lineTo(x + w1 * zoom, y - b.bot * zoom);
      ctx.closePath();
      ctx.fill();
    });

    const lY = y - 35 * zoom;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - 7 * zoom, lY, 14 * zoom, 3 * zoom);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x - 4 * zoom, lY - 7 * zoom, 8 * zoom, 7 * zoom);

    // Rotating yellow beam
    const beamAng = state.animTick * 0.04;
    const beamDist = 65 * zoom;
    const beamGrad = ctx.createRadialGradient(x, lY - 3 * zoom, 2 * zoom, x + Math.cos(beamAng) * beamDist, (lY - 3 * zoom) + Math.sin(beamAng) * (beamDist * 0.5), beamDist);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
    beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(x, lY - 3 * zoom);
    ctx.lineTo(x + Math.cos(beamAng - 0.28) * beamDist, (lY - 3 * zoom) + Math.sin(beamAng - 0.28) * (beamDist * 0.5));
    ctx.lineTo(x + Math.cos(beamAng + 0.28) * beamDist, (lY - 3 * zoom) + Math.sin(beamAng + 0.28) * (beamDist * 0.5));
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(x, lY - 7 * zoom, 5 * zoom, Math.PI, 0);
    ctx.fill();
  } else if (decoType === 'buoy') {
    // 24. Floating Beacon Buoy
    const bob = Math.sin(state.animTick * 0.06 + tx * 2) * 3 * zoom;
    const by = y + bob;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.ellipse(x, by + 2 * zoom, 10 * zoom, 5 * zoom, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(x - 5 * zoom, by);
    ctx.lineTo(x, by - 12 * zoom);
    ctx.lineTo(x + 5 * zoom, by);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x - 3.5 * zoom, by - 3 * zoom);
    ctx.lineTo(x - 2 * zoom, by - 7 * zoom);
    ctx.lineTo(x + 2 * zoom, by - 7 * zoom);
    ctx.lineTo(x + 3.5 * zoom, by - 3 * zoom);
    ctx.closePath();
    ctx.fill();

    const blink = Math.sin(state.animTick * 0.12) > 0;
    if (blink) {
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#fde047';
      ctx.shadowBlur = 8 * zoom;
      ctx.beginPath();
      ctx.arc(x, by - 14 * zoom, 2.5 * zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  } else if (decoType === 'boat') {
    // 25. Wooden Rowboat Bobbing on Water
    const bob = Math.sin(state.animTick * 0.05 + tx * 1.5) * 2.5 * zoom;
    const by = y + bob;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2 * zoom;
    ctx.beginPath();
    ctx.ellipse(x, by + 2 * zoom, 14 * zoom, 6 * zoom, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(x - 13 * zoom, by - 2 * zoom);
    ctx.lineTo(x, by + 4 * zoom);
    ctx.lineTo(x + 13 * zoom, by - 2 * zoom);
    ctx.lineTo(x + 10 * zoom, by - 6 * zoom);
    ctx.lineTo(x - 10 * zoom, by - 6 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(x - 9 * zoom, by - 4 * zoom);
    ctx.lineTo(x, by + 1 * zoom);
    ctx.lineTo(x + 9 * zoom, by - 4 * zoom);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#d97706';
    ctx.fillRect(x - 2 * zoom, by - 3 * zoom, 4 * zoom, 3 * zoom);
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.5 * zoom;
    ctx.beginPath();
    ctx.moveTo(x - 2 * zoom, by - 2 * zoom);
    ctx.lineTo(x - 11 * zoom, by + 5 * zoom);
    ctx.stroke();
  }
  ctx.restore();
}

// ─────────────────────────────────────────────
// ▸ AIRDROP CRATE
// ─────────────────────────────────────────────

/**
 * Draw a floating airdrop crate with parachute and landing ring.
 * Animated float bob and parachute strings.
 */
function drawAirdropCrate(ctx, tx, ty) {
  const state = window.GameEngine.getState();
  const { x, y } = tileToScreen(tx, ty);
  const zoom = state.zoom;
  const animTick = state.animTick;
  const floatY = y - Math.abs(Math.sin(animTick * 0.05)) * 8 * zoom;

  ctx.save();

  // Landing zone ring
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2 * zoom;
  ctx.beginPath();
  ctx.ellipse(x, y, 16 * zoom, 8 * zoom, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Crate body (blue bottom)
  ctx.fillStyle = '#2563eb';
  ctx.fillRect(x - 10 * zoom, floatY - 16 * zoom, 20 * zoom, 14 * zoom);
  // Crate lid (red top)
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(x - 10 * zoom, floatY - 16 * zoom, 20 * zoom, 6 * zoom);

  // Parachute strings
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1 * zoom;
  ctx.beginPath();
  ctx.moveTo(x - 8 * zoom, floatY - 16 * zoom);
  ctx.lineTo(x - 18 * zoom, floatY - 38 * zoom);
  ctx.moveTo(x + 8 * zoom, floatY - 16 * zoom);
  ctx.lineTo(x + 18 * zoom, floatY - 38 * zoom);
  ctx.stroke();

  // Parachute canopy (red outer)
  ctx.beginPath();
  ctx.arc(x, floatY - 38 * zoom, 20 * zoom, Math.PI, 0, false);
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  // Parachute canopy (blue inner)
  ctx.beginPath();
  ctx.arc(x, floatY - 38 * zoom, 12 * zoom, Math.PI, 0, false);
  ctx.fillStyle = '#3b82f6';
  ctx.fill();

  ctx.restore();
}

// ─────────────────────────────────────────────
// ▸ CHIBI FACE RENDERER
// ─────────────────────────────────────────────

/**
 * Draw chibi face details: blush cheeks, eyes (with blink animation),
 * and optional sunglasses (for fox avatar).
 */
function drawChibiFaceOnCtx(targetCtx, cx, cy, scale, isBlinking, hasSunglasses) {
  // Blush cheeks
  targetCtx.fillStyle = 'rgba(244, 63, 94, 0.38)';
  targetCtx.beginPath();
  targetCtx.ellipse(cx - 7.5 * scale, cy + 2 * scale, 2.8 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
  targetCtx.ellipse(cx + 7.5 * scale, cy + 2 * scale, 2.8 * scale, 1.6 * scale, 0, 0, Math.PI * 2);
  targetCtx.fill();

  // Sunglasses (fox avatar)
  if (hasSunglasses) {
    targetCtx.fillStyle = '#0f172a';
    targetCtx.beginPath();
    targetCtx.roundRect(cx - 10 * scale, cy - 4 * scale, 8.5 * scale, 5.5 * scale, 1.5 * scale);
    targetCtx.roundRect(cx + 1.5 * scale, cy - 4 * scale, 8.5 * scale, 5.5 * scale, 1.5 * scale);
    targetCtx.fill();
    targetCtx.lineWidth = 1.8 * scale;
    targetCtx.strokeStyle = '#ffffff';
    targetCtx.stroke();
    return;
  }

  // Eyes
  targetCtx.fillStyle = '#0f172a';
  if (isBlinking) {
    targetCtx.lineWidth = 2 * scale;
    targetCtx.strokeStyle = '#0f172a';
    targetCtx.beginPath();
    targetCtx.moveTo(cx - 7 * scale, cy - 1 * scale);
    targetCtx.lineTo(cx - 2.5 * scale, cy - 1 * scale);
    targetCtx.moveTo(cx + 2.5 * scale, cy - 1 * scale);
    targetCtx.lineTo(cx + 7 * scale, cy - 1 * scale);
    targetCtx.stroke();
  } else {
    targetCtx.beginPath();
    targetCtx.arc(cx - 4.8 * scale, cy - 1.2 * scale, 2.5 * scale, 0, Math.PI * 2);
    targetCtx.arc(cx + 4.8 * scale, cy - 1.2 * scale, 2.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();

    // Eye shine highlights
    targetCtx.fillStyle = '#ffffff';
    targetCtx.beginPath();
    targetCtx.arc(cx - 5.5 * scale, cy - 2 * scale, 0.9 * scale, 0, Math.PI * 2);
    targetCtx.arc(cx + 4.1 * scale, cy - 2 * scale, 0.9 * scale, 0, Math.PI * 2);
    targetCtx.fill();
  }
}

// ─────────────────────────────────────────────
// ▸ DYNAMIC COLOR ADJUSTMENT HELPERS
// ─────────────────────────────────────────────
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string' || hex[0] !== '#') return { r: 6, g: 182, b: 212 };
  let c = hex.substring(1);
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return { r: 6, g: 182, b: 212 };
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function adjustColor(hex, factor) {
  const { r, g, b } = hexToRgb(hex);
  const clamp = v => Math.min(255, Math.max(0, Math.round(v)));
  if (factor >= 0) {
    return `rgb(${clamp(r + (255 - r) * factor)}, ${clamp(g + (255 - g) * factor)}, ${clamp(b + (255 - b) * factor)})`;
  } else {
    return `rgb(${clamp(r * (1 + factor))}, ${clamp(g * (1 + factor))}, ${clamp(b * (1 + factor))})`;
  }
}

// ─────────────────────────────────────────────
// ▸ RIGGED CHIBI BODY RENDERER
// ─────────────────────────────────────────────

/**
 * Full character body renderer with skeletal animation.
 * Supports avatar types: soldier, dino, mecha, fox, default.
 * Draws legs, torso, arms, head/helmet with walk/idle animation.
 */
function drawRiggedChibiBody(targetCtx, avatarType, teamColor, scale, legSwing, armSwing, isBlinking) {
  const state = window.GameEngine.getState();
  const animTick = state ? state.animTick : 0;
  const outline = '#0f172a';
  targetCtx.lineWidth = 2.2 * scale;
  targetCtx.strokeStyle = outline;
  targetCtx.lineJoin = 'round';

  // ── SOLDIER AVATAR ──
  if (avatarType === 'soldier') {
    const soldierColor = teamColor || '#365314';
    const helmetColor = adjustColor(soldierColor, -0.15);
    const brimColor = adjustColor(soldierColor, 0.25);
    const torsoColor = soldierColor;
    const armColor = adjustColor(soldierColor, 0.10);

    // LEGS
    targetCtx.fillStyle = '#1e293b';
    targetCtx.beginPath();
    targetCtx.roundRect(-8 * scale, -7 * scale + legSwing, 6.5 * scale, 8 * scale, 3 * scale);
    targetCtx.roundRect(1.5 * scale, -7 * scale - legSwing, 6.5 * scale, 8 * scale, 3 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // TORSO (Dynamic Costume Color)
    targetCtx.fillStyle = torsoColor;
    targetCtx.beginPath();
    targetCtx.roundRect(-10 * scale, -21 * scale, 20 * scale, 16 * scale, 6 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // BELT
    targetCtx.fillStyle = '#1e293b';
    targetCtx.fillRect(-10 * scale, -11 * scale, 20 * scale, 3.5 * scale);
    targetCtx.fillStyle = '#facc15';
    targetCtx.fillRect(-3 * scale, -11.5 * scale, 6 * scale, 4.5 * scale);

    // ARMS (Dynamic Costume Color)
    targetCtx.fillStyle = armColor;
    targetCtx.beginPath();
    targetCtx.roundRect(-14 * scale, -19 * scale - armSwing, 5 * scale, 11 * scale, 2.5 * scale);
    targetCtx.roundRect(9 * scale, -19 * scale + armSwing, 5 * scale, 11 * scale, 2.5 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // HEAD
    targetCtx.fillStyle = '#fed7aa';
    targetCtx.beginPath();
    targetCtx.arc(0, -31 * scale, 13.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    drawChibiFaceOnCtx(targetCtx, 0, -30 * scale, scale, isBlinking, false);

    // HELMET (Dynamic Helmet Color)
    targetCtx.fillStyle = helmetColor;
    targetCtx.beginPath();
    targetCtx.arc(0, -33.5 * scale, 14.8 * scale, Math.PI * 0.96, Math.PI * 0.04, false);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    // Helmet brim
    targetCtx.fillStyle = brimColor;
    targetCtx.beginPath();
    targetCtx.roundRect(-14 * scale, -35 * scale, 28 * scale, 4.5 * scale, 2 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Helmet light
    targetCtx.fillStyle = '#fef08a';
    targetCtx.beginPath();
    targetCtx.arc(0, -41 * scale, 2.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();

  // ── DINO AVATAR ──
  } else if (avatarType === 'dino') {
    const dinoBase = teamColor || '#22c55e';
    const dinoLight = adjustColor(dinoBase, 0.20);
    const dinoDark = adjustColor(dinoBase, -0.15);

    // Tail with wag animation
    const tailWag = Math.sin(animTick * 0.14) * 4 * scale;
    targetCtx.fillStyle = dinoBase;
    targetCtx.beginPath();
    targetCtx.moveTo(8 * scale, -10 * scale);
    targetCtx.quadraticCurveTo(21 * scale, -12 * scale + tailWag, 18 * scale, -4 * scale + tailWag);
    targetCtx.quadraticCurveTo(12 * scale, -3 * scale, 7 * scale, -6 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // LEGS
    targetCtx.fillStyle = dinoDark;
    targetCtx.beginPath();
    targetCtx.roundRect(-8.5 * scale, -7 * scale + legSwing, 7 * scale, 8 * scale, 3.5 * scale);
    targetCtx.roundRect(1.5 * scale, -7 * scale - legSwing, 7 * scale, 8 * scale, 3.5 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // TORSO
    targetCtx.fillStyle = dinoLight;
    targetCtx.beginPath();
    targetCtx.roundRect(-11 * scale, -22 * scale, 22 * scale, 17 * scale, 8 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Belly patch
    targetCtx.fillStyle = '#fef9c3';
    targetCtx.beginPath();
    targetCtx.ellipse(0, -13 * scale, 6.5 * scale, 6 * scale, 0, 0, Math.PI * 2);
    targetCtx.fill();

    // ARMS
    targetCtx.fillStyle = dinoBase;
    targetCtx.beginPath();
    targetCtx.roundRect(-14.5 * scale, -18 * scale - armSwing, 5 * scale, 9 * scale, 3 * scale);
    targetCtx.roundRect(9.5 * scale, -18 * scale + armSwing, 5 * scale, 9 * scale, 3 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Spikes
    targetCtx.fillStyle = '#facc15';
    for (let s = -1; s <= 1; s++) {
      targetCtx.beginPath();
      targetCtx.arc(s * 7 * scale, -45 * scale + Math.abs(s) * 2 * scale, 3.8 * scale, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    }

    // HEAD
    targetCtx.fillStyle = dinoLight;
    targetCtx.beginPath();
    targetCtx.arc(0, -32 * scale, 14 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    drawChibiFaceOnCtx(targetCtx, 0, -31 * scale, scale, isBlinking, false);

  // ── MECHA AVATAR ──
  } else if (avatarType === 'mecha') {
    const mechaBase = teamColor || '#9333ea';
    const mechaGlow = adjustColor(mechaBase, 0.45);

    // LEGS
    targetCtx.fillStyle = '#64748b';
    targetCtx.beginPath();
    targetCtx.roundRect(-8 * scale, -7 * scale + legSwing, 6.5 * scale, 8 * scale, 2 * scale);
    targetCtx.roundRect(1.5 * scale, -7 * scale - legSwing, 6.5 * scale, 8 * scale, 2 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // TORSO
    targetCtx.fillStyle = mechaBase;
    targetCtx.beginPath();
    targetCtx.roundRect(-10.5 * scale, -22 * scale, 21 * scale, 16 * scale, 5 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Core light
    targetCtx.fillStyle = mechaGlow;
    targetCtx.beginPath();
    targetCtx.arc(0, -14 * scale, 4 * scale, 0, Math.PI * 2);
    targetCtx.fill();

    // ARMS
    targetCtx.fillStyle = '#cbd5e1';
    targetCtx.beginPath();
    targetCtx.roundRect(-14.5 * scale, -19 * scale - armSwing, 5 * scale, 11 * scale, 2 * scale);
    targetCtx.roundRect(9.5 * scale, -19 * scale + armSwing, 5 * scale, 11 * scale, 2 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // HEAD (boxy mecha helmet)
    targetCtx.fillStyle = '#e2e8f0';
    targetCtx.beginPath();
    targetCtx.roundRect(-13.5 * scale, -44 * scale, 27 * scale, 22 * scale, 8 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Visor
    targetCtx.fillStyle = '#0f172a';
    targetCtx.beginPath();
    targetCtx.roundRect(-10 * scale, -39 * scale, 20 * scale, 12 * scale, 4 * scale);
    targetCtx.fill();

    // Visor eyes
    targetCtx.fillStyle = mechaGlow;
    if (isBlinking) {
      targetCtx.fillRect(-7 * scale, -33 * scale, 5 * scale, 1.8 * scale);
      targetCtx.fillRect(2 * scale, -33 * scale, 5 * scale, 1.8 * scale);
    } else {
      targetCtx.beginPath();
      targetCtx.arc(-4.5 * scale, -33 * scale, 2.8 * scale, 0, Math.PI * 2);
      targetCtx.arc(4.5 * scale, -33 * scale, 2.8 * scale, 0, Math.PI * 2);
      targetCtx.fill();
    }

    // Antenna
    targetCtx.beginPath();
    targetCtx.moveTo(0, -44 * scale);
    targetCtx.lineTo(0, -51 * scale);
    targetCtx.stroke();
    targetCtx.fillStyle = mechaBase;
    targetCtx.beginPath();
    targetCtx.arc(0, -52 * scale, 3 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

  // ── FOX AVATAR ──
  } else if (avatarType === 'fox') {
    const foxBase = teamColor || '#f97316';
    const foxDark = adjustColor(foxBase, -0.15);
    const foxLight = adjustColor(foxBase, 0.15);

    // Tail with sway animation
    const tailSway = Math.cos(animTick * 0.12) * 4 * scale;
    targetCtx.fillStyle = foxBase;
    targetCtx.beginPath();
    targetCtx.ellipse(12 * scale, -10 * scale + tailSway * 0.4, 8 * scale, 4.5 * scale, -0.4, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // LEGS
    targetCtx.fillStyle = '#1e293b';
    targetCtx.beginPath();
    targetCtx.roundRect(-8 * scale, -7 * scale + legSwing, 6 * scale, 8 * scale, 3 * scale);
    targetCtx.roundRect(2 * scale, -7 * scale - legSwing, 6 * scale, 8 * scale, 3 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // TORSO
    targetCtx.fillStyle = foxDark;
    targetCtx.beginPath();
    targetCtx.roundRect(-10 * scale, -21 * scale, 20 * scale, 15 * scale, 6 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Chest fur patch
    targetCtx.fillStyle = '#fff7ed';
    targetCtx.beginPath();
    targetCtx.moveTo(-5 * scale, -21 * scale);
    targetCtx.lineTo(5 * scale, -21 * scale);
    targetCtx.lineTo(0, -11 * scale);
    targetCtx.closePath();
    targetCtx.fill();

    // ARMS
    targetCtx.fillStyle = foxBase;
    targetCtx.beginPath();
    targetCtx.roundRect(-14 * scale, -19 * scale - armSwing, 4.8 * scale, 10 * scale, 2.5 * scale);
    targetCtx.roundRect(9.2 * scale, -19 * scale + armSwing, 4.8 * scale, 10 * scale, 2.5 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Ears
    targetCtx.fillStyle = foxBase;
    targetCtx.beginPath();
    targetCtx.moveTo(-12 * scale, -37 * scale);
    targetCtx.lineTo(-15 * scale, -51 * scale);
    targetCtx.lineTo(-3 * scale, -43 * scale);
    targetCtx.closePath();
    targetCtx.moveTo(12 * scale, -37 * scale);
    targetCtx.lineTo(15 * scale, -51 * scale);
    targetCtx.lineTo(3 * scale, -43 * scale);
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();

    // HEAD
    targetCtx.fillStyle = foxLight;
    targetCtx.beginPath();
    targetCtx.arc(0, -31 * scale, 13.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Cheek fluffs
    targetCtx.fillStyle = '#ffedd5';
    targetCtx.beginPath();
    targetCtx.ellipse(-6 * scale, -27 * scale, 5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
    targetCtx.ellipse(6 * scale, -27 * scale, 5 * scale, 3.5 * scale, 0, 0, Math.PI * 2);
    targetCtx.fill();

    drawChibiFaceOnCtx(targetCtx, 0, -30 * scale, scale, isBlinking, true);

  // ── NINJA AVATAR ──
  } else if (avatarType === 'ninja') {
    // LEGS
    targetCtx.fillStyle = '#0f172a';
    targetCtx.beginPath();
    targetCtx.roundRect(-8 * scale, -7 * scale + legSwing, 6 * scale, 8 * scale, 3 * scale);
    targetCtx.roundRect(2 * scale, -7 * scale - legSwing, 6 * scale, 8 * scale, 3 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // TORSO (Dark shinobi gi with accent sash)
    targetCtx.fillStyle = '#1e1b4b';
    targetCtx.beginPath();
    targetCtx.roundRect(-10 * scale, -21 * scale, 20 * scale, 15 * scale, 5 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Sash / Belt
    targetCtx.fillStyle = teamColor || '#f43f5e';
    targetCtx.fillRect(-10 * scale, -12 * scale, 20 * scale, 3.5 * scale);
    targetCtx.beginPath();
    targetCtx.arc(-2 * scale, -10 * scale, 2.8 * scale, 0, Math.PI * 2);
    targetCtx.fill();

    // ARMS
    targetCtx.fillStyle = '#1e1b4b';
    targetCtx.beginPath();
    targetCtx.roundRect(-14 * scale, -19 * scale - armSwing, 4.8 * scale, 10 * scale, 2.5 * scale);
    targetCtx.roundRect(9.2 * scale, -19 * scale + armSwing, 4.8 * scale, 10 * scale, 2.5 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Wrist wraps
    targetCtx.fillStyle = teamColor || '#f43f5e';
    targetCtx.fillRect(-14 * scale, -13 * scale - armSwing, 4.8 * scale, 2.5 * scale);
    targetCtx.fillRect(9.2 * scale, -13 * scale + armSwing, 4.8 * scale, 2.5 * scale);

    // HEAD (Ninja hood)
    targetCtx.fillStyle = '#0f172a';
    targetCtx.beginPath();
    targetCtx.arc(0, -31 * scale, 13.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Face opening cutout for eyes
    targetCtx.fillStyle = '#fed7aa';
    targetCtx.beginPath();
    targetCtx.roundRect(-9 * scale, -34 * scale, 18 * scale, 7.5 * scale, 3 * scale);
    targetCtx.fill();

    // Sharp ninja eyes
    targetCtx.fillStyle = '#0f172a';
    if (isBlinking) {
      targetCtx.fillRect(-7 * scale, -31 * scale, 5 * scale, 1.8 * scale);
      targetCtx.fillRect(2 * scale, -31 * scale, 5 * scale, 1.8 * scale);
    } else {
      targetCtx.beginPath();
      targetCtx.moveTo(-7 * scale, -32 * scale);
      targetCtx.lineTo(-2 * scale, -30 * scale);
      targetCtx.lineTo(-6 * scale, -29 * scale);
      targetCtx.closePath();
      targetCtx.fill();

      targetCtx.beginPath();
      targetCtx.moveTo(7 * scale, -32 * scale);
      targetCtx.lineTo(2 * scale, -30 * scale);
      targetCtx.lineTo(6 * scale, -29 * scale);
      targetCtx.closePath();
      targetCtx.fill();

      // Gleam in eyes
      targetCtx.fillStyle = teamColor || '#f43f5e';
      targetCtx.fillRect(-4.5 * scale, -31 * scale, 1.8 * scale, 1.8 * scale);
      targetCtx.fillRect(2.7 * scale, -31 * scale, 1.8 * scale, 1.8 * scale);
    }

    // Forehead Band / Headband
    targetCtx.fillStyle = teamColor || '#f43f5e';
    targetCtx.beginPath();
    targetCtx.roundRect(-13.5 * scale, -38 * scale, 27 * scale, 4 * scale, 2 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Metal forehead plate
    targetCtx.fillStyle = '#94a3b8';
    targetCtx.fillRect(-5 * scale, -37.5 * scale, 10 * scale, 3 * scale);

    // Trailing ribbon swaying behind head
    const ribbonWave = Math.sin((animTick || 0) * 0.14) * 4 * scale;
    targetCtx.fillStyle = teamColor || '#f43f5e';
    targetCtx.beginPath();
    targetCtx.moveTo(-12 * scale, -37 * scale);
    targetCtx.quadraticCurveTo(-20 * scale, -38 * scale + ribbonWave, -25 * scale, -42 * scale + ribbonWave * 1.5);
    targetCtx.lineTo(-22 * scale, -34 * scale + ribbonWave);
    targetCtx.closePath();
    targetCtx.fill();

  // ── ASTRO AVATAR ──
  } else if (avatarType === 'astro') {
    // Backpack oxygen tanks
    targetCtx.fillStyle = '#cbd5e1';
    targetCtx.beginPath();
    targetCtx.roundRect(-13 * scale, -25 * scale, 6 * scale, 16 * scale, 3 * scale);
    targetCtx.roundRect(7 * scale, -25 * scale, 6 * scale, 16 * scale, 3 * scale);
    targetCtx.fill();
    targetCtx.stroke();
    // Red valve caps
    targetCtx.fillStyle = '#ef4444';
    targetCtx.fillRect(-12 * scale, -27 * scale, 4 * scale, 2.5 * scale);
    targetCtx.fillRect(8 * scale, -27 * scale, 4 * scale, 2.5 * scale);

    // LEGS
    targetCtx.fillStyle = '#e2e8f0';
    targetCtx.beginPath();
    targetCtx.roundRect(-8 * scale, -7 * scale + legSwing, 6.5 * scale, 8 * scale, 3 * scale);
    targetCtx.roundRect(1.5 * scale, -7 * scale - legSwing, 6.5 * scale, 8 * scale, 3 * scale);
    targetCtx.fill();
    targetCtx.stroke();
    // Boots
    targetCtx.fillStyle = '#475569';
    targetCtx.fillRect(-8 * scale, -2 * scale + legSwing, 6.5 * scale, 3 * scale);
    targetCtx.fillRect(1.5 * scale, -2 * scale - legSwing, 6.5 * scale, 3 * scale);

    // TORSO (Spacesuit)
    targetCtx.fillStyle = '#f8fafc';
    targetCtx.beginPath();
    targetCtx.roundRect(-10.5 * scale, -22 * scale, 21 * scale, 16 * scale, 6 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // Chest badge / control panel
    targetCtx.fillStyle = teamColor || '#eab308';
    targetCtx.fillRect(-5 * scale, -17 * scale, 10 * scale, 7 * scale);
    targetCtx.fillStyle = '#38bdf8';
    targetCtx.beginPath();
    targetCtx.arc(-2 * scale, -13.5 * scale, 1.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.fillStyle = '#22c55e';
    targetCtx.beginPath();
    targetCtx.arc(2 * scale, -13.5 * scale, 1.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();

    // ARMS
    targetCtx.fillStyle = '#e2e8f0';
    targetCtx.beginPath();
    targetCtx.roundRect(-14.5 * scale, -19 * scale - armSwing, 5 * scale, 11 * scale, 2.5 * scale);
    targetCtx.roundRect(9.5 * scale, -19 * scale + armSwing, 5 * scale, 11 * scale, 2.5 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // HEAD (Giant Bubble Helmet)
    targetCtx.fillStyle = '#f8fafc';
    targetCtx.beginPath();
    targetCtx.arc(0, -32 * scale, 15 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    // Reflective Gold/Cyan Curved Visor
    const visorGrad = targetCtx.createLinearGradient(0, -40 * scale, 0, -24 * scale);
    visorGrad.addColorStop(0, '#facc15');
    visorGrad.addColorStop(0.5, '#0284c7');
    visorGrad.addColorStop(1, '#0f172a');
    targetCtx.fillStyle = visorGrad;
    targetCtx.beginPath();
    targetCtx.ellipse(0, -31 * scale, 11 * scale, 8 * scale, 0, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.lineWidth = 1.8 * scale;
    targetCtx.strokeStyle = '#38bdf8';
    targetCtx.stroke();

    // Visor gleam highlight
    targetCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    targetCtx.beginPath();
    targetCtx.ellipse(-4 * scale, -34 * scale, 4 * scale, 2 * scale, -0.4, 0, Math.PI * 2);
    targetCtx.fill();

    // Helmet antenna with blinking light
    targetCtx.strokeStyle = '#94a3b8';
    targetCtx.lineWidth = 1.8 * scale;
    targetCtx.beginPath();
    targetCtx.moveTo(11 * scale, -40 * scale);
    targetCtx.lineTo(15 * scale, -49 * scale);
    targetCtx.stroke();
    targetCtx.fillStyle = ((animTick || 0) % 60 > 30) ? '#ef4444' : '#22c55e';
    targetCtx.beginPath();
    targetCtx.arc(15 * scale, -49 * scale, 2.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();

  // ── DEFAULT / GENERIC AVATAR ──
  } else {
    // LEGS
    targetCtx.fillStyle = '#1e293b';
    targetCtx.beginPath();
    targetCtx.roundRect(-8 * scale, -7 * scale + legSwing, 6 * scale, 8 * scale, 3 * scale);
    targetCtx.roundRect(2 * scale, -7 * scale - legSwing, 6 * scale, 8 * scale, 3 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // TORSO (uses team color)
    targetCtx.fillStyle = teamColor;
    targetCtx.beginPath();
    targetCtx.roundRect(-10 * scale, -21 * scale, 20 * scale, 15 * scale, 6 * scale);
    targetCtx.fill();
    targetCtx.stroke();

    // HEAD
    targetCtx.fillStyle = '#fde68a';
    targetCtx.beginPath();
    targetCtx.arc(0, -31 * scale, 13.5 * scale, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.stroke();

    drawChibiFaceOnCtx(targetCtx, 0, -30 * scale, scale, isBlinking, false);
  }
}

// ─────────────────────────────────────────────
// ▸ CHIBI TEAM AVATAR (MAP PLACEMENT)
// ─────────────────────────────────────────────

/**
 * Draw a team's avatar on the isometric map with full animation:
 * breathing idle, walk cycle, hop, shadow, turn indicator ring, name badge.
 */
function drawChibiTeamAvatar(ctx, team, isTurn) {
  const state = window.GameEngine.getState();
  const zoom = state.zoom;
  const animTick = state.animTick;
  const { x, y } = tileToScreen(team.renderX, team.renderY);

  // Animation parameters
  const isMoving = team.isMoving;
  const idlePhase = animTick * 0.09 + team.id * 1.7;
  const breathBob = isMoving ? 0 : Math.sin(idlePhase) * 2.2 * zoom;
  const squashX = isMoving ? 1.04 : 1 + Math.sin(idlePhase) * 0.025;
  const stretchY = isMoving ? 0.96 : 1 - Math.sin(idlePhase) * 0.025;

  const legSwing = isMoving ? Math.sin(team.walkPhase * Math.PI * 4) * 5.5 * zoom : 0;
  const armSwing = isMoving ? Math.cos(team.walkPhase * Math.PI * 4) * 5 * zoom : Math.sin(idlePhase) * 1.8 * zoom;
  const jumpOffset = (team.hopZ || 0) * zoom;
  const blinkCycle = (animTick + team.id * 47) % 190;
  const isBlinking = blinkCycle > 182;

  ctx.save();

  // Active turn indicator ring
  if (isTurn) {
    const ringPulse = 1 + Math.sin(animTick * 0.1) * 0.08;
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 3 * zoom;
    ctx.beginPath();
    ctx.ellipse(x, y + 2 * zoom, 20 * zoom * ringPulse, 10.5 * zoom * ringPulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34, 211, 238, 0.18)';
    ctx.fill();
  }

  // Shadow (scales with hop height)
  const shadowScale = Math.max(0.55, 1 - (team.hopZ || 0) / 45);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * zoom, 14 * zoom * shadowScale, 7 * zoom * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Character body with squash & stretch
  ctx.translate(x, y - jumpOffset + breathBob);
  ctx.scale(squashX, stretchY);

  // Stealth transparency effect if Ghillie Suit is active
  if (team.stealthTurns > 0) {
    ctx.globalAlpha = 0.42;
  }

  drawRiggedChibiBody(ctx, team.avatar, team.color, zoom, legSwing, armSwing, isBlinking);
  ctx.restore();

  // ── Name badge and turn indicator icon ──
  ctx.save();
  const badgeY = y - jumpOffset + breathBob - 55 * zoom;

  // Bouncing question mark icon (active turn)
  if (isTurn) {
    const iconBounce = Math.sin(animTick * 0.12) * 3 * zoom;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(x, badgeY - 17 * zoom + iconBounce, 7.5 * zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.8 * zoom;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = `900 ${9.5 * zoom}px Fredoka`;
    ctx.textAlign = 'center';
    ctx.fillText('?', x, badgeY - 13.5 * zoom + iconBounce);
  }

  // Tactical status icons (Armor, Stealth, Freeze/SkipTurn)
  let statusIcons = '';
  if (team.hasArmor) statusIcons += ' 🛡️';
  if (team.stealthTurns > 0) statusIcons += ' 🌿';
  if (team.skipTurn || team.isFrozen) statusIcons += ' ❄️';

  // Name tag pill
  const baseTag = isTurn ? `${team.name.split(' ')[1]?.toUpperCase() || 'ACTIVE'} (TURN)` : team.name.split(' ')[1]?.replace(/[()]/g, '').toUpperCase() || team.name.toUpperCase();
  const tagText = `${baseTag}${statusIcons}`;
  const pillW = Math.max(48, tagText.length * 6.4) * zoom;
  const pillH = 13.5 * zoom;

  ctx.fillStyle = isTurn ? 'rgba(15, 23, 42, 0.92)' : team.lp <= 35 ? 'rgba(220, 38, 38, 0.9)' : 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.roundRect(x - pillW / 2, badgeY - pillH / 2, pillW, pillH, 4 * zoom);
  ctx.fill();
  ctx.lineWidth = 1.2 * zoom;
  ctx.strokeStyle = isTurn ? '#22d3ee' : team.hasArmor ? '#34d399' : team.stealthTurns > 0 ? '#2dd4bf' : 'rgba(255,255,255,0.2)';
  ctx.stroke();

  ctx.fillStyle = isTurn ? '#67e8f9' : '#ffffff';
  ctx.font = `800 ${8 * zoom}px Plus Jakarta Sans`;
  ctx.textAlign = 'center';
  ctx.fillText(tagText, x, badgeY + 2.8 * zoom);
  ctx.restore();
}

// ─────────────────────────────────────────────
// ▸ SAFE ZONE BOUNDARY RING
// ─────────────────────────────────────────────

/**
 * Draw the safe zone boundary as dual isometric ellipses:
 * inner dashed purple ring and outer glowing cyan ring.
 */
function drawSafeZoneBoundaryRing(ctx) {
  const state = window.GameEngine.getState();
  const zoom = state.zoom;
  const safeZone = state.safeZone;
  const isoCanvas = state.isoCanvas;
  const centerTileX = (safeZone.minX + safeZone.maxX) / 2;
  const centerTileY = (safeZone.minY + safeZone.maxY) / 2;
  const centerScreen = tileToScreen(centerTileX, centerTileY);

  const radiusTiles = (safeZone.maxX - safeZone.minX + 1) * 0.55;
  const rx = radiusTiles * (TILE_W * 0.62) * zoom;
  const ry = radiusTiles * (TILE_H * 0.62) * zoom;

  ctx.save();

  // Inner dashed purple ring
  ctx.setLineDash([10 * zoom, 7 * zoom]);
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.85)';
  ctx.lineWidth = 2.5 * zoom;
  ctx.beginPath();
  ctx.ellipse(centerScreen.x, centerScreen.y, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Outer glowing cyan ring
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
  ctx.lineWidth = 2.5 * zoom;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(centerScreen.x, centerScreen.y, rx * 1.42, ry * 1.42, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// ─────────────────────────────────────────────
// ▸ DUEL STAGE RENDERER
// ─────────────────────────────────────────────

/**
 * Render the 1v1 duel stage overlay with attack animation,
 * screen shake, impact flash, and VS idle display.
 * Self-loops via requestAnimationFrame while duel is active.
 */
function renderDuelStage(duelCtx, duelCanvas, duelState) {
  if (!duelState.active) return;
  const state = window.GameEngine.getState();
  const animTick = state.animTick;

  const w = duelCanvas.width;
  const h = duelCanvas.height;
  duelCtx.clearRect(0, 0, w, h);

  // Attack phase progression
  if (duelState.phase === 'attack') {
    duelState.progress = Math.min(1, duelState.progress + 0.032);
    if (duelState.progress > 0.42 && duelState.progress < 0.72) {
      duelState.shakeX = (Math.random() - 0.5) * 12;
      duelState.shakeY = (Math.random() - 0.5) * 8;
    } else {
      duelState.shakeX = 0;
      duelState.shakeY = 0;
    }
    if (duelState.progress >= 1) {
      duelState.phase = 'done';
    }
  }

  duelCtx.save();
  duelCtx.translate(duelState.shakeX, duelState.shakeY);

  // Ground shadow ellipses
  duelCtx.fillStyle = 'rgba(30, 41, 59, 0.85)';
  duelCtx.beginPath();
  duelCtx.ellipse(190, 142, 75, 20, 0, 0, Math.PI * 2);
  duelCtx.ellipse(570, 142, 75, 20, 0, 0, Math.PI * 2);
  duelCtx.fill();
  duelCtx.lineWidth = 2;
  duelCtx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  duelCtx.stroke();

  // Character positions and animation
  let leftX = 190, leftY = 138;
  let rightX = 570, rightY = 138;
  let leftWalk = 0, rightWalk = 0;
  let impactFlash = false;

  if (duelState.phase === 'attack' || duelState.phase === 'done') {
    const p = duelState.progress;
    const lunge = p < 0.5 ? (p / 0.5) : Math.max(0.65, 1 - (p - 0.5) * 0.7);

    if (duelState.attackerSide === 1) {
      leftX = 190 + lunge * 310;
      leftY = 138 - Math.sin(Math.min(1, p * 2) * Math.PI) * 28;
      leftWalk = p * 5;
      if (p > 0.42) {
        rightX = 570 + Math.sin((p - 0.42) * 18) * 18;
        impactFlash = p < 0.78;
      }
    } else {
      rightX = 570 - lunge * 310;
      rightY = 138 - Math.sin(Math.min(1, p * 2) * Math.PI) * 28;
      rightWalk = p * 5;
      if (p > 0.42) {
        leftX = 190 - Math.sin((p - 0.42) * 18) * 18;
        impactFlash = p < 0.78;
      }
    }
  }

  // Idle bob animation
  const idleBob1 = Math.sin(animTick * 0.1) * 3;
  const idleBob2 = Math.cos(animTick * 0.1) * 3;

  // Draw left combatant
  duelCtx.save();
  duelCtx.translate(leftX, leftY + idleBob1);
  const leg1 = Math.sin(leftWalk * Math.PI * 2) * 7;
  drawRiggedChibiBody(duelCtx, duelState.team1.avatar, duelState.team1.color, 1.85, leg1, -leg1, false);
  duelCtx.restore();

  // Draw right combatant
  duelCtx.save();
  duelCtx.translate(rightX, rightY + idleBob2);
  const leg2 = Math.sin(rightWalk * Math.PI * 2) * 7;
  drawRiggedChibiBody(duelCtx, duelState.team2.avatar, duelState.team2.color, 1.85, leg2, -leg2, false);
  duelCtx.restore();

  // Impact flash effect
  if (impactFlash) {
    const hitX = duelState.attackerSide === 1 ? rightX : leftX;
    const hitY = 92;

    duelCtx.save();
    // Impact X cross
    duelCtx.strokeStyle = '#facc15';
    duelCtx.lineWidth = 5;
    duelCtx.beginPath();
    duelCtx.moveTo(hitX - 35, hitY - 30);
    duelCtx.lineTo(hitX + 35, hitY + 30);
    duelCtx.moveTo(hitX + 35, hitY - 30);
    duelCtx.lineTo(hitX - 35, hitY + 30);
    duelCtx.stroke();

    // Impact shockwave
    duelCtx.fillStyle = 'rgba(244, 63, 94, 0.45)';
    duelCtx.beginPath();
    duelCtx.arc(hitX, hitY, 42, 0, Math.PI * 2);
    duelCtx.fill();

    // Damage text
    duelCtx.font = '900 22px Fredoka';
    duelCtx.fillStyle = '#fef08a';
    duelCtx.textAlign = 'center';
    duelCtx.fillText('💥 POW! -25 LP', hitX, hitY - 45);
    duelCtx.restore();
  }

  // VS badge (idle phase)
  if (duelState.phase === 'idle') {
    duelCtx.fillStyle = 'rgba(244, 63, 94, 0.9)';
    duelCtx.beginPath();
    duelCtx.arc(w / 2, h / 2 - 5, 22, 0, Math.PI * 2);
    duelCtx.fill();
    duelCtx.font = '900 16px Fredoka';
    duelCtx.fillStyle = '#ffffff';
    duelCtx.textAlign = 'center';
    duelCtx.fillText('VS', w / 2, h / 2 + 1);
  }

  duelCtx.restore();
  requestAnimationFrame(() => renderDuelStage(duelCtx, duelCanvas, duelState));
}

// ─────────────────────────────────────────────
// ▸ PARTICLES & FLOATING TEXT
// ─────────────────────────────────────────────

/**
 * Spawn dust puff particles at a tile position.
 * Used for movement and landing effects.
 */
function spawnDustPuff(tileX, tileY, count = 6) {
  const state = window.GameEngine.getState();
  const pos = tileToScreen(tileX, tileY);
  const zoom = state.zoom;
  for (let i = 0; i < count; i++) {
    state.dustParticles.push({
      x: pos.x + (Math.random() - 0.5) * 16 * zoom,
      y: pos.y + (Math.random() - 0.5) * 8 * zoom,
      vx: (Math.random() - 0.5) * 1.6,
      vy: -Math.random() * 1.5 - 0.4,
      radius: (Math.random() * 4 + 3) * zoom,
      alpha: 0.85
    });
  }
}

/**
 * Spawn a floating text label at a tile position.
 * Used for damage numbers, status messages, etc.
 */
function spawnFloatingText(tileX, tileY, text, color = '#4ade80') {
  const state = window.GameEngine.getState();
  state.floatingTexts.push({
    tileX, tileY,
    offsetY: 0,
    text,
    color,
    alpha: 1.0
  });
}

/**
 * Update and render all active dust particles and floating text labels.
 * Automatically removes expired particles/texts.
 */
function updateAndDrawParticlesAndFloatingText(ctx) {
  const state = window.GameEngine.getState();
  const zoom = state.zoom;
  const dustParticles = state.dustParticles;
  const floatingTexts = state.floatingTexts;

  // Dust particles
  for (let i = dustParticles.length - 1; i >= 0; i--) {
    const p = dustParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.radius *= 0.96;
    p.alpha -= 0.035;
    if (p.alpha <= 0.02) { dustParticles.splice(i, 1); continue; }
    ctx.save();
    ctx.fillStyle = `rgba(241, 245, 249, ${p.alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Floating text labels
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.offsetY -= 0.9;
    ft.alpha -= 0.015;
    if (ft.alpha <= 0.02) { floatingTexts.splice(i, 1); continue; }

    const pos = tileToScreen(ft.tileX, ft.tileY);
    ctx.save();
    ctx.font = `900 ${Math.max(11, 13 * zoom)}px Fredoka`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = `rgba(15, 23, 42, ${ft.alpha})`;
    ctx.lineWidth = 4 * zoom;
    ctx.strokeText(ft.text, pos.x, pos.y - 68 * zoom + ft.offsetY);
    ctx.fillStyle = ft.color;
    ctx.globalAlpha = ft.alpha;
    ctx.fillText(ft.text, pos.x, pos.y - 68 * zoom + ft.offsetY);
    ctx.restore();
  }
}

// ─────────────────────────────────────────────
// ▸ CHIBI THUMBNAIL & SHOWCASE STAGE RENDERERS
// ─────────────────────────────────────────────

/**
 * Render a mini chibi thumbnail onto a small canvas (48x48 or 56x56).
 * Used in team customization cards and roster grid items.
 */
function drawChibiThumbnail(canvas, avatarType, teamColor, isAnimated = false, customAnimTick = 0) {
  if (!canvas) return;
  const tCtx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  tCtx.clearRect(0, 0, w, h);

  // Background gradient based on teamColor
  const bgGrad = tCtx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w * 0.7);
  bgGrad.addColorStop(0, (teamColor || '#06b6d4') + '55');
  bgGrad.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
  tCtx.fillStyle = bgGrad;
  tCtx.beginPath();
  tCtx.roundRect(0, 0, w, h, 14);
  tCtx.fill();

  // Soft glow circular platform
  tCtx.fillStyle = (teamColor || '#06b6d4') + '44';
  tCtx.beginPath();
  tCtx.ellipse(w / 2, h - 8, w * 0.38, 5, 0, 0, Math.PI * 2);
  tCtx.fill();

  const tick = isAnimated ? customAnimTick : 0;
  const idlePhase = tick * 0.08;
  const breathBob = isAnimated ? Math.sin(idlePhase) * 1.5 : 0;
  const isBlinking = isAnimated ? (tick % 160 > 152) : false;
  const armSwing = isAnimated ? Math.sin(idlePhase) * 1.2 : 0;

  tCtx.save();
  // Standard character height is ~52 units. Scale relative to canvas height:
  const scale = (h / 56) * 0.82;
  tCtx.translate(w / 2, h - 9 + breathBob);
  drawRiggedChibiBody(tCtx, avatarType, teamColor, scale, 0, armSwing, isBlinking);
  tCtx.restore();
}

/**
 * Render the large Subway Surfers-style character showcase stage
 * with 3D glowing circular podium, atmospheric spotlight, and idle animation.
 */
function drawShowcaseStage(canvas, avatarType, teamColor, animTick = 0) {
  if (!canvas) return;
  const sCtx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  sCtx.clearRect(0, 0, w, h);

  const stageCenterX = w / 2;
  const stageCenterY = h - 38;

  // 1. Ambient spotlight background
  const spotGrad = sCtx.createRadialGradient(stageCenterX, stageCenterY - 45, 10, stageCenterX, stageCenterY - 45, 130);
  spotGrad.addColorStop(0, (teamColor || '#06b6d4') + '40');
  spotGrad.addColorStop(0.55, (teamColor || '#06b6d4') + '15');
  spotGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  sCtx.fillStyle = spotGrad;
  sCtx.fillRect(0, 0, w, h);

  // 2. Subway Surfers Podium (3D circular platform)
  const podiumW = 98;
  const podiumH = 25;
  const podiumDepth = 12;

  // Podium bottom drop-shadow
  sCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  sCtx.beginPath();
  sCtx.ellipse(stageCenterX, stageCenterY + podiumDepth + 3, podiumW + 8, podiumH + 4, 0, 0, Math.PI * 2);
  sCtx.fill();

  // Podium vertical bevel / sides
  sCtx.fillStyle = '#090d16';
  sCtx.beginPath();
  sCtx.rect(stageCenterX - podiumW, stageCenterY, podiumW * 2, podiumDepth);
  sCtx.fill();

  // Glowing neon rim line
  sCtx.save();
  sCtx.shadowColor = teamColor || '#06b6d4';
  sCtx.shadowBlur = 18;
  sCtx.strokeStyle = teamColor || '#06b6d4';
  sCtx.lineWidth = 3.5;
  sCtx.beginPath();
  sCtx.ellipse(stageCenterX, stageCenterY + podiumDepth * 0.45, podiumW + 1, podiumH * 0.95, 0, 0, Math.PI * 2);
  sCtx.stroke();
  sCtx.restore();

  // Podium top platform surface
  const platGrad = sCtx.createLinearGradient(0, stageCenterY - podiumH, 0, stageCenterY + podiumH);
  platGrad.addColorStop(0, '#334155');
  platGrad.addColorStop(0.5, '#1e293b');
  platGrad.addColorStop(1, '#0f172a');
  sCtx.fillStyle = platGrad;
  sCtx.beginPath();
  sCtx.ellipse(stageCenterX, stageCenterY, podiumW, podiumH, 0, 0, Math.PI * 2);
  sCtx.fill();
  sCtx.lineWidth = 1.8;
  sCtx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  sCtx.stroke();

  // Inner neon ring on top of podium
  sCtx.strokeStyle = (teamColor || '#06b6d4') + '99';
  sCtx.lineWidth = 2;
  sCtx.beginPath();
  sCtx.ellipse(stageCenterX, stageCenterY, podiumW * 0.72, podiumH * 0.72, 0, 0, Math.PI * 2);
  sCtx.stroke();

  // 3. Floating rising sparkles/particles from podium
  for (let i = 0; i < 7; i++) {
    const pPhase = (animTick * 0.028 + i * 0.9) % (Math.PI * 2);
    const px = stageCenterX + Math.cos(pPhase * 1.7 + i * 2) * (podiumW * 0.82);
    const py = stageCenterY - 12 - ((pPhase / (Math.PI * 2)) * 130);
    const pAlpha = Math.sin(pPhase * 0.5);
    if (pAlpha > 0) {
      sCtx.fillStyle = teamColor || '#06b6d4';
      sCtx.globalAlpha = pAlpha * 0.85;
      sCtx.beginPath();
      sCtx.arc(px, py, 2.2, 0, Math.PI * 2);
      sCtx.fill();
      sCtx.globalAlpha = 1;
    }
  }

  // 4. Character contact shadow on podium
  sCtx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  sCtx.beginPath();
  sCtx.ellipse(stageCenterX, stageCenterY + 2, 34, 11, 0, 0, Math.PI * 2);
  sCtx.fill();

  // 5. Large Rigged Chibi Character
  const idlePhase = animTick * 0.08;
  const breathBob = Math.sin(idlePhase) * 3;
  const armSwing = Math.sin(idlePhase) * 2.2;
  const isBlinking = (animTick % 180 > 172);
  const scale = 2.65;

  sCtx.save();
  sCtx.translate(stageCenterX, stageCenterY - 4 + breathBob);
  drawRiggedChibiBody(sCtx, avatarType, teamColor, scale, 0, armSwing, isBlinking);
  sCtx.restore();
}

// ─────────────────────────────────────────────
// ▸ ATMOSPHERIC OUTFIELD CLOUDS & MIST
// ─────────────────────────────────────────────

/**
 * Draw gentle atmospheric clouds drifting over outfield corners.
 * Adds cinematic depth and high-altitude battle royale feel.
 */
function drawAtmosphericClouds(ctx) {
  const state = window.GameEngine.getState();
  const isoCanvas = state.isoCanvas;
  const zoom = state.zoom;
  const tick = state.animTick;

  const clouds = [
    { seedX: 0.08, seedY: 0.16, scale: 1.15, speed: 0.22 },
    { seedX: 0.75, seedY: 0.12, scale: 1.35, speed: 0.18 },
    { seedX: 0.04, seedY: 0.72, scale: 0.95, speed: 0.26 },
    { seedX: 0.82, seedY: 0.68, scale: 1.25, speed: 0.20 },
    { seedX: 0.44, seedY: 0.04, scale: 1.05, speed: 0.24 }
  ];

  ctx.save();
  clouds.forEach(c => {
    const period = isoCanvas.width + 450;
    const rawX = (c.seedX * isoCanvas.width + tick * c.speed) % period;
    const cx = rawX - 225;
    const cy = c.seedY * isoCanvas.height;
    const sz = 38 * c.scale * zoom;

    // Faint cloud shadow on water below
    ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
    ctx.beginPath();
    ctx.ellipse(cx + 25 * zoom, cy + 70 * zoom, sz * 1.5, sz * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fluffy cloud puffs
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.beginPath();
    ctx.arc(cx, cy, sz * 0.6, 0, Math.PI * 2);
    ctx.arc(cx + sz * 0.45, cy - sz * 0.1, sz * 0.75, 0, Math.PI * 2);
    ctx.arc(cx + sz * 0.95, cy + sz * 0.05, sz * 0.55, 0, Math.PI * 2);
    ctx.arc(cx + sz * 0.4, cy + sz * 0.2, sz * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

// ─────────────────────────────────────────────
// ▸ MODULE EXPORT
// ─────────────────────────────────────────────

window.MapRenderer = {
  TILE_W,
  TILE_H,
  BLOCK_DEPTH,
  tileToScreen,
  screenToTile,
  drawIsometricTileBlock,
  drawTacticalMoveHighlight,
  drawEnvironmentProp,
  drawAirdropCrate,
  drawRiggedChibiBody,
  drawChibiFaceOnCtx,
  drawChibiTeamAvatar,
  drawChibiThumbnail,
  drawShowcaseStage,
  drawSafeZoneBoundaryRing,
  drawAtmosphericClouds,
  renderDuelStage,
  spawnDustPuff,
  spawnFloatingText,
  updateAndDrawParticlesAndFloatingText
};
