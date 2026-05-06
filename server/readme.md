Java backend for THROB

Must-have features:

- Multiplayer infrastructure
	- WebSocket networking for realtime movement, combat, and event broadcasts
- Server-authoritative architecture
	- Server controls positions, HP, blood level, kills, projectiles, and game events
- Tick-based simulation
	- Target around 20 ticks/sec for movement, blood drain, combat, monster AI, and events
- Match room system
	- Isolated rooms, room manager, player sessions, and concurrent matches
- Concurrent room handling
	- Use `ExecutorService`, `ConcurrentHashMap`, and scheduled executors
- Player synchronization
	- Sync positions, rotation, animation state, HP, and blood level
- Client prediction and reconciliation
	- Keep the client responsive while the server resolves the final state
- Shooting and hit detection
	- Server validates shots, hits, and damage
- Blood system
	- Moving increases BPM, BPM drains blood faster, idle slows BPM, and healing restores blood
- PostgreSQL or Supabase persistence
	- Store users, stats, kills, match history, and leaderboard data
- REST APIs
	- Login, signup, stats, and leaderboard endpoints
