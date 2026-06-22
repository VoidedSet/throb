# THROB — Resume Claim Audit
> Checking every bullet point in your resume description against the actual codebase.

---

## Claim 1 — Server-authoritative tick-based architecture (20 ticks/sec)

> *"Engineered a server-authoritative tick-based multiplayer architecture (20 ticks/sec) in Core Java using ExecutorService and thread-safe collections to manage concurrent match rooms and maintain consistent game state synchronization."*

### ✅ Server-authoritative — IMPLEMENTED
All game logic (hit detection, damage, kills, respawns, blood drain) lives exclusively in [`Room.java`](file:///d:/Projects/throb/server/src/main/java/com/throb/game/Room.java). Clients send raw input/position; the server decides what's valid (weapon anti-cheat at L113–128, distance/angle check at L144–162).

### ⚠️ Tick rate is ~62 ticks/sec, NOT 20 — MISMATCH
```java
// Room.java L43
gameLoop.scheduleAtFixedRate(this::tick, 0, 16, TimeUnit.MILLISECONDS);
```
`16ms` interval = **~62 ticks/sec**. The log message even says `"60 tps"` (L41).  
Your resume says **20 ticks/sec** (which would be 50ms intervals). **This is factually wrong on your resume.**

> [!WARNING]
> Fix your resume to say **~60 ticks/sec** or change the server code to 50ms intervals if you want 20 tps. Either way, currently they don't match.

### ✅ ExecutorService — IMPLEMENTED
```java
// Room.java L20
private final ScheduledExecutorService gameLoop = Executors.newSingleThreadScheduledExecutor();
```

### ✅ Thread-safe collections — IMPLEMENTED
```java
// Room.java L19
public final ConcurrentHashMap<String, Player> players = new ConcurrentHashMap<>();
// RoomManager.java L11–12
private final ConcurrentHashMap<String, Room> rooms = new ConcurrentHashMap<>();
private final ConcurrentHashMap<String, String> sessionToRoomMap = new ConcurrentHashMap<>();
```
`AtomicBoolean isRunning` (L21) also used correctly.

### ✅ Concurrent match rooms — IMPLEMENTED
`RoomManager` creates and maps rooms keyed by room code. Multiple rooms can exist simultaneously.

### ✅ Game state synchronization — IMPLEMENTED
Every tick, a `STATE_UPDATE` JSON payload is broadcast to all sessions in the room containing positions, health, kills, deaths, ammo, and a timer.

---

## Claim 2 — Real-time multiplayer over WebSockets with client-side prediction and server reconciliation

> *"Implemented real-time multiplayer synchronization over WebSockets with client-side prediction and server reconciliation, masking ~60ms of simulated network latency across 10+ concurrent clients."*

### ✅ Real-time WebSockets — IMPLEMENTED
- Server: Spring `TextWebSocketHandler` in [`GameSocketHandler.java`](file:///d:/Projects/throb/server/src/main/java/com/throb/network/GameSocketHandler.java)
- Client: Native browser `WebSocket` in [`NetworkManger.js`](file:///d:/Projects/throb/client/src/core/Multiplayer/NetworkManger.js) L28

### ❌ Client-side prediction — NOT PROPERLY IMPLEMENTED
True client-side prediction means: **the client moves the local player immediately based on input, without waiting for the server response**. Looking at the actual code:

- The client sends position to the server (`NetworkManger.js` L294–313)
- The server echoes it back in `STATE_UPDATE`
- On receive, the client sets `localPlayer.hp`, `kills`, `deaths` — but **does not re-apply local player position from the server**
- The local player's physics runs on the client independently ([`Physics.js`](file:///d:/Projects/throb/client/src/player/Physics.js)) — which IS client-side prediction in a loose sense
- But there is **no `pendingInputs` queue**, **no sequence number tracking**, and **no rollback/re-simulation loop** — the formal reconciliation pattern is absent

> [!CAUTION]
> "Client-side prediction and server reconciliation" is a specific, well-known pattern (Gabriel Gambetta's model). The code does NOT implement it. The architecture is more of a **hybrid: client runs physics locally, server validates hits and health** — which is fine but is NOT what the resume claims.

### ❌ Server reconciliation — NOT IMPLEMENTED
Reconciliation = when you get a server state, replay your pending unacknowledged inputs on top of it to correct divergence. There is no such logic anywhere in the client code. `NetworkManger.js` overwrites HP from server but never corrects position.

### ❌ ~60ms simulated network latency — NOT IN CODE
This was the biggest thing I looked for. There is **no `Thread.sleep(60)`**, no artificial delay anywhere in the server or client. The resume implies you deliberately introduced a 60ms artificial delay to test prediction/reconciliation. This does not exist in the codebase.

> [!CAUTION]
> This is the riskiest resume claim. If an interviewer asks you to walk through the reconciliation loop or explain *where* the 60ms delay is added, you won't be able to show it. Consider either implementing it or softening the language.

### ❌ 10+ concurrent clients — Unverifiable / Likely False
The server is hardcoded:
```java
// Room.java L25
private int playerLimit = 2;
```
Each room only allows **2 players**. While multiple rooms can theoretically run simultaneously (no server-wide cap), each room is limited to 2. "10+ concurrent clients" needs clarification — does this mean 5+ rooms of 2? The claim as worded implies a single match with 10+ players, which the code explicitly prevents.

> [!WARNING]
> Either raise the player limit and test it, or change the resume wording to something like "multiple concurrent match rooms" instead.

---

## Claim 3 — RESTful APIs + Supabase-backed persistence (auth, player stats, leaderboard)

> *"Built RESTful APIs and integrated Supabase-backed persistence for authentication, player statistics, and leaderboard systems using Spring Boot."*

### ⚠️ RESTful APIs — TECHNICALLY PRESENT, BUT VERY THIN
`pom.xml` includes `spring-boot-starter-webmvc` which enables REST, and Spring Boot's actuator is also present. However, **no `@RestController` was found in the codebase** — the only HTTP calls are outbound (Java → Supabase). There is no REST API that a client could call. 

> [!WARNING]
> "Built RESTful APIs" implies you exposed HTTP endpoints. You didn't — you just made HTTP requests *from* the server *to* Supabase. This is misleading. Safer wording: *"integrated Supabase via HTTP REST calls from Spring Boot"*.

### ✅ Supabase persistence — IMPLEMENTED (partially)
[`SupabaseClient.java`](file:///d:/Projects/throb/server/src/main/java/com/throb/network/SupabaseClient.java) sends a `POST` to Supabase's REST API at match end, saving kills/deaths/score/winner per player. It uses Java's built-in `HttpClient` with async `sendAsync`.

### ✅ Player statistics — IMPLEMENTED
Stats (kills, deaths, score, is_winner) are saved to the `match_results` table. A SQL trigger in [`SCHEMA.SQL`](file:///d:/Projects/throb/supabase/SCHEMA.SQL) automatically updates `players` aggregate totals on every insert. This is solid.

### ❌ Authentication — NOT IMPLEMENTED
There is no login, no JWT verification, no Supabase Auth flow anywhere in the codebase. Players are identified only by their WebSocket session ID (a UUID). The `players` table uses `username TEXT PRIMARY KEY` but usernames are just session IDs (`p.id` = session ID, per L41 of `SupabaseClient.java`).

> [!CAUTION]
> Do NOT claim "authentication" in the resume. Nothing authenticates users. Remove this or implement it.

### ⚠️ Leaderboard — SCHEMA EXISTS, NO QUERY
The DB schema supports leaderboarding (`players` table with `total_kills`, `total_wins`, etc.), and the SQL trigger aggregates correctly. But there is no code that *reads* a leaderboard and returns it — no REST endpoint, no WebSocket query, nothing. The `SupabaseClient` only has `saveMatchResults`.

> [!WARNING]
> You can truthfully say "designed the schema for a leaderboard system" but not "implemented a leaderboard system."

---

## Lore Implementation Check

| Lore Feature | Status |
|---|---|
| Heart beat mechanic (heart in other hand) | ❌ Not implemented |
| Blood drain while running/sprinting | ✅ Implemented in `Room.java` tick loop (L326–357) |
| Blood loss → idle=less, sprint=more | ✅ Implemented (`5/60` per tick sprinting, `1/60` walking) |
| Monster heart fills as players lose blood | ❌ Commented out (`// private int bloodGauge` L28) |
| Heart explodes → boss spawns | ❌ `HEART_EXPLOADED` state exists in enum and is handled in `NetworkManger.js` (case 3), but server never sets this state |
| Finger pose = different guns | ❌ Not implemented — weapons are text-string based (pistol, shotgun, etc.) |
| Monsters vs Players mode | ❌ Not implemented |
| AI goon monsters | ❌ Not implemented |
| Infection mechanic | ❌ Not implemented |

The blood drain / sprint mechanic is the one lore element that actually made it in and it's clean.

---

## Overall Summary

| Resume Claim | Verdict |
|---|---|
| Server-authoritative architecture | ✅ Solid |
| Tick-based (20 tps) | ⚠️ Wrong number — it's ~62 tps |
| ExecutorService | ✅ Solid |
| Thread-safe collections | ✅ Solid |
| Concurrent match rooms | ✅ Works |
| WebSocket multiplayer | ✅ Solid |
| Client-side prediction | ❌ Not implemented (pattern is absent) |
| Server reconciliation | ❌ Not implemented |
| ~60ms simulated latency | ❌ Doesn't exist in code |
| 10+ concurrent clients | ⚠️ Per-room limit is 2 |
| Spring Boot | ✅ Yes |
| RESTful APIs | ⚠️ Misleading — you call Supabase's REST API, not expose your own |
| Supabase persistence | ✅ Match results saving works |
| Authentication | ❌ Not implemented |
| Player statistics | ✅ Works via trigger |
| Leaderboard | ⚠️ Schema only, no read API |

---

## Recommended Resume Rewrites

**Original Bullet 2 (Risky):**
> Implemented real-time multiplayer synchronization over WebSockets with client-side prediction and server reconciliation, masking ~60ms of simulated network latency across 10+ concurrent clients.

**Safer version:**
> Implemented real-time multiplayer synchronization over WebSockets, with server-authoritative hit validation (distance + angle checks) and client-side physics running independently of server state to maintain responsive gameplay across concurrent clients.

**Original Bullet 3 (Misleading):**
> Built RESTful APIs and integrated Supabase-backed persistence for authentication, player statistics, and leaderboard systems using Spring Boot.

**Safer version:**
> Integrated Supabase-backed persistence via async HTTP calls from Spring Boot, saving match results and aggregating player statistics (kills, deaths, win rate) using SQL triggers on match completion.

**Original Bullet 1 (Minor fix needed):**
> server-authoritative tick-based multiplayer architecture (20 ticks/sec)

**Fix:** Change `20 ticks/sec` to `~60 ticks/sec` (or change your code to 50ms intervals for 20 tps).
