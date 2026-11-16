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
import { AnnotationType } from '@superset-ui/core';
import {
  ANNOTATION_AXIS_MARKERS_KEY,
  annotationsAndLayersControls,
} from '../../src/sections/annotationsAndLayers';
import { ControlPanelsContainerProps, CustomControlItem } from '../../src';

const markersControl = annotationsAndLayersControls.controlSetRows
  .flat()
  .find(
    item => (item as CustomControlItem)?.name === ANNOTATION_AXIS_MARKERS_KEY,
  ) as CustomControlItem;

const visibleWith = (layers: unknown) =>
  markersControl.config.visibility?.(
    {
      controls: { annotation_layers: { value: layers } },
    } as unknown as ControlPanelsContainerProps,
    markersControl.config,
  );

test('the event markers control is off by default and re-renders without a query', () => {
  expect(markersControl.config).toMatchObject({
    type: 'CheckboxControl',
    default: false,
    renderTrigger: true,
  });
});

test('the event markers control shows only when the chart has an event layer', () => {
  expect(visibleWith(undefined)).toBe(false);
  expect(visibleWith([])).toBe(false);
  expect(visibleWith([{ annotationType: AnnotationType.Interval }])).toBe(
    false,
  );
  expect(
    visibleWith([
      { annotationType: AnnotationType.Formula },
      { annotationType: AnnotationType.Event },
    ]),
  ).toBe(true);
});
