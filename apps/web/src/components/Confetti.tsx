"use client";

import { useEffect, useState, useRef } from "react";

const COLORS = [
  "#facc15",
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#a78bfa",
  "#f87171",
  "#fb923c",
  "#22d3ee",
];

interface Particle {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
  color: string;
  rotation: number;
  drift: number;
}

function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 800,
    duration: 1500 + Math.random() * 1500,
    size: 4 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * 360,
    drift: (Math.random() - 0.5) * 60,
  }));
}

/**
 * Renders a burst of colorful confetti particles that fall from the top.
 * Auto-removes itself after the animation completes.
 */
export default function Confetti() {
  const [particles] = useState(() => generateParticles(30));
  const [visible, setVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const height = container.offsetHeight || 500;

    for (const el of Array.from(container.children) as HTMLElement[]) {
      const delay = parseInt(el.dataset.delay || "0");
      const duration = parseInt(el.dataset.duration || "2000");
      const drift = parseFloat(el.dataset.drift || "0");
      const animation = el.animate(
        [
          { transform: "translateY(0) translateX(0) rotate(0deg)", opacity: 1 },
          {
            transform: `translateY(${height}px) translateX(${drift}px) rotate(720deg)`,
            opacity: 0,
          },
        ],
        { duration, delay, fill: "forwards", easing: "ease-in" }
      );
      animation.onfinish = () => el.remove();
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none z-20"
    >
      {particles.map((p) => (
        <div
          key={p.id}
          data-delay={p.delay}
          data-duration={p.duration}
          data-drift={p.drift}
          className="absolute rounded-sm"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
