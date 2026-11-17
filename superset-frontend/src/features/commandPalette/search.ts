/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { CommandPaletteItem } from './types';

const DIACRITICS = /[\u0300-\u036F]/g;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

/** Lower case, without diacritics: "Übersicht" and "ubersicht" match. */
export const normalize = (text: string): string =>
  text.normalize('NFD').replace(DIACRITICS, '').toLowerCase();

export const tokenize = (query: string): string[] =>
  normalize(query).split(/\s+/).filter(Boolean);

const TITLE_START = 4;
const WORD_START = 2;
const INSIDE_WORD = 1;
const SUBTITLE_ONLY = 0.5;

function scoreToken(title: string, subtitle: string, token: string): number {
  let index = title.indexOf(token);
  let best = 0;
  while (index !== -1) {
    if (index === 0) {
      return TITLE_START;
    }
    best = Math.max(
      best,
      WORD_CHARACTER.test(title[index - 1]) ? INSIDE_WORD : WORD_START,
    );
    if (best === WORD_START) {
      break;
    }
    index = title.indexOf(token, index + 1);
  }
  if (best) {
    return best;
  }
  return subtitle.includes(token) ? SUBTITLE_ONLY : 0;
}

/**
 * How well an item matches the words of a query: 0 when a word is in neither
 * its title nor its subtitle. A word scores most at the start of the title,
 * then at the start of a word, then inside one.
 */
export function scoreItem(item: CommandPaletteItem, tokens: string[]): number {
  const title = normalize(item.title);
  const subtitle = item.subtitle ? normalize(item.subtitle) : '';
  let total = 0;
  for (const token of tokens) {
    const score = scoreToken(title, subtitle, token);
    if (!score) {
      return 0;
    }
    total += score;
  }
  return total;
}

/**
 * The items that match every word of the query, best first. Items that match
 * equally well keep their order, and an empty query keeps them all.
 */
export function rankItems(
  items: CommandPaletteItem[],
  query: string,
  limit: number,
): CommandPaletteItem[] {
  if (limit <= 0) {
    return [];
  }
  const tokens = tokenize(query);
  if (!tokens.length) {
    return items.slice(0, limit);
  }
  return items
    .map((item, index) => ({ item, index, score: scoreItem(item, tokens) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

/** The first item of each address. */
export function uniqueByHref(
  items: CommandPaletteItem[],
): CommandPaletteItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.href)) {
      return false;
    }
    seen.add(item.href);
    return true;
  });
}
