import { State } from "./state";
import { Action } from "./actions";
import { Entity } from "./entities";

/**
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function update(state, dispatch) {
    updateTime(state);

    state.entities.forEach(entity => {
        gravitySystem(entity, state, dispatch);
        controllerSystem(entity, state, dispatch);
        physicsSystem(entity, state, dispatch);
    });
}

/**
 * @param {State} state
 */
export function updateTime(state) {
    const { time } = state;
    const elapsed = Date.now() - time.start;
    time.delta = elapsed - time.elapsed;
    time.elapsed = elapsed;
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function gravitySystem(entity, state, dispatch) {
    const { velocity } = entity;
    if (velocity) {
        velocity.y -= 0.001;
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function controllerSystem(entity, state, dispatch) {
    const { controller, velocity, mesh } = entity;

    if (controller && velocity && mesh) {
        const input = controller.input;

        // vetical movement - jumping

        // Horizontal movement
        velocity.z = (input.forward ? -1 : 0) + (input.back ? 1 : 0);
        velocity.x = (input.left ? -1 : 0) + (input.right ? 1 : 0);

        if (velocity.z !== 0 || velocity.x !== 0) {
            let angle = Math.atan2(velocity.x, velocity.z);
            angle = angle > 0 ? angle : angle + 2 * Math.PI;
            angle += mesh.body.rotation.y;

            velocity.z = Math.cos(angle);
            velocity.x = Math.sin(angle);
        }

        velocity.z *= controller.speed;
        velocity.x *= controller.speed;
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function physicsSystem(entity, state, dispatch) {
    const { mesh, velocity } = entity;
    if (mesh && velocity) {
        if (mesh.body.position.y <= 0) {
            mesh.body.position.y = 0;
            velocity.y = 0;
        }

        mesh.body.position.x += velocity.x * state.time.delta;
        mesh.body.position.z += velocity.z * state.time.delta;
        mesh.body.position.y += velocity.y * state.time.delta;
    }
}
