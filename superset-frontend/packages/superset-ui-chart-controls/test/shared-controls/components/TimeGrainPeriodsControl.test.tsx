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
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@superset-ui/core/spec';
import TimeGrainPeriodsControl, {
  TimeGrainPeriodsControlProps,
} from '../../../src/shared-controls/components/TimeGrainPeriodsControl';

const choices: [string, string][] = [
  ['P1D', 'Day'],
  ['P1W', 'Week'],
  ['P2W', '2 weeks'],
  ['P1M', 'Month'],
];

const setup = (props: Partial<TimeGrainPeriodsControlProps> = {}) => {
  const onChange = jest.fn();
  render(
    <TimeGrainPeriodsControl
      label="Periods per viewer time grain"
      grains={['P1M', 'P1W', 'P1D']}
      defaultGrain="P1D"
      choices={choices}
      value={{ P1W: 12 }}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
};

test('lists the viewer grains other than the default, shortest first', () => {
  setup();
  const inputs = screen.getAllByRole('spinbutton');
  expect(inputs.map(input => input.getAttribute('aria-label'))).toEqual([
    'Periods for Week',
    'Periods for Month',
  ]);
  expect(
    screen.getByRole('spinbutton', { name: 'Periods for Week' }),
  ).toHaveValue('12');
  expect(screen.getByText(/Day, the chart’s own grain/)).toBeInTheDocument();
});

test('sets the periods of a grain and drops grains no longer offered', () => {
  const onChange = setup({ value: { P1W: 12, P1Y: 3 } });
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Periods for Month' }),
    {
      target: { value: '6' },
    },
  );
  expect(onChange).toHaveBeenLastCalledWith({ P1W: 12, P1M: 6 });
});

test('clearing a grain removes its periods', () => {
  const onChange = setup();
  fireEvent.change(
    screen.getByRole('spinbutton', { name: 'Periods for Week' }),
    {
      target: { value: '' },
    },
  );
  expect(onChange).toHaveBeenLastCalledWith({});
});

test('explains itself when only the default grain is offered', () => {
  setup({ grains: ['P1D'] });
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(
    screen.getByText('Add a viewer time grain other than the chart’s own.'),
  ).toBeInTheDocument();
});
