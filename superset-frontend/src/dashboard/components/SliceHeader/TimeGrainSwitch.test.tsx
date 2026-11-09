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
import { Router } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import type { TimeGrainSwitchState } from '@superset-ui/chart-controls';
import {
  createStore,
  render,
  screen,
  userEvent,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import TimeGrainSwitch, {
  describePeriods,
  formatQueryRange,
} from './TimeGrainSwitch';

type DataMaskState = Record<number, { ownState?: Record<string, unknown> }>;
const dataMaskOf = (store: { getState: () => unknown }) =>
  (store.getState() as { dataMask: DataMaskState }).dataMask;

const CHART_ID = 279;
const DATASOURCE = '215__table';

const switchState: TimeGrainSwitchState = {
  options: ['P1D', 'P1W', 'P2W', 'P1M'],
  periods: { P1W: 12, P2W: 13, P1M: 12 },
  defaultGrain: 'P1D',
  activeGrain: 'P1D',
  windowFromFilter: false,
};

function setup({
  state = switchState,
  width = 800,
  search = '?native_filters_key=abc',
  ownState = { currentPage: 2 },
  response = {
    from_dttm: Date.UTC(2026, 9, 10),
    to_dttm: Date.UTC(2026, 10, 9, 12),
  },
}: {
  state?: TimeGrainSwitchState;
  width?: number;
  search?: string;
  ownState?: Record<string, unknown>;
  response?: Record<string, unknown>;
} = {}) {
  const history = createMemoryHistory({
    initialEntries: [`/superset/dashboard/18/${search}`],
  });
  const store = createStore(
    {
      datasources: {
        [DATASOURCE]: {
          time_grain_sqla: [
            ['P1D', 'Day'],
            ['P1W', 'Week'],
            ['P2W', '2 weeks'],
            ['P1M', 'Month'],
          ],
        },
      },
      charts: { [CHART_ID]: { id: CHART_ID, queriesResponse: [response] } },
      dataMask: { [CHART_ID]: { id: CHART_ID, ownState } },
    },
    reducerIndex,
  );
  render(
    <Router history={history}>
      <TimeGrainSwitch
        chartId={CHART_ID}
        datasource={DATASOURCE}
        state={state}
        width={width}
      />
    </Router>,
    { store },
  );
  return { history, store };
}

test('renders nothing without at least two grains to switch between', () => {
  setup({ state: { ...switchState, options: ['P1D'] } });
  expect(screen.queryByTestId('time-grain-switch')).not.toBeInTheDocument();
});

test('renders a button per grain, the active one checked', () => {
  setup();
  const group = screen.getByRole('radiogroup', { name: 'Time grain' });
  expect(group).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Day · default' })).toBeChecked();
  expect(
    screen.getByRole('radio', { name: 'Week · last 12 weeks' }),
  ).not.toBeChecked();
  expect(
    screen.getByRole('radio', { name: '2 weeks · last 26 weeks' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('radio', { name: 'Month · last 12 months' }),
  ).toBeInTheDocument();
  expect(screen.getByText('2W')).toBeInTheDocument();
});

test('picking a grain stores it in the chart own state and the URL', async () => {
  const { history, store } = setup();
  await userEvent.click(screen.getByText('W'));
  expect(dataMaskOf(store)[CHART_ID].ownState).toEqual({
    currentPage: 2,
    selectedTimeGrain: 'P1W',
  });
  const params = new URLSearchParams(history.location.search);
  expect(params.get('chart_time_grains')).toBe('279:P1W');
  expect(params.get('native_filters_key')).toBe('abc');
});

test('picking the default grain clears the choice', async () => {
  const { history, store } = setup({
    state: { ...switchState, selectedGrain: 'P1W', activeGrain: 'P1W' },
    search: '?chart_time_grains=279:P1W,280:P1M',
    ownState: { selectedTimeGrain: 'P1W' },
  });
  await userEvent.click(screen.getByText('D'));
  expect(dataMaskOf(store)[CHART_ID].ownState).toEqual({});
  expect(
    new URLSearchParams(history.location.search).get('chart_time_grains'),
  ).toBe('280:P1M');
});

test('shows the dates the chart covers when there is room', () => {
  setup();
  expect(screen.getByTestId('time-grain-switch-range')).toHaveTextContent(
    formatQueryRange(
      Date.UTC(2026, 9, 10),
      Date.UTC(2026, 10, 9, 12),
    ) as string,
  );
});

test('shows a dropdown instead of buttons on a narrow chart', () => {
  setup({ width: 260 });
  expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  expect(
    screen.getByRole('combobox', { name: 'Time grain' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByTestId('time-grain-switch-range'),
  ).not.toBeInTheDocument();
});

test('does not promise periods when a dashboard filter sets the time range', () => {
  setup({ state: { ...switchState, windowFromFilter: true } });
  expect(screen.getByRole('radio', { name: 'Week' })).toBeInTheDocument();
});

test('describePeriods names the span the periods cover', () => {
  expect(describePeriods('P1D', 30)).toBe('last 30 days');
  expect(describePeriods('P1W', 1)).toBe('last 1 week');
  expect(describePeriods('P2W', 13)).toBe('last 26 weeks');
  expect(describePeriods('P3M', 8)).toBe('last 8 quarters');
  expect(describePeriods('P1Y', 2)).toBe('last 2 years');
  expect(describePeriods('1969-12-28T00:00:00Z/P1W', 4)).toBe('last 4 periods');
});

test('formatQueryRange falls back to the browser locale for an unknown tag', () => {
  expect(
    formatQueryRange(
      Date.UTC(2026, 7, 18),
      Date.UTC(2026, 10, 9),
      undefined,
      'not a locale!',
    ),
  ).toBeDefined();
});

test('formatQueryRange shows the covered days, an exclusive midnight end excluded', () => {
  const now = new Date('2026-11-09T12:00:00Z');
  const sameYear = formatQueryRange(
    Date.UTC(2026, 7, 18),
    Date.UTC(2026, 10, 9),
    now,
    'en',
  );
  const otherYear = formatQueryRange(
    Date.UTC(2025, 10, 1),
    Date.UTC(2026, 10, 9, 8),
    now,
    'en',
  );
  const format = (date: number, withYear: boolean) =>
    new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      ...(withYear && { year: 'numeric' }),
      timeZone: 'UTC',
    }).format(date);
  expect(sameYear).toBe(
    `${format(Date.UTC(2026, 7, 18), false)} – ${format(Date.UTC(2026, 10, 8), false)}`,
  );
  expect(otherYear).toBe(
    `${format(Date.UTC(2025, 10, 1), true)} – ${format(Date.UTC(2026, 10, 9), true)}`,
  );
  expect(formatQueryRange(null, Date.UTC(2026, 10, 9), now)).toBeUndefined();
  expect(
    formatQueryRange(Date.UTC(2026, 10, 9), Date.UTC(2026, 10, 9), now),
  ).toBeUndefined();
});
