import * as THREE from 'three';

let heartMesh = null;
let audioManager = null;

let bpm = 40;
let lastStateChangeTime = 0;
let lastBPM = 40;
let lastBeatTime = 0;
let heartbeatPhase = 0;
let lastHeartbeatSubTime = 0;

let lubDubInterval = 200;
let beatInterval = 1500;

let breathRate = 0.3;

export function initHeartbeatSystem(heart, audio) {
    heartMesh = heart;
    audioManager = audio;
}

export function setBPM(newBPM) {
    const now = performance.now();
    if (newBPM !== lastBPM && now - lastStateChangeTime > 3000) {
        lastBPM = newBPM;
        lastStateChangeTime = now;
    }
}

export function getBreathRate() {
    return breathRate;
}

export function updateHeartbeat(deltaTime) {
    const now = performance.now();

    beatInterval = (60 / lastBPM) * 1000;
    const lubTime = lastBeatTime;
    const dubTime = lastBeatTime + lubDubInterval;

    if (heartbeatPhase === 0 && now >= lubTime) {
        heartbeatPhase = 1;
        lastHeartbeatSubTime = now;
        heartMesh.scale.set(23.8, 23.8, 23.8);
        audioManager.play('heartbeat_lub', {
            loop: false,
            volume: 0.2,
            rate: 0.95,
            pan: -0.3,
        });
    } else if (heartbeatPhase === 1 && now >= dubTime) {
        heartbeatPhase = 2;
        heartMesh.scale.set(23.6, 23.6, 23.6);
        audioManager.play('heartbeat_dub', {
            loop: false,
            volume: 0.2,
            rate: 1.1,
            pan: -0.3,
        });
    } else if (heartbeatPhase === 2 && now - lastBeatTime >= beatInterval) {
        lastBeatTime = now;
        heartbeatPhase = 0;
    }

    // Smooth scale back to idle
    const targetScale = 23;
    const currentScale = heartMesh.scale.x;
    const lerped = THREE.MathUtils.lerp(currentScale, targetScale, deltaTime * 5);
    heartMesh.scale.set(lerped, lerped, lerped);
}

export function updateBreathing(isMoving, isSprinting) {
    if (isSprinting) breathRate = 0.9;
    else if (isMoving) breathRate = 0.7;
    else breathRate = 0.3;
}
