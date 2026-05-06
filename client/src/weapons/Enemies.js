import * as THREE from 'three';
import { Capsule } from 'three/examples/jsm/Addons.js';

export default class EnemyDummy {
    constructor(position, scene, player, worldOctree) {
        this.scene = scene;
        this.player = player;
        this.worldOctree = worldOctree;

        // Create red cube mesh (1x2x1)
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.userData.enemy = this;

        this.health = 100;
        this.speed = 2; // units per second
        this.velocity = new THREE.Vector3();

        // Create capsule collider (start, end, radius)
        this.collider = new Capsule(
            new THREE.Vector3(position.x, position.y, position.z),
            new THREE.Vector3(position.x, position.y + 1.5, position.z),
            0.4
        );

        scene.add(this.mesh);
    }

    update(deltaTime) {
        if (this.health <= 0) return;

        // Move toward player
        const direction = new THREE.Vector3().subVectors(this.player.camera.position, this.mesh.position);
        direction.y = 0;
        direction.normalize();
        this.velocity.copy(direction).multiplyScalar(this.speed);

        // Predict next position
        const move = this.velocity.clone().multiplyScalar(deltaTime);
        this.collider.start.add(move);
        this.collider.end.add(move);

        const result = this.worldOctree.capsuleIntersect(this.collider);

        if (result) {
            // Resolve collision
            this.collider.start.add(result.normal.multiplyScalar(result.depth));
            this.collider.end.add(result.normal.multiplyScalar(result.depth));
        } else {
            // Move mesh with collider if no collision
            const newPos = this.collider.start.clone().add(this.collider.end).multiplyScalar(0.5);
            this.mesh.position.set(newPos.x, newPos.y - 0.75, newPos.z); // 0.75 offset to center box
        }
    }

    takeDamage(amount) {
        this.health -= amount;
        console.log(`Enemy hit! Health left: ${this.health}`);

        if (this.health <= 0) this.die();
    }

    die() {
        this.mesh.material.color.set(0x222222);
        this.mesh.visible = false;
        console.log("Enemy killed.");
    }
}
