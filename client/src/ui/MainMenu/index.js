import * as THREE from 'three';
import { TextManager } from './TextManager.js';
import { MenuLogic } from './MenuLogic.js';
import { setupPostFX } from './PostFx.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import Engine from '../../core/Engine.js'

export class MenuScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0, 10);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.clock = new THREE.Clock();

        this.waveUniforms = this.createWaveUniforms();
        this.textManager = new TextManager(this.scene, () => {
            this.textManager.createMenuOptions(['Start Game', 'Options', 'Credits', 'Quit']);
            this.textManager.updateSelection(this.textManager.menuMeshes, 0);
        });
        this.menuLogic = new MenuLogic(this);

        this.setupBackground();
        setupPostFX(this);

        this.animate = this.animate.bind(this);
        this.animate();

        this.addEventListeners();

        this.transitionStarted = false;
    }

    createWaveUniforms() {
        return {
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            time: { value: 0 },
            waveSpeed: { value: 0.1 },
            waveFrequency: { value: 1.0 },
            waveAmplitude: { value: 0.26 },
            waveColor: { value: new THREE.Color('#ab9fad') },
            mousePos: { value: new THREE.Vector2() },
            enableMouseInteraction: { value: 1 },
            mouseRadius: { value: 0.2 }
        };
    }

    setupBackground() {
        const material = this.menuLogic.getWaveMaterial(this.waveUniforms);
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), material);
        plane.position.z = -1;
        this.scene.add(plane);
    }

    animate() {
        this.waveUniforms.time.value = performance.now() / 1000;
        this.menuLogic.updateWaveParams(this.clock.getDelta());
        this.composer.render();
        requestAnimationFrame(this.animate);
    }

    addEventListeners() {
        window.addEventListener('mousemove', e => this.waveUniforms.mousePos.value.set(e.clientX, e.clientY));
        window.addEventListener('resize', () => {
            const w = window.innerWidth, h = window.innerHeight;
            this.renderer.setSize(w, h);
            this.waveUniforms.resolution.value.set(w, h);
        });

        window.addEventListener('keydown', (e) => this.menuLogic.handleKeyDown(e));
    }

    startGameWithRoom(code) {
        setTimeout(() => {
            this.destroy();
            this.engine = new Engine(code);
            this.engine.start();
        }, 500)
    }

    destroy() {
        this.running = false;
        window.removeEventListener('keydown', this.menuLogic.handleKeyDown);
        window.removeEventListener('resize', this.boundResize);
        window.removeEventListener('mousemove', this.boundMouseMove);
        document.body.removeChild(this.renderer.domElement);
    }
}

