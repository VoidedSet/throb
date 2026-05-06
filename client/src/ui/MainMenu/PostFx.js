import * as THREE from 'three';

import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ditherShader } from '../../art/shaders/ditherShader';

export function setupPostFX(menuScene) {
    const composer = menuScene.composer;
    const scene = menuScene.scene;
    const camera = menuScene.camera;
    const renderer = menuScene.renderer;

    composer.addPass(new RenderPass(scene, camera));

    const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.7, 0.4, 0.7
    );
    composer.addPass(bloom);
    menuScene.bloom = bloom;

    const dither = ditherShader.clone();
    dither.uniforms = {
        tDiffuse: { value: null },
        resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        colorNum: { value: 7.8 },
        pixelSize: { value: 2.5 }
    };

    const ditherPass = new ShaderPass(dither);
    composer.addPass(ditherPass);
    menuScene.dither = dither;
}
