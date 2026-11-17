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

/** What an item opens; decides its icon. */
export type CommandPaletteItemKind =
  | 'dashboard'
  | 'chart'
  | 'savedQuery'
  | 'page'
  | 'create';

/** The sections of the result list, in the order they are shown. */
export type CommandPaletteGroup =
  | 'recent'
  | 'dashboards'
  | 'charts'
  | 'savedQueries'
  | 'pages'
  | 'create';

export interface CommandPaletteItem {
  /** Unique within its group. */
  key: string;
  kind: CommandPaletteItemKind;
  title: string;
  /** Context shown after the title, and searched with it. */
  subtitle?: string;
  /** Where a full page load (or a new tab) goes. */
  href: string;
  /** The in-app route, when the item can open without a page load. */
  route?: string;
  /** Other in-app routes of the same item, such as a dashboard's by id. */
  aliases?: string[];
}

export interface CommandPaletteSection {
  group: CommandPaletteGroup;
  items: CommandPaletteItem[];
}

/** The lists the palette loads from the API. */
export type CommandPaletteResource = 'dashboards' | 'charts' | 'savedQueries';

/** What the user may load: each list, and what they opened last. */
export type CommandPaletteAccess = Record<
  CommandPaletteResource | 'recent',
  boolean
>;
