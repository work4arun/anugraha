"use client";

/**
 * AnimatedBackground — soft, ambient animated backdrop (mild light green primary,
 * light blue accent). Purely decorative: sits behind content (z-0), ignores
 * pointer events, and stops animating under prefers-reduced-motion.
 *
 * Four switchable styles. Change the default in one place:
 *   DEFAULT_BG_VARIANT  →  "constellation" | "aurora" | "bubbles" | "waves"
 * or pass a `variant` prop for a specific screen.
 */

import { useEffect, useRef } from "react";
import {
  GraduationCap,
  BookOpen,
  Pencil,
  FlaskConical,
  Atom,
  Laptop,
  Ruler,
  Lightbulb,
  Trophy,
  Globe,
  Calculator,
  Compass,
  Microscope,
  Backpack,
  PenTool,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BgVariant =
  | "campus"
  | "futuristic"
  | "constellation"
  | "aurora"
  | "bubbles"
  | "waves";

export const DEFAULT_BG_VARIANT: BgVariant = "campus";

const GREEN = "141, 198, 63";
const BLUE = "39, 170, 225";

export function AnimatedBackground({
  variant = DEFAULT_BG_VARIANT,
}: {
  variant?: BgVariant;
}) {
  if (variant === "futuristic") return <FuturisticBg />;
  if (variant === "constellation") return <ConstellationBg />;
  if (variant === "aurora") return <AuroraBg />;
  if (variant === "bubbles") return <BubblesBg />;
  if (variant === "waves") return <WavesBg />;
  return <CampusBg />;
}

// ── Campus (floating college icons that collide + bounce) ────────────────────

const CAMPUS_ICONS = [
  GraduationCap,
  BookOpen,
  Pencil,
  FlaskConical,
  Atom,
  Laptop,
  Ruler,
  Lightbulb,
  Trophy,
  Globe,
  Calculator,
  Compass,
  Microscope,
  Backpack,
  PenTool,
  Rocket,
];

// Fixed, deterministic set of floating items.
const CAMPUS_ITEMS = Array.from({ length: 16 }, (_, k) => ({
  idx: k % CAMPUS_ICONS.length,
  blue: k % 3 === 0,
  size: 26 + (k % 5) * 6, // 26–50px
}));

interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
}

function CampusBg() {
  const refs = useRef<Array<HTMLSpanElement | null>>([]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let raf = 0;

    const bodies: Body[] = CAMPUS_ITEMS.map((it) => {
      const speed = 0.35 + Math.random() * 0.45;
      const angle = Math.random() * Math.PI * 2;
      const r = (it.size / 2) * 0.92;
      return {
        x: r + Math.random() * Math.max(1, width - 2 * r),
        y: r + Math.random() * Math.max(1, height - 2 * r),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r,
        rot: Math.random() * 360,
        vr: (Math.random() - 0.5) * 0.4,
      };
    });

    function paint() {
      for (let i = 0; i < bodies.length; i++) {
        const el = refs.current[i];
        const b = bodies[i];
        if (el) {
          el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px) rotate(${b.rot}deg)`;
        }
      }
    }

    function step() {
      // Move + wall bounce
      for (const b of bodies) {
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        if (b.x - b.r < 0) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x + b.r > width) { b.x = width - b.r; b.vx = -Math.abs(b.vx); }
        if (b.y - b.r < 0) { b.y = b.r; b.vy = Math.abs(b.vy); }
        if (b.y + b.r > height) { b.y = height - b.r; b.vy = -Math.abs(b.vy); }
      }

      // Pairwise collisions (equal mass, elastic)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const b = bodies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = a.r + b.r;
          if (dist < minDist) {
            const nx = dx / dist;
            const ny = dy / dist;
            // Separate the overlap
            const overlap = (minDist - dist) / 2;
            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;
            // Exchange the velocity component along the normal
            const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
            if (rel > 0) {
              a.vx -= rel * nx;
              a.vy -= rel * ny;
              b.vx += rel * nx;
              b.vy += rel * ny;
              // little spin kick on impact
              a.vr = (Math.random() - 0.5) * 0.6;
              b.vr = (Math.random() - 0.5) * 0.6;
            }
          }
        }
      }

      paint();
      if (!reduced) raf = requestAnimationFrame(step);
    }

    function onResize() {
      width = window.innerWidth;
      height = window.innerHeight;
    }

    paint();
    if (reduced) paint();
    else raf = requestAnimationFrame(step);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="ambient-bg" aria-hidden="true">
      {CAMPUS_ITEMS.map((it, i) => {
        const Icon = CAMPUS_ICONS[it.idx];
        return (
          <span
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={cn("ambient-icon", it.blue ? "text-accent" : "text-brand")}
          >
            <Icon width={it.size} height={it.size} strokeWidth={1.6} />
          </span>
        );
      })}
    </div>
  );
}

// ── Futuristic (canvas: HUD grid + glowing network + data pulses) ─────────────

function FuturisticBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let t = 0;

    type Node = { x: number; y: number; vx: number; vy: number; blue: boolean; r: number; ph: number };
    let nodes: Node[] = [];
    const GRID = 68;
    const LINK = 150;

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(46, Math.max(18, Math.round((width * height) / 34000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        blue: Math.random() < 0.4,
        r: 1.6 + Math.random() * 1.8,
        ph: Math.random() * Math.PI * 2,
      }));
    }

    function drawGrid() {
      const off = (t * 0.15) % GRID;
      ctx!.lineWidth = 1;
      ctx!.strokeStyle = `rgba(${GREEN}, 0.045)`;
      for (let x = -GRID + off; x < width; x += GRID) {
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, height);
        ctx!.stroke();
      }
      for (let y = -GRID + off; y < height; y += GRID) {
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(width, y);
        ctx!.stroke();
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, width, height);
      drawGrid();

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      // Links + travelling data pulses
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist >= LINK) continue;

          const fade = 1 - dist / LINK;
          const color = a.blue && b.blue ? BLUE : GREEN;
          ctx!.strokeStyle = `rgba(${color}, ${fade * 0.22})`;
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.stroke();

          // pulse on the closer links only
          if (dist < LINK * 0.72) {
            const p = ((t * 0.006 + (i * 13 + j * 7) * 0.11) % 1 + 1) % 1;
            const px = a.x + (b.x - a.x) * p;
            const py = a.y + (b.y - a.y) * p;
            ctx!.shadowBlur = 8;
            ctx!.shadowColor = `rgba(${color}, 0.8)`;
            ctx!.fillStyle = `rgba(${color}, ${fade * 0.9})`;
            ctx!.beginPath();
            ctx!.arc(px, py, 1.6, 0, Math.PI * 2);
            ctx!.fill();
            ctx!.shadowBlur = 0;
          }
        }
      }

      // Glowing nodes (gentle pulse)
      for (const n of nodes) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.03 + n.ph);
        const color = n.blue ? BLUE : GREEN;
        ctx!.shadowBlur = 10;
        ctx!.shadowColor = `rgba(${color}, ${0.5 * pulse})`;
        ctx!.fillStyle = `rgba(${color}, ${0.85})`;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.shadowBlur = 0;
        // faint ring
        ctx!.strokeStyle = `rgba(${color}, ${0.18 * pulse})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r + 4 + 2 * pulse, 0, Math.PI * 2);
        ctx!.stroke();
      }

      t += 1;
      if (!reduced) raf = requestAnimationFrame(frame);
    }

    function onResize() {
      build();
      if (reduced) frame();
    }

    build();
    frame();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="ambient-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="ambient-canvas" />
    </div>
  );
}

// ── Constellation (canvas) ───────────────────────────────────────────────────

function ConstellationBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;

    type P = { x: number; y: number; vx: number; vy: number; blue: boolean; r: number };
    let points: P[] = [];

    function build() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas!.clientWidth;
      height = canvas!.clientHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      const density = Math.min(60, Math.max(24, Math.round((width * height) / 26000)));
      points = Array.from({ length: density }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        blue: Math.random() < 0.4,
        r: 1.3 + Math.random() * 1.6,
      }));
    }

    const LINK = 130;

    function frame() {
      ctx!.clearRect(0, 0, width, height);

      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;
      }

      // Links
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < LINK) {
            const alpha = (1 - dist / LINK) * 0.22;
            const color = a.blue && b.blue ? BLUE : GREEN;
            ctx!.strokeStyle = `rgba(${color}, ${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // Dots
      for (const p of points) {
        ctx!.fillStyle = `rgba(${p.blue ? BLUE : GREEN}, 0.6)`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      if (!reduced) raf = requestAnimationFrame(frame);
    }

    function onResize() {
      build();
      if (reduced) frame();
    }

    build();
    frame();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="ambient-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="ambient-canvas" />
    </div>
  );
}

// ── Aurora (CSS blobs) ───────────────────────────────────────────────────────

const SPARKS = [
  { top: "18%", left: "12%", delay: "0s", color: `rgba(${GREEN},0.35)` },
  { top: "32%", left: "82%", delay: "2s", color: `rgba(${BLUE},0.30)` },
  { top: "62%", left: "22%", delay: "4s", color: `rgba(${GREEN},0.28)` },
  { top: "74%", left: "70%", delay: "1s", color: `rgba(${BLUE},0.26)` },
  { top: "46%", left: "50%", delay: "3s", color: `rgba(63,190,132,0.30)` },
  { top: "12%", left: "60%", delay: "5s", color: `rgba(${GREEN},0.24)` },
];

function AuroraBg() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <div className="ambient-blob ambient-blob--green-1" />
      <div className="ambient-blob ambient-blob--green-2" />
      <div className="ambient-blob ambient-blob--blue-1" />
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="ambient-spark"
          style={{ top: s.top, left: s.left, background: s.color, animationDelay: s.delay }}
        />
      ))}
    </div>
  );
}

// ── Bubbles (CSS) ────────────────────────────────────────────────────────────

const BUBBLES = Array.from({ length: 14 }, (_, i) => {
  const size = 10 + ((i * 7) % 34);
  const blue = i % 3 === 0;
  return {
    left: `${(i * 7.3) % 100}%`,
    size,
    duration: `${14 + (i % 6) * 3}s`,
    delay: `${(i % 7) * 1.6}s`,
    color: blue
      ? `radial-gradient(circle at 35% 35%, rgba(${BLUE},0.5), rgba(${BLUE},0.12))`
      : `radial-gradient(circle at 35% 35%, rgba(${GREEN},0.5), rgba(${GREEN},0.12))`,
  };
});

function BubblesBg() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="ambient-bubble"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            background: b.color,
            animationDuration: b.duration,
            animationDelay: b.delay,
          }}
        />
      ))}
    </div>
  );
}

// ── Waves (SVG) ──────────────────────────────────────────────────────────────

function WavesBg() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <svg
        className="ambient-wave"
        style={{ bottom: 0, animation: "wave-slide 18s linear infinite", opacity: 0.5 }}
        viewBox="0 0 2880 200"
        preserveAspectRatio="none"
      >
        <path
          d="M0 100 C 360 40, 720 160, 1080 100 S 1800 40, 2160 100 S 2880 160, 2880 100 L2880 200 L0 200 Z"
          fill={`rgba(${GREEN},0.20)`}
        />
      </svg>
      <svg
        className="ambient-wave"
        style={{ bottom: 0, animation: "wave-slide 26s linear infinite reverse", opacity: 0.4 }}
        viewBox="0 0 2880 200"
        preserveAspectRatio="none"
      >
        <path
          d="M0 120 C 360 60, 720 180, 1080 120 S 1800 60, 2160 120 S 2880 180, 2880 120 L2880 200 L0 200 Z"
          fill={`rgba(${BLUE},0.16)`}
        />
      </svg>
    </div>
  );
}
