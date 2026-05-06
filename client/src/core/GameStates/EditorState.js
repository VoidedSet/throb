import * as THREE from 'three';
import { FlyControls } from 'three/examples/jsm/Addons.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import GUI from 'lil-gui';
import { GameState } from './GameState';

export class EditorState extends GameState {
    constructor(engine) {
        super(engine);
        this.scene = engine.scene;
        this.camera = engine.waitingCamera;
        this.renderer = engine.renderer;
        this.engine.renderer.setCamera(this.camera);

        this.controls = null;
        this.transformControls = null;
        this.gui = new GUI();
        this.selectedMesh = null;
        this.originalMaterials = new Map();
    }

    enter() {
        // Orbit Controls
        this.controls = new FlyControls(this.camera, this.renderer.domElement);
        this.controls.movementSpeed = 10;
        this.controls.rollSpeed = Math.PI / 12;
        this.controls.dragToLook = true;

        // Transform Controls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.scene.add(this.transformControls);

        this.transformControls.addEventListener('dragging-changed', (e) => {
            this.controls.enabled = !e.value;
        });
        this.transformControls.addEventListener('change', () => this.renderer.render(this.scene, this.camera));

        // Keybindings T/R/S to change modes
        window.addEventListener('keydown', this.handleKeydown);

        // Build GUI
        setTimeout(() => {
            this.buildMeshGUI();
            this.renderer.render(this.scene, this.camera);
        }, 500);
    }

    exit() {
        this.controls.dispose();
        this.transformControls.detach();
        this.scene.remove(this.transformControls);
        this.gui.destroy();
        this.clearHighlight();
        window.removeEventListener('keydown', this.handleKeydown);
    }

    update(deltaTime) {
        this.controls.update(deltaTime); // deltaTime from animate loop
    }

    handleKeydown = (e) => {
        switch (e.key.toLowerCase()) {
            case 't': this.transformControls.setMode('translate'); break;
            case 'r': this.transformControls.setMode('rotate'); break;
            case 's': this.transformControls.setMode('scale'); break;
            case 'escape':
                this.transformControls.detach();
                this.clearHighlight();
                break;
        }
    }

    buildMeshGUI() {
        const meshList = {};
        this.scene.traverse((obj) => {
            if (obj.isMesh) {
                const name = obj.name || obj.uuid;
                meshList[name] = () => this.selectMesh(obj);
            }
        });

        const folder = this.gui.addFolder('Scene Meshes');
        Object.keys(meshList).forEach((n) => {
            folder.add(meshList, n);
        });
    }

    selectMesh(mesh) {
        this.clearHighlight();
        this.originalMaterials.set(mesh.uuid, mesh.material);

        mesh.material = mesh.material.clone();
        mesh.material.emissive = new THREE.Color(0x4444ff);
        mesh.material.emissiveIntensity = 0.6;

        this.selectedMesh = mesh;
        this.transformControls.attach(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        this.controls.target.copy(box.getCenter(new THREE.Vector3()));
        this.transformControls.attach(mesh)
    }

    clearHighlight() {
        if (this.selectedMesh && this.originalMaterials.has(this.selectedMesh.uuid)) {
            this.selectedMesh.material = this.originalMaterials.get(this.selectedMesh.uuid);
        }
        this.originalMaterials.clear();
        this.selectedMesh = null;
        this.transformControls.detach();
    }
}
