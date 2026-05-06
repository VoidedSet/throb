import { MeshBasicMaterial, Vector3 } from "three";
import { hideDeathScreen, removeRemotePlayers, respawnRemotePlayer, showDamage, showDeathScreen, spawnRemotePlayers, updatePlayerList } from "./multiplayer_dependancy";
import { io } from "socket.io-client";
import { GameplayState } from "../GameStates/GameplayState";
import { LoadoutSelectionState } from "../GameStates/LoadoutSelectionState";
import { WaitingState } from "../GameStates/WaitingState";
import { MatchResults } from "../GameStates/MatchResult";
import { HeartExploded } from "../GameStates/HeartExploded";


export const socket = io('http://localhost:3000');

export default class NetworkManger {
    constructor(engine, roomCode) {
        this.roomCode = roomCode;
        this.remotePlayers = engine.remotePlayers;
        this.camera = engine.camera;
        this.scene = engine.scene;
        this.sm = engine.stateManager;

        this.initNetworkListeners(engine);

        socket.on('connect', () => {
            console.log("+[Server] Player:", socket.id);
            socket.emit('roomJoined', { roomCode: this.roomCode, playerLimit: engine.playerLimit });
        });

        if (socket.connected) {
            console.log("+[Server] Player (already connected):", socket.id);
            socket.emit('roomJoined', { roomCode: this.roomCode, playerLimit: engine.playerLimit });
        }

        this.gameState = engine.gameState;
        this.RoomState = {
            WAITING: 0,
            LOADOUT_SELECTION: 1,
            GAMEPLAY: 2,
            HEART_EXPLODED: 3,
            MATCH_RESULTS: 4
        };

        this.currentGameState = engine.currentGameState;

        this.currentRoomPlayerIDs = new Set();

    }

    initNetworkListeners(engine) {

        //  player join and leave events for rooms
        socket.on('playerJoinedRoom', (id) => {
            console.log('+[Room] Player:', id)

            this.currentRoomPlayerIDs.add(id); // track them
            spawnRemotePlayers(new Vector3(0, 1, 0), this.scene, this.remotePlayers, id);
            this.updatePlayerListUI(); // use new function
        });

        socket.on('playerLeftRoom', (id) => {
            console.log('-[Room] Player:', id);

            this.currentRoomPlayerIDs.delete(id);
            removeRemotePlayers(this.scene, this.remotePlayers, id);
            this.updatePlayerListUI();
        });

        //  initial room state for remote players
        socket.on('roomStateInit', (state, players) => {
            console.log("[Room Init] State:", state.state);
            for (const id in players) {
                this.currentRoomPlayerIDs.add(id); // track all players
                if (id === socket.id) {
                    engine.name = players[id].name;
                    continue;
                }
                console.log("[Room] Created Player:", id);
                spawnRemotePlayers(new Vector3(0, 1, 0), this.scene, this.remotePlayers, id);
            }
            this.updatePlayerListUI();
        });


        socket.on('playerUpdateEvent', ({ id, state }) => {
            const playerObj = this.remotePlayers[id];
            if (playerObj && state.pos) {
                playerObj.position.set(state.pos.x, state.pos.y - 0.7, state.pos.z);
                if (state.rot) {
                    playerObj.getObjectByName('head').rotation.set(state.rot.x, state.rot.y, state.rot.z);
                }
            }
        });

        socket.on('playerEliminated', ({ id }) => {
            if (socket.id === id) {
                showDeathScreen();
                setTimeout(() => {
                    hideDeathScreen();
                }, 2500);
            }
            else
                respawnRemotePlayer(this.scene, this.remotePlayers, id);
        })

        socket.on('playerDamaged', ({ id, health }) => {
            if (id === socket.id)
                showDamage(health);

            this.remotePlayers[id].material = new MeshBasicMaterial({ color: 0xffffff })

            setTimeout(() => {
                this.remotePlayers[id].material = new MeshBasicMaterial({ color: 0x0 })
            }, 50);
        })

        socket.on('scoreboardUpdate', (data) => {
            const scoreboardList = Object.entries(data).map(([id, playerData]) => ({
                id,
                ...playerData
            }));
            console.log("[Scoreboard]", scoreboardList);

            if (this.sm.currentState instanceof MatchResults) {
                this.sm.currentState.updateHUDTexture('loss', scoreboardList);
            }
        });


        socket.on('roomStateUpdate', (state) => {
            const sm = this.sm;

            switch (state.state) {
                case this.RoomState.WAITING:
                    console.log('[Room] Waiting for players...');
                    sm.setState(WaitingState);
                    break;

                case this.RoomState.LOADOUT_SELECTION:
                    console.log('[Room] Select your loadout!');
                    sm.setState(LoadoutSelectionState);
                    sm.currentState.updateCounter();
                    this.loadOut = sm.currentState.loadout;
                    break;

                case this.RoomState.GAMEPLAY:
                    console.log('[Room] Match Started!');
                    sm.setState(GameplayState);
                    if (!this.loadOut)
                        this.loadOut = ['fist', 'pistol'];
                    sm.currentState.engine.player.weaponManager.weapon_inventory = this.loadOut;
                    console.log(sm.currentState.engine.player.weaponManager.weapon_inventory);
                    break;

                case this.RoomState.HEART_EXPLODED:
                    console.log('[Room] The heart exploded!');
                    sm.setState(HeartExploded);
                    break;

                case this.RoomState.MATCH_RESULTS:
                    console.log('[Room] Showing match results...');
                    sm.setState(MatchResults);
                    break;

                default:
                    console.warn('[Room] Unknown state:', state.state);
            }

            this.currentGameState = state.state; // if you still need to track it separately
        });

        socket.on('serverForceDisconnect', () => {
            console.warn('[Server] Match over or terminated. Disconnecting...');

            // TODO: Force client back to main menu scene
            window.location.href = '/'; // or your actual main menu logic
        });

    }

    updatePlayerListUI() {
        updatePlayerList([...this.currentRoomPlayerIDs], socket.id);
    }

    updatePlayerState() {

        socket.emit('playerStateUpdate', {
            roomCode: this.roomCode,
            state: {
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
            }
        });
    }

}