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
import {
  AnnotationLayer,
  AnnotationType,
  ensureIsArray,
} from '@superset-ui/core';
import { ControlPanelSectionConfig } from '../types';

export const annotationLayers = [];

/**
 * Event markers on the time axis: each event annotation is drawn at the period
 * of the time axis it falls in, with a marker where it meets the axis. Off by
 * default, which draws events at their exact time without a marker.
 */
export const ANNOTATION_AXIS_MARKERS_KEY = 'annotation_axis_markers';

export const annotationsAndLayersControls: ControlPanelSectionConfig = {
  label: t('Annotations and Layers'),
  expanded: false,
  tabOverride: 'data',
  controlSetRows: [
    [
      {
        name: 'annotation_layers',
        config: {
          type: 'AnnotationLayerControl',
          label: '',
          default: annotationLayers,
          description: t('Annotation Layers'),
          renderTrigger: false,
        },
      },
    ],
    [
      {
        name: ANNOTATION_AXIS_MARKERS_KEY,
        config: {
          type: 'CheckboxControl',
          label: t('Mark events on the time axis'),
          default: false,
          renderTrigger: true,
          description: t(
            'Draw each event annotation at the period it falls in (the week that contains it on a weekly chart), with a marker where it meets the time axis. Events outside the periods the chart shows are left out.',
          ),
          visibility: ({ controls }) =>
            ensureIsArray(
              controls?.annotation_layers?.value as
                | AnnotationLayer[]
                | undefined,
            ).some(layer => layer?.annotationType === AnnotationType.Event),
        },
      },
    ],
  ],
};
