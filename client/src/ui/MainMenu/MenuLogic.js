// File: UI/mainMenu/MenuLogic.js

import * as THREE from 'three';
import { waveShader } from '../../art/shaders/waveShader';

export class MenuLogic {
    constructor(menuScene) {
        this.menuScene = menuScene;
        this.textManager = menuScene.textManager;

        this.mainOptions = ['Start Game', 'Options', 'Credits', 'Quit'];
        this.roomOptions = ['Join Room', 'Create Room', 'Back'];

        this.selectedIndex = 0;
        this.inRoomMenu = false;
        this.enteringCode = false;
        this.joinCode = '';

        this.hasTriggeredJoin = false;
    }

    getWaveMaterial(uniforms) {
        const material = waveShader.clone();
        material.uniforms = uniforms;
        return material;
    }

    updateWaveParams(delta) {
        if (!this.menuScene.currentWave) {
            this.menuScene.currentWave = {
                speed: 0.05,
                freq: 3.0,
                amp: 0.3
            };
        }

        const target = this.getCurrentWaveTarget();
        const wave = this.menuScene.currentWave;

        wave.speed += (target.speed - wave.speed) * 5 * delta;
        wave.freq += (target.freq - wave.freq) * 5 * delta;
        wave.amp += (target.amp - wave.amp) * 5 * delta;

        const uniforms = this.menuScene.waveUniforms;
        uniforms.waveSpeed.value = wave.speed;
        uniforms.waveFrequency.value = wave.freq;
        uniforms.waveAmplitude.value = wave.amp;
    }

    getCurrentWaveTarget() {
        const list = this.inRoomMenu ? this.roomOptions : this.mainOptions;
        const i = this.selectedIndex;
        return [
            { speed: 0.6, freq: 9, amp: 0.8 },
            { speed: 0.3, freq: 5, amp: 0.4 },
            { speed: 0.25, freq: 2.5, amp: 0.2 },
            { speed: 0.1, freq: -0.1, amp: -0.1 },
            { speed: 0.7, freq: 10, amp: 1.0 }
        ][i] || { speed: 0.2, freq: 2, amp: 0.2 };
    }

    handleKeyDown(e) {
        const text = this.textManager;

        if (this.inRoomMenu) {
            if (this.enteringCode) {
                if (e.key === 'Backspace') {
                    this.joinCode = this.joinCode.slice(0, -1);
                    text.updateCodeText(this.joinCode, new THREE.Vector3(5, -3 - this.selectedIndex * 1.5, -1));
                } else if (/^[0-9]$/.test(e.key) && this.joinCode.length < 4) {
                    this.joinCode += e.key;
                    text.updateCodeText(this.joinCode, new THREE.Vector3(5, -3 - this.selectedIndex * 1.5, -1));
                } else if (e.key === 'Enter' && this.joinCode.length === 4) {
                    if (this.hasTriggeredJoin) return;
                    this.hasTriggeredJoin = true;
                    this.selectedIndex = 4;
                    this.menuScene.startGameWithRoom(parseInt(this.joinCode));
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                this.selectedIndex = (this.selectedIndex - 1 + this.roomOptions.length) % this.roomOptions.length;
                text.updateSelection(text.roomMeshes, this.selectedIndex);
            } else if (e.key === 'ArrowDown') {
                this.selectedIndex = (this.selectedIndex + 1) % this.roomOptions.length;
                text.updateSelection(text.roomMeshes, this.selectedIndex);
            } else if (e.key === 'Enter') {
                const selected = this.roomOptions[this.selectedIndex];
                if (selected === 'Join Room') {
                    this.enteringCode = true;
                    this.joinCode = '';
                    text.updateCodeText('', new THREE.Vector3(5, -3 - this.selectedIndex * 1.5, -1));
                } else if (selected === 'Create Room') {
                    if (this.hasTriggeredJoin) return;
                    this.hasTriggeredJoin = true;
                    const newCode = Math.floor(1000 + Math.random() * 9000);
                    this.selectedIndex = 4;
                    this.menuScene.startGameWithRoom(newCode);
                } else if (selected === 'Back') {
                    this.returnToMainMenu();
                }
            }
            return;
        }

        if (e.key === 'ArrowUp') {
            this.selectedIndex = (this.selectedIndex - 1 + this.mainOptions.length) % this.mainOptions.length;
            text.updateSelection(text.menuMeshes, this.selectedIndex);
        } else if (e.key === 'ArrowDown') {
            this.selectedIndex = (this.selectedIndex + 1) % this.mainOptions.length;
            text.updateSelection(text.menuMeshes, this.selectedIndex);
        } else if (e.key === 'Enter') {
            if (this.mainOptions[this.selectedIndex] === 'Start Game') {
                this.switchToRoomMenu();
            }
        }
    }

    switchToRoomMenu() {
        this.inRoomMenu = true;
        this.selectedIndex = 0;
        this.textManager.menuMeshes.forEach(mesh => mesh.visible = true);
        this.textManager.roomMeshes = this.textManager.createMenuOptions(this.roomOptions);
        this.textManager.updateSelection(this.textManager.roomMeshes, this.selectedIndex);
    }

    returnToMainMenu() {
        this.selectedIndex = 0;
        this.inRoomMenu = false;
        this.enteringCode = false;
        this.joinCode = '';
        this.textManager.clearText();
        this.textManager.menuMeshes = this.textManager.createMenuOptions(this.mainOptions);
        this.textManager.updateSelection(this.textManager.menuMeshes, 0);
    }
}