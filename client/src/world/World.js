import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';

export default class World {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.worldOctree = new Octree();
        this.isLoaded = false;
        this.map = null;
        this.monsterHeart = null;

        this.loadWorldModel();
        this.addLighting();

        // Heartbeat system
        this.currentBPM = 40;
        this.lastStateChangeTime = 0;
        this.lastBPM = 40;
        this.lastBeatTime = 0;
        this.heartbeatPhase = 0; // 0 = lub, 1 = dub, 2 = wait
        this.lastHeartbeatSubTime = 0;
        this.lubDubInterval = 200;
        this.beatInterval = 1500;
    }

    loadWorldModel() {
        this.loader.load('src/art/models/map1.gltf', (gltf) => {
            const model = gltf.scene;
            this.map = model;
            this.scene.add(model);

            console.log(gltf.scene)

            model.position.set(0, -10, 0);
            model.scale.set(1.5, 1.5, 1.5);

            this.monsterHeart = model.children[1];
            const fan = model.getObjectByName('fan');
            const fanRim = model.getObjectByName('fan_rim');

            this.worldOctree.fromGraphNode(model.getObjectByName('Map'));
            this.worldOctree.fromGraphNode(fanRim);

            this.isLoaded = true;
        }, undefined, (err) => {
            console.error('Failed to load world:', err);
        });
    }

    addLighting() {
        const fillLight1 = new THREE.HemisphereLight(0x8dc1de, 0x00668d, 1.5);
        fillLight1.position.set(2, 1, 1);
        this.scene.add(fillLight1);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
        directionalLight.position.set(-5, 25, -1);
        directionalLight.castShadow = true;

        directionalLight.shadow.camera.near = 0.01;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        directionalLight.shadow.mapSize.set(1024, 1024);
        directionalLight.shadow.radius = 4;
        directionalLight.shadow.bias = -0.00006;

        this.scene.add(directionalLight);
    }

    update(delta) {
        if (!this.isLoaded || !this.map) return;

        // === FAN ANIMATION ===
        const fan = this.map.getObjectByName('fan');
        if (fan) {
            fan.rotation.z += delta * 0.5;
        }

        // === HEARTBEAT ANIMATION ===
        if (this.monsterHeart) {
            const targetBPM = 30;
            const now = performance.now();

            // BPM change delay logic
            const delay = 5000;
            if (targetBPM !== this.lastBPM && (now - this.lastStateChangeTime > delay)) {
                this.lastBPM = targetBPM;
                this.lastStateChangeTime = now;
            }

            this.beatInterval = (60 / this.lastBPM) * 1000;
            const lubTime = this.lastBeatTime;
            const dubTime = this.lastBeatTime + this.lubDubInterval;

            if (this.heartbeatPhase === 0 && now >= lubTime) {
                this.heartbeatPhase = 1;
                this.lastHeartbeatSubTime = now;
                this.monsterHeart.scale.set(5, 5, 5); // lub
            }
            else if (this.heartbeatPhase === 1 && now >= dubTime) {
                this.heartbeatPhase = 2;
                this.monsterHeart.scale.set(4.8, 4.8, 4.8); // dub
            }
            else if (this.heartbeatPhase === 2 && now - this.lastBeatTime >= this.beatInterval) {
                this.lastBeatTime = now;
                this.heartbeatPhase = 0;
            }

            const targetScale = 4.4;
            const currentScale = this.monsterHeart.scale.x;
            const lerpedScale = THREE.MathUtils.lerp(currentScale, targetScale, delta * 4);
            this.monsterHeart.scale.set(lerpedScale, lerpedScale, lerpedScale);
        }
    }

    getOctree() {
        return this.worldOctree;
    }
}
