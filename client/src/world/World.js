import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Octree } from 'three/examples/jsm/math/Octree.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

export default class World {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.worldOctree = new Octree();
        this.isLoaded = false;
        this.map = null;

        // Initialize RectAreaLight shaders
        RectAreaLightUniformsLib.init();

        this.loadWorldModel();
        this.addLighting();
    }

    loadWorldModel() {
        this.loader.load('src/art/models/maps/bunker2/updated-bunker.glb', (gltf) => {
            const model = gltf.scene;
            this.map = model;

            // Scale the map model group to properly fit player proportions
            const mapScale = 1.15;
            model.scale.set(mapScale, mapScale, mapScale);
            model.position.set(0, 0, 0);

            console.log("Loaded bunker map with scale:", model.scale);

            // Generate optimized filtered octree for collisions
            this.buildFilteredOctree(model);

            // Spawn localized point lights at map light fixtures (bulbs, tubes, lanterns)
            this.spawnMapLights(model);

            // Optimize rendering by auto-instancing repeating props
            this.autoInstanceModel(model);

            // Add the model containing the remaining unique meshes to the scene
            this.scene.add(model);

            this.isLoaded = true;
        }, undefined, (err) => {
            console.error('Failed to load world:', err);
        });
    }

    buildFilteredOctree(model) {
        model.updateWorldMatrix(true, true);

        let keptTriangles = 0;
        let excludedCount = 0;

        model.traverse((child) => {
            if (child.isMesh) {
                const name = (child.name || '').toLowerCase();

                // Exclude list (lettuce plants, cables, wires, decorative props, details, etc.)
                const shouldExclude =
                    name.includes('plant') ||
                    name.includes('vegetation') ||
                    name.includes('leaf') ||
                    name.includes('leaves') ||
                    name.includes('cable') ||
                    name.includes('pipe') ||
                    name.includes('wire') ||
                    name.includes('light') ||
                    name.includes('bulb') ||
                    name.includes('fixture') ||
                    name.includes('screen') ||
                    name.includes('keyboard') ||
                    name.includes('decal') ||
                    name.includes('glass') ||
                    name.includes('dust') ||
                    name.includes('paper') ||
                    name.includes('garbage') ||
                    name.includes('trash') ||
                    name.includes('prop') ||
                    name.includes('detail') ||
                    name.includes('bottle') ||
                    name.includes('computer');

                if (shouldExclude) {
                    excludedCount++;
                    return;
                }

                let geometry;
                let isBufferGeometry = false;

                if (child.geometry.index !== null) {
                    geometry = child.geometry.toNonIndexed();
                    isBufferGeometry = true;
                } else {
                    geometry = child.geometry;
                }

                const positionAttribute = geometry.getAttribute('position');
                for (let i = 0; i < positionAttribute.count; i += 3) {
                    const v1 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
                    const v2 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 1);
                    const v3 = new THREE.Vector3().fromBufferAttribute(positionAttribute, i + 2);

                    v1.applyMatrix4(child.matrixWorld);
                    v2.applyMatrix4(child.matrixWorld);
                    v3.applyMatrix4(child.matrixWorld);

                    this.worldOctree.addTriangle(new THREE.Triangle(v1, v2, v3));
                    keptTriangles++;
                }

                if (isBufferGeometry) {
                    geometry.dispose();
                }
            }
        });

        const startTime = performance.now();
        this.worldOctree.build();
        const buildTime = performance.now() - startTime;

        console.log(`[Octree Optimizer] Built collision octree in ${buildTime.toFixed(1)}ms`);
        console.log(`[Octree Optimizer] Kept triangles: ${keptTriangles}, Excluded meshes: ${excludedCount}`);
    }

    autoInstanceModel(model) {
        model.updateMatrixWorld(true);

        const groups = new Map();

        // 1. Group meshes by a unique combination of geometry and material reference
        model.traverse((child) => {
            if (child.isMesh) {
                const geo = child.geometry;
                const mat = child.material;
                if (!geo || !mat) return;

                // Create a unique key for grouping
                const key = `${geo.uuid}_${mat.uuid || mat.name || 'default'}`;

                if (!groups.has(key)) {
                    groups.set(key, {
                        geometry: geo,
                        material: mat,
                        meshes: []
                    });
                }
                groups.get(key).meshes.push(child);
            }
        });

        console.log(`[Auto-Instancer] Grouped scene meshes into ${groups.size} unique geometry-material bundles.`);

        let instancedCount = 0;
        let originalMeshCount = 0;

        // 2. Convert repeating meshes into high-performance InstancedMesh objects
        groups.forEach((groupInfo, key) => {
            const meshes = groupInfo.meshes;

            // Only instance if there are 3 or more occurrences of the mesh
            if (meshes.length >= 3) {
                const count = meshes.length;
                const instancedMesh = new THREE.InstancedMesh(groupInfo.geometry, groupInfo.material, count);

                instancedMesh.castShadow = true;
                instancedMesh.receiveShadow = true;

                meshes.forEach((mesh, index) => {
                    instancedMesh.setMatrixAt(index, mesh.matrixWorld);

                    // Hide the original mesh so it is not rendered twice
                    mesh.visible = false;
                });

                this.scene.add(instancedMesh);
                instancedCount++;
                originalMeshCount += count;
            }
        });

        console.log(`[Auto-Instancer] Replaced ${originalMeshCount} individual meshes with ${instancedCount} InstancedMesh objects.`);
    }

    spawnMapLights(model) {
        const lightNodes = [];

        model.traverse((child) => {
            if (child.name) {
                const name = child.name.toLowerCase();

                // Match point lights, spot lights, or lamp meshes
                const isLightPlaceholder =
                    name.includes('_point_light') ||
                    name.includes('point_light_') ||
                    name.includes('_spot_light') ||
                    name.includes('lamp04') ||
                    name.includes('lantern');

                if (isLightPlaceholder) {
                    const pos = new THREE.Vector3();
                    child.getWorldPosition(pos);

                    // Prevent spawning multiple lights too close to each other (minimum 8 meters apart)
                    const tooClose = lightNodes.some(n => n.position.distanceTo(pos) < 8.0);
                    if (!tooClose) {
                        lightNodes.push({ name: child.name, position: pos });
                    }
                }
            }
        });

        // Limit the number of active lights to 25 for optimal performance
        const maxLights = 25;
        const selectedNodes = lightNodes.slice(0, maxLights);
        let spawnedCount = 0;

        selectedNodes.forEach((node) => {
            const name = node.name.toLowerCase();
 
            // Tube lights / Fluorescents (lamp04_d, lamp04_f, lamp04_g) -> cool white (a lil blue)
            // Lanterns, bulbs, or E-type lamps (lamp04_e) -> yellowish gold
            let color = 0xd9ebff; // cool white (a lil blue)
            let intensity = 1.2;
            let distance = 16.0;

            const isTube = name.includes('tube') || name.includes('lamp04_d') || name.includes('lamp04_f') || name.includes('lamp04_g');

            if (name.includes('lantern') || name.includes('bulb') || name.includes('_e_')) {
                color = 0xffa600; // yellowish gold color
                intensity = 1.5;
                distance = 15.0;
            } else if (name.includes('red')) {
                color = 0xff4444; // warning lights
                intensity = 1.6;
                distance = 12.0;
            }

            if (isTube) {
                // Create a rectangular area light for tube fixtures (pointing straight down)
                // Width = 3.0m (along X/Z), Height = 0.3m, Intensity scaled up for area light
                const rectLight = new THREE.RectAreaLight(color, intensity * 5.0, 3.0, 0.3);
                rectLight.position.copy(node.position);
                
                // Shift down slightly to prevent intersecting mesh faces
                rectLight.position.y -= 0.35;
                
                // Rotate Z-axis to face straight down
                rectLight.rotation.x = - Math.PI / 2;
                
                this.scene.add(rectLight);
                spawnedCount++;
            } else {
                // Create a point light for bulbs, lanterns, and warning points
                const light = new THREE.PointLight(color, intensity, distance);
                light.position.copy(node.position);

                // Shift ceiling light sources slightly down from the fixture geometry to prevent shadowing
                if (name.includes('lamp04') || name.includes('tube')) {
                    light.position.y -= 0.6;
                }

                this.scene.add(light);
                spawnedCount++;
            }
        });

        console.log(`[Light Spawner] Dynamically spawned ${spawnedCount} point lights at map fixtures.`);
    }

    addLighting() {
        // Reduced ambient filling for a dark, dreamy, and scary atmosphere
        const fillLight1 = new THREE.HemisphereLight(0x1a0f26, 0x000000, 0.6);
        fillLight1.position.set(2, 1, 1);
        this.scene.add(fillLight1);

        // Faint, cold moonlight directional light
        const directionalLight = new THREE.DirectionalLight(0x8899aa, 0.95);
        directionalLight.position.set(-5, 25, -1);
        directionalLight.castShadow = true;

        directionalLight.shadow.camera.near = 0.01;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        directionalLight.shadow.mapSize.set(1024, 1024);
        directionalLight.shadow.radius = 4;
        directionalLight.shadow.bias = -0.00006;

        this.scene.add(directionalLight);
    }

    update(delta) {
        // No animations or active entities to update in the static world
    }

    getOctree() {
        return this.worldOctree;
    }
}
