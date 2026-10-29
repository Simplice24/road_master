/**
 * The decorative left panel of the auth screens: one inset card (4px radius, no border or shadow)
 * holding a cluster of road signs on poles, after the reference sign set: a children-crossing
 * warning, a traffic-light warning, no entry, give way and stop. The scene covers the card at any
 * size: it is drawn taller and wider than the frame and scaled with `xMidYMax slice`, so the ground
 * stays on the bottom edge and extra height becomes sky. Signs keep their real-world colours (red
 * and white faces, dark pictograms); poles, bases and ground follow the theme tokens.
 * Everything here is decorative, hence aria-hidden.
 */
export function AuthBrandPanel() {
  return (
    <div aria-hidden="true" className="relative w-full overflow-hidden rounded-sm bg-card text-foreground">
      <RoadSignsIllustration />
    </div>
  );
}

/* Visible scene in frame units: the signs live in a 200-wide frame, with extra room either side and
 * sky above. y = 300 is the bottom edge of the card. */
const SCENE = { left: -30, top: -120, width: 260, height: 420 } as const;
const SCENE_BOTTOM = SCENE.top + SCENE.height;

const RED = "#ed1c24"; /* the reference sign red, brighter than the app's destructive token */
const FACE = "#ffffff";
const SILVER = "#cbd5e1";
const INK = "#0f172a";

type Point = readonly [number, number];
const pts = (points: readonly Point[]) => points.map(([x, y]) => `${x},${y}`).join(" ");

/* ---------------------------------------------------------------------------------------------
 * Warning triangle, drawn in the pixel space of the reference photo and scaled down as a whole.
 * Measured off the photo: an equilateral red triangle (sharp apex at (419, 64), base at y = 540)
 * with corners rounded to a radius of 20, so its visible top is y = 84; a red band of a uniform 40
 * on all three sides; and a white face that is the same triangle inset by that band. Both shapes
 * come from one incentre so the band is equal everywhere.
 * ------------------------------------------------------------------------------------------- */
const REF_APEX_X = 419;
const REF_SHARP_TOP = 64;
const REF_BASE = 540;
const REF_TOP = 84; /* visible top of the rounded red apex */
const REF_H = REF_BASE - REF_SHARP_TOP;
const REF_W = (2 * REF_H) / Math.sqrt(3);
const TRI_RATIO = (REF_BASE - REF_TOP) / REF_W;
const CORNER = 20;
const BAND = 40;
const FACE_CORNER = 4;

const INRADIUS = REF_H / 3;
const INCENTRE_Y = REF_BASE - INRADIUS;
/* The sharp triangle shrunk about the incentre by `by` units on every side. */
const insetTriangle = (by: number) => {
  const k = (INRADIUS - by) / INRADIUS;
  const sharp: Point[] = [
    [REF_APEX_X, REF_SHARP_TOP],
    [REF_APEX_X + REF_W / 2, REF_BASE],
    [REF_APEX_X - REF_W / 2, REF_BASE],
  ];
  return pts(sharp.map(([x, y]) => [REF_APEX_X + (x - REF_APEX_X) * k, INCENTRE_Y + (y - INCENTRE_Y) * k] as const));
};
/* A polygon inset by r and stroked 2r wide fills the full shape with corners rounded to r. */
const redPoints = insetTriangle(CORNER);
const facePoints = insetTriangle(BAND + FACE_CORNER);

const join = { strokeLinejoin: "round", strokeLinecap: "round" } as const;
const solid = (c: string, w: number) => ({ fill: c, stroke: c, strokeWidth: w, ...join }) as const;

/* `w` is the scene width of the (sharp) red triangle; (cx, top) is where its visible apex sits.
 * Children are drawn in reference space. */
function WarningTriangle({
  cx,
  top,
  w,
  children,
}: {
  cx: number;
  top: number;
  w: number;
  children?: React.ReactNode;
}) {
  const s = w / REF_W;
  return (
    <g transform={`translate(${cx - REF_APEX_X * s} ${top - REF_TOP * s}) scale(${s})`}>
      <polygon points={redPoints} {...solid(SILVER, 2 * CORNER + 18)} />
      <polygon points={redPoints} {...solid(FACE, 2 * CORNER + 8)} />
      <polygon points={redPoints} {...solid(RED, 2 * CORNER)} />
      <polygon points={facePoints} {...solid(FACE, 2 * FACE_CORNER)} />
      {children}
    </g>
  );
}

/* A boy running, holding the hand of a woman in a flared dress: traced from the reference photo. */
const PEDESTRIANS_PATH =
  "M454 263L458 263L468 267L475 274L477 280L477 287L474 295L468 301L458 305L447 303L441 299L435 284L440 270L445 266Z" +
  "M348 309L354 309L359 311L368 320L369 326L366 335L359 342L355 343L346 343L340 340L336 334L334 328L337 316Z" +
  "M430 312L472 313L479 319L497 351L536 359L540 360L540 364L532 371L520 372L488 365L474 352L502 413L450 415L413 415" +
  "L412 413L429 336L424 337L406 349L408 365L409 393L383 405L377 406L372 405L367 399L363 391L362 391L360 400L320 402" +
  "L322 375L318 376L306 385L308 418L304 423L301 423L297 415L294 380L303 370L325 354L361 354L367 357L373 363L380 385" +
  "L390 383L394 380L394 376L389 346L390 340L417 318Z" +
  "M359 407L375 463L377 479L371 484L365 484L360 479L349 431L345 428L340 428L336 431L335 441L332 444L284 467L281 463" +
  "L281 456L284 451L319 430L320 409Z" +
  "M413 420L436 421L437 422L410 456L404 461L398 464L386 464L382 462L382 459Z" +
  "M468 420L490 420L512 469L513 476L510 481L500 484L493 479Z";

function Pedestrians() {
  return <path d={PEDESTRIANS_PATH} fill={INK} fillRule="evenodd" strokeLinejoin="round" />;
}

/* Measured off the photo: a 104-wide body from 69 below the face apex to 8 above its base, and
 * three lamps of radius 41, 90 apart. */
function TrafficLight() {
  return (
    <g>
      <rect x={REF_APEX_X - 52} y={214} width={104} height={278} rx={52} fill={INK} />
      <circle cx={REF_APEX_X} cy={265} r={41} fill={RED} />
      <circle cx={REF_APEX_X} cy={354.5} r={41} fill="#ffee00" />
      <circle cx={REF_APEX_X} cy={444.5} r={41} fill="#8dc63f" />
    </g>
  );
}

function octagonPoints(cx: number, cy: number, r: number): Point[] {
  return Array.from({ length: 8 }, (_, k) => {
    const angle = ((22.5 + 45 * k) * Math.PI) / 180;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
  });
}

/* ---------------------------------------------------------------------------------------------
 * The scene: a two-lane road (right-hand traffic) receding to a vanishing point on the horizon,
 * with a zebra crossing in the foreground and a one-way side street joining from the left. Each
 * sign stands where it would on a real road: children crossing just before the zebra, traffic
 * lights ahead and give way further on along the right verge; at the side street, STOP on the
 * exiting drivers' right (the near corner, behind a stop line) and no entry facing the main road
 * (the far corner). Signs, posts and trees scale with depth.
 * ------------------------------------------------------------------------------------------- */
const HORIZON = 108;
const VP_X = 120;
const BOTTOM = 300;
/* The road's edges where it leaves the bottom of the frame. */
const ROAD_L = -50;
const ROAD_R = 150;

/* 0 at the horizon, 1 at the bottom edge. */
const depth = (y: number) => (y - HORIZON) / (BOTTOM - HORIZON);
/* x across the road at fraction f (0 = left edge, 1 = right edge) and screen height y. */
const roadX = (f: number, y: number) => VP_X + (ROAD_L + (ROAD_R - ROAD_L) * f - VP_X) * depth(y);
/* The strip of road between fractions f0..f1 and heights y0..y1. */
const strip = (f0: number, f1: number, y0: number, y1: number) =>
  pts([
    [roadX(f0, y0), y0],
    [roadX(f1, y0), y0],
    [roadX(f1, y1), y1],
    [roadX(f0, y1), y1],
  ]);
/* World distance z (1 at the bottom edge) to screen height. */
const zToY = (z: number) => HORIZON + (BOTTOM - HORIZON) / z;

const SIDE_FAR = 194;
const SIDE_NEAR = 226;
const ZEBRA = { far: 240, near: 258 } as const;
const ZEBRA_BARS = 7;
/* The cross road at the signalled junction, and our lane's stop line just before it. */
const CROSS = { far: 150, near: 166 } as const;
const STOP_LINE_Y = 168;
/* Pavement either side of the main road, as fractions of the road width beyond each kerb. */
const KERB = 0.035;
const PAVEMENT = 0.2;

const clear = (far: number, near: number) =>
  (near < ZEBRA.far - 2 || far > ZEBRA.near + 2) && (near < CROSS.far - 1 || far > STOP_LINE_Y + 3);
const centreDashes = Array.from({ length: 30 }, (_, i) => 1 + i * 0.7)
  .map((z) => [zToY(z + 0.35), zToY(z)] as const)
  .filter(([far, near]) => far > HORIZON + 1 && clear(far, near));

/* A post standing on the ground at (x, y), `height` tall at full depth, scaled by depth. */
function Post({ x, y, height }: { x: number; y: number; height: number }) {
  const d = depth(y);
  return (
    <g>
      <ellipse cx={x + 2 * d} cy={y} rx={7 * d} ry={1.8 * d} className="fill-slate-900/15 dark:fill-black/40" />
      <rect
        x={x - 1.6 * d}
        y={y - height * d}
        width={3.2 * d}
        height={height * d}
        className="fill-slate-400 dark:fill-slate-500"
      />
    </g>
  );
}

/* A street tree, about twice the height of a sign post. */
function Tree({ x, y }: { x: number; y: number }) {
  const d = depth(y);
  return (
    <g>
      <ellipse cx={x} cy={y} rx={14 * d} ry={2.5 * d} className="fill-slate-900/10 dark:fill-black/30" />
      <rect x={x - 2 * d} y={y - 70 * d} width={4 * d} height={70 * d} className="fill-stone-400 dark:fill-stone-600" />
      <ellipse cx={x} cy={y - 92 * d} rx={20 * d} ry={30 * d} className="fill-emerald-300 dark:fill-emerald-900" />
      <ellipse cx={x - 6 * d} cy={y - 82 * d} rx={11 * d} ry={17 * d} className="fill-emerald-400/70 dark:fill-emerald-800" />
    </g>
  );
}

/* Town towers along the far side of the cross road: [left x, width, top y, tone]. They stop short
 * of the pavements so the main road stays visible to the horizon. */
const TOWER_BASE = CROSS.far - 3;
const TOWER_TONES = [
  "fill-slate-200 dark:fill-slate-800",
  "fill-slate-300 dark:fill-slate-700",
  "fill-indigo-100 dark:fill-indigo-950",
] as const;
const TOWERS: readonly (readonly [number, number, number, number])[] = [
  [-34, 18, 86, 1],
  [-16, 15, 100, 0],
  [-1, 20, 70, 2],
  [19, 16, 92, 1],
  [35, 22, 78, 0],
  [57, 19, 98, 2],
  [140, 18, 96, 0],
  [158, 22, 72, 2],
  [180, 14, 100, 1],
  [194, 20, 64, 0],
  [214, 22, 86, 2],
];

function Tower({ x, w, top, tone }: { x: number; w: number; top: number; tone: number }) {
  const rows = Math.floor((TOWER_BASE - top - 8) / 6);
  const cols = Math.floor((w - 3) / 5);
  const inset = (w - cols * 5 + 3) / 2;
  return (
    <g>
      {w >= 20 && top < 80 && <rect x={x + w / 2 - 0.4} y={top - 8} width={0.8} height={8} className={TOWER_TONES[1]} />}
      <rect x={x} y={top} width={w} height={TOWER_BASE - top} className={TOWER_TONES[tone]} />
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        /* A fixed scatter of lit windows for the night scene. */
        const lit = (row * 7 + col * 3 + Math.round(x)) % 4 === 0;
        return (
          <rect
            key={i}
            x={x + inset + col * 5}
            y={top + 4 + row * 6}
            width={2}
            height={3}
            className={lit ? "fill-white/80 dark:fill-amber-200/80" : "fill-white/60 dark:fill-slate-900/60"}
          />
        );
      })}
    </g>
  );
}

/* ---------------------------------------------------------------------------------------------
 * Traffic signals: one for each approach to the crossroads, on the approaching driver's right
 * (right-hand traffic). Ours (northbound) faces us from the near-right corner on a mast arm over
 * our lane, showing red; the oncoming one stands on the far-left corner and faces away, so we see
 * the back of its head; the two for the cross road (green while ours is red) are seen side-on, on
 * the near-left corner facing eastbound traffic and on the far-right corner facing westbound.
 * ------------------------------------------------------------------------------------------- */
const HEAD_W = 14;
const HEAD_H = 36;
const LAMP_Y = [7, 18, 29] as const;
const LAMPS = [
  { on: "#ef4444", off: "#7f1d1d" },
  { on: "#f59e0b", off: "#713f12" },
  { on: "#22c55e", off: "#14532d" },
] as const;
type Aspect = 0 | 2; /* index of the lit lamp: red or green */
type HeadView = "front" | "back" | "left" | "right";

function SignalHead({ cx, top, d, view, lit }: { cx: number; top: number; d: number; view: HeadView; lit: Aspect }) {
  if (view === "back")
    return (
      <rect
        x={cx - (HEAD_W / 2) * d}
        y={top}
        width={HEAD_W * d}
        height={HEAD_H * d}
        rx={3 * d}
        className="fill-slate-600 dark:fill-slate-500"
      />
    );
  if (view === "front")
    return (
      <g>
        <rect x={cx - (HEAD_W / 2) * d} y={top} width={HEAD_W * d} height={HEAD_H * d} rx={3 * d} fill={INK} />
        {LAMPS.map((lamp, i) => (
          <circle key={i} cx={cx} cy={top + LAMP_Y[i] * d} r={4.4 * d} fill={i === lit ? lamp.on : lamp.off} />
        ))}
      </g>
    );
  /* Side-on: a narrow housing, with the lit lamp glowing on the face it turns towards. */
  const w = 5 * d;
  const face = view === "left" ? cx - w / 2 : cx + w / 2;
  return (
    <g>
      <rect x={cx - w / 2} y={top} width={w} height={HEAD_H * d} rx={1.5 * d} fill={INK} />
      <ellipse cx={face} cy={top + LAMP_Y[lit] * d} rx={1.6 * d} ry={4.4 * d} fill={LAMPS[lit].on} />
    </g>
  );
}

const SIGNAL_H = 80;
const MAST_H = 110;

/* A signal on its own post, the head on top. */
function SignalPost({ x, y, view, lit }: { x: number; y: number; view: HeadView; lit: Aspect }) {
  const d = depth(y);
  return (
    <g>
      <Post x={x} y={y} height={SIGNAL_H} />
      <SignalHead cx={x} top={y - (SIGNAL_H + HEAD_H) * d} d={d} view={view} lit={lit} />
    </g>
  );
}

/* Our signal: a mast arm from the post reaching over our lane, the head hanging from it. */
function MastSignal({ x, y, lit }: { x: number; y: number; lit: Aspect }) {
  const d = depth(y);
  const armY = y - MAST_H * d;
  const headX = roadX(0.75, y);
  return (
    <g>
      <Post x={x} y={y} height={MAST_H} />
      <rect x={headX} y={armY} width={x - headX} height={2.4 * d} className="fill-slate-400 dark:fill-slate-500" />
      <SignalHead cx={headX} top={armY + 1.6 * d} d={d} view="front" lit={lit} />
    </g>
  );
}

/* Sign placements: the base of each post on the ground. Sizes are at full depth and close to real
 * proportions against the road (two lanes are 200 units, so a 0.9 m triangle is about 26), only
 * slightly enlarged so the pictograms still read. */
const POST_H = 62;
const TRI_W = 40;
const DISC_R = 15;
const onRight = (y: number) => roadX(1, y) + 22 * depth(y);
const onLeft = (y: number) => roadX(0, y) - 16 * depth(y);

const CHILDREN_BASE = { x: onRight(292), y: 292 };
const LIGHTS_BASE = { x: onRight(198), y: 198 };
const GIVE_WAY_BASE = { x: onRight(136), y: 136 };
/* Signal corners: just short of the cross road on the near side, on the far pavement beyond it. */
const NEAR_CORNER = STOP_LINE_Y + 4;
const FAR_CORNER = CROSS.far - 3;
const SIGNAL_OURS = { x: onRight(NEAR_CORNER), y: NEAR_CORNER };
const SIGNAL_EASTBOUND = { x: roadX(-0.11, NEAR_CORNER), y: NEAR_CORNER };
const SIGNAL_WESTBOUND = { x: roadX(1.11, FAR_CORNER), y: FAR_CORNER };
const SIGNAL_ONCOMING = { x: roadX(-0.11, FAR_CORNER), y: FAR_CORNER };
const STOP_BASE = { x: onLeft(238), y: 238 };
const NO_ENTRY_BASE = { x: onLeft(190), y: 190 };

/* A warning triangle whose base sits on top of its post. */
function TriangleOnPost({ x, y, children }: { x: number; y: number; children?: React.ReactNode }) {
  const d = depth(y);
  const w = TRI_W * d;
  return (
    <g>
      <Post x={x} y={y} height={POST_H} />
      <WarningTriangle cx={x} top={y - POST_H * d - w * TRI_RATIO} w={w}>
        {children}
      </WarningTriangle>
    </g>
  );
}

function NoEntry({ x, y }: { x: number; y: number }) {
  const d = depth(y);
  const r = DISC_R * d;
  const cy = y - POST_H * d - r;
  return (
    <g>
      <Post x={x} y={y} height={POST_H} />
      <circle cx={x} cy={cy} r={r * 1.1} fill={SILVER} />
      <circle cx={x} cy={cy} r={r * 1.07} fill={FACE} />
      <circle cx={x} cy={cy} r={r} fill={RED} />
      <rect x={x - r * 0.6} y={cy - r * 0.16} width={r * 1.2} height={r * 0.32} fill={FACE} />
    </g>
  );
}

function Stop({ x, y }: { x: number; y: number }) {
  const d = depth(y);
  const r = DISC_R * d;
  const cy = y - POST_H * d - r;
  const points = pts(octagonPoints(x, cy, r));
  return (
    <g>
      <Post x={x} y={y} height={POST_H} />
      <polygon points={points} {...solid(SILVER, r * 0.32)} />
      <polygon points={points} {...solid(FACE, r * 0.27)} />
      <polygon points={points} {...solid(RED, r * 0.17)} />
      <text
        x={x}
        y={cy + r * 0.23}
        textAnchor="middle"
        fontSize={r * 0.62}
        fontWeight={800}
        fill={FACE}
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing={-r * 0.017}
      >
        STOP
      </text>
    </g>
  );
}

const asphalt = "fill-slate-500 dark:fill-slate-700";
const kerb = "fill-slate-300 dark:fill-slate-600";
const paint = "fill-white dark:fill-slate-200";
const EDGE_L = SCENE.left - 4;
const EDGE_R = SCENE.left + SCENE.width + 4;

function RoadSignsIllustration() {
  return (
    <svg
      viewBox={`${SCENE.left} ${SCENE.top} ${SCENE.width} ${SCENE.height}`}
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      {/* sky: sun over the vanishing point, clouds and distant hills */}
      <circle cx={VP_X} cy={84} r={12}className="fill-amber-200 dark:fill-amber-200/25" />
      <g className="fill-slate-100 dark:fill-slate-800/70">
        <path d="M118 52a9 9 0 0 1 16-6a11 11 0 0 1 20 3a7 7 0 0 1 4 13h-36a6 6 0 0 1-4-10Z" />
        <path d="M-12 22a7 7 0 0 1 12-4a9 9 0 0 1 16 2a6 6 0 0 1 3 10h-28a5 5 0 0 1-3-8Z" />
        <path d="M178 -6a7 7 0 0 1 12-4a9 9 0 0 1 16 2a6 6 0 0 1 3 10h-28a5 5 0 0 1-3-8Z" />
      </g>
      <path
        d={`M${EDGE_L} ${HORIZON}C0 92 34 94 64 103C88 90 122 92 150 102C176 90 212 92 ${EDGE_R} 100V${HORIZON + 1}H${EDGE_L}Z`}
        className="fill-slate-200 dark:fill-slate-800"
      />

      {/* verges */}
      <rect
        x={EDGE_L}
        y={HORIZON}
        width={EDGE_R - EDGE_L}
        height={SCENE_BOTTOM + 4 - HORIZON}
        className="fill-emerald-50 dark:fill-emerald-950/60"
      />

      {TOWERS.map(([x, w, top, tone]) => (
        <Tower key={x} x={x} w={w} top={top} tone={tone} />
      ))}

      {/* pavements along the main road, broken where the cross road and side street meet it */}
      <g className="fill-stone-200 dark:fill-stone-800">
        <polygon points={strip(-PAVEMENT, -KERB, HORIZON, CROSS.far - 2)} />
        <polygon points={strip(-PAVEMENT, -KERB, CROSS.near + 1.5, SIDE_FAR - 2)} />
        <polygon points={strip(-PAVEMENT, -KERB, SIDE_NEAR + 2.4, SCENE_BOTTOM + 4)} />
        <polygon points={strip(1 + KERB, 1 + PAVEMENT, HORIZON, CROSS.far - 2)} />
        <polygon points={strip(1 + KERB, 1 + PAVEMENT, CROSS.near + 1.5, SCENE_BOTTOM + 4)} />
      </g>

      {/* cross road at the signalled junction, kerbed on both sides */}
      <rect x={EDGE_L} y={CROSS.far - 2} width={EDGE_R - EDGE_L} height={2} className={kerb} />
      <rect x={EDGE_L} y={CROSS.near} width={EDGE_R - EDGE_L} height={1.5} className={kerb} />
      <rect x={EDGE_L} y={CROSS.far} width={EDGE_R - EDGE_L} height={CROSS.near - CROSS.far} className={asphalt} />

      {/* side street: in one-point perspective its edges are horizontal; kerbs along both sides */}
      <rect x={EDGE_L} y={SIDE_FAR - 2} width={roadX(0, SIDE_FAR) - EDGE_L} height={2} className={kerb} />
      <rect x={EDGE_L} y={SIDE_NEAR} width={roadX(0, SIDE_NEAR) - EDGE_L} height={2.4} className={kerb} />
      <polygon
        points={pts([
          [EDGE_L, SIDE_FAR],
          [roadX(0, SIDE_FAR), SIDE_FAR],
          [roadX(0, SIDE_NEAR), SIDE_NEAR],
          [EDGE_L, SIDE_NEAR],
        ])}
        className={asphalt}
      />

      {/* main road with kerbs; the kerbs stop at the cross road and the side street */}
      <g className={kerb}>
        <polygon points={strip(-KERB, 0, HORIZON, CROSS.far - 2)} />
        <polygon points={strip(-KERB, 0, CROSS.near + 1.5, SIDE_FAR - 2)} />
        <polygon points={strip(-KERB, 0, SIDE_NEAR + 2.4, SCENE_BOTTOM + 4)} />
        <polygon points={strip(1, 1 + KERB, HORIZON, CROSS.far - 2)} />
        <polygon points={strip(1, 1 + KERB, CROSS.near + 1.5, SCENE_BOTTOM + 4)} />
      </g>
      <polygon points={strip(0, 1, HORIZON, SCENE_BOTTOM + 4)} className={asphalt} />

      {/* markings: edge lines (broken at both junctions), centre dashes on both roads, stop lines,
          zebra */}
      <g className={paint}>
        <polygon points={strip(0.03, 0.045, HORIZON + 1, CROSS.far)} />
        <polygon points={strip(0.03, 0.045, CROSS.near, SIDE_FAR)} />
        <polygon points={strip(0.03, 0.045, SIDE_NEAR, SCENE_BOTTOM + 4)} />
        <polygon points={strip(0.955, 0.97, HORIZON + 1, CROSS.far)} />
        <polygon points={strip(0.955, 0.97, CROSS.near, SCENE_BOTTOM + 4)} />
        {Array.from({ length: 14 }, (_, i) => EDGE_L + 4 + i * 20)
          .filter((x) => x + 10 < roadX(0, CROSS.near) - 3 || x > roadX(1, CROSS.near) + 3)
          .map((x) => (
            <rect key={x} x={x} y={(CROSS.far + CROSS.near) / 2 - 0.5} width={10} height={1} />
          ))}
        <polygon points={strip(0.5, 0.97, STOP_LINE_Y, STOP_LINE_Y + 1.8)} />
        {centreDashes.map(([far, near]) => (
          <polygon key={far} points={strip(0.492, 0.508, far, near)} />
        ))}
        <polygon
          points={pts([
            [roadX(0, SIDE_FAR) - 7, SIDE_FAR],
            [roadX(0, SIDE_FAR) - 4.5, SIDE_FAR],
            [roadX(0, SIDE_NEAR) - 4.5, SIDE_NEAR],
            [roadX(0, SIDE_NEAR) - 7.5, SIDE_NEAR],
          ])}
        />
        {Array.from({ length: ZEBRA_BARS }, (_, i) => {
          const slot = 1 / (ZEBRA_BARS * 2 + 1);
          const f0 = slot * (2 * i + 1);
          return <polygon key={i} points={strip(f0, f0 + slot, ZEBRA.far, ZEBRA.near)} />;
        })}
      </g>

      {/* everything standing on the ground, drawn far to near so nearer things cover farther ones */}
      <TriangleOnPost {...GIVE_WAY_BASE} />
      <SignalPost {...SIGNAL_ONCOMING} view="back" lit={0} />
      <SignalPost {...SIGNAL_WESTBOUND} view="right" lit={2} />
      <SignalPost {...SIGNAL_EASTBOUND} view="left" lit={2} />
      <MastSignal {...SIGNAL_OURS} lit={0} />
      <NoEntry {...NO_ENTRY_BASE} />
      <TriangleOnPost {...LIGHTS_BASE}>
        <TrafficLight />
      </TriangleOnPost>
      <Tree x={214} y={214} />
      <Stop {...STOP_BASE} />
      <Tree x={232} y={268} />
      <TriangleOnPost {...CHILDREN_BASE}>
        <Pedestrians />
      </TriangleOnPost>
    </svg>
  );
}
