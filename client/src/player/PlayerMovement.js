// src/player/Movement.js
import * as THREE from 'three';

const getForwardVector = (player) => {
    const dir = new THREE.Vector3();
    player.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    return dir;
};

const getSideVector = (player) => {
    const dir = new THREE.Vector3();
    player.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    dir.cross(player.camera.up);
    return dir;
};

export function handleMovement(player, keyStates, deltaTime) {
    const speed = player.playerOnFloor ? 25 : 8;
    const speedDelta = deltaTime * speed;
    const weaponManager = player.wm;

    if (keyStates['KeyW']) {
        player.playerVelocity.add(getForwardVector(player).multiplyScalar(speedDelta));
    }
    if (keyStates['KeyS']) {
        player.playerVelocity.add(getForwardVector(player).multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyA']) {
        player.playerVelocity.add(getSideVector(player).multiplyScalar(-speedDelta));
    }
    if (keyStates['KeyD']) {
        player.playerVelocity.add(getSideVector(player).multiplyScalar(speedDelta));
    }
    if (keyStates['KeyC']) {
        console.log("Sliding")
    }

    if (player.playerOnFloor && keyStates['Space']) {
        player.playerVelocity.y = 15;
    }

    window.addEventListener('mousedown', (e) => {
        if (e.button === 0) { // Left click
            weaponManager.fire(); // your instance
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
            weaponManager.stopFiring(); // stop firing loop for auto
        }
    });

}
