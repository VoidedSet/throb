Plan: Throb Multiplayer FPS Prototype - From Current to Playable
TL;DR
Build a smooth, server-authoritative FFA multiplayer shooter with: fixed smoothness (server tick rate optimization), spawn system, blood loss mechanic (tied to sprinting/sneaking for strategic play), complete in-game UI (HUD + kill feed + minimap), and match results. The key bottleneck you identified is the Java backend—it's likely the smoothness issue was about how position updates are being sent.

Steps (6 Phases, ~2-3 weeks estimated)
Phase 1: Server Smoothness Fix ⭐ CRITICAL
Depends on: Nothing | Blocks: Everything else

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

Phase 2: Spawn System & Match Loop
Depends on: Phase 1 | Blocks: Phase 5

Currently players respawn at origin (0,1,0). Implement proper spawns:

Backend:

Define 4-6 spawn points (hardcoded Vector3 locations for now)
On kill: set player position to random spawn point
On GAMEPLAY start: initialize all players at spawn points
Add match timer tracking (matchStartTime, end at 10 minutes)
Frontend:

Sync spawn point from server
Display match timer in HUD (MM:SS format)
Display current score/kills/deaths
Game state:

WAITING (2+ players) → LOADOUT (20s) → GAMEPLAY (10 min or until first blood depleted) → MATCH_RESULTS
Files: Room.java (spawn logic, timer), Player.java (add currentBlood field)

Phase 3: Blood Loss Mechanic
Depends on: Phase 2 | Blocks: Phase 4

Replace "heart exploded" with strategic blood loss system:

Backend:

Each player starts with 300 blood points
Sprinting: -5 blood/sec, Sneaking: -1 blood/sec, Idle: 0 blood/sec
Server infers movement state from velocity input each tick
Send playerBlood in STATE_UPDATE packet
Match ends when ANY player's blood reaches 0
Frontend:

Display blood meter (visual bar, color shifts from green → red as depletes)
Heart BPM scales with blood level (already partially done, just wire it)
Breathing rate syncs with blood
Balance:

~5-10 min match if constantly sprinting
Encourages strategic play: sneak vs rush vs timing
Files: Room.java (blood drain logic), NetworkManger.js (sync blood), GameplayState.js (display blood meter)

Phase 4: Complete In-Game HUD
Depends on: Phase 2, 3 | Blocks: None (parallel-able with Phase 5)

Implement full canvas-based HUD (no DOM):

HUD Layout:

Bottom-left: Health bar + number, Ammo counter, Current weapon
Bottom-center: Blood meter (red bar showing remaining)
Center: Crosshair (white dot)
Top-left: Score, Kills, Deaths
Top-center: Match timer (MM:SS)
Top-right: Player count, Ping indicator
Kill feed: Last 5 kills, auto-fade after 3s (format: "KillerName killed VictimName [weapon]")
Minimap: 200px view in corner, players as dots (green=you, red=enemy), map bounds
Implementation:

Create UIManager class for all HUD rendering
Move all rendering to canvas (no DOM elements)
Kill feed synced from server KILL packets
Minimap updates every frame from remotePlayers + local position
Files: GameplayState.js (main HUD), multiplayer_dependancy.js (remove DOM, route to canvas), NetworkManger.js (sync kill feed data)

Phase 5: Match Results & Data
Depends on: Phase 2, 3 | Runs parallel with Phase 4

Properly end matches and display results:

Backend:

When match ends: transition to MATCH_RESULTS state
Broadcast final stats packet: {type: 'MATCH_RESULTS', players: [{name, kills, deaths, score}, ...], winner: playerId}
Calculate winner (highest score) or tie
Frontend:

MatchResults state receives server data
Populate scoreboard (already has rendering logic, just fill with real data)
Show "Win" or "Loss" phrase
Add "Return to Menu" button
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
Verification
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