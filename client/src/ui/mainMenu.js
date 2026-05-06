import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/Addons.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { waveShader } from '../art/shaders/waveShader.js';
import { ditherShader } from '../art/shaders/ditherShader.js';
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';

export class MenuScene {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0, 10);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.composer = new EffectComposer(this.renderer);
        this.clock = new THREE.Clock();

        this.waveUniforms = {
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

        this.waveMaterial = waveShader.clone();
        this.waveMaterial.uniforms = this.waveUniforms;

        this.wavePlane = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), this.waveMaterial);
        this.wavePlane.position.z = -1;
        this.scene.add(this.wavePlane);

        this.setupText();
        this.setupPostFX();
        // this.setupGUI();

        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundResize = this.onResize.bind(this);

        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('resize', this.boundResize);
        this.boundKeyDown = this.handleKeyDown.bind(this);
        window.addEventListener('keydown', this.boundKeyDown);

        this.waveTargets = [
            { speed: 0.6, freq: 9, amp: 0.8 },  // Start Game (closest to play)
            { speed: 0.3, freq: 5, amp: 0.4 }, // Options
            { speed: 0.25, freq: 2.5, amp: 0.2 },  // Credits
            { speed: 0.1, freq: -0.1, amp: -0.1 }, // Quit
        ];

        this.currentWave = {
            speed: 0.05,
            freq: 3.0,
            amp: 0.3
        };

        this.running = true;
        this.animate = this.animate.bind(this);
        this.animate();

        this.enteringCode = false;
        this.joinCode = '';
        this.roomCodeMesh = null; // Text mesh for code display

    }

    setupText() {
        this.menuOptions = ['Start Game', 'Options', 'Credits', 'Quit'];
        this.roomOptions = ['Join Room', 'Create Room', 'Back'];

        this.textMeshes = [];
        this.roomMeshes = [];

        this.selectedIndex = 0;

        const loader = new FontLoader();
        loader.load('src/ui/VT323.json', (font) => {
            this.menuOptions.forEach((text, i) => {
                const geo = new TextGeometry(text, {
                    font: font,
                    size: 40,
                    height: 40,
                    curveSegments: 1,
                    bevelEnabled: false
                });
                geo.computeBoundingBox();

                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.scale.set(0.02, 0.02, 0.02);
                mesh.position.set(-8.5, -3 - i * 1.5, -1); // adjust positions as needed

                this.textMeshes.push(mesh);
                this.scene.add(mesh);
            });

            const geo = new TextGeometry('use arrow keys to navigate.', {
                font: font,
                size: 25,
                height: 40,
                curveSegments: 1,
                bevelEnabled: false
            });
            geo.computeBoundingBox();

            const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.scale.set(0.02, 0.02, 0.02);
            mesh.position.set(-1, -7.5, -1); // adjust positions as needed
            this.scene.add(mesh);

            this.roomOptions.forEach((text, i) => {
                const geo = new TextGeometry(text, {
                    font, size: 40, height: 40, curveSegments: 1, bevelEnabled: false
                });
                geo.computeBoundingBox();
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.scale.set(0.02, 0.02, 0.02);
                mesh.position.set(20, -3 - i * 1.5, -1); // off-screen right
                mesh.visible = false;
                this.roomMeshes.push(mesh);
                this.scene.add(mesh);
            });

            this.updateSelection();
        });
    }

    updateSelection() {
        this.textMeshes.forEach((mesh, i) => {
            if (i === this.selectedIndex) {
                mesh.scale.set(0.02, 0.028, 0.02); // emphasized
                mesh.material.color.set(0xffeb78); // bright yellow
            } else {
                mesh.scale.set(0.02, 0.02, 0.02); // normal
                mesh.material.color.set(0xffffff); // white
            }
        });
    }

    updateRoomMenuSelection() {
        this.roomMeshes.forEach((mesh, i) => {
            if (i === this.selectedIndex) {
                mesh.scale.set(0.02, 0.028, 0.02);
                mesh.material.color.set(0xffeb78);
            } else {
                mesh.scale.set(0.02, 0.02, 0.02);
                mesh.material.color.set(0xffffff);
            }
        });
    }

    handleKeyDown(e) {
        if (this.inRoomMenu) {
            if (this.enteringCode) {
                if (e.key === 'Backspace') {
                    this.joinCode = this.joinCode.slice(0, -1);
                    this.updateRoomCodeText();
                } else if (/^[0-9]$/.test(e.key) && this.joinCode.length < 4) {
                    this.joinCode += e.key;
                    this.updateRoomCodeText();
                } else if (e.key === 'Enter' && this.joinCode.length === 4) {
                    const code = parseInt(this.joinCode);
                    this.startGameWithRoom(code);
                }
                return;
            }

            // Navigation in room menu
            if (e.key === 'ArrowUp') {
                this.selectedIndex = (this.selectedIndex - 1 + this.roomOptions.length) % this.roomOptions.length;
                this.updateRoomMenuSelection();
            } else if (e.key === 'ArrowDown') {
                this.selectedIndex = (this.selectedIndex + 1) % this.roomOptions.length;
                this.updateRoomMenuSelection();
            } else if (e.key === 'Enter') {
                const selected = this.roomOptions[this.selectedIndex];
                if (selected === 'Join Room') {
                    this.enteringCode = true;
                    this.joinCode = '';
                    this.updateRoomCodeText();
                } else if (selected === 'Create Room') {
                    const newCode = Math.floor(1000 + Math.random() * 9000);
                    this.startGameWithRoom(newCode); // No visual, direct start
                } else if (selected === 'Back') {
                    this.switchToMainMenu();
                }
            }

            return;
        }

        // Main menu
        if (e.key === 'ArrowUp') {
            this.selectedIndex = (this.selectedIndex - 1 + this.menuOptions.length) % this.menuOptions.length;
            this.updateSelection();
        } else if (e.key === 'ArrowDown') {
            this.selectedIndex = (this.selectedIndex + 1) % this.menuOptions.length;
            this.updateSelection();
        } else if (e.key === 'Enter') {
            if (this.menuOptions[this.selectedIndex] === 'Start Game')
                this.switchToRoomMenu();
        }
    }


    switchToRoomMenu() {
        // Animate current menu left off-screen
        this.textMeshes.forEach((mesh, i) => {
            const targetX = mesh.position.x - 20;
            this.animateMeshPosition(mesh, targetX, 0.5, () => mesh.visible = false);
        });

        // Animate new room menu into view
        this.roomMeshes.forEach((mesh, i) => {
            mesh.visible = true;
            const targetX = -8.5;
            this.animateMeshPosition(mesh, targetX, 0.5);
        });

        this.inRoomMenu = true;
        this.selectedIndex = 0;
        this.updateRoomMenuSelection();
    }

    switchToMainMenu() {
        // Animate current menu left off-screen
        this.textMeshes.forEach((mesh, i) => {
            const targetX = mesh.position.x + 20;
            mesh.visible = true;
            this.animateMeshPosition(mesh, targetX, 0.5);
        });

        // Animate new room menu into view
        this.roomMeshes.forEach((mesh, i) => {
            mesh.visible = true;
            const targetX = 10.5;
            () => mesh.visible = false
            this.animateMeshPosition(mesh, targetX, 0.5);
        });

        this.inRoomMenu = false;
        this.selectedIndex = 0;
        this.updateSelection();

        this.inRoomMenu = false;
        this.enteringCode = false;
        this.joinCode = '';

        if (this.roomCodeMesh) {
            this.scene.remove(this.roomCodeMesh);
            this.roomCodeMesh = null;
        }
    }

    showRoomCode(code) {
        if (this.roomCodeMesh) {
            this.scene.remove(this.roomCodeMesh);
            this.roomCodeMesh = null;
        }

        const loader = new FontLoader();
        loader.load('src/ui/VT323.json', (font) => {
            const geo = new TextGeometry("Room Code: " + code, {
                font: font,
                size: 40,
                height: 40,
                curveSegments: 1,
                bevelEnabled: false
            });

            const mat = new THREE.MeshBasicMaterial({ color: 0xffeb78 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.scale.set(0.02, 0.02, 0.02);
            mesh.position.set(-4, -8, -1); // under menu or center
            this.roomCodeMesh = mesh;
            this.scene.add(mesh);
        });
    }


    updateRoomCodeText() {
        if (this.roomCodeMesh) {
            this.scene.remove(this.roomCodeMesh);
        }

        const loader = new FontLoader();
        loader.load('src/ui/VT323.json', (font) => {
            const geo = new TextGeometry(this.joinCode.padEnd(4, '_'), {
                font: font,
                size: 40,
                height: 40,
                curveSegments: 1,
                bevelEnabled: false
            });

            const mat = new THREE.MeshBasicMaterial({ color: 0xffeb78 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.scale.set(0.02, 0.02, 0.02);
            mesh.position.set(5, -3 - this.selectedIndex * 1.5, -1); // position right of 'Join Room'
            this.roomCodeMesh = mesh;
            this.scene.add(mesh);
        });
    }


    animateMeshPosition(mesh, targetX, duration = 0.5, onComplete) {
        const startX = mesh.position.x;
        const start = performance.now();
        const animate = (now) => {
            const t = Math.min((now - start) / (duration * 1000), 1);
            mesh.position.x = THREE.MathUtils.lerp(startX, targetX, t);
            if (t < 1) requestAnimationFrame(animate);
            else if (onComplete) onComplete();
        };
        requestAnimationFrame(animate);
    }

    setupPostFX() {
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        this.bloom = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.7, 0.4, 0.7
        );
        this.composer.addPass(this.bloom);

        this.dither = ditherShader.clone();
        this.dither.uniforms = {
            tDiffuse: { value: null },
            resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            colorNum: { value: 7.8 },
            pixelSize: { value: 2.5 }
        };
        this.composer.addPass(new ShaderPass(this.dither));

    }

    setupGUI() {
        this.gui = new GUI();
        const w = this.gui.addFolder('Wave Shader');
        w.add(this.waveUniforms.waveSpeed, 'value', 0, 0.5).name('Speed');
        w.add(this.waveUniforms.waveFrequency, 'value', 0, 10).name('Frequency');
        w.add(this.waveUniforms.waveAmplitude, 'value', 0, 1).name('Amplitude');
        w.add(this.waveUniforms.mouseRadius, 'value', 0, 1).name('Mouse Radius');
        w.addColor({ color: `#${this.waveUniforms.waveColor.value.getHexString()}` }, 'color')
            .onChange(hex => this.waveUniforms.waveColor.value.set(hex));

        const d = this.gui.addFolder('Dither Shader');
        d.add(this.dither.uniforms.pixelSize, 'value', 1, 20).name('Pixel Size');
        d.add(this.dither.uniforms.colorNum, 'value', 2, 16).name('Color Steps');

        const bloomFolder = this.gui.addFolder('Bloom');
        bloomFolder.add(this.bloom, 'strength', 0, 2).step(0.01);
        bloomFolder.add(this.bloom, 'radius', 0, 2).step(0.01);
        bloomFolder.add(this.bloom, 'threshold', 0, 1).step(0.01);
    }

    handleMouseMove(e) {
        this.waveUniforms.mousePos.value.set(e.clientX, e.clientY);
    }

    onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.renderer.setSize(w, h);

        this.waveUniforms.resolution.value.set(w, h);
        this.dither.uniforms.resolution.value.set(w, h);
    }

    animate() {
        if (!this.running) return;
        this.waveUniforms.time.value = performance.now() / 1000;
        this.composer.render();
        requestAnimationFrame(this.animate);

        const delta = this.clock.getDelta();

        const target = this.waveTargets[this.selectedIndex];
        this.currentWave.speed += (target.speed - this.currentWave.speed) * 5 * delta;
        this.currentWave.freq += (target.freq - this.currentWave.freq) * 5 * delta;
        this.currentWave.amp += (target.amp - this.currentWave.amp) * 5 * delta;

        this.waveUniforms.waveSpeed.value = this.currentWave.speed;
        this.waveUniforms.waveFrequency.value = this.currentWave.freq;
        this.waveUniforms.waveAmplitude.value = this.currentWave.amp;

    }

    startGame(callback) {
        // Animate wave params
        this.tweenUniform(this.waveUniforms.waveAmplitude, 1.0, 0.8);
        this.tweenUniform(this.waveUniforms.waveFrequency, 10.0, 0.8);


        setTimeout(() => {
            this.destroy(); // Kill menu
            callback();     // Load game scene
        }, 750); // Small delay for flash effect
    }

    tweenUniform(uniform, target, speed = 1) {
        const initial = uniform.value;
        const start = performance.now();
        const animate = (now) => {
            const elapsed = (now - start) / 1000;
            const t = Math.min(elapsed / speed, 1);
            uniform.value = THREE.MathUtils.lerp(initial, target, t);
            if (t < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }


    destroy() {
        this.running = false;
        // this.gui.destroy();
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('resize', this.boundResize);
        this.scene.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    obj.material.forEach(m => m.dispose());
                } else obj.material.dispose();
            }
        });
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}
