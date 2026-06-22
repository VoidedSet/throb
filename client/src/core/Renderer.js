import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

import {
    EffectComposer,
    RenderPass,
    RenderPixelatedPass,
    ShaderPass,
    UnrealBloomPass,
    OutputPass,
} from 'three/examples/jsm/Addons.js';

import { PosterizationShader } from '../art/shaders/posterization';
import { RadialChromaticAberrationShader } from '../art/shaders/radial_chromatic';

export default class Renderer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            80,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 1.6, 5);


        // WebGL Renderer with proper output encoding
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputEncoding = THREE.sRGBEncoding; // Prevents color darkening
        document.body.appendChild(this.renderer.domElement);

        // Effect Composer
        this.composer = new EffectComposer(this.renderer);
        this.renderPass = new RenderPass(this.scene, this.camera)
        this.composer.addPass(this.renderPass);

        // Resize handler
        window.addEventListener('resize', () => this.onResize());

        // Raycaster for dynamic focus (if you want to use later)
        this.raycaster = new THREE.Raycaster();
        this.screenCenter = new THREE.Vector2(0, 0); // normalized screen center

        this.initRenderPasses();
        // this.initDebugUI();
    }

    initRenderPasses() {


        this.pixelatedPass = new RenderPixelatedPass(3, this.scene, this.camera, {
            normalEdgeStrength: 0.4,
            depthEdgeStrength: 0.4
        })

        this.posterPass = new ShaderPass(PosterizationShader);
        this.posterPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        this.posterPass.uniforms.levels.value = 9.0;
        this.posterPass.uniforms.strength.value = .3;

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.1,
            0.2,
            0.1
        );

        this.chromaticAberrationPass = new ShaderPass(RadialChromaticAberrationShader);
        this.chromaticAberrationPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);
        this.chromaticAberrationPass.uniforms['aberrationStrength'].value = 0.003; // edge strength

        const outputPass = new OutputPass();

        this.composer.addPass(this.pixelatedPass)
        this.composer.addPass(this.posterPass);

        this.composer.addPass(this.bloomPass)
        this.composer.addPass(this.chromaticAberrationPass);

        this.composer.addPass(outputPass);

        this.bloomPass.strength = 3;
        this.lerpBloomTo(0.1, 0.5)
    }

    initDebugUI() {
        const gui = new GUI();
        const bloomFolder = gui.addFolder('Bloom');
        bloomFolder.add(this.bloomPass, 'strength', 0, 2).step(0.01);
        bloomFolder.add(this.bloomPass, 'radius', 0, 2).step(0.01);
        bloomFolder.add(this.bloomPass, 'threshold', 0, 1).step(0.01);

        const pixelFolder = gui.addFolder('Pixelation');
        const pixelSettings = {
            pixelSize: this.pixelatedPass.pixelSize,
            normalEdgeStrength: 0.9,
            depthEdgeStrength: 0.9,
        };

        pixelFolder.add(pixelSettings, 'pixelSize', 1, 20).step(1).onChange(val => {
            this.pixelatedPass.setPixelSize(val);
        });
        pixelFolder.add(pixelSettings, 'normalEdgeStrength', 0, 5).step(0.1).onChange(val => {
            this.pixelatedPass.setEdgeStrength(val, pixelSettings.depthEdgeStrength);
        });
        pixelFolder.add(pixelSettings, 'depthEdgeStrength', 0, 5).step(0.1).onChange(val => {
            this.pixelatedPass.setEdgeStrength(pixelSettings.normalEdgeStrength, val);
        });

        const posterFolder = gui.addFolder('Posterization');
        posterFolder.add(this.posterPass.uniforms.levels, 'value', 1, 10).name('levels');
        posterFolder.add(this.posterPass.uniforms.strength, 'value', 0, 1).name('strength');

        const aberrationFolder = gui.addFolder('Chromatic Aberration');
        aberrationFolder.add(this.chromaticAberrationPass.uniforms['aberrationStrength'], 'value', 0, 0.05).name('strength');

        gui.close();
    }


    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.composer.setSize(window.innerWidth, window.innerHeight);
        this.chromaticAberrationPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);
    }

    lerpBloomTo(targetStrength, duration = 1.0) {
        const startStrength = this.bloomPass.strength;
        const startTime = performance.now();

        const animate = (now) => {
            const elapsed = (now - startTime) / 1000;
            const t = Math.min(elapsed / duration, 1);
            this.bloomPass.strength = THREE.MathUtils.lerp(startStrength, targetStrength, t);
            if (t < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    setCamera(camera) {
        this.camera = camera;
        this.renderPass.camera = camera;
        this.pixelatedPass.camera = camera; // if used
    }

    render() {
        this.composer.render();
    }
}
