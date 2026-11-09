# UniTern

**A lightweight 2D game engine, visual editor and toolchain for the web.**

UniTern is a focused alternative to heavyweight engines for small 2D games. It
ships an engine, a scene editor, a CLI and a complete demo game in one
dependency-free package. Games are plain TypeScript and HTML, and the build
output is a single self-contained file you can host anywhere.

- **Engine** — scene graph, fixed-step physics, sprites, shapes, text, cameras,
  input, audio, animation, parallax and built-in gameplay behaviours.
- **Editor** — hierarchy, schema-driven inspector, live canvas with pan/zoom,
  snapping, undo/redo, asset import, play mode and one-click HTML export.
- **CLI** — `create`, `build`, `dev`, `serve`, `editor` and `doctor`.
- **No runtime dependencies** — the engine is plain TypeScript compiled to ES
  modules; the editor and CLI are small bundler-powered tools.

Everything a game needs is embedded in its scene file, including images, so a
built game is one `.html` file with no asset folder.

## Quick start

```bash
git clone https://github.com/itriedcoding/UniTern.git
cd UniTern
npm install
npm run dev
```

Open <http://localhost:3000>. Click **Demo** in the toolbar to load the
platformer level, then **Play**.

Build the editor and engine bundles:

```bash
npm run build
```

Build the demo game:

```bash
npm run demo:build      # writes templates/platformer/dist/index.html
```

Run the tests and typecheck:

```bash
npm test
npm run typecheck
```

## Using the editor

| Action | Input |
| --- | --- |
| Select / move a node | Left click, drag |
| Pan | Middle mouse, `Space` + drag, or `Alt` + drag |
| Zoom | Mouse wheel |
| Frame selection | `F` |
| Frame scene | Start a new scene or open one |
| Add node | `+` in the Hierarchy panel |
| Duplicate | `Ctrl/Cmd + D` |
| Delete | `Delete` or `Backspace` |
| Undo / redo | `Ctrl/Cmd + Z` / `Ctrl/Cmd + Shift + Z` |
| Save scene | `Ctrl/Cmd + S` |
| Play / stop | Toolbar button, `Escape` to stop |

- The **Hierarchy** shows the node tree. The eye toggles visibility; hover for
  duplicate and delete.
- The **Inspector** is generated from component schemas, so every built-in
  component and every field is editable without custom UI code.
- The **Assets** panel imports images as data URLs. Use **Use** to assign an
  image to the selected node's Sprite.
- **Play** runs the scene in place with input, physics, animation and built-in
  behaviours.
- **Export** downloads the current scene as a single self-contained HTML game.

Scenes are saved as `.unitern.json` files; the same format is used by
`game.json` in game projects and by the CLI.

## Engine in 20 lines

```ts
import { Game, Node, BoxCollider2D, RigidBody2D, ShapeRenderer, type SceneData } from 'unitern';

const canvas = document.querySelector('canvas')!;
const scene: SceneData = {
  version: 1,
  name: 'My Game',
  settings: { background: '#0f172a', gravity: [0, 1800], fixedStep: 1 / 60 },
  assets: [],
  root: {
    id: 'root', name: 'Root', active: true, visible: true, screenSpace: false, tags: [],
    position: [0, 0], rotation: 0, scale: [1, 1], zIndex: 0, children: [], components: [],
  },
};

const game = new Game({ canvas, scene });
await game.load();
game.start();

const platform = new Node('Platform');
platform.position.set(400, 500);
platform.addComponent(new ShapeRenderer()).width = 300;
platform.addComponent(new BoxCollider2D()).size.set(300, 24);
game.world.add(platform);

const player = new Node('Player');
player.position.set(400, 300);
player.addComponent(new ShapeRenderer()).width = 32;
player.addComponent(new BoxCollider2D()).size.set(32, 32);
player.addComponent(new RigidBody2D());
game.world.add(player);
```

Scene data is plain JSON, so it can come from `game.json`, the editor export,
or an API.

## Built-in components

| Type | Purpose |
| --- | --- |
| `camera` | Zoom, rotation, follow node, smoothing, bounds, shake |
| `sprite` | Image asset, size, anchor, opacity, flipping, sprite-sheet frames |
| `shape` | Rectangles and circles with fill, stroke, radius and opacity |
| `text` | Multiline text with size, weight, alignment and colour |
| `animator` | Sprite-sheet playback with fps, looping and start frame |
| `rigidbody` | Dynamic/kinematic/static bodies, gravity scale, drag, mass |
| `box-collider` | AABB collision, triggers, layer masks |
| `circle-collider` | Circle collision, triggers, layer masks |
| `platformer-controller` | Run, jump, coyote time, jump buffering, variable jump |
| `oscillator` | Sine motion around the start position |
| `spinner` | Constant rotation |
| `parallax` | Background layers that follow the camera at a fraction |
| `collectible` | Emits `collect` and disappears on a matching trigger |
| `counter-text` | Writes event values into a sibling Text node (score HUD) |

All components are registered in a type registry, so scenes serialise and
deserialise automatically. Adding a component means declaring a schema; the
inspector and file format follow.

## Physics

- Fixed timestep, configurable per scene (`fixedStep`, default 1/60), with
  catch-up capped to avoid a spiral of death.
- Boxes and circles; boxes use axis-aligned bounds, circles use exact distance
  tests (circle–box uses closest-point).
- Position correction plus relative-velocity impulses for stable stacking and
  landing.
- Trigger overlap and collision enter/exit events on `world.events`.
- Bodies can be parented under rotated/scaled nodes; displacement is converted
  into local space.

Known limitation: rotated boxes are treated as their axis-aligned bounding box
during collision. Rotate circles are exact. Games that need OBB physics should
use a dedicated physics library.

## CLI

```bash
npm link                 # makes "unitern" available globally (after npm run build)
unitern create my-game   # platformer template by default
unitern create toy --template starter
cd my-game
unitern dev              # dev server on :5173 with auto reload
unitern build            # dist/index.html, fully self-contained
unitern serve            # serve the built game on :4173
unitern editor           # serve the built editor on :5174
unitern doctor           # verify the install
```

Builds inline the engine, the scene and every asset. The result has no external
requests and works from any static host, including `file://` (the editor itself
needs a static server because it is an ES module app).

## Project layout

```
src/                 engine source (public API exported from src/index.ts)
  core/              math, scene graph, world, serialization, registry
  render/            canvas renderer and scene traversal
  physics/           colliders, rigid bodies, solver
  input/ audio/ assets/
  components/        built-in components and behaviours
  runtime/           Game bootstrapping
editor/              visual editor (plain TypeScript + CSS)
cli/unitern.mjs      command line tool
templates/           platformer demo and starter project
tests/               vitest suite for the engine
scripts/             editor prep, scene generation, release packaging
```

## Development

```bash
npm run dev          # editor with hot reload
npm run build        # engine (ESM + types), runtime bundle, editor
npm run demo:build   # build the demo game
npm test             # 36 engine tests
npm run typecheck    # strict TypeScript
npm run release      # package every downloadable artifact into release/
```

`npm run demo:scene` regenerates the template scenes from the engine's component
schemas. It overwrites `game.json`, so do not run it after hand-editing levels.

## Releases

Every release attaches ready-to-use downloads:

- `unitern-<version>.tgz` — the npm package (engine, types, editor, CLI, templates)
- `unitern-editor-<version>.zip` — static editor build (serve the folder)
- `unitern-demo-skyward-run-<version>.html` — the playable demo, one file
- `unitern-starter-template-<version>.zip` — minimal starter project
- `unitern-<version>-source.zip` — full source at the tag
- `SHA256SUMS.txt` — checksums

`scripts/release.sh` builds them; `.github/workflows/release.yml` publishes them
when a `v*` tag is pushed.

## Scope

UniTern is deliberately small: 2D, web-first, component-driven and one-file
exports. It is not a 3D engine, does not target consoles or native desktop, and
does not ship a tilemap editor or particle system yet. Custom TypeScript scripts
run in built games; the editor's Play mode simulates the scene with the built-in
components.

## License

MIT © UniTern contributors
