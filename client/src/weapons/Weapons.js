import * as THREE from 'three';
import Particles from '../core/ParticleSystem';
import { damageRemotePlayer } from '../core/Multiplayer/multiplayer_dependancy';

export const weapons = {
    fist: {
        name: "Fist'er",
        type: "melee",
        damage: 5,
        range: 1,
        cooldown: 0.4,
        fireRate: null,
        recoil: null,
        spread: null,
        ammo: null,
        reloadTime: null,
        anim: "fist_pose",
        sounds: [
            "fist_reload.wav",
            "fist_hit1.wav",
            "fist_hit2.wav"
        ]
    },

    slap: {
        name: "Spank Machine",
        type: "melee",
        damage: 10,
        range: 2,
        cooldown: 0.5,
        fireRate: null,
        recoil: null,
        spread: null,
        ammo: null,
        reloadTime: null,
        anim: "slap_pose",
        sounds: [
            "slap_chargeup.wav",
            "slap_hit1.wav",
            "slap_hit2.wav",
            "slap_hit3.wav"
        ]
    },

    pistol: {
        name: "Pistol",
        type: "semi",
        damage: 20,
        range: 25,
        cooldown: null,
        fireRate: 6,
        recoil: 0.2,
        spread: 0.02,
        ammo: 12,
        reloadTime: 0.7,
        anim: "pistol_pose",
        sounds: [
            "pistol_reload",
            "pistol",
        ]
    },

    shotgun: {
        name: "Peace Maker",
        type: "burst",
        damage: 70,
        range: 15,
        cooldown: null,
        fireRate: 0.8,
        recoil: 0.5,
        spread: 0.1,
        ammo: 8,
        reloadTime: 2.5,
        anim: "shotgun_pose",
        sounds: [
            "shotgun_reload",
            "shotgun"
        ]
    },

    smg: {
        name: "Błyskawica",
        type: "auto",
        damage: 10,
        range: 20,
        cooldown: null,
        fireRate: 8,
        recoil: 0.3,
        spread: 0.6,
        ammo: 25,
        reloadTime: 1.5,
        anim: "smg_pose",
        sounds: [
            "smg_reload",
            "smg",
            "smg_loop",
        ]
    },

    sniper: {
        name: "Crossed Luck",
        type: "long",
        damage: 80,
        range: 80,
        cooldown: null,
        fireRate: 1,
        recoil: 0.8,
        spread: 0.00,
        ammo: 4,
        reloadTime: 2,
        anim: "sniper_pose",
        sounds: [
            "sniper_reload",
            "sniper",
        ]
    }
};

export default class WeaponManager {
    constructor(player, scene, bloomPass) {
        this.player = player;
        this.scene = scene;
        this.bloomPass = bloomPass

        this.current_weapon = "fist";
        this.weapon_inventory = ["fist", "shotgun"];
        this.ammo_left = {};

        this.current_weapon_stats = weapons[this.current_weapon];
        this.MAX_INVENTORY_LIMIT = 5;
        this.lastShotTime = 0;

        this.firing = false;
        this.reloading = false;

        this.weapon_particles = new Particles(scene, player);
    }

    switch_weapon(new_weapon) {
        if (!this.weapon_inventory.includes(new_weapon)) return;

        this.stopFiring();

        this.current_weapon = new_weapon;
        this.current_weapon_stats = weapons[new_weapon];

        if (!(new_weapon in this.ammo_left)) {
            this.ammo_left[new_weapon] = weapons[new_weapon].ammo;
        }

        this.player.hand_anim.play(this.current_weapon_stats.anim);

        const ammoHUD = document.getElementById('player-ammo-display')
        ammoHUD.innerHTML = `Ammo: ${this.ammo_left[this.current_weapon]}`
    }

    cycle_weapon(direction) {
        const index = this.weapon_inventory.indexOf(this.current_weapon);
        const count = this.weapon_inventory.length;

        if (count <= 1) return;

        const nextIndex = (index + direction + count) % count;
        this.switch_weapon(this.weapon_inventory[nextIndex]);
    }

    add_weapon(weapon_name) {
        if (this.weapon_inventory.length >= this.MAX_INVENTORY_LIMIT) return false;
        if (this.weapon_inventory.includes(weapon_name)) return false;

        this.weapon_inventory.push(weapon_name);
        this.ammo_left[weapon_name] = weapons[weapon_name].ammo;
        return true;
    }

    canFire() {
        const now = performance.now() / 1000;
        const fireDelay = 1 / (this.current_weapon_stats.fireRate || (1 / this.current_weapon_stats.cooldown));
        return (now - this.lastShotTime) >= fireDelay;
    }

    startFiring() {
        if (this.firing) return;
        this.firing = true;

        const loop = () => {
            if (!this.firing) return;

            if ((this.current_weapon_stats.type || "semi") === "auto" && this.canFire()) {
                this.fire();
            }

            this._fireLoop = requestAnimationFrame(loop);
        };

        this._fireLoop = requestAnimationFrame(loop);
    }

    stopFiring() {
        this.firing = false;
        cancelAnimationFrame(this._fireLoop);
    }

    fire() {
        if (this.reloading || !this.canFire()) {
            if (this.reloading) console.log("Blocked by reload.");
            else console.log("Blocked by cooldown.");
            return;
        }

        const weapon = this.current_weapon_stats;

        if (weapon.type === "melee") {
            // Add melee logic here (animation, damage zone, etc.)
        } else {
            if (this.ammo_left[this.current_weapon] <= 0) {
                this.reload();
                return;
            }

            const direction = this.getRayDirectionWithSpread(weapon.spread);
            this.raycastShoot(direction);

            const ammoUsed = (weapon.type === "burst") ? 2 : 1;
            this.ammo_left[this.current_weapon] -= ammoUsed;

            const ammoHUD = document.getElementById('player-ammo-display')
            ammoHUD.innerHTML = `Ammo: ${this.ammo_left[this.current_weapon]}`
            // socket.on('playerAmmoUpdate', ({ id, weapon, ammo }) => {
            //     console.log(ammo)
            // })

            if (!this.ammo_left[this.current_weapon]) this.reload()

            this.player.hand.position.z += 0.1;
            this.player.weaponRecoilTime = 0.1
            this.applyRecoil(weapon.recoil)

            this.bloomPass.strength = .3
            setTimeout(() => {
                this.bloomPass.strength = 0.15
                this.isAiming = false
            }, 50)

            this.player.audioManager.play(this.current_weapon_stats.sounds[1], {
                loop: false,
                volume: 0.6,
                rate: 1.0,
                pan: 0.1
            })


        }

        this.lastShotTime = performance.now() / 1000;
    }

    reload() {
        if (this.reloading) return;

        this.reloading = true;

        // this.player.hand_anim.play(`reload_${this.current_weapon}`);

        this.player.audioManager.play(this.current_weapon_stats.sounds[0], {
            loop: false,
            volume: 0.6,
            rate: 1.0,
            pan: 0.1
        });

        setTimeout(() => {
            this.ammo_left[this.current_weapon] = this.current_weapon_stats.ammo;
            this.reloading = false;

            const ammoHUD = document.getElementById('player-ammo-display')
            ammoHUD.innerHTML = `Ammo: ${this.ammo_left[this.current_weapon]}`
        }, this.current_weapon_stats.reloadTime * 1000);
    }

    applyRecoil(amount) {
        this.player.recoilAngle = Math.min(this.recoilAngle + amount, 0.3);
        this.player.cameraEffects.triggerShake(amount * 0.1)
    }

    getRayDirectionWithSpread(spread) {
        const dir = new THREE.Vector3(0, 0, -1);
        dir.applyQuaternion(this.player.camera.quaternion);

        if (spread > 0) {
            const angle = spread * 0.1;
            dir.x += (Math.random() - 0.5) * angle;
            dir.y += (Math.random() - 0.5) * angle;
            dir.z += (Math.random() - 0.5) * angle;
            dir.normalize();
        }

        return dir;
    }

    raycastShoot(direction) {
        const raycaster = new THREE.Raycaster(this.player.camera.position, direction);
        const hits = raycaster.intersectObjects(this.scene.children, true);

        if (hits.length > 0) {
            let target = null;

            for (let i = 0; i < hits.length; i++) {
                const hit = hits[i];

                if (hit.object.name != "particle" && hit.object.name != 'hud') {
                    target = hit;
                    break;
                }
            }

            const normal = new THREE.Vector3();
            target.face?.normal?.clone()?.applyMatrix3(
                new THREE.Matrix3().getNormalMatrix(target.object.matrixWorld)
            )?.normalize();
            this.weapon_particles.spawnImpactParticles(target.point, normal, this.current_weapon_stats.damage);


            const fingerWorldPos = new THREE.Vector3();
            this.player.hand.getWorldPosition(fingerWorldPos);
            fingerWorldPos.add(direction.clone().multiplyScalar(1.6));

            this.flashMuzzle(fingerWorldPos, direction); // world space


            if (target.object.userData.enemy) {
                // target.object.userData.enemy.takeDamage(this.current_weapon_stats.damage);
                damageRemotePlayer(target.object.userData.enemy, this.current_weapon)
            }
        }
    }

    flashMuzzle(offset, direction) {
        const flash_texture = new THREE.TextureLoader().load('src/art/textures/muzzle_flash.png');
        const spriteMat = new THREE.SpriteMaterial({
            map: flash_texture,
            color: 0xffffff,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const sprite = new THREE.Sprite(spriteMat);
        sprite.scale.set(.5, .5, 1); // tweak to look right
        sprite.position.copy(offset); // position relative to hand
        sprite.material.rotation = Math.random() * Math.PI

        this.scene.add(sprite);
        sprite.lookAt(offset.clone().add(direction));


        // Animate + self-destruct
        let time = 0;
        const update = () => {
            time += 0.016;
            sprite.material.opacity = 0.8 - time * 8;
            if (time >= 0.1) {
                this.scene.remove(sprite);
                cancelAnimationFrame(sprite._raf);
            } else {
                sprite._raf = requestAnimationFrame(update);
            }
        };
        update();
    }

}
