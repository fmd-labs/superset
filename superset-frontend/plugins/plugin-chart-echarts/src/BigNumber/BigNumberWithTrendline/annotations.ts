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
  AnnotationData,
  AnnotationLayer,
  CategoricalColorNamespace,
  ensureIsArray,
  isEventAnnotationLayer,
  isIntervalAnnotationLayer,
} from '@superset-ui/core';
import { SupersetTheme } from '@apache-superset/core/theme';
import type { SeriesOption } from 'echarts';
import {
  ANNOTATION_AXIS_MARKER_SIZE,
  getAnnotationPeriods,
  getPeriodEventRows,
} from '../../utils/annotation';
import {
  transformEventAnnotation,
  transformIntervalAnnotation,
} from '../../Timeseries/transformers';

export interface TrendlineAnnotationsInput {
  annotationLayers?: AnnotationLayer[];
  annotationAxisMarkers?: boolean;
  annotationData?: AnnotationData | null;
  /** The times of the trend line's points, which start its periods. */
  pointTimes: (number | null)[];
  timeGrain?: string | null;
  theme: SupersetTheme;
  sliceId?: number;
}

export interface TrendlineAnnotations {
  /** Series that draw the annotations over the trend line. */
  series: SeriesOption[];
  /**
   * Room, in pixels, to leave below a trend line drawn without axes, which
   * fills the chart, for the lower half of the event markers.
   */
  markerOffset: number;
  /** Tooltip rows of the events by the point of the period they fall in. */
  eventRows: Map<number, string[][]>;
}

/**
 * Event and interval annotations on a big number's trend line, drawn as on a
 * time-series chart: events as vertical lines (with a marker on the time
 * axis when `annotationAxisMarkers` is on), intervals as shaded areas. The
 * trend line is too small for the label a time-series chart writes along an
 * event's line, so its tooltip names the events of the hovered period
 * instead.
 */
export function getTrendlineAnnotations({
  annotationLayers,
  annotationAxisMarkers,
  annotationData,
  pointTimes,
  timeGrain,
  theme,
  sliceId,
}: TrendlineAnnotationsInput): TrendlineAnnotations {
  const layers = ensureIsArray(annotationLayers).filter(layer => layer.show);
  if (layers.length === 0) {
    return { series: [], markerOffset: 0, eventRows: new Map() };
  }
  const data = annotationData || {};
  const colorScale = CategoricalColorNamespace.getScale();
  const periods = getAnnotationPeriods(pointTimes, timeGrain, true);
  const axisMarkers = annotationAxisMarkers ? periods : undefined;
  let hasEvents = false;
  const series = layers.flatMap(layer => {
    if (isEventAnnotationLayer(layer)) {
      const eventSeries = transformEventAnnotation(
        layer,
        [],
        data,
        colorScale,
        theme,
        sliceId,
        undefined,
        axisMarkers,
      ).map(item => ({
        ...item,
        markLine: { ...item.markLine, label: { show: false } },
      })) as SeriesOption[];
      hasEvents = hasEvents || eventSeries.length > 0;
      return eventSeries;
    }
    if (isIntervalAnnotationLayer(layer)) {
      return transformIntervalAnnotation(
        layer,
        [],
        data,
        colorScale,
        theme,
        sliceId,
      );
    }
    return [];
  });
  return {
    series,
    markerOffset:
      axisMarkers && hasEvents ? ANNOTATION_AXIS_MARKER_SIZE / 2 : 0,
    eventRows: getPeriodEventRows(layers, data, periods),
  };
}
