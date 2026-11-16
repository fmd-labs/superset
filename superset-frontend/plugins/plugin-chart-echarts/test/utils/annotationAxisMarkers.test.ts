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
  addTimeGrain,
  getAnnotationPeriods,
  parseAnnotationTime,
  snapAnnotationTime,
} from '../../src/utils/annotation';

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);
const HOUR = 3600 * 1000;

test('parseAnnotationTime reads epoch milliseconds and ISO strings as UTC', () => {
  expect(parseAnnotationTime(1700000000000)).toBe(1700000000000);
  expect(parseAnnotationTime('1700000000000')).toBe(1700000000000);
  expect(parseAnnotationTime('2026-11-10')).toBe(utc('2026-11-10'));
  expect(parseAnnotationTime('2026-11-10T00:00:00')).toBe(utc('2026-11-10'));
  expect(parseAnnotationTime('2026-11-10T01:00:00+01:00')).toBe(
    utc('2026-11-10'),
  );
  expect(parseAnnotationTime('2026-11-10T00:00:00Z')).toBe(utc('2026-11-10'));
});

test('parseAnnotationTime rejects values that are not times', () => {
  expect(parseAnnotationTime(undefined)).toBeUndefined();
  expect(parseAnnotationTime(null)).toBeUndefined();
  expect(parseAnnotationTime('')).toBeUndefined();
  expect(parseAnnotationTime('not a date')).toBeUndefined();
  expect(parseAnnotationTime(Number.NaN)).toBeUndefined();
});

test('addTimeGrain adds or subtracts periods of a plain duration in UTC', () => {
  expect(addTimeGrain(utc('2026-11-10'), 'P1D')).toBe(utc('2026-11-11'));
  expect(addTimeGrain(utc('2026-11-09'), 'P1W')).toBe(utc('2026-11-16'));
  expect(addTimeGrain(utc('2026-11-09'), 'P2W')).toBe(utc('2026-11-23'));
  expect(addTimeGrain(utc('2026-01-31'), 'P1M')).toBe(utc('2026-03-03'));
  expect(addTimeGrain(utc('2026-10-01'), 'P3M')).toBe(utc('2027-01-01'));
  expect(addTimeGrain(utc('2026-01-01'), 'P1Y')).toBe(utc('2027-01-01'));
  expect(addTimeGrain(utc('2026-11-01'), 'P1M', -1)).toBe(utc('2026-10-01'));
  expect(addTimeGrain(utc('2026-11-08'), 'P1W', -1)).toBe(utc('2026-11-01'));
  expect(addTimeGrain(0, 'PT1H')).toBe(HOUR);
  expect(addTimeGrain(0, 'PT15M')).toBe(15 * 60 * 1000);
});

test('addTimeGrain gives nothing for anchored or missing grains', () => {
  expect(addTimeGrain(0, '1969-12-28T00:00:00Z/P1W')).toBeUndefined();
  expect(addTimeGrain(0, undefined)).toBeUndefined();
  expect(addTimeGrain(0, null)).toBeUndefined();
});

test('getAnnotationPeriods sorts the points and drops invalid ones', () => {
  expect(getAnnotationPeriods([3, null, 1, '2', 3, 'x'], 'P1D', true)).toEqual({
    points: [1, 2, 3],
    timeGrain: 'P1D',
    eventsInTooltip: true,
  });
});

test('snapAnnotationTime puts an event at the period it falls in', () => {
  const weeks = getAnnotationPeriods(
    [utc('2026-10-26'), utc('2026-11-02'), utc('2026-11-09')],
    'P1W',
  );
  expect(snapAnnotationTime(utc('2026-10-29'), weeks)).toBe(utc('2026-10-26'));
  expect(snapAnnotationTime(utc('2026-11-02'), weeks)).toBe(utc('2026-11-02'));
  // Inside the last week, after its point
  expect(snapAnnotationTime(utc('2026-11-12'), weeks)).toBe(utc('2026-11-09'));
  // Outside the weeks shown
  expect(snapAnnotationTime(utc('2026-10-25'), weeks)).toBeUndefined();
  expect(snapAnnotationTime(utc('2026-11-16'), weeks)).toBeUndefined();
  expect(
    snapAnnotationTime(utc('2026-11-01'), getAnnotationPeriods([], 'P1D')),
  ).toBeUndefined();
});

test('snapAnnotationTime gives an event in a gap of the data the time of its period', () => {
  // No row for the week of 2 November
  const weeks = getAnnotationPeriods(
    [utc('2026-10-26'), utc('2026-11-09')],
    'P1W',
  );
  expect(snapAnnotationTime(utc('2026-11-04'), weeks)).toBe(utc('2026-11-02'));
  expect(snapAnnotationTime(utc('2026-10-27'), weeks)).toBe(utc('2026-10-26'));
  // No row for October
  const months = getAnnotationPeriods(
    [utc('2026-09-01'), utc('2026-11-01')],
    'P1M',
  );
  expect(snapAnnotationTime(utc('2026-10-15'), months)).toBe(utc('2026-10-01'));
  expect(snapAnnotationTime(utc('2026-11-30') + HOUR, months)).toBe(
    utc('2026-11-01'),
  );
  expect(snapAnnotationTime(utc('2026-12-01'), months)).toBeUndefined();
});

test('snapAnnotationTime reads the duration of a grain anchored at its start', () => {
  // Weeks starting on Sunday
  const weeks = getAnnotationPeriods(
    [utc('2026-11-01'), utc('2026-11-08')],
    '1969-12-28T00:00:00Z/P1W',
  );
  expect(snapAnnotationTime(utc('2026-11-14'), weeks)).toBe(utc('2026-11-08'));
  expect(snapAnnotationTime(utc('2026-11-15'), weeks)).toBeUndefined();
});

test('snapAnnotationTime puts an event of a week ending on Saturday at its last day', () => {
  const weeks = getAnnotationPeriods(
    [utc('2026-10-31'), utc('2026-11-07')],
    'P1W/1970-01-03T00:00:00Z',
  );
  // Sunday 25 October starts the week that ends on Saturday 31 October
  expect(snapAnnotationTime(utc('2026-10-25'), weeks)).toBe(utc('2026-10-31'));
  expect(snapAnnotationTime(utc('2026-11-04'), weeks)).toBe(utc('2026-11-07'));
  expect(snapAnnotationTime(utc('2026-11-07') + 14 * HOUR, weeks)).toBe(
    utc('2026-11-07'),
  );
  // Before the first week and after the last one
  expect(snapAnnotationTime(utc('2026-10-24'), weeks)).toBeUndefined();
  expect(snapAnnotationTime(utc('2026-11-08'), weeks)).toBeUndefined();
});

test('snapAnnotationTime gives an event in a gap of weeks ending on Saturday the last day of its week', () => {
  // No row for the week ending 31 October
  const weeks = getAnnotationPeriods(
    [utc('2026-10-24'), utc('2026-11-07')],
    'P1W/1970-01-03T00:00:00Z',
  );
  expect(snapAnnotationTime(utc('2026-10-28'), weeks)).toBe(utc('2026-10-31'));
  expect(snapAnnotationTime(utc('2026-11-01'), weeks)).toBe(utc('2026-11-07'));
});

test('snapAnnotationTime takes the last period as long as the one before it without a duration', () => {
  const unknown = getAnnotationPeriods(
    [utc('2026-11-01'), utc('2026-11-08')],
    'not a grain',
  );
  expect(snapAnnotationTime(utc('2026-11-14'), unknown)).toBe(
    utc('2026-11-08'),
  );
  expect(snapAnnotationTime(utc('2026-11-15'), unknown)).toBeUndefined();
  const single = getAnnotationPeriods([utc('2026-11-01')]);
  expect(snapAnnotationTime(utc('2026-11-01'), single)).toBe(utc('2026-11-01'));
  expect(snapAnnotationTime(utc('2026-11-02'), single)).toBeUndefined();
});
