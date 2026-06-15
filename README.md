# Gorest 2D Animation Spritesheet Generator

A local browser workspace for building side-scrolling 2D game scenes, importing or generating spritesheets, previewing animation clips, and organizing reusable scene assets.

The app is designed for fast visual iteration: open a scene, place the character and props, inspect every spritesheet used in that scene, tune metadata, preview movement, and save the finished setup.

## Codex-Assisted Animation Agent

The core idea is to vibe-code a no-manual-pipeline 2D animation agent without relying on a video generation model.

Instead of manually operating a traditional animation stack, you can prompt Codex, upload a reference image, and let Codex call the local agent to produce a game-ready 2D spritesheet. The app then plays the animation directly from that spritesheet in a live preview, so the result can be checked immediately and used in a game engine.

The workflow is broader than character animation:

- Codex can generate or import spritesheets.
- Codex can place animated sprites onto a background like a scene-compositing tool.
- Codex can configure layers, metadata, trigger settings, scene state, and preview behavior.
- Codex can revise the product framework itself while the tool evolves.
- The browser becomes the visual result surface, while Codex handles setup, editing, and iteration.

This is meant to reduce or skip the manual Spine-style workflow for early game prototyping: prompt, generate, composite, preview, adjust, and save.

## What You Can Do

- Create and save multiple scenes.
- Place backgrounds, characters, props, UI elements, and animated sprites as editable layers.
- Drag, resize, scale, reorder, hide, and show scene layers.
- Preview a playable side-scroller scene with character movement.
- Import or generate 12-frame and 16-frame spritesheets.
- Generate spritesheets with the local procedural engine, Nano Banana 2, or GPT Image 2.
- Composite animated sprites directly onto scene backgrounds.
- Open the `Spritesheets` page to see every animation clip used by the current scene.
- Edit spritesheet metadata such as asset role, clip name, trigger type, game state, direction, loop mode, and tags.
- Let Codex configure scenes, layers, assets, and animation metadata from prompts.
- Let Codex modify the tool's product framework as the workflow changes.
- Save reusable assets and scenes into the local game asset library.

## Quick Start

### 1. Install Node.js

Install Node.js 20 or newer from [nodejs.org](https://nodejs.org/).

### 2. Clone the Repository

```bash
git clone https://github.com/NO6KIKO/gorest-2d-animation-spritesheet-generator.git
cd gorest-2d-animation-spritesheet-generator
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Optional Environment File

The local workflow does not require an API key. If you enable cloud image generation, copy the example env file and add your own key:

```bash
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Never commit `.env.local`. It is ignored by Git.

Cloud spritesheet generation runs on the local server, so API keys stay out of the browser bundle:

```bash
EVOLINK_API_KEY="your-evolink-api-key"
```

The `Generate Spritesheet` panel can use:

- `Local procedural`: no API key required.
- `Nano Banana 2`: uses EvoLink `gemini-3.1-flash-image-preview`.
- `GPT Image 2`: uses EvoLink `gpt-image-2`.

Generated cloud images are downloaded into `public/generated/` and then sliced into frames by the app, so saved assets do not depend on temporary provider image URLs.

### 5. Run the App

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port `3000` is already in use, run it on another port:

```bash
PORT=3001 npm run dev
```

On Windows PowerShell:

```powershell
$env:PORT=3001
npm run dev
```

Then open `http://localhost:3001`.

## Creator Workflow

This project is organized around a game-scene authoring workflow rather than a single character animation tool. A typical production pass looks like this:

1. Start from the `Scenes` tab.
   Create a new scene, duplicate an existing one, delete test scenes, or open a saved scene from the scene library.

2. Build the scene base in the `Scene` tab.
   Add a background first, then place the player character, props, UI objects, foreground objects, animated props, and effects as separate editable layers.

3. Arrange layers like a 2D composition.
   Drag objects on the canvas, resize them with handles, adjust scale, and use the layer list to decide what appears above or below other objects.

4. Keep animation assets reusable.
   Save finished characters, props, UI elements, and effects into the local asset library so the same asset can be inserted into future scenes.

5. Inspect all animation clips in `Spritesheets`.
   The `Spritesheets` page lists every spritesheet used in the current scene, not just the main character. Use it to preview, locate, download, and edit each animation clip.

6. Tune each clip as game data.
   Each spritesheet can carry metadata such as action name, direction, loop mode, trigger type, trigger value, game state, and tags. This makes the visual asset reusable as gameplay data later.

7. Preview the scene in `Action`.
   Use the playable preview to check character movement, animation timing, layer order, lighting, scale, and scene composition.

8. Save the completed scene.
   Save the scene once the background, character, props, spritesheets, and metadata feel correct.

## Spritesheet Authoring Rules

For stable 2D game animation, spritesheets should be treated as one complete animation sheet first, then split into frames. This avoids the common problem where individually generated frames change size, drift, or lose visual consistency.

Recommended rules:

- Generate or import a full spritesheet whenever possible, then split it into frames.
- Keep every frame the same pixel size.
- Keep the character or prop centered in a consistent frame box.
- Preserve the original character proportions from the reference image.
- Keep the feet or base anchor stable so the object does not slide around during playback.
- Use small, close frame-to-frame changes for idle and breathing animations.
- Use one clean walk cycle per sheet, then loop it in playback instead of repeating the same step too many times inside the sheet.
- For side-scrollers, create separate clips for `idle`, `walk_right`, `walk_left`, and any special action.
- Store direction, loop, trigger, and game-state metadata on the clip so it can be reused by scene logic.

## Interaction Design Model

Interactive scenes are easiest to manage when interaction behavior is separated from visual layers. The recommended structure is:

- Interaction zone: a draggable and resizable area that decides where the player can interact.
- Trigger condition: proximity, mouse click, keyboard input, inventory requirement, or scene-state requirement.
- Action: show text, play an animation, hide or show a layer, give an item, switch scenes, or update game state.
- State: a small key-value table such as `has_key`, `radio_on`, `door_open`, or `visited_bedroom`.

Useful presets for future scene building:

- `Inspect`: show an eye prompt near an object, then display text when clicked.
- `Pickup`: collect an item and hide the scene object.
- `Toggle`: switch a layer, animation, or state on and off.
- `Door / Scene Link`: move from one scene to another.
- `Animated Prop`: play or loop a prop animation.
- `Conditional`: choose different results based on scene state or inventory.

## Scene Framing

The editor supports a scene-size mindset instead of only a single image-size mindset. Use this when designing for different targets:

- Set the full scene width and height for long side-scrolling spaces.
- Set the viewport frame separately for desktop, tablet, or phone-style previews.
- Position the background inside the viewport to test what the player sees first.
- Keep gameplay objects in world coordinates so the player can move through a larger scene.
- Use foreground and background layers to create depth while keeping the game readable.

## Spritesheet Page

The `Spritesheets` page is a scene-level animation library. It lists each spritesheet clip currently attached to scene layers, including character animations, animated props, UI animations, and imported assets.

Each card supports:

- `Preview`: play that clip in the frame preview.
- `Locate Layer`: jump back to the scene editor with the matching layer selected.
- `PNG`: download the underlying spritesheet image when available.
- `Edit`: change metadata for reusable confirmed assets.

Built-in scene kit assets can be previewed and layered. Persistent metadata editing is available for confirmed user assets.

## Game Asset Library

Saved assets and scenes are stored locally under:

```text
public/generated/game_asset_library.json
```

Generated or imported PNG files are also stored in:

```text
public/generated/
```

This makes the project easy to keep as a self-contained prototype. If you add large generated assets, review them before committing.

## Available Scripts

```bash
npm run dev
```

Starts the local Express and Vite development server.

```bash
npm run build
```

Builds the frontend and bundles the server into `dist/`.

```bash
npm run start
```

Runs the production build from `dist/`.

```bash
npm run lint
```

Runs TypeScript checks without emitting files.

## Project Structure

```text
src/
  App.tsx          Main editor UI and scene/spritesheet workflow
  types.ts        Shared scene, asset, animation, and interaction types
  index.css       App styling

server.ts         Express API, Vite middleware, local spritesheet endpoints
public/generated/ Generated PNG assets and local game library data
```

## License

Gorest 2D Animation Spritesheet Generator is open source under the [MIT License](LICENSE).

## Notes

- The app is local-first. Most editing and preview work happens without a cloud API.
- `.env.local` is ignored so private keys are not pushed to GitHub.
- The scene editor is built for side-scrolling 2D game prototyping, with reusable layers, spritesheets, and scene states as the core model.
