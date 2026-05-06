import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export class TextManager {
    constructor(scene, onReady = () => { }) {
        this.scene = scene;
        this.fontLoader = new FontLoader();

        this.menuMeshes = [];
        this.roomMeshes = [];
        this.codeMesh = null;

        this.selectedColor = 0xffeb78;
        this.defaultColor = 0xffffff;

        this.fontLoader.load('src/ui/VT323.json', (font) => {
            this.font = font;
            onReady(); // Now safe to spawn text
        });
    }

    createMenuOptions(options, offsetY = -3, visible = true, animateIn = true) {
        this.clearText();
        this.menuMeshes = options.map((text, i) => {
            const mesh = this._makeTextMesh(text);
            const targetX = -8.5;
            mesh.position.set(animateIn ? 20 : targetX, offsetY - i * 1.5, -1);
            mesh.visible = true;
            this.scene.add(mesh);

            if (animateIn) {
                this._animateMeshPosition(mesh, targetX, 0.5);
            }

            return mesh;
        });

        return this.menuMeshes;
    }


    updateSelection(meshes, selectedIndex) {
        meshes.forEach((mesh, i) => {
            if (i === selectedIndex) {
                mesh.scale.set(0.02, 0.028, 0.02);
                mesh.material.color.set(this.selectedColor);
            } else {
                mesh.scale.set(0.02, 0.02, 0.02);
                mesh.material.color.set(this.defaultColor);
            }
        });
    }

    updateCodeText(code, position) {
        if (!this.font) return;
        if (this.codeMesh) this.scene.remove(this.codeMesh);

        const padded = code.padEnd(4, '_');
        const geo = new TextGeometry(padded, {
            font: this.font,
            size: 40,
            height: 40,
            curveSegments: 1,
            bevelEnabled: false
        });

        const mat = new THREE.MeshBasicMaterial({ color: this.selectedColor });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(0.02, 0.02, 0.02);
        mesh.position.copy(position);
        this.codeMesh = mesh;
        this.scene.add(mesh);
    }

    clearText() {
        [...this.menuMeshes, ...this.roomMeshes, this.codeMesh].forEach(m => {
            if (m) this.scene.remove(m);
        });
        this.menuMeshes = [];
        this.roomMeshes = [];
        this.codeMesh = null;
    }

    _makeTextMesh(text) {
        const geo = new TextGeometry(text, {
            font: this.font,
            size: 40,
            height: 40,
            curveSegments: 1,
            bevelEnabled: false
        });
        const mat = new THREE.MeshBasicMaterial({ color: this.defaultColor });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(0.02, 0.02, 0.02);
        return mesh;
    }

    _animateMeshPosition(mesh, targetX, duration = 0.5) {
        const startX = mesh.position.x;
        const start = performance.now();

        const animate = (now) => {
            const t = Math.min((now - start) / (duration * 1000), 1);
            mesh.position.x = THREE.MathUtils.lerp(startX, targetX, t);
            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

}