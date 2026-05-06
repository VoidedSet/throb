import * as THREE from 'three';
import { GameState } from './GameState';

export class HeartExploded extends GameState {
    enter() {
        this.roomCode = this.engine.roomCode;
        this.scene = this.engine.scene;

        this.engine.renderer.lerpBloomTo(0.25, 0.9);
        this.camera = this.engine.mainCamera;
        this.initHUDPlane();

        document.body.style.height = '90%';
        document.body.style.paddingTop = '5%';

        console.log("HEart EXploded")

        if (this.engine.player.heart_anim) this.engine.player.heart_anim.play("Key.002Action")
    }

    initHUDPlane() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 512;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            alphaTest: 0.01
        });

        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), material);
        this.plane.position.set(0, 0, -2);
        this.camera.add(this.plane);

        this.updateHUDTexture()
    }

    updateHUDTexture() {
        const ctx = this.ctx;
        const canvas = this.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // === Result Phrase ===
        ctx.font = '80px Miskan';
        ctx.fillStyle = '#00ffaa';
        ctx.textAlign = 'center';
        ctx.fillText("heart explodes here", canvas.width / 2, 150);

        this.texture.needsUpdate = true;
    }

    update(deltaTime) {
        document.body.style.height = '95%';
        document.body.style.paddingTop = '2%';

        this.engine.player.heart_anim.update(deltaTime);
    }

    exit() {
        this.camera.remove(this.plane);
        document.body.style = `
            margin: 0;
            padding: 0;
            background: black;
            overflow: hidden;
            font-family: 'PixelFont', monospace;
            height: 98%;
            width: 100%;
            color: white;
            padding-top: 1%;
        `;
    }
}
