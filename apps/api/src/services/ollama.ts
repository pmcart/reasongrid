/**
 * LLM service — uses OpenAI API for CSV column mapping suggestions.
 * Falls back to deterministic matching if OpenAI is unavailable.
 */

import OpenAI from 'openai';
import { suggestMappings, computeMappingConfidence } from './normalization.js';

const OPENAI_MODEL = process.env['OPENAI_MODEL'] || 'gpt-4o-mini';

interface LLMMappingResult {
  mapping: Record<string, string | null>;
  confidence: Record<string, number>;
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env['OPENAI_API_KEY'];
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
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

function parseLLMResponse(responseText: string): LLMMappingResult | null {
  try {
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
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
 * Try AI mapping with OpenAI. Returns the AI result or null if unavailable.
 * Falls back to deterministic if OpenAI is not configured or fails.
 */
export async function tryAIMapping(
  csvColumns: string[],
  sampleRows: Record<string, string>[],
  timeoutMs = 30000,
): Promise<{ mapping: Record<string, string | null>; confidence: Record<string, number> } | null> {
  try {
    return await callOpenAI(csvColumns, sampleRows, timeoutMs);
  } catch (err) {
    console.warn('[LLM] AI mapping unavailable, using deterministic:', (err as Error).message);
    return null;
  }
}

async function callOpenAI(
  csvColumns: string[],
  sampleRows: Record<string, string>[],
  timeoutMs = 30000,
): Promise<{ mapping: Record<string, string | null>; confidence: Record<string, number> }> {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const prompt = buildPrompt(csvColumns, sampleRows);
  console.log(`[LLM] Sending CSV mapping request (model: ${OPENAI_MODEL})`);
  console.log(`[LLM] CSV columns: ${csvColumns.join(', ')}`);
  const startTime = Date.now();

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: 'You are a data mapping assistant. Respond with JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.1,
    max_tokens: 512,
    response_format: { type: 'json_object' },
  }, {
    timeout: timeoutMs,
  });

  console.log(`[LLM] Response received in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  console.log('[LLM] Raw response:', content.substring(0, 500));
  const result = parseLLMResponse(content);

  if (!result) {
    throw new Error('Failed to parse OpenAI JSON response');
  }

  // Validate that mapped columns actually exist in the CSV
  for (const [field, col] of Object.entries(result.mapping)) {
    if (col !== null && !csvColumns.includes(col)) {
      console.log(`[LLM] Removing invalid mapping: ${field} -> "${col}" (not in CSV columns)`);
      result.mapping[field] = null;
    }
  }

  // Compute confidence deterministically from column name similarity
  result.confidence = computeMappingConfidence(result.mapping, csvColumns);

  return result;
}
