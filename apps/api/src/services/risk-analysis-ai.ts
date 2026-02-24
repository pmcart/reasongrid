/**
 * Risk Report Builder
 *
 * Builds a structured, visual-ready risk report from computed risk group results.
 *
 * Two layers:
 *   1. Deterministic — always runs, builds the full StructuredRiskReport from raw data.
 *   2. AI enrichment — optional. If OPENAI_API_KEY is configured, sends the structured
 *      report to OpenAI for narrative enhancement (summary text, key findings,
 *      per-group concerns, action descriptions). Falls back gracefully.
 */

import OpenAI from 'openai';

const OPENAI_MODEL = process.env['OPENAI_RISK_MODEL'] || process.env['OPENAI_MODEL'] || 'gpt-4.1-mini';

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

export interface StructuredRiskReport {
  executiveSummary: {
    totalGroups: number;
    thresholdAlertCount: number;
    requiresReviewCount: number;
    withinRangeCount: number;
    insufficientDataCount: number;
    riskPosture: 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH';
    summary: string;
  };
  keyFindings: string[];
  countryBreakdown: Array<{
    country: string;
    alertCount: number;
    reviewCount: number;
    withinRangeCount: number;
    blindSpotCount: number;
    topGapPct?: number;
  }>;
  jobFamilyBreakdown: Array<{
    jobFamily: string;
    alertCount: number;
    reviewCount: number;
    avgAlertGapPct?: number;
  }>;
  topRisks: Array<{
    groupKey: string;
    country: string;
    jobFamily: string;
    level: string;
    gapPct: number;
    womenCount: number;
    menCount: number;
    isLowSample: boolean;
    concern: string;
  }>;
  dataQualityInsights: {
    coverageScore: number;
    blindSpotCount: number;
    majorBlindSpotCountries: string[];
    recommendation: string;
  };
  recommendedActions: Array<{
    priority: number;
    title: string;
    description: string;
    category: 'INVESTIGATE' | 'DATA_QUALITY' | 'PROCESS' | 'MONITORING';
  }>;
}

export interface RiskAnalysisReport {
  reportData: StructuredRiskReport;
  /** 'deterministic' if AI was unavailable, otherwise the model name. */
  model: string;
}

// ---------------------------------------------------------------------------
// Input type (mirrors Prisma RiskGroupResult)
// ---------------------------------------------------------------------------

interface RiskGroupInput {
  groupKey: string;
  country: string;
  jobFamily: string | null;
  level: string;
  roleTitleFallback: string | null;
  womenCount: number;
  menCount: number;
  gapPct: number;
  riskState: string;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Deterministic report builder
// ---------------------------------------------------------------------------

function deriveRiskPosture(
  alertCount: number,
  reviewCount: number,
  total: number,
): StructuredRiskReport['executiveSummary']['riskPosture'] {
  if (total === 0) return 'LOW';
  const alertRatio = alertCount / total;
  if (alertCount >= 10 || alertRatio >= 0.3) return 'HIGH';
  if (alertCount >= 5 || alertRatio >= 0.15) return 'ELEVATED';
  if (alertCount >= 1 || reviewCount >= 3) return 'MODERATE';
  return 'LOW';
}

function buildDeterministicReport(groups: RiskGroupInput[], orgName?: string): StructuredRiskReport {
  const alerts = groups.filter((g) => g.riskState === 'THRESHOLD_ALERT');
  const reviews = groups.filter((g) => g.riskState === 'REQUIRES_REVIEW');
  const within = groups.filter((g) => g.riskState === 'WITHIN_EXPECTED_RANGE');
  const insufficient = groups.filter((g) => g.notes === 'insufficient data');
  const measurable = groups.filter((g) => g.notes !== 'insufficient data' && g.womenCount > 0 && g.menCount > 0);

  const total = groups.length;
  const riskPosture = deriveRiskPosture(alerts.length, reviews.length, total);

  // Executive summary text
  const summaryParts: string[] = [];
  summaryParts.push(
    `${total} comparator group${total !== 1 ? 's' : ''} analysed across ${[...new Set(groups.map((g) => g.country))].length} countr${[...new Set(groups.map((g) => g.country))].length !== 1 ? 'ies' : 'y'}.`,
  );
  if (alerts.length > 0) {
    summaryParts.push(
      `${alerts.length} group${alerts.length !== 1 ? 's' : ''} ha${alerts.length !== 1 ? 've' : 's'} a pay gap at or above the 5% threshold and warrant${alerts.length === 1 ? 's' : ''} further review.`,
    );
  } else if (reviews.length > 0) {
    summaryParts.push(
      `No groups exceed the 5% threshold, but ${reviews.length} group${reviews.length !== 1 ? 's' : ''} are approaching it and should be monitored.`,
    );
  } else {
    summaryParts.push('No groups currently exceed or approach the 5% pay gap threshold.');
  }
  if (insufficient.length > 0) {
    summaryParts.push(
      `${insufficient.length} group${insufficient.length !== 1 ? 's have' : ' has'} only one gender represented and cannot be assessed for pay gaps — these are blind spots requiring attention.`,
    );
  }

  // Country breakdown
  const countryMap = new Map<
    string,
    { alertCount: number; reviewCount: number; withinRangeCount: number; blindSpotCount: number; topGapPct: number }
  >();
  for (const g of groups) {
    if (!countryMap.has(g.country)) {
      countryMap.set(g.country, { alertCount: 0, reviewCount: 0, withinRangeCount: 0, blindSpotCount: 0, topGapPct: 0 });
    }
    const c = countryMap.get(g.country)!;
    if (g.riskState === 'THRESHOLD_ALERT') {
      c.alertCount++;
      c.topGapPct = Math.max(c.topGapPct, Math.abs(g.gapPct));
    } else if (g.riskState === 'REQUIRES_REVIEW') {
      c.reviewCount++;
      c.topGapPct = Math.max(c.topGapPct, Math.abs(g.gapPct));
    } else if (g.notes === 'insufficient data') {
      c.blindSpotCount++;
    } else {
      c.withinRangeCount++;
    }
  }
  const countryBreakdown = [...countryMap.entries()]
    .map(([country, v]) => ({ country, ...v, topGapPct: v.topGapPct || undefined }))
    .sort((a, b) => b.alertCount - a.alertCount || b.reviewCount - a.reviewCount);

  // Job family breakdown
  const jfMap = new Map<string, { alertCount: number; reviewCount: number; gapSum: number; gapCount: number }>();
  for (const g of groups) {
    const jf = g.jobFamily || g.roleTitleFallback || 'Unknown';
    if (!jfMap.has(jf)) jfMap.set(jf, { alertCount: 0, reviewCount: 0, gapSum: 0, gapCount: 0 });
    const j = jfMap.get(jf)!;
    if (g.riskState === 'THRESHOLD_ALERT') {
      j.alertCount++;
      j.gapSum += Math.abs(g.gapPct);
      j.gapCount++;
    } else if (g.riskState === 'REQUIRES_REVIEW') {
      j.reviewCount++;
    }
  }
  const jobFamilyBreakdown = [...jfMap.entries()]
    .map(([jobFamily, v]) => ({
      jobFamily,
      alertCount: v.alertCount,
      reviewCount: v.reviewCount,
      avgAlertGapPct: v.gapCount > 0 ? Math.round((v.gapSum / v.gapCount) * 10) / 10 : undefined,
    }))
    .filter((j) => j.alertCount > 0 || j.reviewCount > 0)
    .sort((a, b) => b.alertCount - a.alertCount || b.reviewCount - a.reviewCount);

  // Top risks (sorted by absolute gap, alerts first)
  const topRisks = [...alerts, ...reviews]
    .sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct))
    .slice(0, 15)
    .map((g) => ({
      groupKey: g.groupKey,
      country: g.country,
      jobFamily: g.jobFamily || g.roleTitleFallback || 'Unknown',
      level: g.level,
      gapPct: g.gapPct,
      womenCount: g.womenCount,
      menCount: g.menCount,
      isLowSample: g.notes === 'low sample size',
      concern: buildConcernText(g),
    }));

  // Data quality insights
  const measurableCount = measurable.length;
  const coverageScore = total > 0 ? Math.round((measurableCount / total) * 100) : 0;
  const blindSpotCountryMap = new Map<string, number>();
  for (const g of insufficient) {
    blindSpotCountryMap.set(g.country, (blindSpotCountryMap.get(g.country) ?? 0) + 1);
  }
  const majorBlindSpotCountries = [...blindSpotCountryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([c]) => c);

  let coverageRec: string;
  if (coverageScore >= 80) {
    coverageRec = 'Data coverage is good. Continue collecting gender data for remaining groups.';
  } else if (coverageScore >= 50) {
    coverageRec = `${insufficient.length} group${insufficient.length !== 1 ? 's' : ''} lack gender representation. Targeted recruitment and retention reviews in affected areas would improve coverage.`;
  } else {
    coverageRec = `Coverage is limited — ${insufficient.length} of ${total} groups cannot be assessed. Prioritise gender data collection across all job families before drawing organisation-wide conclusions.`;
  }

  // Recommended actions
  const recommendedActions: StructuredRiskReport['recommendedActions'] = [];
  let priority = 1;

  if (alerts.length > 0) {
    const topCountries = [...new Set(alerts.map((g) => g.country))].slice(0, 3).join(', ');
    recommendedActions.push({
      priority: priority++,
      title: `Investigate ${alerts.length} threshold alert group${alerts.length !== 1 ? 's' : ''}`,
      description: `Groups in ${topCountries} have pay gaps at or above 5%. Conduct individual pay reviews, document rationale for any gaps, and assess whether corrective action is warranted.`,
      category: 'INVESTIGATE',
    });
  }

  if (reviews.length > 0) {
    recommendedActions.push({
      priority: priority++,
      title: `Monitor ${reviews.length} group${reviews.length !== 1 ? 's' : ''} approaching threshold`,
      description: `These groups have gaps between 4–5%. Schedule a formal review to understand contributing factors and prevent escalation to threshold alert status.`,
      category: 'MONITORING',
    });
  }

  if (insufficient.length > 0) {
    const blindCountries = majorBlindSpotCountries.slice(0, 3).join(', ');
    recommendedActions.push({
      priority: priority++,
      title: `Improve gender data coverage in ${insufficient.length} blind spot group${insufficient.length !== 1 ? 's' : ''}`,
      description: `Groups in ${blindCountries || 'multiple countries'} have only one gender represented, making pay gap analysis impossible. Review hiring and retention practices in these areas.`,
      category: 'DATA_QUALITY',
    });
  }

  const lowSampleCount = groups.filter((g) => g.notes === 'low sample size').length;
  if (lowSampleCount > 0) {
    recommendedActions.push({
      priority: priority++,
      title: 'Expand sample sizes in low-sample groups',
      description: `${lowSampleCount} group${lowSampleCount !== 1 ? 's' : ''} ${lowSampleCount !== 1 ? 'use mean instead of median' : 'uses mean instead of median'} due to fewer than 3 employees of one gender. Increased headcount or role consolidation would improve statistical reliability.`,
      category: 'DATA_QUALITY',
    });
  }

  recommendedActions.push({
    priority: priority++,
    title: 'Schedule regular pay equity re-analysis',
    description: 'Run analysis at least quarterly — or after every significant hiring or pay cycle — to monitor trends and detect emerging gaps before they become material.',
    category: 'PROCESS',
  });

  // Key findings
  const keyFindings = buildKeyFindings(groups, alerts, reviews, insufficient, measurable, orgName);

  return {
    executiveSummary: {
      totalGroups: total,
      thresholdAlertCount: alerts.length,
      requiresReviewCount: reviews.length,
      withinRangeCount: within.length,
      insufficientDataCount: insufficient.length,
      riskPosture,
      summary: summaryParts.join(' '),
    },
    keyFindings,
    countryBreakdown,
    jobFamilyBreakdown,
    topRisks,
    dataQualityInsights: {
      coverageScore,
      blindSpotCount: insufficient.length,
      majorBlindSpotCountries,
      recommendation: coverageRec,
    },
    recommendedActions,
  };
}

function buildConcernText(g: RiskGroupInput): string {
  const dir = g.gapPct > 0 ? 'below' : 'above';
  const absGap = Math.abs(g.gapPct);
  const jf = g.jobFamily || g.roleTitleFallback || 'this group';
  const sample = g.notes === 'low sample size' ? ' (low sample — treat with caution)' : '';
  if (g.riskState === 'THRESHOLD_ALERT') {
    return `Women in ${g.country} / ${jf} / ${g.level} earn ${absGap.toFixed(1)}% ${dir} men on average${sample}. Gap meets or exceeds the 5% threshold.`;
  }
  return `${absGap.toFixed(1)}% gap approaching threshold${sample}. ${g.womenCount}W / ${g.menCount}M in this group.`;
}

function buildKeyFindings(
  groups: RiskGroupInput[],
  alerts: RiskGroupInput[],
  reviews: RiskGroupInput[],
  insufficient: RiskGroupInput[],
  measurable: RiskGroupInput[],
  orgName?: string,
): string[] {
  const findings: string[] = [];
  const org = orgName ? `at ${orgName}` : '';

  if (alerts.length === 0 && reviews.length === 0) {
    findings.push(`No pay gaps above 4% detected in measurable comparator groups ${org}.`);
  } else {
    const topAlert = alerts.sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct))[0];
    if (topAlert) {
      const jf = topAlert.jobFamily || topAlert.roleTitleFallback || 'Unknown';
      findings.push(
        `Largest gap: ${topAlert.country} / ${jf} / ${topAlert.level} at ${Math.abs(topAlert.gapPct).toFixed(1)}% (${topAlert.womenCount}W / ${topAlert.menCount}M).`,
      );
    }
    if (alerts.length > 0) {
      const countries = [...new Set(alerts.map((g) => g.country))];
      findings.push(
        `Threshold alerts span ${countries.length} countr${countries.length !== 1 ? 'ies' : 'y'}: ${countries.join(', ')}.`,
      );
    }
  }

  if (insufficient.length > 0) {
    const pct = Math.round((insufficient.length / groups.length) * 100);
    findings.push(
      `${pct}% of comparator groups (${insufficient.length} of ${groups.length}) have only one gender — pay gap analysis is not possible for these groups.`,
    );
  }

  const lowSample = measurable.filter((g) => g.notes === 'low sample size');
  if (lowSample.length > 0 && measurable.length > 0) {
    const pct = Math.round((lowSample.length / measurable.length) * 100);
    findings.push(
      `${pct}% of measurable groups have fewer than 3 employees of one gender — gap estimates should be treated with caution.`,
    );
  }

  if (measurable.length > 0) {
    const withinRange = measurable.filter((g) => g.riskState === 'WITHIN_EXPECTED_RANGE');
    if (withinRange.length > 0) {
      findings.push(`${withinRange.length} group${withinRange.length !== 1 ? 's' : ''} with both genders represented show gaps below 4%.`);
    }
  }

  return findings.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Optional AI enrichment
// ---------------------------------------------------------------------------

async function enrichWithAI(
  report: StructuredRiskReport,
  groups: RiskGroupInput[],
  orgName?: string,
  timeoutMs = 60000,
): Promise<StructuredRiskReport> {
  const client = getOpenAIClient();
  if (!client) return report;

  const prompt = `You are a senior compensation analyst. Enhance the following pay equity risk report with clearer, more insightful narrative text. Return ONLY valid JSON matching the exact schema provided.

Organisation: ${orgName ?? 'the organisation'}

Current report data:
${JSON.stringify(report, null, 2)}

Return a JSON object with ONLY these fields to overlay onto the existing report (do not change numeric values):
{
  "executiveSummary_summary": "2-3 sentence executive summary",
  "keyFindings": ["finding 1", "finding 2", "finding 3", "finding 4", "finding 5"],
  "topRisks_concerns": { "<groupKey>": "1-sentence concern text" },
  "recommendedActions_descriptions": { "<priority>": "description text" }
}

Rules:
- Never say "compliant", "non-compliant", "illegal". Use "may warrant review", "warrants further analysis".
- Do not reference numbers that differ from the report data.
- Keep each finding under 25 words.
- Keep each concern under 30 words.`;

  try {
    const response = await client.chat.completions.create(
      {
        model: OPENAI_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a senior compensation analyst. Return only valid JSON as instructed.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1500,
      },
      { timeout: timeoutMs },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) return report;

    const enriched = JSON.parse(content) as {
      executiveSummary_summary?: string;
      keyFindings?: string[];
      topRisks_concerns?: Record<string, string>;
      recommendedActions_descriptions?: Record<string, string>;
    };

    const merged = structuredClone(report);

    if (enriched.executiveSummary_summary) {
      merged.executiveSummary.summary = enriched.executiveSummary_summary;
    }
    if (Array.isArray(enriched.keyFindings) && enriched.keyFindings.length > 0) {
      merged.keyFindings = enriched.keyFindings.slice(0, 5);
    }
    if (enriched.topRisks_concerns) {
      merged.topRisks = merged.topRisks.map((r) => ({
        ...r,
        concern: enriched.topRisks_concerns?.[r.groupKey] ?? r.concern,
      }));
    }
    if (enriched.recommendedActions_descriptions) {
      merged.recommendedActions = merged.recommendedActions.map((a) => ({
        ...a,
        description:
          enriched.recommendedActions_descriptions?.[String(a.priority)] ?? a.description,
      }));
    }

    return merged;
  } catch (err) {
    console.warn('[LLM/Risk] AI enrichment failed, using deterministic report:', (err as Error).message);
    return report;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateRiskReport(
  groups: RiskGroupInput[],
  orgName?: string,
): Promise<RiskAnalysisReport | null> {
  if (groups.length === 0) return null;

  const deterministic = buildDeterministicReport(groups, orgName);

  const client = getOpenAIClient();
  let finalReport = deterministic;
  let model = 'deterministic';

  if (client) {
    console.log(`[LLM/Risk] Enriching report with AI (model: ${OPENAI_MODEL})`);
    finalReport = await enrichWithAI(deterministic, groups, orgName);
    model = OPENAI_MODEL;
  }

  return { reportData: finalReport, model };
}
