import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export class TextManager {
    constructor(scene, camera, onReady = () => { }) {
        this.scene = scene;
        this.camera = camera;
        this.fontLoader = new FontLoader();

        this.menuMeshes = [];
        this.roomMeshes = [];
        this.codeMesh = null;

        this.selectedColor = 0xffeb78;
        this.defaultColor = 0xffffff;
        this.menuScaleFactor = 0.7;

        this.fontLoader.load('src/ui/VT323.json', (font) => {
            this.font = font;

            // Create selector cursor mesh
            const cursorGeo = new TextGeometry('>', {
                font: this.font,
                size: 40,
                height: 1,
                curveSegments: 1,
                bevelEnabled: false
            });
            const cursorMat = new THREE.MeshBasicMaterial({ color: this.selectedColor });
            this.selectorCursor = new THREE.Mesh(cursorGeo, cursorMat);
            const cursorScale = 0.02 * this.menuScaleFactor;
            this.selectorCursor.scale.set(cursorScale, cursorScale, cursorScale);
            this.selectorCursor.visible = false;
            this.scene.add(this.selectorCursor);

            // Create the static HUD decoration and title
            this.createHUD();

            onReady(); // Now safe to spawn text
        });
    }

    createHUD() {
        if (!this.font) return;

        if (this.hudMeshes) {
            this.hudMeshes.forEach(mesh => this.scene.remove(mesh));
        }
        this.hudMeshes = [];

        // 1. Large Game Title: THROB
        const titleMesh = this._makeHUDText('THROB', -9, -2.5, 0.055, 0xff0055);
        this.hudMeshes.push(titleMesh);
    }

    _makeHUDText(text, x, y, scale = 0.015, color = 0x888888) {
        const geo = new TextGeometry(text, {
            font: this.font,
            size: 40,
            height: 1,
            curveSegments: 1,
            bevelEnabled: false
        });
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(scale, scale, scale);
        mesh.position.set(x, y, -1);
        this.scene.add(mesh);
        return mesh;
    }

    createMenuOptions(options, offsetY = -7.0, visible = true, animateIn = true) {
        this.clearText();

        const isPerspective = this.camera && this.camera.isPerspectiveCamera;
        const scale = isPerspective ? 0.0012 : 0.02 * this.menuScaleFactor;
        const startX = isPerspective ? -0.28 : -8.0;
        const offsetStep = isPerspective ? 0.055 : 1.5 * this.menuScaleFactor;
        const yBase = isPerspective ? 1.05 : offsetY;
        const zPos = isPerspective ? 0.5 : -1;
        const animStartX = isPerspective ? -1.0 : 20;

        this.menuMeshes = options.map((text, i) => {
            const mesh = this._makeTextMesh(text);
            mesh.scale.set(scale, scale, scale);
            mesh.position.set(animateIn ? animStartX : startX, yBase - i * offsetStep, zPos);
            mesh.visible = true;
            this.scene.add(mesh);

            if (animateIn) {
                this._animateMeshPosition(mesh, startX, 0.5);
            }

            return mesh;
        });

        return this.menuMeshes;
    }


    updateSelection(meshes, selectedIndex) {
        if (!meshes || meshes.length === 0) {
            if (this.selectorCursor) this.selectorCursor.visible = false;
            return;
        }
        const isPerspective = this.camera && this.camera.isPerspectiveCamera;
        const scale = isPerspective ? 0.0012 : 0.02 * this.menuScaleFactor;
        const scaleY = isPerspective ? 0.0017 : 0.028 * this.menuScaleFactor;

        meshes.forEach((mesh, i) => {
            if (i === selectedIndex) {
                mesh.scale.set(scale, scaleY, scale);
                mesh.material.color.set(this.selectedColor);
                if (this.selectorCursor) {
                    this.selectorCursor.position.set(mesh.position.x - 0.8, mesh.position.y, mesh.position.z);
                    this.selectorCursor.visible = mesh.visible;
                }
            } else {
                mesh.scale.set(scale, scale, scale);
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

        const isPerspective = this.camera && this.camera.isPerspectiveCamera;
        const scale = isPerspective ? 0.0012 : 0.02 * this.menuScaleFactor;

        let adjustedPos = position.clone();
        if (isPerspective) {
            const idx = Math.round((-3 - position.y) / 1.5);
            adjustedPos.set(0.1, 1.05 - idx * 0.055, 0.5);
        } else {
            // Adjust the Y position to match the bottom-left layout
            const idx = Math.round((-3 - position.y) / 1.5);
            adjustedPos.y = -7.0 - idx * (1.5 * this.menuScaleFactor);
        }

        const mat = new THREE.MeshBasicMaterial({ color: this.selectedColor });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.set(scale, scale, scale);
        mesh.position.copy(adjustedPos);
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
        if (this.selectorCursor) this.selectorCursor.visible = false;
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
        const isPerspective = this.camera && this.camera.isPerspectiveCamera;
        const scale = isPerspective ? 0.0012 : 0.02 * this.menuScaleFactor;
        mesh.scale.set(scale, scale, scale);
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

        const reqId = requestAnimationFrame(animate);
    }

}