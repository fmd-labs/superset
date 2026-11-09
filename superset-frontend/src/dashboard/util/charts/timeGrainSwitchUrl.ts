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
import { applicationRoot } from 'src/utils/getBootstrapData';

/** The part of the router's history (`useHistory()`) this module uses. */
export interface RouterHistory {
  location: { search: string };
  replace: (location: {
    pathname: string;
    search: string;
    hash?: string;
  }) => void;
}

/**
 * Dashboard URL parameter that keeps viewers' time grain choices, so that a
 * reload, a permalink (which keeps the dashboard's URL parameters) or a
 * shared URL shows the same grains: `chart_time_grains=279:P1W,280:P1M`.
 */
export const CHART_TIME_GRAINS_PARAM = 'chart_time_grains';

const CHART_ID = /^[1-9]\d*$/;
// ISO 8601 durations, optionally anchored (`1969-12-28T00:00:00Z/P1W`).
const GRAIN = /^[0-9A-Za-z:/.+-]{1,64}$/;

/** The time grain choices in a URL query string, by chart id. */
export function parseChartTimeGrains(search: string): Record<number, string> {
  const value = new URLSearchParams(search).get(CHART_TIME_GRAINS_PARAM);
  const grains: Record<number, string> = {};
  if (!value) {
    return grains;
  }
  value.split(',').forEach(entry => {
    const separator = entry.indexOf(':');
    if (separator < 1) {
      return;
    }
    const chartId = entry.slice(0, separator);
    const grain = entry.slice(separator + 1);
    if (CHART_ID.test(chartId) && GRAIN.test(grain) && !grain.includes(',')) {
      grains[Number(chartId)] = grain;
    }
  });
  return grains;
}

/**
 * The query string `search` with the choice for `chartId` set to `grain`, or
 * removed when `grain` is undefined. Other parameters keep their order.
 */
export function withChartTimeGrain(
  search: string,
  chartId: number,
  grain: string | undefined,
): string {
  const params = new URLSearchParams(search);
  const grains = parseChartTimeGrains(search);
  if (grain && GRAIN.test(grain)) {
    grains[chartId] = grain;
  } else {
    delete grains[chartId];
  }
  const value = Object.entries(grains)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([id, value]) => `${id}:${value}`)
    .join(',');
  if (value) {
    params.set(CHART_TIME_GRAINS_PARAM, value);
  } else {
    params.delete(CHART_TIME_GRAINS_PARAM);
  }
  return params.toString();
}

/**
 * Record a chart's time grain choice in the dashboard URL without adding a
 * history entry. It goes through the router's history, as the native filter
 * bar does, so that both keep each other's parameters.
 */
export function replaceChartTimeGrainInUrl(
  history: RouterHistory,
  chartId: number,
  grain: string | undefined,
): void {
  const { search } = history.location;
  const nextSearch = withChartTimeGrain(search, chartId, grain);
  if (nextSearch === new URLSearchParams(search).toString()) {
    return;
  }
  // The router adds the application root back to the path.
  const appRoot = applicationRoot();
  let { pathname } = window.location;
  if (appRoot !== '/' && pathname.startsWith(appRoot)) {
    pathname = pathname.substring(appRoot.length);
  }
  history.replace({ pathname, search: nextSearch, hash: window.location.hash });
}
