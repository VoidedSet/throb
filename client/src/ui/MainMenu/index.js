import * as THREE from 'three';
import { TextManager } from './TextManager.js';
import { MenuLogic } from './MenuLogic.js';
import Engine from '../../core/Engine.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPixelatedPass } from 'three/examples/jsm/postprocessing/RenderPixelatedPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { PosterizationShader } from '../../art/shaders/posterization';
import { RadialChromaticAberrationShader } from '../../art/shaders/radial_chromatic';
import GUI from 'lil-gui';

export class MenuScene {
    constructor() {
        this.cameraBaseHeight = 0.78;
        this.cameraLookAtHeight = 0.98;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, this.cameraBaseHeight, 0.8);

        // Separate Orthographic Layer for clean, crisp, non-pixelated UI text
        this.uiScene = new THREE.Scene();
        this.uiCamera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0, 10);
        this.uiCamera.position.set(0, 0, 5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x050508, 1.0);
        this.renderer.autoClear = true; // Enabled by default for composer rendering
        document.body.appendChild(this.renderer.domElement);

        // Base post-processing composer setup
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Render pixelated outline pass
        const pixelatedPass = new RenderPixelatedPass(
            3, this.scene, this.camera,
            { normalEdgeStrength: 0.4, depthEdgeStrength: 0.4 }
        );
        this.composer.addPass(pixelatedPass);
        this.pixelatedPass = pixelatedPass;

        // Posterization
        const posterPass = new ShaderPass(PosterizationShader);
        posterPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        posterPass.uniforms.levels.value = 10.0;
        posterPass.uniforms.strength.value = 0.8;
        this.composer.addPass(posterPass);
        this.posterPass = posterPass;

        // Chromatic Aberration
        const chromaPass = new ShaderPass(RadialChromaticAberrationShader);
        chromaPass.uniforms['resolution'].value.set(window.innerWidth, window.innerHeight);
        chromaPass.uniforms['aberrationStrength'].value = 0.017;
        this.composer.addPass(chromaPass);
        this.chromaPass = chromaPass;

        // Bloom Pass (cinematic atmospheric glow)
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3,   // strength
            0.25,   // radius
            0.06   // threshold
        );
        this.composer.addPass(bloomPass);
        this.bloomPass = bloomPass;

        this.composer.addPass(new OutputPass());

        this.clock = new THREE.Clock();

        this.menuLogic = new MenuLogic(this);
        this.textManager = new TextManager(this.uiScene, this.uiCamera, () => {
            this.textManager.createMenuOptions(this.menuLogic.mainOptions);
            this.textManager.updateSelection(this.textManager.menuMeshes, 0);
        });
        this.menuLogic.textManager = this.textManager;

        this.setupBackground();
        this.setupSoundtrack();
        // this.setupGUI();

        this.animate = this.animate.bind(this);
        this.animate();

        this.addEventListeners();

        this.transitionStarted = false;
    }

    setupBackground() {
        this.censorMatInstances = [];
        this.censorParams = {
            blockSize: 64.0,
            uvCoarseness: 64.0,
            fps: 8.0,
            jitter: 0.3,
            overspill: 0.01
        };

        const shaderMat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                map: { value: null },
                useMap: { value: 0.0 },
                color: { value: new THREE.Color(0xffffff) },
                blockSize: { value: this.censorParams.blockSize },
                uvCoarseness: { value: this.censorParams.uvCoarseness },
                fps: { value: this.censorParams.fps },
                jitter: { value: this.censorParams.jitter },
                resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                overspill: { value: this.censorParams.overspill }
            },
            vertexShader: `
                #include <common>
                #include <skinning_pars_vertex>
                uniform float overspill;
                varying vec2 vUv;
                varying vec4 vScreenPos;
                void main() {
                    vUv = uv;
                    vec3 fatPos = position + normal * overspill * vec3(1.0);
                    #include <skinbase_vertex>
                    vec3 transformed = fatPos;
                    #include <skinning_vertex>
                    #include <project_vertex>
                    vScreenPos = gl_Position;
                }
            `,
            fragmentShader: `
                uniform float time, fps, jitter, blockSize, uvCoarseness;
                uniform sampler2D map;
                uniform vec3 color;
                uniform float useMap;
                uniform vec2 resolution;
                varying vec2 vUv;
                varying vec4 vScreenPos;

                float rand(vec2 c) {
                    return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453);
                }

                void main() {
                    vec2 ndc    = vScreenPos.xy / vScreenPos.w;
                    vec2 screen = (ndc * 0.5 + 0.5) * resolution;
                    vec2 block  = floor(screen / blockSize);
                    float t = floor(time * fps);
                    vec2 jitterOff = vec2(
                        (rand(block + t)        - 0.5) * jitter,
                        (rand(block + t + 42.0) - 0.5) * jitter
                    );
                    
                    vec4 texColor = vec4(color, 1.0);
                    if (useMap > 0.5) {
                        vec2 blockUv = floor(vUv * uvCoarseness) / uvCoarseness;
                        blockUv += jitterOff;
                        texColor = texture2D(map, blockUv);
                    } else {
                        // Apply screenspace block color grid effect for solid colors
                        float rMod = (rand(block) - 0.5) * 0.05;
                        float gMod = (rand(block + 13.0) - 0.5) * 0.05;
                        float bMod = (rand(block + 29.0) - 0.5) * 0.05;
                        texColor.rgb = clamp(texColor.rgb + vec3(rMod, gMod, bMod), 0.0, 1.0);
                    }
                    gl_FragColor = texColor;
                }
            `
        });

        this.censorMat = shaderMat;

        // Load 3D Character Android
        const loader = new GLTFLoader();
        loader.load('src/art/models/Android-MainMenu.glb', (gltf) => {
            gltf.scene.position.set(0, 0, 0);
            gltf.scene.rotation.y = 0;
            this.scene.add(gltf.scene);
            this.characterModel = gltf.scene;

            // console.log("--- Character Mesh & Material Names List ---");
            gltf.scene.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = true;

                const mats = Array.isArray(child.material) ? child.material : [child.material];
                // mats.forEach((m) => {
                //     if (m && m.name) {
                //         console.log(`Mesh: "${child.name}" | Material: "${m.name}"`);
                //     }
                // });

                mats.forEach((m, idx) => {
                    if (!m || !m.name || !m.name.includes('FE_helmet')) return;

                    const mapTexture = m.map || null;
                    const matColor = m.color ? m.color.clone() : new THREE.Color(0xffffff);
                    const useMapValue = mapTexture ? 1.0 : 0.0;

                    // console.log(`Applying censor shader to material: "${m.name}". Map: ${!!mapTexture}, Color: #${matColor.getHexString()}`);

                    const matInstance = this.censorMat.clone();
                    matInstance.uniforms.map.value = mapTexture;
                    matInstance.uniforms.useMap.value = useMapValue;
                    matInstance.uniforms.color.value = matColor;

                    if (Array.isArray(child.material)) child.material[idx] = matInstance;
                    else child.material = matInstance;

                    this.censorMatInstances.push(matInstance);
                });
            });

            // Set up animation mixer
            if (gltf.animations && gltf.animations.length > 0) {
                console.log("--- Character Animation Clips List ---");
                gltf.animations.forEach((clip, i) => {
                    console.log(`[Clip ${i}] Name: "${clip.name}"`);
                });
                this.mixer = new THREE.AnimationMixer(gltf.scene);
                const action = this.mixer.clipAction(gltf.animations[0]);
                action.play();
                console.log(`Playing animation: "${gltf.animations[0].name}"`);
            } else {
                console.warn("No animations found in GLTF model.");
            }
        });

        // Rim lights
        const rimColor = 0xff2200;
        const rimLight1 = new THREE.PointLight(rimColor, 6.0, 5.0);
        rimLight1.position.set(-1.0, 1.0, -0.5);
        this.scene.add(rimLight1);

        const rimLight2 = new THREE.PointLight(rimColor, 6.0, 5.0);
        rimLight2.position.set(1.0, 1.0, -0.5);
        this.scene.add(rimLight2);

        // Ambient and Directional Key light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
        dirLight.position.set(-2, 3, 2);
        this.scene.add(dirLight);

        // Atmosphere setup: Fog & Background
        this.scene.background = new THREE.Color(0x050508);
        this.scene.fog = new THREE.FogExp2(0x050508, 1.1);

        // Ground plane (Removed for dark void atmospheric look)
        // const ground = new THREE.Mesh(
        //     new THREE.PlaneGeometry(40, 40),
        //     new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0, metalness: 0.0 })
        // );
        // ground.rotation.x = -Math.PI / 2;
        // ground.position.y = 0;
        // this.scene.add(ground);

        // Title text "THROB" behind the player (Commented out - now using orthographic HUD title)
        // const fontLoader = new FontLoader();
        // fontLoader.load('src/ui/VT323.json', (font) => {
        //     const titleGeo = new TextGeometry('THROB', {
        //         font: font,
        //         size: 40,
        //         height: 40,
        //         curveSegments: 2,
        //         bevelEnabled: false
        //     });
        //     titleGeo.computeBoundingBox();
        //     const width = titleGeo.boundingBox.max.x - titleGeo.boundingBox.min.x;
        // 
        //     const scale = 0.01;
        //     const centerOffset = -0.5 * width * scale;
        // 
        //     const titleMat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        //     const titleMesh = new THREE.Mesh(titleGeo, titleMat);
        //     titleMesh.scale.set(scale, scale, scale);
        //     titleMesh.position.set(centerOffset, 1.35, -0.45);
        //     titleMesh.rotation.x = 0.35; // tilt downwards towards camera
        //     this.scene.add(titleMesh);
        // });

        // Procedural Background Smoke/Mist Plane
        const smokeGeo = new THREE.PlaneGeometry(10, 10);
        const smokeShaderMat = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0.0 },
                smokeBaseColor: { value: new THREE.Color(92 / 255, 51 / 255, 142 / 255) }, // rgb(92, 51, 142)
                smokeGlowColor: { value: new THREE.Color(211 / 255, 189 / 255, 159 / 255) }, // rgb(211, 189, 159)
                smokeGlowIntensity: { value: 0.5 },
                smokeWindSpeed: { value: 2.0 },
                smokeOpacity: { value: 0.5 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform vec3 smokeBaseColor;
                uniform vec3 smokeGlowColor;
                uniform float smokeGlowIntensity;
                uniform float smokeWindSpeed;
                uniform float smokeOpacity;
                varying vec2 vUv;
                
                float noise(in vec2 p) {
                    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
                }
                
                float smoothNoise(in vec2 p) {
                    vec2 i = floor(p);
                    vec2 f = fract(p);
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    
                    return mix(
                        mix(noise(i + vec2(0.0, 0.0)), noise(i + vec2(1.0, 0.0)), u.x),
                        mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), u.x),
                        u.y
                    );
                }
                
                float fbm(in vec2 p) {
                    float value = 0.0;
                    float amplitude = 0.5;
                    float frequency = 1.0;
                    for (int i = 0; i < 4; i++) {
                        value += amplitude * smoothNoise(p * frequency);
                        amplitude *= 0.5;
                        frequency *= 2.0;
                    }
                    return value;
                }
                
                void main() {
                    vec2 uv = vUv * 2.0;
                    vec2 drift = vec2(time * 0.05 * smokeWindSpeed, time * 0.02 * smokeWindSpeed);
                    
                    float n = fbm(uv + drift + fbm(uv - drift * 0.5));
                    
                    vec3 smokeColor = smokeBaseColor;
                    
                    float glow = smoothstep(1.0, 0.1, length(vUv - vec2(0.5, 0.1)));
                    smokeColor += smokeGlowColor * glow * n * smokeGlowIntensity;
                    
                    float edgeFade = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x) *
                                     smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
                    
                    gl_FragColor = vec4(smokeColor, edgeFade * (0.25 + n * 0.45) * smokeOpacity);
                }
            `,
            transparent: true,
            depthWrite: false
        });

        const smokePlane = new THREE.Mesh(smokeGeo, smokeShaderMat);
        smokePlane.position.set(0, 0.78, -1.2); // Positioned behind the title text and character
        this.scene.add(smokePlane);
        this.smokeMat = smokeShaderMat;
    }

    animate() {
        const delta = this.clock.getDelta();
        const time = performance.now() / 1000;

        // Update censor shader time uniforms
        if (this.censorMat) {
            this.censorMat.uniforms.time.value = time;
        }
        this.censorMatInstances.forEach(mat => {
            mat.uniforms.time.value = time;
            mat.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
        });



        // Update smoke plane time uniform
        if (this.smokeMat) {
            this.smokeMat.uniforms.time.value = time;
        }

        // Update animation mixer
        if (this.mixer) {
            this.mixer.update(delta);
        }

        // Subtle camera float drift
        if (this.camera) {
            this.camera.position.x = Math.sin(time * 0.5) * 0.03;
            this.camera.position.y = this.cameraBaseHeight + Math.cos(time * 0.5) * 0.02;
            this.camera.lookAt(0, this.cameraLookAtHeight, 0);
        }

        // Update selector cursor position dynamically to follow the active mesh (e.g. during slide-in animation)
        if (this.textManager && this.textManager.selectorCursor && this.textManager.selectorCursor.visible) {
            const activeMeshes = this.menuLogic.inRoomMenu ? this.textManager.roomMeshes : this.textManager.menuMeshes;
            const idx = this.menuLogic.selectedIndex;
            if (activeMeshes && activeMeshes[idx]) {
                const mesh = activeMeshes[idx];
                this.textManager.selectorCursor.position.x = mesh.position.x - 0.8;
                this.textManager.selectorCursor.position.y = mesh.position.y;
            }
        }

        this.composer.render(); // Render 3D scene via composer (clears automatically)

        this.renderer.autoClear = false; // Prevent UI pass from clearing composer output
        this.renderer.clearDepth();
        this.renderer.render(this.uiScene, this.uiCamera); // Render clean orthographic UI text overlay on top
        this.renderer.autoClear = true; // Restore autoClear back to true for the next frame's composer pass

        requestAnimationFrame(this.animate);
    }

    onResize() {
        const w = window.innerWidth, h = window.innerHeight;
        this.renderer.setSize(w, h);
        if (this.camera) {
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
        }
        if (this.composer) {
            this.composer.setSize(w, h);
        }
        if (this.posterPass) {
            this.posterPass.uniforms.resolution.value.set(w, h);
        }
        if (this.chromaPass) {
            this.chromaPass.uniforms['resolution'].value.set(w, h);
        }
        if (this.bloomPass) {
            this.bloomPass.setSize(w, h);
        }
    }

    addEventListeners() {
        this.boundResize = this.onResize.bind(this);
        this.boundKeyDown = (e) => this.menuLogic.handleKeyDown(e);

        window.addEventListener('resize', this.boundResize);
        window.addEventListener('keydown', this.boundKeyDown);
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
        window.removeEventListener('keydown', this.boundKeyDown);
        window.removeEventListener('resize', this.boundResize);
        document.body.removeChild(this.renderer.domElement);

        if (this._onGuiKeyDown) {
            window.removeEventListener('keydown', this._onGuiKeyDown);
        }
        if (this.gui) {
            this.gui.destroy();
        }

        // Audio cleanup
        if (this._startOnFirstClick) {
            window.removeEventListener('click', this._startOnFirstClick);
        }
        if (this.soundtrack) {
            this.soundtrack.pause();
            this.soundtrack = null;
        }
        if (this.soundtrackContainer && this.soundtrackContainer.parentNode) {
            this.soundtrackContainer.parentNode.removeChild(this.soundtrackContainer);
        }
    }

    setupSoundtrack() {
        // High quality dark space ambient track
        this.soundtrack = new Audio('https://archive.org/download/space-ambient-music/SpaceAmbientMusic.mp3');
        this.soundtrack.loop = true;
        this.soundtrack.volume = 0.4;

        // Soundtrack Player Programmatic DOM Widget
        const playerContainer = document.createElement('div');
        playerContainer.id = 'menu-soundtrack-player';
        playerContainer.style.position = 'absolute';
        playerContainer.style.bottom = '20px';
        playerContainer.style.right = '20px';
        playerContainer.style.fontFamily = "'VT323', monospace";
        playerContainer.style.fontSize = '20px';
        playerContainer.style.color = '#ff9752';
        playerContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
        playerContainer.style.border = '1px solid #ff9752';
        playerContainer.style.padding = '8px 12px';
        playerContainer.style.borderRadius = '4px';
        playerContainer.style.display = 'flex';
        playerContainer.style.alignItems = 'center';
        playerContainer.style.gap = '10px';
        playerContainer.style.zIndex = '500';
        playerContainer.style.userSelect = 'none';

        const statusLabel = document.createElement('span');
        statusLabel.innerText = 'SOUNDTRACK: PAUSED';
        statusLabel.style.letterSpacing = '1px';

        const playBtn = document.createElement('button');
        playBtn.innerText = 'PLAY';
        playBtn.style.fontFamily = "'VT323', monospace";
        playBtn.style.fontSize = '18px';
        playBtn.style.color = '#000000';
        playBtn.style.backgroundColor = '#ff9752';
        playBtn.style.border = 'none';
        playBtn.style.padding = '2px 8px';
        playBtn.style.cursor = 'pointer';
        playBtn.style.borderRadius = '2px';

        playerContainer.appendChild(statusLabel);
        playerContainer.appendChild(playBtn);
        document.body.appendChild(playerContainer);
        this.soundtrackContainer = playerContainer;

        playBtn.addEventListener('click', () => {
            if (this.soundtrack.paused) {
                this.soundtrack.play()
                    .then(() => {
                        statusLabel.innerText = 'SOUNDTRACK: PLAYING';
                        playBtn.innerText = 'PAUSE';
                    })
                    .catch(err => console.error("Audio play failed:", err));
            } else {
                this.soundtrack.pause();
                statusLabel.innerText = 'SOUNDTRACK: PAUSED';
                playBtn.innerText = 'PLAY';
            }
        });

        // Autoplay on first click interaction
        const startOnFirstClick = () => {
            if (this.soundtrack && this.soundtrack.paused) {
                this.soundtrack.play()
                    .then(() => {
                        statusLabel.innerText = 'SOUNDTRACK: PLAYING';
                        playBtn.innerText = 'PAUSE';
                    })
                    .catch(() => { });
            }
            window.removeEventListener('click', startOnFirstClick);
        };
        window.addEventListener('click', startOnFirstClick);
        this._startOnFirstClick = startOnFirstClick;
    }

    setupGUI() {
        const gui = new GUI({ title: 'Scene Tweaker (Press H to hide)' });
        this.gui = gui;

        gui.domElement.style.position = 'absolute';
        gui.domElement.style.top = '10px';
        gui.domElement.style.right = '10px';
        gui.domElement.style.zIndex = '1000';

        const params = {
            camZ: this.camera.position.z,
            camBaseY: this.cameraBaseHeight,
            camLookAtY: this.cameraLookAtHeight,

            fogDensity: this.scene.fog.density,
            fogColor: '#' + this.scene.fog.color.getHexString(),

            bloomStrength: this.bloomPass.strength,
            bloomRadius: this.bloomPass.radius,
            bloomThreshold: this.bloomPass.threshold,

            posterLevels: this.posterPass.uniforms.levels.value,
            posterStrength: this.posterPass.uniforms.strength.value,
            chromaStrength: this.chromaPass.uniforms['aberrationStrength'].value,

            smokeBase: '#' + this.smokeMat.uniforms.smokeBaseColor.value.getHexString(),
            smokeGlow: '#' + this.smokeMat.uniforms.smokeGlowColor.value.getHexString(),
            smokeGlowInt: this.smokeMat.uniforms.smokeGlowIntensity.value,
            smokeWind: this.smokeMat.uniforms.smokeWindSpeed.value,
            smokeOpacity: this.smokeMat.uniforms.smokeOpacity.value,
        };

        const fCam = gui.addFolder('Camera');
        fCam.add(params, 'camZ', 0.3, 2.0, 0.05).name('Distance Z').onChange(v => {
            this.camera.position.z = v;
        });
        fCam.add(params, 'camBaseY', 0.5, 2.0, 0.02).name('Height Y').onChange(v => {
            this.cameraBaseHeight = v;
        });
        fCam.add(params, 'camLookAtY', 0.5, 2.0, 0.02).name('LookAt Y').onChange(v => {
            this.cameraLookAtHeight = v;
        });

        const fFog = gui.addFolder('Fog');
        fFog.add(params, 'fogDensity', 0.0, 1.5, 0.05).name('Density').onChange(v => {
            this.scene.fog.density = v;
        });
        fFog.addColor(params, 'fogColor').name('Color').onChange(v => {
            const col = new THREE.Color(v);
            this.scene.fog.color.copy(col);
            this.scene.background.copy(col);
            this.renderer.setClearColor(col, 1.0);
        });

        const fBloom = gui.addFolder('Bloom');
        fBloom.add(params, 'bloomStrength', 0.0, 2.0, 0.05).name('Strength').onChange(v => {
            this.bloomPass.strength = v;
        });
        fBloom.add(params, 'bloomRadius', 0.0, 1.0, 0.05).name('Radius').onChange(v => {
            this.bloomPass.radius = v;
        });
        fBloom.add(params, 'bloomThreshold', 0.0, 1.0, 0.05).name('Threshold').onChange(v => {
            this.bloomPass.threshold = v;
        });

        const fShaders = gui.addFolder('PostFX Shaders');
        fShaders.add(params, 'posterLevels', 2.0, 32.0, 1.0).name('Poster Levels').onChange(v => {
            this.posterPass.uniforms.levels.value = v;
        });
        fShaders.add(params, 'posterStrength', 0.0, 1.0, 0.05).name('Poster Strength').onChange(v => {
            this.posterPass.uniforms.strength.value = v;
        });
        fShaders.add(params, 'chromaStrength', 0.0, 0.02, 0.0005).name('Chroma Strength').onChange(v => {
            this.chromaPass.uniforms['aberrationStrength'].value = v;
        });

        const fSmoke = gui.addFolder('Background Smoke');
        fSmoke.addColor(params, 'smokeBase').name('Base Color').onChange(v => {
            this.smokeMat.uniforms.smokeBaseColor.value.copy(new THREE.Color(v));
        });
        fSmoke.addColor(params, 'smokeGlow').name('Glow Color').onChange(v => {
            this.smokeMat.uniforms.smokeGlowColor.value.copy(new THREE.Color(v));
        });
        fSmoke.add(params, 'smokeGlowInt', 0.0, 5.0, 0.1).name('Glow Intensity').onChange(v => {
            this.smokeMat.uniforms.smokeGlowIntensity.value = v;
        });
        fSmoke.add(params, 'smokeWind', 0.0, 5.0, 0.1).name('Wind Speed').onChange(v => {
            this.smokeMat.uniforms.smokeWindSpeed.value = v;
        });
        fSmoke.add(params, 'smokeOpacity', 0.0, 2.0, 0.05).name('Opacity').onChange(v => {
            this.smokeMat.uniforms.smokeOpacity.value = v;
        });

        this._onGuiKeyDown = (e) => {
            if (e.code === 'KeyH') {
                if (gui.domElement.style.display === 'none') {
                    gui.domElement.style.display = 'block';
                } else {
                    gui.domElement.style.display = 'none';
                }
            }
        };
        window.addEventListener('keydown', this._onGuiKeyDown);
    }
}

