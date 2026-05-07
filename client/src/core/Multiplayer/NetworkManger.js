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
                console.log("[Server] Handshake success");
            }
            else if (data.type === 'STATE_UPDATE') {
                this.handleStateUpdate(data.players);
            }
        };

        socket.onclose = () => {
            console.log("-[Server] Disconnected");
        };
    }

    handleStateUpdate(playersData) {
        // Find local ID if not set (temporary hack until we send it explicitely in JOIN ack)
        if (!this.localId) {
            // First update, just pick the first key or wait for better auth
            // We will fix exact ID matching next.
        }

        const incomingIds = new Set(Object.keys(playersData));

        // 1. Spawn new players
        for (const id of incomingIds) {
            if (!this.currentRoomPlayerIDs.has(id)) {
                this.currentRoomPlayerIDs.add(id);
                console.log('+ [Room] Player joined:', id);
                // Don't spawn self
                // spawnRemotePlayers(new Vector3(0, 1, 0), this.scene, this.remotePlayers, id);
                this.updatePlayerListUI();
            }
        }

        // 2. Remove disconnected players
        for (const id of this.currentRoomPlayerIDs) {
            if (!incomingIds.has(id)) {
                this.currentRoomPlayerIDs.delete(id);
                console.log('- [Room] Player left:', id);
                removeRemotePlayers(this.scene, this.remotePlayers, id);
                this.updatePlayerListUI();
            }
        }

        // 3. Update positions
        for (const id in playersData) {
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

    updatePlayerListUI() {
        updatePlayerList([...this.currentRoomPlayerIDs], this.localId);
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