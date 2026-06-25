# THROB — Plan of Action

Ordered by priority. Do top to bottom.

---

## 🔴 P0 — Fix Before Anything Else (both < 1hr)

### 1. GPU hint (1 line, works for all users automatically)
`client/src/core/Renderer.js`
```js
// change:
this.renderer = new THREE.WebGLRenderer({ antialias: false });
// to:
this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
```
Browser will prefer discrete GPU. You can't force it but this hint works on Chrome/Edge/Firefox for most hybrid GPU setups. No Electron needed.

### 2. Camera recoil tilt bug
`client/src/player/CameraEffects.js`

Track recoil as a separate offset, lerp it back to 0 each frame. Never add directly to `camera.rotation`.
```js
// in triggerShake / applyRecoil:
this.recoilOffset += amount;

// in update() every frame:
this.recoilOffset = THREE.MathUtils.lerp(this.recoilOffset, 0, deltaTime * 12);
camera.rotation.x = this.baseRotationX + this.recoilOffset;
```
Store `baseRotationX` whenever mouse moves (PointerLock updates it). Recoil is additive on top, always snaps back.

---

## 🟠 P1 — In-Game Atmosphere (30 min, massive visual ROI)

`client/src/world/World.js`

```js
// 1. Dark fog (cheap, won't tank FPS — it's 1 shader line)
this.scene.fog = new THREE.FogExp2(0x0a0008, 0.03);

// 2. Kill the teal hemisphere
// change HemisphereLight to:
new THREE.HemisphereLight(0x1a0010, 0x000000, 1.0);

// 3. Directional light to blood-warm
// change DirectionalLight color to:
new THREE.DirectionalLight(0xff2200, 1.8);

// 4. Pulsing heart light (add in update(), heart already has BPM logic)
if (!this.heartLight) {
    this.heartLight = new THREE.PointLight(0xff0033, 0, 20);
    this.heartLight.position.set(0, 5, 0); // adjust to heart world pos
    this.scene.add(this.heartLight);
}
const pulse = this.heartbeatPhase === 1 ? 3.5 : 1.2;
this.heartLight.intensity += (pulse - this.heartLight.intensity) * delta * 8;

// 5. Dark scene background
this.scene.background = new THREE.Color(0x0a0008);
```

---

## 🟠 P2 — Remote Player Characters + Animations

`client/src/core/Multiplayer/multiplayer_dependancy.js`

Currently remote players are invisible collision boxes. Replace with actual character GLB.

- Load the same character GLB used in menu (android.glb or whichever)
- On `spawnRemotePlayers`: load GLB, add to scene, store in `remotePlayers[id]`
- Apply censor shader to head mesh (same code as menu)
- Add `AnimationMixer` per remote player
- Play idle animation by default
- On receiving `isMoving` / `isSprinting` from STATE_UPDATE → switch animation clip
- Interpolation already works (lerps `targetPos` / `targetRot`) — just attach to the loaded model

Animation state machine (simple):
```
isMoving=false → idle clip
isMoving=true, isSprinting=false → walk clip
isSprinting=true → run clip
```
Server already sends `isMoving` and `isSprinting` in every STATE_UPDATE.

---

## 🟡 P3 — Blood + Shooting Feedback

### Blood splatter on kill
When `KILL` event received → spawn a flat `PlaneGeometry` at the dead player's position, blood texture, projected flat on floor. Fade out over 10s.

### Hit marker
When `DAMAGE` event received for any player → flash a red `+` crosshair overlay for 120ms. Just a DOM div, position center screen, toggle visibility.

### Blood particle burst on hit
In `Weapons.js` `raycastShoot()` — already calls `spawnImpactParticles`. Increase particle count and add red color for hits on enemy (`hitEnemyId` is already known).

---

## 🟡 P4 — Decals (bullet holes)

On `raycastShoot` hit → spawn a small `PlaneGeometry` (0.1 × 0.1), bullet hole texture, positioned at `target.point`, oriented to face normal (`target.face.normal`). 

Cap at 50 decals, remove oldest when exceeded. Already have the hit point and normal in `raycastShoot` — just need the mesh.

---

## 🟢 P5 — Authentication (Resume gap)

`server/` + `client/src/ui/mainMenu.js`

Simplest path: Supabase Auth (email + password). 

Server: add `/auth/login` and `/auth/signup` REST endpoints using Spring Boot `@RestController`. Call Supabase Auth API (same `HttpClient` pattern already in `SupabaseClient.java`).

Client: before `MenuScene` loads, show a login/signup screen. On success, store the username/token, pass username to the WebSocket JOIN message instead of the random UUID session ID.

This fixes the `username = session UUID` issue AND adds the auth bullet to the resume.

---

## 🟢 P6 — Map

Do this last. All the atmosphere work in P1 will make the current placeholder map look 3× better. Design the real map after you know what lighting it'll be under.

---

## Summary Table

| Priority | Task | File | Time est. |
|---|---|---|---|
| P0 | GPU hint | `Renderer.js` | 2 min |
| P0 | Camera recoil fix | `CameraEffects.js` | 30 min |
| P1 | Atmosphere (fog + lights) | `World.js` | 30 min |
| P2 | Remote player models + anims | `multiplayer_dependancy.js` | 3–4 hrs |
| P3 | Blood + hit marker | `Weapons.js`, `NetworkManger.js` | 2 hrs |
| P4 | Decals | `Weapons.js` | 1–2 hrs |
| P5 | Authentication | `SupabaseClient.java`, `mainMenu.js` | 3–4 hrs |
| P6 | Map design | Blender + GLTF | whenever |
