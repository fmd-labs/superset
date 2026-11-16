/* eslint-disable no-underscore-dangle */
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
import { escape, isEmpty } from 'lodash';

import {
  Annotation,
  AnnotationData,
  AnnotationLayer,
  AnnotationOpacity,
  AnnotationType,
  AxisType,
  DataRecord,
  evalExpression,
  FormulaAnnotationLayer,
  isTableAnnotationLayer,
} from '@superset-ui/core';
import { parseTimeGrainDuration } from '@superset-ui/chart-controls';
import { EchartsTimeseriesChartProps } from '../types';
import { EchartsMixedTimeseriesProps } from '../MixedTimeseries/types';

export function evalFormula(
  formula: FormulaAnnotationLayer,
  data: DataRecord[],
  xAxis: string,
  xAxisType: AxisType,
): [any, number][] {
  const { value: expression } = formula;

  return data.map(row => {
    let value = row[xAxis];
    if (xAxisType === AxisType.Time) {
      value = new Date(value as string).getTime();
    }
    return [value, evalExpression(expression, (value || 0) as number)];
  });
}

export function parseAnnotationOpacity(opacity?: AnnotationOpacity): number {
  switch (opacity) {
    case AnnotationOpacity.Low:
      return 0.2;
    case AnnotationOpacity.Medium:
      return 0.5;
    case AnnotationOpacity.High:
      return 0.8;
    default:
      return 1;
  }
}

const NATIVE_COLUMN_NAMES = {
  descriptionColumns: ['long_descr'],
  intervalEndColumn: 'end_dttm',
  timeColumn: 'start_dttm',
  titleColumn: 'short_descr',
};

export function extractRecordAnnotations(
  annotationLayer: AnnotationLayer,
  annotationData: AnnotationData,
): Annotation[] {
  const { name } = annotationLayer;
  const result = annotationData[name];
  const records = result?.records || [];
  const {
    descriptionColumns = [],
    intervalEndColumn = '',
    timeColumn = '',
    titleColumn = '',
  } = isTableAnnotationLayer(annotationLayer)
    ? annotationLayer
    : NATIVE_COLUMN_NAMES;

  return records.map(record => ({
    descriptions: descriptionColumns.map(
      column => (record[column] || '') as string,
    ) as string[],
    intervalEnd: (record[intervalEndColumn] || '') as string,
    time: (record[timeColumn] || '') as string,
    title: (record[titleColumn] || '') as string,
  }));
}

export function formatAnnotationLabel(
  name?: string,
  title?: string,
  descriptions: string[] = [],
): string {
  const labels: string[] = [];
  const titleLabels: string[] = [];
  const filteredDescriptions = descriptions.filter(
    description => !!description,
  );
  if (name) titleLabels.push(name);
  if (title) titleLabels.push(title);
  if (titleLabels.length > 0) labels.push(titleLabels.join(' - '));
  if (filteredDescriptions.length > 0)
    labels.push(filteredDescriptions.join('\n'));
  return labels.join('\n\n');
}

export function extractAnnotationLabels(layers: AnnotationLayer[]): string[] {
  const formulaAnnotationLabels = layers
    .filter(anno => anno.annotationType === AnnotationType.Formula && anno.show)
    .map(anno => anno.name);

  const timeseriesAnnotationLabels = layers
    .filter(
      anno => anno.annotationType === AnnotationType.Timeseries && anno.show,
    )
    .map(anno => anno.name);

  return formulaAnnotationLabels.concat(timeseriesAnnotationLabels);
}

export function getAnnotationData(
  chartProps: EchartsTimeseriesChartProps | EchartsMixedTimeseriesProps,
): AnnotationData {
  const data = chartProps?.queriesData[0]?.annotation_data as AnnotationData;
  if (!isEmpty(data)) {
    return data;
  }
  return {};
}

/**
 * Event markers on the time axis (the `annotation_axis_markers` control): each
 * event annotation is drawn at the point of the period of the time axis it
 * falls in, with a marker where its line meets the axis. Events outside the
 * periods the chart shows are left out.
 */
export interface AnnotationAxisMarkers {
  /** The times of the chart's points, in epoch milliseconds, sorted and unique. */
  points: number[];
  /** The chart's time grain, which sets how long the period of a point is. */
  timeGrain?: string | null;
  /**
   * Whether the chart's tooltip names the events of a period. An event's line
   * then shows no label on hover.
   */
  eventsInTooltip?: boolean;
}

/** Diameter, in pixels, of the marker an event gets on the time axis. */
export const ANNOTATION_AXIS_MARKER_SIZE = 10;

/**
 * An annotation's time in epoch milliseconds. The chart data API sends
 * annotation times as epoch milliseconds; an ISO 8601 string without a
 * timezone is read as UTC, as the chart's own times are.
 */
export function parseAnnotationTime(time: unknown): number | undefined {
  if (typeof time === 'number') {
    return Number.isFinite(time) ? time : undefined;
  }
  if (typeof time !== 'string' || time.trim() === '') {
    return undefined;
  }
  const value = time.trim();
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  const hasTimezone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const parsed = Date.parse(hasTimezone || isDateOnly ? value : `${value}Z`);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const DAY = 86400 * 1000;

const MILLISECONDS_PER_UNIT = {
  second: 1000,
  minute: 60 * 1000,
  hour: 3600 * 1000,
  day: DAY,
  week: 7 * DAY,
};

/** Upper bound on the missing periods walked through in a gap of the data. */
const MAX_GAP_PERIODS = 10000;

/**
 * `time` plus `times` periods of a plain ISO 8601 duration (`P1W`, `P3M`), in
 * UTC; `undefined` for anything else (an anchored grain).
 */
export function addTimeGrain(
  time: number,
  duration?: string | null,
  times = 1,
): number | undefined {
  const parsed = parseTimeGrainDuration(duration);
  if (!parsed) {
    return undefined;
  }
  const count = parsed.count * times;
  if (parsed.unit === 'month' || parsed.unit === 'year') {
    const date = new Date(time);
    if (parsed.unit === 'month') {
      date.setUTCMonth(date.getUTCMonth() + count);
    } else {
      date.setUTCFullYear(date.getUTCFullYear() + count);
    }
    return date.getTime();
  }
  return time + count * MILLISECONDS_PER_UNIT[parsed.unit];
}

/**
 * A time grain's duration, and whether its points end their period: the week
 * ending on Saturday or Sunday (`P1W/1970-01-03T00:00:00Z`) puts each point on
 * the last day of its week; every other grain (`P1W`,
 * `1969-12-28T00:00:00Z/P1W`) on the start of its period.
 */
function grainPeriod(timeGrain?: string | null): {
  duration?: string;
  endAnchored: boolean;
} {
  const [first = '', second] = (timeGrain || '').split('/');
  if (second === undefined) {
    return { duration: first || undefined, endAnchored: false };
  }
  return first.startsWith('P')
    ? { duration: first, endAnchored: true }
    : { duration: second, endAnchored: false };
}

/** The index of the last of the sorted `points` at or before `time`, or -1. */
function lastPointAtOrBefore(points: number[], time: number): number {
  let low = 0;
  let high = points.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle] <= time) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return found;
}

/** Points that start their period: the last point at or before the event. */
function snapToPeriodStart(
  time: number,
  points: number[],
  duration?: string,
): number | undefined {
  const index = lastPointAtOrBefore(points, time);
  if (index < 0) {
    return undefined;
  }
  let start = points[index];
  const next = points[index + 1];
  let end = addTimeGrain(start, duration);
  if (end === undefined) {
    // Without a plain duration, a period lasts until the next point, and the
    // last one as long as the one before it.
    if (next !== undefined) {
      return start;
    }
    if (index === 0) {
      return time === start ? start : undefined;
    }
    return time < start + (start - points[index - 1]) ? start : undefined;
  }
  if (next === undefined) {
    return time < end ? start : undefined;
  }
  // An event in a gap of the data belongs to a period without a point.
  for (let i = 0; end <= time && i < MAX_GAP_PERIODS; i += 1) {
    start = end;
    end = addTimeGrain(start, duration) ?? Number.POSITIVE_INFINITY;
  }
  return start;
}

/**
 * Points that end their period (the last day of a week): the first point
 * whose day is not over before the event.
 */
function snapToPeriodEnd(
  time: number,
  points: number[],
  duration?: string,
): number | undefined {
  // The period of a point runs from one duration before the day after it
  // until the day after it.
  const periodStart = (point: number) =>
    addTimeGrain(point + DAY, duration, -1);
  const index = lastPointAtOrBefore(points, time - DAY) + 1;
  if (index >= points.length) {
    return undefined;
  }
  let point = points[index];
  let start = periodStart(point);
  if (start === undefined || time >= start) {
    return point;
  }
  if (index === 0) {
    return undefined;
  }
  // An event in a gap of the data belongs to a period without a point.
  for (let i = 0; time < start && i < MAX_GAP_PERIODS; i += 1) {
    point = start - DAY;
    start = periodStart(point) ?? Number.NEGATIVE_INFINITY;
  }
  return point;
}

/**
 * The time of the point whose period an event at `time` falls in, or
 * `undefined` when it falls before the first period or after the last one.
 * An event in a gap of the data gets the time its period's point would have.
 * The last period ends one duration after its point; for a grain that is not
 * a plain duration, it is as long as the period before it.
 */
export function snapAnnotationTime(
  time: number,
  { points, timeGrain }: AnnotationAxisMarkers,
): number | undefined {
  const { duration, endAnchored } = grainPeriod(timeGrain);
  return endAnchored
    ? snapToPeriodEnd(time, points, duration)
    : snapToPeriodStart(time, points, duration);
}

/** The periods of a chart's time axis, from the times of its points. */
export function getAnnotationPeriods(
  pointTimes: unknown[],
  timeGrain?: string | null,
  eventsInTooltip = false,
): AnnotationAxisMarkers {
  const points = [
    ...new Set(
      pointTimes
        .map(parseAnnotationTime)
        .filter((time): time is number => time !== undefined),
    ),
  ].sort((a, b) => a - b);
  return { points, timeGrain, eventsInTooltip };
}

/**
 * The events of a chart's shown event layers by the point of the period they
 * fall in, as tooltip rows for that period: the event's title and its layer's
 * name, HTML-escaped.
 */
export function getPeriodEventRows(
  layers: AnnotationLayer[],
  annotationData: AnnotationData,
  axisMarkers: AnnotationAxisMarkers,
): Map<number, string[][]> {
  const rows = new Map<number, string[][]>();
  layers
    .filter(
      layer => layer.show && layer.annotationType === AnnotationType.Event,
    )
    .forEach(layer => {
      extractRecordAnnotations(layer, annotationData).forEach(annotation => {
        const time = parseAnnotationTime(annotation.time);
        const point =
          time === undefined
            ? undefined
            : snapAnnotationTime(time, axisMarkers);
        if (point === undefined) {
          return;
        }
        const title =
          annotation.title || annotation.descriptions?.[0] || layer.name;
        rows.set(point, [
          ...(rows.get(point) || []),
          [escape(title), escape(layer.name)],
        ]);
      });
    });
  return rows;
}
