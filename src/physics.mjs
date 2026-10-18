import { Body } from 'cannon-es';

/**
 * Watch every dynamic body, including vehicles that have already been stacked.
 * The fixed starting vehicle is allowed to support the tower on the platform.
 * @param {import('cannon-es').World} world
 * @param {import('cannon-es').Body[]} surfaces
 * @param {(vehicle: import('cannon-es').Body) => void} onContact
 */
export function watchSurfaceContacts(world, surfaces, onContact) {
  const ground = new Set(surfaces);
  world.addEventListener('beginContact', ({ bodyA, bodyB }) => {
    const vehicle = ground.has(bodyA) ? bodyB : ground.has(bodyB) ? bodyA : undefined;
    if (vehicle?.type === Body.DYNAMIC) onContact(vehicle);
  });
}
