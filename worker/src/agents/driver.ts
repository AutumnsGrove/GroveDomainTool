/**
 * Driver Agent - Generates domain name candidates
 *
 * Uses Claude Sonnet to generate creative domain suggestions
 * based on client preferences and learns from previous batch results.
 */

import { DRIVER_SYSTEM_PROMPT, formatDriverPrompt, type PreviousResults } from "../prompts";

export interface DomainCandidate {
  domain: string;
  batchNum: number;
  tld: string;
  name: string;
}

export interface DriverResult {
  candidates: DomainCandidate[];
  inputTokens: number;
  outputTokens: number;
}

export interface DriverOptions {
  businessName: string;
  tldPreferences: string[];
  vibe: string;
  batchNum: number;
  count?: number;
  maxBatches?: number;
  domainIdea?: string;
  keywords?: string;
  previousResults?: PreviousResults;
}

/**
 * Call Claude API to generate domain candidates
 */
export async function generateCandidates(
  apiKey: string,
  options: DriverOptions
): Promise<DriverResult> {
  const prompt = formatDriverPrompt({
    businessName: options.businessName,
    tldPreferences: options.tldPreferences,
    vibe: options.vibe,
    batchNum: options.batchNum,
    count: options.count || 50,
    maxBatches: options.maxBatches || 6,
    domainIdea: options.domainIdea,
    keywords: options.keywords,
    previousResults: options.previousResults,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      temperature: 0.8,
      system: DRIVER_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as {
    content: { type: string; text: string }[];
    usage: { input_tokens: number; output_tokens: number };
  };

  const content = data.content[0]?.text || "";

  // Parse candidates from response
  const candidates = parseCandidates(content, options.batchNum);

  // Filter out previously checked domains if provided
  let filteredCandidates = candidates;
  if (options.previousResults) {
    const checkedSet = new Set(
      options.previousResults.tried_summary
        .toLowerCase()
        .split(/[,\s]+/)
        .filter(Boolean)
    );
    filteredCandidates = candidates.filter(
      c => !checkedSet.has(c.domain.toLowerCase())
    );
  }

  return {
    candidates: filteredCandidates.slice(0, options.count || 50),
    inputTokens: data.usage.input_tokens,
    outputTokens: data.usage.output_tokens,
  };
}

/**
 * Parse domain candidates from model response
 */
function parseCandidates(content: string, batchNum: number): DomainCandidate[] {
  const candidates: DomainCandidate[] = [];
  const seen = new Set<string>();

  // Try to extract JSON
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]) as { domains?: string[] };
      const domains = data.domains || [];
      for (const domain of domains) {
        if (isValidDomain(domain) && !seen.has(domain.toLowerCase())) {
          seen.add(domain.toLowerCase());
          candidates.push(createCandidate(domain, batchNum));
        }
      }
    }
  } catch {
    // JSON parse failed, try regex fallback
  }

  // Fallback: extract domain-like patterns from text
  if (candidates.length === 0) {
    const domainPattern = /\b([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,})\b/g;
    let match;
    while ((match = domainPattern.exec(content)) !== null) {
      const domain = match[1];
      if (isValidDomain(domain) && !seen.has(domain.toLowerCase())) {
        seen.add(domain.toLowerCase());
        candidates.push(createCandidate(domain, batchNum));
      }
    }
  }

  return candidates;
}

/**
 * Create a DomainCandidate object
 */
function createCandidate(domain: string, batchNum: number): DomainCandidate {
  const parts = domain.toLowerCase().split(".");
  const tld = parts.length > 1 ? parts[parts.length - 1] : "";
  const name = parts[0] || "";

  return {
    domain: domain.toLowerCase(),
    batchNum,
    tld,
    name,
  };
}

/**
 * Check if a string is a valid domain name
 */
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length < 4) return false;
  if (!domain.includes(".")) return false;

  const parts = domain.toLowerCase().split(".");

  // Check TLD
  const tld = parts[parts.length - 1];
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) return false;

  // Check name part
  const name = parts[0];
  if (name.length < 1 || name.length > 63) return false;

  // Only alphanumeric and hyphens (not at start/end)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) return false;

  return true;
}
