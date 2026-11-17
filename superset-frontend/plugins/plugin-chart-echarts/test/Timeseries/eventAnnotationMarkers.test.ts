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
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
  CategoricalColorNamespace,
  ChartDataResponseResult,
  DataRecord,
  EventAnnotationLayer,
} from '@superset-ui/core';
import { supersetTheme } from '@apache-superset/core/theme';
import type { SeriesOption } from 'echarts';
import { transformEventAnnotation } from '../../src/Timeseries/transformers';
import transformProps from '../../src/Timeseries/transformProps';
import mixedTransformProps from '../../src/MixedTimeseries/transformProps';
import { DEFAULT_FORM_DATA } from '../../src/Timeseries/constants';
import {
  DEFAULT_FORM_DATA as MIXED_DEFAULT_FORM_DATA,
  EchartsMixedTimeseriesFormData,
  EchartsMixedTimeseriesProps,
} from '../../src/MixedTimeseries/types';
import {
  EchartsTimeseriesFormData,
  OrientationType,
} from '../../src/Timeseries/types';
import { EchartsTimeseriesChartProps } from '../../src/types';
import { createEchartsTimeseriesTestChartProps } from '../helpers';

const utc = (date: string) => Date.parse(`${date}T00:00:00Z`);

const layer: EventAnnotationLayer = {
  annotationType: AnnotationType.Event,
  name: 'Releases',
  show: true,
  showLabel: false,
  sourceType: AnnotationSourceType.Native,
  style: AnnotationStyle.Dotted,
  value: 1,
};

const annotationData = (
  events: { start_dttm: number | string; short_descr: string }[],
): AnnotationData => ({
  Releases: {
    records: events.map(event => ({
      end_dttm: event.start_dttm,
      long_descr: '',
      json_metadata: '',
      ...event,
    })),
  },
});

const weeks = [utc('2026-10-26'), utc('2026-11-02'), utc('2026-11-09')];

type MarkLine = {
  label: unknown;
  lineStyle: { color?: string; width?: number };
  symbol: string | string[];
  symbolSize: number;
  data: { name: string; xAxis?: number | string; yAxis?: number | string }[];
};

const markLineOf = (series: SeriesOption[]) =>
  (series[0] as SeriesOption & { markLine: MarkLine }).markLine;

test('event annotations keep their exact time and no marker by default', () => {
  const series = transformEventAnnotation(
    layer,
    [],
    annotationData([{ start_dttm: utc('2026-11-04'), short_descr: 'Launch' }]),
    CategoricalColorNamespace.getScale(),
    supersetTheme,
  );
  expect(series).toHaveLength(1);
  const markLine = markLineOf(series);
  expect(markLine.symbol).toBe('none');
  expect(markLine.lineStyle.color).toBe(
    CategoricalColorNamespace.getScale()('Releases'),
  );
  expect(markLine.data).toEqual([
    { name: 'Releases - Launch', xAxis: utc('2026-11-04') },
  ]);
});

test('event markers put each event at its period, with a marker on the time axis', () => {
  const series = transformEventAnnotation(
    layer,
    [],
    annotationData([
      { start_dttm: utc('2026-11-04'), short_descr: 'Launch' },
      { start_dttm: '2026-11-12T00:00:00', short_descr: 'Pricing' },
    ]),
    CategoricalColorNamespace.getScale(),
    supersetTheme,
    undefined,
    undefined,
    { points: weeks, timeGrain: 'P1W', eventsInTooltip: true },
  );
  expect(series.map(item => item.id)).toEqual([
    'Event - Releases',
    'Event markers - Releases',
  ]);
  const [line, markers] = series.map(item => markLineOf([item]));
  const data = [
    { name: 'Releases - Launch', xAxis: utc('2026-11-02') },
    { name: 'Releases - Pricing', xAxis: utc('2026-11-09') },
  ];
  // The line is muted and neutral, and shows no label on hover, as the
  // tooltip names the events.
  expect(line.symbol).toBe('none');
  expect(line.lineStyle.color).toBe(supersetTheme.colorTextQuaternary);
  expect(line.label).toEqual({ show: false });
  expect(line.data).toEqual(data);
  // The markers carry the layer's color, on a line that is not drawn.
  expect(markers.symbol).toEqual(['circle', 'none']);
  expect(markers.symbolSize).toBeGreaterThan(0);
  expect(markers.lineStyle.width).toBe(0);
  expect(markers.lineStyle.color).toBe(
    CategoricalColorNamespace.getScale()('Releases'),
  );
  expect(markers.data).toEqual(data);
});

test('event markers group the events of one period and leave out the others', () => {
  const series = transformEventAnnotation(
    layer,
    [],
    annotationData([
      { start_dttm: utc('2026-11-10'), short_descr: 'Pricing' },
      { start_dttm: utc('2026-11-13'), short_descr: 'Cancel flow' },
      { start_dttm: utc('2026-09-01'), short_descr: 'Too early' },
      { start_dttm: utc('2026-11-20'), short_descr: 'Too late' },
    ]),
    CategoricalColorNamespace.getScale(),
    supersetTheme,
    undefined,
    undefined,
    { points: weeks, timeGrain: 'P1W', eventsInTooltip: true },
  );
  expect(markLineOf(series).data).toEqual([
    {
      name: 'Releases - Pricing\nReleases - Cancel flow',
      xAxis: utc('2026-11-09'),
    },
  ]);
});

test('event markers draw nothing when no event falls in the periods shown', () => {
  expect(
    transformEventAnnotation(
      layer,
      [],
      annotationData([{ start_dttm: utc('2026-01-01'), short_descr: 'Old' }]),
      CategoricalColorNamespace.getScale(),
      supersetTheme,
      undefined,
      undefined,
      { points: weeks, timeGrain: 'P1W', eventsInTooltip: true },
    ),
  ).toEqual([]);
});

const queryData = (data: DataRecord[], annotations: AnnotationData) =>
  ({
    annotation_data: annotations,
    data,
    colnames: ['__timestamp', 'value'],
    coltypes: [2, 0],
    from_dttm: null,
    to_dttm: null,
    label_map: {},
  }) as unknown as ChartDataResponseResult;

const chartProps = (formData: Partial<EchartsTimeseriesFormData>) =>
  createEchartsTimeseriesTestChartProps<
    EchartsTimeseriesFormData,
    EchartsTimeseriesChartProps
  >({
    defaultFormData: DEFAULT_FORM_DATA,
    defaultVizType: 'echarts_timeseries_line',
    formData: {
      metrics: ['value'],
      x_axis: '__timestamp',
      time_grain_sqla: 'P1W',
      annotationLayers: [layer],
      ...formData,
    } as Partial<EchartsTimeseriesFormData>,
    queriesData: [
      queryData(
        weeks.map(week => ({ __timestamp: week, value: 1 })),
        annotationData([
          { start_dttm: utc('2026-11-12'), short_descr: 'Pricing' },
        ]),
      ),
    ],
  });

const LINE = 'Event - Releases';
const MARKERS = 'Event markers - Releases';

const eventMarkLine = (props: EchartsTimeseriesChartProps, id = LINE) => {
  const series = transformProps(props).echartOptions.series as SeriesOption[];
  return markLineOf(series.filter(item => item.id === id)) as MarkLine;
};

test('time-series charts draw event markers when annotation_axis_markers is on', () => {
  const props = chartProps({ annotationAxisMarkers: true });
  expect(eventMarkLine(props).symbol).toBe('none');
  const markLine = eventMarkLine(props, MARKERS);
  expect(markLine.symbol).toEqual(['circle', 'none']);
  expect(markLine.data).toEqual([
    { name: 'Releases - Pricing', xAxis: utc('2026-11-09') },
  ]);
});

test('the tooltip of a period names its events when annotation_axis_markers is on', () => {
  const tooltipOf = (props: EchartsTimeseriesChartProps) => {
    const { tooltip } = transformProps(props).echartOptions as {
      tooltip: { formatter: (params: unknown) => string };
    };
    return tooltip.formatter([
      {
        seriesName: 'value',
        value: [utc('2026-11-09'), 1],
        color: '#000',
        marker: '',
      },
    ]);
  };
  expect(tooltipOf(chartProps({ annotationAxisMarkers: true }))).toContain(
    'Pricing',
  );
  expect(tooltipOf(chartProps({}))).not.toContain('Pricing');
});

test('time-series charts keep upstream event lines when annotation_axis_markers is off', () => {
  const props = chartProps({});
  const series = transformProps(props).echartOptions.series as SeriesOption[];
  expect(series.map(item => item.id)).not.toContain(MARKERS);
  const markLine = eventMarkLine(props);
  expect(markLine.symbol).toBe('none');
  expect(markLine).not.toHaveProperty('symbolSize');
  expect(markLine.label).toMatchObject({
    show: false,
    emphasis: { show: true },
  });
  expect(markLine.data).toEqual([
    { name: 'Releases - Pricing', xAxis: utc('2026-11-12') },
  ]);
});

test('without a rich tooltip, event markers keep the label on hover', () => {
  const props = chartProps({
    annotationAxisMarkers: true,
    richTooltip: false,
  });
  expect(eventMarkLine(props, MARKERS).symbol).toEqual(['circle', 'none']);
  expect(eventMarkLine(props).label).toMatchObject({
    emphasis: { show: true },
  });
});

test('event markers snap on the time axis of a horizontal chart', () => {
  const markLine = eventMarkLine(
    chartProps({
      annotationAxisMarkers: true,
      orientation: OrientationType.Horizontal,
    }),
  );
  expect(markLine.data).toEqual([
    { name: 'Releases - Pricing', yAxis: utc('2026-11-09') },
  ]);
});

test('event markers use the time grain a dashboard filter applies', () => {
  // Saved as daily, shown weekly: the event falls in the last week shown.
  const props = chartProps({
    annotationAxisMarkers: true,
    time_grain_sqla: 'P1D',
    extra_form_data: { time_grain_sqla: 'P1W' },
  } as Partial<EchartsTimeseriesFormData>);
  expect(eventMarkLine(props).data).toEqual([
    { name: 'Releases - Pricing', xAxis: utc('2026-11-09') },
  ]);
});

test('mixed time-series charts draw event markers when annotation_axis_markers is on', () => {
  const rows = weeks.map(week => ({ __timestamp: week, value: 1 }));
  const annotations = annotationData([
    { start_dttm: utc('2026-11-12'), short_descr: 'Pricing' },
  ]);
  const props = createEchartsTimeseriesTestChartProps<
    EchartsMixedTimeseriesFormData,
    EchartsMixedTimeseriesProps
  >({
    defaultFormData: MIXED_DEFAULT_FORM_DATA,
    defaultVizType: 'mixed_timeseries',
    formData: {
      metrics: ['value'],
      metricsB: ['value'],
      groupby: [],
      groupbyB: [],
      x_axis: '__timestamp',
      time_grain_sqla: 'P1W',
      richTooltip: true,
      annotationLayers: [layer],
      annotationAxisMarkers: true,
    } as Partial<EchartsMixedTimeseriesFormData>,
    queriesData: [queryData(rows, annotations), queryData(rows, {})],
  });
  const { series, tooltip } = mixedTransformProps(props).echartOptions as {
    series: SeriesOption[];
    tooltip: { formatter: (params: unknown) => string };
  };
  const markLine = markLineOf(series.filter(item => item.id === MARKERS));
  expect(markLine.symbol).toEqual(['circle', 'none']);
  expect(markLine.data).toEqual([
    { name: 'Releases - Pricing', xAxis: utc('2026-11-09') },
  ]);
  expect(
    tooltip.formatter([
      { seriesName: 'value', value: [utc('2026-11-09'), 1], color: '#000' },
    ]),
  ).toContain('Pricing');
});
