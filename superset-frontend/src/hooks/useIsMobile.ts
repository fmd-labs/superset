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
import { useEffect, useState } from 'react';
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { useTheme } from '@apache-superset/core/theme';

// Matches antd's screenMDMax token; used only when no theme is in scope.
// (Fork: upstream uses screenSMMax, 767; we include portrait tablets.)
const FALLBACK_MOBILE_MAX_WIDTH = 991;

/**
 * Whether the mobile consumption-only experience is enabled for this
 * deployment. Non-hook variant for use inside styled-component
 * interpolations; prefer `useIsMobile` in components.
 */
export function isMobileConsumptionEnabled(): boolean {
  return isFeatureEnabled(FeatureFlag.MobileConsumptionMode);
}

/**
 * Reads the current match synchronously so the hook's initial render
 * already reflects the real viewport instead of defaulting to desktop.
 * Guarded for environments without `window`/`matchMedia` (SSR, older
 * browsers), where it falls back to the desktop (non-mobile) value.
 */
function getInitialIsSmallScreen(enabled: boolean, maxWidth: number): boolean {
  if (!enabled || typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia(`(max-width: ${maxWidth}px)`).matches;
}

/**
 * Whether the viewport is at most `maxWidth` wide, kept up to date. Inert
 * (always false, no subscription) when `enabled` is false.
 */
function useMaxWidthMatch(enabled: boolean, maxWidth: number): boolean {
  const [isSmallScreen, setIsSmallScreen] = useState(() =>
    getInitialIsSmallScreen(enabled, maxWidth),
  );

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const mediaQuery = window.matchMedia(`(max-width: ${maxWidth}px)`);
    const update = () => setIsSmallScreen(mediaQuery.matches);
    update();
    // Safari < 14 lacks addEventListener on MediaQueryList
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, [enabled, maxWidth]);

  return enabled && isSmallScreen;
}

/**
 * Returns true when MOBILE_CONSUMPTION_MODE is enabled AND the viewport is
 * at or below the theme's `screenMDMax` breakpoint. All mobile-specific
 * behavior (route guarding, consumption-only chrome, drawer navigation)
 * should key off this hook so the flag remains a single kill switch.
 *
 * The matchMedia subscription is only installed when the flag is on, and
 * state only changes when the match flips, so with the flag off (or on
 * desktop) this hook never causes a re-render — consumers are inert.
 *
 * The initial value is computed synchronously from `matchMedia` (falling
 * back to desktop/false when the flag is off or `matchMedia` is
 * unavailable), so guards like `MobileRouteGuard` never mount
 * unsupported route content for a commit before the mobile check settles.
 */
export function useIsMobile(): boolean {
  const enabled = isMobileConsumptionEnabled();
  const theme = useTheme();
  const maxWidth = theme?.screenMDMax ?? FALLBACK_MOBILE_MAX_WIDTH;
  return useMaxWidthMatch(enabled, maxWidth);
}

/**
 * Fork: how many KPI tiles share a line in mobile consumption mode. One on
 * phones in portrait (below the theme's `screenSM`), where two would squeeze
 * their titles and numbers, two up to `screenSMMax`, three up to the mode's
 * `screenMDMax`. Only meaningful while `useIsMobile()` is true.
 */
export function useMobileTilesPerLine(): 1 | 2 | 3 {
  const enabled = isMobileConsumptionEnabled();
  const theme = useTheme();
  const phone = useMaxWidthMatch(enabled, theme?.screenXSMax ?? 575);
  const small = useMaxWidthMatch(enabled, theme?.screenSMMax ?? 767);
  if (phone) {
    return 1;
  }
  return small ? 2 : 3;
}
