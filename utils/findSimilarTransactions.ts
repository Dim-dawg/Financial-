import { Transaction } from '../types';

export interface SimilarityOptions {
  minTokenOverlap?: number;
  amountTolerance?: number; // absolute tolerance
  maxResults?: number;
}

const DEFAULTS: Required<SimilarityOptions> = {
  minTokenOverlap: 2,
  amountTolerance: 0,
  maxResults: 100,
};

function normalizeText(s: string | undefined) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter(tok => tok.length > 1);
}

export function findSimilarTransactions(base: Transaction, all: Transaction[], opts: SimilarityOptions = {}) {
  const { minTokenOverlap, amountTolerance, maxResults } = { ...DEFAULTS, ...opts };

  const baseTokens = new Set(normalizeText(base.originalDescription || base.description));
  const candidates: { tx: Transaction; score: number }[] = [];

  for (const t of all) {
    if (t.id === base.id) continue;

    let score = 0;

    // amount match (within tolerance)
    if (Math.abs((t.amount || 0) - (base.amount || 0)) <= amountTolerance) {
      score += 1;
    }

    // token overlap
    const tokens = new Set(normalizeText(t.originalDescription || t.description));
    let overlap = 0;
    for (const tok of tokens) if (baseTokens.has(tok)) overlap++;
    score += overlap * 2;

    if (score >= 1 && (overlap >= minTokenOverlap || Math.abs((t.amount || 0) - (base.amount || 0)) <= amountTolerance)) {
      candidates.push({ tx: t, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || new Date(b.tx.date).getTime() - new Date(a.tx.date).getTime());

  return candidates.slice(0, maxResults).map(c => c.tx);
}
