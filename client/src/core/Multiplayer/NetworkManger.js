import * as THREE from 'three';
import { weapons } from "../../weapons/Weapons";
import { hideDeathScreen, removeRemotePlayers, respawnRemotePlayer, showDamage, showDeathScreen, spawnRemotePlayers, updatePlayerList } from "./multiplayer_dependancy";
import { GameplayState } from "../GameStates/GameplayState";
import { LoadoutSelectionState } from "../GameStates/LoadoutSelectionState";
import { WaitingState } from "../GameStates/WaitingState";
import { MatchResults } from "../GameStates/MatchResult";
import { HeartExploded } from "../GameStates/HeartExploded";

export let socket = null;

class LatencyWebSocket {
    constructor(url, manager) {
        this.ws = new WebSocket(url);
        this.manager = manager;
        this.sendQueue = [];
        this.recvQueue = [];

        this.ws.onopen = () => { if (this.onopen) this.onopen(); };
        this.ws.onclose = () => { if (this.onclose) this.onclose(); };
        this.ws.onerror = (err) => { if (this.onerror) this.onerror(err); };

        this.ws.onmessage = (event) => {
            if (this.onmessage) {
                if (this.manager.simulatedLatency > 0) {
                    const delay = this.manager.simulatedLatency / 2;
                    const triggerTime = performance.now() + delay;
                    this.recvQueue.push({ event, triggerTime });
                    this.processRecvQueue();
                } else {
                    this.onmessage(event);
                }
            }
        };
    }

    get readyState() {
        return this.ws.readyState;
    }

    send(data) {
        if (this.manager.simulatedLatency > 0) {
            const delay = this.manager.simulatedLatency / 2;
            const triggerTime = performance.now() + delay;
            this.sendQueue.push({ data, triggerTime });
            this.processSendQueue();
        } else {
            this.ws.send(data);
        }
    }

    processSendQueue() {
        const now = performance.now();
        while (this.sendQueue.length > 0 && this.sendQueue[0].triggerTime <= now) {
            const item = this.sendQueue.shift();
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(item.data);
            }
        }
        if (this.sendQueue.length > 0) {
            const nextDelay = Math.max(0, this.sendQueue[0].triggerTime - now);
            setTimeout(() => this.processSendQueue(), nextDelay);
        }
    }

    processRecvQueue() {
        const now = performance.now();
        while (this.recvQueue.length > 0 && this.recvQueue[0].triggerTime <= now) {
            const item = this.recvQueue.shift();
            if (this.onmessage) {
                this.onmessage(item.event);
            }
        }
        if (this.recvQueue.length > 0) {
            const nextDelay = Math.max(0, this.recvQueue[0].triggerTime - now);
            setTimeout(() => this.processRecvQueue(), nextDelay);
        }
    }

    close() {
        this.ws.close();
    }
}

export default class NetworkManger {
    constructor(engine, roomCode) {
        this.roomCode = roomCode;
        this.engine = engine;
        this.remotePlayers = engine.remotePlayers || {};
        this.camera = engine.camera;
        this.scene = engine.scene;
        this.sm = engine.stateManager;

        this.currentRoomPlayerIDs = new Set();
        this.localId = null;

        // Multiplayer prediction, reconciliation and debug settings
        this.predictionEnabled = true;
        this.simulatedLatency = 0;
        this.inputSequence = 0;
        this.pendingInputs = [];
        this.lastServerSeq = -1;
        this.lastServerPos = new THREE.Vector3();

        this.connect();
        this.setupKeyboardListeners();
    }

    setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.key.toLowerCase() === 'l') {
                this.simulatedLatency = this.simulatedLatency === 0 ? 60 : 0;
                console.log(`[NetworkManger] Simulated Latency: ${this.simulatedLatency}ms`);
                this.updateDebugOverlay();
            }
            if (e.altKey && e.key.toLowerCase() === 'p') {
                this.predictionEnabled = !this.predictionEnabled;
                console.log(`[NetworkManger] Client-Side Prediction: ${this.predictionEnabled ? 'ENABLED' : 'DISABLED'}`);
                this.updateDebugOverlay();
            }
        });
    }

    updateDebugOverlay() {
        let overlay = document.getElementById('debug-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'debug-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '10px';
            overlay.style.right = '10px';
            overlay.style.background = 'rgba(0, 0, 0, 0.85)';
            overlay.style.border = '2px solid #555';
            overlay.style.padding = '10px';
            overlay.style.fontSize = '1.1em';
            overlay.style.zIndex = '600';
            overlay.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.7)';
            overlay.style.color = '#00ff00';
            overlay.style.borderRadius = '4px';
            overlay.style.pointerEvents = 'none';
            overlay.style.lineHeight = '1.4';
            overlay.style.fontFamily = "'PixelFont', monospace";
            document.body.appendChild(overlay);
        }

        const show = (this.simulatedLatency > 0) || !this.predictionEnabled;
        overlay.style.display = show ? 'block' : 'none';

        overlay.innerHTML = `
            <div style="color: #ff00ff; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #555; padding-bottom: 2px;">MULTIPLAYER DEBUG</div>
            <div>Prediction: <span style="color: ${this.predictionEnabled ? '#00ff00' : '#ff0000'}">${this.predictionEnabled ? 'ON (Alt+P)' : 'OFF (Alt+P)'}</span></div>
            <div>Latency (RTT): <span style="color: ${this.simulatedLatency > 0 ? '#ffff00' : '#888888'}">${this.simulatedLatency}ms (Alt+L)</span></div>
            <div>Pending Inputs: <span style="color: #00ffff">${this.pendingInputs ? this.pendingInputs.length : 0}</span></div>
            <div>Last Server Seq: <span style="color: #00ffff">${this.lastServerSeq !== -1 ? this.lastServerSeq : 'N/A'}</span></div>
        `;
    }

    connect() {
        socket = new LatencyWebSocket('ws://localhost:8080/game', this);

        socket.onopen = () => {
            console.log("+[Server] Connected to Java Server");
            socket.send(JSON.stringify({ type: 'JOIN', roomCode: this.roomCode }));
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'SERVER_HELLO') {
                this.localId = data.id;
                console.log("[Server] Handshake success. My ID:", this.localId);
            }
            else if (data.type === 'STATE_UPDATE') {

                this.handleRoomStateUpdate(data);
            }
            else if (data.type === 'DAMAGE') {
                console.log(`[Server] DAMAGE! Target ${data.targetId} now has ${data.hp} HP.`);
                if (data.targetId === this.localId) {
                    showDamage(data.hp);
                }
            }
            else if (data.type === 'KILL') {
                console.log(`[Server] KILL! ${data.killerId} killed ${data.killedId}.`);

                if (this.sm.currentState instanceof GameplayState) {
                    const killer = data.killerId ? (data.killerId === this.localId ? 'You' : data.killerId.substring(0, 6)) : 'Void';
                    const killed = data.killedId === this.localId ? 'You' : data.killedId.substring(0, 6);
                    this.sm.currentState.addKillFeedEvent(killer, killed, data.weapon || 'fell');
                }

                if (data.killedId === this.localId) {
                    if (this.sm.currentState instanceof GameplayState) {
                        this.sm.currentState.showDeathMessage();
                    }

                    setTimeout(() => {
                        if (this.sm.currentState instanceof GameplayState) {
                            this.sm.currentState.hideDeathMessage();
                        }
                    }, 2500)

                    if (data.spawn && this.sm.currentState?.engine?.player) {
                        const p = this.sm.currentState.engine.player;
                        p.physics.playerCollider.start.set(data.spawn.x, data.spawn.y, data.spawn.z);
                        p.physics.playerCollider.end.set(data.spawn.x, data.spawn.y + 1.5, data.spawn.z);
                        this.camera.position.set(data.spawn.x, data.spawn.y + 1.5, data.spawn.z);
                    }
                }
                if (data.killedId !== this.localId) {
                    respawnRemotePlayer(this.scene, this.remotePlayers, data.killedId);
                }
            }
            else if (data.type === 'KICKED') {
                console.warn(`[Server] You were kicked. Reason: ${data.reason}`);
                alert(`Kicked from server: ${data.reason}`);
                socket.close();
                window.location.href = '/';
            }
        };

        socket.onclose = () => {
            console.log("-[Server] Disconnected");
        };
    }

    handleRoomStateUpdate(data) {
        const sm = this.sm;
        // 1. State Switch Logic
        if (this.currentGameState !== data.state) {
            this.currentGameState = data.state;

            switch (data.state) {
                case 0: // WAITING
                    console.log('[Room] Waiting...');
                    sm.setState(WaitingState);
                    break;
                case 1: // LOADOUT
                    console.log('[Room] Loadout...');
                    sm.setState(LoadoutSelectionState);
                    break;
                case 2: // GAMEPLAY
                    console.log('[Room] Match Start!');
                    sm.setState(GameplayState);

                    const hud = document.getElementById('player-ui');
                    if (hud) hud.style.display = 'block';

                    const localPlayer = data.players?.[this.localId];
                    if (localPlayer) {
                        this.loadOut = [localPlayer.w1 || 'fist', localPlayer.w2 || 'pistol'];
                    } else if (!this.loadOut) {
                        this.loadOut = ['fist', 'pistol'];
                    }

                    setTimeout(() => {
                        if (sm.currentState.engine.player) {
                            const p = sm.currentState.engine.player;
                            p.weaponManager.weapon_inventory = this.loadOut;

                            // Snap local player to server-assigned spawn point
                            if (localPlayer && localPlayer.pos) {
                                this.lastServerPos.set(localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z);
                                p.physics.playerCollider.start.copy(this.lastServerPos);
                                p.physics.playerCollider.end.set(this.lastServerPos.x, this.lastServerPos.y + 1.5, this.lastServerPos.z);
                                this.camera.position.set(this.lastServerPos.x, this.lastServerPos.y + 1.5, this.lastServerPos.z);
                            }

                            if (localPlayer && typeof localPlayer.ammo === 'number') {
                                p.weaponManager.ammo_left = {
                                    [this.loadOut[1]]: localPlayer.ammo,
                                    [this.loadOut[0]]: p.weaponManager.ammo_left[this.loadOut[0]] ?? 0
                                };
                            }
                            p.weaponManager.switch_weapon(localPlayer?.weapon || this.loadOut[0]);
                        }
                    }, 100);
                    break;
                case 3: // HEART_EXPLODED
                    console.log('[Room] Heart Exploded!');
                    sm.setState(HeartExploded);
                    break;
                case 4: // MATCH_RESULTS
                    console.log('[Room] Results...');
                    sm.setState(MatchResults);
                    setTimeout(() => {
                        if (sm.currentState instanceof MatchResults && this.latestPlayersData) {
                            sm.currentState.updateHUDTexture(this.latestPlayersData, this.localId);
                        }
                    }, 150);
                    break;
            }
        }

        // 2. Sync Timers & HUD
        if (data.timer !== undefined) {
            this.matchTimer = data.timer; // Store for HUD

            if (sm.currentState instanceof LoadoutSelectionState) {
                sm.currentState.countdown = data.timer;
                sm.currentState.updateHUDText(
                    sm.currentState.gunName,
                    sm.currentState.gunType,
                    sm.currentState.gunDamage,
                    true,
                    sm.currentState.loadout[0],
                    sm.currentState.loadout[1]
                );
            }
        }

        // 3. Sync Players if in Gameplay
        if (data.state === 2 && data.players) {
            this.latestPlayersData = data.players;

            this.handleStateUpdate(data.players);
            const localPlayer = data.players[this.localId];

            if (localPlayer && sm.currentState?.engine?.player) {
                const p = sm.currentState.engine.player;
                const manager = p.weaponManager;

                p.kills = localPlayer.kills || 0;
                p.deaths = localPlayer.deaths || 0;

                if (localPlayer.w1 && localPlayer.w2) {
                    manager.weapon_inventory = [localPlayer.w1, localPlayer.w2];
                }
                if (typeof localPlayer.ammo === 'number') {
                    manager.ammo_left = {
                        [manager.weapon_inventory[1] || 'pistol']: localPlayer.ammo,
                        [manager.weapon_inventory[0] || 'fist']: manager.ammo_left[manager.weapon_inventory[0] || 'fist'] ?? 0
                    };
                }
                if (typeof localPlayer.hp === 'number') {
                    sm.currentState.engine.player.health = localPlayer.hp;
                }
                if (localPlayer.weapon && manager.current_weapon !== localPlayer.weapon) {
                    manager.current_weapon = localPlayer.weapon;
                    manager.current_weapon_stats = weapons[localPlayer.weapon];
                }

                // --- Client Reconciliation & Network Correction ---
                const serverSeq = (typeof localPlayer.seq === 'number') ? localPlayer.seq : -1;

                if (serverSeq > this.lastServerSeq) {
                    this.lastServerSeq = serverSeq;

                    if (localPlayer.pos) {
                        this.lastServerPos.set(localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z);
                    }

                    if (this.predictionEnabled) {
                        // 1. Remove all acknowledged inputs
                        this.pendingInputs = this.pendingInputs.filter(i => i.seq > this.lastServerSeq);

                        // 2. Snap physics to server-authoritative position
                        if (localPlayer.pos) {
                            const height = p.physics.playerCollider.end.y - p.physics.playerCollider.start.y;
                            p.physics.playerCollider.start.copy(this.lastServerPos);
                            p.physics.playerCollider.end.set(this.lastServerPos.x, this.lastServerPos.y + height, this.lastServerPos.z);

                            // Restore velocity of the first remaining input (to preserve momentum)
                            if (this.pendingInputs.length > 0) {
                                p.physics.playerVelocity.copy(this.pendingInputs[0].velocity);
                            }
                        }

                        // 3. Re-simulate all remaining pending inputs on top of server state
                        for (const input of this.pendingInputs) {
                            p.physics.applyInput(input);
                        }
                    } else {
                        // Prediction disabled - snap visually directly to server state
                        if (localPlayer.pos) {
                            const height = p.physics.playerCollider.end.y - p.physics.playerCollider.start.y;
                            p.physics.playerCollider.start.copy(this.lastServerPos);
                            p.physics.playerCollider.end.set(this.lastServerPos.x, this.lastServerPos.y + height, this.lastServerPos.z);
                            this.camera.position.copy(p.physics.playerCollider.end);
                        }
                    }
                }

                this.updateDebugOverlay();
            }
        }
    }

    updatePlayerListUI() {
        updatePlayerList([...this.currentRoomPlayerIDs], this.localId);
    }

    handleStateUpdate(playersData) {
        const incomingIds = new Set(Object.keys(playersData));

        for (const id of incomingIds) {
            if (!this.currentRoomPlayerIDs.has(id)) {
                this.currentRoomPlayerIDs.add(id);
                spawnRemotePlayers(new THREE.Vector3(0, 1, 0), this.scene, this.remotePlayers, id);
                this.updatePlayerListUI();
            }
        }

        for (const id of this.currentRoomPlayerIDs) {
            if (!incomingIds.has(id)) {
                this.currentRoomPlayerIDs.delete(id);
                if (id !== this.localId)
                    removeRemotePlayers(this.scene, this.remotePlayers, id);
                this.updatePlayerListUI();
            }
        }

        for (const id in playersData) {
            if (id === this.localId) continue; // ignore self

            const pData = playersData[id];
            const playerObj = this.remotePlayers[id];

            if (playerObj && pData.pos) {
                const targetPos = new THREE.Vector3(pData.pos.x, pData.pos.y - 0.7, pData.pos.z);
                if (!playerObj.userData.targetPos) {
                    playerObj.position.copy(targetPos);
                    playerObj.userData.targetPos = targetPos.clone();
                } else {
                    playerObj.userData.targetPos.copy(targetPos);
                }

                if (pData.rot) {
                    if (!playerObj.userData.targetRot) {
                        playerObj.userData.targetRot = { x: pData.rot.x, y: pData.rot.y, z: pData.rot.z };
                        const head = playerObj.getObjectByName('head');
                        if (head) head.rotation.set(pData.rot.x, pData.rot.y, pData.rot.z);
                        else playerObj.rotation.set(pData.rot.x, pData.rot.y, pData.rot.z);
                    } else {
                        playerObj.userData.targetRot.x = pData.rot.x;
                        playerObj.userData.targetRot.y = pData.rot.y;
                        playerObj.userData.targetRot.z = pData.rot.z;
                    }
                }
            }
        }
    }

    interpolatePlayers(deltaTime) {
        for (const id of this.currentRoomPlayerIDs) {
            if (id === this.localId) continue;

            const playerObj = this.remotePlayers[id];
            if (playerObj && playerObj.userData.targetPos) {
                // Lerp pos
                playerObj.position.lerp(playerObj.userData.targetPos, 15 * deltaTime);

                // Lerp rot safely
                const head = playerObj.getObjectByName('head');
                if (head && playerObj.userData.targetRot) {
                    head.rotation.x += (playerObj.userData.targetRot.x - head.rotation.x) * 15 * deltaTime;
                    head.rotation.y += (playerObj.userData.targetRot.y - head.rotation.y) * 15 * deltaTime;
                    head.rotation.z += (playerObj.userData.targetRot.z - head.rotation.z) * 15 * deltaTime;
                } else if (playerObj.userData.targetRot) {
                    playerObj.rotation.x += (playerObj.userData.targetRot.x - playerObj.rotation.x) * 15 * deltaTime;
                    playerObj.rotation.y += (playerObj.userData.targetRot.y - playerObj.rotation.y) * 15 * deltaTime;
                    playerObj.rotation.z += (playerObj.userData.targetRot.z - playerObj.rotation.z) * 15 * deltaTime;
                }
            }
        }
    }

    updatePlayerState(delta) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        let isMoving = false;
        let isSprinting = false;

        const player = this.sm.currentState?.engine?.player;
        if (player) {
            const keys = player.keyStates;
            isMoving = !!(keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']);
            isSprinting = !!(isMoving && keys['ShiftLeft']);
        }

        let sendPos;
        let keysCopy = { KeyW: false, KeyA: false, KeyS: false, KeyD: false, Space: false, ShiftLeft: false };

        if (player) {
            const keys = player.keyStates;
            keysCopy = {
                KeyW: !!keys['KeyW'],
                KeyA: !!keys['KeyA'],
                KeyS: !!keys['KeyS'],
                KeyD: !!keys['KeyD'],
                Space: !!keys['Space'],
                ShiftLeft: !!keys['ShiftLeft']
            };
        }

        this.inputSequence++;

        if (player) {
            sendPos = {
                x: player.physics.playerCollider.start.x,
                y: player.physics.playerCollider.start.y,
                z: player.physics.playerCollider.start.z
            };
        } else {
            sendPos = {
                x: this.camera.position.x,
                y: this.camera.position.y - 1.5,
                z: this.camera.position.z
            };
        }

        if (this.predictionEnabled) {
            if (player) {
                const input = {
                    seq: this.inputSequence,
                    keys: keysCopy,
                    deltaTime: delta || 0.016,
                    velocity: player.physics.playerVelocity.clone(),
                    rot: {
                        x: this.camera.rotation.x,
                        y: this.camera.rotation.y,
                        z: this.camera.rotation.z
                    }
                };
                this.pendingInputs.push(input);
            }
        }

        socket.send(JSON.stringify({
            type: 'INPUT',
            seq: this.inputSequence,
            pos: sendPos,
            rot: {
                x: this.camera.rotation.x,
                y: this.camera.rotation.y,
                z: this.camera.rotation.z
            },
            isMoving: isMoving,
            isSprinting: isSprinting,
            keys: keysCopy,
            deltaTime: delta || 0.016
        }));

        this.updateDebugOverlay();
    }

    kickPlayer(targetId, reason = "Admin kicked you") {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        socket.send(JSON.stringify({
            type: 'CMD_KICK',
            targetId: targetId,
            reason: reason
        }));
    }
}