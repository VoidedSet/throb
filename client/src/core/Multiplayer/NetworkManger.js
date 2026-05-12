import { MeshBasicMaterial, Vector3 } from "three";
import { weapons } from "../../weapons/Weapons";
import { hideDeathScreen, removeRemotePlayers, respawnRemotePlayer, showDamage, showDeathScreen, spawnRemotePlayers, updatePlayerList } from "./multiplayer_dependancy";
import { GameplayState } from "../GameStates/GameplayState";
import { LoadoutSelectionState } from "../GameStates/LoadoutSelectionState";
import { WaitingState } from "../GameStates/WaitingState";
import { MatchResults } from "../GameStates/MatchResult";
import { HeartExploded } from "../GameStates/HeartExploded";

export let socket = null;

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

        this.connect();
    }

    connect() {
        socket = new WebSocket('ws://localhost:8080/game');

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
                                p.physics.playerCollider.start.set(localPlayer.pos.x, localPlayer.pos.y, localPlayer.pos.z);
                                p.physics.playerCollider.end.set(localPlayer.pos.x, localPlayer.pos.y + 1.5, localPlayer.pos.z);
                                this.camera.position.set(localPlayer.pos.x, localPlayer.pos.y + 1.5, localPlayer.pos.z);
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
            }
        }
    }

    updatePlayerListUI() {
        updatePlayerList([...this.currentRoomPlayerIDs], this.localId);
    }

    updatePlayerListUI() {
        updatePlayerList([...this.currentRoomPlayerIDs], this.localId);
    }

    handleStateUpdate(playersData) {
        const incomingIds = new Set(Object.keys(playersData));

        for (const id of incomingIds) {
            if (!this.currentRoomPlayerIDs.has(id)) {
                this.currentRoomPlayerIDs.add(id);
                spawnRemotePlayers(new Vector3(0, 1, 0), this.scene, this.remotePlayers, id);
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
                playerObj.position.set(pData.pos.x, pData.pos.y - 0.7, pData.pos.z);
                if (pData.rot) {
                    const head = playerObj.getObjectByName('head');
                    if (head) {
                        head.rotation.set(pData.rot.x, pData.rot.y, pData.rot.z);
                    } else {
                        playerObj.rotation.set(pData.rot.x, pData.rot.y, pData.rot.z);
                    }
                }
            }
        }
    }

    interpolatePlayers(deltaTime) {
        // for (const id of this.currentRoomPlayerIDs) {
        //     if (id === this.localId) continue;

        //     const playerObj = this.remotePlayers[id];
        //     if (playerObj && playerObj.userData.targetPos) {
        //         // Lerp pos
        //         playerObj.position.lerp(playerObj.userData.targetPos, 15 * deltaTime);

        //         // Lerp rot safely
        //         const head = playerObj.getObjectByName('head');
        //         if (head && playerObj.userData.targetRot) {
        //             head.rotation.x += (playerObj.userData.targetRot.x - head.rotation.x) * 15 * deltaTime;
        //             head.rotation.y += (playerObj.userData.targetRot.y - head.rotation.y) * 15 * deltaTime;
        //             head.rotation.z += (playerObj.userData.targetRot.z - head.rotation.z) * 15 * deltaTime;
        //         }
        //     }
        // }
    }

    updatePlayerState() {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        let isMoving = false;
        let isSprinting = false;

        if (this.sm.currentState?.engine?.player) {
            const keys = this.sm.currentState.engine.player.keyStates;
            isMoving = !!(keys['KeyW'] || keys['KeyA'] || keys['KeyS'] || keys['KeyD']);
            isSprinting = !!(isMoving && keys['ShiftLeft']);
        }

        socket.send(JSON.stringify({
            type: 'INPUT',
            pos: {
                x: this.camera.position.x,
                y: this.camera.position.y,
                z: this.camera.position.z
            },
            rot: {
                x: this.camera.rotation.x,
                y: this.camera.rotation.y,
                z: this.camera.rotation.z
            },
            isMoving: isMoving,
            isSprinting: isSprinting
            // vel: {
            //     x: vel.x,
            //     y: vel.y,
            //     z: vel.z
            // }
        }));
    }

    //test function for kicking player from console engine.netManger.kickPlayer('target-id-here')
    kickPlayer(targetId, reason = "Admin kicked you") {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        socket.send(JSON.stringify({
            type: 'CMD_KICK',
            targetId: targetId,
            reason: reason
        }));
    }
}