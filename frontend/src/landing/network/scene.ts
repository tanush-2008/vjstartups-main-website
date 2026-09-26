import * as THREE from "three";
import type { NetData, NetItem } from "./data";

// "07 / The network" as a live field. Three formations, blended by scroll:
//   A  problems scattered through space (every pink point is a real submission)
//   B  ideas (lime) rise out of the problem they answer and pull it in; the field tightens
//   C  everything settles into a three-armed system around the funded ventures (violet)
// Node positions are computed in the vertex shader and mirrored on the CPU (nodePosition)
// so hover picking and the HTML labels land exactly where the points are drawn.

const PINK = new THREE.Color("#ff4aa7");
const LIME = new THREE.Color("#d7ff63");
const VIOLET = new THREE.Color("#9c88ff");
const PAPER = new THREE.Color("#f7f5ef");

const KIND = { problem: 0, idea: 1, venture: 2, dust: 3 } as const;
const FORCE_RING = 9.4;

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

const SHARED_GLSL = /* glsl */ `
  uniform float uT1, uT2, uTime, uMotion;
  float ease01(float x) { x = clamp(x, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
  vec3 nodePosition(vec3 A, vec3 B, vec3 C, float seed) {
    float t1 = ease01(uT1 * 1.35 - seed * 0.35);
    float t2 = ease01(uT2 * 1.35 - seed * 0.35);
    vec3 p = mix(mix(A, B, t1), C, t2);
    p += vec3(sin(uTime * 0.35 + seed * 40.0), cos(uTime * 0.29 + seed * 23.0), sin(uTime * 0.31 + seed * 57.0))
      * 0.22 * uMotion * (1.0 - 0.5 * t2);
    return p;
  }
`;

const POINT_VERT = /* glsl */ `
  ${SHARED_GLSL}
  uniform float uPR, uScale, uHover, uFade;
  attribute vec3 aA, aB, aC;
  attribute float aSeed, aKind, aSize, aLinked, aIndex;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = nodePosition(aA, aB, aC, aSeed);
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
      alpha = mix(alpha, 0.78, t2);
      size *= 1.0 + aLinked * t1 * 0.6;
    } else if (aKind < 1.5) {     // idea
      color = vec3(${LIME.r.toFixed(3)}, ${LIME.g.toFixed(3)}, ${LIME.b.toFixed(3)});
      alpha = t1;
      size *= 0.2 + 0.8 * t1;
    } else if (aKind < 2.5) {     // funded venture
      color = vec3(${VIOLET.r.toFixed(3)}, ${VIOLET.g.toFixed(3)}, ${VIOLET.b.toFixed(3)});
      alpha = t2;
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
  attribute vec3 aA, aB, aC, aColor;
  attribute float aSeed, aStage;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = nodePosition(aA, aB, aC, aSeed);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    float t1 = ease01(uT1 * 1.2 - 0.1);
    float t2 = ease01(uT2 * 1.2 - 0.1);
    vColor = aColor;
    vAlpha = (aStage < 1.5 ? t1 * (1.0 - 0.45 * t2) * 0.42 : t2 * 0.32) * uFade;
  }
`;

const LINE_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vColor, vAlpha); }
`;

export type NetPick = { index: number; item: NetItem; x: number; y: number };
export type ScreenPoint = { x: number; y: number; depth: number; visible: number; front: number };

export class NetworkScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private group = new THREE.Group();
  private uniforms = {
    uT1: { value: 0 },
    uT2: { value: 0 },
    uTime: { value: 0 },
    uMotion: { value: 1 },
    uPR: { value: 1 },
    uScale: { value: 28 },
    uHover: { value: -1 },
    uFade: { value: 1 },
  };
  private A: Float32Array;
  private B: Float32Array;
  private C: Float32Array;
  private seeds: Float32Array;
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
    this.camera.position.set(0, 0, 28);
    this.scene.add(this.group);

    this.items = data?.items ?? [];
    const dust = opts.compact ? 420 : 1300;
    const n = this.items.length + dust;
    this.A = new Float32Array(n * 3);
    this.B = new Float32Array(n * 3);
    this.C = new Float32Array(n * 3);
    this.seeds = new Float32Array(n);
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

    // Problems first so ideas can start at their problem's position.
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
      // C: three-armed system
      const arm = i % 3;
      const cr = 2 + Math.pow(rand(), 0.75) * 7.4;
      const ca = (arm * Math.PI * 2) / 3 + cr * 0.52 + gauss() * 0.32;
      put(this.C, i, Math.cos(ca) * cr, gauss() * 0.42 * (1 - cr / 15), Math.sin(ca) * cr);
    });

    this.items.forEach((it, i) => {
      if (it.kind === "idea") {
        kinds[i] = KIND.idea;
        sizes[i] = 26;
        const origin = it.link != null ? it.link : -1;
        const h = hub.get(i)!;
        if (origin >= 0) put(this.A, i, this.A[origin * 3], this.A[origin * 3 + 1], this.A[origin * 3 + 2]);
        else put(this.A, i, h[0] * 1.4, h[1], h[2] * 1.4);
        put(this.B, i, h[0], h[1], h[2]);
        const k = ideaIdx.indexOf(i);
        const a = (k / Math.max(ideaIdx.length, 1)) * Math.PI * 2;
        put(this.C, i, Math.cos(a) * 3.6, 0, Math.sin(a) * 3.6);
      } else if (it.kind === "venture") {
        kinds[i] = KIND.venture;
        sizes[i] = 36;
        const k = ventureIdx.indexOf(i);
        const a = (k / Math.max(ventureIdx.length, 1)) * Math.PI * 2 + 0.5;
        put(this.A, i, 0, 0, 0);
        put(this.B, i, 0, 0, 0);
        put(this.C, i, Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15);
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
      if (rand() < 0.65) {
        const cr = 3 + rand() * 15, ca = rand() * Math.PI * 2;
        put(this.C, i, Math.cos(ca) * cr, gauss() * 1.3, Math.sin(ca) * cr);
      } else put(this.C, i, x, y, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.A, 3));
    geometry.setAttribute("aA", new THREE.BufferAttribute(this.A, 3));
    geometry.setAttribute("aB", new THREE.BufferAttribute(this.B, 3));
    geometry.setAttribute("aC", new THREE.BufferAttribute(this.C, 3));
    geometry.setAttribute("aSeed", new THREE.BufferAttribute(this.seeds, 1));
    geometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aLinked", new THREE.BufferAttribute(linked, 1));
    geometry.setAttribute("aIndex", new THREE.BufferAttribute(index, 1));
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

    // Links: problem -> idea (stage B) and idea -> venture (stage C).
    const segs: [number, number, THREE.Color, number][] = [];
    this.items.forEach((it, i) => {
      if (it.kind === "idea" && it.link != null) segs.push([i, it.link, LIME, 1]);
    });
    ideaIdx.forEach((ii, k) => ventureIdx.length && segs.push([ii, ventureIdx[k % ventureIdx.length], VIOLET, 2]));
    if (segs.length) {
      const m = segs.length * 2;
      const la = new Float32Array(m * 3), lb = new Float32Array(m * 3), lc = new Float32Array(m * 3);
      const lcol = new Float32Array(m * 3), lseed = new Float32Array(m), lstage = new Float32Array(m);
      segs.forEach(([from, to, color, stage], s) => {
        [from, to].forEach((node, e) => {
          const v = s * 2 + e;
          for (let k = 0; k < 3; k++) {
            la[v * 3 + k] = this.A[node * 3 + k];
            lb[v * 3 + k] = this.B[node * 3 + k];
            lc[v * 3 + k] = this.C[node * 3 + k];
          }
          lcol.set([color.r, color.g, color.b], v * 3);
          lseed[v] = this.seeds[node];
          lstage[v] = stage;
        });
      });
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.BufferAttribute(la, 3));
      lg.setAttribute("aA", new THREE.BufferAttribute(la, 3));
      lg.setAttribute("aB", new THREE.BufferAttribute(lb, 3));
      lg.setAttribute("aC", new THREE.BufferAttribute(lc, 3));
      lg.setAttribute("aColor", new THREE.BufferAttribute(lcol, 3));
      lg.setAttribute("aSeed", new THREE.BufferAttribute(lseed, 1));
      lg.setAttribute("aStage", new THREE.BufferAttribute(lstage, 1));
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
    }
  }

  resize(width: number, height: number, centerY: number, pixelRatio: number) {
    this.width = width;
    this.height = height;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.uniforms.uPR.value = pixelRatio;
    this.camera.aspect = width / height;
    // Put the system's centre at centerY (the map area) rather than the canvas middle.
    this.camera.setViewOffset(width, height, 0, height / 2 - centerY, width, height);
    this.camera.updateProjectionMatrix();
    this.group.scale.setScalar(Math.min(Math.max(width / height / 1.55, 0.42), 1));
  }

  setPointer(nx: number, ny: number) {
    this.pointer.tx = nx;
    this.pointer.ty = ny;
  }

  /** p: section scroll progress 0..1; now: rAF time in ms; fade: overall opacity. */
  update(p: number, now: number, fade: number) {
    this.t1 = band(p, 0.16, 0.46);
    this.t2 = band(p, 0.46, 0.74);
    const motion = this.uniforms.uMotion.value;
    const time = (now / 1000) * motion;
    this.uniforms.uT1.value = this.t1;
    this.uniforms.uT2.value = this.t2;
    this.uniforms.uTime.value = time;
    this.uniforms.uFade.value = fade;
    this.pointer.x += (this.pointer.tx - this.pointer.x) * 0.06;
    this.pointer.y += (this.pointer.ty - this.pointer.y) * 0.06;
    this.group.rotation.set(-0.08 - this.t2 * 0.24 + this.pointer.y * 0.08, time * 0.035 + p * 1.6 + this.pointer.x * 0.14, 0);
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
    const drift = 0.22 * this.uniforms.uMotion.value * (1 - 0.5 * t2);
    const mixed = (k: number) => {
      const ab = this.A[i * 3 + k] + (this.B[i * 3 + k] - this.A[i * 3 + k]) * t1;
      return ab + (this.C[i * 3 + k] - ab) * t2;
    };
    return out.set(
      mixed(0) + Math.sin(time * 0.35 + seed * 40) * drift,
      mixed(1) + Math.cos(time * 0.29 + seed * 23) * drift,
      mixed(2) + Math.sin(time * 0.31 + seed * 57) * drift
    );
  }

  private toScreen(v: THREE.Vector3): ScreenPoint {
    v.applyMatrix4(this.group.matrixWorld);
    // World z runs toward the camera: 0 = behind the core, 1 = in front of it.
    const front = Math.min(Math.max(v.z / (FORCE_RING * this.group.scale.x) * 0.5 + 0.5, 0), 1);
    const depth = v.project(this.camera).z;
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (-v.y * 0.5 + 0.5) * this.height, depth, visible: depth < 1 ? 1 : 0, front };
  }

  /** How visible a real node currently is (0..1), mirroring the shader's alpha ramps. */
  private presence(i: number) {
    const kind = this.items[i].kind;
    const seed = this.seeds[i];
    if (kind === "idea") return smooth(this.t1 * 1.35 - seed * 0.35);
    if (kind === "venture") return smooth(this.t2 * 1.35 - seed * 0.35);
    return 1;
  }

  project(i: number): ScreenPoint {
    return this.toScreen(this.nodePosition(i, this.tmp));
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

  /** Screen positions of `count` labels evenly spaced on the outer ring (stage C). */
  ring(count: number): ScreenPoint[] {
    return Array.from({ length: count }, (_, k) => {
      const a = (k / count) * Math.PI * 2 + 0.3;
      this.tmp.set(Math.cos(a) * FORCE_RING, 0, Math.sin(a) * FORCE_RING);
      return this.toScreen(this.tmp);
    });
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
