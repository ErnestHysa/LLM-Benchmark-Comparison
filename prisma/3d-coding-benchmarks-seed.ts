/**
 * 3D Coding Challenge Benchmarks (Three.js)
 *
 * Advanced 3D graphics coding challenges that test spatial reasoning,
 * shader programming, physics simulation, and performance optimization.
 * These are based on real-world difficult prompts from AICodeKing,
 * prompt engineering communities, and Three.js development challenges.
 */

import { PrismaClient, CategoryType } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Challenging 3D coding benchmarks
 * These test geometry, materials, lighting, animation, and performance
 */
const THREE_JS_BENCHMARKS: Array<{
  name: string;
  description: string;
  prompt: string;
  category: CategoryType;
}> = [
  {
    category: "CODING",
    name: "Pokeball with Precise Geometry and Materials",
    description: "Create a 3D Pokeball in Three.js with accurate sphere segmentation, material mapping, and rotation",
    prompt: `Create a 3D Pokeball using Three.js in a single HTML file.

EXACT REQUIREMENTS:

The Pokeball must have:
1. Top hemisphere: RED (#FF0000 or hex equivalent)
2. Bottom hemisphere: WHITE (#FFFFFF)
3. Black band between hemispheres (torus or cylinder)
4. Button on center of black band (small white circle/sphere)
5. Rotation animation: spins on Y-axis continuously
6. Lighting: ambient + directional light with shadows

TECHNICAL SPECIFICATIONS:
- Use THREE.SphereGeometry with phiLength for hemispheres
- Black band: torus with appropriate radius or cylinder with height
- Materials: THREE.MeshStandardMaterial or MeshPhongMaterial
- Animation: requestAnimationFrame loop
- Camera: PerspectiveCamera with orbit controls or auto-positioning
- Renderer: WebGLRenderer with antialias: true

CRITICAL GEOMETRY REQUIREMENTS:
- Top hemisphere: phiLength should be Math.PI (upper half)
- Bottom hemisphere: phiLength should be Math.PI (lower half)
- Black band must align perfectly between hemispheres
- Button must be centered on the black band

COMMON PITFALLS (avoid these):
- Using full spheres with partial color (wrong approach)
- Misaligned band (gap or overlap with hemispheres)
- Incorrect lighting causing flat appearance
- Missing or broken animation loop

OUTPUT FORMAT:
Provide a single complete HTML file containing:
- HTML structure
- CSS for canvas styling (full screen)
- Three.js via CDN (esm import or script tag)
- All JavaScript code inline
- No external assets (procedural generation only)

Test your code mentally: Will the band align? Will materials render correctly? Will animation run smoothly?

After the code, explain your approach for:
1. How you ensured proper hemisphere alignment
2. Why you chose your specific geometry types
3. How you handled the rotation animation`,
  },
  {
    category: "CODING",
    name: "Vertex-Based Wireframe Bird with Bicycle",
    description: "Create a wireframe bird riding a bicycle using custom vertex arrays and BufferGeometry",
    prompt: `Create a wireframe bird riding a bicycle in Three.js using raw vertices and lines.

REQUIREMENTS:

1. BIRD MODEL (using vertices and lines):
   - Body: Create using THREE.BufferGeometry with custom vertices
   - Wings: Separate geometry, attached to body
   - Head: Small sphere or vertices forming a head
   - Beak: Cone or pointed vertices
   - Example vertex format: new THREE.Vector3(x, y, z)
   - Use THREE.Line or THREE.LineSegments for wireframe effect

2. BICYCLE MODEL (using vertices and lines):
   - Wheels: Torus geometry or circular vertex arrays
   - Frame: Connected line segments forming triangle shape
   - Handlebars: Line geometry at front
   - Seat: Small box or vertices

3. COMPOSITION:
   - Bird must appear to be sitting ON the bicycle
   - Bicycle wheels should be aligned horizontally
   - Bird positioned centrally on the seat
   - Entire scene should be recognizable as "bird on bicycle"

4. ANIMATION:
   - Bird wings should flap (rotate or scale)
   - Wheels could rotate (optional but impressive)
   - Smooth animation loop using requestAnimationFrame

TECHNICAL APPROACH:
- Use THREE.BufferGeometry with setPosition for custom shapes
- THREE.LineBasicMaterial for wireframe appearance
- Group objects using THREE.Group
- Scene, Camera (Perspective), Renderer setup

DIMENSIONS (approximate, use your judgment):
- Bird body: ~2 units tall
- Bicycle: ~6 units long, ~3 units tall
- Wheels: ~1.5 units radius

CHALLENGING ASPECTS:
- Creating recognizable shapes from raw vertices
- Positioning bird so it looks like it's riding (not floating)
- Wing animation that looks natural
- Performance: keep vertex count reasonable

COMMON FAILURES:
- Bird looks like random lines (unrecognizable)
- Bird floats above bicycle (positioning error)
- Wings don't animate or animation looks wrong
- Too many vertices causing lag

OUTPUT:
Single HTML file with all code inline.

After your code, explain:
1. How you created recognizable shapes from vertices
2. How you positioned the bird on the bicycle
3. Your animation approach for the wings`,
  },
  {
    category: "CODING",
    name: "Majestic Butterfly with Flapping Animation",
    description: "Create a realistic butterfly with detailed wings using BufferGeometry and garden scene",
    prompt: `Create a majestic butterfly flying in a garden scene using Three.js.

BUTTERFLY REQUIREMENTS:

1. WINGS (detailed, using BufferGeometry):
   - Forewings (larger, upper)
   - Hindwings (smaller, lower)
   - Vein pattern using line segments on wings
   - Wing shape: organic, curved (not triangles)
   - Material: semi-transparent or with texture simulation
   - Colors: vibrant (e.g., blue morpho or monarch pattern)

2. BODY:
   - Thorax: small sphere/cylinder
   - Abdomen: elongated oval
   - Head: small sphere
   - Antennae: thin curved lines
   - Legs: 6 thin lines (can be simple)

3. FLAPPING ANIMATION:
   - Wings must rotate about body attachment point
   - Flapping cycle: up-down motion, smooth
   - Frequency: natural feeling (not too fast/slow)
   - Left and right wings can mirror or offset slightly

4. FLIGHT PATH:
   - Butterfly moves through scene (not just flapping in place)
   - Gentle, organic path (sine wave or bezier curve)
   - Body tilts slightly in direction of movement

5. GARDEN SCENE:
   - Ground plane with grass color
   - Simple flowers (cones or low-poly spheres on stems)
   - Sky background (blue gradient or solid)
   - Basic lighting (sun + ambient)

TECHNICAL SPECIFICATIONS:
- Use THREE.BufferGeometry for wings (custom vertices for organic shape)
- THREE.Group for butterfly (body + wings + antennae)
- Animation loop updating both wing flapping and position
- Camera positioned to view full scene

DIMENSIONS:
- Butterfly wingspan: ~3-4 units
- Flight area: ~20x20x10 units
- Garden: ~30x30 units

CHALLENGING ASPECTS:
- Creating organic wing shapes with BufferGeometry
- Vein pattern on wings (lines following wing shape)
- Natural-looking flapping animation
- Smooth flight path

COMMON FAILURES:
- Wings look like triangles or circles (not butterfly-like)
- Flapping animation mechanical or wrong axis
- Butterfly doesn't move through scene
- Wing veins don't follow wing shape

OUTPUT:
Single HTML file.

After code, explain:
1. How you created organic wing shapes
2. Your flapping animation approach
3. How you achieved natural-looking flight`,
  },
  {
    category: "CODING",
    name: "3D Floor Plan with Rooms and Furniture",
    description: "Create a 3D floor plan from 2D layout with extruded walls, furniture, and orbit controls",
    prompt: `Create a 3D floor plan for a 1585 sqft apartment using Three.js.

LAYOUT REQUIREMENTS:

2D FLOOR PLAN (first, define 2D layout):
- Total area: 1585 sqft (approximately 40x40 ft scaled)
- Must include: 2 bedrooms, 2 bathrooms, living room, kitchen
- Usable layout (logical placement of rooms)
- Door openings and windows marked

3D EXTRUSION:
- Extrude walls from 2D plan to 3D
- Wall height: 8-9 ft (scaled appropriately)
- Wall thickness: ~6 inches
- Floors: thin boxes at base of each room
- Ceiling: optional flat planes or open top

FURNITURE (simple 3D representations):
- Bedrooms: bed (box + cylinders for pillows), dresser, nightstand
- Bathroom: toilet, sink/vanity, shower/tub
- Living room: sofa, coffee table, TV stand
- Kitchen: counters, stove, refrigerator representations

CONTROLS:
- OrbitControls for camera rotation/zoom
- Click on room to highlight or show info (optional)
- Smooth camera movement

TECHNICAL APPROACH:
- Start with 2D coordinate system for layout
- Extrude walls using THREE.ExtrudeGeometry or scaled boxes
- Group rooms by function
- Materials: different colors for different rooms
- Lighting: ambient + point lights in each room

SCALING:
Choose a consistent scale (e.g., 1 unit = 1 foot, or 1 unit = 1 meter)

USABILITY CRITERIA:
- Doors must align (no walking through walls)
- Windows positioned logically
- Furniture fits in rooms (not too large/small)
- Walkways between furniture

CHALLENGING ASPECTS:
- Spatial reasoning for usable layout
- Extruding from 2D to 3D correctly
- Proper scaling and proportions
- Creating functional furniture arrangements

COMMON FAILURES:
- Layout doesn't make sense (doors in wrong places)
- Rooms too small for furniture
- Walls don't align properly
- Furniture floating or clipping

OUTPUT:
Single HTML file.

After code, explain:
1. Your approach to the 2D layout
2. How you extruded to 3D
3. How you ensured furniture fits in rooms`,
  },
  {
    category: "CODING",
    name: "3D Minecraft Voxel World with Trees",
    description: "Create a Minecraft-style voxel world with procedural terrain, trees, and player interaction",
    prompt: `Create a 3D Minecraft-like voxel game in Three.js.

CORE REQUIREMENTS:

1. VOXEL TERRAIN (procedural generation):
   - Grid-based blocks (cubes) forming terrain
   - Height variation (hills, valleys)
   - At least 16x16 chunks (adjust for performance)
   - Multiple block types (grass, dirt, stone, wood)
   - Use THREE.InstancedMesh for performance (crucial!)

2. TREE GENERATION:
   - Trunk: stacked wood blocks
   - Leaves: cluster of leaf blocks
   - Procedurally place trees on terrain
   - Trees must sit on ground (not float)

3. PLAYER CONTROLS:
   - First-person or third-person camera
   - WASD movement (or arrow keys)
   - Mouse to look around
   - Collision detection (can't walk through blocks)
   - Jump capability

4. BLOCK PLACEMENT/REMOVAL:
   - Click to remove block (raycasting)
   - Right-click or key to place block
   - Select block type (1-4 keys)
   - Visual feedback for targeted block

5. PERFORMANCE OPTIMIZATIONS:
   - Frustum culling or distance-based rendering
   - InstancedMesh for same block types
   - Limit visible chunks
   - Face culling (don't render hidden faces)

TECHNICAL SPECIFICATIONS:
- Voxel size: 1 unit cubes
- Chunk size: 16x16xN blocks
- Terrain generation: simple noise or random heights
- Raycaster for block selection
- PointerLockControls for FPS-style camera

SCENE SIZE:
- Start small: 32x32 blocks (2x2 chunks)
- Can expand if performance allows

CHALLENGING ASPECTS:
- Performance with many blocks
- Collision detection without physics library
- Procedural tree placement
- Block face culling optimization

COMMON FAILURES:
- Too many draw calls (laggy)
- Player walks through blocks or falls through world
- Trees float or underground
- No block type selection

OUTPUT:
Single HTML file.

After code, explain:
1. Your performance optimization strategy
2. How you handled collision detection
3. Your procedural generation approach`,
  },
  {
    category: "CODING",
    name: "3D Neural Network Visualization",
    description: "Build a 3D neural network with nodes, connections, and dynamic activity simulation",
    prompt: `Create a 3D neural network visualization in Three.js.

NETWORK STRUCTURE:

1. LAYERS (create a realistic network):
   - Input layer: 8 nodes
   - Hidden layers: 2 layers of 6 and 4 nodes
   - Output layer: 3 nodes
   - Total: 21 nodes arranged in 3D space

2. NODES:
   - Represented as spheres (THREE.SphereGeometry)
   - Size based on layer (input larger, output medium)
   - Color: cool colors (blues, purples)
   - Positioning: each layer on different X plane

3. CONNECTIONS:
   - Lines connecting nodes between adjacent layers
   - All nodes in layer N connect to all nodes in layer N+1
   - Line thickness: thin, semi-transparent
   - Color: based on connection strength (gradient)

4. DYNAMIC ACTIVITY SIMULATION:
   - Nodes "fire" (change color/brightness) in sequence
   - Activity flows from input → hidden → output
   - Connections show activity propagation
   - Continuous loop or triggerable

5. BOUNDING BOX CONSTRAINT:
   - Entire network must fit in defined 3D space
   - Use wireframe box or translucent cube to show bounds
   - Network must not exceed boundaries

VISUAL EFFECTS:
- Glowing effect for active nodes (emissive material)
- Animated pulse along connections
- Smooth color transitions
- Background: dark for contrast

CAMERA:
- OrbitControls for rotation
- Initial view showing full network
- Auto-rotation optional

TECHNICAL APPROACH:
- THREE.Group for network container
- Arrays to store node and connection references
- Animation loop for activity simulation
- Bounding box helper or custom mesh

DIMENSIONS:
- Network bounds: 20x10x10 units
- Node spacing: calculated automatically

CHALLENGING ASPECTS:
- Creating all connections without crossing lines messily
- Activity animation that looks like "thinking"
- Keeping network contained in bounding box
- Visual clarity (not too cluttered)

COMMON FAILURES:
- Connections look messy (hard to follow)
- Activity simulation is confusing or wrong direction
- Network exceeds bounding box
- Too many connections causing performance issues

OUTPUT:
Single HTML file.

After code, explain:
1. How you generated connections cleanly
2. Your activity simulation approach
3. How you ensured the network fits in bounds`,
  },
  {
    category: "CODING",
    name: "Interactive Chess Board with Move Validation",
    description: "Create a 3D chess board with pieces, click-to-move interaction, and valid move highlighting",
    prompt: `Create a playable 3D chess game in Three.js.

BOARD REQUIREMENTS:

1. CHESS BOARD:
   - 8x8 grid of alternating colors (light/dark squares)
   - Each square: a plane or thin box
   - Board size: 8x8 units
   - Colors: traditional (cream/brown) or stylistic

2. PIECES (model each piece using simple geometry):
   - Pawn: cylinder + sphere
   - Rook: cylinder with crenelations (box on top)
   - Knight: cylinder + L-shape or simplified horse
   - Bishop: cylinder + cone (mitre)
   - Queen: cylinder + taller crown
   - King: cylinder + cross on top
   - Colors: white vs black (or contrasting colors)

3. INITIAL SETUP:
   - All 32 pieces in correct positions
   - White on rows 1-2, black on rows 7-8
   - Pieces facing each other

4. INTERACTION:
   - Click piece to select (highlight it)
   - Click square to move to
   - VALID MOVE CHECKING (crucial!):
     * Pawns: forward 1, or 2 on first move, diagonal capture
     * Rooks: horizontal/vertical any distance
     * Knights: L-shape (2+1)
     * Bishops: diagonal any distance
     * Queens: rook + bishop moves
     * King: 1 square any direction
   - Highlight valid moves when piece selected
   - Prevent invalid moves
   - Capture opponent pieces (remove from board)

5. ADDITIONAL FEATURES (impressive if included):
   - Turn indicator (whose turn is it?)
   - Check detection (king under attack)
   - Move animation (smooth transition)
   - Game state tracking

TECHNICAL SPECIFICATIONS:
- THREE.Raycaster for click detection
- Array or object storing board state
- Move validation logic for each piece type
- Highlight material for selected piece and valid squares

PIECE REPRESENTATION:
- Can use simple shapes (cylinders, spheres, boxes)
- Or import GLTF (but single HTML requirement suggests procedural)
- Group pieces for easier manipulation

CHALLENGING ASPECTS:
- Implementing correct move rules for all pieces
- Raycasting for selection on small targets
- Smooth animation between moves
- Game state management

COMMON FAILURES:
- Missing move validation (can move anywhere)
- Wrong move rules (e.g., knight moving straight)
- Pieces don't capture correctly
- No visual feedback for selection

OUTPUT:
Single HTML file.

After code, explain:
1. Your move validation approach
2. How you handled piece selection
3. Your game state representation`,
  },
  {
    category: "CODING",
    name: "Physics Simulation - Bouncing Balls in Rotating Cube",
    description: "Create a physics simulation with bouncing balls, collision detection, and rotating container",
    prompt: `Create a 3D physics simulation in Three.js WITHOUT using physics libraries.

SCENE REQUIREMENTS:

1. CONTAINER:
   - Large cube (wireframe or translucent)
   - Rotates continuously on multiple axes
   - Size: 10x10x10 units
   - Balls must stay inside (or collide with walls)

2. BALLS:
   - New ball spawns every 5 seconds
   - Each ball has different color
   - Starting position: random inside cube
   - Random initial velocity
   - Minimum 10 balls maximum (or manage performance)

3. PHYSICS (implement from scratch):
   - Gravity: constant downward force
   - Velocity integration: position += velocity * dt
   - Wall collisions: bounce off cube walls
   - Ball-to-ball collisions: elastic collision
   - Energy loss: slight damping on bounce (optional)

4. ROTATION EFFECTS:
   - Container rotation affects ball movement
   - Centrifugal force consideration
   - Friction with walls (optional)

5. PERFORMANCE:
   - Efficient collision detection
   - Manage number of balls
   - Smooth 60fps animation

TECHNICAL APPROACH:

Ball object structure:
- position: THREE.Vector3
- velocity: THREE.Vector3
- radius: number
- mass: number (can be 1 for all)
- color: THREE.Color

Collision detection:
- Ball-Wall: check if position + radius > wall bounds
- Ball-Ball: check distance < sum of radii
- Response: reflect velocity, apply momentum transfer

Math needed:
- Distance formula for ball-ball collision
- Reflection formula for wall bounce
- Conservation of momentum for ball-ball response

TIME INTEGRATION:
- Use delta time for frame-rate independence
- Simple Euler integration or Verlet

CHALLENGING ASPECTS:
- Implementing collision detection from scratch
- Ball-ball collision response (momentum conservation)
- Keeping balls inside rotating container
- Performance with many balls

COMMON FAILURES:
- Balls pass through walls (tunneling effect)
- Ball-ball collision doesn't conserve momentum
- Container rotation not accounted for in physics
- Balls clump together or explode due to math errors

ADDITIONAL CHALLENGE (optional):
- Add visual trails for balls
- Show ball count
- Add controls to adjust gravity

OUTPUT:
Single HTML file.

After code, explain:
1. Your collision detection algorithm
2. How you handled ball-ball collision response
3. How you dealt with the rotating container`,
  },
  {
    category: "CODING",
    name: "Custom Shaders - Dither Effect Landing Page",
    description: "Create a WebGL landing page with custom GLSL dither shaders and GSAP animations",
    prompt: `Create an impressive landing page with custom dither shaders using Three.js/WebGL.

SHADER REQUIREMENTS:

1. DITHER SHADER (custom GLSL fragment shader):
   - Implement ordered dithering or bayer matrix
   - Apply to a plane or full-screen quad
   - Create visual interest (not just noise)
   - Pixelated or retro aesthetic

2. SHADER UNIFORMS:
   - Time uniform for animation
   - Color uniforms for palette
   - Resolution uniform for pixel calculation
   - Mouse position for interaction (optional)

3. LANDING PAGE CONTENT:
   - AI company theme or tech startup
   - Hero section with shader background
   - Text overlay (title, tagline, CTA)
   - Scroll-triggered animations

4. GSAP ANIMATIONS:
   - Import GSAP via CDN
   - Animate text entrance
   - Parallax effects on scroll
   - Smooth transitions between sections

5. ADDITIONAL 3D ELEMENTS (optional but impressive):
   - Particle system using points
   - Floating geometric shapes
   - Mouse interaction with scene

SHADER CODE EXAMPLE (to build upon):

\`\`\`glsl
// Example fragment shader structure
uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor1;
uniform vec3 uColor2;

varying vec2 vUv;

// Dither function here (you implement)
float dither(vec2 uv) {
  // Your dither algorithm
  // Returns: 0.0 to 1.0 pattern
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  // Create interesting pattern
  float pattern = dither(vUv * 10.0 + uTime);

  // Mix colors based on pattern
  vec3 color = mix(uColor1, uColor2, pattern);

  gl_FragColor = vec4(color, 1.0);
}
\`\`\`

DITHER ALGORITHMS (choose one):
- Bayer matrix dithering
- Ordered dithering
- Random dithering
- Blue noise (harder)

PAGE SECTIONS:
1. Hero: Big title, shader background, "Get Started" button
2. Features: 3 feature cards with icons
3. About: Company description
4. Contact: Simple contact form or email

HTML STRUCTURE:
- Semantic HTML5
- Sections with IDs for navigation
- Canvas as background or hero element
- Overlay content with proper z-index

STYLING:
- Modern, clean design
- Good typography
- Responsive layout
- Dark theme fits shader aesthetic

CHALLENGING ASPECTS:
- Writing working GLSL shader code
- Integrating shader with Three.js
- GSAP integration and timing
- Performance with fragment shader on full screen

COMMON FAILURES:
- Shader doesn't compile (syntax errors)
- Dither pattern isn't visible or looks wrong
- GSAP animations don't trigger
- Page not responsive

OUTPUT:
Single HTML file with:
- CSS for layout and styling
- Three.js for 3D/shader rendering
- GSAP for animations
- Custom vertex and fragment shaders
- All code inline

After code, explain:
1. Your dither algorithm
2. How you integrated the shader with Three.js
3. Your animation strategy with GSAP`,
  },
  {
    category: "CODING",
    name: "Solar System with Orbital Mechanics",
    description: "Create a 3D solar system with accurate orbital periods, dynamic lighting, and instanced meshes",
    prompt: `Create a 3D solar system visualization in Three.js.

SOLAR SYSTEM REQUIREMENTS:

1. SUN:
   - Central glowing sphere
   - Point light at center
   - Emissive material for glow effect
   - Scale: largest object (not to actual scale!)

2. PLANETS (at least inner 4):
   - Mercury: gray, fastest orbit, small
   - Venus: yellow/white, slower orbit
   - Earth: blue with moon
   - Mars: red, slower orbit
   - Optional: Jupiter, Saturn (with rings!), etc.

3. ORBITAL MECHANICS:
   - Each planet orbits the sun at different speed
   - Orbital periods roughly proportional (Mercury fastest, Mars slowest)
   - Elliptical or circular orbits
   - Smooth animation

4. MOON (Earth's moon):
   - Orbits Earth while Earth orbits Sun
   - Correct relative motion

5. LIGHTING:
   - Sun is the light source
   - Planets lit from one side (facing sun)
   - Shadows on planets away from sun
   - Ambient light for fill

6. INTERACTIVE CONTROLS:
   - OrbitControls for camera movement
   - Click planet to focus/zoom (optional)
   - Speed control slider (pause, slow, fast)
   - Planet labels or info on hover

SCALING (stylized, not realistic):
- Sun: 5 units radius
- Earth: 1 unit radius
- Other planets: 0.4 to 2 units
- Distances: compressed for visibility (not realistic!)
- Orbital radii: 8, 12, 16, 22 units etc.

OPTIMIZATION (REQUIRED):
- Use THREE.InstancedMesh for:
  * Asteroid belt (hundreds of small rocks)
  * Stars background (thousands of points)
- Limit polygon count on planets
- Frustum culling (automatic but check)

ADDITIONAL FEATURES:
- Saturn's rings (flattened torus or disk)
- Asteroid belt between Mars and Jupiter (instanced)
- Star field background (points)
- Planet info panel

TECHNICAL APPROACH:
- Hierarchy: Sun → Planet System (pivot) → Planet Mesh
- Planet System handles orbital rotation
- Planet rotates on its own axis too
- Moon orbits Earth independently

ORBIT SPEEDS (approximate ratios):
- Mercury: fastest (e.g., 4x base speed)
- Venus: 2x base speed
- Earth: 1x base speed
- Mars: 0.5x base speed

CHALLENGING ASPECTS:
- Hierarchical object system (Sun→Planet→Moon)
- Proper orbital mechanics
- Performance with instanced meshes
- Lighting that makes sense (sun as light source)

COMMON FAILURES:
- Planets don't orbit correctly (wrong hierarchy)
- Lighting comes from wrong direction
- Performance issues with too many objects
- Moon doesn't orbit Earth correctly

OUTPUT:
Single HTML file.

After code, explain:
1. Your object hierarchy approach
2. How you handled orbital speeds
3. Your optimization strategy (instanced meshes usage)`,
  },
  {
    category: "CODING",
    name: "Generative Art - Golden Ratio Spiral",
    description: "Create procedural generative art with mathematical patterns, camera fly-through, and color variations",
    prompt: `Create a dreamy 3D generative art scene using Three.js.

GENERATIVE ART REQUIREMENTS:

1. GOLDEN RATIO SPIRAL:
   - Create objects positioned using golden ratio (φ ≈ 1.618)
   - Spiral arrangement in 3D space
   - Each object rotated and scaled based on spiral position
   - At least 100 objects in the spiral

2. PROCEDURAL GEOMETRY:
   - Create varied shapes: spheres, boxes, tetrahedrons, tori
   - Or use one shape type with variations
   - Mix and match based on position in sequence

3. COLOR VARIATIONS:
   - HSL color space for smooth gradients
   - Colors shift along spiral
   - Optional: rainbow, cool tones, or custom palette
   - Emissive materials for glow

4. CAMERA FLY-THROUGH:
   - Camera moves along a path through the spiral
   - Smooth, curved path (bezier or sine-based)
   - LookAt focus on center or ahead
   - Duration: 30+ seconds loop

5. ANIMATION:
   - Objects can rotate or pulse
   - Whole spiral can slowly rotate
   - Particles floating between objects (optional)
   - Dreamy, ethereal feel

MATHEMATICAL BASIS:

Golden ratio spiral:
\`\`\`javascript
const goldenRatio = (1 + Math.sqrt(5)) / 2;
const angle = i * 2.399963; // golden angle in radians
const radius = Math.sqrt(i) * spacing;

x = radius * Math.cos(angle)
y = radius * Math.sin(angle)
z = some function of i for 3D
\`\`\`

Or use phyllotaxis pattern:

\`\`\`javascript
const angle = n * 137.5 * (Math.PI / 180); // golden angle
const r = c * Math.sqrt(n);
x = r * Math.cos(angle);
y = r * Math.sin(angle);
\`\`\`

VISUAL STYLE:
- Dark background with bright, glowing objects
- Reflections/refractions (if using transparent materials)
- Post-processing optional (bloom effect)
- Particle dust in air

CAMERA PATH:
- Spiral inward or outward
- Figure-8 pattern
- Or random but smooth path through scene

TECHNICAL SPECIFICATIONS:
- THREE.Group for spiral container
- Loop to generate objects programmatically
- THREE.CatmullRomCurve3 for camera path
- Animation loop updates camera along curve

CHALLENGING ASPECTS:
- Creating visually pleasing mathematical patterns
- Smooth camera path that doesn't clip through objects
- Color harmony
- Performance with many objects

COMMON FAILURES:
- Pattern looks random, not spiral
- Camera movement jerky or clips objects
- Colors clash or look muddy
- Too few objects for impressive effect

ADDITIONAL IDEAS:
- Audio reactivity (if user allows mic)
- Mouse interaction changes pattern
- Different color palettes toggle
- Speed control

OUTPUT:
Single HTML file.

After code, explain:
1. Your mathematical approach to the spiral
2. Your color generation strategy
3. How you created the camera fly-through`,
  },
];

/**
 * Seed function
 */
async function main() {
  console.log("🌱 Adding 3D coding benchmarks...");

  let count = 0;

  for (const benchmark of THREE_JS_BENCHMARKS) {
    // Find category
    const category = await prisma.benchmarkCategory.findUnique({
      where: { name: benchmark.category },
    });

    if (!category) {
      console.log(`⚠️  Category ${benchmark.category} not found, skipping...`);
      continue;
    }

    // Check if benchmark already exists
    const existing = await prisma.benchmark.findFirst({
      where: { name: benchmark.name },
    });

    if (existing) {
      console.log(`⏭️  Skipped (already exists): ${benchmark.name}`);
      continue;
    }

    // Create benchmark
    const created = await prisma.benchmark.create({
      data: {
        name: benchmark.name,
        description: benchmark.description,
        prompt: benchmark.prompt,
        primaryCategory: benchmark.category,
        isPublic: true,
      },
    });

    // Link to category
    await prisma.benchmarkCategory.update({
      where: { id: category.id },
      data: {
        benchmarks: {
          connect: { id: created.id },
        },
      },
    });

    count++;
    console.log(`✅ Created: ${benchmark.name}`);
  }

  console.log(`\n🎉 Added ${count} 3D coding benchmarks!`);
  console.log("\n📊 These benchmarks test:");
  console.log("  - 3D geometry and spatial reasoning");
  console.log("  - BufferGeometry and custom vertices");
  console.log("  - Animation and physics simulation");
  console.log("  - GLSL shader programming");
  console.log("  - Performance optimization");
  console.log("  - Complex user interaction");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
