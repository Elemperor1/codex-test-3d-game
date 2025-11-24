export function applyMovementWithCollisions(currentPosition, moveVector, obstacles = [], radius = 1) {
  const resolved = currentPosition.clone();
  const blockedAxes = [];
  const target = resolved.clone().add(moveVector);
  const planarDistance = Math.hypot(moveVector.x, moveVector.z);

  if (planarDistance === 0) {
    return { position: resolved, blockedAxes };
  }

  if (!positionIntersectsObstacles(target, obstacles, radius)) {
    resolved.copy(target);
    resolved.y = currentPosition.y;
    return { position: resolved, blockedAxes };
  }

  const stepSize = Math.max(0.1, radius * 0.5);
  const steps = Math.max(1, Math.ceil(planarDistance / stepSize));
  const increment = moveVector.clone().setY(0).divideScalar(steps);

  for (let i = 0; i < steps; i += 1) {
    const next = resolved.clone().add(increment);
    if (positionIntersectsObstacles(next, obstacles, radius)) {
      if (moveVector.x !== 0) blockedAxes.push('x');
      if (moveVector.z !== 0) blockedAxes.push('z');
      break;
    }
    resolved.copy(next);
  }

  resolved.y = currentPosition.y;

  return { position: resolved, blockedAxes };
}

function positionIntersectsObstacles(position, obstacles, radius) {
  return obstacles.some(({ box }) => {
    if (!box) return false;
    const paddedMinX = box.min.x - radius;
    const paddedMaxX = box.max.x + radius;
    const paddedMinZ = box.min.z - radius;
    const paddedMaxZ = box.max.z + radius;

    const withinX = position.x >= paddedMinX && position.x <= paddedMaxX;
    const withinZ = position.z >= paddedMinZ && position.z <= paddedMaxZ;
    return withinX && withinZ;
  });
}
