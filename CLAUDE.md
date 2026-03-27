# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Browser-based games delivered as self-contained single `.html` files. No build step, no dependencies, no package manager — open the file directly in a browser to play.

## Running the Games

```bash
# Open in default browser (Windows)
powershell -command "Start-Process '<file>.html'"
```

## Repository Structure

Each game is a single file with all HTML, CSS, and JavaScript inline. The JS inside each file is organized with comment banners:

```
[CONSTANTS]  → canvas size, color palette, tuning values
[INPUT]      → keyboard (keys/keyPressed objects) and mouse state
[WEAPONS]    → weapon definitions (shooter only)
[UTILS]      → pure math helpers (angleTo, dist, clamp, lerpAngle, rnd)
[PARTICLES]  → fixed-size object pool (400 slots), spawnParticle/drawParticles
[BULLET]     → createBullet factory, updateBullets, drawBullets
[ENEMY]      → createEnemy factory + stats table + per-type behavior functions
[PLAYER]     → player object, updatePlayer, drawPlayer
[GROUND ITEMS] → weapon/health pickup spawning, collection, drawing
[SPAWNER]    → wave queue, LEVEL_DEFS array, procedural level generation
[COLLISION]  → AABB checks: bullets×enemies, bullets×player, enemies×player
[GAME STATE] → game object, setState(), startGame(), nextLevel()
[HUD]        → drawHUD (health bar, score, weapon slots, crosshair)
[SCREENS]    → drawMenu, drawLevelComplete, drawGameOver
[LOOP]       → requestAnimationFrame loop, cursor management
```

## Key Patterns

**Rendering**: All drawing uses `ctx.fillRect()` for the pixel-art look. Glow effects use `ctx.shadowBlur` only on UI text, never on game entities (performance). All world positions are `Math.round()`-ed before drawing.

**Game loop**: `dt` is capped at 50ms (`Math.min(..., 0.05)`) to prevent physics tunneling when the tab is backgrounded. The loop drives both update and draw each frame.

**Input**: `keys{}` tracks held keys; `keyPressed{}` tracks single-frame keypresses (cleared at end of each frame with `Object.keys(keyPressed).forEach(k => delete keyPressed[k])`). Use `keyPressed` for actions like weapon switching, `keys` for movement.

**Entities**: Arrays (`bullets[]`, `enemies[]`, `groundItems[]`) are filtered each frame with `.splice(0, arr.length, ...arr.filter(e => e.alive))`. Set `entity.alive = false` to remove.

**Particles**: Use the fixed pool — never push to an array. Call `spawnParticle(x, y, vx, vy, life, size, color, gravity)`. Pool has 400 slots; if full, the particle is silently dropped.

**State machine**: `setState(state)` handles all setup/teardown for each state. Always use `setState()` rather than setting `game.state` directly (except for simple menu navigation where no teardown is needed).

**Weapons** (shooter.html): Defined in `WEAPONS` object. `createBullet` accepts an optional `wep` param — pass it for player bullets to get correct damage/speed/color/spread. Enemy bullets pass `null`.

## Git Workflow

**This is a strict requirement:** commit and push to GitHub after every meaningful unit of work — a new feature, a bug fix, a refactor, or any change the user would want to be able to revert to. Never leave work uncommitted at the end of a task.

```bash
git add <changed files>
git commit -m "short imperative summary

Optional longer explanation if needed."
git push
```

Commit message rules:
- Use the imperative mood: "Add X", "Fix Y", "Refactor Z" — not "Added" or "Adding"
- First line ≤ 72 characters, describes *what* changed
- If the why isn't obvious, add a blank line then a brief explanation
- Always append `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

Remote: https://github.com/DePinto-95/claude-projects
