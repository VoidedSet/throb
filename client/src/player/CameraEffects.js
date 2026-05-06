import * as THREE from 'three'

export default class CameraEffects {
    constructor(camera) {
        this.camera = camera;
        this.maxTilt = 0.05; // ~2.8 degrees
        this.currentTilt = 0;
        this.isTilting = false;
        this.tiltDirection = 0; // 1 for left, -1 for right

        // Head bobbing properties
        this.bobAmount = 0.04;
        this.bobSpeed = 10;
        this.bobTime = 0;
        this.isMoving = false;
        this.bobOffset = 0;

        // FOV properties
        this.originalFOV = camera.fov;
        this.targetFOV = this.originalFOV;
        this.fovChangeSpeed = 5;

        this.shakeIntensity = 0;
    }

    triggerShake(intensity = 0.05) {
        this.shakeIntensity = intensity;
    }


    update(deltaTime, keyStates) {

        this.updateHeadBob(deltaTime, keyStates);
        if (this.shakeIntensity > 0.001) {
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            const shakeY = (Math.random() - 0.5) * this.shakeIntensity;

            this.camera.rotateX(shakeY);
            this.camera.rotateY(shakeX);

            this.shakeIntensity = this.lerp(this.shakeIntensity, 0, deltaTime * 10);
        }
    }

    updateHeadBob(deltaTime, keyStates) {
        this.isMoving = keyStates['KeyW'] || keyStates['KeyA'] || keyStates['KeyS'] || keyStates['KeyD'];

        if (this.isMoving) {
            this.bobTime += deltaTime * this.bobSpeed;
            this.bobOffset = Math.sin(this.bobTime) * this.bobAmount;
        } else {
            // Smoothly reset bob offset when not moving
            this.bobOffset = THREE.MathUtils.lerp(this.bobOffset, 0, deltaTime * 10);
            this.bobTime = 0;
        }

        // Apply the bob offset to the camera's local position
        this.camera.position.y += this.bobOffset;
    }

    // Method to get the parent object that should be controlled by PointerLockControls
    getObject() {
        return this.cameraParent;
    }

    lerp(a, b, t) {
        return a + (b - a) * t;
    }
}
