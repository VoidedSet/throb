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

        // Base look rotation (controlled by mouse movement via PointerLockControls)
        this.basePitch = camera.rotation.x;
        this.baseYaw = camera.rotation.y;

        // Offsets applied on top of the base rotation
        this.recoilX = 0;
        this.shakeX = 0;
        this.shakeY = 0;
    }

    onControlsChange() {
        // When mouse moves, PointerLockControls updates the camera rotation.
        // We extract the base look rotation by subtracting our active offsets.
        this.basePitch = this.camera.rotation.x - (this.recoilX + this.shakeX);
        this.baseYaw = this.camera.rotation.y - this.shakeY;
    }

    applyRecoil(amount) {
        this.recoilX = Math.min(this.recoilX + amount, 0.3);
        this.triggerShake(amount * 0.1);
    }

    triggerShake(intensity = 0.05) {
        this.shakeIntensity = intensity;
    }

    update(deltaTime, keyStates) {
        this.updateHeadBob(deltaTime, keyStates);

        // Decay recoil offset
        this.recoilX = THREE.MathUtils.lerp(this.recoilX, 0, deltaTime * 12);

        // Shake offsets
        if (this.shakeIntensity > 0.001) {
            this.shakeX = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeY = (Math.random() - 0.5) * this.shakeIntensity;
            this.shakeIntensity = this.lerp(this.shakeIntensity, 0, deltaTime * 10);
        } else {
            this.shakeX = 0;
            this.shakeY = 0;
            this.shakeIntensity = 0;
        }

        // Apply base rotation plus offsets to the camera rotation (order YXZ is standard for FPS)
        this.camera.rotation.set(
            this.basePitch + this.recoilX + this.shakeX,
            this.baseYaw + this.shakeY,
            0,
            'YXZ'
        );
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
