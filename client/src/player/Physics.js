import * as THREE from 'three';

export default class PlayerPhysics {
    constructor(playerCollider, worldOctree, camera, keyStates, camEffects) {
        this.playerCollider = playerCollider;
        this.worldOctree = worldOctree;
        this.camera = camera;
        this.keyStates = keyStates;
        this.camEffects = camEffects;
        this.playerVelocity = new THREE.Vector3();
        this.playerDirection = new THREE.Vector3();
        this.playerOnFloor = false;
        this.isSliding = false;
        this.slideTimer = 0;
        this.slideCooldown = 2; // seconds
        this.slideCooldownTimer = 0;
        this.canSlide = true;

        this.GRAVITY = 30;
        this.SHRINK_AMOUNT = 0.5;
    }

    update(deltaTime) {
        this.controls(deltaTime);

        let damping = Math.exp(-4 * deltaTime) - 1;

        if (!this.playerOnFloor) {
            this.playerVelocity.y -= this.GRAVITY * deltaTime;
            damping *= 0.1;
        }

        this.playerVelocity.addScaledVector(this.playerVelocity, damping);

        const deltaPosition = this.playerVelocity.clone().multiplyScalar(deltaTime);
        this.playerCollider.translate(deltaPosition);

        this.playerCollisions();

        this.camera.position.copy(this.playerCollider.end);

        if (this.isSliding) {
            this.slideTimer += deltaTime;
            this.playerVelocity.multiplyScalar(0.99); // fake friction

            // End slide after 0.9s or if airborne or too slow
            if (this.slideTimer > 0.9 || !this.playerOnFloor || this.playerVelocity.length() < 2) {
                this.endSlide();
            }
        }

        // Handle cooldown
        if (!this.canSlide) {
            this.slideCooldownTimer += deltaTime;
            if (this.slideCooldownTimer >= this.slideCooldown) {
                this.canSlide = true;
                this.slideCooldownTimer = 0;
            }
        }
    }

    playerCollisions() {
        const result = this.worldOctree.capsuleIntersect(this.playerCollider);
        this.playerOnFloor = false;

        if (result) {
            this.playerOnFloor = result.normal.y > 0;

            if (!this.playerOnFloor) {
                this.playerVelocity.addScaledVector(result.normal, -result.normal.dot(this.playerVelocity));
            }

            if (result.depth >= 1e-10) {
                this.playerCollider.translate(result.normal.multiplyScalar(result.depth));
            }
        }
    }

    getForwardVector() {
        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        return this.playerDirection;
    }

    getSideVector() {
        this.camera.getWorldDirection(this.playerDirection);
        this.playerDirection.y = 0;
        this.playerDirection.normalize();
        this.playerDirection.cross(this.camera.up);
        return this.playerDirection;
    }

    controls(deltaTime) {
        const speedDelta = deltaTime * (this.playerOnFloor ? 25 : 8);

        if (this.keyStates['KeyW']) {
            this.playerVelocity.add(this.getForwardVector().multiplyScalar(speedDelta));
        }

        if (this.keyStates['KeyS']) {
            this.playerVelocity.add(this.getForwardVector().multiplyScalar(-speedDelta));
        }

        if (this.keyStates['KeyA']) {
            this.playerVelocity.add(this.getSideVector().multiplyScalar(-speedDelta));
        }

        if (this.keyStates['KeyD']) {
            this.playerVelocity.add(this.getSideVector().multiplyScalar(speedDelta));
        }

        if (
            this.keyStates['ShiftLeft'] &&
            this.playerOnFloor &&
            this.playerVelocity.length() > 5 &&
            !this.isSliding &&
            this.canSlide
        ) {
            this.startSlide();
        }

        // Jump
        if (this.playerOnFloor && this.keyStates['Space']) {
            this.playerVelocity.y = 10;
        }
    }

    startSlide() {
        this.isSliding = true;
        this.slideTimer = 0;
        this.canSlide = false;

        const slideDir = this.getForwardVector();
        this.playerVelocity.add(slideDir.multiplyScalar(14)); // tweak as needed

        this.playerCollider.end.y -= this.SHRINK_AMOUNT;
        this.camera.position.y -= this.SHRINK_AMOUNT;
    }

    endSlide() {
        this.isSliding = false;

        this.playerCollider.end.y += this.SHRINK_AMOUNT;
        this.camera.position.y += this.SHRINK_AMOUNT;
    }

    getVelocity() {
        return this.playerVelocity;
    }

    isOnFloor() {
        return this.playerOnFloor;
    }
}
