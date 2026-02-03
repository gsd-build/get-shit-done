# Research Template

Template for `.planning/phases/XX-name/{phase}-RESEARCH.md` - comprehensive ecosystem research before planning.

**Purpose:** Document what Claude needs to know to implement a phase well - not just "which library" but "how do experts build this."

---

## File Template

```markdown
# Phase [X]: [Name] - Research

**Researched:** [date]
**Domain:** [primary technology/problem domain]
**Confidence:** [HIGH/MEDIUM/LOW]

<user_constraints>
## User Constraints (from CONTEXT.md)

**CRITICAL:** If CONTEXT.md exists from /gsd:discuss-phase, copy locked decisions here verbatim. These MUST be honored by the planner.

### Locked Decisions
[Copy from CONTEXT.md `## Decisions` section - these are NON-NEGOTIABLE]
- [Decision 1]
- [Decision 2]

### Claude's Discretion
[Copy from CONTEXT.md - areas where researcher/planner can choose]
- [Area 1]
- [Area 2]

### Deferred Ideas (OUT OF SCOPE)
[Copy from CONTEXT.md - do NOT research or plan these]
- [Deferred 1]
- [Deferred 2]

**If no CONTEXT.md exists:** Write "No user constraints - all decisions at Claude's discretion"
</user_constraints>

<research_summary>
## Summary

[2-3 paragraph executive summary]
- What was researched
- What the standard approach is
- Key recommendations

**Primary recommendation:** [one-liner actionable guidance]
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [name] | [ver] | [what it does] | [why experts use it] |
| [name] | [ver] | [what it does] | [why experts use it] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| [name] | [ver] | [what it does] | [use case] |
| [name] | [ver] | [what it does] | [use case] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| [standard] | [alternative] | [when alternative makes sense] |

**Installation:**
```bash
npm install [packages]
# or
yarn add [packages]
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── [folder]/        # [purpose]
├── [folder]/        # [purpose]
└── [folder]/        # [purpose]
```

### Pattern 1: [Pattern Name]
**What:** [description]
**When to use:** [conditions]
**Example:**
```typescript
// [code example from Context7/official docs]
```

### Pattern 2: [Pattern Name]
**What:** [description]
**When to use:** [conditions]
**Example:**
```typescript
// [code example]
```

### Anti-Patterns to Avoid
- **[Anti-pattern]:** [why it's bad, what to do instead]
- **[Anti-pattern]:** [why it's bad, what to do instead]
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| [problem] | [what you'd build] | [library] | [edge cases, complexity] |
| [problem] | [what you'd build] | [library] | [edge cases, complexity] |
| [problem] | [what you'd build] | [library] | [edge cases, complexity] |

**Key insight:** [why custom solutions are worse in this domain]
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: [Name]
**What goes wrong:** [description]
**Why it happens:** [root cause]
**How to avoid:** [prevention strategy]
**Warning signs:** [how to detect early]

### Pitfall 2: [Name]
**What goes wrong:** [description]
**Why it happens:** [root cause]
**How to avoid:** [prevention strategy]
**Warning signs:** [how to detect early]

### Pitfall 3: [Name]
**What goes wrong:** [description]
**Why it happens:** [root cause]
**How to avoid:** [prevention strategy]
**Warning signs:** [how to detect early]
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### [Common Operation 1]
```typescript
// Source: [Context7/official docs URL]
[code]
```

### [Common Operation 2]
```typescript
// Source: [Context7/official docs URL]
[code]
```

### [Common Operation 3]
```typescript
// Source: [Context7/official docs URL]
[code]
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| [old] | [new] | [date/version] | [what it means for implementation] |

**New tools/patterns to consider:**
- [Tool/Pattern]: [what it enables, when to use]
- [Tool/Pattern]: [what it enables, when to use]

**Deprecated/outdated:**
- [Thing]: [why it's outdated, what replaced it]
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **[Question]**
   - What we know: [partial info]
   - What's unclear: [the gap]
   - Recommendation: [how to handle during planning/execution]

2. **[Question]**
   - What we know: [partial info]
   - What's unclear: [the gap]
   - Recommendation: [how to handle]
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Context7 library ID] - [topics fetched]
- [Official docs URL] - [what was checked]

### Secondary (MEDIUM confidence)
- [WebSearch verified with official source] - [finding + verification]

### Tertiary (LOW confidence - needs validation)
- [WebSearch only] - [finding, marked for validation during implementation]
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: [what]
- Ecosystem: [libraries explored]
- Patterns: [patterns researched]
- Pitfalls: [areas checked]

**Confidence breakdown:**
- Standard stack: [HIGH/MEDIUM/LOW] - [reason]
- Architecture: [HIGH/MEDIUM/LOW] - [reason]
- Pitfalls: [HIGH/MEDIUM/LOW] - [reason]
- Code examples: [HIGH/MEDIUM/LOW] - [reason]

**Research date:** [date]
**Valid until:** [estimate - 30 days for stable tech, 7 days for fast-moving]
</metadata>

---

*Phase: XX-name*
*Research completed: [date]*
*Ready for planning: [yes/no]*
```

---

## Good Example

```markdown
# Phase 3: 3D City Driving - Research

**Researched:** 2025-01-20
**Domain:** Three.js 3D web game with driving mechanics
**Confidence:** HIGH

<research_summary>
## Summary

Researched the Three.js ecosystem for building a 3D city driving game. The standard approach uses Three.js with React Three Fiber for component architecture, Rapier for physics, and drei for common helpers.

Key finding: Don't hand-roll physics or collision detection. Rapier (via @react-three/rapier) handles vehicle physics, terrain collision, and city object interactions efficiently. Custom physics code leads to bugs and performance issues.

**Primary recommendation:** Use R3F + Rapier + drei stack. Start with vehicle controller from drei, add Rapier vehicle physics, build city with instanced meshes for performance.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| three | 0.160.0 | 3D rendering | The standard for web 3D |
| @react-three/fiber | 8.15.0 | React renderer for Three.js | Declarative 3D, better DX |
| @react-three/drei | 9.92.0 | Helpers and abstractions | Solves common problems |
| @react-three/rapier | 1.2.1 | Physics engine bindings | Best physics for R3F |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @react-three/postprocessing | 2.16.0 | Visual effects | Bloom, DOF, motion blur |
| leva | 0.9.35 | Debug UI | Tweaking parameters |
| zustand | 4.4.7 | State management | Game state, UI state |
| use-sound | 4.0.1 | Audio | Engine sounds, ambient |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rapier | Cannon.js | Cannon simpler but less performant for vehicles |
| R3F | Vanilla Three | Vanilla if no React, but R3F DX is much better |
| drei | Custom helpers | drei is battle-tested, don't reinvent |

**Installation:**
```bash
npm install three @react-three/fiber @react-three/drei @react-three/rapier zustand
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── Vehicle/          # Player car with physics
│   ├── City/             # City generation and buildings
│   ├── Road/             # Road network
│   └── Environment/      # Sky, lighting, fog
├── hooks/
│   ├── useVehicleControls.ts
│   └── useGameState.ts
├── stores/
│   └── gameStore.ts      # Zustand state
└── utils/
    └── cityGenerator.ts  # Procedural generation helpers
```

### Pattern 1: Vehicle with Rapier Physics
**What:** Use RigidBody with vehicle-specific settings, not custom physics
**When to use:** Any ground vehicle
**Example:**
```typescript
// Source: @react-three/rapier docs
import { RigidBody, useRapier } from '@react-three/rapier'

function Vehicle() {
  const rigidBody = useRef()

  return (
    <RigidBody
      ref={rigidBody}
      type="dynamic"
      colliders="hull"
      mass={1500}
      linearDamping={0.5}
      angularDamping={0.5}
    >
      <mesh>
        <boxGeometry args={[2, 1, 4]} />
        <meshStandardMaterial />
      </mesh>
    </RigidBody>
  )
}
```

### Pattern 2: Instanced Meshes for City
**What:** Use InstancedMesh for repeated objects (buildings, trees, props)
**When to use:** >100 similar objects
**Example:**
```typescript
// Source: drei docs
import { Instances, Instance } from '@react-three/drei'

function Buildings({ positions }) {
  return (
    <Instances limit={1000}>
      <boxGeometry />
      <meshStandardMaterial />
      {positions.map((pos, i) => (
        <Instance key={i} position={pos} scale={[1, Math.random() * 5 + 1, 1]} />
      ))}
    </Instances>
  )
}
```

### Anti-Patterns to Avoid
- **Creating meshes in render loop:** Create once, update transforms only
- **Not using InstancedMesh:** Individual meshes for buildings kills performance
- **Custom physics math:** Rapier handles it better, every time
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vehicle physics | Custom velocity/acceleration | Rapier RigidBody | Wheel friction, suspension, collisions are complex |
| Collision detection | Raycasting everything | Rapier colliders | Performance, edge cases, tunneling |
| Camera follow | Manual lerp | drei CameraControls or custom with useFrame | Smooth interpolation, bounds |
| City generation | Pure random placement | Grid-based with noise for variation | Random looks wrong, grid is predictable |
| LOD | Manual distance checks | drei <Detailed> | Handles transitions, hysteresis |

**Key insight:** 3D game development has 40+ years of solved problems. Rapier implements proper physics simulation. drei implements proper 3D helpers. Fighting these leads to bugs that look like "game feel" issues but are actually physics edge cases.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Physics Tunneling
**What goes wrong:** Fast objects pass through walls
**Why it happens:** Default physics step too large for velocity
**How to avoid:** Use CCD (Continuous Collision Detection) in Rapier
**Warning signs:** Objects randomly appearing outside buildings

### Pitfall 2: Performance Death by Draw Calls
**What goes wrong:** Game stutters with many buildings
**Why it happens:** Each mesh = 1 draw call, hundreds of buildings = hundreds of calls
**How to avoid:** InstancedMesh for similar objects, merge static geometry
**Warning signs:** GPU bound, low FPS despite simple scene

### Pitfall 3: Vehicle "Floaty" Feel
**What goes wrong:** Car doesn't feel grounded
**Why it happens:** Missing proper wheel/suspension simulation
**How to avoid:** Use Rapier vehicle controller or tune mass/damping carefully
**Warning signs:** Car bounces oddly, doesn't grip corners
</common_pitfalls>

<code_examples>
## Code Examples

### Basic R3F + Rapier Setup
```typescript
// Source: @react-three/rapier getting started
import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'

function Game() {
  return (
    <Canvas>
      <Physics gravity={[0, -9.81, 0]}>
        <Vehicle />
        <City />
        <Ground />
      </Physics>
    </Canvas>
  )
}
```

### Vehicle Controls Hook
```typescript
// Source: Community pattern, verified with drei docs
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'

function useVehicleControls(rigidBodyRef) {
  const [, getKeys] = useKeyboardControls()

  useFrame(() => {
    const { forward, back, left, right } = getKeys()
    const body = rigidBodyRef.current
    if (!body) return

    const impulse = { x: 0, y: 0, z: 0 }
    if (forward) impulse.z -= 10
    if (back) impulse.z += 5

    body.applyImpulse(impulse, true)

    if (left) body.applyTorqueImpulse({ x: 0, y: 2, z: 0 }, true)
    if (right) body.applyTorqueImpulse({ x: 0, y: -2, z: 0 }, true)
  })
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| cannon-es | Rapier | 2023 | Rapier is faster, better maintained |
| vanilla Three.js | React Three Fiber | 2020+ | R3F is now standard for React apps |
| Manual InstancedMesh | drei <Instances> | 2022 | Simpler API, handles updates |

**New tools/patterns to consider:**
- **WebGPU:** Coming but not production-ready for games yet (2025)
- **drei Gltf helpers:** <useGLTF.preload> for loading screens

**Deprecated/outdated:**
- **cannon.js (original):** Use cannon-es fork or better, Rapier
- **Manual raycasting for physics:** Just use Rapier colliders
</sota_updates>

<sources>
## Sources

### Primary (HIGH confidence)
- /pmndrs/react-three-fiber - getting started, hooks, performance
- /pmndrs/drei - instances, controls, helpers
- /dimforge/rapier-js - physics setup, vehicle physics

### Secondary (MEDIUM confidence)
- Three.js discourse "city driving game" threads - verified patterns against docs
- R3F examples repository - verified code works

### Tertiary (LOW confidence - needs validation)
- None - all findings verified
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Three.js + React Three Fiber
- Ecosystem: Rapier, drei, zustand
- Patterns: Vehicle physics, instancing, city generation
- Pitfalls: Performance, physics, feel

**Confidence breakdown:**
- Standard stack: HIGH - verified with Context7, widely used
- Architecture: HIGH - from official examples
- Pitfalls: HIGH - documented in discourse, verified in docs
- Code examples: HIGH - from Context7/official sources

**Research date:** 2025-01-20
**Valid until:** 2025-02-20 (30 days - R3F ecosystem stable)
</metadata>

---

*Phase: 03-city-driving*
*Research completed: 2025-01-20*
*Ready for planning: yes*
```

---

## Guidelines

**When to create:**
- Before planning phases in niche/complex domains
- When Claude's training data is likely stale or sparse
- When "how do experts do this" matters more than "which library"

**Structure:**
- Use XML tags for section markers (matches GSD templates)
- Seven core sections: summary, standard_stack, architecture_patterns, dont_hand_roll, common_pitfalls, code_examples, sources
- All sections required (drives comprehensive research)

**Content quality:**
- Standard stack: Specific versions, not just names
- Architecture: Include actual code examples from authoritative sources
- Don't hand-roll: Be explicit about what problems to NOT solve yourself
- Pitfalls: Include warning signs, not just "don't do this"
- Sources: Mark confidence levels honestly

**Integration with planning:**
- RESEARCH.md loaded as @context reference in PLAN.md
- Standard stack informs library choices
- Don't hand-roll prevents custom solutions
- Pitfalls inform verification criteria
- Code examples can be referenced in task actions

**After creation:**
- File lives in phase directory: `.planning/phases/XX-name/{phase}-RESEARCH.md`
- Referenced during planning workflow
- plan-phase loads it automatically when present
