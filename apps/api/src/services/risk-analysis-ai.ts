/**
 * AI Risk Analysis Service — uses a local Ollama model to generate a
 * narrative summary report from computed risk group results.
 * Falls back gracefully if Ollama is unavailable.
 */

const OLLAMA_BASE_URL = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
const OLLAMA_MODEL = process.env['OLLAMA_RISK_MODEL'] || 'llama3.1:8b';

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

export interface RiskAnalysisReport {
  summary: string;
  generatedAt: string;
  model: string;
}

function buildPrompt(groups: RiskGroupInput[], orgName?: string): string {
  // Pre-categorise groups so the model doesn't have to
  const alerts = groups.filter((g) => g.riskState === 'THRESHOLD_ALERT');
  const reviews = groups.filter((g) => g.riskState === 'REQUIRES_REVIEW');
  const within = groups.filter((g) => g.riskState === 'WITHIN_EXPECTED_RANGE');
  const insufficientData = groups.filter((g) => g.notes === 'insufficient data');
  const lowSample = groups.filter((g) => g.notes === 'low sample size');
  const measurable = groups.filter(
    (g) => g.notes !== 'insufficient data' && g.womenCount > 0 && g.menCount > 0,
  );

  const formatGroup = (g: RiskGroupInput) => {
    const label = g.jobFamily || g.roleTitleFallback || 'Unknown';
    return `  ${g.country} / ${label} / ${g.level}: gap ${g.gapPct}%, ${g.womenCount}W/${g.menCount}M${g.notes ? ` [${g.notes}]` : ''}`;
  };

  let dataSection = '';

  if (alerts.length > 0) {
    dataSection += `\nTHRESHOLD ALERTS (gap >= 5%, action needed):\n${alerts.map(formatGroup).join('\n')}\n`;
  }
  if (reviews.length > 0) {
    dataSection += `\nREQUIRES REVIEW (gap 4-5%, monitor closely):\n${reviews.map(formatGroup).join('\n')}\n`;
  }
  if (measurable.length > 0) {
    const withinMeasurable = measurable.filter((g) => g.riskState === 'WITHIN_EXPECTED_RANGE');
    if (withinMeasurable.length > 0) {
      dataSection += `\nWITHIN RANGE (gap < 4%, both genders present):\n${withinMeasurable.map(formatGroup).join('\n')}\n`;
    }
  }
  if (insufficientData.length > 0) {
    dataSection += `\nINSUFFICIENT DATA (only one gender present — cannot compute gap):\n${insufficientData.map(formatGroup).join('\n')}\n`;
  }

  const org = orgName || 'the organisation';

  return `You are a senior compensation analyst writing a pay equity risk report for ${org}.

CONTEXT:
- ${groups.length} total comparator groups (grouped by country + job family + level)
- ${alerts.length} threshold alerts (gap >= 5%)
- ${reviews.length} requiring review (gap 4-5%)
- ${within.length} within expected range (gap < 4%)
- ${insufficientData.length} groups have only one gender present (gap cannot be computed)
- ${lowSample.length} groups have low sample sizes (fewer than 3 per gender, using mean instead of median)
- ${measurable.length} groups have both genders represented and can be meaningfully compared

DATA:
${dataSection}
TASK: Write a structured risk analysis report with these exact sections. Be specific and reference actual data.

## Executive Summary
2-3 sentences. State how many groups were analyzed, how many have actionable gaps, and the overall risk posture. If most groups lack sufficient data, say so clearly.

## Key Concerns
${alerts.length + reviews.length > 0 ? 'List each group at THRESHOLD_ALERT or REQUIRES_REVIEW with its gap % and gender counts. Explain why each warrants attention.' : 'If there are no alerts or reviews, state that clearly and note this is positive but may reflect limited data rather than true equity.'}

## Data Coverage Assessment
This is critical. ${insufficientData.length} of ${groups.length} groups have only one gender — this means pay gap analysis is NOT POSSIBLE for these groups. Do not call these "within range" or "positive". They are blind spots. List the countries/job families affected and recommend data collection.

## Measurable Groups
${measurable.length > 0 ? `Summarize the ${measurable.length} groups where both genders are present. Note which have the smallest and largest gaps.` : 'Note that no groups currently have both genders represented, making organisation-wide pay gap analysis impossible at this time.'}

## Recommended Actions
3-5 specific, actionable next steps. Prioritise:
1. Investigating any THRESHOLD_ALERT groups
2. Improving gender data coverage for single-gender groups
3. Increasing sample sizes in low-sample groups
4. Scheduling regular re-analysis

RULES:
- Never say "compliant", "non-compliant", "illegal", or "legal". Use "may warrant review" or "warrants further analysis".
- Do not provide legal advice. This is analytical observation only.
- Be honest about data limitations — do NOT present insufficient-data groups as positive findings.
- Reference specific countries, job families, and levels.
- Keep under 600 words.
- Use markdown formatting with ## headers.`;
}

function parseResponse(responseText: string): string {
  let text = responseText.trim();
  const fenceMatch = text.match(/```(?:markdown)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  return text;
}

/**
 * Generate an AI risk analysis report from computed risk group results.
 * Returns null if Ollama is unavailable or fails.
 */
export async function generateRiskAnalysis(
  groups: RiskGroupInput[],
  orgName?: string,
  timeoutMs = 300000,
): Promise<RiskAnalysisReport | null> {
  if (groups.length === 0) return null;

  const prompt = buildPrompt(groups, orgName);
  const startTime = Date.now();

  console.log(`[Ollama/Risk] Requesting analysis from ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL}, groups: ${groups.length})`);

  const progressTimer = setInterval(() => {
    console.log(`[Ollama/Risk] Waiting... ${((Date.now() - startTime) / 1000).toFixed(0)}s elapsed`);
  }, 5000);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        keep_alive: '10m',
        options: {
          temperature: 0.2,
          num_predict: 1024,
          num_ctx: 8192,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    clearInterval(progressTimer);
    console.log(`[Ollama/Risk] Response in ${((Date.now() - startTime) / 1000).toFixed(1)}s, status: ${response.status}`);

    if (!response.ok) {
      console.error(`[Ollama/Risk] HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { response: string };
    const summary = parseResponse(data.response);

    if (!summary || summary.length < 50) {
      console.warn('[Ollama/Risk] Response too short, discarding');
      return null;
    }

    return {
      summary,
      generatedAt: new Date().toISOString(),
      model: OLLAMA_MODEL,
    };
  } catch (err) {
    clearInterval(progressTimer);
    console.warn('[Ollama/Risk] AI analysis unavailable:', (err as Error).message);
    return null;
  }
}
