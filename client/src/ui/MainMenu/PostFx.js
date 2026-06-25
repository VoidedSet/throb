import * as THREE from 'three';

import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const PosterizationShader = {
    uniforms: {
        tDiffuse: { value: null },
        levels: { value: 16.0 },
        strength: { value: 0.5 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float levels;
        uniform float strength;
        varying vec2 vUv;
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            vec3 posterized = floor(texel.rgb * levels) / levels;
            gl_FragColor = vec4(mix(texel.rgb, posterized, strength), texel.a);
        }
    `
};

const ChromaticAberrationShader = {
    uniforms: {
        tDiffuse: { value: null },
        aberrationStrength: { value: 0.019 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float aberrationStrength;
        varying vec2 vUv;
        void main() {
            vec2 d = vUv - 0.5;
            vec2 ab = aberrationStrength * pow(length(d), 2.0) * normalize(d);
            float r = texture2D(tDiffuse, vUv + ab).r;
            float g = texture2D(tDiffuse, vUv).g;
            float b = texture2D(tDiffuse, vUv - ab).b;
            gl_FragColor = vec4(r, g, b, 1.0);
        }
    `
};

export function setupPostFX(menuScene) {
    const composer = menuScene.composer;
    const scene = menuScene.scene;
    const camera = menuScene.camera;
    const renderer = menuScene.renderer;

    composer.addPass(new RenderPass(scene, camera));

    // Render pixelated outline pass
    const pixelatedPass = new RenderPixelatedPass(
        4, scene, camera,
        { normalEdgeStrength: 0.4, depthEdgeStrength: 0.4 }
    );
    // composer.addPass(pixelatedPass);
    menuScene.pixelatedPass = pixelatedPass;

    // Posterization
    const posterPass = new ShaderPass(PosterizationShader);
    // composer.addPass(posterPass);
    menuScene.posterPass = posterPass;

    // Unreal Bloom Pass
    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.34, 1.0, 0.3
    );
    // composer.addPass(bloom);
    menuScene.bloom = bloom;

    // Chromatic Aberration
    const chromaPass = new ShaderPass(ChromaticAberrationShader);
    composer.addPass(chromaPass);
    menuScene.chromaPass = chromaPass;

    composer.addPass(new OutputPass());
}
