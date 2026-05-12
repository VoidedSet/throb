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
        this.isDead = false;
        this.showScoreboard = false;
        this.killFeed = [];

        const hud = document.getElementById('player-ui');
        if (hud) hud.style.display = 'block';

        this.updateHUDPlaneSize = this.updateHUDPlaneSize.bind(this);
        this.initHUDPlane();

        this.showSystemMessage('Match Started!');
        this.showWeaponName("Fist'er", "melee", -1, 0);

        window.addEventListener('resize', this.updateHUDPlaneSize);

        window.addEventListener('wheel', () => {
            if (!this.weaponManager || !this.weaponManager.current_weapon) return;
            const currentWeapon = this.weaponManager.current_weapon;
            this.showWeaponName(weapons[currentWeapon].name,
                weapons[currentWeapon].type,
                this.weaponManager.ammo_left[currentWeapon],
                weapons[currentWeapon].ammo);
        });

        window.addEventListener('mousedown', () => {
            if (!this.weaponManager || !this.weaponManager.current_weapon) return;
            const currentWeapon = this.weaponManager.current_weapon;
            this.showWeaponName(weapons[currentWeapon].name,
                weapons[currentWeapon].type,
                this.weaponManager.ammo_left[currentWeapon],
                weapons[currentWeapon].ammo);
        });

        this._keydownListener = (e) => {
            if (e.key === '`') this.showScoreboard = true;
        };
        this._keyupListener = (e) => {
            if (e.key === '`') this.showScoreboard = false;
        };

        window.addEventListener('keydown', this._keydownListener);
        window.addEventListener('keyup', this._keyupListener);
    }

    addKillFeedEvent(killer, killed, weapon) {
        this.killFeed.unshift({ killer, killed, weapon, timer: 3.5 });
        if (this.killFeed.length > 5) this.killFeed.pop();
    }

    showSystemMessage(msg) {
        this.systemMsg.msg = msg;
        this.systemMsg.timer = 2.5;
    }

    showDeathMessage() {
        this.isDead = true;
    }

    hideDeathMessage() {
        this.isDead = false;
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
        this.engine.enemies?.forEach(e => e.update(deltaTime));

        if (this.systemMsg.timer > 0)
            this.systemMsg.timer -= deltaTime;

        if (this.weaponName.timer > 0)
            this.weaponName.timer -= deltaTime;

        this.killFeed.forEach(k => k.timer -= deltaTime);
        this.killFeed = this.killFeed.filter(k => k.timer > 0);

        const eye = this.eye;
        if (!eye) {
            this.updateHUDTexture();
            return;
        }
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
        if (!this.canvas || !this.plane) return;
        const aspect = this.canvas.width / this.canvas.height;
        const height = 0.32;
        const width = height * aspect;

        this.plane.geometry.dispose();
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

        const playerHealth = this.engine.player?.health ?? 300;

        // Match Timer (Top Center)
        const timer = this.engine.netManager?.matchTimer || 0;
        const mins = Math.floor(timer / 60).toString().padStart(2, '0');
        const secs = (timer % 60).toString().padStart(2, '0');
        ctx.font = '40px VT323';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(`${mins}:${secs}`, canvas.width / 2, 10);

        // The blood gauge 
        {
            const gaugeWidth = 400;
            const gaugeHeight = 20;
            const gaugeX = (canvas.width - gaugeWidth) / 2;
            const gaugeY = canvas.height - gaugeHeight - 20;

            const bloodRatio = Math.max(0, playerHealth / 300);

            const radius = gaugeHeight / 2;

            const fillGradient = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeWidth, 0);
            fillGradient.addColorStop(0.0, '#FF0000');
            fillGradient.addColorStop(1.0, '#DDFFFF');

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(gaugeX + radius, gaugeY);
            ctx.lineTo(gaugeX + gaugeWidth - radius, gaugeY);
            ctx.arcTo(gaugeX + gaugeWidth, gaugeY, gaugeX + gaugeWidth, gaugeY + radius, radius);
            ctx.lineTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight - radius);
            ctx.arcTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight, gaugeX + gaugeWidth - radius, gaugeY + gaugeHeight, radius);
            ctx.lineTo(gaugeX + radius, gaugeY + gaugeHeight);
            ctx.arcTo(gaugeX, gaugeY + gaugeHeight, gaugeX, gaugeY + gaugeHeight - radius, radius);
            ctx.lineTo(gaugeX, gaugeY + radius);
            ctx.arcTo(gaugeX, gaugeY, gaugeX + radius, gaugeY, radius);
            ctx.closePath();
            ctx.clip();

            ctx.fillStyle = fillGradient;
            ctx.fillRect(gaugeX, gaugeY, gaugeWidth * bloodRatio, gaugeHeight);
            ctx.restore();

            ctx.lineWidth = 1;
            ctx.strokeStyle = '#010101';
            ctx.beginPath();
            ctx.moveTo(gaugeX + radius, gaugeY);
            ctx.lineTo(gaugeX + gaugeWidth - radius, gaugeY);
            ctx.arcTo(gaugeX + gaugeWidth, gaugeY, gaugeX + gaugeWidth, gaugeY + radius, radius);
            ctx.lineTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight - radius);
            ctx.arcTo(gaugeX + gaugeWidth, gaugeY + gaugeHeight, gaugeX + gaugeWidth - radius, gaugeY + gaugeHeight, radius);
            ctx.lineTo(gaugeX + radius, gaugeY + gaugeHeight);
            ctx.arcTo(gaugeX, gaugeY + gaugeHeight, gaugeX, gaugeY + gaugeHeight - radius, radius);
            ctx.lineTo(gaugeX, gaugeY + radius);
            ctx.arcTo(gaugeX, gaugeY, gaugeX + radius, gaugeY, radius);
            ctx.closePath();
            ctx.stroke();

            ctx.font = '28px Miskan';
            ctx.fillStyle = '#ff5566'
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText('health', canvas.width / 2, gaugeY - 4);
        }

        // Stats UI - Kills/Deaths (Bottom Left)
        const pKills = this.engine.player?.kills || 0;
        const pDeaths = this.engine.player?.deaths || 0;
        ctx.font = '30px VT323';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffaa88';
        ctx.fillText(`${pKills} K  ${pDeaths} D`, 10, canvas.height - 60);

        // Dynamic Scoreboard Overlay
        if (this.showScoreboard) {
            const playersData = this.engine.netManager?.latestPlayersData || {};
            const localId = this.engine.netManager?.localId;

            this.scoreboard = [];
            for (const id in playersData) {
                const data = playersData[id];
                this.scoreboard.push({
                    id: id,
                    name: id === localId ? 'You' : id.substring(0, 8),
                    kills: data.kills || 0,
                    deaths: data.deaths || 0,
                    score: (data.kills || 0) * 100 // Using kills * 100 as basic score for now
                });
            }

            this.scoreboard.sort((a, b) => b.score - a.score);
            this.scoreboard.forEach((entry, index) => { entry.rank = index + 1; });

            let playerIndex = this.scoreboard.findIndex(entry => entry.id === localId);

            // Logic: Top 3 + Player (if not in top 3), else top 4.
            this.visibleScoreboard = this.scoreboard.slice(0, 3);
            if (playerIndex > 2) {
                this.visibleScoreboard.push(this.scoreboard[playerIndex]);
            } else if (this.scoreboard.length > 3) {
                this.visibleScoreboard.push(this.scoreboard[3]);
            }

            ctx.font = '30px VT323';
            ctx.fillStyle = '#ffaa88';
            ctx.fillText("  Name      Score", 10, canvas.height - 210);

            this.visibleScoreboard.forEach((entry, i) => {
                ctx.fillStyle = entry.id === localId ? '#ff0000' : '#22aa00';
                let yOffset = canvas.height - 180 + i * 25;
                let nameText = entry.name.padEnd(8, ' ');
                let scoreText = entry.score.toString();
                ctx.fillText(`${entry.rank} ${nameText}  ${scoreText}`, 10, yOffset);
            });
        }

        // Crosshair UI
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

        if (this.killFeed.length > 0) {
            ctx.font = '28px VT323';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';

            this.killFeed.forEach((kill, i) => {
                const alpha = Math.min(1, kill.timer);
                ctx.fillStyle = `rgba(255, 153, 170, ${alpha})`;

                ctx.fillText(`${kill.killer} [${kill.weapon}] ${kill.killed}`, canvas.width - 20, 30 + (i * 30));
            });
        }

        if (this.weaponName.timer > 0) {
            ctx.font = '40px Miskan';
            ctx.fillStyle = '#aaaaff';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(this.weaponName.name, canvas.width - 20, canvas.height - 40);

            ctx.font = '30px VT323';
            if (this.weaponName.ammo != -1)
                ctx.fillText(`${this.weaponName.ammo}/${this.weaponName.maxAmmo}`, canvas.width - 20, canvas.height - 10)
        }

        if (this.isDead) {
            ctx.fillStyle = 'rgba(200, 0, 0, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '80px Miskan';
            ctx.fillStyle = '#ff0000';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('YOU DIED!', canvas.width / 2, canvas.height / 2);
        }

        this.texture.needsUpdate = true;
    }

    exit() {
        window.removeEventListener('resize', this.updateHUDPlaneSize);
        window.removeEventListener('keydown', this._keydownListener);
        window.removeEventListener('keyup', this._keyupListener);
    }
}