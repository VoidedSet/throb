import * as THREE from 'three';

export default class Particles {
    constructor(scene, player) {
        this.scene = scene;
        this.player = player;

        this.name = '';
        this.size = 0;
        this.particles = null;
    }

    create(name, size) {
        this.name = name;
        this.size = size;

        const positions = new Float32Array(size * 3);

        for (let i = 0; i < size; i++) {
            const i3 = i * 3;
            positions[i3 + 0] = (Math.random() - 0.5) * 10;
            positions[i3 + 1] = (Math.random() - 0.5) * 6;
            positions[i3 + 2] = (Math.random() - 0.5) * 10;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.015,
            transparent: true,
            opacity: 0.25,
            depthWrite: false
        });

        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles); // add to world, not camera/player
    }

    updateParticles(time) {
        // Move entire particle system to follow player
        const offset = new THREE.Vector3(0, 1, 0); // slight vertical offset
        const playerPos = this.player.camera.position.clone().add(offset);
        this.particles.position.copy(playerPos);

        // Animate flutter
        const pos = this.particles.geometry.attributes.position;
        for (let i = 0; i < this.size; i++) {
            const i3 = i * 3;
            pos.array[i3 + 1] += Math.sin(time * 0.5 + i) * 0.0005;
        }
        pos.needsUpdate = true;
    }

    spawnImpactParticles(position, normal, particleSize) {
        const particleCount = 10;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = [];

        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const dir = new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).normalize().add(normal).normalize().multiplyScalar(0.1);

            positions[i3 + 0] = position.x;
            positions[i3 + 1] = position.y;
            positions[i3 + 2] = position.z;
            velocities.push(dir);
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffaa00,
            size: particleSize * 0.001,
            transparent: true,
            opacity: 0.9,
            depthWrite: false
        });

        const points = new THREE.Points(geometry, material);
        points.name = "particle";
        this.scene.add(points);

        // Animate particles for a short duration
        let time = 0;
        const update = (delta) => {
            time += delta;
            const pos = geometry.attributes.position;

            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                pos.array[i3 + 0] += velocities[i].x * delta * 9;
                pos.array[i3 + 1] += velocities[i].y * delta * 9;
                pos.array[i3 + 2] += velocities[i].z * delta * 10;
            }

            material.opacity = Math.max(0, 1 - time * 4);
            pos.needsUpdate = true;

            if (time >= 0.3) {
                this.scene.remove(points);
                cancelAnimationFrame(points._raf);
            } else {
                points._raf = requestAnimationFrame(() => update(0.016));
            }
        };

        update(0.016);
    }
}
