import * as THREE from "three";
import type { NetData, NetItem } from "./data";

// "07 / The network" as a live field. Three formations, blended by scroll:
//   A  problems scattered through space (every pink point is a real submission)
//   B  ideas (lime) rise out of the problem they answer and pull it in; the field tightens
//   C  the points flow into the V18 weave: the same four curves, now made of real problems,
//      with ideas along its dotted path and the funded ventures along its centre thread.
//      As in V18, the weave then parts (uOpen) to reveal "Connection becomes momentum".
// Positions are computed in the vertex shader and mirrored on the CPU (nodePosition) so hover
// picking lands exactly where the points are drawn.

const PINK = new THREE.Color("#ff4aa7");
const LIME = new THREE.Color("#d7ff63");
const VIOLET = new THREE.Color("#9c88ff");
const PAPER = new THREE.Color("#f7f5ef");

const KIND = { problem: 0, idea: 1, venture: 2, dust: 3 } as const;
const FOV = 42;
const CAMERA_Z = 28;

// The weave's paths from the original SVG (viewBox 1200 x 720), as cubic segments
// [x0,y0, c1x,c1y, c2x,c2y, x1,y1]; "S" commands are expanded with the reflected control point.
type Seg = [number, number, number, number, number, number, number, number];
type Strand = { side: 1 | -1; spread: number; segs: Seg[] };
const WEAVE: Strand[] = [
  { side: 1, spread: 0.16, segs: [[30, 535, 165, 115, 455, 55, 665, 270], [665, 270, 875, 485, 1050, 585, 1160, 95]] },
  { side: 1, spread: 0.5, segs: [[10, 235, 210, 620, 505, 660, 770, 385], [770, 385, 1035, 110, 1035, 70, 1190, 515]] },
  { side: -1, spread: 0.16, segs: [[40, 175, 235, 555, 505, 665, 735, 390], [735, 390, 965, 115, 1000, 85, 1180, 520]] },
  { side: -1, spread: 0.5, segs: [[25, 510, 205, 105, 485, 65, 700, 320], [700, 320, 915, 575, 1010, 610, 1185, 155]] },
];
const DOTTED: Seg[] = [[145, 440, 330, 175, 590, 120, 900, 245], [900, 245, 705, 175, 505, 245, 410, 410], [410, 410, 320, 560, 585, 625, 935, 495]];
const THREAD: Seg[] = [[70, 360, 325, 330, 560, 390, 1130, 352]];
// How far the two halves part when the weave opens, in SVG units (V18 used 205px / 215px).
const OPEN_DISTANCE = 210;

const smooth = (x: number) => {
  const t = Math.min(Math.max(x, 0), 1);
  return t * t * (3 - 2 * t);
};
const band = (p: number, a: number, b: number) => smooth((p - a) / (b - a));

function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Point and unit normal on a path at t in [0,1). */
function onPath(segs: Seg[], t: number): [number, number, number, number] {
  const f = Math.min(t, 0.9999) * segs.length;
  const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] = segs[Math.floor(f)];
  const u = f - Math.floor(f), m = 1 - u;
  const x = m * m * m * x0 + 3 * m * m * u * c1x + 3 * m * u * u * c2x + u * u * u * x1;
  const y = m * m * m * y0 + 3 * m * m * u * c1y + 3 * m * u * u * c2y + u * u * u * y1;
  const dx = 3 * m * m * (c1x - x0) + 6 * m * u * (c2x - c1x) + 3 * u * u * (x1 - c2x);
  const dy = 3 * m * m * (c1y - y0) + 6 * m * u * (c2y - c1y) + 3 * u * u * (y1 - c2y);
  const len = Math.hypot(dx, dy) || 1;
  return [x, y, -dy / len, dx / len];
}

const SHARED_GLSL = /* glsl */ `
  uniform float uT1, uT2, uTime, uMotion, uOpen, uOpenDist;
  float ease01(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
  vec3 nodePosition(vec3 A, vec3 B, vec3 C, float seed, float side) {
    float t1 = ease01(uT1 * 1.35 - seed * 0.35);
    float t2 = ease01(uT2 * 1.35 - seed * 0.35);
    vec3 p = mix(mix(A, B, t1), C, t2);
    p += vec3(sin(uTime * 0.35 + seed * 40.0), cos(uTime * 0.29 + seed * 23.0), sin(uTime * 0.31 + seed * 57.0))
      * 0.22 * uMotion * (1.0 - 0.85 * t2);
    p.y += side * uOpen * uOpenDist * t2;
    return p;
  }
`;

const POINT_VERT = /* glsl */ `
  ${SHARED_GLSL}
  uniform float uPR, uScale, uHover, uFade;
  attribute vec3 aA, aB, aC;
  attribute float aSeed, aKind, aSize, aLinked, aIndex, aSide;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = nodePosition(aA, aB, aC, aSeed, aSide);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float t1 = ease01(uT1 * 1.35 - aSeed * 0.35);
    float t2 = ease01(uT2 * 1.35 - aSeed * 0.35);
    float size = aSize;
    vec3 color;
    float alpha;
    if (aKind < 0.5) {            // problem
      color = vec3(${PINK.r.toFixed(3)}, ${PINK.g.toFixed(3)}, ${PINK.b.toFixed(3)});
      alpha = mix(0.9, 0.42 + 0.55 * aLinked, t1);
      alpha = mix(alpha, 0.8, t2);
      size *= 1.0 + aLinked * t1 * (1.0 - t2) * 0.6;
    } else if (aKind < 1.5) {     // idea
      color = vec3(${LIME.r.toFixed(3)}, ${LIME.g.toFixed(3)}, ${LIME.b.toFixed(3)});
      alpha = t1 * (1.0 - uOpen);
      size *= 0.2 + 0.8 * t1;
    } else if (aKind < 2.5) {     // funded venture
      color = vec3(${VIOLET.r.toFixed(3)}, ${VIOLET.g.toFixed(3)}, ${VIOLET.b.toFixed(3)});
      alpha = t2 * (1.0 - uOpen);
      size *= 0.2 + 0.8 * t2;
    } else {                      // decorative dust
      color = vec3(${PAPER.r.toFixed(3)}, ${PAPER.g.toFixed(3)}, ${PAPER.b.toFixed(3)});
      alpha = 0.13 + 0.07 * sin(uTime * 0.8 + aSeed * 50.0) * uMotion;
    }
    if (abs(aIndex - uHover) < 0.5) { size *= 2.3; alpha = 1.0; color = mix(color, vec3(1.0), 0.35); }
    vColor = color;
    vAlpha = alpha * uFade;
    gl_PointSize = size * uPR * (uScale / -mv.z);
  }
`;

const POINT_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    // Bright core plus a soft halo, so points read as light rather than dots.
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(core, 3.0) + 0.35 * pow(core, 1.2);
    gl_FragColor = vec4(vColor, vAlpha * glow);
  }
`;

const LINE_VERT = /* glsl */ `
  ${SHARED_GLSL}
  uniform float uFade;
  attribute vec3 aA, aB, aC;
  attribute float aSeed, aSide;
  varying float vAlpha;
  void main() {
    vec3 p = nodePosition(aA, aB, aC, aSeed, aSide);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vAlpha = ease01(uT1 * 1.2 - 0.1) * (1.0 - ease01(uT2 * 1.4)) * 0.42 * uFade;
  }
`;

const LINE_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() { gl_FragColor = vec4(${LIME.r.toFixed(3)}, ${LIME.g.toFixed(3)}, ${LIME.b.toFixed(3)}, vAlpha); }
`;

export type NetPick = { index: number; item: NetItem; x: number; y: number };
export type ScreenPoint = { x: number; y: number; visible: number };

type WeaveSlot = { path: Seg[]; t: number; normal: number; depth: number; side: number };

export class NetworkScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  private group = new THREE.Group();
  private uniforms = {
    uT1: { value: 0 },
    uT2: { value: 0 },
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uOpen: { value: 0 },
    uOpenDist: { value: 0 },
    uPR: { value: 1 },
    uScale: { value: CAMERA_Z },
    uHover: { value: -1 },
    uFade: { value: 1 },
  };
  private A: Float32Array;
  private B: Float32Array;
  private C: Float32Array;
  private seeds: Float32Array;
  private sides: Float32Array;
  private slots: (WeaveSlot | null)[];
  private cAttribute: THREE.BufferAttribute;
  private lineC: { attribute: THREE.BufferAttribute; nodes: number[] } | null = null;
  private items: NetItem[];
  private width = 1;
  private height = 1;
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  private tmp = new THREE.Vector3();
  private disposables: { dispose(): void }[] = [];
  t1 = 0;
  t2 = 0;

  constructor(canvas: HTMLCanvasElement, data: NetData | null, opts: { compact: boolean; motion: boolean }) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.uniforms.uMotion.value = opts.motion ? 1 : 0;
    this.camera.position.set(0, 0, CAMERA_Z);
    this.scene.add(this.group);

    this.items = data?.items ?? [];
    const dust = opts.compact ? 420 : 1300;
    const n = this.items.length + dust;
    this.A = new Float32Array(n * 3);
    this.B = new Float32Array(n * 3);
    this.C = new Float32Array(n * 3);
    this.seeds = new Float32Array(n);
    this.sides = new Float32Array(n);
    this.slots = new Array(n).fill(null);
    const kinds = new Float32Array(n);
    const sizes = new Float32Array(n);
    const linked = new Float32Array(n);
    const index = new Float32Array(n);
    const rand = random(20260926);
    const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
    const put = (arr: Float32Array, i: number, x: number, y: number, z: number) => {
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    };

    const ideaIdx = this.items.map((it, i) => (it.kind === "idea" ? i : -1)).filter((i) => i >= 0);
    const ventureIdx = this.items.map((it, i) => (it.kind === "venture" ? i : -1)).filter((i) => i >= 0);
    const hub = new Map<number, [number, number, number]>();
    ideaIdx.forEach((ii, k) => {
      const a = (k / Math.max(ideaIdx.length, 1)) * Math.PI * 2 + 0.4;
      hub.set(ii, [Math.cos(a) * 6.8, gauss() * 1.4, Math.sin(a) * 6.8]);
    });

    let problemCount = 0;
    this.items.forEach((it, i) => {
      this.seeds[i] = rand();
      index[i] = i;
      if (it.kind !== "problem") return;
      kinds[i] = KIND.problem;
      sizes[i] = it.readable ? 11 : 8.5;
      // A: ellipsoidal field
      const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), r = Math.cbrt(rand());
      const ax = Math.sin(v) * Math.cos(u) * r * 14.5, ay = Math.cos(v) * r * 5.6, az = Math.sin(v) * Math.sin(u) * r * 9;
      put(this.A, i, ax, ay, az);
      // B: pulled to its idea, or the field tightens
      const h = it.link != null ? hub.get(it.link) : undefined;
      if (h) {
        linked[i] = 1;
        put(this.B, i, h[0] + gauss() * 1.2, h[1] + gauss() * 0.9, h[2] + gauss() * 1.2);
      } else {
        put(this.B, i, ax * 0.66, ay * 0.55, az * 0.66);
      }
      // C: a slot on one of the four weave strands (laid out in world units on resize)
      const strand = WEAVE[problemCount++ % WEAVE.length];
      this.sides[i] = strand.side;
      this.slots[i] = { path: strand.segs, t: rand(), normal: gauss() * strand.spread, depth: gauss() * 0.5, side: strand.side };
    });

    this.items.forEach((it, i) => {
      if (it.kind === "idea") {
        kinds[i] = KIND.idea;
        sizes[i] = 26;
        const h = hub.get(i)!;
        if (it.link != null) put(this.A, i, this.A[it.link * 3], this.A[it.link * 3 + 1], this.A[it.link * 3 + 2]);
        else put(this.A, i, h[0] * 1.4, h[1], h[2] * 1.4);
        put(this.B, i, h[0], h[1], h[2]);
        const k = ideaIdx.indexOf(i);
        this.slots[i] = { path: DOTTED, t: (k + 0.5) / Math.max(ideaIdx.length, 1), normal: 0, depth: 0, side: 0 };
      } else if (it.kind === "venture") {
        kinds[i] = KIND.venture;
        sizes[i] = 36;
        put(this.A, i, 0, 0, 0);
        put(this.B, i, 0, 0, 0);
        const k = ventureIdx.indexOf(i);
        this.slots[i] = { path: THREAD, t: 0.25 + (k / Math.max(ventureIdx.length - 1, 1)) * 0.5, normal: 0, depth: 0, side: 0 };
      }
    });

    for (let j = 0; j < dust; j++) {
      const i = this.items.length + j;
      this.seeds[i] = rand();
      kinds[i] = KIND.dust;
      sizes[i] = 2 + rand() * 2.6;
      index[i] = -10;
      const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), r = 15 + rand() * 18;
      const x = Math.sin(v) * Math.cos(u) * r, y = Math.cos(v) * r * 0.7, z = Math.sin(v) * Math.sin(u) * r;
      put(this.A, i, x, y, z);
      put(this.B, i, x * 0.9, y * 0.9, z * 0.9);
      put(this.C, i, x * 0.85, y * 0.85, z * 0.85);
      // Most of the faint dust becomes the weave's ribbon texture, the job V18's drawn strands
      // did. It stays faint white and is never hoverable, so it can't be read as data.
      if (rand() < 0.6) {
        const strand = WEAVE[j % WEAVE.length];
        this.sides[i] = strand.side;
        this.slots[i] = { path: strand.segs, t: rand(), normal: gauss() * strand.spread * 1.8, depth: gauss() * 1.1, side: strand.side };
      }
    }
    // Until the first resize lays out the weave, C mirrors B.
    this.items.forEach((_, i) => put(this.C, i, this.B[i * 3], this.B[i * 3 + 1], this.B[i * 3 + 2]));

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.A, 3));
    geometry.setAttribute("aA", new THREE.BufferAttribute(this.A, 3));
    geometry.setAttribute("aB", new THREE.BufferAttribute(this.B, 3));
    this.cAttribute = new THREE.BufferAttribute(this.C, 3);
    geometry.setAttribute("aC", this.cAttribute);
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(this.seeds, 1));
    geometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aLinked", new THREE.BufferAttribute(linked, 1));
    geometry.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
    geometry.setAttribute("aSide", new THREE.BufferAttribute(this.sides, 1));
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.group.add(new THREE.Points(geometry, material));
    this.disposables.push(geometry, material);

    // Stage B links: each idea to the problem it answers.
    const pairs: [number, number][] = [];
    this.items.forEach((it, i) => {
      if (it.kind === "idea" && it.link != null) pairs.push([i, it.link]);
    });
    if (pairs.length) {
      const nodes = pairs.flat();
      const la = new Float32Array(nodes.length * 3), lb = new Float32Array(nodes.length * 3), lc = new Float32Array(nodes.length * 3);
      const lseed = new Float32Array(nodes.length), lside = new Float32Array(nodes.length);
      nodes.forEach((node, v) => {
        la.set(this.A.subarray(node * 3, node * 3 + 3), v * 3);
        lb.set(this.B.subarray(node * 3, node * 3 + 3), v * 3);
        lseed[v] = this.seeds[node];
        lside[v] = this.sides[node];
      });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.BufferAttribute(la, 3));
      lg.setAttribute("aA", new THREE.BufferAttribute(la, 3));
      lg.setAttribute("aB", new THREE.BufferAttribute(lb, 3));
      const lcAttr = new THREE.BufferAttribute(lc, 3);
      lg.setAttribute("aC", lcAttr);
      lg.setAttribute("aSeed", new THREE.BufferAttribute(lseed, 1));
      lg.setAttribute("aSide", new THREE.BufferAttribute(lside, 1));
      lg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 60);
      const lm = new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      this.group.add(new THREE.LineSegments(lg, lm));
      this.disposables.push(lg, lm);
      this.lineC = { attribute: lcAttr, nodes };
    }
  }

  /**
   * mapWidth/mapHeight: the weave's box in CSS px (V18 stretched its SVG to that box), centred
   * on centerY in the canvas.
   */
  resize(width: number, height: number, centerY: number, pixelRatio: number, mapWidth: number, mapHeight: number) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.uniforms.uPR.value = pixelRatio;
    this.camera.aspect = width / height;
    // Put the centre at centerY (the map area) rather than the canvas middle.
    this.camera.setViewOffset(width, height, 0, height / 2 - centerY, width, height);
    this.camera.updateProjectionMatrix();
    const scale = Math.min(Math.max(width / height / 1.55, 0.42), 1);
    this.group.scale.setScalar(scale);

    // Lay the weave out in group units so that, once scaled, it covers the map box exactly.
    const unitsPerPx = (2 * Math.tan(((FOV / 2) * Math.PI) / 180) * CAMERA_Z) / height / scale;
    const sx = (mapWidth * unitsPerPx) / 1200;
    const sy = (mapHeight * unitsPerPx) / 720;
    this.uniforms.uOpenDist.value = OPEN_DISTANCE * sy;
    this.slots.forEach((slot, i) => {
      if (!slot) return;
      const [x, y, nx, ny] = onPath(slot.path, slot.t);
      const off = slot.normal * 40; // spread is in SVG units / 40
      this.C[i * 3] = (x + nx * off - 600) * sx;
      this.C[i * 3 + 1] = -(y + ny * off - 360) * sy;
      this.C[i * 3 + 2] = slot.depth;
    });
    this.cAttribute.needsUpdate = true;
    if (this.lineC) {
      const arr = this.lineC.attribute.array as Float32Array;
      this.lineC.nodes.forEach((node, v) => arr.set(this.C.subarray(node * 3, node * 3 + 3), v * 3));
      this.lineC.attribute.needsUpdate = true;
    }
  }

  setPointer(nx: number, ny: number) {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
  }

  /** p: section scroll progress 0..1; now: rAF time in ms; open: weave parting 0..1. */
  update(p: number, now: number, open: number, fade: number) {
    this.t1 = band(p, 0.16, 0.46);
    this.t2 = band(p, 0.46, 0.74);
    const motion = this.uniforms.uMotion.value;
    const time = (now / 1000) * motion;
    this.uniforms.uT1.value = this.t1;
    this.uniforms.uT2.value = this.t2;
    this.uniforms.uTime.value = time;
    this.uniforms.uOpen.value = open;
    this.uniforms.uFade.value = fade;
    this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.06;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.06;
    // The field turns in space while it is loose, then squares up to face the viewer as the
    // weave forms.
    const loose = 1 - this.t2;
    // Once on the weave the points must sit on the drawn lines, so no tilt remains.
    this.group.rotation.set((-0.08 + this.pointer.y * 0.08) * loose, (time * 0.035 + p * 1.6 + this.pointer.x * 0.14) * loose, 0);
    this.group.updateMatrixWorld();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  setHover(index: number | null) {
    this.uniforms.uHover.value = index ?? -1;
  }

  private nodePosition(i: number, out: THREE.Vector3) {
    const seed = this.seeds[i];
    const t1 = smooth(this.t1 * 1.35 - seed * 0.35);
    const t2 = smooth(this.t2 * 1.35 - seed * 0.35);
    const time = this.uniforms.uTime.value;
    const drift = 0.22 * this.uniforms.uMotion.value * (1 - 0.85 * t2);
    const mixed = (k: number) => {
      const ab = this.A[i * 3 + k] + (this.B[i * 3 + k] - this.A[i * 3 + k]) * t1;
      return ab + (this.C[i * 3 + k] - ab) * t2;
    };
    return out.set(
      mixed(0) + Math.sin(time * 0.35 + seed * 40) * drift,
      mixed(1) + Math.cos(time * 0.29 + seed * 23) * drift + this.sides[i] * this.uniforms.uOpen.value * this.uniforms.uOpenDist.value * t2,
      mixed(2) + Math.sin(time * 0.31 + seed * 57) * drift
    );
  }

  /** How visible a real node currently is (0..1), mirroring the shader's alpha ramps. */
  private presence(i: number) {
    const kind = this.items[i].kind;
    const seed = this.seeds[i];
    const open = this.uniforms.uOpen.value;
    if (kind === "idea") return smooth(this.t1 * 1.35 - seed * 0.35) * (1 - open);
    if (kind === "venture") return smooth(this.t2 * 1.35 - seed * 0.35) * (1 - open);
    return 1;
  }

  project(i: number): ScreenPoint {
    const v = this.nodePosition(i, this.tmp).applyMatrix4(this.group.matrixWorld).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, visible: v.z < 1 ? 1 : 0 };
  }

  /** Nearest readable node within `radius` px of (x, y) in canvas pixels. */
  pick(x: number, y: number, radius: number): NetPick | null {
    let best: NetPick | null = null;
    let bestD = radius * radius;
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      if (!item.readable || !item.href || this.presence(i) < 0.5) continue;
      const s = this.project(i);
      if (!s.visible) continue;
      const weight = item.kind === "problem" ? 1 : 0.55; // bigger nodes are easier to hit
      const d = ((s.x - x) ** 2 + (s.y - y) ** 2) * weight;
      if (d < bestD) {
        bestD = d;
        best = { index: i, item, x: s.x, y: s.y };
      }
    }
    return best;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
