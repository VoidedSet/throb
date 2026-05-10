import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import PlayerPhysics from './Physics';
import CameraEffects from './CameraEffects';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

import * as THREE from 'three';
import AnimPlayer from '../core/AnimPlayer';
import WeaponManager from '../weapons/Weapons';

export default class Player {
    constructor(engine, keyStates, collider) {
        this.camera = engine.camera;
        this.controls = new PointerLockControls(this.camera, document.body);
        this.keyStates = keyStates;
        this.collider = collider;
        this.hand = new THREE.Mesh();
        this.hand2 = new THREE.Mesh();
        this.heart = new THREE.Mesh();

        //  PLAYER VITALS VARIABLES  //
        this.currentBPM = 40;
        this.lastStateChangeTime = 0;
        this.lastBPM = 40;
        this.lastBeatTime = 0;
        this.heartbeatPhase = 0; // 0 = lub, 1 = dub, 2 = wait
        this.lastHeartbeatSubTime = 0;
        this.lubDubInterval = 200; // ms between lub and dub
        this.beatInterval = 1500; // ms (full cycle)
        this.heartbeatSource = null;
        this.breathRate = 0.3;
        this.health = 100;

        this.cameraEffects = new CameraEffects(this.camera);
        this.physics = new PlayerPhysics(this.collider, engine.world.worldOctree, this.camera, this.keyStates, this.cameraEffects);
        this.weaponManager = new WeaponManager(this, engine.scene, engine.renderer.bloomPass)
        this.audioManager = engine.audioManager;

        this.loadBody();
        this.loadAudio();

        document.body.addEventListener('click', () => {
            this.controls.lock();
            // document.getElementById('blocked').style.display = 'none'
        });

        this.bindKeys();
    }

    loadBody() {
        const loader = new GLTFLoader();

        loader.load('src/art/models/hand_poses.glb', (gltf) => {
            this.hand = gltf.scene.children[0];
            this.hand.rotation.set(0, 3.3, 1.5);
            this.hand.position.set(0.8, -0.5, -0.1);
            this.hand.scale.set(0.09, 0.09, 0.09);
            this.controls.object.add(this.hand);
            this.hand_anim = new AnimPlayer(this.hand, gltf.animations);

            if (this.weaponManager && this.weaponManager.current_weapon_stats) {
                this.hand_anim.play(this.weaponManager.current_weapon_stats.anim);
            }
        });

        loader.load('src/art/models/hand2.glb', (gltf) => {
            this.hand2 = gltf.scene.children[0];
            this.hand2.rotation.set(0.4, -0.3, -1.7);
            this.hand2.position.set(-0.7, -0.5, -1);
            this.controls.object.add(this.hand2);
        });

        loader.load('src/art/models/heart_explode.gltf', (gltf) => {
            this.heart = gltf.scene.getObjectByName('Heart2');
            this.heart.scale.set(23, 23, 23);
            this.heart.rotation.set(0.5, 0, -1.0);
            this.hand2.add(this.heart);
            this.heart.position.set(-15, -20, -10);
            this.heart_anim = new AnimPlayer(this.heart, gltf.animations)
        });
    }

    async loadAudio() {
        await this.audioManager.load('heartbeat_lub', 'src/art/audio/heartbeat_lub.wav', .7);
        await this.audioManager.load('heartbeat_dub', 'src/art/audio/heartbeat_dub.wav', .7);
        await this.audioManager.load('pistol', 'src/art/audio/pistol.wav', 1.0)
        await this.audioManager.load('pistol_reload', 'src/art/audio/pistol_reload.wav', 1.0)
        await this.audioManager.load('shotgun', 'src/art/audio/shotgun.wav', 1.0)
        await this.audioManager.load('shotgun_reload', 'src/art/audio/shotgun_reload.wav', 1.0)

        await this.audioManager.load('smg', 'src/art/audio/smg.wav', 1.0)
        await this.audioManager.load('smg_loop', 'src/art/audio/smg_loop.wav', 1.0)
        await this.audioManager.load('smg_reload', 'src/art/audio/smg_reload.wav', 1.0)
        await this.audioManager.load('sniper', 'src/art/audio/sniper.wav', 1.0)
        await this.audioManager.load('sniper_reload', 'src/art/audio/sniper_reload.wav', 1.0)

        await this.audioManager.load('breath1', 'src/art/audio/male-breathing-1.wav', 0.8)
        await this.audioManager.load('breath2', 'src/art/audio/male-breathing-2.wav')
        this.audioManager.play('breath1', { loop: true, rate: this.breathRate })
    }

    bindKeys() {
        document.addEventListener('keydown', (event) => {
            this.keyStates[event.code] = true;
            if (this.keyStates['KeyR'])
                this.weaponManager.reload()

            if (this.keyStates['KeyQ']) {
                console.log(this.controls.object.rotation, this.camera.rotation)
                this.camera.rotation.set(this.controls.object.rotation.x, this.controls.object.rotation.y, this.controls.object.rotation.z)
            }
        });

        document.addEventListener('keyup', (event) => {
            this.keyStates[event.code] = false;
        });

        window.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                const type = this.weaponManager.current_weapon_stats.type;
                if (type === "auto") {
                    this.weaponManager.startFiring();
                } else {
                    this.weaponManager.fire();
                }
            }
        });

        window.addEventListener("mouseup", (e) => {
            if (e.button === 0) {
                this.weaponManager.stopFiring();
            }
        });

        window.addEventListener('wheel', (e) => {
            const direction = e.deltaY > 0 ? 1 : -1;
            this.weaponManager.cycle_weapon(direction);
        });


    }

    updatePlayerVitals(deltaTime, targetBPM) {
        const now = performance.now();

        const delay = 3000;
        if (targetBPM !== this.lastBPM && (now - this.lastStateChangeTime > delay)) {
            this.lastBPM = targetBPM;
            this.lastStateChangeTime = now;
        }

        // --- LUB-DUB logic ---
        this.beatInterval = (60 / this.lastBPM) * 1000; // full cycle duration
        const lubTime = this.lastBeatTime;
        const dubTime = this.lastBeatTime + this.lubDubInterval;

        if (this.heartbeatPhase === 0 && now >= lubTime) {
            this.heartbeatPhase = 1;
            this.lastHeartbeatSubTime = now;
            this.heart.scale.set(23.8, 23.8, 23.8);
            this.audioManager.play('heartbeat_lub', {
                loop: false,
                volume: 0.2,
                rate: 0.95,
                pan: -0.3 // pan left
            });
        }

        else if (this.heartbeatPhase === 1 && now >= dubTime) {
            this.heartbeatPhase = 2;
            this.heart.scale.set(23.6, 23.6, 23.6);
            this.audioManager.play('heartbeat_dub', {
                loop: false,
                volume: 0.2,
                rate: 1.1,
                pan: -0.3 // pan left
            });
        }

        else if (this.heartbeatPhase === 2 && now - this.lastBeatTime >= this.beatInterval) {
            this.lastBeatTime = now;
            this.heartbeatPhase = 0;
        }

        // Smooth scale reset
        const targetScale = 23;
        const currentScale = this.heart.scale.x;
        const lerpedScale = THREE.MathUtils.lerp(currentScale, targetScale, deltaTime * 5);
        this.heart.scale.set(lerpedScale, lerpedScale, lerpedScale);
    }

    update(deltaTime) {
        this.physics.update(deltaTime);
        this.cameraEffects.update(deltaTime, this.keyStates);

        const time = performance.now() / 1000;

        if (this.weaponRecoilTime > 0) {
            this.weaponRecoilTime -= deltaTime;
            this.hand.position.z = THREE.MathUtils.lerp(this.hand.position.z, -0.1, deltaTime * 10);
        } else {
            this.hand.position.z = THREE.MathUtils.lerp(this.hand.position.z, -0.05, deltaTime * 10);
        }

        if (this.hand_anim) this.hand_anim.update(deltaTime);

        const isMoving = this.keyStates['KeyW'] || this.keyStates['KeyA'] || this.keyStates['KeyS'] || this.keyStates['KeyD'];
        const isSprinting = isMoving && this.keyStates['ShiftLeft'];

        let targetBPM = 40;

        if (isSprinting) {
            targetBPM = 100;
            this.breathRate = 0.9
        } else if (isMoving) {
            targetBPM = 80;
            this.breathRate = 0.7
        }

        this.updatePlayerVitals(deltaTime, targetBPM);

        // --- Hand bobbing ---
        const bobAmount = 0.02;
        if (isMoving) {
            this.hand.position.x = 0.8 + Math.sin(time) * bobAmount;
            this.hand.position.y = -0.5 + Math.abs(Math.cos(time)) * bobAmount;

            this.hand2.position.x = -0.7 + Math.abs(Math.cos(time)) * bobAmount;
            this.hand2.position.y = -0.5 + Math.sin(time) * bobAmount;
        } else {
            this.hand.position.y = -0.5 + Math.abs(Math.cos(time)) * 0.01;
            this.hand2.position.y = -0.5 + Math.abs(Math.cos(time)) * 0.01;
        }
    }

    getObject() {
        return this.controls.object;
    }
}