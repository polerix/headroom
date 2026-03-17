import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

export class AvatarManager {
    constructor(scene) {
        this.scene = scene;
        this.avatarGroup = new THREE.Group();
        this.scene.add(this.avatarGroup);

        this.vrm = null;
        this.model = null;
        this.bones = {
            head: null,
            neck: null,
            spine: null,
            leftEye: null,
            rightEye: null
        };
        this.morphTargets = {}; // Map of blendshape name to { mesh, index }
    }

    async loadModel(url) {
        return new Promise((resolve, reject) => {
            const loader = new GLTFLoader();
            loader.register((parser) => new VRMLoaderPlugin(parser));

            loader.load(url, (gltf) => {
                if (this.model) {
                    this.avatarGroup.remove(this.model);
                }

                this.vrm = gltf.userData.vrm;

                if (this.vrm) {
                    this.model = this.vrm.scene;
                    VRMUtils.removeUnnecessaryJoints(this.model);
                    this.avatarGroup.add(this.model);

                    document.querySelector('.system-status').innerText = 'SYSTEM_ONLINE /// VRM_LOADED';
                    resolve(this.model);
                } else {
                    // Standard GLTF fallback
                    this.model = gltf.scene;
                    this.avatarGroup.add(this.model);

                    // Parse Bones and Blendshapes
                    this.parseHierarchy(this.model);

                    if (!this.bones.head) {
                        console.warn("Avatar is missing standard 'Head' bone");
                    }

                    document.querySelector('.system-status').innerText = 'SYSTEM_ONLINE /// AVATAR_LOADED';
                    resolve(this.model);
                }
            }, undefined, reject);
        });
    }

    update(deltaTime) {
        if (this.vrm) {
            this.vrm.update(deltaTime);
        }
    }

    parseHierarchy(node) {
        // Find standard VRM/Mixamo bones by name
        const nodeName = node.name.toLowerCase();

        if (node.isBone) {
            if (nodeName.includes('head')) this.bones.head = node;
            else if (nodeName.includes('neck')) this.bones.neck = node;
            else if (nodeName.includes('spine')) this.bones.spine = node;
            else if (nodeName.includes('lefteye')) this.bones.leftEye = node;
            else if (nodeName.includes('righteye')) this.bones.rightEye = node;
        }

        // Find Morph Targets
        if (node.isMesh && node.morphTargetDictionary) {
            for (const [name, index] of Object.entries(node.morphTargetDictionary)) {
                this.morphTargets[name] = { mesh: node, index: index };
            }
        }

        node.children.forEach(child => this.parseHierarchy(child));
    }

    setBlendshape(name, value) {
        if (this.vrm && this.vrm.expressionManager) {
            this.vrm.expressionManager.setValue(name, value);
        } else {
            const target = this.morphTargets[name];
            if (target) {
                target.mesh.morphTargetInfluences[target.index] = value;
            }
        }
    }

    setBoneRotation(boneName, euler) {
        if (this.vrm && this.vrm.humanoid) {
            const boneNode = this.vrm.humanoid.getNormalizedBoneNode(boneName);
            if (boneNode) {
                // VRM bones might have different resting orientations
                boneNode.rotation.copy(euler);
            }
        } else {
            const bone = this.bones[boneName];
            if (bone) {
                bone.rotation.copy(euler);
            }
        }
    }
}
