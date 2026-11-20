import {
  AvailabilityScenario,
  LeagueCode,
  PitchingPlanEntry,
  PlayerAvailabilityRecord,
  RotationEntry
} from "./types";

/**
 * Hypothetical test fixture from specification (for verification only, NOT a production default):
 * P(participates) = 0.60, P(win | participates) = 0.64, P(win | absent) = 0.49
 * Combined P(win) = 0.60 * 0.64 + 0.40 * 0.49 = 0.58
 */
export const SCENARIO_ARITHMETIC_FIXTURE = {
  isTestFixture: true,
  scenarios: [
    { label: "Participates", probability: 0.60, conditionalWinProb: 0.64 },
    { label: "Absent", probability: 0.40, conditionalWinProb: 0.49 }
  ],
  expectedCombinedWinProb: 0.58
};

export function marginalizeScenarios(
  scenarios: Array<{ probability: number; conditionalHomeWinProb: number; conditionalAwayWinProb?: number; conditionalTieProb?: number }>
): {
  homeWinProb: number;
  awayWinProb: number;
  tieProb: number;
} {
  if (scenarios.length === 0) {
    throw new Error("At least one availability scenario is required.");
  }
  let weightSum = 0;
  let homeWinProb = 0;
  let awayWinProb = 0;
  let tieProb = 0;

  for (const s of scenarios) {
    if (!Number.isFinite(s.probability) || s.probability < 0) {
      throw new Error(`Invalid negative or non-finite scenario probability: ${s.probability}`);
    }
    weightSum += s.probability;
    homeWinProb += s.probability * s.conditionalHomeWinProb;
    if (s.conditionalAwayWinProb !== undefined) {
      awayWinProb += s.probability * s.conditionalAwayWinProb;
    } else {
      awayWinProb += s.probability * (1 - s.conditionalHomeWinProb - (s.conditionalTieProb ?? 0));
    }
    tieProb += s.probability * (s.conditionalTieProb ?? 0);
  }

  if (Math.abs(weightSum - 1.0) > 1e-5) {
    throw new Error(`Scenario weights must sum to 1.0 (got ${weightSum.toFixed(6)})`);
  }

  return {
    homeWinProb: Number(homeWinProb.toFixed(6)),
    awayWinProb: Number(awayWinProb.toFixed(6)),
    tieProb: Number(tieProb.toFixed(6))
  };
}

/**
 * Estimates participation probability from structured evidence (practice status + game designation + comment)
 * rather than blindly mapping "Questionable" to a single universal constant.
 */
export function estimateParticipationFromEvidence(record: PlayerAvailabilityRecord, league: LeagueCode): {
  fullProb: number;
  limitedProb: number;
  absentProb: number;
  evidenceSummary: string;
} {
  if (record.confirmedParticipationProb !== null) {
    const p = Math.min(1, Math.max(0, record.confirmedParticipationProb));
    return {
      fullProb: p,
      limitedProb: 0,
      absentProb: 1 - p,
      evidenceSummary: "Explicitly supplied participation probability."
    };
  }

  const desig = (record.gameDesignation || "").toLowerCase();
  const comment = (record.injuryOrReason || "").toLowerCase();
  const prac = (record.practiceStatus || "").toUpperCase();

  if (desig === "out" || desig === "ir" || desig === "suspended" || desig === "personal" || desig === "rest" || comment.includes("won't play") || comment.includes("ruled out") || comment.includes("will not play")) {
    return { fullProb: 0, limitedProb: 0, absentProb: 1, evidenceSummary: "Confirmed out / ineligible." };
  }

  if (desig === "doubtful") {
    if (league === "NFL" && prac === "LP") {
      return { fullProb: 0.08, limitedProb: 0.14, absentProb: 0.78, evidenceSummary: "NFL Doubtful with Limited Practice." };
    }
    return { fullProb: 0.05, limitedProb: 0.10, absentProb: 0.85, evidenceSummary: "Official Doubtful designation." };
  }

  if (desig === "questionable" || desig === "day-to-day") {
    if (league === "NFL") {
      if (prac === "FP") {
        return { fullProb: 0.65, limitedProb: 0.20, absentProb: 0.15, evidenceSummary: "NFL Questionable but Full Practice (FP)." };
      }
      if (prac === "LP") {
        return { fullProb: 0.35, limitedProb: 0.30, absentProb: 0.35, evidenceSummary: "NFL Questionable with Limited Practice (LP)." };
      }
      if (prac === "DNP") {
        return { fullProb: 0.15, limitedProb: 0.20, absentProb: 0.65, evidenceSummary: "NFL Questionable with Did Not Practice (DNP)." };
      }
    }
    if (comment.includes("game-time decision") || comment.includes("gtd")) {
      return { fullProb: 0.35, limitedProb: 0.20, absentProb: 0.45, evidenceSummary: "Game-time decision reporting." };
    }
    if (comment.includes("minutes restriction") || comment.includes("pitch count") || comment.includes("limited")) {
      return { fullProb: 0.20, limitedProb: 0.60, absentProb: 0.20, evidenceSummary: "Reported workload/minutes restriction." };
    }
    return { fullProb: 0.45, limitedProb: 0.20, absentProb: 0.35, evidenceSummary: "Questionable without full practice confirmation." };
  }

  if (desig === "probable" || comment.includes("expected to play") || comment.includes("should be able to play")) {
    return { fullProb: 0.85, limitedProb: 0.10, absentProb: 0.05, evidenceSummary: "Probable / expected to play with potential mild limitation." };
  }

  return { fullProb: 1.0, limitedProb: 0, absentProb: 0, evidenceSummary: "Active / no reported restriction." };
}

/**
 * Computes incremental adjustment relative to what is already reflected in baseline team stats.
 * Prevents double-counting players who have already missed recent games included in rolling team ratings.
 */
export function incrementalImpactBeyondBaseline(
  replacementDropoffPoints: number,
  alreadyReflectedInBaselinePct: number
): number {
  const clamped = Math.min(1, Math.max(0, alreadyReflectedInBaselinePct));
  return replacementDropoffPoints * (1 - clamped);
}

/**
 * Builds joint availability scenarios across uncertain players on home & away teams.
 * Handles correlated statuses (e.g., primary creator + primary play-finisher or QB + LT)
 * via mild positive correlation coupling rather than naive full independence when same team has joint injury flags.
 */
export function synthesizeJointScenarios(params: {
  league: LeagueCode;
  baseMargin: number;
  baseTotal: number | null;
  marginStdDev: number;
  tieProbAtTie?: (margin: number) => number;
  marginToHomeWinProb: (margin: number) => { home: number; away: number; tie: number };
  homeUncertain: PlayerAvailabilityRecord[];
  awayUncertain: PlayerAvailabilityRecord[];
  confirmedHomeDelta: number;
  confirmedAwayDelta: number;
}): AvailabilityScenario[] {
  const pickTop = (list: PlayerAvailabilityRecord[]) =>
    list
      .filter(r => {
        const est = estimateParticipationFromEvidence(r, params.league);
        return est.absentProb > 0 && est.absentProb < 1;
      })
      .sort((a, b) => Math.abs(b.replacementDropoffPoints) - Math.abs(a.replacementDropoffPoints))
      .slice(0, 2);

  const uncertainHome = pickTop(params.homeUncertain);
  const uncertainAway = pickTop(params.awayUncertain);

  const combinedUncertain = [
    ...uncertainHome.map(r => ({ side: "home" as const, rec: r })),
    ...uncertainAway.map(r => ({ side: "away" as const, rec: r }))
  ].slice(0, 2); // Limit combinatorial explosion to top 2 uncertain pivotal players

  if (combinedUncertain.length === 0) {
    const netMargin = params.baseMargin + params.confirmedHomeDelta - params.confirmedAwayDelta;
    const probs = params.marginToHomeWinProb(netMargin);
    return [
      {
        scenarioId: "sc_confirmed_baseline",
        label: "Confirmed Lineup Baseline",
        probability: 1.0,
        description: "All key rotational statuses are resolved or already priced into baseline ratings.",
        conditionalHomeWinProb: probs.home,
        conditionalAwayWinProb: probs.away,
        conditionalTieProb: probs.tie,
        conditionalMargin: Number(netMargin.toFixed(2)),
        conditionalTotal: params.baseTotal,
        lineupSummary: ["Confirmed / standard active lineup"],
        workloadNotes: []
      }
    ];
  }

  if (combinedUncertain.length === 1) {
    const item = combinedUncertain[0];
    const est = estimateParticipationFromEvidence(item.rec, params.league);
    const fullDelta = incrementalImpactBeyondBaseline(item.rec.replacementDropoffPoints, item.rec.alreadyReflectedInBaselinePct);
    const states: Array<{ id: string; label: string; q: number; factor: number; note: string }> = [
      { id: "full", label: `${item.rec.playerName} Full Participation`, q: est.fullProb, factor: 0, note: "Full expected workload" },
      { id: "lim", label: `${item.rec.playerName} Limited Workload`, q: est.limitedProb, factor: 0.45, note: "Restricted workload (~65% normal usage)" },
      { id: "out", label: `${item.rec.playerName} Absent (${item.rec.replacementName || "Backup"})`, q: est.absentProb, factor: 1.0, note: `Replaced by ${item.rec.replacementName || "depth rotation"}` }
    ].filter(s => s.q > 0.001);

    // Normalize q exactly to 1
    const totalQ = states.reduce((acc, s) => acc + s.q, 0);
    return states.map(s => {
      const q = s.q / totalQ;
      const deltaForPlayer = fullDelta * s.factor;
      const margin =
        params.baseMargin +
        params.confirmedHomeDelta -
        params.confirmedAwayDelta +
        (item.side === "home" ? -deltaForPlayer : deltaForPlayer);
      const probs = params.marginToHomeWinProb(margin);
      return {
        scenarioId: `sc_${s.id}`,
        label: s.label,
        probability: Number(q.toFixed(6)),
        description: `${est.evidenceSummary} ${s.note}.`,
        conditionalHomeWinProb: probs.home,
        conditionalAwayWinProb: probs.away,
        conditionalTieProb: probs.tie,
        conditionalMargin: Number(margin.toFixed(2)),
        conditionalTotal: params.baseTotal,
        lineupSummary: [s.label],
        workloadNotes: [s.note]
      };
    });
  }

  // Two uncertain players: support joint correlation when on the same team (e.g. rest/illness cluster)
  const p1 = combinedUncertain[0];
  const p2 = combinedUncertain[1];
  const e1 = estimateParticipationFromEvidence(p1.rec, params.league);
  const e2 = estimateParticipationFromEvidence(p2.rec, params.league);

  const p1Active = e1.fullProb + e1.limitedProb;
  const p2Active = e2.fullProb + e2.limitedProb;
  const sameTeam = p1.side === p2.side;
  const rho = sameTeam ? 0.15 : 0.0; // mild positive correlation for same-team illness/rest clusters

  let q11 = p1Active * p2Active + rho * Math.sqrt(p1Active * (1 - p1Active) * p2Active * (1 - p2Active));
  q11 = Math.min(Math.min(p1Active, p2Active), Math.max(0, q11));
  const q10 = Math.max(0, p1Active - q11);
  const q01 = Math.max(0, p2Active - q11);
  const q00 = Math.max(0, 1 - q11 - q10 - q01);

  const d1 = incrementalImpactBeyondBaseline(p1.rec.replacementDropoffPoints, p1.rec.alreadyReflectedInBaselinePct);
  const d2 = incrementalImpactBeyondBaseline(p2.rec.replacementDropoffPoints, p2.rec.alreadyReflectedInBaselinePct);

  const rawJoint = [
    { id: "both_in", label: `Both ${p1.rec.playerName} & ${p2.rec.playerName} Play`, q: q11, out1: 0, out2: 0 },
    { id: "p1_in_p2_out", label: `${p1.rec.playerName} Plays, ${p2.rec.playerName} Out`, q: q10, out1: 0, out2: 1 },
    { id: "p1_out_p2_in", label: `${p1.rec.playerName} Out, ${p2.rec.playerName} Plays`, q: q01, out1: 1, out2: 0 },
    { id: "both_out", label: `Both ${p1.rec.playerName} & ${p2.rec.playerName} Out`, q: q00, out1: 1, out2: 1 }
  ].filter(s => s.q > 0.001);

  const sumQ = rawJoint.reduce((a, b) => a + b.q, 0);
  return rawJoint.map(s => {
    const q = s.q / sumQ;
    const m1 = p1.side === "home" ? -d1 * s.out1 : d1 * s.out1;
    const m2 = p2.side === "home" ? -d2 * s.out2 : d2 * s.out2;
    // Slight sub-additive synergy damping if both on same team are out (already captured via replacement depth)
    const synergy = sameTeam && s.out1 === 1 && s.out2 === 1 ? (p1.side === "home" ? -0.6 : 0.6) : 0;
    const margin = params.baseMargin + params.confirmedHomeDelta - params.confirmedAwayDelta + m1 + m2 + synergy;
    const probs = params.marginToHomeWinProb(margin);
    return {
      scenarioId: `sc_${s.id}`,
      label: s.label,
      probability: Number(q.toFixed(6)),
      description: sameTeam ? "Joint same-team availability scenario (correlated risk modeled)." : "Cross-team joint availability scenario.",
      conditionalHomeWinProb: probs.home,
      conditionalAwayWinProb: probs.away,
      conditionalTieProb: probs.tie,
      conditionalMargin: Number(margin.toFixed(2)),
      conditionalTotal: params.baseTotal,
      lineupSummary: [s.label],
      workloadNotes: []
    };
  });
}

/**
 * Enforces feasible NBA team rotation summing to 240 minutes (regulation)
 * with per-player cap <= 42 minutes and coherent redistribution when starters are out/restricted.
 */
export function buildFeasibleNbaRotation(params: {
  startersAndBench: Array<{ playerName: string; position: string; baselineMinutes: number; role: string }>;
  absences: PlayerAvailabilityRecord[];
  isPlayoff: boolean;
}): { rotation: RotationEntry[]; totalMinutes: number; feasible: boolean } {
  const TARGET_TEAM_MINUTES = 240;
  const MAX_PLAYER_MIN = params.isPlayoff ? 42 : 39;

  const entries: RotationEntry[] = params.startersAndBench.map(p => {
    const inj = params.absences.find(a => a.playerName.toLowerCase() === p.playerName.toLowerCase());
    let mult = 1.0;
    let status = inj ? inj.status : ("confirmed" as const);
    if (inj) {
      const est = estimateParticipationFromEvidence(inj, "NBA");
      if (est.absentProb >= 0.85) mult = 0;
      else if (est.limitedProb >= 0.4) mult = 0.65;
      else mult = Math.max(0, inj.expectedWorkloadPct);
    }
    const base = params.isPlayoff && p.role === "starter" ? Math.min(MAX_PLAYER_MIN, p.baselineMinutes * 1.08) : p.baselineMinutes;
    return {
      playerName: p.playerName,
      position: p.position,
      baselineMinutes: p.baselineMinutes,
      projectedMinutes: Number((base * mult).toFixed(1)),
      role: p.role,
      status
    };
  });

  // Redistribute remaining minutes up to 240 across active players without exceeding MAX_PLAYER_MIN
  let currentSum = entries.reduce((acc, e) => acc + e.projectedMinutes, 0);
  let deficit = TARGET_TEAM_MINUTES - currentSum;

  let guard = 0;
  while (Math.abs(deficit) > 0.2 && guard < 15) {
    guard++;
    const eligible = entries.filter(e =>
      deficit > 0 ? e.projectedMinutes > 0 && e.projectedMinutes < MAX_PLAYER_MIN : e.projectedMinutes > 8
    );
    if (eligible.length === 0) break;
    const perPlayer = deficit / eligible.length;
    for (const e of eligible) {
      const next = e.projectedMinutes + perPlayer;
      e.projectedMinutes = Number(Math.min(MAX_PLAYER_MIN, Math.max(0, next)).toFixed(1));
    }
    currentSum = entries.reduce((acc, e) => acc + e.projectedMinutes, 0);
    deficit = TARGET_TEAM_MINUTES - currentSum;
  }

  // Exact rounding adjustment on top active rotation player to guarantee 240.0
  const activeIdx = entries.findIndex(e => e.projectedMinutes > 0 && e.projectedMinutes + deficit <= MAX_PLAYER_MIN);
  if (activeIdx >= 0 && Math.abs(deficit) <= 2) {
    entries[activeIdx].projectedMinutes = Number((entries[activeIdx].projectedMinutes + deficit).toFixed(1));
  }

  const finalSum = Number(entries.reduce((acc, e) => acc + e.projectedMinutes, 0).toFixed(1));
  return {
    rotation: entries,
    totalMinutes: finalSum,
    feasible: Math.abs(finalSum - TARGET_TEAM_MINUTES) <= 0.5 && entries.every(e => e.projectedMinutes >= 0 && e.projectedMinutes <= MAX_PLAYER_MIN)
  };
}

/**
 * Builds coherent MLB 9-inning pitching workload plan combining SP projected innings
 * with available setup/closer bullpen innings.
 */
export function buildCoherentMlbPitchingPlan(params: {
  starterName: string;
  starterFip: number | null;
  starterK9: number | null;
  starterBb9: number | null;
  expectedStarterInnings: number;
  isPitchLimited: boolean;
  delayRiskScore: number;
  bullpenFip: number;
  tiredRelieversCount: number;
  starterStatus: PlayerAvailabilityRecord["status"];
}): { staff: PitchingPlanEntry[]; totalInnings: number } {
  const TOTAL_INNINGS = 9.0;
  let spInnings = Math.min(7.5, Math.max(2.0, params.expectedStarterInnings));
  if (params.isPitchLimited) spInnings = Math.min(spInnings, 4.2);
  if (params.delayRiskScore >= 0.5) spInnings = Math.max(2.5, spInnings * (1 - 0.35 * params.delayRiskScore));
  spInnings = Number(spInnings.toFixed(1));

  const remaining = Number(Math.max(0, TOTAL_INNINGS - spInnings).toFixed(1));
  const closerInnings = remaining >= 1.0 ? 1.0 : remaining;
  const setupInnings = Number(Math.max(0, remaining - closerInnings).toFixed(1));

  const bullpenFatiguePenalty = params.tiredRelieversCount * 0.22;
  const setupFip = Number((params.bullpenFip + bullpenFatiguePenalty).toFixed(2));
  const closerFip = Number((Math.max(2.4, params.bullpenFip - 0.55 + bullpenFatiguePenalty * 0.6)).toFixed(2));

  const staff: PitchingPlanEntry[] = [
    {
      role: "starter",
      pitcherName: params.starterName,
      projectedInnings: spInnings,
      fip: params.starterFip,
      k9: params.starterK9,
      bb9: params.starterBb9,
      recentPitchCount3d: null,
      availabilityStatus: params.starterStatus
    },
    {
      role: "setup",
      pitcherName: "Middle / Setup Relief Corps",
      projectedInnings: setupInnings,
      fip: setupFip,
      k9: null,
      bb9: null,
      recentPitchCount3d: params.tiredRelieversCount > 0 ? 45 : 15,
      availabilityStatus: params.tiredRelieversCount >= 2 ? "projected" : "confirmed"
    },
    {
      role: "closer",
      pitcherName: "High-Leverage Closer",
      projectedInnings: closerInnings,
      fip: closerFip,
      k9: null,
      bb9: null,
      recentPitchCount3d: params.tiredRelieversCount >= 2 ? 32 : 12,
      availabilityStatus: params.tiredRelieversCount >= 3 ? "stale" : "confirmed"
    }
  ];

  const totalInnings = Number(staff.reduce((a, b) => a + b.projectedInnings, 0).toFixed(1));
  return { staff, totalInnings };
}
