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
import { createStore } from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { restoreChartTimeGrains, setChartTimeGrain } from './chartTimeGrains';

type DataMaskState = Record<number, { ownState?: Record<string, unknown> }>;
const dataMaskOf = (store: { getState: () => unknown }) =>
  (store.getState() as { dataMask: DataMaskState }).dataMask;

const chart = (id: number, timeGrainOptions?: string[]) => ({
  id,
  form_data: {
    time_grain_sqla: 'P1D',
    ...(timeGrainOptions && { time_grain_options: timeGrainOptions }),
  },
});

const storeWith = (
  dataMask: Record<string, unknown>,
  charts: Record<string, unknown> = {},
) => createStore({ dataMask, charts }, reducerIndex);

test('setChartTimeGrain keeps the rest of the chart own state', () => {
  const store = storeWith({
    279: {
      id: 279,
      ownState: { currentPage: 3 },
      filterState: { value: ['a'] },
      extraFormData: { filters: [] },
    },
  });
  store.dispatch(setChartTimeGrain(279, 'P1W') as any);
  expect(dataMaskOf(store)[279]).toEqual({
    id: 279,
    ownState: { currentPage: 3, selectedTimeGrain: 'P1W' },
    filterState: { value: ['a'] },
    extraFormData: { filters: [] },
  });

  store.dispatch(setChartTimeGrain(279, undefined) as any);
  expect(dataMaskOf(store)[279].ownState).toEqual({ currentPage: 3 });
});

test('setChartTimeGrain creates the data mask of a chart that has none', () => {
  const store = storeWith({});
  store.dispatch(setChartTimeGrain(280, 'P1M') as any);
  expect(dataMaskOf(store)[280].ownState).toEqual({
    selectedTimeGrain: 'P1M',
  });
});

test('setChartTimeGrain does nothing when the choice is unchanged', () => {
  const store = storeWith({
    279: { id: 279, ownState: { selectedTimeGrain: 'P1W' } },
  });
  const before = dataMaskOf(store);
  store.dispatch(setChartTimeGrain(279, 'P1W') as any);
  expect(dataMaskOf(store)).toBe(before);
});

test('restoreChartTimeGrains applies the choices kept in the URL', () => {
  const store = storeWith(
    { 279: { id: 279, ownState: { currentPage: 1 } } },
    { 279: chart(279, ['P1W', 'P1M']), 280: chart(280, ['P3M']) },
  );
  store.dispatch(
    restoreChartTimeGrains('?chart_time_grains=279:P1W,280:P3M&x=1') as any,
  );
  expect(dataMaskOf(store)[279].ownState).toEqual({
    currentPage: 1,
    selectedTimeGrain: 'P1W',
  });
  expect(dataMaskOf(store)[280].ownState).toEqual({
    selectedTimeGrain: 'P3M',
  });
});

test('restoreChartTimeGrains ignores charts not on the dashboard and grains not offered', () => {
  const store = storeWith({}, { 279: chart(279, ['P1W']), 281: chart(281) });
  store.dispatch(
    restoreChartTimeGrains(
      '?chart_time_grains=279:P1M,280:P1W,281:P1W,999999:P1W',
    ) as any,
  );
  expect(dataMaskOf(store)).toEqual({});
});
