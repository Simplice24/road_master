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
const GROUND_Y = 262;
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

const SIGN1 = { cx: 50, top: 80, w: 88 } as const;
const SIGN2 = { cx: 150, top: 68, w: 88 } as const;
const NO_ENTRY = { cx: 30, cy: 214, r: 28 } as const;
const GIVE_WAY = { cx: 104, top: 192, w: 84 } as const;
const STOP = { cx: 168, cy: 208, r: 30 } as const;

const poleBottom = SCENE_BOTTOM + 4;
const signBottom = ({ top, w }: { top: number; w: number }) => top + w * TRI_RATIO;

function RoadSignsIllustration() {
  const stopPoints = pts(octagonPoints(STOP.cx, STOP.cy, STOP.r));
  return (
    <svg
      viewBox={`${SCENE.left} ${SCENE.top} ${SCENE.width} ${SCENE.height}`}
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      {/* ground */}
      <rect
        x={SCENE.left - 4}
        y={GROUND_Y}
        width={SCENE.width + 8}
        height={SCENE_BOTTOM + 4 - GROUND_Y}
        className="fill-muted"
      />

      {/* bases of the two high signs, then the poles over them */}
      <ellipse cx={SIGN1.cx} cy={GROUND_Y} rx={26} ry={6} className="fill-foreground" opacity={0.85} />
      <ellipse cx={SIGN2.cx} cy={GROUND_Y} rx={26} ry={6} className="fill-foreground" opacity={0.85} />
      {/* the two high signs stand on bases, the three low ones run off the bottom edge */}
      <g className="stroke-muted-foreground" strokeWidth={4} strokeLinecap="butt" fill="none">
        <path d={`M${SIGN1.cx} ${signBottom(SIGN1)}V${GROUND_Y}`} />
        <path d={`M${SIGN2.cx} ${signBottom(SIGN2)}V${GROUND_Y}`} />
        <path d={`M${NO_ENTRY.cx} ${NO_ENTRY.cy}V${poleBottom}`} />
        <path d={`M${GIVE_WAY.cx} ${signBottom(GIVE_WAY)}V${poleBottom}`} />
        <path d={`M${STOP.cx} ${STOP.cy}V${poleBottom}`} />
      </g>

      {/* children crossing */}
      <WarningTriangle {...SIGN1}>
        <Pedestrians />
      </WarningTriangle>

      {/* traffic signals ahead */}
      <WarningTriangle {...SIGN2}>
        <TrafficLight />
      </WarningTriangle>

      {/* no entry */}
      <circle cx={NO_ENTRY.cx} cy={NO_ENTRY.cy} r={NO_ENTRY.r + 3.2} fill={SILVER} />
      <circle cx={NO_ENTRY.cx} cy={NO_ENTRY.cy} r={NO_ENTRY.r + 2} fill={FACE} />
      <circle cx={NO_ENTRY.cx} cy={NO_ENTRY.cy} r={NO_ENTRY.r} fill={RED} />
      <rect x={NO_ENTRY.cx - 17} y={NO_ENTRY.cy - 4.5} width={34} height={9} fill={FACE} />

      {/* give way */}
      <WarningTriangle {...GIVE_WAY} />

      {/* stop */}
      <polygon points={stopPoints} {...solid(SILVER, 9.5)} />
      <polygon points={stopPoints} {...solid(FACE, 8)} />
      <polygon points={stopPoints} {...solid(RED, 5)} />
      <text
        x={STOP.cx}
        y={STOP.cy + 7}
        textAnchor="middle"
        fontSize={18.5}
        fontWeight={800}
        fill={FACE}
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing={-0.5}
      >
        STOP
      </text>
    </svg>
  );
}
