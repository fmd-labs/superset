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
import { useCallback, useEffect, useRef, useState } from 'react';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { ensureAppRoot } from 'src/utils/pathUtils';
import {
  CommandPaletteAccess,
  CommandPaletteItem,
  CommandPaletteItemKind,
  CommandPaletteResource,
} from './types';

/** How many of each list load (the API's page limit). */
const PRELOAD_SIZE = 100;
/** How many matches a search of the whole list returns. */
const SEARCH_SIZE = 25;
const RECENT_SIZE = 10;
/** A reopened palette shows what it has, and loads again after this long. */
const STALE_AFTER_MS = 60 * 1000;
const SEARCH_DEBOUNCE_MS = 200;
const MIN_SEARCH_LENGTH = 2;

type Row = Record<string, unknown>;

interface ResourceConfig {
  endpoint: string;
  kind: CommandPaletteItemKind;
  columns: string[];
  /** The column and operator of the list view's own search box. */
  searchColumn: string;
  searchOperator: string;
  title: (row: Row) => unknown;
  subtitle?: (row: Row) => unknown;
  url: (row: Row) => unknown;
  /** Other in-app addresses of the same entry. */
  aliases?: (row: Row) => string[];
}

const RESOURCES: Record<CommandPaletteResource, ResourceConfig> = {
  dashboards: {
    endpoint: '/api/v1/dashboard/',
    kind: 'dashboard',
    // `url` is built from `slug`; selecting both reads them in one query.
    columns: ['id', 'dashboard_title', 'slug', 'url'],
    searchColumn: 'dashboard_title',
    searchOperator: 'title_or_slug',
    title: row => row.dashboard_title,
    url: row => row.url,
    aliases: row => [`/superset/dashboard/${row.id}/`],
  },
  charts: {
    endpoint: '/api/v1/chart/',
    kind: 'chart',
    columns: ['id', 'slice_name', 'url'],
    searchColumn: 'slice_name',
    searchOperator: 'chart_all_text',
    title: row => row.slice_name,
    url: row => row.url,
  },
  savedQueries: {
    endpoint: '/api/v1/saved_query/',
    kind: 'savedQuery',
    columns: ['id', 'label', 'database.database_name'],
    searchColumn: 'label',
    searchOperator: 'all_text',
    title: row => row.label,
    subtitle: row => (row.database as Row | undefined)?.database_name,
    url: row => `/sqllab?savedQueryId=${row.id}`,
  },
};

const RESOURCE_NAMES = Object.keys(RESOURCES) as CommandPaletteResource[];

export interface CommandPaletteData {
  recent: CommandPaletteItem[];
  dashboards: CommandPaletteItem[];
  charts: CommandPaletteItem[];
  savedQueries: CommandPaletteItem[];
}

const EMPTY_DATA: CommandPaletteData = {
  recent: [],
  dashboards: [],
  charts: [],
  savedQueries: [],
};

interface ItemFields {
  kind: CommandPaletteItemKind;
  key: string;
  title: unknown;
  url: unknown;
  inApp: boolean;
  subtitle?: unknown;
  aliases?: string[];
}

function toItem({
  kind,
  key,
  title,
  url,
  inApp,
  subtitle,
  aliases,
}: ItemFields): CommandPaletteItem | undefined {
  if (typeof title !== 'string' || typeof url !== 'string' || !title || !url) {
    return undefined;
  }
  return {
    key,
    kind,
    title,
    subtitle: typeof subtitle === 'string' && subtitle ? subtitle : undefined,
    href: ensureAppRoot(url),
    route: inApp ? url : undefined,
    aliases: inApp ? aliases : undefined,
  };
}

const isItem = (item?: CommandPaletteItem): item is CommandPaletteItem =>
  !!item;

async function fetchResource(
  name: CommandPaletteResource,
  inApp: boolean,
  signal: AbortSignal,
  search?: string,
): Promise<{ items: CommandPaletteItem[]; complete: boolean }> {
  const config = RESOURCES[name];
  // One filter per word, as the palette needs every word: the server ANDs them.
  const words = search?.split(/\s+/).filter(Boolean) ?? [];
  const query = rison.encode_uri({
    order_column: 'changed_on_delta_humanized',
    order_direction: 'desc',
    page: 0,
    page_size: search ? SEARCH_SIZE : PRELOAD_SIZE,
    select_columns: config.columns,
    ...(words.length && {
      filters: words.map(value => ({
        col: config.searchColumn,
        opr: config.searchOperator,
        value,
      })),
    }),
  });
  const { json } = await SupersetClient.get({
    endpoint: `${config.endpoint}?q=${query}`,
    signal,
  });
  const rows: Row[] = Array.isArray(json?.result) ? json.result : [];
  const items = rows
    .map(row =>
      toItem({
        kind: config.kind,
        key: `${config.kind}:${row.id}`,
        title: config.title(row),
        url: config.url(row),
        inApp,
        subtitle: config.subtitle?.(row),
        aliases: config.aliases?.(row),
      }),
    )
    .filter(isItem);
  const count = typeof json?.count === 'number' ? json.count : rows.length;
  return { items, complete: count <= rows.length };
}

const SLICE_ID = /[?&]slice_id=(\d+)/;

async function fetchRecent(
  inApp: boolean,
  signal: AbortSignal,
): Promise<CommandPaletteItem[]> {
  const query = rison.encode_uri({ page_size: RECENT_SIZE });
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/log/recent_activity/?q=${query}`,
    signal,
  });
  const rows: Row[] = Array.isArray(json?.result) ? json.result : [];
  return rows
    .map(row => {
      const isDashboard = row.item_type === 'dashboard';
      // A chart's recent address carries its form data; the list's does not.
      // The same chart gets the same address in both.
      const sliceId =
        !isDashboard && typeof row.item_url === 'string'
          ? SLICE_ID.exec(row.item_url)?.[1]
          : undefined;
      const url = sliceId ? `/explore/?slice_id=${sliceId}` : row.item_url;
      return toItem({
        kind: isDashboard ? 'dashboard' : 'chart',
        key: `recent:${url}`,
        title: row.item_title,
        url,
        inApp,
      });
    })
    .filter(isItem);
}

/** Adds the items that are not in the list yet, by key, after the others. */
function mergeItems(
  current: CommandPaletteItem[],
  added: CommandPaletteItem[],
): CommandPaletteItem[] {
  const keys = new Set(current.map(item => item.key));
  const fresh = added.filter(item => !keys.has(item.key));
  return fresh.length ? [...current, ...fresh] : current;
}

const withName = (
  names: CommandPaletteResource[],
  name: CommandPaletteResource,
  included: boolean,
) => {
  if (names.includes(name) === included) {
    return names;
  }
  return included ? [...names, name] : names.filter(other => other !== name);
};

interface Options {
  open: boolean;
  query: string;
  /** What the user may load. */
  access: CommandPaletteAccess;
  /** Whether the app's router can open the items without a page load. */
  inApp: boolean;
}

interface Result {
  data: CommandPaletteData;
  /** True until the first load is done. */
  loading: boolean;
  /** True while the server is searched for the query. */
  searching: boolean;
  /** Loads the lists unless they are fresh. */
  load: () => void;
  /** Puts a dashboard or chart the user opened first in the recent list. */
  markOpened: (item: CommandPaletteItem) => void;
}

/**
 * The dashboards, charts and saved queries the palette searches, and what the
 * user opened last.
 *
 * The most recently changed entries of each list load once, and matching them
 * takes no request. A list with more entries than that, or one that did not
 * load, is also searched on the server as the user types, and what it returns
 * is kept with the rest.
 */
export function useCommandPaletteData({
  open,
  query,
  access,
  inApp,
}: Options): Result {
  const [data, setData] = useState<CommandPaletteData>(EMPTY_DATA);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  // The lists the server is searched for: incomplete, or failed to load.
  const [serverLists, setServerLists] = useState<CommandPaletteResource[]>([]);
  // Changes when a list is replaced, so that its searches run again.
  const [generation, setGeneration] = useState(0);
  const loadedAt = useRef(0);
  const loadingRef = useRef(false);
  const searched = useRef(new Set<string>());
  const mounted = useRef(true);
  const loadController = useRef<AbortController>();

  useEffect(
    () => () => {
      mounted.current = false;
      loadController.current?.abort();
    },
    [],
  );

  const load = useCallback(() => {
    if (
      loadingRef.current ||
      (loadedAt.current && Date.now() - loadedAt.current < STALE_AFTER_MS)
    ) {
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    const controller = new AbortController();
    loadController.current = controller;
    let failed = false;
    const requests: Promise<unknown>[] = [
      access.recent
        ? fetchRecent(inApp, controller.signal)
            .then(recent => {
              if (mounted.current) {
                setData(current => ({ ...current, recent }));
              }
            })
            // Without the log API there is no recent list; the rest works.
            .catch(() => undefined)
        : Promise.resolve(),
      ...RESOURCE_NAMES.filter(name => access[name]).map(name =>
        fetchResource(name, inApp, controller.signal)
          .then(({ items, complete }) => {
            if (!mounted.current) {
              return;
            }
            // A reload replaces the list, so renamed and deleted entries go,
            // and the searches of that list run again.
            Array.from(searched.current)
              .filter(key => key.startsWith(`${name}:`))
              .forEach(key => searched.current.delete(key));
            setData(current => ({ ...current, [name]: items }));
            setServerLists(current => withName(current, name, !complete));
            setGeneration(current => current + 1);
          })
          .catch(() => {
            failed = true;
            if (mounted.current) {
              setServerLists(current => withName(current, name, true));
            }
          }),
      ),
    ];
    Promise.all(requests).then(() => {
      loadingRef.current = false;
      if (mounted.current) {
        // A list that failed loads again the next time.
        loadedAt.current = failed ? 0 : Date.now();
        setLoading(false);
      }
    });
  }, [access, inApp]);

  const markOpened = useCallback((item: CommandPaletteItem) => {
    if (item.kind !== 'dashboard' && item.kind !== 'chart') {
      return;
    }
    setData(current => ({
      ...current,
      recent: [
        { ...item, key: `recent:${item.route ?? item.href}` },
        ...current.recent.filter(other => other.href !== item.href),
      ].slice(0, RECENT_SIZE),
    }));
  }, []);

  useEffect(() => {
    const text = query.trim();
    const names = serverLists.filter(
      name => access[name] && !searched.current.has(`${name}:${text}`),
    );
    if (!open || text.length < MIN_SEARCH_LENGTH || !names.length) {
      return undefined;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      Promise.all(
        names.map(name =>
          fetchResource(name, inApp, controller.signal, text)
            .then(({ items }) => {
              if (controller.signal.aborted || !mounted.current) {
                return;
              }
              searched.current.add(`${name}:${text}`);
              setData(current => {
                const merged = mergeItems(current[name], items);
                return merged === current[name]
                  ? current
                  : { ...current, [name]: merged };
              });
            })
            .catch(() => undefined),
        ),
      ).then(() => {
        if (!controller.signal.aborted && mounted.current) {
          setSearching(false);
        }
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (mounted.current) {
        setSearching(false);
      }
    };
  }, [open, query, serverLists, generation, access, inApp]);

  return { data, loading, searching, load, markOpened };
}
