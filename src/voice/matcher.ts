import type { Food, Meal } from '../domain/types';
import { search, type SearchIndex, type SearchOptions } from '../data/search';
import { resolveAmount, type ResolvedAmount } from '../domain/portions';
import { parseUtterance, type ParsedItem } from './parser';

export interface MatchedItem {
  parsed: ParsedItem;
  candidates: Food[];
  food?: Food;
  amount?: ResolvedAmount;
}

export interface MatchResult {
  transcript: string;
  meal?: Meal;
  time?: string;
  items: MatchedItem[];
}

export function matchTranscript(transcript: string, index: SearchIndex, opts: SearchOptions = {}): MatchResult {
  const parsed = parseUtterance(transcript);
  return {
    transcript,
    meal: parsed.meal,
    time: parsed.time,
    items: parsed.items.map((item) => {
      const candidates = search(index, item.food, { limit: 6, ...opts }).map((h) => h.food);
      const food = candidates[0];
      return { parsed: item, candidates, food, amount: food ? resolveAmount(food, item.quantity, item.unit) : undefined };
    }),
  };
}
