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
import { normalize, rankItems, scoreItem, tokenize } from './search';
import { CommandPaletteItem } from './types';

const item = (title: string, subtitle?: string): CommandPaletteItem => ({
  key: `page:${title}`,
  kind: 'page',
  title,
  subtitle,
  href: `/${title}`,
});

const titles = (items: CommandPaletteItem[]) => items.map(({ title }) => title);

test('normalize lowers case and drops diacritics', () => {
  expect(normalize('Übersicht Café')).toBe('ubersicht cafe');
});

test('tokenize splits a query into its words', () => {
  expect(tokenize('  Web   Analytics ')).toEqual(['web', 'analytics']);
  expect(tokenize('   ')).toEqual([]);
});

test('scoreItem needs every word of the query', () => {
  expect(scoreItem(item('Web Analytics'), ['web', 'ana'])).toBeGreaterThan(0);
  expect(scoreItem(item('Web Analytics'), ['web', 'churn'])).toBe(0);
});

test('scoreItem prefers the start of the title, then the start of a word', () => {
  const atTitleStart = scoreItem(item('Retention & Churn'), ['ret']);
  const atWordStart = scoreItem(item('Paid Retention'), ['ret']);
  const insideWord = scoreItem(item('Secretary'), ['ret']);
  expect(atTitleStart).toBeGreaterThan(atWordStart);
  expect(atWordStart).toBeGreaterThan(insideWord);
  expect(insideWord).toBeGreaterThan(0);
});

test('scoreItem finds a word start after an earlier match inside a word', () => {
  expect(scoreItem(item('Secretary Retention'), ['ret'])).toBe(
    scoreItem(item('Paid Retention'), ['ret']),
  );
});

test('scoreItem matches the subtitle, below any match in the title', () => {
  const inSubtitle = scoreItem(item('Users', 'Security'), ['sec']);
  expect(inSubtitle).toBeGreaterThan(0);
  expect(inSubtitle).toBeLessThan(scoreItem(item('Insecure'), ['sec']));
});

test('rankItems keeps the order of the items for an empty query', () => {
  const items = [item('B'), item('A'), item('C')];
  expect(titles(rankItems(items, '', 2))).toEqual(['B', 'A']);
});

test('rankItems puts the best match first and equal matches in their order', () => {
  const items = [
    item('Product Onboarding'),
    item('Financials'),
    item('Onboarding'),
    item('Onboarding V2'),
  ];
  expect(titles(rankItems(items, 'onb', 10))).toEqual([
    'Onboarding',
    'Onboarding V2',
    'Product Onboarding',
  ]);
});

test('rankItems matches without regard to case and diacritics', () => {
  expect(titles(rankItems([item('Umsatz Übersicht')], 'UBER', 10))).toEqual([
    'Umsatz Übersicht',
  ]);
});

test('rankItems returns at most the limit', () => {
  const items = [item('Chart 1'), item('Chart 2'), item('Chart 3')];
  expect(rankItems(items, 'chart', 2)).toHaveLength(2);
});
