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
import { t } from '@apache-superset/core/translation';
import { ensureAppRoot } from 'src/utils/pathUtils';
import { findPermission } from 'src/utils/findPermission';
import { MenuObjectProps, UserRoles } from 'src/types/bootstrapTypes';
import { uniqueByHref } from './search';
import { CommandPaletteItem, CommandPaletteItemKind } from './types';

export const HOME_ROUTE = '/superset/welcome/';

type IsFrontendRoute = (path?: string) => boolean;

interface PageItemsOptions {
  /** The main navigation's entries. */
  menu?: MenuObjectProps[];
  /** The sections of the Settings menu. */
  settings?: MenuObjectProps[];
  isFrontendRoute: IsFrontendRoute;
}

interface CreateItemsOptions {
  isFrontendRoute: IsFrontendRoute;
  roles?: UserRoles | null;
  /** Offers nothing: the user is somewhere that only reads. */
  readOnly?: boolean;
}

interface LinkOptions {
  kind: CommandPaletteItemKind;
  title: string;
  subtitle?: string;
  url: string;
  isFrontendRoute: IsFrontendRoute;
  /** The menu's own URLs are used as they come; ours get the app root. */
  fromMenu?: boolean;
}

function toItem({
  kind,
  title,
  subtitle,
  url,
  isFrontendRoute,
  fromMenu = false,
}: LinkOptions): CommandPaletteItem {
  const inApp = isFrontendRoute(url);
  return {
    key: `${kind}:${url}`,
    kind,
    title,
    subtitle,
    href: inApp || !fromMenu ? ensureAppRoot(url) : url,
    route: inApp ? url : undefined,
  };
}

function menuItems(
  entries: MenuObjectProps[],
  isFrontendRoute: IsFrontendRoute,
): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = [];
  entries.forEach(entry => {
    if (!entry) {
      return;
    }
    if (entry.url) {
      items.push(
        toItem({
          kind: 'page',
          title: entry.label,
          url: entry.url,
          isFrontendRoute,
          fromMenu: true,
        }),
      );
    }
    entry.childs?.forEach(child => {
      if (typeof child !== 'string' && child.label && child.url) {
        items.push(
          toItem({
            kind: 'page',
            title: child.label,
            subtitle: entry.label,
            url: child.url,
            isFrontendRoute,
            fromMenu: true,
          }),
        );
      }
    });
  });
  return items;
}

/**
 * The pages a user can open from the navigation bar: the home page, the main
 * navigation's entries and the Settings menu's.
 */
export function buildPageItems({
  menu = [],
  settings = [],
  isFrontendRoute,
}: PageItemsOptions): CommandPaletteItem[] {
  const items = [
    toItem({
      kind: 'page',
      title: t('Home'),
      url: HOME_ROUTE,
      isFrontendRoute,
    }),
    ...menuItems(menu, isFrontendRoute),
    ...menuItems(settings, isFrontendRoute),
  ];
  return uniqueByHref(items);
}

/** What the navigation bar's "+" menu creates, for those who may. */
export function buildCreateItems({
  isFrontendRoute,
  roles,
  readOnly = false,
}: CreateItemsOptions): CommandPaletteItem[] {
  if (readOnly) {
    return [];
  }
  const subtitle = t('Create');
  const candidates = [
    {
      title: t('Dashboard'),
      url: '/dashboard/new',
      allowed: findPermission('can_write', 'Dashboard', roles),
    },
    {
      title: t('Chart'),
      url: '/chart/add',
      allowed: findPermission('can_write', 'Chart', roles),
    },
    {
      title: t('SQL query'),
      url: '/sqllab?new=true',
      allowed: findPermission('can_sqllab', 'Superset', roles),
    },
  ];
  return candidates
    .filter(({ allowed }) => allowed)
    .map(({ title, url }) =>
      toItem({ kind: 'create', title, subtitle, url, isFrontendRoute }),
    );
}
