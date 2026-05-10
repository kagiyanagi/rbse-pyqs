"use client";

import type { SubjectProgress } from "@/hooks/use-progress";

type Props = {
  subjects: SubjectProgress[];
  size?: number;
};

const RINGS = 5;

export function SyllabusRadar({ subjects, size = 320 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const pad = 56;
  const R = size / 2 - pad;
  const N = Math.max(subjects.length, 3);

  const angles = Array.from({ length: N }, (_, k) => -Math.PI / 2 + (2 * Math.PI * k) / N);

  const ringPolygons = Array.from({ length: RINGS }, (_, i) => {
    const r = (R * (i + 1)) / RINGS;
    return angles.map((a) => `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`).join(" ");
  });

  const dataPoints = angles.map((a, k) => {
    const s = subjects[k];
    const r = R * (s ? Math.max(0, Math.min(1, s.percent / 100)) : 0);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  });
  const dataPath = dataPoints.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  const labelPoints = angles.map((a, k) => {
    const r = R + 22;
    const anchor: "start" | "middle" | "end" =
      Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
      anchor,
      subject: subjects[k]?.subject ?? "",
      percent: subjects[k]?.percent ?? 0,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ maxWidth: "100%", height: "auto", overflow: "visible" }}
      className="select-none"
      role="img"
      aria-label="Syllabus coverage radar"
    >
      <defs>
        <radialGradient id="radar-bg" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="rgb(16 185 129 / 0.08)" />
          <stop offset="100%" stopColor="rgb(16 185 129 / 0)" />
        </radialGradient>
        <linearGradient id="radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgb(74 222 128)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="rgb(34 197 94)" stopOpacity="0.25" />
        </linearGradient>
        <filter id="radar-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={cx} cy={cy} r={R} fill="url(#radar-bg)" />

      {/* concentric rings */}
      {ringPolygons.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="rgb(148 163 184 / 0.18)"
          strokeWidth={i === RINGS - 1 ? 1.4 : 1}
        />
      ))}

      {/* axis lines */}
      {angles.map((a, k) => (
        <line
          key={k}
          x1={cx}
          y1={cy}
          x2={cx + R * Math.cos(a)}
          y2={cy + R * Math.sin(a)}
          stroke="rgb(148 163 184 / 0.22)"
          strokeWidth={1}
        />
      ))}

      {/* data polygon */}
      {subjects.length >= 3 && (
        <>
          <polygon
            points={dataPath}
            fill="url(#radar-fill)"
            stroke="rgb(34 197 94)"
            strokeWidth={1.8}
            strokeLinejoin="round"
            filter="url(#radar-glow)"
          />
          {dataPoints.map(([x, y], k) => (
            <circle
              key={k}
              cx={x}
              cy={y}
              r={4}
              fill="rgb(74 222 128)"
              stroke="rgb(6 78 59)"
              strokeWidth={1.5}
            />
          ))}
        </>
      )}

      {/* labels */}
      {labelPoints.map((lp, k) => (
        <g key={k}>
          <text
            x={lp.x}
            y={lp.y - 4}
            textAnchor={lp.anchor}
            className="fill-foreground"
            fontSize="11"
            fontWeight="600"
            fontFamily="var(--font-mono, monospace)"
          >
            {lp.subject.toUpperCase()}
          </text>
          <text
            x={lp.x}
            y={lp.y + 10}
            textAnchor={lp.anchor}
            className="fill-emerald-400"
            fontSize="10"
            fontFamily="var(--font-mono, monospace)"
          >
            {Math.round(lp.percent)}%
          </text>
        </g>
      ))}
    </svg>
  );
}
