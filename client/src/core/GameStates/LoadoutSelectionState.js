import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import * as THREE from 'three';

import { GameState } from './GameState';
import AnimPlayer from '../AnimPlayer';
import { weapons } from '../../weapons/Weapons';
import { socket } from '../Multiplayer/NetworkManger';

export class LoadoutSelectionState extends GameState {
    enter() {
        this.engine.renderer.setCamera(this.engine.waitingCamera);

        this.loadoutCam = this.engine.waitingCamera;
        this.scene = this.engine.scene;

        this.mouse = { x: 0, y: 0 };
        this.scroll = 0;
        this.countdown = 20;
        this.currentGunIndex = 0;

        this.gunName = 'Fist`er  ', this.gunType = 'melee', this.gunDamage = 5;
        this.gunNames = ['Fist', 'Pistol', 'SMG', 'Shotgun', 'Sniper'];
        this.loadout = ['fist', 'pistol'];
        this.timeoutHandles ??= [];

        this.engine.renderer.lerpBloomTo(0.05, 0.3);

        this.setupEnvironment();
        this.initInputs();
    }

    createHUDPlane() {
        this.gunCanvas = document.createElement('canvas');
        this.gunCanvas.width = 1024;
        this.gunCanvas.height = 512;
        this.gunCtx = this.gunCanvas.getContext('2d');

        this.gunTexture = new THREE.CanvasTexture(this.gunCanvas);
        Object.assign(this.gunTexture, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            wrapS: THREE.ClampToEdgeWrapping,
            wrapT: THREE.ClampToEdgeWrapping
        });

        const material = new THREE.MeshBasicMaterial({
            map: this.gunTexture,
            transparent: true,
            alphaTest: 0.01
        });

        this.gunPlane = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), material);
        this.gunPlane.position.set(0, 0, -2);
        this.loadoutCam.add(this.gunPlane);

        this.updateHUDText("Fist'er", 'melee', 5, false);
        return { plane: this.gunPlane, canvas: this.gunCanvas, ctx: this.gunCtx, texture: this.gunTexture };
    }

    updateHUDText(gunName, gunType, damage, drawEquipText, selectedMelee = 'melee', selectedRanged = 'ranged') {
        const ctx = this.gunCtx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this.gunCanvas.width, this.gunCanvas.height);

        if (gunName === "Fist'er") gunName = "Fist`er  ";

        ctx.font = '150px Miskan';
        ctx.fillStyle = '#011fee';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(gunName, this.gunCanvas.width / 2, this.gunCanvas.height / 2 - 100);

        if (drawEquipText) {

            ctx.font = '45px VT323';
            ctx.textAlign = 'left';
            ctx.fillStyle = selectedMelee !== 'melee' ? '#993310' : '#103310';
            ctx.fillText(selectedMelee, 20, 15);

            ctx.fillStyle = selectedRanged !== 'ranged' ? '#993310' : '#103310';
            ctx.fillText(selectedRanged, 20, 45);

            ctx.font = '55px VT323';
            ctx.fillStyle = '#112266';
            ctx.textAlign = 'center';
            ctx.fillText(gunType, this.gunCanvas.width / 2 + 220, this.gunCanvas.height / 2);

            ctx.fillStyle = '#ff2266';
            ctx.fillText(damage, this.gunCanvas.width / 2 + 300, this.gunCanvas.height / 2);

            ctx.font = '40px VT323';
            ctx.fillStyle = '#112266';
            ctx.fillText("Press E to equip", this.gunCanvas.width / 2 + 390, 15);

            ctx.fillStyle = '#ddff33';
            ctx.fillText(`Starts in ${this.countdown}`, this.gunCanvas.width / 2 + 380, this.gunCanvas.height - 100);
        }

        this.gunTexture.needsUpdate = true;
    }

    updateCounter() {
        this.countdown--;
        this.updateHUDText(this.gunName, this.gunType, this.gunDamage, true, this.loadout[0], this.loadout[1]);
    }

    initInputs() {
        this._onMouseMove = (e) => {
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        };

        this._onScroll = (e) => {
            const dir = Math.sign(e.deltaY);
            if (dir === 0) return;

            this.currentGunIndex = (this.currentGunIndex + dir + this.gunNames.length) % this.gunNames.length;
            const weaponKey = this.gunNames[this.currentGunIndex].toLowerCase();
            const weaponData = weapons[weaponKey];
            Object.assign(this, {
                gunName: weaponData.name,
                gunType: weaponData.type,
                gunDamage: weaponData.damage
            });

            this.updateHUDText(this.gunName, this.gunType, this.gunDamage, true, this.loadout[0], this.loadout[1]);
            this.hand_rise.play(weaponData.anim);

            if (!this.poseOffsetApplied) {
                this.timeoutHandles.push(setTimeout(() => {
                    this.hand.position.y += 0.6;
                    this.poseOffsetApplied = true;
                }, 100));
            }
        };

        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('wheel', this._onScroll);
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyE') {
                const selectedWeapon = this.gunNames[this.currentGunIndex].toLowerCase();
                const data = weapons[selectedWeapon];

                if (data.type === 'melee') this.loadout[0] = selectedWeapon;
                else this.loadout[1] = selectedWeapon;

                this.updateHUDText(data.name, data.type, data.damage, true, this.loadout[0], this.loadout[1]);
            }
        });
    }

    update(deltaTime) {
        this.crate_anim?.update(deltaTime);
        this.lid_anim?.update(deltaTime);
        this.hand_rise?.update(deltaTime);

        if (this.loadoutCam && this.hand) {
            this.hand.rotation.z = THREE.MathUtils.lerp(this.hand.rotation.z, this.mouse.x, 0.5);
        }

        if (this.handHolder) {
            const floatY = Math.sin(performance.now() * 0.001) * 0.05;
            this.handHolder.position.y += (floatY - this.handHolder.position.y) * 0.1;
        }

        if (this.handMesh) {
            const target = new THREE.Vector3();
            this.handMesh.getWorldPosition(target);
            this.loadoutCam.lookAt(target);
        }
    }

    exit() {
        this.timeoutHandles.forEach(clearTimeout);

        if (this.gunNamePlane) this.loadoutCam.remove(this.gunNamePlane);
        this.scene.remove(this.loadoutRoom);
        this.scene.remove(this.crateLight);
        this.loadoutRoom?.remove(this.crateHolder);
        this.crateHolder?.remove(this.handHolder);

        this.crate_anim?.stop?.();
        this.lid_anim?.stop?.();
        this.hand_rise?.stop?.();

        window.removeEventListener('mousemove', this._onMouseMove);
        window.removeEventListener('wheel', this._onScroll);

        this.engine.renderer.chromaticAberrationPass.uniforms['aberrationStrength'].value = 0.003;

        this.crate_anim = this.lid_anim = this.hand_rise = null;
        this.hand = this.handMesh = this.crate = null;
        this.gunNamePlane = this.gunCanvas = this.gunCtx = this.gunTexture = null;
        this.timeoutHandles = [];

        document.body.style = `
        margin: 0;
        padding: 0;
        background: black;
        overflow: hidden;
        font-family: 'PixelFont', monospace;
        height: 100%;
        width: 100%;
        color: white;
        padding-top: 0%;
    `;

        this.engine.renderer.lerpBloomTo(0.05, 0.9);

        if (!this.loadout) this.loadout = ['fist', 'pistol'];

        // Save the loadout so GameplayState/NetworkManager can use it
        this.engine.netManger.loadOut = this.loadout;

        // Let the backend know what loadout we selected
        socket.send(JSON.stringify({
            type: 'LOADOUT',
            loadout: this.loadout
        }));
    }

    setupEnvironment() {
        this.stopLookingHere = false;

        new GLTFLoader().load('src/art/models/loadout1.gltf', (gltf) => {
            this.crate = gltf.scene;
            this.crate_lid = this.crate.getObjectByName('lid');
            this.hand = gltf.scene.getObjectByName('hand');
            this.handMesh = this.hand.getObjectByName('handMesh');
            this.handMesh.visible = false;

            this.crateHolder = new THREE.Group();
            this.crateHolder.position.set(0, -2, 0);
            this.crateHolder.add(this.crate);

            this.handHolder = new THREE.Group();
            this.handHolder.add(this.hand);
            this.crateHolder.add(this.handHolder);

            this.loadoutRoom.add(this.crateHolder);
            this.poseOffsetApplied = false;

            this.crate_anim = new AnimPlayer(this.crate, gltf.animations);
            this.crate_anim.play('crateAction');

            this.timeoutHandles.push(setTimeout(() => {
                this.handMesh.visible = true;

                this.lid_anim = new AnimPlayer(this.crate_lid, gltf.animations);
                this.lid_anim.play('lidAction.002');

                this.hand_rise = new AnimPlayer(this.hand, gltf.animations);
                this.hand_rise.play('hand_rise');

                this.timeoutHandles.push(setTimeout(() => {
                    this.engine.renderer.chromaticAberrationPass.uniforms['aberrationStrength'].value = 0.015;
                    const { plane, canvas, ctx, texture } = this.createHUDPlane();
                    this.gunNamePlane = plane;
                    this.gunCanvas = canvas;
                    this.gunCtx = ctx;
                    this.gunTexture = texture;

                    this.timeoutHandles.push(setTimeout(() => {
                        this.stopLookingHere = true;
                        this.engine.renderer.chromaticAberrationPass.uniforms['aberrationStrength'].value = 0.003;
                        this.updateHUDText("Fist'er", 'melee', 5, true);
                    }, 1350));
                }, 1700));
            }, 1200));
        });

        const floorTexture = new THREE.TextureLoader().load('src/art/textures/loadoutFloor.png');
        Object.assign(floorTexture, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter
        });

        this.loadoutRoom = new THREE.Mesh(
            new THREE.BoxGeometry(7, 5, 7),
            new THREE.MeshStandardMaterial({
                color: 0x444444,
                roughness: 0.7,
                metalness: 0.3,
                side: THREE.BackSide,
                map: floorTexture
            })
        );

        this.loadoutRoom.position.set(0, 22.5, 0);
        this.scene.add(this.loadoutRoom);

        this.loadoutCam.position.set(0, 21.5, 0.7);
        this.loadoutCam.lookAt(new THREE.Vector3(-0.34, 21.62, -0.67));

        this.crateLight = new THREE.PointLight(0xffffff, 1, 5);
        this.crateLight.position.set(0, 22, 0);
        this.scene.add(this.crateLight);
    }
}
