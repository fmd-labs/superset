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
import {
  ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { t } from '@apache-superset/core/translation';
import { css, styled } from '@apache-superset/core/theme';
import { Icons, Input, StyledModal } from '@superset-ui/core/components';
import type { InputRef } from '@superset-ui/core/components';
import { rankItems, uniqueByHref } from './search';
import { useCommandPaletteData } from './useCommandPaletteData';
import {
  CommandPaletteAccess,
  CommandPaletteGroup,
  CommandPaletteItem,
  CommandPaletteItemKind,
  CommandPaletteSection,
} from './types';

const LIST_ID = 'command-palette-list';
const optionId = (index: number) => `command-palette-option-${index}`;

/** How many items a section shows at most, without and with a query. */
const LIMITS: Record<CommandPaletteGroup, { idle: number; search: number }> = {
  recent: { idle: 5, search: 0 },
  dashboards: { idle: 10, search: 8 },
  charts: { idle: 0, search: 8 },
  savedQueries: { idle: 0, search: 5 },
  pages: { idle: 8, search: 6 },
  create: { idle: 0, search: 3 },
};

const SQL_LAB_ROUTE = '/sqllab';

const PaletteModal = styled(StyledModal)`
  /* The title names the dialog for screen readers only. */
  && .ant-modal-header {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    padding: 0;
    margin: 0;
  }

  && .ant-modal-content {
    margin: 0;
    overflow: hidden;
  }

  && .ant-modal-body {
    display: flex;
    flex-direction: column;
    padding: 0;
    overflow: hidden;
  }
`;

const SearchRow = styled.div`
  ${({ theme }) => css`
    flex: none;
    border-bottom: 1px solid ${theme.colorSplit};
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 2}px;
  `}
`;

const Results = styled.div`
  ${({ theme }) => css`
    flex: 1 1 auto;
    max-height: min(60vh, ${theme.sizeUnit * 110}px);
    overflow-y: auto;
    padding: ${theme.sizeUnit * 2}px;
  `}
`;

const GroupLabel = styled.div`
  ${({ theme }) => css`
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px ${theme.sizeUnit}px;
  `}
`;

const Option = styled.a<{ active: boolean }>`
  ${({ theme, active }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 3}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    color: ${theme.colorText};
    cursor: pointer;
    background-color: ${active ? theme.colorFillSecondary : 'transparent'};

    &:hover,
    &:focus {
      color: ${theme.colorText};
      text-decoration: none;
    }

    .command-palette-title {
      flex: 0 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .command-palette-subtitle {
      flex: 1 1 0;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: ${theme.colorTextTertiary};
      font-size: ${theme.fontSizeSM}px;
    }

    .command-palette-icon,
    .command-palette-enter {
      flex: none;
      color: ${theme.colorTextTertiary};
    }

    .command-palette-enter {
      margin-left: auto;
      visibility: ${active ? 'visible' : 'hidden'};
    }
  `}
`;

// A live region: it stays in place, empty, so that screen readers announce it.
const Message = styled.div<{ compact: boolean }>`
  ${({ theme, compact }) => css`
    color: ${theme.colorTextTertiary};
    font-size: ${compact ? theme.fontSizeSM : theme.fontSize}px;
    text-align: center;

    &:not(:empty) {
      padding: ${compact ? theme.sizeUnit * 2 : theme.sizeUnit * 6}px;
    }
  `}
`;

const Hints = styled.div`
  ${({ theme }) => css`
    flex: none;
    display: flex;
    gap: ${theme.sizeUnit * 4}px;
    border-top: 1px solid ${theme.colorSplit};
    color: ${theme.colorTextTertiary};
    font-size: ${theme.fontSizeSM}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 5}px;

    kbd {
      font-family: inherit;
      color: ${theme.colorTextSecondary};
      margin-right: ${theme.sizeUnit}px;
    }

    @media (max-width: ${theme.screenSMMax}px) {
      display: none;
    }
  `}
`;

const groupLabels = (): Record<CommandPaletteGroup, string> => ({
  recent: t('Recent'),
  dashboards: t('Dashboards'),
  charts: t('Charts'),
  savedQueries: t('Saved queries'),
  pages: t('Pages'),
  create: t('Create'),
});

const KIND_ICONS: Record<CommandPaletteItemKind, typeof Icons.FileOutlined> = {
  dashboard: Icons.DashboardOutlined,
  chart: Icons.BarChartOutlined,
  savedQuery: Icons.ConsoleSqlOutlined,
  page: Icons.FileOutlined,
  create: Icons.PlusOutlined,
};

export interface CommandPaletteProps {
  show: boolean;
  onHide: () => void;
  /** Asks for the lists before the palette opens, as the pointer nears it. */
  warm?: boolean;
  /** The navigation's pages. */
  pageItems: CommandPaletteItem[];
  /** What the user may create. */
  createItems: CommandPaletteItem[];
  /** What the user may load. */
  access: CommandPaletteAccess;
  /** Whether the app's router can open items without a page load. */
  inApp: boolean;
  /** The modifier key of the "new tab" hint: "⌘" or "Ctrl". */
  modifierLabel: string;
}

interface ListOption {
  /** Unique in the list: the group and the item's key. */
  id: string;
  item: CommandPaletteItem;
}

const isAt = (item: CommandPaletteItem, path: string) =>
  item.route === path || !!item.aliases?.includes(path);

/** Runs `callback` once the page has loaded and the browser is idle. */
function whenPageIdle(callback: () => void): () => void {
  let handle: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (window.requestIdleCallback) {
      handle = window.requestIdleCallback(callback, { timeout: 5000 });
    } else {
      timer = setTimeout(callback, 2000);
    }
  };
  if (document.readyState === 'complete') {
    schedule();
  } else {
    window.addEventListener('load', schedule, { once: true });
  }
  return () => {
    window.removeEventListener('load', schedule);
    if (handle !== undefined) {
      window.cancelIdleCallback(handle);
    }
    clearTimeout(timer);
  };
}

/**
 * A search box over the navigation's pages and the user's dashboards, charts
 * and saved queries, used with the keyboard: type, pick with the arrow keys,
 * open with Enter.
 */
export default function CommandPalette({
  show,
  onHide,
  warm = false,
  pageItems,
  createItems,
  access,
  inApp,
  modifierLabel,
}: CommandPaletteProps) {
  const history = useHistory();
  const { pathname } = useLocation();
  const inputRef = useRef<InputRef>(null);
  const [query, setQuery] = useState('');
  const [activeId, setActiveId] = useState<string>();
  const { data, loading, searching, load, markOpened } = useCommandPaletteData({
    open: show,
    query,
    access,
    inApp,
  });

  // The lists load once the page is idle, so the first search has them.
  useEffect(() => whenPageIdle(load), [load]);

  useEffect(() => {
    if (warm) {
      load();
    }
  }, [warm, load]);

  useEffect(() => {
    if (!show) {
      return undefined;
    }
    load();
    // The dialog takes the focus when it opens; the input takes it back at
    // once, so what the user types right after the shortcut is not lost.
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [show, load]);

  const sections = useMemo<CommandPaletteSection[]>(() => {
    const isSearch = query.trim().length > 0;
    // The dashboard on screen is not somewhere to go, under any address.
    const here = new Set([pathname]);
    data.dashboards
      .filter(item => isAt(item, pathname))
      .forEach(item => {
        if (item.route) here.add(item.route);
        item.aliases?.forEach(alias => here.add(alias));
      });
    const elsewhere = (item: CommandPaletteItem) =>
      item.kind !== 'dashboard' || ![...here].some(path => isAt(item, path));
    const recent = data.recent.filter(elsewhere);
    const recentOf = (kind: CommandPaletteItemKind) =>
      recent.filter(item => item.kind === kind);
    const recentHrefs = new Set(recent.map(item => item.href));
    const dashboards = data.dashboards.filter(elsewhere);
    const candidates: Record<CommandPaletteGroup, CommandPaletteItem[]> = {
      recent,
      dashboards: isSearch
        ? uniqueByHref([...recentOf('dashboard'), ...dashboards])
        : dashboards.filter(item => !recentHrefs.has(item.href)),
      charts: access.charts
        ? uniqueByHref([...recentOf('chart'), ...data.charts])
        : [],
      savedQueries: data.savedQueries,
      pages: pageItems,
      create: createItems,
    };
    return (Object.keys(LIMITS) as CommandPaletteGroup[])
      .map(group => ({
        group,
        items: rankItems(
          candidates[group],
          query,
          isSearch ? LIMITS[group].search : LIMITS[group].idle,
        ),
      }))
      .filter(section => section.items.length > 0);
  }, [data, query, pageItems, createItems, pathname, access]);

  const options = useMemo<ListOption[]>(
    () =>
      sections.flatMap(section =>
        section.items.map(item => ({
          id: `${section.group}:${item.key}`,
          item,
        })),
      ),
    [sections],
  );
  // The selection follows its item when results arrive; the first by default.
  const active = Math.max(
    options.findIndex(option => option.id === activeId),
    0,
  );

  useEffect(() => {
    if (show) {
      document
        .getElementById(optionId(active))
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [active, show]);

  const hide = () => {
    setQuery('');
    setActiveId(undefined);
    onHide();
  };

  const openItem = (item: CommandPaletteItem, newTab: boolean) => {
    hide();
    markOpened(item);
    if (newTab) {
      window.open(item.href, '_blank', 'noopener,noreferrer');
      return;
    }
    // SQL Lab reads the saved query from the address only when it loads.
    const reload =
      item.kind === 'savedQuery' &&
      history.location.pathname.startsWith(SQL_LAB_ROUTE);
    if (item.route && !reload) {
      history.push(item.route);
    } else {
      window.location.assign(item.href);
    }
  };

  const select = (index: number) => setActiveId(options[index]?.id);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    setActiveId(undefined);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || !options.length) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        select((active + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        select((active - 1 + options.length) % options.length);
        break;
      case 'Home':
        if (!query) {
          event.preventDefault();
          select(0);
        }
        break;
      case 'End':
        if (!query) {
          event.preventDefault();
          select(options.length - 1);
        }
        break;
      case 'Enter':
        event.preventDefault();
        openItem(options[active].item, event.metaKey || event.ctrlKey);
        break;
      default:
    }
  };

  const handleClick = (
    event: MouseEvent<HTMLAnchorElement>,
    item: CommandPaletteItem,
  ) => {
    // A modified click is the browser's: it opens the link in a new tab.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button) {
      markOpened(item);
      hide();
      return;
    }
    event.preventDefault();
    openItem(item, false);
  };

  const labels = groupLabels();
  let index = -1;

  return (
    <PaletteModal
      open={show}
      onCancel={hide}
      title={t('Search')}
      footer={null}
      closable={false}
      destroyOnHidden
      // No zoom animation: the palette is there when the shortcut is pressed.
      transitionName=""
      width={640}
      style={{ top: '12vh' }}
      afterOpenChange={(open: boolean) => {
        if (open) {
          inputRef.current?.focus();
        }
      }}
      data-test="command-palette"
    >
      <SearchRow>
        <Input
          ref={inputRef}
          autoFocus
          size="large"
          variant="borderless"
          prefix={<Icons.SearchOutlined iconSize="l" />}
          placeholder={t('Search dashboards, charts and pages')}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label={t('Search')}
          aria-autocomplete="list"
          aria-expanded
          aria-controls={LIST_ID}
          aria-activedescendant={options.length ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
        />
      </SearchRow>
      <Results>
        <div id={LIST_ID} role="listbox" aria-label={t('Search results')}>
          {sections.map(section => (
            <div
              key={section.group}
              role="group"
              aria-label={labels[section.group]}
            >
              <GroupLabel aria-hidden>{labels[section.group]}</GroupLabel>
              {section.items.map(item => {
                index += 1;
                const itemIndex = index;
                const Icon = KIND_ICONS[item.kind];
                return (
                  <Option
                    key={`${section.group}:${item.key}`}
                    id={optionId(itemIndex)}
                    role="option"
                    aria-selected={itemIndex === active}
                    active={itemIndex === active}
                    href={item.href}
                    tabIndex={-1}
                    onClick={event => handleClick(event, item)}
                    onMouseMove={() => {
                      if (itemIndex !== active) {
                        select(itemIndex);
                      }
                    }}
                  >
                    <Icon className="command-palette-icon" iconSize="m" />
                    <span className="command-palette-title">{item.title}</span>
                    {item.subtitle && (
                      <span className="command-palette-subtitle">
                        {item.subtitle}
                      </span>
                    )}
                    <span className="command-palette-enter" aria-hidden>
                      ↵
                    </span>
                  </Option>
                );
              })}
            </div>
          ))}
        </div>
        <Message role="status" compact={options.length > 0}>
          {loading || searching
            ? t('Searching…')
            : !options.length && t('No results')}
        </Message>
      </Results>
      <Hints aria-hidden>
        <span>
          <kbd>↑↓</kbd>
          {t('to move')}
        </span>
        <span>
          <kbd>↵</kbd>
          {t('to open')}
        </span>
        <span>
          <kbd>{modifierLabel} ↵</kbd>
          {t('to open in a new tab')}
        </span>
        <span>
          <kbd>esc</kbd>
          {t('to close')}
        </span>
      </Hints>
    </PaletteModal>
  );
}
