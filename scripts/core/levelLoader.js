export async function loadLevel(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load level from ${path}`);
  }
  return response.json();
}
