// Shared construction logic behind Box and Drawer: reads a Grid + Project
// and builds every Panel/Divider + the BasePlatePanel/LidPanel (both
// FlatPanel — see FlatPanel.js) — the OO replacement for
// PieceFactory.computePieces' orchestration plus the now-retired
// PanelBuilder/BasePlateBuilder/LidBuilder/DrawerBuilder's own per-piece
// decisions.
//
// Deliberately a single concrete build(), never overridden — the old
// DrawerBuilder already proved a synthetic 1-cell grid needs no
// special-casing here at all, it just called the exact same builders;
// Drawer differs only in how ITS OWN grid gets synthesized before this
// method runs (see the plan's own "construire() est unique" analysis).
import {
  enumerateWallRuns, xAt, yAt, junctionKindAt, resolveThickness, resolveHeight, perpendicularMatesAtPoint, lidMode,
  heightProfile, heightAt, junctionExclusionRanges, wallPieceId, isBasePlateRecessed, basePlateRecessMm,
  coverageRectangle, lidCoverage, OPPOSITE_SIDE,
} from '../../model/GridQuery.js';
import { isOuterSegment } from '../../model/Grid.js';
import { Notch } from './Notch.js';
import { Hole } from './Hole.js';
import { fingerEdgePath } from '../FingerJoint.js';
import { FingerEdge } from './FingerEdge.js';
import { SmoothEdge } from './SmoothEdge.js';
import { Panel } from './Panel.js';
import { Divider } from './Divider.js';
import { HalfLapNotch } from './HalfLapNotch.js';
import { MortiseHole } from './MortiseHole.js';
import { BasePlatePanel } from './BasePlatePanel.js';
import { LidPanel } from './LidPanel.js';
import { outerBoundarySide } from './OuterBoundary.js';

/** Whether/how `run` joints with a fixed lid — a lid only ever joints with
 *  OUTER runs (an interior divider's own geometry is entirely unaffected
 *  by it — GridQuery.validateLid guarantees a recessed lid always clears
 *  every divider, so there's structurally nothing for it to joint against
 *  there). `mode` is only meaningful when `active`; 'onTop' needs no
 *  insertHeightMm at all (it's always implicitly perimeterHeight), so
 *  unlike 'recessed' it doesn't require one to be set. */
function lidState(run, project) {
  const lid = project.lid;
  const mode = lidMode(project);
  const active = !!lid && lid.enabled && run.seg.thicknessGroup === 'outer' && (mode === 'onTop' || lid.insertHeightMm != null);
  return { active, mode };
}

/** Every mid-run junction along `run`'s own length, split into what it
 *  means for THIS run: an X crossing contributes a HalfLapNotch fragment
 *  (destined for the bottom edge if this run is 'h', the free/top edge if
 *  'v' — "h runs notch from the bottom, v runs from the top", see the
 *  plan) — never both, and never a hole (the crossing piece computes its
 *  own, symmetric, identical notch independently). A T-junction stem
 *  contributes MortiseHole(s) on THIS run's own face, regardless of
 *  'v'/'h' — generated straight from the stem's own end comb, so a hole
 *  can never drift out of sync with the tenon meant to sit in it. */
function crossingData(run, grid, project, spans) {
  const isV = run.kind === 'v';
  const start = isV ? run.rStart + 1 : run.cStart + 1;
  const end = isV ? run.rEnd : run.cEnd;
  const crossingFragments = [];
  const mortiseHoles = [];

  for (let i = start; i <= end; i++) {
    const [c, r] = isV ? [run.c, i] : [i, run.r];
    const crossing = junctionKindAt(grid, run.kind, c, r, false);
    if (crossing.kind === 'none') continue;
    const u = isV
      ? yAt(grid, project, r) - yAt(grid, project, run.rStart)
      : xAt(grid, project, c) - xAt(grid, project, run.cStart);

    if (crossing.kind === 'crossing') {
      const notch = HalfLapNotch.atCrossing(u, crossing, heightAt(spans, u), project);
      crossingFragments.push(notch.toEdgeFragment());
    } else if (crossing.kind === 'stem') {
      const stemStartWithFinger = run.kind === 'h'; // matches the old mortiseHoles' own convention
      for (const stemSeg of crossing.stems) {
        // Capped by the THROUGH piece's own local height at this exact u
        // (heightAt(spans, u), same helper the 'crossing' branch above
        // already uses) — never just the stem's own resolved height. A
        // stem taller than the through piece is locally reduced to here
        // would otherwise poke a mortise hole past the through piece's own
        // edge. No /2 here (unlike crossingNotchDepth): a mortise hole
        // passes all the way through the receiving piece's thickness
        // (handled separately via thicknessMm), it isn't a symmetric
        // half-lap shared between two interlocking pieces.
        const stemHeight = Math.min(resolveHeight(stemSeg, project), heightAt(spans, u));
        const segs = fingerEdgePath(stemHeight, project.fingerJoint, stemStartWithFinger);
        mortiseHoles.push(...MortiseHole.manyFromFingerSegments(segs, { axis: 'y', centerMm: u, thicknessMm: resolveThickness(stemSeg, project) }));
      }
    }
  }
  return { crossingFragments, mortiseHoles };
}

function maxMateThickness(mates, project) {
  return mates.length ? Math.max(...mates.map((m) => resolveThickness(m, project))) : 0;
}

/** A divider's own end comb overshoots the mating wall by half its
 *  thickness ONLY when that mating wall sits on an INTERIOR grid line
 *  (xAt/yAt's own centerline convention there — see their header comment):
 *  an 'outer' mate is always on the grid's own boundary row/column
 *  (Grid.js's defaultSegment), where xAt/yAt already contribute zero, so
 *  an ordinary divider ending at the box's own outer wall (junctionKindAt
 *  calls this 'stem' too) must NOT be shifted here — only a divider
 *  ending against another, fully-through divider. 'corner'/'none' never
 *  reach this (only called where protrusion !== 0, i.e. kind is 'stem' or
 *  'corner'). */
function stemBaselineCorrectionMm(junction, protrusionMm) {
  return junction.kind === 'stem' && junction.seg.thicknessGroup === 'inner' ? protrusionMm / 2 : 0;
}

/** The guaranteed-available flush margin at each end of `run`'s own
 *  bottom-comb tiling (combSegmentsFor) — the SAME tiling bottomEdge (and,
 *  when a lid is 'onTop', topEdge — both share identical lengthMm/
 *  fingerJoint/startWithFinger/exclusions with combSegmentsFor, see
 *  buildWallPiece below) is actually cut with. Read off the real tiling
 *  rather than re-deriving fingerEdgePath's own margin formula, so it
 *  stays correct even where tileWithExclusions has locally shrunk the
 *  margin near a nearby mid-run crossing. 0 whenever the outermost
 *  segment isn't 'flush' at all (an already-degenerate, out-of-scope
 *  case) — used to cap stemBaselineCorrectionMm below so a divider/comb
 *  corner-recession (see cornerClipMm) can never cut into a real tooth. */
function endMarginsFor(run, grid, project) {
  const segs = combSegmentsFor(run, grid, project);
  const first = segs[0];
  const last = segs[segs.length - 1];
  return {
    startMarginMm: first && first.kind === 'flush' ? first.length : 0,
    endMarginMm: last && last.kind === 'flush' ? last.length : 0,
  };
}

/** How far bottomEdge's/topEdge's(onTop) own corner point must recede to
 *  land exactly on leftEdge's/rightEdge's own stem-corrected corner (see
 *  Edge.js's startClipMm/endClipMm) — the same correctionMm already used
 *  for rightEdge/leftEdge's own baselineMm, defensively capped at the
 *  guaranteed-available flush margin so a project whose inner thickness
 *  exceeds its own fingerJoint.marginMm can never make this clip land
 *  inside a real tooth (a smaller, but never negative or tooth-cutting,
 *  residual step is accepted there instead — see the plan's own
 *  margin-vs-correction note). 0 whenever correctionMm is already 0. */
function cornerClipMm(correctionMm, marginMm) {
  return Math.min(correctionMm, marginMm);
}

/** `run`'s own bottom-edge tooth tiling — a throwaway FingerEdge's own
 *  segments(), which is provably the exact same tiling as the retired
 *  PanelBuilder.bottomCombSegments (verified directly against it in
 *  ooFingerEdge.test.js before this replaced the last standalone caller):
 *  same tileWithExclusions algorithm, same fingerEdgePath underneath.
 *  mateThicknessMm/baselineMm/signMm are irrelevant here — only the
 *  segment boundaries/kinds are used, never this throwaway edge's own
 *  points(). */
function combSegmentsFor(run, grid, project) {
  return new FingerEdge({
    lengthMm: run.length, fingerJoint: project.fingerJoint, startWithFinger: run.kind === 'v',
    mateThicknessMm: 0, exclusions: junctionExclusionRanges(run, grid, project),
  }).segments();
}

/** Which of `run`'s own edges are genuinely un-jointed (no finger comb) —
 *  the wall's own free/top edge (`isFreeEdge:true`), unless an onTop lid
 *  joints it there, OR an END edge (`aPoint`/`bPoint`) whose corner has no
 *  perpendicular mate at all — only reachable via a Drawer's own openSide,
 *  since a plain box's editor never lets an outer wall go missing (see
 *  Grid.toggleWall). At most one entry in every reachable case: a
 *  Drawer's own sleeve lid is ALWAYS 'onTop' (Drawer.sleeveContext), so a
 *  drawer wall's own free/top edge is NEVER smooth there — only an end
 *  can be, and only for the wall(s) actually adjacent to the missing side.
 *  `compass` is a GLOBAL direction, not Panel's own internal edge naming:
 *  for an 'h' run, aPoint/bPoint are west/east (left/right) as expected,
 *  but for a 'v' run they're north/south (top/bottom) instead — Panel's
 *  own "leftEdge"/"rightEdge" only ever means "the aPoint end"/"the bPoint
 *  end", regardless of which compass direction that actually is (see
 *  GridQuery.enumerateWallRuns' own aPoint/bPoint). `capMm` (end edges
 *  only) is how deep a notch may cut in — bounded by the wall's own
 *  length, the same way a notch on the free/top edge is bounded by the
 *  wall's own height. */
export function wallSmoothEdges(run, grid, project) {
  const spans = heightProfile(run, grid, project);
  const { active: lidActive, mode } = lidState(run, project);
  const lidOnTop = lidActive && mode === 'onTop';
  const protrusionA = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.aPoint[0], run.aPoint[1]), project);
  const protrusionB = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.bPoint[0], run.bPoint[1]), project);
  const aCompass = run.kind === 'h' ? 'left' : 'top';
  const bCompass = run.kind === 'h' ? 'right' : 'bottom';

  const edges = [];
  if (!lidOnTop) edges.push({ compass: 'top', isFreeEdge: true, lengthMm: run.length, frame: { axis: 'x', zeroBoundary: false, boundaryAt: (u) => heightAt(spans, u) } });
  if (protrusionA === 0) edges.push({ compass: aCompass, isFreeEdge: false, lengthMm: spans[0].height, capMm: run.length, frame: { axis: 'y', zeroBoundary: true, boundaryAt: () => 0 } });
  if (protrusionB === 0) edges.push({ compass: bCompass, isFreeEdge: false, lengthMm: spans[spans.length - 1].height, capMm: run.length, frame: { axis: 'y', zeroBoundary: false, boundaryAt: () => run.length } });
  return edges;
}

function wallHoldsRecessedBasePlate(run, project) {
  return isBasePlateRecessed(project) && run.seg.thicknessGroup === 'outer';
}

function mortiseHolesAt(centerMm, run, grid, project) {
  return MortiseHole.manyFromFingerSegments(combSegmentsFor(run, grid, project), {
    axis: 'x', centerMm, thicknessMm: project.outerThicknessMm,
  });
}

function outerRunsBySide(grid, project) {
  const cols = grid.sx.length, rows = grid.sy.length;
  const outerRuns = enumerateWallRuns(grid, project).filter((run) => isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
  return {
    top: outerRuns.find((run) => run.kind === 'h' && run.r === 0),
    right: outerRuns.find((run) => run.kind === 'v' && run.c === cols),
    bottom: outerRuns.find((run) => run.kind === 'h' && run.r === rows),
    left: outerRuns.find((run) => run.kind === 'v' && run.c === 0),
  };
}

function outerSideOf(run, grid, project) {
  const runBySide = outerRunsBySide(grid, project);
  const side = Object.keys(runBySide).find((candidate) => runBySide[candidate] && wallPieceId(runBySide[candidate]) === wallPieceId(run));
  if (!side) throw new Error(`outerSideOf: ${wallPieceId(run)} is not an outer wall`);
  return side;
}

function isBackingSide(side, coverage) {
  return side === coverage.side;
}

function isFacingSide(side, coverage) {
  return side === OPPOSITE_SIDE[coverage.side];
}

function flankSides(coverage) {
  return Object.keys(OPPOSITE_SIDE).filter((side) => !isBackingSide(side, coverage) && !isFacingSide(side, coverage));
}

function isAtFlankStart(side) {
  return side === 'top' || side === 'left';
}

function stripOffsetAlong(flankRun, coverage) {
  return isAtFlankStart(coverage.side) ? 0 : flankRun.length - coverage.depthMm;
}

function exclusionsWithinStrip(exclusions, offsetMm, lengthMm) {
  return exclusions
    .filter((ex) => ex.uEnd > offsetMm && ex.uStart < offsetMm + lengthMm)
    .map((ex) => ({
      uStart: Math.max(ex.uStart, offsetMm) - offsetMm,
      uEnd: Math.min(ex.uEnd, offsetMm + lengthMm) - offsetMm,
    }));
}

const FLANK_STARTS_WITH_TAB = true;

function flankTiling(flankRun, grid, project, coverage) {
  const lengthMm = coverage.depthMm;
  const offsetMm = stripOffsetAlong(flankRun, coverage);
  const exclusions = exclusionsWithinStrip(junctionExclusionRanges(flankRun, grid, project), offsetMm, lengthMm);
  return { lengthMm, offsetMm, exclusions, startWithFinger: FLANK_STARTS_WITH_TAB };
}

function flankSegments(flankRun, grid, project, coverage) {
  const { lengthMm, offsetMm, exclusions, startWithFinger } = flankTiling(flankRun, grid, project, coverage);
  const segments = new FingerEdge({
    lengthMm, fingerJoint: project.fingerJoint, startWithFinger, mateThicknessMm: 0, exclusions,
  }).segments();
  return { segments, offsetMm };
}

function hasAtLeastOneTab(segments) {
  return segments.some((segment) => segment.kind === 'finger');
}

export function coverageHoldsFlankTabs(grid, project, coverage) {
  const runBySide = outerRunsBySide(grid, project);
  return flankSides(coverage).every((side) => hasAtLeastOneTab(flankSegments(runBySide[side], grid, project, coverage).segments));
}

function flankMortiseHolesAt(centerMm, flankRun, grid, project, coverage) {
  const { segments, offsetMm } = flankSegments(flankRun, grid, project, coverage);
  return MortiseHole.manyFromFingerSegments(segments, {
    axis: 'x', centerMm, thicknessMm: project.outerThicknessMm, offsetMm,
  });
}

function lidMortiseHoles(run, grid, project) {
  const centerMm = project.lid.insertHeightMm + project.outerThicknessMm / 2;
  const coverage = lidCoverage(project);
  if (!coverage) return mortiseHolesAt(centerMm, run, grid, project);
  const side = outerSideOf(run, grid, project);
  if (isBackingSide(side, coverage)) return mortiseHolesAt(centerMm, run, grid, project);
  if (isFacingSide(side, coverage)) return [];
  return flankMortiseHolesAt(centerMm, run, grid, project, coverage);
}

export function buildWallPiece(run, grid, project) {
  const spans = heightProfile(run, grid, project);
  const fj = project.fingerJoint;
  const startWithFinger = run.kind === 'v';
  const extendToTips = run.seg.thicknessGroup === 'outer';

  const protrusionA = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.aPoint[0], run.aPoint[1]), project);
  const protrusionB = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.bPoint[0], run.bPoint[1]), project);
  const aJunction = junctionKindAt(grid, run.kind, run.aPoint[0], run.aPoint[1], true);
  const bJunction = junctionKindAt(grid, run.kind, run.bPoint[0], run.bPoint[1], true);
  const correctionA = stemBaselineCorrectionMm(aJunction, protrusionA);
  const correctionB = stemBaselineCorrectionMm(bJunction, protrusionB);
  // bottomEdge (and topEdge when lidOnTop) carry real teeth whose
  // positions must stay in sync with the base plate's own independent
  // combSegmentsFor call — so their own corner recession is capped at the
  // guaranteed-available flush margin (cappedStartClip/cappedEndClip).
  // topEdge's ordinary (SmoothEdge, flat) branch has no tooth to protect
  // at all, so it gets the FULL, uncapped correction instead — see below.
  const { startMarginMm, endMarginMm } = endMarginsFor(run, grid, project);
  const cappedStartClip = cornerClipMm(correctionA, startMarginMm);
  const cappedEndClip = cornerClipMm(correctionB, endMarginMm);
  const { crossingFragments, mortiseHoles } = crossingData(run, grid, project, spans);
  const { active: lidActive, mode } = lidState(run, project);
  const lidOnTop = lidActive && mode === 'onTop';
  const lidRecessed = lidActive && mode === 'recessed';
  const holdsRecessedBasePlate = wallHoldsRecessedBasePlate(run, project);
  const pieceId = wallPieceId(run);

  // Grip notches only ever splice into a genuinely un-jointed edge (see
  // wallSmoothEdges' own header comment) — never into a toothed topEdge
  // just because that's historically the only edge this used to check.
  // The wall's own free/top edge keeps its historical, unsuffixed pieceId
  // key (no migration needed, and it's still the overwhelmingly common
  // case); an END edge (only ever smooth for a Drawer wall adjacent to its
  // own openSide) uses a `${pieceId}:${compass}` key instead.
  const aCompass = run.kind === 'h' ? 'left' : 'top';
  const bCompass = run.kind === 'h' ? 'right' : 'bottom';
  // Each notch's own local height is read at ITS OWN center, so a
  // stepped-height run still resolves correctly per notch.
  const topGripFragments = !lidOnTop
    ? Notch.listFor(project.pieceNotches, pieceId)
        .map((notch) => notch.toEdgeFragment(heightAt(spans, notch.offsetMm + notch.widthMm / 2)))
    : [];
  // rightEdge's own baseline sits at its HIGH value (run.length) when
  // flush — cutting a notch there means REDUCING toward that baseline,
  // exactly like topEdge's own heightAt-based cut: toEdgeFragment's own
  // `localHeight - depthMm` already produces that directly, no adjustment
  // needed (verified against the actual outline, not just derived — see
  // ooAssembly.test.js).
  const rightGripFragments = protrusionB === 0
    ? Notch.listFor(project.pieceNotches, `${pieceId}:${bCompass}`).map((notch) => notch.toEdgeFragment(run.length))
    : [];
  // leftEdge's own baseline sits at its LOW value (0) when flush instead —
  // cutting a notch there means INCREASING away from 0, the mirror image
  // of rightEdge/topEdge's own convention. toEdgeFragment's formula always
  // DECREASES from whatever reference it's given, so computing it against
  // a 0 reference (giving a negative floor) and negating the result is
  // what turns that into the correct increasing-with-depth cut here.
  const leftGripFragments = protrusionA === 0
    ? Notch.listFor(project.pieceNotches, `${pieceId}:${aCompass}`).map((notch) => {
        const fragment = notch.toEdgeFragment(0);
        return { ...fragment, points: fragment.points.map((p) => ({ u: p.u, y: -p.y })) };
      })
    : [];

  const bottomMm = holdsRecessedBasePlate ? -(project.outerThicknessMm + basePlateRecessMm(project)) : 0;
  const bottomEdge = holdsRecessedBasePlate
    ? new SmoothEdge({ lengthMm: run.length, heightProfile: [{ uStart: 0, uEnd: run.length, height: bottomMm }] })
    : new FingerEdge({
        lengthMm: run.length, fingerJoint: fj, startWithFinger,
        mateThicknessMm: project.outerThicknessMm, baselineMm: 0, signMm: -1,
        exclusions: junctionExclusionRanges(run, grid, project),
        fragments: run.kind === 'h' ? crossingFragments : [],
        startClipMm: cappedStartClip, endClipMm: cappedEndClip,
      });
  const rightEdgeLengthMm = spans[spans.length - 1].height - bottomMm;
  const rightEdge = protrusionB === 0
    ? new SmoothEdge({
        lengthMm: rightEdgeLengthMm, startsAtMm: bottomMm,
        heightProfile: [{ uStart: 0, uEnd: rightEdgeLengthMm, height: run.length }],
        fragments: rightGripFragments,
      })
    : new FingerEdge({
        lengthMm: rightEdgeLengthMm, startsAtMm: bottomMm, fingerJoint: fj, startWithFinger,
        mateThicknessMm: protrusionB, extendToTips,
        baselineMm: run.length - correctionB, signMm: 1,
      });
  // An onTop lid replaces the free edge entirely for an outer run: the
  // wall ADDS fingers beyond its own nominal spans[0].height (baseline at
  // the wall's own true top edge, signMm pointing away from the wall's
  // body, mateThicknessMm reaching into the lid's own territory) —
  // exactly mirroring bottomEdge's own relationship with the base plate,
  // never carving into the wall's own existing height budget the way the
  // now-retired "flush" case used to. Deliberately no forceEndsToFinger
  // here, matching bottomEdge (which never used it either): the Lid's own
  // corner points are already snapped independently of either side's comb
  // phase (see FlatPanel.outline()'s topLeft/topRight etc.) — forcing
  // this edge's own physical tips to 'finger' regardless of their real
  // phase would protrude the wall's corner into space the Lid's own
  // (independently-snapped) corner never receded to make room for,
  // producing exactly the malformed corner shapes the old "flush" case
  // had. Otherwise (no lid, disabled, or recessed) the free edge stays a
  // plain SmoothEdge, unaffected — a recessed lid joints via holes instead
  // (below), never through the free edge itself.
  const topEdge = lidOnTop
    ? new FingerEdge({
        lengthMm: run.length, fingerJoint: fj, startWithFinger,
        mateThicknessMm: project.outerThicknessMm,
        baselineMm: spans[0].height, signMm: 1,
        exclusions: junctionExclusionRanges(run, grid, project),
        fragments: run.kind === 'v' ? [...crossingFragments, ...topGripFragments] : topGripFragments,
        startClipMm: cappedStartClip, endClipMm: cappedEndClip,
      })
    : new SmoothEdge({
        lengthMm: run.length, heightProfile: spans,
        fragments: run.kind === 'v' ? [...crossingFragments, ...topGripFragments] : topGripFragments,
        // No teeth to protect on a flat free edge (unlike bottomEdge/the
        // lidOnTop branch above) — the FULL, uncapped correction applies
        // here, so this end always reaches a perfect, step-free corner.
        startClipMm: correctionA, endClipMm: correctionB,
      });
  const leftEdgeLengthMm = spans[0].height - bottomMm;
  const leftEdge = protrusionA === 0
    ? new SmoothEdge({
        lengthMm: leftEdgeLengthMm, startsAtMm: bottomMm,
        heightProfile: [{ uStart: 0, uEnd: leftEdgeLengthMm, height: 0 }],
        fragments: leftGripFragments,
      })
    : new FingerEdge({
        lengthMm: leftEdgeLengthMm, startsAtMm: bottomMm, fingerJoint: fj, startWithFinger,
        mateThicknessMm: protrusionA, extendToTips,
        baselineMm: correctionA, signMm: -1,
      });

  // A RECESSED lid pokes its own tabs into a row of enclosed holes
  // mid-height on the wall's face instead — one hole per 'finger' segment
  // of the SAME bottomCombSegments tiling the lid's own tabs use
  // (OuterBoundary), so a hole can never drift out of sync with the tab
  // meant to sit in it. An onTop lid never needs holes — it joints through
  // the free edge itself (above).
  const lidHoles = lidRecessed ? lidMortiseHoles(run, grid, project) : [];
  const basePlateHoles = holdsRecessedBasePlate ? mortiseHolesAt(-project.outerThicknessMm / 2, run, grid, project) : [];

  const PanelClass = run.seg.thicknessGroup === 'outer' ? Panel : Divider;
  return new PanelClass({
    id: pieceId,
    kind: 'wall',
    thicknessGroup: run.seg.thicknessGroup,
    thicknessMm: resolveThickness(run.seg, project),
    bottomEdge, rightEdge, topEdge, leftEdge,
    holes: [...mortiseHoles, ...lidHoles, ...basePlateHoles, ...Hole.listFor(project.pieceHoles, pieceId)],
  });
}

/** A flat panel edge's own grip notches, keyed by `${pieceId}:${compass}` —
 *  distinct from a wall's plain `pieceId` key, since a single flat piece
 *  can have up to 4 independent open (smooth) edges, unlike a wall's own
 *  single free/top edge. Reuses the exact same unprefix-then-lookup a
 *  drawer's own wall notches already go through (Drawer.sleeveContext's
 *  `unprefixed`, above `pieceId` here is always the piece's own bare id —
 *  'base-plate'/'lid' — never drawer-prefixed, so this needs no special
 *  drawer handling of its own). `localHeight` is always 0: unlike a wall's
 *  stepped height profile, a flat edge's own flush baseline never varies
 *  along its length, and Edge/OuterBoundary's `inward` vector is flipped
 *  for this open-side branch (see openSide below) specifically so that a
 *  fragment computed against a 0 baseline still cuts INTO the panel, not
 *  out past its nominal boundary. */
function flatGripFragments(pieceId, compass, project) {
  return Notch.listFor(project.pieceNotches, `${pieceId}:${compass}`)
    .map((notch) => notch.toEdgeFragment(0));
}

/** The 4 boundary edges + FlatPanel descriptor for a base plate/lid's own
 *  outerBoundarySide assembly — shared between the two, `protrude` is the
 *  only thing that differs (an onTop lid is geometrically the base plate's
 *  mirror image). Returned in FlatPanel's own field names, via its
 *  compass->field table (top->bottomEdge, bottom->topEdge — see
 *  FlatPanel.js's own COMPASS_TO_FIELD comment for why), so the caller can
 *  feed this straight into `new FlatPanel(...)`. */
function buildBoundaryEdges(grid, project, protrude, pieceId, coverage = null) {
  const { widthMm, depthMm } = coverageRectangle(grid, project, coverage);
  const runBySide = outerRunsBySide(grid, project);
  const sideLengthMm = { top: widthMm, right: depthMm, bottom: widthMm, left: depthMm };
  const marginMm = project.outerThicknessMm;

  function fingerSide({ lengthMm, exclusions, startWithFinger }) {
    return new FingerEdge(outerBoundarySide({
      lengthMm, fingerJoint: project.fingerJoint, startWithFinger, marginMm, protrude, exclusions,
    }));
  }

  function fullSide(run) {
    return fingerSide({ lengthMm: run.length, exclusions: junctionExclusionRanges(run, grid, project), startWithFinger: run.kind === 'v' });
  }

  function flankSide(run) {
    return fingerSide(flankTiling(run, grid, project, coverage));
  }

  // An open side (no outer wall run there, e.g. a drawer sleeve's own
  // openSide, or the side facing a partial coverage) is a flush SmoothEdge
  // rather than null, so a grip-notch fragment can still splice into it.
  // FlatPanel.outline() tells it apart from a real side via `openSides`.
  function openSide(side) {
    const lengthMm = sideLengthMm[side];
    return new SmoothEdge({ lengthMm, heightProfile: [{ uStart: 0, uEnd: lengthMm, height: 0 }], fragments: flatGripFragments(pieceId, side, project) });
  }

  function isOpenSide(side) {
    return !runBySide[side] || (!!coverage && isFacingSide(side, coverage));
  }

  function edgeFor(side) {
    if (isOpenSide(side)) return openSide(side);
    const run = runBySide[side];
    if (!coverage || isBackingSide(side, coverage)) return fullSide(run);
    return flankSide(run);
  }

  return {
    bottomEdge: edgeFor('top'),
    rightEdge: edgeFor('right'),
    topEdge: edgeFor('bottom'),
    leftEdge: edgeFor('left'),
    widthMm, depthMm, marginMm, protrude,
    openSides: { top: isOpenSide('top'), right: isOpenSide('right'), bottom: isOpenSide('bottom'), left: isOpenSide('left') },
  };
}

// The box's floor (Socle in the plan/design discussion): a BasePlatePanel
// whose outer boundary protrudes only when recessed, plus one MortiseHole per
// finger segment of each interior Divider's own bottom comb (never touching
// the boundary — always fully interior, so unlike the boundary's own
// notches these are safe as independent closed holes).
export function buildBasePlate(grid, project) {
  const { bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides } = buildBoundaryEdges(grid, project, isBasePlateRecessed(project), 'base-plate');
  const runs = enumerateWallRuns(grid, project);
  const innerRuns = runs.filter((run) => !isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));

  const holes = innerRuns.flatMap((run) => {
    const segs = combSegmentsFor(run, grid, project);
    const thicknessMm = resolveThickness(run.seg, project);
    return run.kind === 'v'
      ? MortiseHole.manyFromFingerSegments(segs, { axis: 'y', centerMm: xAt(grid, project, run.c), thicknessMm, offsetMm: yAt(grid, project, run.rStart) })
      : MortiseHole.manyFromFingerSegments(segs, { axis: 'x', centerMm: yAt(grid, project, run.r), thicknessMm, offsetMm: xAt(grid, project, run.cStart) });
  });

  return new BasePlatePanel({
    thicknessMm: project.outerThicknessMm,
    bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides,
    holes: [...holes, ...Hole.listFor(project.pieceHoles, 'base-plate')],
  });
}

// The box's fixed lid (Plafond in the plan/design discussion): a LidPanel,
// either mode: 'onTop' (protrude:false, mirrors the base plate exactly —
// the walls ADD fingers to meet it, see Assembly.buildWallPiece) or mode:
// 'recessed' (protrude:true, its own tabs poke outward into holes cut
// mid-height into the walls). Never gets divider holes — a lid only ever
// joints with the OUTER walls (GridQuery.validateLid guarantees a recessed
// lid's own bottom face clears every interior divider, so there's
// structurally nothing for it to joint against there).
export function buildLid(grid, project) {
  const { lid } = project;
  const mode = lidMode(project);
  if (!lid || !lid.enabled || (mode === 'recessed' && lid.insertHeightMm == null)) return null;
  // Recessed: the lid's own tabs poke OUT into the walls' mid-height holes
  // (protrude:true). onTop: the lid mirrors the base plate exactly
  // (protrude:false) — the walls' own added fingers (buildWallPiece) do
  // the same job bottomEdge/base-plate already do above.
  const { bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides } = buildBoundaryEdges(grid, project, mode === 'recessed', 'lid', lidCoverage(project));
  return new LidPanel({
    thicknessMm: project.outerThicknessMm,
    bottomEdge, rightEdge, topEdge, leftEdge, widthMm, depthMm, marginMm, protrude, openSides,
    holes: Hole.listFor(project.pieceHoles, 'lid'),
  });
}

export class Assembly {
  constructor(grid, project) {
    this.grid = grid;
    this.project = project;
    this.panels = [];
    this.basePlate = null;
    this.lid = null;
  }

  build() {
    this.panels = enumerateWallRuns(this.grid, this.project).map((run) => buildWallPiece(run, this.grid, this.project));
    this.basePlate = buildBasePlate(this.grid, this.project);
    this.lid = buildLid(this.grid, this.project);
    return this;
  }

  allPieces() {
    const pieces = [...this.panels.map((p) => p.toPiece()), this.basePlate.toPiece()];
    if (this.lid) pieces.push(this.lid.toPiece());
    return pieces;
  }
}
