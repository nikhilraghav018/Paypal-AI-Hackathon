import { useId, type CSSProperties, type ReactNode } from "react";
import type { AgentName } from "@/lib/types";

export type CharacterState = "idle" | "working" | "jump" | "sad";

interface Design {
  shirt: [string, string];
  skin: [string, string];
  legs: string;
  mouth?: "smile" | "open" | "smirk";
  action: string;
  /** Behind the head: long hair and similar. */
  back?: ReactNode;
  /** In front of the head: fringe, hats and glasses. */
  front: ReactNode;
  /** Carried in the right hand, around (98, 102). */
  prop: ReactNode;
}

const DESIGNS: Record<AgentName, Design> = {
  Intake: {
    shirt: ["#ff9a8b", "#f0635d"],
    skin: ["#ffe0c7", "#f5bd99"],
    legs: "#7b3340",
    mouth: "open",
    action: "prop-write",
    back: <path d="M26 50c-4 24 3 42 12 46h44c9-4 16-22 12-46z" fill="#5a2d1f" />,
    front: (
      <>
        <path d="M28 50C28 26 44 15 60 15s32 11 32 35c-9-10-20-16-31-16-3 7-20 16-33 16z" fill="#7a3f2a" />
        <path d="M26 54a34 34 0 0 1 68 0" fill="none" stroke="#2c3442" strokeWidth="5" strokeLinecap="round" />
        <rect x="20" y="49" width="10" height="17" rx="5" fill="#2c3442" />
        <rect x="90" y="49" width="10" height="17" rx="5" fill="#2c3442" />
        <path d="M25 66c0 9 8 12 17 12" fill="none" stroke="#2c3442" strokeWidth="3" strokeLinecap="round" />
        <circle cx="43" cy="78" r="3.5" fill="#ff9a8b" />
      </>
    ),
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
    shirt: ["#6fd3ff", "#2f93db"],
    skin: ["#c98e62", "#a86f47"],
    legs: "#27496b",
    action: "prop-search",
    front: (
      <>
        <path d="M30 42c1-18 15-27 30-27s29 9 30 27c-8-5-19-7-30-7s-22 2-30 7z" fill="#d7a766" />
        <path d="M20 44c11-9 26-12 40-12s29 3 40 12c-3 4-6 5-9 3-9-5-20-7-31-7s-22 2-31 7c-3 2-6 1-9-3z" fill="#b98747" />
        <path d="M31 36c9-5 20-7 29-7s20 2 29 7l-1 5c-8-4-18-6-28-6s-20 2-28 6z" fill="#2f93db" />
      </>
    ),
    prop: (
      <g>
        <path d="M97 110l9-14" stroke="#5a3c22" strokeWidth="7" strokeLinecap="round" />
        <circle cx="111" cy="86" r="13" fill="#bfeaff" fillOpacity="0.65" stroke="#f5d067" strokeWidth="5" />
        <path d="M105 81c2-3 5-4 8-4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      </g>
    ),
  },
  "Risk Sentinel": {
    shirt: ["#a591ff", "#6a4fe3"],
    skin: ["#ffe4d1", "#f1c0a2"],
    legs: "#2f2763",
    mouth: "smirk",
    action: "prop-guard",
    front: (
      <>
        <path d="M26 54c-1-25 14-40 34-40s35 15 34 40c-6-7-13-11-20-13H46c-7 2-14 6-20 13z" fill="#c8cfe0" />
        <path d="M26 54c-1-25 14-40 34-40 9 0 17 3 23 8-16-2-39 6-57 32z" fill="#e6eaf4" />
        <rect x="55" y="5" width="10" height="25" rx="5" fill="#ff6b83" />
        <path d="M39 42h42" stroke="#6a4fe3" strokeWidth="4" strokeLinecap="round" />
      </>
    ),
    prop: (
      <g>
        <path d="M96 79l18 6c0 17-5 29-18 36-13-7-18-19-18-36z" fill="#8c75ff" stroke="#f0ecff" strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M88 99l6 6 11-13" fill="none" stroke="#fff" strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    ),
  },
  "Deal Analyst": {
    shirt: ["#ffd66b", "#f2a92d"],
    skin: ["#8a5a3c", "#6d4329"],
    legs: "#5e431a",
    action: "prop-compare",
    back: <circle cx="60" cy="13" r="13" fill="#20150f" />,
    front: (
      <>
        <path d="M28 52C25 29 41 17 60 17s35 12 32 35c-8-11-21-18-32-18S36 41 28 52z" fill="#2e1e15" />
        <path d="M50 12c6 4 14 4 20 0" stroke="#ff7eb0" strokeWidth="4" fill="none" strokeLinecap="round" />
        <circle cx="29" cy="65" r="3.6" fill="#ffd66b" />
        <circle cx="91" cy="65" r="3.6" fill="#ffd66b" />
      </>
    ),
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
    shirt: ["#62e0a8", "#1f9d6b"],
    skin: ["#ffd9b8", "#e8ae84"],
    legs: "#154b38",
    mouth: "smirk",
    action: "prop-gavel",
    front: (
      <>
        <path d="M27 54c-2-20 13-33 33-33s35 13 33 33c-8-8-16-11-23-12-8 5-29 4-43 12z" fill="#eef0f4" />
        <path d="M60 3L19 22l41 19 41-19z" fill="#20303b" />
        <path d="M60 3L19 22l41 19z" fill="#2c4250" />
        <path d="M60 22l27 8v13" fill="none" stroke="#f5d067" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="87" cy="45" r="3.4" fill="#f5d067" />
      </>
    ),
    prop: (
      <g>
        <path d="M95 112l11-27" stroke="#7a4a2a" strokeWidth="6" strokeLinecap="round" />
        <rect x="91" y="72" width="30" height="14" rx="5" transform="rotate(22 106 79)" fill="#a56a3c" />
        <rect x="97" y="72" width="6" height="14" transform="rotate(22 106 79)" fill="#f5d067" />
      </g>
    ),
  },
  Auditor: {
    shirt: ["#f18ad0", "#b84aa6"],
    skin: ["#ffe9d6", "#f5c8a8"],
    legs: "#4b2252",
    action: "prop-read",
    back: <path d="M30 52c-6 16-2 33 6 37l12-5V40zM90 52c6 16 2 33-6 37l-12-5V40z" fill="#37254f" />,
    front: (
      <>
        <path d="M28 54C26 29 42 17 60 17s34 12 32 37c-4-9-11-17-22-21-4 8-27 13-42 21z" fill="#4a3369" />
        <circle cx="47" cy="56" r="11.5" fill="#ffffff" fillOpacity="0.14" stroke="#20243a" strokeWidth="3.4" />
        <circle cx="73" cy="56" r="11.5" fill="#ffffff" fillOpacity="0.14" stroke="#20243a" strokeWidth="3.4" />
        <path d="M58.5 55c1-1.5 2-1.5 3 0M35.5 54l-7-3M84.5 54l7-3" stroke="#20243a" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      </>
    ),
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
    shirt: ["#57d1ac", "#127f6a"],
    skin: ["#e9b58c", "#ca8c62"],
    legs: "#123a36",
    mouth: "open",
    action: "prop-coin",
    front: (
      <>
        <path d="M28 52c-2-19 14-30 32-30s34 11 32 30c-10-9-22-12-32-12s-22 3-32 12z" fill="#3a2a22" />
        <rect x="35" y="-2" width="50" height="33" rx="5" fill="#1d3b37" />
        <rect x="35" y="22" width="50" height="8" fill="#f5d067" />
        <rect x="25" y="28" width="70" height="8" rx="4" fill="#142c29" />
      </>
    ),
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
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const design = DESIGNS[agent];
  const stateClass = state === "idle" ? "" : `agent-${state}`;
  const coinInside = agent === "Treasurer";
  return (
    <svg
      viewBox="0 -6 128 156"
      width={size}
      height={(size * 156) / 128}
      className={`agent-svg ${stateClass} ${className}`}
      style={{ "--prop-action": design.action } as CSSProperties}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}shirt`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor={design.shirt[0]} />
          <stop offset="1" stopColor={design.shirt[1]} />
        </linearGradient>
        <radialGradient id={`${id}skin`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor={design.skin[0]} />
          <stop offset="1" stopColor={design.skin[1]} />
        </radialGradient>
      </defs>

      <ellipse cx="60" cy="146" rx="30" ry="5" fill="#000" opacity="0.32" />

      <g className="agent-body">
        <rect x="44" y="118" width="13" height="27" rx="6.500" fill={design.legs} />
        <rect x="63" y="118" width="13" height="27" rx="6.500" fill={design.legs} />
        <ellipse cx="49" cy="144" rx="10" ry="4.500" fill="#f4f1ea" />
        <ellipse cx="71" cy="144" rx="10" ry="4.500" fill="#f4f1ea" />

        <path d="M41 92c-8 5-14 12-15 22" fill="none" stroke={design.shirt[1]} strokeWidth="11" strokeLinecap="round" />
        <circle cx="25.500" cy="116" r="6" fill={design.skin[1]} />

        <rect x="37" y="80" width="46" height="46" rx="20" fill={`url(#${id}shirt)`} />
        <ellipse cx="51" cy="92" rx="9" ry="6" fill="#fff" opacity="0.2" />

        <path d="M80 92c8 2 13 6 18 12" fill="none" stroke={design.shirt[1]} strokeWidth="11" strokeLinecap="round" />

        <g className="agent-head">
          {design.back}
          <circle cx="60" cy="55" r="32" fill={`url(#${id}skin)`} />
          <g className="agent-eyes">
            <ellipse cx="47" cy="56" rx="6" ry="7.500" fill="#1f2230" />
            <ellipse cx="73" cy="56" rx="6" ry="7.500" fill="#1f2230" />
            <circle cx="49.500" cy="52.500" r="2.300" fill="#fff" />
            <circle cx="75.500" cy="52.500" r="2.300" fill="#fff" />
            <circle cx="45" cy="59" r="1.100" fill="#fff" />
            <circle cx="71" cy="59" r="1.100" fill="#fff" />
          </g>
          <ellipse cx="37" cy="67" rx="6.500" ry="4" fill="#ff7d8e" opacity="0.5" />
          <ellipse cx="83" cy="67" rx="6.500" ry="4" fill="#ff7d8e" opacity="0.5" />
          {design.mouth === "open" ? (
            <path d="M52 69c4 9 12 9 16 0z" fill="#7c2432" />
          ) : design.mouth === "smirk" ? (
            <path d="M52 71c5 4 11 3 16-2" fill="none" stroke="#5a2430" strokeWidth="3" strokeLinecap="round" />
          ) : (
            <path d="M52 69c4 6 12 6 16 0" fill="none" stroke="#5a2430" strokeWidth="3" strokeLinecap="round" />
          )}
          {design.front}
        </g>

        {coinInside ? design.prop : <g className="agent-prop">{design.prop}</g>}
        <circle cx="98" cy="105" r="6" fill={design.skin[1]} />
      </g>
    </svg>
  );
}
