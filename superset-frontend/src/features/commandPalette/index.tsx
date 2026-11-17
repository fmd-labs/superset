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
import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { css, SupersetTheme } from '@apache-superset/core/theme';
import { Button, Icons, Tooltip } from '@superset-ui/core/components';
import { detectOS } from 'src/utils/common';
import { findPermission } from 'src/utils/findPermission';
import {
  MenuObjectProps,
  UserWithPermissionsAndRoles,
} from 'src/types/bootstrapTypes';
import { useIsMobile } from 'src/hooks/useIsMobile';
import CommandPalette from './CommandPalette';
import { buildCreateItems, buildPageItems, HOME_ROUTE } from './pageItems';
import { CommandPaletteAccess } from './types';

export interface CommandPaletteTriggerProps {
  /** The main navigation's entries. */
  menu?: MenuObjectProps[];
  /** The sections of the Settings menu. */
  settings?: MenuObjectProps[];
  isFrontendRoute: (path?: string) => boolean;
  /** Without a signed-in user there is no list of what they opened last. */
  isAnonymous?: boolean;
}

const SHORTCUT_KEY = 'k';

/**
 * The navigation bar's search button. It and the keyboard shortcut (⌘K on
 * macOS, Ctrl+K elsewhere) open the command palette.
 */
export default function CommandPaletteTrigger({
  menu,
  settings,
  isFrontendRoute,
  isAnonymous = false,
}: CommandPaletteTriggerProps) {
  const [show, setShow] = useState(false);
  // Pointing at or focusing the button loads the lists ahead of a click.
  const [warm, setWarm] = useState(false);
  const isMobile = useIsMobile();
  const roles = useSelector<
    { user?: UserWithPermissionsAndRoles },
    UserWithPermissionsAndRoles['roles'] | undefined
  >(state => state.user?.roles);
  const isMac = useMemo(() => detectOS() === 'MacOS', []);
  const modifierLabel = isMac ? '⌘' : 'Ctrl';

  // Outside the single-page app (a page the backend renders, with only the
  // navigation bar from here) no route is a frontend route.
  const inApp = isFrontendRoute(HOME_ROUTE);

  const pageItems = useMemo(
    () => buildPageItems({ menu, settings, isFrontendRoute }),
    [menu, settings, isFrontendRoute],
  );
  const createItems = useMemo(
    // Mobile consumption mode leaves creating to wider screens.
    () => buildCreateItems({ isFrontendRoute, roles, readOnly: isMobile }),
    [isFrontendRoute, roles, isMobile],
  );
  const access = useMemo<CommandPaletteAccess>(
    () => ({
      recent: !isAnonymous,
      dashboards: findPermission('can_read', 'Dashboard', roles),
      charts: findPermission('can_read', 'Chart', roles),
      savedQueries: findPermission('can_read', 'SavedQuery', roles),
    }),
    [roles, isAnonymous],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // An editor that uses the shortcut itself (and says so) keeps it. The
      // physical key counts too, for keyboard layouts without a Latin K.
      const isShortcutKey =
        event.key?.toLowerCase() === SHORTCUT_KEY || event.code === 'KeyK';
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.altKey ||
        event.shiftKey ||
        !isShortcutKey ||
        (isMac ? !event.metaKey || event.ctrlKey : !event.ctrlKey)
      ) {
        return;
      }
      event.preventDefault();
      setShow(current => !current);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMac]);

  return (
    <>
      <Tooltip
        title={`${t('Search')} (${modifierLabel}${isMac ? '' : '+'}K)`}
        placement="bottom"
        // Closed while the palette is open; a tap would leave it showing.
        open={show ? false : undefined}
      >
        <Button
          buttonStyle="link"
          aria-label={t('Search')}
          aria-keyshortcuts={isMac ? 'Meta+K' : 'Control+K'}
          data-test="command-palette-trigger"
          icon={<Icons.SearchOutlined iconSize="l" />}
          css={(theme: SupersetTheme) => css`
            &&,
            && .anticon {
              color: ${theme.colorText};
            }
            &&:hover,
            &&:hover .anticon {
              color: ${theme.colorPrimary};
            }
          `}
          onClick={() => setShow(true)}
          onPointerEnter={() => setWarm(true)}
          onFocus={() => setWarm(true)}
        />
      </Tooltip>
      <CommandPalette
        show={show}
        onHide={() => setShow(false)}
        warm={warm}
        pageItems={pageItems}
        createItems={createItems}
        access={access}
        inApp={inApp}
        modifierLabel={modifierLabel}
      />
    </>
  );
}
