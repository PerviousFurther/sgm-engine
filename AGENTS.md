### Code & Memory Guidelines

- **Context Retention**: Append project-specific notes and instructions directly to `AGENTS.md` rather than writing to global memory.
- **Incremental Editing**: Favor targeted modifications over complete file rewrites. Overwrite files only when existing paradigms or concepts are fundamentally incompatible.
- **Minimize Churn**: Avoid bloat or low-quality code that creates excessive code churn or unnecessary cascading changes across the repository.
- **Test**: Do not writing test unless user requested.


### Project Architecture Notes

- `LevelDefinition` is a complete playable level; `LevelStage` is a conditional state node inside that level. Do not use the two terms interchangeably.
- Stage nodes form a branch graph through level variables and typed transitions. Do not add fades between nodes in the same level.
- `GameProjectDefinition` owns a typed scene flow. Title, selection, loading, gameplay, result, ending, and credits are independent `SceneDefinition` entries; never model them as stages or canvas overlays.
- Enemy-owned patterns must stop when their owner is destroyed. Dialogue pauses combat and uses the shoot action for hold-to-skip.
- PNG grid animations use `SpriteSheetDefinition`; player animations live on characters, while enemy idle/action animations live on enemy timeline events.

### Implemented Runtime Notes

- The project uses Vite, React, TypeScript, and a framework-independent Canvas 2D runtime. Keep `src/core` free of React dependencies.
- `game.html` and `editor.html` are separate Vite entries, exposed through `pnpm dev:game` and `pnpm dev:editor`.
- The editor persists the complete `GameProjectDefinition` under the `mistbound-fantasia-project` localStorage key; the game loads that saved script on startup and falls back to `src/data/demoProject.ts`.
- Bullet patterns are compositions of an emitter, a motion model, and a visual style. Add new models to the discriminated union in `src/core/types.ts`, the integrator in `BulletEngine`, and the visual controls together.
- Runtime art and audio are served from the repository `asset` directory through Vite's `publicDir` setting.
- `AudioManager` owns all runtime audio through the Web Audio API. Keep image loading in `AssetStore`; do not reintroduce `HTMLAudioElement` playback into the game runtime.
- Audio is mixed through master, music, SFX, and voice buses. Gameplay code should request semantic audio cues instead of hard-coding asset IDs.
- Scene BGM belongs to `SceneDefinition.audio`; stage transitions inside one level must not restart or fade the current BGM. Timeline music events are reserved for intentional in-level changes.
- Audio asset markers can emit script events, set level variables, or request scene changes. Marker timing is driven by `AudioManager`, so it remains active outside the gameplay frame loop.
- High-frequency bullets and player shots are recycled through `ObjectPool`. Removal and clear paths must return them through their engine/runtime helpers instead of truncating or splicing the active arrays directly.
