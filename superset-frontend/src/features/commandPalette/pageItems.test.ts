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
import { MenuObjectProps } from 'src/types/bootstrapTypes';
import { buildCreateItems, buildPageItems } from './pageItems';

const frontendRoutes = new Set([
  '/superset/welcome/',
  '/dashboard/list/',
  '/savedqueryview/list/',
  '/chart/add',
]);
const isFrontendRoute = (path?: string) => !!path && frontendRoutes.has(path);

const menu: MenuObjectProps[] = [
  { label: 'Dashboards', url: '/dashboard/list/' },
  {
    label: 'SQL',
    childs: [
      { label: 'SQL Lab', url: '/sqllab/' },
      '-',
      { label: 'Saved Queries', url: '/savedqueryview/list/' },
      { label: 'No address' },
    ],
  },
];

const settings: MenuObjectProps[] = [
  {
    label: 'Security',
    childs: [{ label: 'List Users', url: '/users/' }],
  },
];

test('buildPageItems lists the home page, the navigation and the settings', () => {
  const items = buildPageItems({ menu, settings, isFrontendRoute });
  expect(items.map(({ title, subtitle }) => [title, subtitle])).toEqual([
    ['Home', undefined],
    ['Dashboards', undefined],
    ['SQL Lab', 'SQL'],
    ['Saved Queries', 'SQL'],
    ['List Users', 'Security'],
  ]);
  expect(items.every(({ kind }) => kind === 'page')).toBe(true);
});

test('buildPageItems gives a route only to the pages of the app', () => {
  const items = buildPageItems({ menu, settings, isFrontendRoute });
  const byTitle = Object.fromEntries(items.map(item => [item.title, item]));
  expect(byTitle.Dashboards.route).toBe('/dashboard/list/');
  expect(byTitle.Dashboards.href).toBe('/dashboard/list/');
  expect(byTitle['SQL Lab'].route).toBeUndefined();
  expect(byTitle['SQL Lab'].href).toBe('/sqllab/');
});

test('buildPageItems has no routes outside the single-page app', () => {
  const items = buildPageItems({
    menu,
    settings,
    isFrontendRoute: () => false,
  });
  expect(items.some(({ route }) => route)).toBe(false);
});

test('buildPageItems lists an address once', () => {
  const items = buildPageItems({
    menu: [...menu, { label: 'Welcome', url: '/superset/welcome/' }],
    isFrontendRoute,
  });
  expect(
    items.filter(({ href }) => href === '/superset/welcome/'),
  ).toHaveLength(1);
});

test('buildCreateItems offers only what the user may create', () => {
  const roles = {
    Gamma: [
      ['can_write', 'Chart'],
      ['can_sqllab', 'Superset'],
    ] as [string, string][],
  };
  const items = buildCreateItems({ isFrontendRoute, roles });
  expect(
    items.map(({ title, subtitle, kind }) => [title, subtitle, kind]),
  ).toEqual([
    ['Chart', 'Create', 'create'],
    ['SQL query', 'Create', 'create'],
  ]);
  expect(items[0].route).toBe('/chart/add');
  expect(items[1].route).toBeUndefined();
});

test('buildCreateItems offers nothing without roles or when read-only', () => {
  expect(buildCreateItems({ isFrontendRoute, roles: null })).toEqual([]);
  expect(
    buildCreateItems({
      isFrontendRoute,
      roles: { Admin: [['can_write', 'Dashboard']] },
      readOnly: true,
    }),
  ).toEqual([]);
});
