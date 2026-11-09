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
import type { JsonObject } from '@superset-ui/core';

/**
 * A chart's time grain switch: the grains a dashboard viewer can switch the
 * chart to from its header, without editing it.
 *
 * The chart's saved time grain (or the one a dashboard filter applies) stays
 * its default. A viewer's choice is kept in the chart's `ownState` on the
 * dashboard, which re-runs only that chart, and in the dashboard URL.
 */

/** Form data key: the time grains a viewer can switch to (ISO 8601 durations). */
export const TIME_GRAIN_OPTIONS_KEY = 'time_grain_options';
/** Form data key: how many periods of each grain the chart shows when a viewer picks it. */
export const TIME_GRAIN_PERIODS_KEY = 'time_grain_periods';
/** Key of the viewer's choice in the chart's `ownState`. */
export const SELECTED_TIME_GRAIN_KEY = 'selectedTimeGrain';

export const MAX_TIME_GRAIN_PERIODS = 1000;

export type TimeGrainUnit =
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

export interface TimeGrainDuration {
  unit: TimeGrainUnit;
  /** How many units one bucket spans, e.g. 2 for `P2W`, 3 for `P3M` (a quarter). */
  count: number;
}

const DATE_UNITS: Record<string, TimeGrainUnit> = {
  D: 'day',
  W: 'week',
  M: 'month',
  Y: 'year',
};
const TIME_UNITS: Record<string, TimeGrainUnit> = {
  H: 'hour',
  M: 'minute',
  S: 'second',
};

/**
 * Parse a plain ISO 8601 duration with a single component (`P1D`, `P2W`,
 * `P3M`, `PT15M`). Anchored grains such as `1969-12-28T00:00:00Z/P1W`, and
 * anything else, return `undefined`.
 */
export function parseTimeGrainDuration(
  grain: string | null | undefined,
): TimeGrainDuration | undefined {
  if (typeof grain !== 'string') {
    return undefined;
  }
  const dateMatch = /^P([1-9]\d*)([DWMY])$/.exec(grain);
  if (dateMatch) {
    return { unit: DATE_UNITS[dateMatch[2]], count: Number(dateMatch[1]) };
  }
  const timeMatch = /^PT([1-9]\d*)([HMS])$/.exec(grain);
  if (timeMatch) {
    return { unit: TIME_UNITS[timeMatch[2]], count: Number(timeMatch[1]) };
  }
  return undefined;
}

const UNIT_SECONDS: Record<TimeGrainUnit, number> = {
  second: 1,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 7 * 86400,
  month: 30.44 * 86400,
  year: 365.25 * 86400,
};

/** Approximate length of a grain in seconds, for ordering; `Infinity` when unknown. */
export function timeGrainSortKey(grain: string): number {
  const duration = parseTimeGrainDuration(grain);
  return duration ? duration.count * UNIT_SECONDS[duration.unit] : Infinity;
}

const SHORT_UNIT_LABELS: Record<TimeGrainUnit, string> = {
  second: 's',
  minute: 'm',
  hour: 'H',
  day: 'D',
  week: 'W',
  month: 'M',
  year: 'Y',
};

/**
 * A compact label for a grain, as on a segmented control: `D`, `W`, `2W`,
 * `M`, `Q` (for `P3M`), `Y`, `15m`. Unknown grains are returned unchanged.
 */
export function shortTimeGrainLabel(grain: string): string {
  const duration = parseTimeGrainDuration(grain);
  if (!duration) {
    return grain;
  }
  if (duration.unit === 'month' && duration.count === 3) {
    return 'Q';
  }
  const letter = SHORT_UNIT_LABELS[duration.unit];
  return duration.count === 1 ? letter : `${duration.count}${letter}`;
}

/** The grains a chart offers, without duplicates or invalid entries. */
export function getTimeGrainOptions(
  formData: JsonObject | undefined,
): string[] {
  const options = formData?.[TIME_GRAIN_OPTIONS_KEY];
  if (!Array.isArray(options)) {
    return [];
  }
  return [
    ...new Set(
      options.filter(
        (option): option is string =>
          typeof option === 'string' && option.length > 0,
      ),
    ),
  ];
}

/** The number of periods configured for `grain`, if it is a whole number in range. */
export function getTimeGrainPeriods(
  formData: JsonObject | undefined,
  grain: string,
): number | undefined {
  const periods = formData?.[TIME_GRAIN_PERIODS_KEY];
  if (!periods || typeof periods !== 'object' || Array.isArray(periods)) {
    return undefined;
  }
  const value = Number((periods as JsonObject)[grain]);
  return Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_TIME_GRAIN_PERIODS
    ? value
    : undefined;
}

const EPOCH_MONDAY_UTC = Date.UTC(1970, 0, 5);
const DAY_MS = 86400 * 1000;

const mod = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor;

/**
 * How many units the bucket that contains `now` started before the start of
 * the current unit. Multi-unit grains are aligned to a fixed epoch, as their
 * SQL expressions are: weeks to Monday 1970-01-05, everything else to
 * 1970-01-01 (so `P3M` gives calendar quarters).
 */
function bucketOffset({ unit, count }: TimeGrainDuration, now: Date): number {
  if (count === 1) {
    return 0;
  }
  const startOfDay = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  switch (unit) {
    case 'year':
      return mod(now.getUTCFullYear() - 1970, count);
    case 'month':
      return mod((now.getUTCFullYear() - 1970) * 12 + now.getUTCMonth(), count);
    case 'week': {
      const weekday = mod(now.getUTCDay() - 1, 7); // Monday = 0
      const monday = startOfDay - weekday * DAY_MS;
      return mod(Math.round((monday - EPOCH_MONDAY_UTC) / (7 * DAY_MS)), count);
    }
    case 'day':
      return mod(Math.round(startOfDay / DAY_MS), count);
    case 'hour':
      return mod(now.getUTCHours(), count);
    case 'minute':
      return mod(now.getUTCMinutes(), count);
    default:
      return mod(now.getUTCSeconds(), count);
  }
}

/**
 * The time range that shows the last `periods` buckets of `grain`, the
 * current (possibly partial) one included, in Superset's time range syntax.
 *
 * It ends after the current day (for sub-day grains, after the current hour,
 * minute or second), not at "now": a date column compares with the date of
 * the range's end, and `day < <today>` would leave today, and so the current
 * bucket, out.
 *
 * Quarters use the time range parser's own `quarter` unit. Other multi-unit
 * grains (two weeks, 15 minutes) are aligned to a fixed epoch, as their SQL
 * expressions are: weeks to Monday 1970-01-05, everything else to 1970-01-01.
 * That alignment depends on `now`, so a query recomputes the window when it
 * runs (`refreshTimeGrainWindow`).
 *
 * The range is evaluated on the server ("today" and "now" in its time zone);
 * the alignment assumes that time zone is UTC, and weeks that start on Monday
 * (as on PostgreSQL and ClickHouse; engines whose weeks start on Sunday get a
 * partial first week). Returns `undefined` for grains it cannot reason about.
 */
export function getTimeGrainWindow(
  grain: string,
  periods: number,
  now: Date = new Date(),
): string | undefined {
  const duration = parseTimeGrainDuration(grain);
  if (!duration || !Number.isInteger(periods) || periods < 1) {
    return undefined;
  }
  const isQuarter = duration.unit === 'month' && duration.count === 3;
  const unit = isQuarter ? 'quarter' : duration.unit;
  const count = isQuarter ? 1 : duration.count;
  const unitsBack =
    count * (periods - 1) + (isQuarter ? 0 : bucketOffset(duration, now));
  const isDateUnit = ['day', 'week', 'month', 'quarter', 'year'].includes(unit);
  const base = isDateUnit
    ? `DATETRUNC(DATETIME("today"), ${unit})`
    : `DATETRUNC(DATETIME("now"), ${unit})`;
  const since =
    unitsBack === 0 ? base : `DATEADD(${base}, -${unitsBack}, ${unit})`;
  const until = isDateUnit
    ? 'DATEADD(DATETIME("today"), 1, day)'
    : `DATEADD(DATETRUNC(DATETIME("now"), ${unit}), 1, ${unit})`;
  return `${since} : ${until}`;
}

/** Form data key the window of a viewer's grain choice is kept under, for `refreshTimeGrainWindow`. */
export const TIME_GRAIN_WINDOW_KEY = 'time_grain_switch_window';

/**
 * Recompute the time range of a viewer's grain choice for a query about to
 * run. A dashboard refreshes a chart with the form data of its last query, and
 * the alignment of a two-week bucket depends on the day it runs.
 */
export function refreshTimeGrainWindow<T extends JsonObject>(
  formData: T,
  now: Date = new Date(),
): T {
  const marker = formData?.[TIME_GRAIN_WINDOW_KEY];
  if (!marker || typeof marker !== 'object' || !formData.extra_form_data) {
    return formData;
  }
  const window = getTimeGrainWindow(marker.grain, marker.periods, now);
  if (!window || formData.extra_form_data.time_range === window) {
    return formData;
  }
  return {
    ...formData,
    extra_form_data: { ...formData.extra_form_data, time_range: window },
  };
}

/**
 * Whether the chart's time range comes from a TEMPORAL_RANGE filter on its
 * x-axis column, and from no other: a time range override replaces every
 * TEMPORAL_RANGE filter of a query, and nothing else.
 */
export function hasXAxisTimeRangeFilter(formData: JsonObject): boolean {
  const xAxis = formData.x_axis;
  if (typeof xAxis !== 'string') {
    return false;
  }
  const temporal = [
    ...(Array.isArray(formData.adhoc_filters) ? formData.adhoc_filters : []),
    ...(Array.isArray(formData.adhoc_filters_b)
      ? formData.adhoc_filters_b
      : []),
  ].filter(filter => filter?.operator === 'TEMPORAL_RANGE');
  return (
    temporal.length > 0 && temporal.every(filter => filter.subject === xAxis)
  );
}

export interface TimeGrainSwitchState {
  /** The grains the switch shows, shortest first; empty when the chart has no switch. */
  options: string[];
  /** The periods each option shows when chosen, for those whose periods apply. */
  periods: Record<string, number>;
  /** The grain the chart shows without a viewer choice. */
  defaultGrain?: string;
  /** The viewer's choice, when it is one of `options` and differs from the default. */
  selectedGrain?: string;
  /** The grain the chart is shown in. */
  activeGrain?: string;
  /** The time range applied for the selected grain, if its periods are configured. */
  window?: string;
  /** Whether a dashboard filter's time range takes precedence over the grain's periods. */
  windowFromFilter: boolean;
}

export interface TimeGrainSwitchResult {
  state: TimeGrainSwitchState;
  formData: JsonObject;
}

/**
 * Apply a viewer's time grain choice to a chart's dashboard form data (the
 * output of `getFormDataWithExtraFilters`).
 *
 * - The grain the viewer picked wins over the saved grain and over a
 *   dashboard time grain filter. A chart without a grain of its own has no
 *   default to go back to, and shows no switch.
 * - If periods are configured for that grain, the chart shows that many
 *   periods through its time range filter on the x-axis, unless a dashboard
 *   filter applies a time range to the chart, which keeps precedence. A chart
 *   without such a filter keeps its own window.
 * - The chart's resampling, which is tied to its saved grain, is dropped.
 * - Without a valid choice the form data is returned unchanged.
 */
export function applyTimeGrainSwitch(
  formData: JsonObject,
  selected: unknown,
  now: Date = new Date(),
): TimeGrainSwitchResult {
  const extraFormData: JsonObject = formData.extra_form_data || {};
  const defaultGrain: string | undefined =
    extraFormData.time_grain_sqla ?? formData.time_grain_sqla ?? undefined;
  const configured = getTimeGrainOptions(formData);
  const windowFromFilter = extraFormData.time_range !== undefined;

  if (configured.length === 0 || !defaultGrain) {
    return {
      state: {
        options: [],
        periods: {},
        defaultGrain,
        activeGrain: defaultGrain,
        windowFromFilter,
      },
      formData,
    };
  }

  const options = [...new Set([...configured, defaultGrain])].sort(
    (a, b) => timeGrainSortKey(a) - timeGrainSortKey(b),
  );
  const windowApplies = !windowFromFilter && hasXAxisTimeRangeFilter(formData);
  const periods: Record<string, number> = {};
  if (windowApplies) {
    options.forEach(option => {
      const value = getTimeGrainPeriods(formData, option);
      if (
        value !== undefined &&
        option !== defaultGrain &&
        getTimeGrainWindow(option, value, now)
      ) {
        periods[option] = value;
      }
    });
  }
  const selectedGrain =
    typeof selected === 'string' &&
    selected !== defaultGrain &&
    configured.includes(selected)
      ? selected
      : undefined;

  if (!selectedGrain) {
    return {
      state: {
        options,
        periods,
        defaultGrain,
        activeGrain: defaultGrain,
        windowFromFilter,
      },
      formData,
    };
  }

  const selectedPeriods = periods[selectedGrain];
  const window =
    selectedPeriods !== undefined
      ? getTimeGrainWindow(selectedGrain, selectedPeriods, now)
      : undefined;

  const xAxis = formData.x_axis;
  const nextFormData: JsonObject = {
    ...formData,
    time_grain_sqla: selectedGrain,
    extra_form_data: {
      ...extraFormData,
      time_grain_sqla: selectedGrain,
      ...(window && { time_range: window }),
    },
    ...(window && {
      [TIME_GRAIN_WINDOW_KEY]: {
        grain: selectedGrain,
        periods: selectedPeriods,
      },
    }),
    resample_rule: null,
    resample_method: null,
    // An adhoc x-axis column that carries its own grain would keep it.
    ...(xAxis &&
      typeof xAxis === 'object' &&
      'timeGrain' in xAxis && {
        x_axis: { ...xAxis, timeGrain: selectedGrain },
      }),
  };

  return {
    state: {
      options,
      periods,
      defaultGrain,
      selectedGrain,
      activeGrain: selectedGrain,
      window,
      windowFromFilter,
    },
    formData: nextFormData,
  };
}
