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
import { configureStore } from '@reduxjs/toolkit';
import fetchMock from 'fetch-mock';
import rison from 'rison';
import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import { MenuObjectProps } from 'src/types/bootstrapTypes';
import { detectOS } from 'src/utils/common';
import CommandPaletteTrigger from '.';

jest.mock('src/utils/common', () => ({
  ...jest.requireActual('src/utils/common'),
  detectOS: jest.fn(() => 'Windows'),
}));
const mockDetectOS = detectOS as jest.MockedFunction<typeof detectOS>;

const RECENT = 'glob:*/api/v1/log/recent_activity/*';
const DASHBOARDS = 'glob:*/api/v1/dashboard/*';
const CHARTS = 'glob:*/api/v1/chart/*';
const SAVED_QUERIES = 'glob:*/api/v1/saved_query/*';

const frontendRoutes = new Set(['/superset/welcome/', '/dashboard/list/']);
const isFrontendRoute = (path?: string) => !!path && frontendRoutes.has(path);

const menu: MenuObjectProps[] = [
  { label: 'Dashboards', url: '/dashboard/list/' },
  { label: 'SQL', childs: [{ label: 'SQL Lab', url: '/sqllab/' }] },
];
const settings: MenuObjectProps[] = [
  { label: 'Security', childs: [{ label: 'List Users', url: '/users/' }] },
];

const allRoles = {
  Admin: [
    ['can_read', 'Dashboard'],
    ['can_read', 'Chart'],
    ['can_read', 'SavedQuery'],
    ['can_write', 'Dashboard'],
  ],
};

const dashboard = (id: number, title: string, slug?: string) => ({
  id,
  dashboard_title: title,
  slug,
  url: `/superset/dashboard/${slug ?? id}/`,
});

function mockApi({
  dashboards = [
    dashboard(1, 'Financials', 'financials'),
    dashboard(2, 'Onboarding'),
    dashboard(3, 'Retention & Churn', 'retention'),
  ],
  dashboardCount,
}: {
  dashboards?: ReturnType<typeof dashboard>[];
  dashboardCount?: number;
} = {}) {
  fetchMock.get(RECENT, {
    result: [
      {
        item_type: 'dashboard',
        item_url: '/superset/dashboard/retention/',
        item_title: 'Retention & Churn',
      },
      {
        item_type: 'slice',
        item_url: '/explore/?slice_id=9&form_data=%7B%22slice_id%22%3A9%7D',
        item_title: 'Onboarding Funnel',
      },
      { item_type: 'slice', item_url: null, item_title: 'Deleted chart' },
    ],
  });
  fetchMock.get(DASHBOARDS, {
    count: dashboardCount ?? dashboards.length,
    result: dashboards,
  });
  fetchMock.get(CHARTS, {
    count: 1,
    result: [
      { id: 9, slice_name: 'Onboarding Funnel', url: '/explore/?slice_id=9' },
    ],
  });
  fetchMock.get(SAVED_QUERIES, {
    count: 1,
    result: [
      {
        id: 4,
        label: 'Onboarding cohort',
        database: { database_name: 'Prod' },
      },
    ],
  });
}

function setup(roles: Record<string, string[][]> = allRoles) {
  const store = configureStore({
    reducer: () => ({ user: { roles } }),
  });
  return render(
    <CommandPaletteTrigger
      menu={menu}
      settings={settings}
      isFrontendRoute={isFrontendRoute}
    />,
    { useRouter: true, useTheme: true, store },
  );
}

const openWithButton = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  return screen.findByRole('combobox', { name: 'Search' });
};

const optionTitles = () =>
  screen.getAllByRole('option').map(option => option.textContent);

const group = (name: string) => screen.getByRole('group', { name });

const selected = () => screen.getByRole('option', { selected: true });

const queryOf = (url: string) =>
  rison.decode(new URL(url, 'http://localhost').searchParams.get('q')!) as {
    filters?: { col: string; opr: string; value: string }[];
    page_size: number;
    select_columns: string[];
  };

beforeEach(() => {
  window.history.pushState({}, '', '/');
  mockDetectOS.mockReturnValue('Windows');
});

afterEach(() => {
  fetchMock.clearHistory().removeRoutes();
});

test('the search button opens the palette with recent items, dashboards and pages', async () => {
  mockApi();
  setup();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();

  const input = await openWithButton();
  await waitFor(() => expect(input).toHaveFocus());
  await waitFor(() =>
    expect(
      within(group('Recent'))
        .getAllByRole('option')
        .map(option => option.textContent),
    ).toEqual(['Retention & Churn↵', 'Onboarding Funnel↵']),
  );
  // A recent dashboard is not listed a second time.
  expect(
    within(group('Dashboards'))
      .getAllByRole('option')
      .map(option => option.textContent),
  ).toEqual(['Financials↵', 'Onboarding↵']);
  expect(group('Pages')).toHaveTextContent('Home');
  expect(group('Pages')).toHaveTextContent('List UsersSecurity');
  expect(
    screen.queryByRole('group', { name: 'Charts' }),
  ).not.toBeInTheDocument();
});

test('the keyboard shortcut opens and closes the palette', async () => {
  mockApi();
  setup();
  fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
  expect(await screen.findByRole('combobox')).toBeInTheDocument();

  fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
  await waitFor(() =>
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument(),
  );
});

test('the shortcut is left to whatever handled the key first', () => {
  mockApi();
  setup();
  const stop = (event: KeyboardEvent) => event.preventDefault();
  document.body.addEventListener('keydown', stop);
  fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
  document.body.removeEventListener('keydown', stop);
  fireEvent.keyDown(document.body, { key: 'k' });
  fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, shiftKey: true });
  fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, repeat: true });
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

test('on macOS the shortcut is Cmd+K, and Ctrl+K is left alone', async () => {
  mockDetectOS.mockReturnValue('MacOS');
  mockApi();
  setup();
  fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.keyDown(document.body, { key: 'k', metaKey: true });
  expect(await screen.findByRole('combobox')).toBeInTheDocument();
});

test('the shortcut works by the physical key on layouts without a Latin K', async () => {
  mockApi();
  setup();
  fireEvent.keyDown(document.body, { key: 'л', code: 'KeyK', ctrlKey: true });
  expect(await screen.findByRole('combobox')).toBeInTheDocument();
});

test('typing searches dashboards, charts, saved queries, pages and what to create', async () => {
  mockApi();
  setup();
  const input = await openWithButton();
  await screen.findByRole('group', { name: 'Dashboards' });

  await userEvent.type(input, 'onb');
  expect(optionTitles()).toEqual([
    'Onboarding↵',
    'Onboarding Funnel↵',
    'Onboarding cohortProd↵',
  ]);
  // The recent chart and the listed one are the same chart, shown once.
  expect(within(group('Charts')).getAllByRole('option')).toHaveLength(1);
  expect(group('Saved queries')).toHaveTextContent('Onboarding cohort');

  await userEvent.clear(input);
  await userEvent.type(input, 'dash');
  expect(group('Pages')).toHaveTextContent('Dashboards');
  expect(group('Create')).toHaveTextContent('DashboardCreate');

  await userEvent.clear(input);
  await userEvent.type(input, 'zzz');
  expect(screen.queryByRole('option')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('No results');
});

test('the arrow keys move the selection and Enter opens it in the app', async () => {
  mockApi();
  setup();
  const input = await openWithButton();
  await screen.findByRole('group', { name: 'Dashboards' });

  expect(selected()).toHaveTextContent('Retention & Churn');
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(selected()).toHaveTextContent('Financials');
  expect(input).toHaveAttribute('aria-activedescendant', selected().id);
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  fireEvent.keyDown(input, { key: 'ArrowUp' });
  expect(selected()).toHaveTextContent('List Users');
  ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter'].forEach(key =>
    fireEvent.keyDown(input, { key }),
  );

  expect(window.location.pathname).toBe('/superset/dashboard/2/');
  await waitFor(() =>
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument(),
  );
});

test('a click opens an item, and the palette starts empty the next time', async () => {
  mockApi();
  setup();
  const input = await openWithButton();
  await userEvent.type(input, 'fin');
  await userEvent.click(
    await screen.findByRole('option', { name: /Financials/ }),
  );
  expect(window.location.pathname).toBe('/superset/dashboard/financials/');

  expect(await openWithButton()).toHaveValue('');
});

test('after a jump, the dashboard left behind is first and the one on screen is gone', async () => {
  mockApi();
  window.history.pushState({}, '', '/superset/dashboard/2/');
  setup();
  const input = await openWithButton();
  await userEvent.type(input, 'fin');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(window.location.pathname).toBe('/superset/dashboard/financials/');

  await openWithButton();
  await waitFor(() =>
    expect(selected()).toHaveTextContent('Retention & Churn'),
  );
  expect(screen.queryByRole('option', { name: /Financials/ })).toBeNull();
});

test('Enter with the modifier key opens the item in a new tab', async () => {
  mockApi();
  const open = jest.spyOn(window, 'open').mockImplementation(() => null);
  setup();
  const input = await openWithButton();
  await userEvent.type(input, 'fin');
  await screen.findByRole('option', { name: /Financials/ });
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

  expect(open).toHaveBeenCalledWith(
    '/superset/dashboard/financials/',
    '_blank',
    'noopener,noreferrer',
  );
  expect(window.location.pathname).toBe('/');
  open.mockRestore();
});

test('the dashboard on screen is offered nowhere, by slug or by id', async () => {
  mockApi();
  window.history.pushState({}, '', '/superset/dashboard/3/');
  setup();
  const input = await openWithButton();
  await screen.findByRole('group', { name: 'Dashboards' });
  expect(group('Recent')).not.toHaveTextContent('Retention');
  expect(group('Dashboards')).not.toHaveTextContent('Retention');
  await userEvent.type(input, 'ret');
  expect(screen.queryByRole('option', { name: /Retention/ })).toBeNull();
});

test('a list longer than what loads is searched on the server', async () => {
  mockApi({
    dashboards: [dashboard(1, 'Financials', 'financials')],
    dashboardCount: 250,
  });
  setup();
  const input = await openWithButton();
  await screen.findByRole('group', { name: 'Dashboards' });
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(DASHBOARDS, {
    count: 1,
    result: [dashboard(77, 'Web Analytics')],
  });

  await userEvent.type(input, 'web an&');
  expect(screen.getByRole('status')).toHaveTextContent('Searching');
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DASHBOARDS)).toHaveLength(1),
  );

  // One filter per word, each sent whole although it holds "&".
  const calls = fetchMock.callHistory.calls(DASHBOARDS);
  expect(queryOf(calls[0].url).filters).toEqual([
    { col: 'dashboard_title', opr: 'title_or_slug', value: 'web' },
    { col: 'dashboard_title', opr: 'title_or_slug', value: 'an&' },
  ]);
  await userEvent.clear(input);
  await userEvent.type(input, 'web');
  expect(
    await screen.findByRole('option', { name: /Web Analytics/ }),
  ).toBeInTheDocument();
  // Charts and saved queries loaded whole, so they need no request.
  expect(fetchMock.callHistory.calls(CHARTS)).toHaveLength(0);
  expect(fetchMock.callHistory.calls(SAVED_QUERIES)).toHaveLength(0);
});

test('only the lists the user may read are loaded', async () => {
  mockApi();
  setup({ Gamma: [['can_read', 'Dashboard']] });
  const input = await openWithButton();
  await screen.findByRole('group', { name: 'Dashboards' });
  await userEvent.type(input, 'onb');

  expect(optionTitles()).toEqual(['Onboarding↵']);
  expect(fetchMock.callHistory.calls(DASHBOARDS)).toHaveLength(1);
  expect(queryOf(fetchMock.callHistory.calls(DASHBOARDS)[0].url)).toEqual(
    expect.objectContaining({
      page_size: 100,
      select_columns: ['id', 'dashboard_title', 'slug', 'url'],
    }),
  );
  expect(fetchMock.callHistory.calls(CHARTS)).toHaveLength(0);
  expect(fetchMock.callHistory.calls(SAVED_QUERIES)).toHaveLength(0);
});

test('reopening within a minute does not load the lists again', async () => {
  mockApi();
  setup();
  const input = await openWithButton();
  await screen.findByRole('group', { name: 'Dashboards' });
  fireEvent.keyDown(input, { key: 'Escape', keyCode: 27 });
  await waitFor(() =>
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument(),
  );

  await openWithButton();
  expect(screen.getByRole('group', { name: 'Dashboards' })).toBeInTheDocument();
  expect(fetchMock.callHistory.calls(DASHBOARDS)).toHaveLength(1);
  expect(fetchMock.callHistory.calls(RECENT)).toHaveLength(1);
});

test('a failing list leaves the others and the pages usable', async () => {
  fetchMock.get(RECENT, 500);
  fetchMock.get(DASHBOARDS, 500);
  fetchMock.get(CHARTS, {
    count: 1,
    result: [
      { id: 9, slice_name: 'Onboarding Funnel', url: '/explore/?slice_id=9' },
    ],
  });
  fetchMock.get(SAVED_QUERIES, { count: 0, result: [] });
  setup();
  const input = await openWithButton();
  expect(
    await screen.findByRole('group', { name: 'Pages' }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(CHARTS)).toHaveLength(1),
  );
  await userEvent.type(input, 'onb');
  expect(
    await screen.findByRole('option', { name: /Onboarding Funnel/ }),
  ).toBeInTheDocument();
});

test('a list that failed to load is searched on the server', async () => {
  fetchMock.get(RECENT, { result: [] });
  fetchMock.get(DASHBOARDS, 500);
  fetchMock.get(CHARTS, { count: 0, result: [] });
  fetchMock.get(SAVED_QUERIES, { count: 0, result: [] });
  setup();
  const input = await openWithButton();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(DASHBOARDS)).toHaveLength(1),
  );
  fetchMock.clearHistory().removeRoutes();
  fetchMock.get(DASHBOARDS, {
    count: 1,
    result: [dashboard(5, 'Outbound', 'outbound')],
  });

  await userEvent.type(input, 'outb');
  expect(
    await screen.findByRole('option', { name: /Outbound/ }),
  ).toBeInTheDocument();
});

test('charts load with the datasource columns and are searched without a selection', async () => {
  mockApi();
  fetchMock.removeRoutes();
  fetchMock.get(RECENT, { result: [] });
  fetchMock.get(DASHBOARDS, { count: 0, result: [] });
  fetchMock.get(SAVED_QUERIES, { count: 0, result: [] });
  fetchMock.get(CHARTS, {
    count: 600,
    result: [
      { id: 9, slice_name: 'Onboarding Funnel', url: '/explore/?slice_id=9' },
    ],
  });
  setup();
  const input = await openWithButton();
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(CHARTS)).toHaveLength(1),
  );
  expect(
    queryOf(fetchMock.callHistory.calls(CHARTS)[0].url).select_columns,
  ).toEqual(['id', 'slice_name', 'url', 'datasource_id', 'datasource_type']);

  await userEvent.type(input, 'payout');
  await waitFor(() =>
    expect(fetchMock.callHistory.calls(CHARTS)).toHaveLength(2),
  );
  const search = queryOf(fetchMock.callHistory.calls(CHARTS)[1].url);
  expect(search.select_columns).toBeUndefined();
  expect(search.filters).toEqual([
    { col: 'slice_name', opr: 'chart_all_text', value: 'payout' },
  ]);
});
