import * as THREE from 'three';
import { GameState } from './GameState';

export class MatchResults extends GameState {
    enter() {
        this.roomCode = this.engine.roomCode;
        this.scene = this.engine.scene;

        this.camera = this.engine.waitingCamera;
        this.scene.add(this.camera);

        this.cinematicPath = this.createCameraPath();
        this.currentIndex = 0;
        this.lerpT = 0;
        this.lerpSpeed = 0.02;

        this.engine.renderer.setCamera(this.camera);
        this.engine.renderer.lerpBloomTo(0.25, 0.9);

        this.initHUDPlane();

        // Test data: local player = 'voidedset'
        // this.updateHUDTexture('win', [
        //     { name: 'VoidSlayer', kills: 6, deaths: 3, score: 900 },
        //     { name: 'BloodRat', kills: 4, deaths: 5, score: 720 },
        //     { name: 'MeatKing', kills: 2, deaths: 7, score: 400 },
        //     { name: 'voidedset', kills: 9, deaths: 1, score: 12 },
        // ]);
    }

    createCameraPath() {
        return [
            { pos: new THREE.Vector3(10, 10, 10), lookAt: new THREE.Vector3(0, 0, 0) },
            { pos: new THREE.Vector3(-10, 12, 5), lookAt: new THREE.Vector3(0, 0, 0) },
            { pos: new THREE.Vector3(0, 20, -15), lookAt: new THREE.Vector3(5, 0, 0) }
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

        const material = new THREE.MeshBasicMaterial({
            map: this.texture,
            transparent: true,
            alphaTest: 0.01
        });

        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), material);
        this.plane.position.set(0, 0, -2);
        this.camera.add(this.plane);
    }

    resultPhrase(result) {
        const winPhrases = [
            "barely impressive", "1st win lmao", "mid tier player",
            "don’t get cocky", "ew, no lifer", "congrats? i guess", "finally did it"
        ];
        const lossPhrases = [
            "stop playing pls", "hopeless", "just quit already",
            "failure feels familiar", "why even try", "wasted potential",
            "losing is consistent", "you disappoint me"
        ];
        return result === 'win'
            ? winPhrases[Math.floor(Math.random() * winPhrases.length)]
            : lossPhrases[Math.floor(Math.random() * lossPhrases.length)];
    }

    updateHUDTexture(result = 'win', players = []) {
        const ctx = this.ctx;
        const canvas = this.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // === Result Phrase ===
        ctx.font = '80px Miskan';
        ctx.fillStyle = '#00ffaa';
        ctx.textAlign = 'center';
        ctx.fillText(this.resultPhrase(result), canvas.width / 2, 80);

        // === Scoreboard ===
        const startY = 140;
        const rowHeight = 40;
        const colX = {
            name: 50,
            kills: canvas.width - 280,
            deaths: canvas.width - 200,
            score: canvas.width - 120,
        };

        ctx.textAlign = 'left';
        ctx.font = '32px monospace';
        ctx.fillStyle = '#ffffff';

        // Headers
        ctx.fillText('Name', colX.name, startY);
        ctx.fillText('K', colX.kills, startY);
        ctx.fillText('D', colX.deaths, startY);
        ctx.fillText('Score', colX.score, startY);

        // Divider
        ctx.strokeStyle = '#00ffaa';
        ctx.beginPath();
        ctx.moveTo(40, startY + 8);
        ctx.lineTo(canvas.width - 40, startY + 8);
        ctx.stroke();

        players.sort((a, b) => b.score - a.score);

        // === Draw Player Rows ===
        const localPlayerName = this.engine?.playerName?.toLowerCase() || 'voidedset';

        players.forEach((p, i) => {
            const y = startY + rowHeight * (i + 1);
            const isLocal = p.name.toLowerCase() === localPlayerName;

            // Highlight local player
            if (isLocal) {
                ctx.font = 'bold 40px monospace';
                ctx.fillStyle = '#ee7722';
            } else {
                ctx.font = '32px monospace';
                ctx.fillStyle = '#ffffff';
            }

            ctx.fillText(p.name, colX.name, y);
            ctx.fillText(p.kills.toString(), colX.kills, y);
            ctx.fillText(p.deaths.toString(), colX.deaths, y);
            ctx.fillText(p.score.toString(), colX.score, y);
        });

        this.texture.needsUpdate = true;
    }

    update(deltaTime) {
        if (this.plane) {
            this.plane.rotation.z = Math.sin(performance.now() * 0.001) * 0.002;
        }

        // Smooth camera move
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
