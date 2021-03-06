import * as THREE from "three";
import { State } from "./state";
import {
    Action,
    hitPlayer,
    serverAction,
    killPlayer,
    spawnPlayer,
    syncPlayerScore,
    clientAction,
    eventMessage
} from "./actions";
import { Entity } from "./entities";
import { AABB, hitScan } from "./utils";
import { GRAVITY, DEBUG } from "./consts";
import sample from "lodash/sample";

/**
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function update(state, dispatch) {
    updateTime(state);
    state.particles.update(state.time.delta);

    // Systems
    state.forEachEntity(entity => {
        if (entity.sleep) return;
        respawnSystem(entity, state, dispatch);
        playerControllerSystem(entity, state, dispatch);
        activeCameraSystem(entity, state, dispatch);
        gravitySystem(entity, state, dispatch);
        shootingSystem(entity, state, dispatch);
        reloadingSystem(entity, state, dispatch);
        physicsSystem(entity, state, dispatch);
        povAnimationSystem(entity, state, dispatch);

        // Update input
        if (entity.player) {
            Object.assign(entity.player.prevInput, entity.player.input);
        }
    });

    // Update messages
    let removeMsg = false;
    state.messages.forEach(row => {
        row.ttl -= state.time.delta;
        removeMsg = removeMsg || row.ttl < 0;
    });

    if (removeMsg) {
        state.messages = state.messages.filter(row => row.ttl > 0);
    }
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
export function respawnSystem(entity, state, dispatch) {
    const { player } = entity;
    if (player && player.respawnTimer > 0) {
        player.respawnTimer -= state.time.delta;
        if (player.respawnTimer <= 0) {
            player.respawnTimer = 0;
            const spawn = DEBUG
                ? state.playerSpawns[0]
                : sample(state.playerSpawns);

            dispatch(serverAction(spawnPlayer(player.id, spawn)));
        }
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function gravitySystem(entity, state, dispatch) {
    const { gravity, velocity } = entity;
    if (gravity && velocity) {
        velocity.y -= GRAVITY * state.time.delta;
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function playerControllerSystem(entity, state, dispatch) {
    const { player, stats, velocity, object3D } = entity;

    if (player && stats && velocity && object3D) {
        const input = player.input;

        // Reset state
        player.state = "idle";

        if (entity.collider) {
            if (input.jump && entity.collider.bottom()) {
                velocity.y = stats.jumpSpeed;
                input.jump = false;
            }
        } else {
            if (input.down) {
                velocity.y = -stats.runSpeed;
            } else if (input.jump) {
                velocity.y = stats.runSpeed;
            } else {
                velocity.y = 0;
            }
        }

        // Horizontal movement
        velocity.z = (input.forward ? -1 : 0) + (input.back ? 1 : 0);
        velocity.x = (input.left ? -1 : 0) + (input.right ? 1 : 0);
        velocity.x = velocity.x * 0.5;

        if (velocity.z !== 0 || velocity.x !== 0) {
            let angle = Math.atan2(velocity.x, velocity.z);
            angle = angle > 0 ? angle : angle + 2 * Math.PI;
            angle += object3D.rotation.y;

            velocity.z = Math.cos(angle);
            velocity.x = Math.sin(angle);

            player.state = "running";
        }

        velocity.z *= stats.runSpeed;
        velocity.x *= stats.runSpeed;
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function activeCameraSystem(entity, state, dispatch) {
    const { player, health } = entity;
    if (entity.id === state.playerId && player && health === undefined) {
        if (player.pressed("jump")) {
            const alivePlayers = state
                .getEntityGroup("player")
                .filter(p => p.health);
            const enemyPlayer = sample(alivePlayers);
            if (enemyPlayer) {
                state.setPovEntity(enemyPlayer.id);
            }
        }
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function shootingSystem(entity, state, dispatch) {
    const { weapon, player, stats, playerModel } = entity;
    if (weapon && player && stats && playerModel) {
        if (weapon.firerateTimer > 0) {
            player.state = "shooting";
            weapon.firerateTimer -= state.time.delta;
        }

        if (
            player.input.shoot &&
            weapon.firerateTimer <= 0 &&
            weapon.reloadTimer === 0 &&
            weapon.loadedAmmo > 0
        ) {
            weapon.loadedAmmo = Math.max(weapon.loadedAmmo - 1, 0);
            weapon.firerateTimer = stats.firerate;

            const hitscan = hitScan(playerModel.camera, state, player.id);

            if (hitscan.entity && hitscan.entity.health) {
                const target = hitscan.entity;
                const health = target.health - 10;
                if (health > 0) {
                    const sync = a => dispatch(clientAction(entity.id, a));
                    sync(hitPlayer(target.id, health));
                } else {
                    const sync = a => dispatch(serverAction(a));

                    const killer = entity;
                    if (killer && killer.player) {
                        const { id, kills, deaths } = killer.player;
                        sync(syncPlayerScore(id, kills + 1, deaths));
                    }

                    if (target.player) {
                        const { id, kills, deaths } = target.player;
                        sync(syncPlayerScore(id, kills, deaths + 1));
                    }

                    if (killer && killer.player && target.player) {
                        const killerName = killer.player.name;
                        const targetName = target.player.name;
                        const msg = `${killerName} >>> ${targetName}`;
                        sync(eventMessage(msg));
                    }

                    sync(killPlayer(target.id));
                }
            }

            // Particles
            if (hitscan.entity) {
                if (hitscan.entity.health) {
                    state.particles.bulletImpactPlayer(
                        new THREE.Vector3(...hitscan.origin),
                        new THREE.Vector3(...hitscan.point)
                    );
                } else {
                    state.particles.bulletImpactWall(
                        new THREE.Vector3(...hitscan.origin),
                        new THREE.Vector3(...hitscan.point)
                    );
                }
            }

            if (false) {
                // Bullet trace
                const p1 = new THREE.Vector3(...hitscan.origin);
                const p2 = new THREE.Vector3(...hitscan.point);

                const material = new THREE.LineBasicMaterial({
                    color: 0x0000ff
                });

                const geometry = new THREE.Geometry();
                geometry.vertices.push(p1, p2);

                const line = new THREE.Line(geometry, material);
                state.scene.add(line);
                setTimeout(() => {
                    state.scene.remove(line);
                }, 500);
            }
        }
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function reloadingSystem(entity, state, dispatch) {
    const { weapon, player, stats } = entity;
    if (weapon && player && stats) {
        const canReload =
            weapon.reloadTimer === 0 &&
            weapon.reservedAmmo > 0 &&
            weapon.loadedAmmo < stats.maxLoadedAmmo;

        if (canReload && (player.input.reload || weapon.loadedAmmo === 0)) {
            weapon.reloadTimer = stats.reloadSpeed;
        }

        const isRelaoding = weapon.reloadTimer > 0;
        if (isRelaoding) {
            player.state = "reloading";
            weapon.reloadTimer -= state.time.delta;
            if (weapon.reloadTimer <= 0) {
                weapon.reloadTimer = 0;

                const delta = stats.maxLoadedAmmo - weapon.loadedAmmo;
                const loadedAmmo = Math.min(weapon.reservedAmmo, delta);
                if (loadedAmmo > 0) {
                    weapon.loadedAmmo += loadedAmmo;
                    weapon.reservedAmmo -= loadedAmmo;
                }
            }
        }
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function povAnimationSystem(entity, state, dispatch) {
    if (entity.id !== state.povEntity) return;
    const { player, playerModel, weapon } = entity;
    if (player && playerModel && weapon) {
        const gunModel = playerModel.povWeaponModel;
        gunModel.position.set(0, 0, 0);
        gunModel.rotation.set(0, 0, 0);

        playerModel.povMuzzleflash.visible = false;

        switch (player.state) {
            case "shooting": {
                const s = weapon.firerateTimer;
                gunModel.position.z += 0.0005 * s;
                gunModel.position.x += Math.random() * 0.0001 * s;
                gunModel.position.y += Math.random() * 0.0001 * s;
                gunModel.position.z += Math.random() * 0.0002 * s;

                playerModel.povMuzzleflash.visible = Math.random() > 0.5;
                break;
            }
            case "reloading": {
                const elapsed = state.time.elapsed * 0.01;
                gunModel.position.y += Math.cos(elapsed * 2) * 0.03;
                gunModel.position.y -= 0.5;
                gunModel.rotation.x = 1.25;
                break;
            }
            case "running": {
                const elapsed = state.time.elapsed * 0.01;
                gunModel.position.y += Math.cos(elapsed * 2) * 0.03;
                gunModel.position.x -= Math.cos(elapsed) * 0.03;
                break;
            }
            default:
            case "idle": {
                const elapsed = state.time.elapsed * 0.005;
                gunModel.position.y += Math.cos(elapsed * 2) * 0.0025;
                gunModel.position.x -= Math.cos(elapsed) * 0.0025;
                break;
            }
        }
    }
}

/**
 * @param {Entity} entity
 * @param {State} state
 * @param {(action:Action)=>any} dispatch
 */
export function physicsSystem(entity, state, dispatch) {
    if (entity.object3D && entity.velocity) {
        const walls = state.getEntityGroup("wall");
        const velocity = entity.velocity.getForceVector(state.time.delta);
        const STEP_SIZE = 1;

        // Reset collider
        if (entity.collider) {
            entity.collider.set(0, 0, 0);
        }

        // Resolve Y-axis
        entity.object3D.position.y += velocity.y;
        if (entity.collider) {
            // Floor collision
            const floor = 0 + entity.object3D.radius.y;
            if (entity.object3D.position.y < floor && velocity.y <= 0) {
                entity.object3D.position.y = floor;
                entity.velocity.y = 0;
                entity.collider.y = 1;
            }

            walls.forEach(wall => {
                const aabb1 = entity.object3D.toAABB();
                const aabb2 = wall.object3D.toAABB();
                if (AABB.collision(aabb1, aabb2)) {
                    resolveCollisionY(entity, wall, aabb1, aabb2);
                }
            });
        }

        // Resolve X-axis
        entity.object3D.position.x += velocity.x;
        if (entity.collider) {
            walls.forEach(wall => {
                const aabb1 = entity.object3D.toAABB();
                const aabb2 = wall.object3D.toAABB();
                if (AABB.collision(aabb1, aabb2)) {
                    const deltaY = aabb2.max.y - aabb1.min.y;
                    if (deltaY <= STEP_SIZE) {
                        resolveCollisionY(entity, wall, aabb1, aabb2);
                    } else {
                        resolveCollisionX(entity, wall, aabb1, aabb2);
                    }
                }
            });
        }

        // Resolve Z-axis
        entity.object3D.position.z += velocity.z;
        if (entity.collider) {
            walls.forEach(wall => {
                const aabb1 = entity.object3D.toAABB();
                const aabb2 = wall.object3D.toAABB();
                if (AABB.collision(aabb1, aabb2)) {
                    const deltaY = aabb2.max.y - aabb1.min.y;
                    if (deltaY <= STEP_SIZE) {
                        resolveCollisionY(entity, wall, aabb1, aabb2);
                    } else {
                        resolveCollisionZ(entity, wall, aabb1, aabb2);
                    }
                }
            });
        }
    }
}

export function resolveCollision(entityMin, entityMax, wallMin, wallMax) {
    const width = (entityMax - entityMin) * 0.50000001;
    if (entityMin < wallMin) {
        return wallMin - width;
    } else {
        return wallMax + width;
    }
}

export function resolveCollisionX(entity, wall, aabb1, aabb2) {
    entity.object3D.position.x = resolveCollision(
        aabb1.min.x,
        aabb1.max.x,
        aabb2.min.x,
        aabb2.max.x
    );
    entity.velocity.x = 0;
    entity.collider.x =
        entity.object3D.position.x < wall.object3D.position.x ? -1 : 1;
}

export function resolveCollisionY(entity, wall, aabb1, aabb2) {
    entity.object3D.position.y = resolveCollision(
        aabb1.min.y,
        aabb1.max.y,
        aabb2.min.y,
        aabb2.max.y
    );

    entity.collider.y =
        entity.object3D.position.y < wall.object3D.position.y ? -1 : 1;

    if (
        (entity.collider.y > 0 && entity.velocity.y < 0) ||
        (entity.collider.y < 0 && entity.velocity.y > 0)
    ) {
        entity.velocity.y = 0;
    }
}

export function resolveCollisionZ(entity, wall, aabb1, aabb2) {
    entity.object3D.position.z = resolveCollision(
        aabb1.min.z,
        aabb1.max.z,
        aabb2.min.z,
        aabb2.max.z
    );
    entity.velocity.z = 0;
    entity.collider.z =
        entity.object3D.position.z < wall.object3D.position.z ? -1 : 1;
}
