import * as THREE from "three";
import { AABB } from "./utils";

export class DecayComponent {
    constructor(ttl = 0) {
        this.ttl = ttl;
    }
}

export class ControllerComponent {
    constructor() {
        this.speed = 0.01;
        this.input = {
            forward: false,
            left: false,
            back: false,
            right: false,
            jump: false
        };
    }
}

export class VelocityComponent extends THREE.Vector3 {
    constructor() {
        super(0, 0, 0);
    }

    /**
     * @param {number} delta
     */
    getForceVector(delta) {
        return new THREE.Vector3(
            this.x * delta,
            this.y * delta,
            this.z * delta
        );
    }
}

export class ColliderComponent {
    constructor() {
        this.floor = true;
    }
}

export class JetpackComponent {
    constructor() {
        this.maxFuel = 2000;
        this.minFuel = -1000;
        this.fuel = this.maxFuel;
    }
}

export class HealthComponent {
    constructor() {
        this.hp = this.max = 100;
    }
}

export class DamageComponent {
    constructor() {
        this.creatorId = "";
        this.dmg = 5;
    }
}

export class Object3DComponent extends THREE.Object3D {
    constructor() {
        super();
        this.radius = new THREE.Vector3(1, 1, 1);

        // Debug
        const debug = true;
        if (debug) {
            const geometry = new THREE.BoxGeometry(
                this.radius.x * 2,
                this.radius.y * 2,
                this.radius.z * 2
            );
            const geo = new THREE.WireframeGeometry(geometry); // or WireframeGeometry( geometry )
            const mat = new THREE.LineBasicMaterial({
                color: 0xffffff,
                linewidth: 2
            });
            const wireframe = new THREE.LineSegments(geo, mat);
            this.add(wireframe);
        }
    }

    getAABB() {
        return new AABB(
            new THREE.Vector3(
                this.position.x - this.radius.x,
                this.position.y - this.radius.y,
                this.position.z - this.radius.z
            ),
            new THREE.Vector3(
                this.position.x + this.radius.x,
                this.position.y + this.radius.y,
                this.position.z + this.radius.z
            )
        );
    }
}

export class HeadComponent extends THREE.Object3D {
    constructor() {
        super();
        this.position.y = 2;
        this.position.z = 0;
    }

    getFacingDirection() {
        const direction = new THREE.Vector3(0, 0, -1);
        const matrix = new THREE.Matrix4();
        matrix.extractRotation(this.matrixWorld);
        return matrix.multiplyVector3(direction);
    }
}
