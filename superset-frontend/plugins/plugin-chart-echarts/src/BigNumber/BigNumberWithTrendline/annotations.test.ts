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
  AnnotationData,
  AnnotationLayer,
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import { getTrendlineAnnotations } from './annotations';

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

const days = [utc('2026-11-09'), utc('2026-11-10'), utc('2026-11-11')];

const event: AnnotationLayer = {
  annotationType: AnnotationType.Event,
  name: 'Releases',
  show: true,
  showLabel: true,
  sourceType: AnnotationSourceType.Native,
  style: AnnotationStyle.Dotted,
  value: 1,
};

const interval: AnnotationLayer = {
  annotationType: AnnotationType.Interval,
  name: 'Campaigns',
  show: true,
  showLabel: false,
  sourceType: AnnotationSourceType.Native,
  style: AnnotationStyle.Solid,
  value: 2,
};

const record = (start: number, end: number, title: string) => ({
  start_dttm: start,
  end_dttm: end,
  short_descr: title,
  long_descr: '',
  json_metadata: '',
});

const annotationData: AnnotationData = {
  Releases: {
    records: [
      record(utc('2026-11-10') + 3600 * 1000, utc('2026-11-10'), 'Pricing'),
      record(
        utc('2026-11-10') + 7200 * 1000,
        utc('2026-11-10'),
        '<b>Cancel</b>',
      ),
    ],
  },
  Campaigns: {
    records: [record(utc('2026-11-09'), utc('2026-11-11'), 'Promo')],
  },
};

type MarkLine = { symbol: unknown; label: unknown; data: unknown[] };

test('a trend line without annotation layers gets no annotations', () => {
  const { series, markerOffset, eventRows } = getTrendlineAnnotations({
    pointTimes: days,
    theme: supersetTheme,
    annotationData,
  });
  expect(series).toEqual([]);
  expect(markerOffset).toBe(0);
  expect(eventRows.size).toBe(0);
});

test('hidden annotation layers are left out', () => {
  expect(
    getTrendlineAnnotations({
      annotationLayers: [{ ...event, show: false }],
      pointTimes: days,
      theme: supersetTheme,
      annotationData,
    }).series,
  ).toEqual([]);
});

test('events and intervals mark the trend line, events without their label', () => {
  const { series, markerOffset } = getTrendlineAnnotations({
    annotationLayers: [event, interval],
    pointTimes: days,
    theme: supersetTheme,
    annotationData,
  });
  expect(series.map(item => item.id)).toEqual([
    'Event - Releases',
    'Interval - Campaigns',
  ]);
  const { markLine } = series[0] as { markLine: MarkLine };
  expect(markLine.symbol).toBe('none');
  expect(markLine.label).toEqual({ show: false });
  expect(markLine.data).toHaveLength(2);
  expect(markerOffset).toBe(0);
});

test('the tooltip names the events of each period, escaped', () => {
  const { eventRows } = getTrendlineAnnotations({
    annotationLayers: [event, interval],
    pointTimes: days,
    timeGrain: 'P1D',
    theme: supersetTheme,
    annotationData,
  });
  expect([...eventRows.entries()]).toEqual([
    [
      utc('2026-11-10'),
      [
        ['Pricing', 'Releases'],
        ['&lt;b&gt;Cancel&lt;/b&gt;', 'Releases'],
      ],
    ],
  ]);
});

test('event markers snap events to their day and leave room below the trend line', () => {
  const { series, markerOffset } = getTrendlineAnnotations({
    annotationLayers: [event],
    annotationAxisMarkers: true,
    pointTimes: days,
    timeGrain: 'P1D',
    theme: supersetTheme,
    annotationData,
  });
  expect(series.map(item => item.id)).toEqual([
    'Event - Releases',
    'Event markers - Releases',
  ]);
  const [line, markers] = series.map(
    item => (item as { markLine: MarkLine }).markLine,
  );
  expect(line.symbol).toBe('none');
  expect(line.label).toEqual({ show: false });
  expect(markers.symbol).toEqual(['circle', 'none']);
  expect(markers.data).toEqual([
    {
      name: 'Releases - Pricing\nReleases - <b>Cancel</b>',
      xAxis: utc('2026-11-10'),
    },
  ]);
  expect(markerOffset).toBeGreaterThan(0);
});

test('event markers leave no room when no event falls on the trend line', () => {
  const { series, markerOffset } = getTrendlineAnnotations({
    annotationLayers: [event],
    annotationAxisMarkers: true,
    pointTimes: [utc('2026-01-01')],
    timeGrain: 'P1D',
    theme: supersetTheme,
    annotationData,
  });
  expect(series).toEqual([]);
  expect(markerOffset).toBe(0);
});
