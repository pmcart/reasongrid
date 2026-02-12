/**
 * Ollama service — uses a local LLM to analyze CSV columns and suggest
 * mappings to CDI standard employee fields.
 * Falls back to deterministic matching if Ollama is unavailable.
 */

import { suggestMappings, computeMappingConfidence } from './normalization.js';

const OLLAMA_BASE_URL = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
const OLLAMA_MODEL = process.env['OLLAMA_MODEL'] || 'qwen2.5:1.5b';

interface OllamaMappingResult {
  mapping: Record<string, string | null>;
  confidence: Record<string, number>;
}

const STANDARD_FIELDS_DESCRIPTION = `
- employeeId: Unique employee identifier (e.g. EMP001, staff number)
- roleTitle: Job title or role name (e.g. "Software Engineer", "HR Manager")
- jobFamily: Job family, function, or department grouping (e.g. "Engineering", "Finance")
- level: Job level, grade, or band (e.g. "L3", "Senior", "Band 5")
- country: Country (ISO code or full name, e.g. "IE", "Ireland")
- location: City, office, or site location (e.g. "Dublin", "London HQ")
- currency: Currency code (e.g. "EUR", "USD", "GBP")
- baseSalary: Base annual salary amount (numeric)
- bonusTarget: Target bonus amount or percentage (numeric)
- ltiTarget: Long-term incentive / equity target (numeric)
- hireDate: Date of hire / start date
- employmentType: Employment type (e.g. "Full-time", "Part-time", "Contractor")
- gender: Gender (e.g. "Male", "Female", "Non-binary")
- performanceRating: Performance rating or score (e.g. "Exceeds", "3.5", "A")
`.trim();

function buildPrompt(csvColumns: string[], sampleRows: Record<string, string>[]): string {
  const sampleDataStr = sampleRows
    .slice(0, 1)
    .map((row, i) => {
      const entries = Object.entries(row)
        .map(([k, v]) => `  "${k}": "${v}"`)
        .join('\n');
      return `Row ${i + 1}:\n${entries}`;
    })
    .join('\n\n');

  return `You are a data mapping assistant. Analyze the CSV column headers and sample data below, then map each CSV column to the most appropriate standard employee field.

Standard employee fields:
${STANDARD_FIELDS_DESCRIPTION}

CSV columns: ${JSON.stringify(csvColumns)}

Sample data:
${sampleDataStr}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "mapping": {
    "employeeId": "<csv column name or null>",
    "roleTitle": "<csv column name or null>",
    "jobFamily": "<csv column name or null>",
    "level": "<csv column name or null>",
    "country": "<csv column name or null>",
    "location": "<csv column name or null>",
    "currency": "<csv column name or null>",
    "baseSalary": "<csv column name or null>",
    "bonusTarget": "<csv column name or null>",
    "ltiTarget": "<csv column name or null>",
    "hireDate": "<csv column name or null>",
    "employmentType": "<csv column name or null>",
    "gender": "<csv column name or null>",
    "performanceRating": "<csv column name or null>"
  },
  "confidence": {
    "employeeId": <0.0-1.0>,
    "roleTitle": <0.0-1.0>,
    ...
  }
}

Rules:
- Map each standard field to the EXACT CSV column name that best matches, or null if no match.
- The "confidence" object should have a 0.0-1.0 score for each mapped field indicating how confident you are in THAT SPECIFIC mapping.
- Base confidence on how well the CSV column name and sample data match the standard field. An exact name match like "Employee ID" -> employeeId should be 0.95. A vague or ambiguous match should be lower. Do NOT simply decrease confidence for each successive field.
- Only use column names from the provided CSV columns list.
- A CSV column should only be mapped to ONE standard field.`;
}

function parseOllamaResponse(responseText: string): OllamaMappingResult | null {
  try {
    // Try to extract JSON from the response (handle markdown code blocks)
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // Also try to find a raw JSON object
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }

    const parsed = JSON.parse(jsonStr);
    if (parsed.mapping && typeof parsed.mapping === 'object') {
      return {
        mapping: parsed.mapping,
        confidence: parsed.confidence || {},
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get deterministic mapping immediately (fast, always works).
 */
export function getDeterministicMapping(csvColumns: string[]): {
  mapping: Record<string, string | null>;
  confidence: Record<string, number>;
} {
  const mapping = suggestMappings(csvColumns);
  const confidence: Record<string, number> = {};
  for (const [field, col] of Object.entries(mapping)) {
    confidence[field] = col ? 0.7 : 0;
  }
  return { mapping, confidence };
}

/**
 * Try AI mapping with a timeout. Returns the AI result or null if unavailable/slow.
 * This is called inline during upload — if Ollama responds in time, we use AI mappings;
 * otherwise we fall back to deterministic.
 */
export async function tryAIMapping(
  csvColumns: string[],
  sampleRows: Record<string, string>[],
  timeoutMs = 30000,
): Promise<{ mapping: Record<string, string | null>; confidence: Record<string, number> } | null> {
  try {
    return await callOllama(csvColumns, sampleRows, timeoutMs);
  } catch (err) {
    console.warn('[Ollama] AI mapping unavailable, using deterministic:', (err as Error).message);
    return null;
  }
}

async function callOllama(
  csvColumns: string[],
  sampleRows: Record<string, string>[],
  timeoutMs = 300000,
): Promise<{ mapping: Record<string, string | null>; confidence: Record<string, number> }> {
  const prompt = buildPrompt(csvColumns, sampleRows);

  console.log(`[Ollama] Sending request to ${OLLAMA_BASE_URL}/api/generate (model: ${OLLAMA_MODEL}, timeout: ${(timeoutMs / 1000).toFixed(0)}s)`);
  console.log(`[Ollama] CSV columns: ${csvColumns.join(', ')}`);
  const startTime = Date.now();

  // Log elapsed time every 5 seconds so we can monitor progress
  const progressTimer = setInterval(() => {
    console.log(`[Ollama] Waiting... ${((Date.now() - startTime) / 1000).toFixed(0)}s elapsed`);
  }, 5000);

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: 'json',
        keep_alive: '10m',
        options: {
          temperature: 0.1,
          num_predict: 512,
          num_ctx: 2048,
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    clearInterval(progressTimer);
    throw err;
  }

  clearInterval(progressTimer);
  console.log(`[Ollama] Response received in ${((Date.now() - startTime) / 1000).toFixed(1)}s, status: ${response.status}`);

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = await response.json() as { response: string };
  console.log('[Ollama] Raw response:', data.response.substring(0, 500));
  const result = parseOllamaResponse(data.response);

  if (!result) {
    throw new Error('Failed to parse Ollama JSON response');
  }

  // Validate that mapped columns actually exist in the CSV
  for (const [field, col] of Object.entries(result.mapping)) {
    if (col !== null && !csvColumns.includes(col)) {
      console.log(`[Ollama] Removing invalid mapping: ${field} -> "${col}" (not in CSV columns)`);
      result.mapping[field] = null;
    }
  }

  // Compute confidence deterministically from column name similarity
  // (LLM-generated confidence is unreliable with small models)
  result.confidence = computeMappingConfidence(result.mapping, csvColumns);

  return result;
}
