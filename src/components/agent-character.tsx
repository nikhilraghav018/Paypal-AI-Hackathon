import type { CSSProperties, ReactNode } from "react";
import type { AgentName } from "@/lib/types";

export type CharacterState = "idle" | "working" | "jump" | "sad";

const INK = "#1d3f5c";
const BODY = "#e3edf3";

interface Design {
  /** The antenna tip, which tells the agents apart at a glance. */
  accent: string;
  /** The shadowed side of the body and limbs. */
  shade: string;
  action: string;
  glasses?: boolean;
  /** Carried in the right hand, around (98, 102). */
  prop: ReactNode;
}

const DESIGNS: Record<AgentName, Design> = {
  Intake: {
    accent: "#ff9a8b",
    shade: "#e4b3ac",
    action: "prop-write",
    prop: (
      <g>
        <rect x="87" y="84" width="27" height="34" rx="4" fill="#8a5a3c" />
        <rect x="90.5" y="89" width="20" height="26" rx="2" fill="#fff8ee" />
        <rect x="95" y="81" width="11" height="6" rx="2" fill="#c9ced8" />
        <path d="M94 96h13M94 102h13M94 108h8" stroke="#f0635d" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    ),
  },
  Scout: {
    accent: "#6fd3ff",
    shade: "#a5cfe4",
    action: "prop-search",
    prop: (
      <g>
        <path d="M97 110l9-14" stroke="#b98747" strokeWidth="7" strokeLinecap="round" />
        <circle cx="111" cy="86" r="13" fill="#bfeaff" fillOpacity="0.65" stroke="#f5d067" strokeWidth="5" />
        <path d="M105 81c2-3 5-4 8-4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </g>
    ),
  },
  "Risk Sentinel": {
    accent: "#a591ff",
    shade: "#bdb4e6",
    action: "prop-guard",
    prop: (
      <g>
        <path d="M96 79l18 6c0 17-5 29-18 36-13-7-18-19-18-36z" fill="#8c75ff" stroke="#f0ecff" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M88 99l6 6 11-13" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  "Deal Analyst": {
    accent: "#ffd66b",
    shade: "#e0cc95",
    action: "prop-compare",
    prop: (
      <g>
        <path d="M90 87l18-6c3-1 6 0 7 3l6 19c1 3 0 5-3 6l-17 7c-3 1-6 0-7-3l-7-20c-1-3 0-5 3-6z" fill="#fff4cf" stroke="#d98e1a" strokeWidth="2.6" strokeLinejoin="round" />
        <circle cx="108" cy="90" r="3" fill="#d98e1a" />
        <path d="M97 104l8-3M95 98l5-2" stroke="#e36a4f" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M106 96c-3-2-6 0-5 2s5 1 5 4-4 3-6 1" fill="none" stroke="#3f9b6b" strokeWidth="2" strokeLinecap="round" />
      </g>
    ),
  },
  "Policy Guardian": {
    accent: "#62e0a8",
    shade: "#9fd6bd",
    action: "prop-gavel",
    prop: (
      <g>
        <path d="M95 112l11-27" stroke="#7a4a2a" strokeWidth="6" strokeLinecap="round" />
        <rect x="91" y="72" width="30" height="14" rx="5" transform="rotate(22 106 79)" fill="#a56a3c" />
        <rect x="97" y="72" width="6" height="14" transform="rotate(22 106 79)" fill="#f5d067" />
      </g>
    ),
  },
  Auditor: {
    accent: "#f18ad0",
    shade: "#dfaed2",
    action: "prop-read",
    glasses: true,
    prop: (
      <g>
        <path d="M84 87c8-2 13-1 16 3 3-4 8-5 16-3v30c-8-2-13-1-16 3-3-4-8-5-16-3z" fill="#5a3bb0" stroke="#3a2478" strokeWidth="2" strokeLinejoin="round" />
        <path d="M87 90c6-1 10 0 13 3 3-3 7-4 13-3v23c-6-1-10 0-13 3-3-3-7-4-13-3z" fill="#fff9ef" />
        <path d="M100 93v22" stroke="#d9d2c4" strokeWidth="1.6" />
        <path d="M91 97h5M91 103h5M104 97h5M104 103h5" stroke="#8a7dab" strokeWidth="1.9" strokeLinecap="round" />
      </g>
    ),
  },
  Treasurer: {
    accent: "#f5d067",
    shade: "#d9c88f",
    action: "prop-coin",
    prop: (
      <g>
        <rect x="83" y="96" width="33" height="24" rx="5" fill="#8a5426" />
        <path d="M83 104h33" stroke="#65391a" strokeWidth="2.2" />
        <rect x="106" y="103" width="14" height="10" rx="3" fill="#b5763a" />
        <circle cx="110" cy="108" r="2" fill="#f5d067" />
        <g className="agent-prop">
          <circle cx="100" cy="82" r="13" fill="#f7cf55" stroke="#c98d1d" strokeWidth="2.6" />
          <path d="M104.5 77c-1-2-3-3-5-3-3 0-5 1.5-5 4 0 5 11 3 11 8 0 2.500-2.500 4-5.500 4-2.500 0-4.500-1-5.500-3M100 72v20" fill="none" stroke="#8b5c0c" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    ),
  },
};

const outline = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: "round", strokeLinecap: "round" } as const;

export function AgentCharacter({
  agent,
  size = 96,
  state = "idle",
  className = "",
}: {
  agent: AgentName;
  size?: number;
  state?: CharacterState;
  className?: string;
}) {
  const design = DESIGNS[agent];
  const stateClass = state === "idle" ? "" : `agent-${state}`;
  const coinInside = agent === "Treasurer";
  return (
    <svg
      viewBox="0 -8 128 158"
      width={size}
      height={(size * 158) / 128}
      className={`agent-svg ${stateClass} ${className}`}
      style={{ "--prop-action": design.action } as CSSProperties}
      aria-hidden
    >
      <ellipse cx="60" cy="146" rx="38" ry="4.500" fill="#000" opacity="0.32" />

      <g className="agent-body">
        {/* Back arm and back leg, mid-stride. */}
        <path d="M44 86C34 92 27 102 25 111c-2 7 7 11 11 5 2-8 6-14 13-20z" fill={BODY} {...outline} />
        <path d="M49 110c-2 10-8 18-17 26-5 5-1 10 4 9l14-1c5-1 5-6 0-7l-4-1c6-6 13-14 17-24z" fill={design.shade} {...outline} />
        <path d="M63 110c3 9 8 16 14 22l-3 7c-2 5 2 8 6 6l14-5c5-2 4-8-1-7l-7 1c-3-9-5-17-6-26z" fill={BODY} {...outline} />
        <path d="M71 123c1 4 3 7 6 9l-3 7c-2 5 2 8 6 6l14-5c5-2 4-8-1-7l-7 1-1-3c-5 2-10-1-14-8z" fill={design.shade} />

        <path d="M45 76c-8 12-10 28-4 38 4 5 34 6 40 0 5-10 3-26-5-38z" fill={BODY} {...outline} />
        <path d="M45 76c-8 12-10 28-4 38 2 2 6 3 10 4-6-12-6-28 2-40z" fill={design.shade} opacity="0.75" />

        <path d="M76 88c6 6 12 12 19 15l5 7-6 3c-9-3-17-9-23-16z" fill={BODY} {...outline} />

        <g className="agent-head">
          <path d="M45 25L33 7" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="30" cy="2" r="6.500" fill={design.accent} {...outline} />
          <circle cx="60" cy="49" r="30" fill={BODY} {...outline} />
          <path d="M43 25a30 30 0 0 0 0 48c-13-13-13-35 0-48z" fill={design.shade} />
          <g className="agent-eyes">
            <ellipse cx="59" cy="48" rx="3.800" ry="6" fill={INK} />
            <ellipse cx="77" cy="48" rx="3.800" ry="6" fill={INK} />
          </g>
          <path d="M60 62c4 4 11 4 15 0" fill="none" stroke={INK} strokeWidth="3.200" strokeLinecap="round" />
          {design.glasses && (
            <>
              <circle cx="59" cy="48" r="10" fill="#fff" fillOpacity="0.14" stroke={INK} strokeWidth="2.800" />
              <circle cx="77" cy="48" r="8.500" fill="#fff" fillOpacity="0.14" stroke={INK} strokeWidth="2.800" />
              <path d="M49 46l-16-3M67.500 45c1.500-1 2-1 3 0" fill="none" stroke={INK} strokeWidth="2.800" strokeLinecap="round" />
            </>
          )}
        </g>

        {coinInside ? design.prop : <g className="agent-prop">{design.prop}</g>}
        <circle cx="98" cy="105" r="6.500" fill={design.shade} {...outline} />
      </g>
    </svg>
  );
}
