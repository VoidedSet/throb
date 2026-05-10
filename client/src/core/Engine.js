import { Capsule } from 'three/examples/jsm/Addons.js';
import * as THREE from 'three';
import World from '../world/World.js';
import Renderer from './Renderer.js';
import Player from '../player/Player.js';
import EnemyDummy from '../weapons/Enemies.js';
import AudioManager from './AudioManager.js';
import NetworkManger from './Multiplayer/NetworkManger.js';

import { StateManager } from './GameStates/StateManager.js';
import { WaitingState } from './GameStates/WaitingState.js';
import { GameplayState } from './GameStates/GameplayState.js';
import { MatchResults } from './GameStates/MatchResult.js';
import { HeartExploded } from './GameStates/HeartExploded.js';

export default class Engine {
    constructor(roomCode) {

        window.engine = this;

        this.gameState = {
            WAITING: 0,
            LOADOUT_SELECTION: 1,
            GAMEPLAY: 2,
            HEART_EXPLODED: 3,
            MATCH_RESULTS: 4
        };
        this.currentGameState = this.gameState.WAITING;

        this.renderer = new Renderer();
        this.scene = this.renderer.scene;
        this.camera = this.renderer.camera;

        this.mainCamera = this.renderer.camera;
        this.waitingCamera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.waitingCamera.position.set(0, 10, 20); // or wherever

        this.stateManager = new StateManager(this);

        this.lastTime = performance.now();
        this.animate = this.animate.bind(this);

        this.world = new World(this.scene);

        this.audioManager = new AudioManager();

        this.keyStates = {};
        this.collider = new Capsule(
            new THREE.Vector3(0, 14, 15),
            new THREE.Vector3(0, 15, 15),
            0.35
        );

        this.player = null;
        this.name = 'Player 1';

        // this.player = new Player(this, keyStates, collider);
        // this.scene.add(this.player.getObject());


        //   Multiplayer Mangement   //
        this.netManager = null;
        this.remotePlayers = {};
        this.roomCode = roomCode;

        if (this.roomCode != 1) {
            if (roomCode == 3 || roomCode == 4 || roomCode == 5 || roomCode == 6)
                this.playerLimit = roomCode;
            else this.playerLimit = 2;
            this.netManager = new NetworkManger(this, this.roomCode, this.playerLimit);
        }

        // if (this.currentGameState === this.gameState.WAITING)
        //     setTimeout(() => {
        //         this.stateManager.setState(GameplayState);
        //     }, 500);

        // window.addEventListener('keydown', (e) => {
        //     if (e.code === 'KeyH') {
        //         console.log("Heart is exploding");
        //         this.stateManager.setState(HeartExploded);
        //     }
        // })

    }

    start() {
        requestAnimationFrame(this.animate);
        this.enemies = [];

        if (!this.netManager)
            for (var i = 0; i < 10; i++) {
                const dummy = new EnemyDummy(new THREE.Vector3(-i, 1, 2 * i), this.scene, this.player, this.world.worldOctree);
                this.enemies.push(dummy);
            }
        // this.printSceneGraph(this.scene)
    }

    printSceneGraph(obj, indent = '') {
        const objName = obj.name || '(no name)';
        console.log(`${indent}${obj.type}: ${objName}`);
        obj.children?.forEach(child => this.printSceneGraph(child, indent + '  '));
    }


    animate(currentTime) {
        const delta = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        if (!this.world.isLoaded) { }
        this.stateManager.update(delta);

        this.renderer.render();

        this.enemies.forEach(enemy => enemy.update(delta))
        this.world?.update(delta);

        if (this.netManager) {
            this.netManager.updatePlayerState();
            this.netManager.interpolatePlayers(delta);
        }

        requestAnimationFrame(this.animate);
    }
}