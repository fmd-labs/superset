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
  applyTimeGrainSwitch,
  getTimeGrainOptions,
  getTimeGrainPeriods,
  getTimeGrainWindow,
  parseTimeGrainDuration,
  shortTimeGrainLabel,
  timeGrainSortKey,
} from '../../src';

// A Monday: weeks since Monday 1970-01-05 are even, so a P2W bucket starts today.
const MONDAY_EVEN = new Date('2026-11-09T12:00:00Z');
// The Monday after: a P2W bucket started a week earlier.
const MONDAY_ODD = new Date('2026-11-16T12:00:00Z');

const baseFormData = {
  viz_type: 'echarts_timeseries_bar',
  datasource: '1__table',
  x_axis: 'day',
  time_grain_sqla: 'P1D',
  time_grain_options: ['P1M', 'P1W', 'P2W'],
  time_grain_periods: { P1W: 12, P2W: 13, P1M: 12 },
  extra_form_data: {},
};

test('parseTimeGrainDuration reads single-component ISO 8601 durations', () => {
  expect(parseTimeGrainDuration('P1D')).toEqual({ unit: 'day', count: 1 });
  expect(parseTimeGrainDuration('P2W')).toEqual({ unit: 'week', count: 2 });
  expect(parseTimeGrainDuration('P3M')).toEqual({ unit: 'month', count: 3 });
  expect(parseTimeGrainDuration('P1Y')).toEqual({ unit: 'year', count: 1 });
  expect(parseTimeGrainDuration('PT15M')).toEqual({
    unit: 'minute',
    count: 15,
  });
  expect(parseTimeGrainDuration('PT1H')).toEqual({ unit: 'hour', count: 1 });
});

test('parseTimeGrainDuration rejects anchored, empty and malformed grains', () => {
  expect(parseTimeGrainDuration('1969-12-28T00:00:00Z/P1W')).toBeUndefined();
  expect(parseTimeGrainDuration('P1W/1970-01-03T00:00:00Z')).toBeUndefined();
  expect(parseTimeGrainDuration('P0D')).toBeUndefined();
  expect(parseTimeGrainDuration('P1DT1H')).toBeUndefined();
  expect(parseTimeGrainDuration('week')).toBeUndefined();
  expect(parseTimeGrainDuration(undefined)).toBeUndefined();
  expect(parseTimeGrainDuration(null)).toBeUndefined();
});

test('shortTimeGrainLabel gives compact labels, Q for quarters', () => {
  expect(
    ['P1D', 'P1W', 'P2W', 'P1M', 'P3M', 'P1Y', 'PT1H', 'PT15M'].map(
      shortTimeGrainLabel,
    ),
  ).toEqual(['D', 'W', '2W', 'M', 'Q', 'Y', 'H', '15m']);
  expect(shortTimeGrainLabel('1969-12-28T00:00:00Z/P1W')).toBe(
    '1969-12-28T00:00:00Z/P1W',
  );
});

test('timeGrainSortKey orders grains by length, unknown grains last', () => {
  const grains = ['P3M', 'unknown', 'P1W', 'PT1H', 'P1M', 'P2W', 'P1D', 'P1Y'];
  expect(
    [...grains].sort((a, b) => timeGrainSortKey(a) - timeGrainSortKey(b)),
  ).toEqual(['PT1H', 'P1D', 'P1W', 'P2W', 'P1M', 'P3M', 'P1Y', 'unknown']);
});

test('getTimeGrainOptions keeps unique non-empty strings', () => {
  expect(
    getTimeGrainOptions({
      time_grain_options: ['P1W', 'P1W', '', null, 3, 'P1M'],
    }),
  ).toEqual(['P1W', 'P1M']);
  expect(getTimeGrainOptions({ time_grain_options: 'P1W' })).toEqual([]);
  expect(getTimeGrainOptions({})).toEqual([]);
  expect(getTimeGrainOptions(undefined)).toEqual([]);
});

test('getTimeGrainPeriods accepts whole numbers from 1 to 1000 only', () => {
  const formData = {
    time_grain_periods: {
      P1W: 12,
      P1M: '6',
      P3M: 0,
      P1Y: 1.5,
      P1D: 1001,
      P2W: 'x',
    },
  };
  expect(getTimeGrainPeriods(formData, 'P1W')).toBe(12);
  expect(getTimeGrainPeriods(formData, 'P1M')).toBe(6);
  expect(getTimeGrainPeriods(formData, 'P3M')).toBeUndefined();
  expect(getTimeGrainPeriods(formData, 'P1Y')).toBeUndefined();
  expect(getTimeGrainPeriods(formData, 'P1D')).toBeUndefined();
  expect(getTimeGrainPeriods(formData, 'P2W')).toBeUndefined();
  expect(
    getTimeGrainPeriods({ time_grain_periods: [12] }, '0'),
  ).toBeUndefined();
  expect(getTimeGrainPeriods({}, 'P1W')).toBeUndefined();
});

test('getTimeGrainWindow covers the last N buckets, the current one included', () => {
  expect(getTimeGrainWindow('P1D', 30, MONDAY_EVEN)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), day), -29, day) : now',
  );
  expect(getTimeGrainWindow('P1W', 12, MONDAY_EVEN)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), week), -11, week) : now',
  );
  expect(getTimeGrainWindow('P1M', 12, MONDAY_EVEN)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), month), -11, month) : now',
  );
  expect(getTimeGrainWindow('P1M', 1, MONDAY_EVEN)).toBe(
    'DATETRUNC(DATETIME("today"), month) : now',
  );
  expect(getTimeGrainWindow('P1Y', 3, MONDAY_EVEN)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), year), -2, year) : now',
  );
  expect(getTimeGrainWindow('PT1H', 24, MONDAY_EVEN)).toBe(
    'DATEADD(DATETRUNC(DATETIME("now"), hour), -23, hour) : now',
  );
});

test('getTimeGrainWindow aligns multi-week buckets to Monday 1970-01-05', () => {
  expect(getTimeGrainWindow('P2W', 13, MONDAY_EVEN)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), week), -24, week) : now',
  );
  expect(getTimeGrainWindow('P2W', 13, MONDAY_ODD)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), week), -25, week) : now',
  );
  // Sunday still belongs to the week that started on the Monday before.
  expect(getTimeGrainWindow('P2W', 1, new Date('2026-11-15T23:00:00Z'))).toBe(
    'DATETRUNC(DATETIME("today"), week) : now',
  );
  expect(getTimeGrainWindow('P2W', 1, MONDAY_ODD)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), week), -1, week) : now',
  );
});

test('getTimeGrainWindow aligns quarters to calendar quarters', () => {
  // November is the second month of Q4, so the current quarter began a month ago.
  expect(getTimeGrainWindow('P3M', 8, MONDAY_EVEN)).toBe(
    'DATEADD(DATETRUNC(DATETIME("today"), month), -22, month) : now',
  );
  expect(getTimeGrainWindow('P3M', 1, new Date('2026-10-01T00:00:00Z'))).toBe(
    'DATETRUNC(DATETIME("today"), month) : now',
  );
});

test('getTimeGrainWindow gives up on grains and periods it cannot reason about', () => {
  expect(
    getTimeGrainWindow('1969-12-28T00:00:00Z/P1W', 4, MONDAY_EVEN),
  ).toBeUndefined();
  expect(getTimeGrainWindow('P1W', 0, MONDAY_EVEN)).toBeUndefined();
  expect(getTimeGrainWindow('P1W', 2.5, MONDAY_EVEN)).toBeUndefined();
});

test('applyTimeGrainSwitch leaves charts without options alone', () => {
  const formData = { ...baseFormData, time_grain_options: [] };
  const { state, formData: result } = applyTimeGrainSwitch(
    formData,
    'P1W',
    MONDAY_EVEN,
  );
  expect(result).toBe(formData);
  expect(state).toEqual({
    options: [],
    periods: {},
    defaultGrain: 'P1D',
    activeGrain: 'P1D',
    windowFromFilter: false,
  });
});

test('applyTimeGrainSwitch without a choice keeps the form data and lists the options', () => {
  const { state, formData } = applyTimeGrainSwitch(
    baseFormData,
    undefined,
    MONDAY_EVEN,
  );
  expect(formData).toBe(baseFormData);
  expect(state).toEqual({
    options: ['P1D', 'P1W', 'P2W', 'P1M'],
    periods: { P1W: 12, P2W: 13, P1M: 12 },
    defaultGrain: 'P1D',
    activeGrain: 'P1D',
    windowFromFilter: false,
  });
});

test('applyTimeGrainSwitch applies the chosen grain and its window', () => {
  const { state, formData } = applyTimeGrainSwitch(
    baseFormData,
    'P1W',
    MONDAY_EVEN,
  );
  const window = 'DATEADD(DATETRUNC(DATETIME("today"), week), -11, week) : now';
  expect(formData).toEqual({
    ...baseFormData,
    time_grain_sqla: 'P1W',
    extra_form_data: { time_grain_sqla: 'P1W', time_range: window },
  });
  expect(state).toMatchObject({
    selectedGrain: 'P1W',
    activeGrain: 'P1W',
    defaultGrain: 'P1D',
    window,
  });
  // The saved form data is not mutated.
  expect(baseFormData.time_grain_sqla).toBe('P1D');
  expect(baseFormData.extra_form_data).toEqual({});
});

test('applyTimeGrainSwitch keeps the chart window for a grain without periods', () => {
  const formData = { ...baseFormData, time_grain_periods: {} };
  const { state, formData: result } = applyTimeGrainSwitch(
    formData,
    'P1M',
    MONDAY_EVEN,
  );
  expect(result.time_grain_sqla).toBe('P1M');
  expect(result.extra_form_data).toEqual({ time_grain_sqla: 'P1M' });
  expect(state.window).toBeUndefined();
});

test('applyTimeGrainSwitch ignores choices that are not options or are the default', () => {
  expect(applyTimeGrainSwitch(baseFormData, 'P1Y', MONDAY_EVEN).formData).toBe(
    baseFormData,
  );
  expect(applyTimeGrainSwitch(baseFormData, 'P1D', MONDAY_EVEN).formData).toBe(
    baseFormData,
  );
  expect(applyTimeGrainSwitch(baseFormData, 42, MONDAY_EVEN).formData).toBe(
    baseFormData,
  );
});

test('applyTimeGrainSwitch wins over a dashboard time grain filter', () => {
  const formData = {
    ...baseFormData,
    extra_form_data: { time_grain_sqla: 'P1M' },
  };
  const unchosen = applyTimeGrainSwitch(formData, undefined, MONDAY_EVEN);
  expect(unchosen.state.defaultGrain).toBe('P1M');
  expect(unchosen.state.activeGrain).toBe('P1M');
  expect(unchosen.state.periods).toEqual({ P1W: 12, P2W: 13 });

  const chosen = applyTimeGrainSwitch(formData, 'P1W', MONDAY_EVEN);
  expect(chosen.formData.extra_form_data.time_grain_sqla).toBe('P1W');
  expect(chosen.formData.time_grain_sqla).toBe('P1W');
});

test('applyTimeGrainSwitch leaves the time range of a dashboard filter in place', () => {
  const formData = {
    ...baseFormData,
    extra_form_data: { time_range: 'Last quarter' },
  };
  const { state, formData: result } = applyTimeGrainSwitch(
    formData,
    'P1W',
    MONDAY_EVEN,
  );
  expect(result.extra_form_data).toEqual({
    time_range: 'Last quarter',
    time_grain_sqla: 'P1W',
  });
  expect(state.window).toBeUndefined();
  expect(state.windowFromFilter).toBe(true);
});

test('applyTimeGrainSwitch updates the grain an adhoc x-axis carries', () => {
  const xAxis = {
    expressionType: 'SQL',
    sqlExpression: 'created_at',
    label: 'created_at',
    timeGrain: 'P1D',
  };
  const formData = { ...baseFormData, x_axis: xAxis };
  const { formData: result } = applyTimeGrainSwitch(
    formData,
    'P2W',
    MONDAY_EVEN,
  );
  expect(result.x_axis).toEqual({ ...xAxis, timeGrain: 'P2W' });
  expect(xAxis.timeGrain).toBe('P1D');
});
