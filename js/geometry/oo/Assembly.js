// Shared construction logic behind Box and Drawer: reads a Grid + Project
// and builds every Panel/Divider + the BasePlate/Lid — the OO replacement
// for PieceFactory.computePieces' orchestration plus the now-retired
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
  heightProfile, heightAt, junctionExclusionRanges, wallPieceId,
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
import { BasePlate } from './BasePlate.js';
import { Lid } from './Lid.js';
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
  return { active, mode, lid };
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

export function buildWallPiece(run, grid, project) {
  const spans = heightProfile(run, grid, project);
  const fj = project.fingerJoint;
  const startWithFinger = run.kind === 'v';
  const extendToTips = run.seg.thicknessGroup === 'outer';

  const protrusionA = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.aPoint[0], run.aPoint[1]), project);
  const protrusionB = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.bPoint[0], run.bPoint[1]), project);
  const { crossingFragments, mortiseHoles } = crossingData(run, grid, project, spans);
  const { active: lidActive, mode, lid } = lidState(run, project);
  const lidOnTop = lidActive && mode === 'onTop';
  const lidRecessed = lidActive && mode === 'recessed';
  const pieceId = wallPieceId(run);
  // Always targets the free/top edge, regardless of lid state (an onTop
  // lid's own top edge still solders these in — see buildWallPanel's own
  // gripOverrides wiring, passed into lidTopEdgePoints too, not just
  // freeEdgePoints). Each notch's own local height is read at ITS OWN
  // center, so a stepped-height run still resolves correctly per notch.
  const gripFragments = Notch.listFor(project.pieceNotches, pieceId)
    .map((notch) => notch.toEdgeFragment(heightAt(spans, notch.offsetMm + notch.widthMm / 2)));

  const bottomEdge = new FingerEdge({
    lengthMm: run.length, fingerJoint: fj, startWithFinger,
    mateThicknessMm: project.outerThicknessMm, baselineMm: 0, signMm: -1,
    exclusions: junctionExclusionRanges(run, grid, project),
    fragments: run.kind === 'h' ? crossingFragments : [],
  });
  const rightEdge = new FingerEdge({
    lengthMm: spans[spans.length - 1].height, fingerJoint: fj, startWithFinger,
    mateThicknessMm: protrusionB, extendToTips, baselineMm: run.length, signMm: 1,
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
  // phase (see outerBoundaryOutline's topLeft/topRight etc.) — forcing
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
        fragments: run.kind === 'v' ? [...crossingFragments, ...gripFragments] : gripFragments,
      })
    : new SmoothEdge({
        lengthMm: run.length, heightProfile: spans,
        fragments: run.kind === 'v' ? [...crossingFragments, ...gripFragments] : gripFragments,
      });
  const leftEdge = new FingerEdge({
    lengthMm: spans[0].height, fingerJoint: fj, startWithFinger,
    mateThicknessMm: protrusionA, extendToTips, baselineMm: 0, signMm: -1,
  });

  // A RECESSED lid pokes its own tabs into a row of enclosed holes
  // mid-height on the wall's face instead — one hole per 'finger' segment
  // of the SAME bottomCombSegments tiling the lid's own tabs use
  // (OuterBoundary), so a hole can never drift out of sync with the tab
  // meant to sit in it. An onTop lid never needs holes — it joints through
  // the free edge itself (above).
  const lidHoles = lidRecessed
    ? MortiseHole.manyFromFingerSegments(combSegmentsFor(run, grid, project), {
        axis: 'x', centerMm: lid.insertHeightMm + project.outerThicknessMm / 2, thicknessMm: project.outerThicknessMm,
      })
    : [];

  const PanelClass = run.seg.thicknessGroup === 'outer' ? Panel : Divider;
  return new PanelClass({
    id: pieceId,
    kind: 'wall',
    thicknessGroup: run.seg.thicknessGroup,
    thicknessMm: resolveThickness(run.seg, project),
    bottomEdge, rightEdge, topEdge, leftEdge,
    holes: [...mortiseHoles, ...lidHoles, ...Hole.listFor(project.pieceHoles, pieceId)],
  });
}

/** The 4 compass sides + margins for BasePlate/Lid's own outerBoundarySide
 *  assembly — shared between the two, `protrude` is the only thing that
 *  differs (an onTop lid is geometrically the base plate's mirror image). */
function buildBoundarySides(grid, project, protrude) {
  const cols = grid.sx.length, rows = grid.sy.length;
  const widthMm = xAt(grid, project, cols);
  const depthMm = yAt(grid, project, rows);
  const runs = enumerateWallRuns(grid, project);
  const outerRuns = runs.filter((run) => isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));
  const topRun = outerRuns.find((run) => run.kind === 'h' && run.r === 0);
  const bottomRun = outerRuns.find((run) => run.kind === 'h' && run.r === rows);
  const leftRun = outerRuns.find((run) => run.kind === 'v' && run.c === 0);
  const rightRun = outerRuns.find((run) => run.kind === 'v' && run.c === cols);
  const marginMm = project.outerThicknessMm;

  function side(run) {
    if (!run) return null;
    return new FingerEdge(outerBoundarySide({
      lengthMm: run.length, fingerJoint: project.fingerJoint, startWithFinger: run.kind === 'v',
      marginMm, protrude, exclusions: junctionExclusionRanges(run, grid, project),
    }));
  }

  const sign = protrude ? -1 : 1;
  const sides = {
    top: topRun ? { edge: side(topRun), axisPoint: (u) => ({ x: u, y: 0 }), inward: { x: 0, y: sign } } : null,
    right: rightRun ? { edge: side(rightRun), axisPoint: (u) => ({ x: widthMm, y: u }), inward: { x: -sign, y: 0 } } : null,
    bottom: bottomRun ? { edge: side(bottomRun), axisPoint: (u) => ({ x: u, y: depthMm }), inward: { x: 0, y: -sign } } : null,
    left: leftRun ? { edge: side(leftRun), axisPoint: (u) => ({ x: 0, y: u }), inward: { x: sign, y: 0 } } : null,
  };
  const margin = protrude ? 0 : marginMm;
  const margins = { top: margin, right: margin, bottom: margin, left: margin };
  return { sides, widthMm, depthMm, margins };
}

export function buildBasePlate(grid, project) {
  const { sides, widthMm, depthMm, margins } = buildBoundarySides(grid, project, false);
  const runs = enumerateWallRuns(grid, project);
  const innerRuns = runs.filter((run) => !isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));

  const holes = innerRuns.flatMap((run) => {
    const segs = combSegmentsFor(run, grid, project);
    const thicknessMm = resolveThickness(run.seg, project);
    return run.kind === 'v'
      ? MortiseHole.manyFromFingerSegments(segs, { axis: 'y', centerMm: xAt(grid, project, run.c), thicknessMm, offsetMm: yAt(grid, project, run.rStart) })
      : MortiseHole.manyFromFingerSegments(segs, { axis: 'x', centerMm: yAt(grid, project, run.r), thicknessMm, offsetMm: xAt(grid, project, run.cStart) });
  });

  return new BasePlate({
    thicknessMm: project.outerThicknessMm, sides, widthMm, depthMm, margins,
    holes: [...holes, ...Hole.listFor(project.pieceHoles, 'base-plate')],
  });
}

export function buildLid(grid, project) {
  const { lid } = project;
  const mode = lidMode(project);
  if (!lid || !lid.enabled || (mode === 'recessed' && lid.insertHeightMm == null)) return null;
  // Recessed: the lid's own tabs poke OUT into the walls' mid-height holes
  // (protrude:true). onTop: the lid mirrors the base plate exactly
  // (protrude:false) — the walls' own added fingers (buildWallPiece) do
  // the same job bottomEdge/BasePlate already do below.
  const { sides, widthMm, depthMm, margins } = buildBoundarySides(grid, project, mode === 'recessed');
  return new Lid({
    thicknessMm: project.outerThicknessMm, sides, widthMm, depthMm, margins,
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
