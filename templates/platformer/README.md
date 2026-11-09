# Skyward Run

A complete platformer demo built with UniTern. It uses only engine components:
no custom movement code.

**Controls:** `A`/`D` or arrow keys to run, `Space` (or `W`/`Up`) to jump.
Collect all 14 coins to finish. Press `R` on the completion screen to replay.

## Files

- `game.json` — the whole level. Open it in the UniTern editor.
- `src/main.ts` — boots the game, shows the completion screen and respawns the
  player if they leave the level.

## Commands

```bash
unitern dev      # local dev server with auto reload
unitern build    # dist/index.html, one self-contained file
```

The player uses `PlatformerController` + `BoxCollider2D` + `RigidBody2D`.
Coins use a `CircleCollider2D` trigger, `Collectible` and `Oscillator`.
The HUD is a screen-space node with `Text` and `CounterText`.
