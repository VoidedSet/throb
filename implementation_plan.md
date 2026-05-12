Plan: Throb Multiplayer FPS Prototype - From Current to Playable
TL;DR
Build a smooth, server-authoritative FFA multiplayer shooter with: fixed smoothness (server tick rate optimization), spawn system, blood loss mechanic (tied to sprinting/sneaking for strategic play), complete in-game UI (HUD + kill feed + minimap), and match results. The key bottleneck you identified is the Java backend—it's likely the smoothness issue was about how position updates are being sent.

Steps (6 Phases, ~2-3 weeks estimated)
✅ Phase 1: Server Smoothness Fix ⭐ CRITICAL
Status: Completed
Depends on: Nothing | Blocks: Everything else

**Updates:**
- Smoothness fixes implemented on backend via tick rate/interpolation.
- Ammo and shooting synchronization across clients fixed.

The jerkiness you see is NOT teleporting—it's the gap between server ticks (40Hz = 25ms). Fix:

Investigate the root cause:

Current: 40Hz tick rate, absolute position updates
Compare with Node.js approach (velocity-based? higher tick rate? delta compression?)
Check if clients are interpolating between frames
Fix smoothness (best approach for Java backend):

Increase server tick rate from 40Hz → 60Hz (change scheduleAtFixedRate(..., 16, TimeUnit.MILLISECONDS))
Send velocity vectors alongside position (allow client-side prediction between ticks)
Result: Positions update every ~17ms instead of 25ms → matches your Node.js smooth experience
Test:

Two clients moving past each other at typical latency (50-100ms)
Should see zero jerkiness, smooth continuous movement
Files: Room.java (tick rate), Player.java (add velocity fields)

✅ Phase 2: Spawn System & Match Loop
Status: Completed
Depends on: Phase 1 | Blocks: Phase 5

Currently players respawn at origin (0,1,0). Implement proper spawns:

Backend:
- [DONE] Define 4-6 spawn points (hardcoded Vector3 locations for now)
- [DONE] On kill: set player position to random spawn point
- [DONE] On GAMEPLAY start: initialize all players at spawn points
- [DONE] Add match timer tracking (matchStartTime, end at 10 minutes)
- [DONE] Match loop implemented: 2 kills threshold added for match victory.
- [DONE] Void fall death check added (y < -15 kills the player).

Frontend:
- [DONE] Sync spawn point from server
- [DONE] Display match timer in HUD (MM:SS format)
- [DONE] Display current score/kills/deaths
- [DONE] Removed DOM-based death screen overlay and integrated it correctly into the Three.js/Canvas 2D HUD.

Game state:
WAITING (2+ players) → LOADOUT (20s) → GAMEPLAY (10 min or until first blood depleted / 2 kills reached) → MATCH_RESULTS
Files: Room.java (spawn logic, timer), Player.java (add currentBlood field)

✅ Phase 3: Blood Loss Mechanic
Status: Completed
Depends on: Phase 2 | Blocks: Phase 4

Replace "heart exploded" with strategic blood loss system:

Backend:
- [DONE] Consolidated Health and Blood mechanics. Health IS Blood.
- [DONE] Running/sprinting drains health/blood values. 
- [KNOWN BUG/FEATURE] Stamina drain hitting exactly 0 causes temporary "immortality". (Kept based on user feedback).
- [DONE] Ammo sync unconditionally fires logic for SHOOT and RELOAD.
- [DONE] Each player starts with 300 blood points
- [DONE] Sprinting: -5 blood/sec, Sneaking: -1 blood/sec, Idle: 0 blood/sec
- [DONE] Server infers movement state from velocity input each tick
- [DONE] Send playerBlood in STATE_UPDATE packet
- [DONE] Match ends when ANY player's blood reaches 0 (or reaches 2 kills)

Frontend:
- [DONE] Display unified Health / Blood on the UI canvas dynamically based on server state.
- [DONE] Commented out red-screen/bloom damage visual effect per user request.
- [DONE] Display blood meter (visual bar, color shifts from green → red as depletes)
- [DONE] Heart BPM scales with blood level (already partially done, just wire it)
- [DONE] Breathing rate syncs with blood

Balance:
~5-10 min match if constantly sprinting
Encourages strategic play: sneak vs rush vs timing
Files: Room.java (blood drain logic), NetworkManger.js (sync blood), GameplayState.js (display blood meter)

🟡 Phase 4: Complete In-Game HUD
Status: Partially Completed
Depends on: Phase 2, 3 | Blocks: None (parallel-able with Phase 5)

Implement full canvas-based HUD (no DOM):

HUD Layout:
- [DONE] Bottom-Right: Ammo counter, Current weapon
- [DONE] Bottom-center: Blood/heatlh meter (red bar showing remaining)
- [DONE] Center: Crosshair (an eye)
- [DONE] Bottom-left: Score, Kills, Deaths (simple scoreboard showing top3)
- [DONE] Top-center: Match timer (MM:SS)
- [PENDING] Top-right: Player count, Ping indicator
- [PENDING] Kill feed: Last 5 kills, auto-fade after 3s (format: "KillerName killed VictimName [weapon]")
- [PENDING] Minimap: 200px view in corner, players as dots (green=you, red=enemy), map bounds

Implementation:
- [DONE] Moved major HUD text (Health, Ammo, Death text) to canvas, DOM dependencies partially removed.
- [PENDING] Create explicit UIManager class for all HUD rendering
- [PENDING] Kill feed synced from server KILL packets
- [PENDING] Minimap updates every frame from remotePlayers + local position
Files: GameplayState.js (main HUD), multiplayer_dependancy.js (remove DOM, route to canvas), NetworkManger.js (sync kill feed data)

🔴 Phase 5: Match Results & Data
Status: Partially Completed
Depends on: Phase 2, 3 | Runs parallel with Phase 4

Properly end matches and display results:

Backend:
- [PENDING] When match ends: transition to MATCH_RESULTS state
- [PENDING] Broadcast final stats packet: {type: 'MATCH_RESULTS', players: [{name, kills, deaths, score}, ...], winner: playerId}
- [DONE] Calculate winner (highest score) - currently set to 2 kills for testing.

Frontend:
- [PENDING] MatchResults state receives server data
- [PENDING] Populate scoreboard (already has rendering logic, just fill with real data)
- [PENDING] Show "Win" or "Loss" phrase
- [PENDING] Add "Return to Menu" button
Data persistence (future work):

Backend: Save match stats to Supabase (post-prototype)
Tracked: player, kills, deaths, score, timestamp
Files: Room.java (broadcast results), NetworkManger.js (receive results), MatchResult.js (populate + display)

Phase 6: Polish & Bug Fixes
Depends on: All phases | Blocks: Release

Respawn delay: 2-second death screen, then spawn
Anti-cheat hardening: Validate all client inputs (no negative ammo, impossible positions)
Memory leaks: GameplayState.exit() cleanup (remove event listeners)
Weapon UI crashes: No DOM lookups, all canvas-based
Network optimization: Monitor bandwidth, consider delta compression if needed
Offline mode: Ensure single-player still works (for dev testing)
Files: GameplayState.js (exit cleanup), Room.java (input validation), multiplayer_dependancy.js (DOM removal)

Relevant Files
File	Change
server/.../Room.java	Add spawn points, blood loss, 60Hz tick, match timer, results broadcast
server/.../Player.java	Add blood level, velocity fields, username
client/.../NetworkManger.js	Handle blood/timer/results packets, sync kill feed
client/.../GameplayState.js	Implement full HUD rendering (health, ammo, kill feed, minimap)
client/.../multiplayer_dependancy.js	Remove all DOM UI, route to canvas
client/.../MatchResult.js	Populate scoreboard from server data

Verification Update
✅ Phase 1: Server and shooting synced, Smoothness improved.
🟡 Phase 2: Canvas death screen done, 2-kill win loop done, void death done. Waiting on respawn routing and timers.
🟡 Phase 3: Blood = Health unified, stamina drain done. UI synced to single vital stat.
🔴 Phase 4: Canvas rendering transitioned, but full layout pending.
🔴 Phase 5: Win threshold tested, match results UI integration pending.
🔴 Phase 6: Polish phase pending.

Original Verification
✅ Phase 1: Two clients move smoothly, no jerkiness
✅ Phase 2: Spawn points work, timer displays, score updates
✅ Phase 3: Blood depletes while sprinting, heart BPM rises, match ends at 0 blood
✅ Phase 4: Full HUD visible, kill feed shows, minimap renders
✅ Phase 5: Match results screen displays final stats
✅ Phase 6: 4 players, 5-min match, zero crashes, no memory leaks

Key Decisions
FFA mode (no teams) — simplest for prototype
Blood loss > heart explosion — strategic gameplay constraint
60Hz backend — fixes smoothness without client-side latency tricks
Canvas-only UI — cleaner, matches your architecture
Hardcoded spawn points — data-driven can follow
Supabase deferred — add after prototype is stable