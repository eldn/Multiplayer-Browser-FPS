import * as THREE from "three";
import { Player, Entity } from "./entities.js";
import random from "lodash/random";

export class State {
    constructor() {
        this.time = { start: 0, elapsed: 0, delta: 0 };

        /**
         * @type {THREE.Scene}
         */
        this.scene = new THREE.Scene();

        /**
         * @type {string[]}
         */
        this.playerIds = [];

        /**
         * @type {Map<string,Player>}
         */
        this.entities = new Map();

        /**
         * @type {THREE.PerspectiveCamera}
         */
        this.camera = new THREE.PerspectiveCamera(90, 1);

        // Add a floor
        const geometry = new THREE.BoxGeometry(10, 1, 10);
        const material = new THREE.MeshNormalMaterial();
        const floor = new THREE.Mesh(geometry, material);
        floor.position.y = -0.5;
        this.scene.add(floor);

        // Create random cubes, for orientation
        const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        for (let i = 0; i < 500; i++) {
            const box = new THREE.Mesh(boxGeometry, material);
            box.position.y = random(-50, 50);
            box.position.x = random(-50, 50);
            box.position.z = random(-50, 50);
            this.scene.add(box);
        }
    }

    /**
     * @param {Entity} entity
     */
    addEntity(entity) {
        if (this.entities.has(entity.id)) {
            this.deleteEntity(entity.id);
        }
        if (entity.body) {
            this.scene.add(entity.body);
        }
        this.entities.set(entity.id, entity);
    }

    /**
     * @param {string} id
     * @returns {Entity}
     */
    getEntity(id) {
        return this.entities.get(id) || Entity.empty;
    }

    /**
     * @param {string} id
     */
    deleteEntity(id) {
        const entity = this.getEntity(id);
        if (entity.body) {
            this.scene.remove(entity.body);
        }
        this.entities.delete(id);
    }
}
