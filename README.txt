STACK VEHICLES - ORIGINAL 3D CAR ASSET PACK

Includes:
- 01_forest_green_hatchback.glb
- 02_silver_sedan.glb
- 03_sand_pickup.glb
- 04_crimson_sport_sedan.glb
- 05_rare_golden_bonus_hypercar.glb

These are starter low-poly 3D models inspired by the cars in the reference images, not exact photogrammetric reconstructions. They have physically-based material colors, 3D wheels and glass; no brand logos, no external texture dependencies.

Format: binary glTF 2.0 (.glb), compatible with Three.js and convertible in Blender for Unity/Unreal.
Coordinate system: Y up, front faces -Z, center at X=Z=0, wheels touch approximately Y=0.02.
Approximate size: 3.75-4.60 m long, 1.65-1.93 m wide. Scale as needed to fit existing game physics.
Each car uses multiple named mesh nodes such as wheel_front_left, wheel_front_right, etc.
Collision boxes, vehicle dynamics, stacking logic and 2x point gameplay are NOT embedded.
Golden 2x bonus must be implemented by your game logic after 10 successful stacks.

Three.js usage:
 import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
 const loader = new GLTFLoader();
 loader.load('/models/01_forest_green_hatchback.glb', (gltf) => {
   const car = gltf.scene;
   scene.add(car);
 });

For convincing realism, add a real-time environment map and soft shadows in your renderer.
