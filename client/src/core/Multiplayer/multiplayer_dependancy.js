import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { noiseShaderMaterial } from "../../art/shaders/animated_noise";

import * as THREE from 'three';
import { socket } from "./NetworkManger";

export function spawnRemotePlayers(position, scene, remotePlayers, id) {
    if (id === socket.id)
        return;
    new GLTFLoader().load('src/art/models/human.glb', (gltf) => {
        const head = gltf.scene.getObjectByName('head');
        if (!head) {
            console.error(`[Spawn Error] Head object not found in GLTF for player ID: ${id}`);
            return;
        }

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.5), new THREE.MeshBasicMaterial({ color: 0x0 }));
        body.add(head);
        scene.add(body);

        head.position.set(0, 0.6, 0);
        head.scale.set(0.2, 0.2, 0.2);

        head.children[0].material = noiseShaderMaterial.clone();

        body.position.set(position);
        body.userData.enemy = id;

        remotePlayers[id] = body;
    },
        (error) => {
            console.warn(`[GLTF Load Warn] Using fallback remote player for ID: ${id}`);
            const body = new THREE.Mesh(
                new THREE.BoxGeometry(0.5, 1.3, 0.5),
                new THREE.MeshBasicMaterial({ color: 0x0 })
            );
            body.position.copy(position);
            body.position.y -= 0.7;
            body.userData.enemy = id;
            scene.add(body);
            remotePlayers[id] = body;
        });
}

export function removeRemotePlayers(scene, remotePlayers, id) {
    if (remotePlayers[id]) {
        scene.remove(remotePlayers[id]);
        delete remotePlayers[id];
    } else {
        console.warn(`[Remove Warning] Player ${id} not found in remotePlayers map for removal. Already removed or never loaded?`);
    }
}

export function damageRemotePlayer(id, currentWeapon) {
    socket.emit('damageRemotePlayer', { targetId: id, weapon: currentWeapon });
}

export function respawnRemotePlayer(scene, remotePlayers, id) {
    removeRemotePlayers(scene, remotePlayers, id);
    setTimeout(() => {
        spawnRemotePlayers(new THREE.Vector3(0, 2, 0), scene, remotePlayers, id);
    }, 3000);
}

export function showDeathScreen() {
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'flex';
    }
}

export function hideDeathScreen() {
    const deathScreen = document.getElementById('death-screen');
    if (deathScreen) {
        deathScreen.style.display = 'none';;
    }
}

export function showDamage(health) {
    const damage = document.getElementById('damage')
    const healthHUD = document.getElementById('player-health-display')

    if (damage)
        damage.style.display = 'flex';

    setTimeout(() => {
        if (damage)
            damage.style.display = 'none';
    }, 40);

    if (healthHUD)
        healthHUD.innerHTML = `Health: ${health}`
}

export function updatePlayerList(playerIDs, localID) {

    const list = document.getElementById('player-list');
    if (!list) return;

    list.innerHTML = ''; // clear previous

    playerIDs.forEach(id => {
        const div = document.createElement('div');
        div.classList.add('player-entry');
        div.classList.add(id === localID ? 'self' : 'other');
        div.dataset.socketId = id;
        div.textContent = id;
        list.appendChild(div);
    });
}
