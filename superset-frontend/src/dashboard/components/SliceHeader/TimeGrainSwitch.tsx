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
import { useCallback, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useHistory } from 'react-router-dom';
import { t, tn } from '@apache-superset/core/translation';
import { css, SupersetTheme } from '@apache-superset/core/theme';
import {
  parseTimeGrainDuration,
  shortTimeGrainLabel,
  TimeGrainSwitchState,
} from '@superset-ui/chart-controls';
import { Radio, RawAntdSelect, Tooltip } from '@superset-ui/core/components';
import { setChartTimeGrain } from 'src/dashboard/actions/chartTimeGrains';
import { replaceChartTimeGrainInUrl } from 'src/dashboard/util/charts/timeGrainSwitchUrl';
import { logEvent } from 'src/logger/actions';
import getBootstrapData from 'src/utils/getBootstrapData';
import { LOG_ACTIONS_CHANGE_CHART_TIME_GRAIN } from 'src/logger/LogUtils';
import type { RootState } from 'src/dashboard/types';

export interface TimeGrainSwitchProps {
  chartId: number;
  /** The chart's datasource key (`<id>__<type>`), for the names of its grains. */
  datasource?: string;
  state?: TimeGrainSwitchState;
  /** Width of the chart, to pick a layout that fits. */
  width: number;
}

// Approximate width of a small button: padding plus a character width.
const BUTTON_PADDING = 16;
const CHARACTER_WIDTH = 7;
// Room the chart title keeps before the switch takes a more compact form.
const TITLE_ROOM = 180;
const RANGE_LABEL_WIDTH = 120;

const LAST_UNITS: Record<string, (count: number) => string> = {
  second: count => tn('last %s second', 'last %s seconds', count, count),
  minute: count => tn('last %s minute', 'last %s minutes', count, count),
  hour: count => tn('last %s hour', 'last %s hours', count, count),
  day: count => tn('last %s day', 'last %s days', count, count),
  week: count => tn('last %s week', 'last %s weeks', count, count),
  month: count => tn('last %s month', 'last %s months', count, count),
  year: count => tn('last %s year', 'last %s years', count, count),
};

/** "last 12 weeks", "last 26 weeks" for 13 periods of P2W, "last 8 quarters". */
export function describePeriods(grain: string, periods: number): string {
  const duration = parseTimeGrainDuration(grain);
  if (!duration) {
    return tn('last %s period', 'last %s periods', periods, periods);
  }
  if (duration.unit === 'month' && duration.count === 3) {
    return tn('last %s quarter', 'last %s quarters', periods, periods);
  }
  return LAST_UNITS[duration.unit](duration.count * periods);
}

const DAY_MS = 86400 * 1000;

/** Superset's UI language as a BCP 47 tag (`pt_BR` → `pt-BR`), like its other labels. */
function appLocale(): string | undefined {
  return getBootstrapData().common?.locale?.replace('_', '-');
}

/**
 * The dates a query covered, from its `from_dttm` and (exclusive) `to_dttm`,
 * both naive UTC timestamps: "Aug 18 – Nov 9", with years when they differ
 * from the current one.
 */
export function formatQueryRange(
  from: number | null | undefined,
  to: number | null | undefined,
  now: Date = new Date(),
  locale: string | undefined = appLocale(),
): string | undefined {
  if (typeof from !== 'number' || typeof to !== 'number' || to <= from) {
    return undefined;
  }
  // An exclusive end at midnight belongs to the day before.
  const last = to % DAY_MS === 0 ? to - DAY_MS : to;
  const year = now.getUTCFullYear();
  const showYear =
    new Date(from).getUTCFullYear() !== year ||
    new Date(last).getUTCFullYear() !== year;
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    ...(showYear && { year: 'numeric' }),
    timeZone: 'UTC',
  };
  let format: Intl.DateTimeFormat;
  try {
    format = new Intl.DateTimeFormat(locale, options);
  } catch {
    format = new Intl.DateTimeFormat(undefined, options);
  }
  return `${format.format(from)} – ${format.format(last)}`;
}

/**
 * The switch in a dashboard chart's header that changes the chart's time
 * grain for the viewer (see `time_grain_options`). Segmented buttons when the
 * chart is wide enough, a dropdown otherwise; the dates the chart covers are
 * shown next to it when there is room.
 */
export default function TimeGrainSwitch({
  chartId,
  datasource,
  state,
  width,
}: TimeGrainSwitchProps) {
  const dispatch = useDispatch();
  const history = useHistory();
  const grainNames = useSelector<RootState, [string, string][] | undefined>(
    rootState =>
      (datasource
        ? (
            rootState.datasources[datasource] as {
              time_grain_sqla?: [string, string][];
            }
          )?.time_grain_sqla
        : undefined) ?? undefined,
  );
  const range = useSelector<
    RootState,
    [number | null, number | null] | undefined
  >(rootState => {
    const response = rootState.charts[chartId]?.queriesResponse?.[0] as
      | { from_dttm?: number | null; to_dttm?: number | null }
      | undefined;
    return response
      ? [response.from_dttm ?? null, response.to_dttm ?? null]
      : undefined;
  }, shallowEqual);

  const names = useMemo(() => new Map(grainNames ?? []), [grainNames]);
  const options = state?.options ?? [];
  const activeGrain = state?.activeGrain;

  const onChange = useCallback(
    (grain: string) => {
      if (!state || grain === activeGrain) {
        return;
      }
      const choice = grain === state.defaultGrain ? undefined : grain;
      dispatch(setChartTimeGrain(chartId, choice));
      replaceChartTimeGrainInUrl(history, chartId, choice);
      dispatch(
        logEvent(LOG_ACTIONS_CHANGE_CHART_TIME_GRAIN, {
          slice_id: chartId,
          time_grain: grain,
          is_default: choice === undefined,
        }),
      );
    },
    [activeGrain, chartId, dispatch, history, state],
  );

  if (!state || options.length < 2) {
    return null;
  }

  const nameOf = (grain: string) => names.get(grain) ?? grain;
  const describe = (grain: string) => {
    const parts = [nameOf(grain)];
    if (grain === state.defaultGrain) {
      parts.push(t('default'));
    } else if (state.periods[grain] && !state.windowFromFilter) {
      parts.push(describePeriods(grain, state.periods[grain]));
    }
    return parts.join(' · ');
  };

  // A grain without a compact label (an anchored week) shows its name.
  const labelOf = (grain: string) =>
    parseTimeGrainDuration(grain) ? shortTimeGrainLabel(grain) : nameOf(grain);
  const segmentedWidth = options.reduce(
    (total, grain) =>
      total + BUTTON_PADDING + CHARACTER_WIDTH * labelOf(grain).length,
    0,
  );
  const compact = width < segmentedWidth + TITLE_ROOM;
  const rangeLabel =
    width >= segmentedWidth + TITLE_ROOM + RANGE_LABEL_WIDTH && range
      ? formatQueryRange(range[0], range[1])
      : undefined;

  return (
    <div
      data-test="time-grain-switch"
      css={(theme: SupersetTheme) => css`
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
        margin-right: ${theme.sizeUnit}px;
        font-size: ${theme.fontSizeSM}px;
        font-weight: ${theme.fontWeightNormal};
        white-space: nowrap;
      `}
    >
      {rangeLabel && (
        <span
          data-test="time-grain-switch-range"
          css={(theme: SupersetTheme) => css`
            color: ${theme.colorTextSecondary};
          `}
        >
          {rangeLabel}
        </span>
      )}
      {compact ? (
        <RawAntdSelect
          aria-label={t('Time grain')}
          size="small"
          value={activeGrain}
          onChange={(value: string) => onChange(value)}
          options={options.map(grain => ({
            value: grain,
            label: labelOf(grain),
            title: describe(grain),
          }))}
          popupMatchSelectWidth={false}
          css={css`
            min-width: 64px;
          `}
        />
      ) : (
        <div
          role="radiogroup"
          aria-label={t('Time grain')}
          css={css`
            .ant-radio-button-wrapper {
              padding-inline: 7px;
            }
          `}
        >
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={activeGrain}
            onChange={event => onChange(event.target.value)}
          >
            {options.map(grain => (
              <Tooltip key={grain} title={describe(grain)} placement="top">
                <Radio.Button value={grain} aria-label={describe(grain)}>
                  {labelOf(grain)}
                </Radio.Button>
              </Tooltip>
            ))}
          </Radio.Group>
        </div>
      )}
    </div>
  );
}
