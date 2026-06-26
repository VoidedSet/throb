// File: UI/mainMenu/MenuLogic.js

import * as THREE from 'three';
export class MenuLogic {
    constructor(menuScene) {
        this.menuScene = menuScene;
        this.textManager = menuScene.textManager;

        this.mainOptions = ['START', 'SETTINGS'];
        this.roomOptions = ['JOIN ROOM', 'CREATE ROOM', 'BACK'];

        this.selectedIndex = 0;
        this.inRoomMenu = false;
        this.enteringCode = false;
        this.joinCode = '';

        this.hasTriggeredJoin = false;
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
                if (this.selectedIndex === 0) { // Join Room
                    this.enteringCode = true;
                    this.joinCode = '';
                    text.updateCodeText('', new THREE.Vector3(5, -3 - this.selectedIndex * 1.5, -1));
                } else if (this.selectedIndex === 1) { // Create Room
                    if (this.hasTriggeredJoin) return;
                    this.hasTriggeredJoin = true;
                    const newCode = Math.floor(1000 + Math.random() * 9000);
                    this.selectedIndex = 4;
                    this.menuScene.startGameWithRoom(newCode);
                } else if (this.selectedIndex === 2) { // Back
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
            if (this.selectedIndex === 0) { // Start System
                this.switchToRoomMenu();
            }
        }
    }

    switchToRoomMenu() {
        this.inRoomMenu = true;
        this.selectedIndex = 0;
        this.textManager.menuMeshes.forEach(mesh => mesh.visible = false);
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