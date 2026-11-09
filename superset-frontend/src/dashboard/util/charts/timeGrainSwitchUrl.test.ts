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
import {
  CHART_TIME_GRAINS_PARAM,
  parseChartTimeGrains,
  replaceChartTimeGrainInUrl,
  RouterHistory,
  withChartTimeGrain,
} from './timeGrainSwitchUrl';

test('parseChartTimeGrains reads grains by chart id', () => {
  expect(
    parseChartTimeGrains(
      '?standalone=1&chart_time_grains=279%3AP1W%2C280%3A1969-12-28T00%3A00%3A00Z%2FP1W',
    ),
  ).toEqual({ 279: 'P1W', 280: '1969-12-28T00:00:00Z/P1W' });
  expect(parseChartTimeGrains('?chart_time_grains=279:P1W,280:P1M')).toEqual({
    279: 'P1W',
    280: 'P1M',
  });
});

test('parseChartTimeGrains skips malformed entries', () => {
  expect(
    parseChartTimeGrains(
      '?chart_time_grains=279:P1W,:P1M,abc:P1M,0:P1D,12,13:,14:<script>,15:P3M',
    ),
  ).toEqual({ 279: 'P1W', 15: 'P3M' });
  expect(parseChartTimeGrains('')).toEqual({});
  expect(parseChartTimeGrains('?other=1')).toEqual({});
});

test('withChartTimeGrain sets, replaces and removes a chart entry', () => {
  const set = withChartTimeGrain('?a=1&chart_time_grains=280:P1M', 279, 'P1W');
  expect(new URLSearchParams(set).get(CHART_TIME_GRAINS_PARAM)).toBe(
    '279:P1W,280:P1M',
  );
  expect(new URLSearchParams(set).get('a')).toBe('1');

  const replaced = withChartTimeGrain(set, 279, 'P2W');
  expect(new URLSearchParams(replaced).get(CHART_TIME_GRAINS_PARAM)).toBe(
    '279:P2W,280:P1M',
  );

  const removed = withChartTimeGrain(replaced, 280, undefined);
  expect(new URLSearchParams(removed).get(CHART_TIME_GRAINS_PARAM)).toBe(
    '279:P2W',
  );

  const empty = withChartTimeGrain(removed, 279, undefined);
  expect(new URLSearchParams(empty).has(CHART_TIME_GRAINS_PARAM)).toBe(false);
  expect(empty).toBe('a=1');
});

test('replaceChartTimeGrainInUrl replaces the location only when it changes', () => {
  const replace = jest.fn();
  const history: RouterHistory = {
    location: { search: '?native_filters_key=xyz' },
    replace,
  };
  replaceChartTimeGrainInUrl(history, 279, 'P1W');
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace.mock.calls[0][0].search).toBe(
    'native_filters_key=xyz&chart_time_grains=279%3AP1W',
  );

  replace.mockClear();
  replaceChartTimeGrainInUrl(history, 279, undefined);
  expect(replace).not.toHaveBeenCalled();
});
