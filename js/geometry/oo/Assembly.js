// Shared construction logic behind Box and (later) Drawer: reads a Grid +
// Project and builds every Panel/Divider + the BasePlate/Lid — the OO
// replacement for PieceFactory.computePieces' orchestration plus
// PanelBuilder/BasePlateBuilder/LidBuilder's own per-piece decisions.
//
// Deliberately a single concrete build(), never overridden — DrawerBuilder
// today already proves a synthetic 1-cell grid needs no special-casing
// here at all, it just calls the exact same builders; a future Drawer
// class differs only in how ITS OWN grid gets synthesized before this
// method runs (see the plan's own "construire() est unique" analysis).
import { enumerateWallRuns, xAt, yAt, junctionKindAt, resolveThickness, resolveHeight, perpendicularMatesAtPoint, isLidFlush } from '../../model/GridQuery.js';
import { isOuterSegment } from '../../model/Grid.js';
import { heightProfile, heightAt, junctionExclusionRanges, wallPieceId, bottomCombSegments } from '../PanelBuilder.js';
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

/** Whether/how `run` joints with a fixed lid — mirrors buildWallPanel's
 *  own `lidActive`/`lidFlush` exactly: a lid only ever joints with OUTER
 *  runs (an interior divider's own geometry is entirely unaffected by
 *  it — GridQuery.validateLid guarantees the lid always clears every
 *  divider, so there's structurally nothing for it to joint against
 *  there). */
function lidState(run, grid, project) {
  const lid = project.lid;
  const active = !!lid && lid.enabled && lid.insertHeightMm != null && run.seg.thicknessGroup === 'outer';
  const flush = active && isLidFlush(grid, project, lid.insertHeightMm);
  return { active, flush, lid };
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
        const segs = fingerEdgePath(resolveHeight(stemSeg, project), project.fingerJoint, stemStartWithFinger);
        mortiseHoles.push(...MortiseHole.manyFromFingerSegments(segs, { axis: 'y', centerMm: u, thicknessMm: resolveThickness(stemSeg, project) }));
      }
    }
  }
  return { crossingFragments, mortiseHoles };
}

function maxMateThickness(mates, project) {
  return mates.length ? Math.max(...mates.map((m) => resolveThickness(m, project))) : 0;
}

function buildWallPiece(run, grid, project) {
  const spans = heightProfile(run, grid, project);
  const fj = project.fingerJoint;
  const startWithFinger = run.kind === 'v';
  const extendToTips = run.seg.thicknessGroup === 'outer';

  const protrusionA = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.aPoint[0], run.aPoint[1]), project);
  const protrusionB = maxMateThickness(perpendicularMatesAtPoint(grid, run.kind, run.bPoint[0], run.bPoint[1]), project);
  const { crossingFragments, mortiseHoles } = crossingData(run, grid, project, spans);
  const { active: lidActive, flush: lidFlush, lid } = lidState(run, grid, project);

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
  // A flush lid replaces the free edge entirely for an outer run (its own
  // comb, forced to reach both physical tips regardless of comb phase —
  // see FingerEdge.forceEndsToFinger's own comment on why that's
  // unconditional, not extendToTips' conditional merge). Otherwise (no
  // lid, disabled, or recessed) the free edge stays a plain SmoothEdge,
  // unaffected — a recessed lid joints via holes instead (below), never
  // through the free edge itself.
  const topEdge = lidFlush
    ? new FingerEdge({
        lengthMm: run.length, fingerJoint: fj, startWithFinger,
        mateThicknessMm: project.outerThicknessMm, forceEndsToFinger: true,
        baselineMm: spans[0].height - project.outerThicknessMm, signMm: 1,
        exclusions: junctionExclusionRanges(run, grid, project),
      })
    : new SmoothEdge({
        lengthMm: run.length, heightProfile: spans,
        fragments: run.kind === 'v' ? crossingFragments : [],
      });
  const leftEdge = new FingerEdge({
    lengthMm: spans[0].height, fingerJoint: fj, startWithFinger,
    mateThicknessMm: protrusionA, extendToTips, baselineMm: 0, signMm: -1,
  });

  // A RECESSED lid (active but not flush) pokes its own tabs into a row
  // of enclosed holes mid-height on the wall's face instead — one hole
  // per 'finger' segment of the SAME bottomCombSegments tiling the lid's
  // own tabs use (OuterBoundary), so a hole can never drift out of sync
  // with the tab meant to sit in it.
  const lidHoles = lidActive && !lidFlush
    ? MortiseHole.manyFromFingerSegments(bottomCombSegments(run, grid, project), {
        axis: 'x', centerMm: lid.insertHeightMm + project.outerThicknessMm / 2, thicknessMm: project.outerThicknessMm,
      })
    : [];

  const PanelClass = run.seg.thicknessGroup === 'outer' ? Panel : Divider;
  return new PanelClass({
    id: wallPieceId(run),
    kind: 'wall',
    thicknessGroup: run.seg.thicknessGroup,
    thicknessMm: resolveThickness(run.seg, project),
    bottomEdge, rightEdge, topEdge, leftEdge,
    holes: [...mortiseHoles, ...lidHoles],
  });
}

/** The 4 compass sides + margins for BasePlate/Lid's own outerBoundarySide
 *  assembly — shared between the two, `protrude` is the only thing that
 *  differs (a flush lid is geometrically the base plate's mirror image). */
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

function buildBasePlate(grid, project) {
  const { sides, widthMm, depthMm, margins } = buildBoundarySides(grid, project, false);
  const runs = enumerateWallRuns(grid, project);
  const innerRuns = runs.filter((run) => !isOuterSegment(grid, run.kind, run.aPoint[0], run.aPoint[1]));

  const holes = innerRuns.flatMap((run) => {
    const segs = bottomCombSegments(run, grid, project);
    const thicknessMm = resolveThickness(run.seg, project);
    return run.kind === 'v'
      ? MortiseHole.manyFromFingerSegments(segs, { axis: 'y', centerMm: xAt(grid, project, run.c), thicknessMm, offsetMm: yAt(grid, project, run.rStart) })
      : MortiseHole.manyFromFingerSegments(segs, { axis: 'x', centerMm: yAt(grid, project, run.r), thicknessMm, offsetMm: xAt(grid, project, run.cStart) });
  });

  return new BasePlate({ thicknessMm: project.outerThicknessMm, sides, widthMm, depthMm, margins, holes });
}

function buildLid(grid, project) {
  const { lid } = project;
  if (!lid || !lid.enabled || lid.insertHeightMm == null) return null;
  const flush = isLidFlush(grid, project, lid.insertHeightMm);
  const { sides, widthMm, depthMm, margins } = buildBoundarySides(grid, project, !flush);
  return new Lid({ thicknessMm: project.outerThicknessMm, sides, widthMm, depthMm, margins });
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
