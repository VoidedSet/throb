import * as THREE from 'three';
import { GameState } from './GameState';

export class WaitingState extends GameState {
    enter() {
        this.roomCode = this.engine.roomCode;
        this.scene = this.engine.scene;

        this.camera = this.engine.waitingCamera;
        this.cinematicPath = this.createCameraPath();

        this.currentIndex = 0;
        this.lerpT = 0;
        this.lerpSpeed = 0.02;

        this.scene.add(this.camera);

        this.engine.renderer.setCamera(this.camera);
        this.engine.renderer.lerpBloomTo(0.25, 0.9);
        document.body.style.height = '90%';
        document.body.style.paddingTop = '5%';

        this.maxPlayers = this.engine.playerLimit;
        this.prevPlayers = -1;
        this.initHUDPlane();
    }

    createCameraPath() {
        return [
            { pos: new THREE.Vector3(10, 10, 10), lookAt: new THREE.Vector3(0, 0, 0) },
            { pos: new THREE.Vector3(-10, 12, 5), lookAt: new THREE.Vector3(0, 0, 0) },
            { pos: new THREE.Vector3(0, 20, -15), lookAt: new THREE.Vector3(5, 0, 0) },
        ];
    }

    initHUDPlane() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 512;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.wrapS = THREE.ClampToEdgeWrapping;
        this.texture.wrapT = THREE.ClampToEdgeWrapping;

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            alphaTest: 0.01
        });

        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.4), material);
        this.plane.position.set(0, 0.37, -2);
        this.camera.add(this.plane);

        this.updateHUDTexture();
    }

    updateHUDTexture() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        const playerCount = this.engine.netManager.currentRoomPlayerIDs.size;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // === Corner L's ===
        const len = 40;
        ctx.strokeStyle = '#ddffdd';
        ctx.lineWidth = 8;
        ctx.beginPath();

        // Top Left
        ctx.moveTo(5, len); ctx.lineTo(5, 5); ctx.lineTo(len, 5);
        // Top Right
        ctx.moveTo(canvas.width - len, 5); ctx.lineTo(canvas.width - 5, 5); ctx.lineTo(canvas.width - 5, len);
        // Bottom Left
        ctx.moveTo(5, canvas.height - len); ctx.lineTo(5, canvas.height - 5); ctx.lineTo(len, canvas.height - 5);
        // Bottom Right
        ctx.moveTo(canvas.width - len, canvas.height - 5); ctx.lineTo(canvas.width - 5, canvas.height - 5); ctx.lineTo(canvas.width - 5, canvas.height - len);

        ctx.stroke();

        // === "waiting" label ===
        ctx.font = '64px VT323';
        ctx.fillStyle = '#ff0000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('waiting', canvas.width / 2 + 405, canvas.height / 2 + 205);

        // === Room Code ===
        ctx.font = '50px VT323';
        ctx.fillStyle = '#dd5511';
        ctx.textAlign = 'center';
        ctx.fillText(`room_code: ${this.roomCode}`, canvas.width / 2 - 340, 25);

        // === Player count top-right ===
        ctx.font = '48px VT323';
        ctx.fillStyle = '#00ffaa';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(`${playerCount}/${this.maxPlayers}`, canvas.width - 20, 15);

        ctx.fillText(this.engine.name, canvas.width - 20, 60);

        this.texture.needsUpdate = true;
    }

    update(deltaTime) {
        const currentCount = this.engine.netManager.currentRoomPlayerIDs.size;
        if (currentCount !== this.prevPlayers) {
            this.prevPlayers = currentCount;
            this.updateHUDTexture();
        }

        if (this.plane) {
            this.plane.rotation.z = Math.sin(performance.now() * 0.001) * 0.002;
        }

        const curr = this.cinematicPath[this.currentIndex];
        const next = this.cinematicPath[(this.currentIndex + 1) % this.cinematicPath.length];

        this.lerpT += this.lerpSpeed * deltaTime;
        if (this.lerpT >= 1) {
            this.lerpT = 0;
            this.currentIndex = (this.currentIndex + 1) % this.cinematicPath.length;
        }

        const pos = curr.pos.clone().lerp(next.pos, this.lerpT);
        const look = curr.lookAt.clone().lerp(next.lookAt, this.lerpT);
        this.camera.position.copy(pos);
        this.camera.lookAt(look);
    }

    exit() {
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
        this.camera.remove(this.plane);
    }
}