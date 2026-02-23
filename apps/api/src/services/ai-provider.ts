/**
 * AI provider abstraction — configurable per org.
 * Supports OpenAI (existing), Ollama, and Anthropic for role classification.
 */

import OpenAI from 'openai';
import { prisma } from '../lib/prisma.js';
import type { ClassificationDimension, AiProviderConfig } from '@prisma/client';

export interface ClassificationSuggestion {
  dimensionCode: string;
  dimensionId: string;
  value: string;
  numericValue?: number;
  confidence: number;
  reasoning?: string;
}

interface RoleContext {
  country: string;
  jobFamily?: string | null;
  level: string;
  roleTitle: string;
}

interface AIProvider {
  classifyRole(
    jobDescription: string,
    roleContext: RoleContext,
    dimensions: ClassificationDimension[],
  ): Promise<ClassificationSuggestion[]>;
}

function buildClassificationPrompt(
  jobDescription: string,
  roleContext: RoleContext,
  dimensions: ClassificationDimension[],
): string {
  const dimDescriptions = dimensions
    .map((d) => {
      const config = d.scaleConfig as Record<string, unknown>;
      let scaleInfo = '';
      if (d.scaleType === 'NUMERIC_1_5') scaleInfo = '(1-5 scale, where 1=lowest, 5=highest)';
      else if (d.scaleType === 'NUMERIC_1_10') scaleInfo = '(1-10 scale, where 1=lowest, 10=highest)';
      else if (d.scaleType === 'LEVEL_LOW_MED_HIGH') scaleInfo = '(LOW, MEDIUM, or HIGH)';
      else if (config['values']) scaleInfo = `(one of: ${(config['values'] as string[]).join(', ')})`;
      return `- ${d.code} (${d.name}): ${d.description} ${scaleInfo}`;
    })
    .join('\n');

  return `You are an HR classification assistant helping categorise roles for EU Pay Transparency Directive Article 4 (equal value of work) compliance.

Analyse the following role and provide classification scores for each dimension.

Role context:
- Title: ${roleContext.roleTitle}
- Level: ${roleContext.level}
- Country: ${roleContext.country}
- Job Family: ${roleContext.jobFamily || 'Not specified'}

Job description:
${jobDescription || 'No job description provided. Classify based on role title, level, and job family.'}

Classification dimensions:
${dimDescriptions}

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "classifications": [
    {
      "dimensionCode": "<DIMENSION_CODE>",
      "value": "<score or level>",
      "numericValue": <numeric score or null>,
      "confidence": <0.0-1.0>,
      "reasoning": "<brief 1-sentence justification>"
    }
  ]
}

Rules:
- Provide a classification for EVERY dimension listed above.
- For numeric scales, value should be the number as a string (e.g. "3").
- For level scales, value should be the level (e.g. "MEDIUM").
- numericValue should be a number for numeric scales, or mapped (LOW=1, MEDIUM=2, HIGH=3) for level scales.
- confidence should reflect how certain you are given the available information.
- If no job description is provided, base classification on the role title, level, and job family. Use lower confidence scores.`;
}

function parseClassificationResponse(
  responseText: string,
  dimensions: ClassificationDimension[],
): ClassificationSuggestion[] {
  try {
    let jsonStr = responseText.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1].trim();
    const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (braceMatch) jsonStr = braceMatch[0];

    const parsed = JSON.parse(jsonStr);
    if (!parsed.classifications || !Array.isArray(parsed.classifications)) return [];

    const dimMap = new Map(dimensions.map((d) => [d.code, d]));

    return parsed.classifications
      .filter((c: Record<string, unknown>) => dimMap.has(c['dimensionCode'] as string))
      .map((c: Record<string, unknown>) => ({
        dimensionCode: c['dimensionCode'] as string,
        dimensionId: dimMap.get(c['dimensionCode'] as string)!.id,
        value: String(c['value']),
        numericValue: typeof c['numericValue'] === 'number' ? c['numericValue'] : undefined,
        confidence: typeof c['confidence'] === 'number' ? Math.min(1, Math.max(0, c['confidence'] as number)) : 0.5,
        reasoning: (c['reasoning'] as string) || undefined,
      }));
  } catch {
    return [];
  }
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey || process.env['OPENAI_API_KEY'],
      baseURL: config.baseUrl || undefined,
    });
    this.model = config.model || 'gpt-4.1-mini';
  }

  async classifyRole(
    jobDescription: string,
    roleContext: RoleContext,
    dimensions: ClassificationDimension[],
  ): Promise<ClassificationSuggestion[]> {
    const prompt = buildClassificationPrompt(jobDescription, roleContext, dimensions);
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          { role: 'system', content: 'You are an HR classification assistant. Respond with JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      },
      { timeout: 30000 },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    return parseClassificationResponse(content, dimensions);
  }
}

class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.baseUrl = config.baseUrl || process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434';
    this.model = config.model || 'llama3:8b';
  }

  async classifyRole(
    jobDescription: string,
    roleContext: RoleContext,
    dimensions: ClassificationDimension[],
  ): Promise<ClassificationSuggestion[]> {
    const prompt = buildClassificationPrompt(jobDescription, roleContext, dimensions);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: `You are an HR classification assistant. Respond with JSON only.\n\n${prompt}`,
          stream: false,
          options: { temperature: 0.2 },
        }),
        signal: controller.signal,
      });

      const data = (await response.json()) as { response?: string };
      if (!data.response) return [];
      return parseClassificationResponse(data.response, dimensions);
    } finally {
      clearTimeout(timeout);
    }
  }
}

class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(config: AiProviderConfig) {
    this.apiKey = config.apiKey || process.env['ANTHROPIC_API_KEY'] || '';
    this.model = config.model || 'claude-sonnet-4-5-20250929';
  }

  async classifyRole(
    jobDescription: string,
    roleContext: RoleContext,
    dimensions: ClassificationDimension[],
  ): Promise<ClassificationSuggestion[]> {
    const prompt = buildClassificationPrompt(jobDescription, roleContext, dimensions);
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are an HR classification assistant. Respond with JSON only.',
      }),
    });

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    const text = data.content?.[0]?.text;
    if (!text) return [];
    return parseClassificationResponse(text, dimensions);
  }
}

export function createAIProvider(config: AiProviderConfig): AIProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'ollama':
      return new OllamaProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}

export async function getOrgAIProvider(organizationId: string): Promise<AIProvider | null> {
  const config = await prisma.aiProviderConfig.findUnique({
    where: { organizationId },
  });

  if (!config || !config.isActive) {
    // Fallback: check env vars for OpenAI
    if (process.env['OPENAI_API_KEY']) {
      return new OpenAIProvider({
        id: '',
        organizationId,
        provider: 'openai',
        baseUrl: null,
        model: process.env['OPENAI_MODEL'] || 'gpt-4.1-mini',
        apiKey: process.env['OPENAI_API_KEY'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return null;
  }

  return createAIProvider(config);
}
