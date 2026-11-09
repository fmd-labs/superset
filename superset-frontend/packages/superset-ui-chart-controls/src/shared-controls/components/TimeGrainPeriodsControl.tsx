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
import { ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, SupersetTheme } from '@apache-superset/core/theme';
import { ensureIsArray } from '@superset-ui/core';
import { InputNumber } from '@superset-ui/core/components';
import { ControlHeader } from '../../components/ControlHeader';
import {
  MAX_TIME_GRAIN_PERIODS,
  parseTimeGrainDuration,
  timeGrainSortKey,
} from '../../utils/timeGrainSwitch';

export type TimeGrainPeriods = Record<string, number>;

export interface TimeGrainPeriodsControlProps {
  name?: string;
  label?: ReactNode;
  description?: ReactNode;
  hovered?: boolean;
  value?: TimeGrainPeriods | null;
  onChange?: (value: TimeGrainPeriods) => void;
  /** The viewer time grains (`time_grain_options`). */
  grains?: string[] | null;
  /** The chart's own time grain, which keeps the chart's time range. */
  defaultGrain?: string | null;
  /** The dataset's time grains, `[duration, name]`, for their names. */
  choices?: [string, string][];
}

export default function TimeGrainPeriodsControl({
  value,
  onChange,
  grains,
  defaultGrain,
  choices = [],
  ...headerProps
}: TimeGrainPeriodsControlProps) {
  const names = new Map(choices);
  const nameOf = (grain: string) => names.get(grain) ?? grain;
  const shown = ensureIsArray(grains)
    .filter((grain): grain is string => typeof grain === 'string')
    .filter(grain => grain !== defaultGrain)
    .sort((a, b) => timeGrainSortKey(a) - timeGrainSortKey(b));
  const current = value ?? {};

  const setPeriods = (grain: string, periods: number | string | null) => {
    const next: TimeGrainPeriods = {};
    // Only grains that are still offered keep their periods.
    shown.forEach(shownGrain => {
      if (shownGrain !== grain && current[shownGrain] !== undefined) {
        next[shownGrain] = current[shownGrain];
      }
    });
    const number = Number(periods);
    if (
      periods !== null &&
      periods !== '' &&
      Number.isInteger(number) &&
      number >= 1
    ) {
      next[grain] = Math.min(number, MAX_TIME_GRAIN_PERIODS);
    }
    onChange?.(next);
  };

  return (
    <div>
      <ControlHeader {...headerProps} />
      {shown.length === 0 ? (
        <div
          css={(theme: SupersetTheme) => css`
            color: ${theme.colorTextSecondary};
            font-size: ${theme.fontSizeSM}px;
          `}
        >
          {t('Add a viewer time grain other than the chart’s own.')}
        </div>
      ) : (
        shown.map(grain => (
          <div
            key={grain}
            css={(theme: SupersetTheme) => css`
              display: flex;
              align-items: center;
              gap: ${theme.sizeUnit * 2}px;
              margin-bottom: ${theme.sizeUnit}px;
            `}
          >
            <span
              css={css`
                flex: 1;
              `}
            >
              {nameOf(grain)}
            </span>
            {parseTimeGrainDuration(grain) ? (
              <InputNumber
                aria-label={t('Periods for %s', nameOf(grain))}
                min={1}
                max={MAX_TIME_GRAIN_PERIODS}
                step={1}
                precision={0}
                placeholder={t('Chart range')}
                value={current[grain] ?? null}
                onChange={periods => setPeriods(grain, periods)}
                css={css`
                  width: 120px;
                `}
              />
            ) : (
              // An anchored or fractional grain has no period window.
              <span
                css={(theme: SupersetTheme) => css`
                  width: 120px;
                  color: ${theme.colorTextSecondary};
                  font-size: ${theme.fontSizeSM}px;
                `}
              >
                {t('Chart range')}
              </span>
            )}
          </div>
        ))
      )}
      {defaultGrain && shown.length > 0 && (
        <div
          css={(theme: SupersetTheme) => css`
            color: ${theme.colorTextSecondary};
            font-size: ${theme.fontSizeSM}px;
          `}
        >
          {t(
            '%s, the chart’s own grain, keeps its time range.',
            nameOf(defaultGrain),
          )}
        </div>
      )}
    </div>
  );
}
