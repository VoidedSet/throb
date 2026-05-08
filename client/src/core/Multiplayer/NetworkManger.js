import { MeshBasicMaterial, Vector3 } from "three";
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
                    if (!this.loadOut) this.loadOut = ['fist', 'pistol'];

                    // Give weapons after a tiny delay so player object finishes loading
                    setTimeout(() => {
                        if (sm.currentState.engine.player) {
                            sm.currentState.engine.player.weaponManager.weapon_inventory = this.loadOut;
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
                    break;
            }
        }

        // 2. Sync Timers & HUD
        if (data.timer !== undefined) {
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
            this.handleStateUpdate(data.players);
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
            if (id === this.localId) continue; // Ignore own server pos

            const pData = playersData[id];
            const playerObj = this.remotePlayers[id];

            if (playerObj && pData.pos) {
                playerObj.position.set(pData.pos.x, pData.pos.y - 0.7, pData.pos.z);
                if (pData.rot) {
                    playerObj.getObjectByName('head').rotation.set(pData.rot.x, pData.rot.y, pData.rot.z);
                }
            }
        }
    }

    updatePlayerState() {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

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
            }
        }));
    }
}