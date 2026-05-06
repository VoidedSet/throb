import Player from '../../player/Player';
import { weapons } from '../../weapons/Weapons';
import { GameState } from './GameState';

import * as THREE from 'three';

export class GameplayState extends GameState {
    enter() {
        this.engine.renderer.setCamera(this.engine.mainCamera);

        this.engine.player = new Player(this.engine, this.engine.keyStates, this.engine.collider);

        this.engine.scene.add(this.engine.player.getObject());

        this.weaponManager = this.engine.player.weaponManager;

        this.mainCamera = this.engine.mainCamera;

        this.systemMsg = { msg: '', timer: 0 };
        this.weaponName = { name: '', timer: 0, ammo: 0, maxAmmo: 0 };

        this.initHUDPlane();

        this.showSystemMessage('U suck.')
        this.showWeaponName("Fist'er");

        window.addEventListener('resize', this.updateHUDPlaneSize)
        window.addEventListener('wheel', () => {
            this.showWeaponName(weapons[this.weaponManager.current_weapon].name,
                weapons[this.weaponManager.current_weapon].type,
                this.weaponManager.ammo_left[this.weaponManager.current_weapon],
                weapons[this.weaponManager.current_weapon].ammo)
        });

        window.addEventListener('mousedown', () => {
            this.showWeaponName(weapons[this.weaponManager.current_weapon].name,
                weapons[this.weaponManager.current_weapon].type,
                this.weaponManager.ammo_left[this.weaponManager.current_weapon],
                weapons[this.weaponManager.current_weapon].ammo)
        })

        window.addEventListener('keydown', (e) => {
            if (e.key === '`') {
                this.showWeaponName(weapons[this.weaponManager.current_weapon].name,
                    weapons[this.weaponManager.current_weapon].type,
                    this.weaponManager.ammo_left[this.weaponManager.current_weapon],
                    weapons[this.weaponManager.current_weapon].ammo)
                this.showSystemMessage('Console Test')
            }
        })
    }

    showSystemMessage(msg) {
        this.systemMsg.msg = msg;
        this.systemMsg.timer = 2.5;
    }

    showWeaponName(weapon, type, ammo, maxAmmo) {
        this.weaponName.name = weapon;
        this.weaponName.timer = 2.5;

        if (type === "melee")
            this.weaponName.ammo = -1;
        else {
            this.weaponName.ammo = ammo;
            this.weaponName.maxAmmo = maxAmmo;
        }
    }

    update(deltaTime) {
        this.engine.player?.update(deltaTime);
        this.engine.enemies.forEach(e => e.update(deltaTime));

        if (this.systemMsg.timer > 0)
            this.systemMsg.timer -= deltaTime;

        if (this.weaponName.timer > 0)
            this.weaponName.timer -= deltaTime;

        const eye = this.eye;
        eye.timeSinceLastGlance += deltaTime;

        if (eye.timeSinceLastGlance > 3 + Math.random() * 3) {
            const maxOffset = 4;
            eye.targetOffset.x = (Math.random() * 2 - 1) * maxOffset;
            eye.targetOffset.y = (Math.random() * 2 - 1) * maxOffset;
            eye.glanceTimer = 0.5 + Math.random();
            eye.timeSinceLastGlance = 0;
        }

        if (eye.glanceTimer > 0) {
            eye.offset.x += (eye.targetOffset.x - eye.offset.x) * 0.1;
            eye.offset.y += (eye.targetOffset.y - eye.offset.y) * 0.1;
            eye.glanceTimer -= deltaTime;
        } else {
            eye.offset.x *= 0.9;
            eye.offset.y *= 0.9;
        }

        this.updateHUDTexture();
    }

    updateHUDPlaneSize() {
        const aspect = this.canvas.width / this.canvas.height;
        const height = 0.32; // whatever feels right
        const width = height * aspect;

        this.plane.geometry.dispose(); // clean up old geometry
        this.plane.geometry = new THREE.PlaneGeometry(width, height);
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
        });

        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(.7, .32), material);
        this.plane.position.set(0, 0, -.2);
        this.mainCamera.add(this.plane);

        this.plane.name = 'hud';

        this.eye = {
            offset: { x: 0, y: 0 },
            targetOffset: { x: 0, y: 0 },
            glanceTimer: 0,
            timeSinceLastGlance: 0
        };

        this.updateHUDTexture();
    }

    updateHUDTexture() {
        const ctx = this.ctx;
        const canvas = this.canvas;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        //the bloom guage :0
        {
            // const gaugeWidth = 400;
            // const gaugeHeight = 20;
            // const gaugeX = (canvas.width - gaugeWidth) / 2;
            // const gaugeY = 30;

            // const bloodRatio = .7 // from server (0 to 1)

            // const radius = gaugeHeight / 2;

            // const fillGradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeWidth, 0);
            // fillGradient.addColorStop(0.0, '#FF0000');
            // fillGradient.addColorStop(1.0, '#DDFFFF');

            // ctx.save();
            // ctx.beginPath();
            // ctx.moveTo(gaugeX + radius, gaugeY);
            // ctx.lineTo(gaugeX + gaugeWidth - radius, gaugeY);
            // ctx.arcTo(gaugeX + gaugeWidth, gaugeY, gaugeX + gaugeWidth, gaugeY + radius, radius);
            // ctx.lineTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight - radius);
            // ctx.arcTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight, gaugeX + gaugeWidth - radius, gaugeY + gaugeHeight, radius);
            // ctx.lineTo(gaugeX + radius, gaugeY + gaugeHeight);
            // ctx.arcTo(gaugeX, gaugeY + gaugeHeight, gaugeX, gaugeY + gaugeHeight - radius, radius);
            // ctx.lineTo(gaugeX, gaugeY + radius);
            // ctx.arcTo(gaugeX, gaugeY, gaugeX + radius, gaugeY, radius);
            // ctx.closePath();
            // ctx.clip();

            // ctx.fillStyle = fillGradient;
            // ctx.fillRect(gaugeX, gaugeY, gaugeWidth * bloodRatio, gaugeHeight);
            // ctx.restore();

            // ctx.lineWidth = 1;
            // ctx.strokeStyle = '#010101';
            // ctx.beginPath();
            // ctx.moveTo(gaugeX + radius, gaugeY);
            // ctx.lineTo(gaugeX + gaugeWidth - radius, gaugeY);
            // ctx.arcTo(gaugeX + gaugeWidth, gaugeY, gaugeX + gaugeWidth, gaugeY + radius, radius);
            // ctx.lineTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight - radius);
            // ctx.arcTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight, gaugeX + gaugeWidth - radius, gaugeY + gaugeHeight, radius);
            // ctx.lineTo(gaugeX + radius, gaugeY + gaugeHeight);
            // ctx.arcTo(gaugeX, gaugeY + gaugeHeight, gaugeX, gaugeY + gaugeHeight - radius, radius);
            // ctx.lineTo(gaugeX, gaugeY + radius);
            // ctx.arcTo(gaugeX, gaugeY, gaugeX + radius, gaugeY, radius);
            // ctx.closePath();
            // ctx.stroke();

            // ctx.font = '28px Miskan';
            // ctx.fillStyle = '#ff5566'
            // ctx.textAlign = 'center';
            // ctx.textBaseline = 'bottom';
            // ctx.fillText('final blossom', canvas.width / 2, gaugeY - 4);
        }

        //stats ui
        if (this.systemMsg.timer > 0) {
            let playerName = this.engine.name;  // e.g., "Player 1"

            this.scoreboard = [
                { name: "test", score: 290 },
                { name: "looser", score: 94 },
                { name: "winner", score: 300 },
                { name: "Player 1", score: 90 },
                { name: "Player 2", score: 92 }
            ];

            this.scoreboard.sort((a, b) => b.score - a.score);

            this.scoreboard.forEach((entry, index) => {
                entry.rank = index + 1;
            });

            let playerIndex = this.scoreboard.findIndex(entry => entry.name === playerName);

            if (playerIndex !== -1) {
                this.scoreboard[playerIndex].name = 'You';
            }

            this.visibleScoreboard = this.scoreboard.slice(0, 3);

            if (playerIndex !== -1 && playerIndex > 2) {
                this.visibleScoreboard.push(this.scoreboard[playerIndex]);
            }

            ctx.font = '30px VT323';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffaa88';

            ctx.fillText(`${this.engine.kills || 0} K  ${this.engine.deaths || 0} D`, 10, canvas.height - 60);

            ctx.font = '30px VT323';

            ctx.fillText("  Name    Score", 10, canvas.height - 210);

            this.visibleScoreboard.forEach((entry, i) => {

                if (entry.name === 'You')
                    ctx.fillStyle = '#ff0000'
                else ctx.fillStyle = '#22aa00'
                let yOffset = canvas.height - 180 + i * 25;
                let nameText = entry.name.padEnd(8, ' ');
                let scoreText = entry.score.toString();
                ctx.fillText(`${entry.rank.toString()} ${nameText}${scoreText}`, 10, yOffset);
            });
        }

        //crosshair ui
        {
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;

            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.beginPath();
            ctx.ellipse(cx, cy, 10, 5, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.ellipse(cx + this.eye.offset.x, cy + this.eye.offset.y, 2.5, 1.5, 0, 0, Math.PI * 2);

            ctx.fillStyle = 'rgba(255,0,0,0.5)';
            ctx.fill();
        }

        if (this.systemMsg.timer > 0) {
            ctx.fillStyle = '#ff99aa';
            ctx.textAlign = 'right';
            ctx.fillText(this.systemMsg.msg, canvas.width - 20, 30);
        }

        if (this.weaponName.timer > 0) {
            ctx.font = '40px Miskan';
            ctx.fillStyle = '#aaaaff';
            ctx.textAlign = 'right';
            ctx.fillText(this.weaponName.name, canvas.width - 20, canvas.height - 20);

            ctx.font = '30px VT323';
            if (this.weaponName.ammo != -1)
                ctx.fillText(`${this.weaponName.ammo}/${this.weaponName.maxAmmo}`, canvas.width - 20, canvas.height)
        }

        this.texture.needsUpdate = true;
    }

    exit() {
    }
}
