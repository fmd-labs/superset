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
import { omit } from 'lodash';
import type { Dispatch } from 'redux';
import type { JsonObject } from '@superset-ui/core';
import { SELECTED_TIME_GRAIN_KEY } from '@superset-ui/chart-controls';
import { updateDataMask } from 'src/dataMask/actions';
import { parseChartTimeGrains } from 'src/dashboard/util/charts/timeGrainSwitchUrl';
import type { RootState } from 'src/dashboard/types';

/**
 * Set or clear a viewer's time grain choice for a chart. It lives in the
 * chart's own state on the dashboard, so the dashboard re-runs that chart
 * alone; the rest of its own state is kept.
 */
export function setChartTimeGrain(chartId: number, grain: string | undefined) {
  return (dispatch: Dispatch, getState: () => RootState) => {
    const ownState: JsonObject = getState().dataMask[chartId]?.ownState ?? {};
    if (ownState[SELECTED_TIME_GRAIN_KEY] === grain) {
      return;
    }
    const rest = omit(ownState, SELECTED_TIME_GRAIN_KEY);
    dispatch(
      updateDataMask(chartId, {
        ownState: grain ? { ...rest, [SELECTED_TIME_GRAIN_KEY]: grain } : rest,
      }),
    );
  };
}

/**
 * Apply the time grain choices kept in the dashboard URL. Called right after
 * the dashboard is hydrated, before its charts first query, so that a reload
 * or a permalink shows the chosen grains without querying the default first.
 */
export function restoreChartTimeGrains(search: string) {
  return (dispatch: Dispatch, getState: () => RootState) => {
    Object.entries(parseChartTimeGrains(search)).forEach(([chartId, grain]) => {
      setChartTimeGrain(Number(chartId), grain)(dispatch, getState);
    });
  };
}
