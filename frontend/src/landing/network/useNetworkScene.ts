import { RefObject, useEffect, useRef, useState } from "react";
import type { NetworkScene } from "./scene";
import { loadNetworkData } from "./data";

type Refs = {
  section: RefObject<HTMLElement>;
  sticky: RefObject<HTMLDivElement>;
  canvas: RefObject<HTMLCanvasElement>;
  map: RefObject<HTMLDivElement>;
};

export type NetGeometry = { canvasLeft: number; mapLeft: number; mapTop: number };

const supportsWebGL = () => {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
};

/**
 * Loads three.js and the network data once the section is within ~1.5 screens, then builds
 * the scene. Nothing is fetched or created for visitors who never scroll that far, prefer
 * reduced motion, have no WebGL, or when the API is unreachable; those keep the original
 * drawn network.
 */
export function useNetworkScene(refs: Refs, apiBase: string, ventures: readonly string[]) {
  const scene = useRef<NetworkScene | null>(null);
  const geometry = useRef<NetGeometry>({ canvasLeft: 0, mapLeft: 0, mapTop: 0 });
  const [state, setState] = useState<{ active: boolean; problems: number; ideas: number }>({
    active: false,
    problems: 0,
    ideas: 0,
  });

  useEffect(() => {
    const section = refs.section.current;
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !supportsWebGL()) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const io = new IntersectionObserver(
      async ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const [mod, data] = await Promise.all([
          import("./scene"),
          loadNetworkData(apiBase, ventures).catch(() => null),
        ]);
        const canvas = refs.canvas.current;
        // Without real records the field would be empty dust; the drawn V18 weave is better.
        if (cancelled || !canvas || !data) return;

        const compact = window.innerWidth < 700;
        const instance = new mod.NetworkScene(canvas, data, { compact, motion: true });
        scene.current = instance;

        const measure = () => {
          const map = refs.map.current;
          if (!map) return;
          geometry.current = { canvasLeft: canvas.offsetLeft, mapLeft: map.offsetLeft, mapTop: map.offsetTop };
          const ratio = Math.min(window.devicePixelRatio || 1, compact ? 1.5 : 1.75);
          instance.resize(canvas.clientWidth, canvas.clientHeight, map.offsetTop + map.offsetHeight * 0.5, ratio, map.offsetWidth, map.offsetHeight);
        };
        measure();
        ro = new ResizeObserver(measure);
        if (refs.sticky.current) ro.observe(refs.sticky.current);
        if (refs.map.current) ro.observe(refs.map.current);

        setState({ active: true, problems: data?.problems ?? 0, ideas: data?.ideas ?? 0 });
      },
      { rootMargin: "150% 0px" }
    );
    io.observe(section);

    return () => {
      cancelled = true;
      io.disconnect();
      ro?.disconnect();
      scene.current?.dispose();
      scene.current = null;
    };
    // Refs and the venture list are stable for the life of the landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { scene, geometry, ...state };
}
