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

import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import thunk from 'redux-thunk';
import mockState from 'spec/fixtures/mockState';
import reducerIndex from 'spec/helpers/reducerIndex';
import { sliceId as chartId } from 'spec/fixtures/mockChartQueries';
import {
  screen,
  render,
  waitFor,
  fireEvent,
  userEvent,
} from 'spec/helpers/testing-library';
import { nativeFiltersInfo } from 'src/dashboard/fixtures/mockNativeFilters';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';
import { initialState } from 'src/SqlLab/fixtures';
import { SET_DIRECT_PATH } from 'src/dashboard/actions/dashboardState';
import {
  enableMobileConsumptionFlag,
  mockMobileMatchMedia,
} from 'spec/helpers/mobileTestUtils';
import {
  CHART_TYPE,
  COLUMN_TYPE,
  ROW_TYPE,
} from '../../../util/componentTypes';
import ChartHolder, { CHART_MARGIN, MOBILE_CHROME_HEIGHT } from './ChartHolder';
import {
  GRID_BASE_UNIT,
  GRID_COLUMN_COUNT,
  GRID_GUTTER_SIZE,
  GRID_MIN_ROW_UNITS,
  MOBILE_TILE_CLASS,
  MOBILE_TILE_MAX_ROW_UNITS,
} from '../../../util/constants';

const DEFAULT_HEADER_HEIGHT = 22;

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ChartHolder', () => {
  let scrollViewBase: any;

  const defaultProps = {
    component: {
      ...newComponentFactory(CHART_TYPE),
      id: 'CHART-ID',
      parents: ['ROOT_ID', 'TABS_ID', 'TAB_ID', 'ROW_ID'],
      meta: {
        uuid: `CHART-${chartId}`,
        chartId,
        width: 3,
        height: 10,
        chartName: 'Mock chart name',
      },
    },
    parentComponent: {
      ...newComponentFactory(ROW_TYPE),
      id: 'ROW_ID',
      children: ['COLUMN_ID'],
    },
    index: 0,
    depth: 0,
    id: 'CHART-ID',
    parentId: 'ROW_ID',
    availableColumnCount: 12,
    columnWidth: 300,
    onResizeStart: () => {},
    onResize: () => {},
    onResizeStop: () => {},
    handleComponentDrop: () => {},
    deleteComponent: () => {},
    updateComponents: () => {},
    editMode: false,
    isComponentVisible: true,
    dashboardId: 123,
    nativeFilters: nativeFiltersInfo.filters,
    fullSizeChartId: chartId,
    setFullSizeChartId: () => {},
  };

  beforeAll(() => {
    scrollViewBase = window.HTMLElement.prototype.scrollIntoView;
    window.HTMLElement.prototype.scrollIntoView = () => {};
  });

  afterAll(() => {
    window.HTMLElement.prototype.scrollIntoView = scrollViewBase;
  });

  const createMockStore = (customState: any = {}) =>
    createStore(
      combineReducers(reducerIndex),
      { ...mockState, ...(initialState as any), ...customState },
      compose(applyMiddleware(thunk)),
    );

  const renderWrapper = (store = createMockStore(), props: any = {}) =>
    render(<ChartHolder {...defaultProps} {...props} />, {
      useRouter: true,
      useDnd: true,
      useRedux: true,
      store,
    });

  test('should render empty state', async () => {
    renderWrapper();

    expect(
      screen.getByText('No results were returned for this query'),
    ).toBeVisible();
    expect(
      screen.queryByText(
        'Make sure that the controls are configured properly and the datasource contains data for the selected time range',
      ),
    ).not.toBeInTheDocument(); // description should display only in Explore view
    expect(screen.getByRole('img', { name: 'empty' })).toBeVisible();
  });

  test('should render anchor link when not editing', async () => {
    const store = createMockStore();
    const { rerender } = renderWrapper(store, { editMode: false });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    expect(
      screen
        .getByTestId('dashboard-component-chart-holder')
        .getElementsByClassName('anchor-link-container').length,
    ).toEqual(1);

    rerender(
      <Provider store={store}>
        <ChartHolder {...defaultProps} editMode isInView />
      </Provider>,
    );

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    expect(
      screen
        .getByTestId('dashboard-component-chart-holder')
        .getElementsByClassName('anchor-link-container').length,
    ).toEqual(0);
  });

  test('should highlight when path matches', async () => {
    const store = createMockStore({
      dashboardState: {
        ...mockState.dashboardState,
        directPathToChild: ['CHART-ID'],
      },
    });
    renderWrapper(store);

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    expect(screen.getByTestId('dashboard-component-chart-holder')).toHaveClass(
      'fade-out',
    );

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).not.toHaveClass('fade-in');

    store.dispatch({ type: SET_DIRECT_PATH, path: ['CHART-ID'] });

    await waitFor(() => {
      expect(
        screen.getByTestId('dashboard-component-chart-holder'),
      ).not.toHaveClass('fade-out');

      expect(
        screen.getByTestId('dashboard-component-chart-holder'),
      ).toHaveClass('fade-in');
    });

    await waitFor(
      () => {
        expect(
          screen.getByTestId('dashboard-component-chart-holder'),
        ).toHaveClass('fade-out');

        expect(
          screen.getByTestId('dashboard-component-chart-holder'),
        ).not.toHaveClass('fade-in');
      },
      { timeout: 5000 },
    );
  });

  test('should calculate the default widthMultiple', async () => {
    const widthMultiple = 5;
    renderWrapper(createMockStore(), {
      editMode: true,
      component: {
        ...defaultProps.component,
        meta: {
          ...defaultProps.component.meta,
          width: widthMultiple,
        },
      },
    });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    const resizeContainer = screen
      .getByTestId('dragdroppable-object')
      .getElementsByClassName('resizable-container')[0];

    const { width: computedWidth } = getComputedStyle(resizeContainer);
    const expectedWidth =
      (defaultProps.columnWidth + GRID_GUTTER_SIZE) * widthMultiple -
      GRID_GUTTER_SIZE;

    expect(computedWidth).toEqual(`${expectedWidth}px`);
  });

  test('should set the resizable width to auto when parent component type is column', async () => {
    renderWrapper(createMockStore(), {
      editMode: true,
      parentComponent: {
        ...newComponentFactory(COLUMN_TYPE),
        id: 'ROW_ID',
        children: ['COLUMN_ID'],
      },
    });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    const resizeContainer = screen
      .getByTestId('dragdroppable-object')
      .getElementsByClassName('resizable-container')[0];

    const { width: computedWidth } = getComputedStyle(resizeContainer);

    // the width is only adjustable if the parent component is row type
    expect(computedWidth).toEqual('auto');
  });

  test("should override the widthMultiple if there's a column in the parent chain whose width is less than the chart", async () => {
    const widthMultiple = 10;
    const parentColumnWidth = 6;
    renderWrapper(createMockStore(), {
      editMode: true,
      component: {
        ...defaultProps.component,
        meta: {
          ...defaultProps.component.meta,
          width: widthMultiple,
        },
      },
      // Return the first column in the chain
      getComponentById: () =>
        newComponentFactory(COLUMN_TYPE, { width: parentColumnWidth }),
    });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    const resizeContainer = screen
      .getByTestId('dragdroppable-object')
      .getElementsByClassName('resizable-container')[0];

    const { width: computedWidth } = getComputedStyle(resizeContainer);
    const expectedWidth =
      (defaultProps.columnWidth + GRID_GUTTER_SIZE) * parentColumnWidth -
      GRID_GUTTER_SIZE;

    expect(computedWidth).toEqual(`${expectedWidth}px`);
  });

  test('should calculate the chartWidth', async () => {
    const widthMultiple = 7;
    const columnWidth = 250;
    renderWrapper(createMockStore(), {
      fullSizeChartId: null,
      component: {
        ...defaultProps.component,
        meta: {
          ...defaultProps.component.meta,
          width: widthMultiple,
        },
      },
      columnWidth,
    });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    const container = screen.getByTestId('chart-container');

    const computedWidth = parseInt(container.getAttribute('width') || '0', 10);
    const expectedWidth = Math.floor(
      widthMultiple * columnWidth +
        (widthMultiple - 1) * GRID_GUTTER_SIZE -
        CHART_MARGIN,
    );

    expect(computedWidth).toEqual(expectedWidth);
  });

  test('should calculate the chartWidth on full screen mode', async () => {
    const widthMultiple = 7;
    const columnWidth = 250;
    renderWrapper(createMockStore(), {
      component: {
        ...defaultProps.component,
        meta: {
          ...defaultProps.component.meta,
          width: widthMultiple,
        },
      },
      columnWidth,
    });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    const container = screen.getByTestId('chart-container');

    const computedWidth = parseInt(container.getAttribute('width') || '0', 10);
    const expectedWidth = window.innerWidth - CHART_MARGIN;

    expect(computedWidth).toEqual(expectedWidth);
  });

  test('should calculate the chartHeight', async () => {
    const heightMultiple = 12;
    renderWrapper(createMockStore(), {
      fullSizeChartId: null,
      component: {
        ...defaultProps.component,
        meta: {
          ...defaultProps.component.meta,
          height: heightMultiple,
        },
      },
    });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    const container = screen.getByTestId('chart-container');

    const computedWidth = parseInt(container.getAttribute('height') || '0', 10);
    const expectedWidth = Math.floor(
      heightMultiple * GRID_BASE_UNIT - CHART_MARGIN - DEFAULT_HEADER_HEIGHT,
    );

    expect(computedWidth).toEqual(expectedWidth);
  });

  test('should calculate the chartHeight on full screen mode', async () => {
    const heightMultiple = 12;
    renderWrapper(createMockStore(), {
      component: {
        ...defaultProps.component,
        meta: {
          ...defaultProps.component.meta,
          height: heightMultiple,
        },
      },
    });

    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).toBeVisible();

    const container = screen.getByTestId('chart-container');

    const computedWidth = parseInt(container.getAttribute('height') || '0', 10);
    const expectedWidth =
      window.innerHeight - CHART_MARGIN - DEFAULT_HEADER_HEIGHT;

    expect(computedWidth).toEqual(expectedWidth);
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('mobile consumption mode height capping', () => {
    let restoreMatchMedia: () => void;
    let restoreFlag: () => void;
    let originalInnerHeight: number;

    beforeEach(() => {
      restoreMatchMedia = mockMobileMatchMedia();
      restoreFlag = enableMobileConsumptionFlag();
      originalInnerHeight = window.innerHeight;
    });

    afterEach(() => {
      restoreMatchMedia();
      restoreFlag();
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalInnerHeight,
      });
    });

    test('caps an authored height taller than the viewport to fit within it', async () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 812,
      });
      const authoredHeight = 200;

      renderWrapper(createMockStore(), {
        fullSizeChartId: null,
        editMode: false,
        component: {
          ...defaultProps.component,
          meta: {
            ...defaultProps.component.meta,
            height: authoredHeight,
          },
        },
      });

      const container = screen.getByTestId('chart-container');
      const computedHeight = parseInt(
        container.getAttribute('height') || '0',
        10,
      );

      const maxUnits = Math.floor(
        (812 - MOBILE_CHROME_HEIGHT) / GRID_BASE_UNIT,
      );
      const cappedHeightMultiple = Math.min(authoredHeight, maxUnits);
      const expectedHeight = Math.floor(
        cappedHeightMultiple * GRID_BASE_UNIT -
          CHART_MARGIN -
          DEFAULT_HEADER_HEIGHT,
      );

      expect(cappedHeightMultiple).toBeLessThan(authoredHeight);
      expect(computedHeight).toEqual(expectedHeight);
    });

    test('floors the capped height at GRID_MIN_ROW_UNITS on very short viewports', async () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 200,
      });
      const authoredHeight = 200;

      renderWrapper(createMockStore(), {
        fullSizeChartId: null,
        editMode: false,
        component: {
          ...defaultProps.component,
          meta: {
            ...defaultProps.component.meta,
            height: authoredHeight,
          },
        },
      });

      const container = screen.getByTestId('chart-container');
      const computedHeight = parseInt(
        container.getAttribute('height') || '0',
        10,
      );

      // The rendered chart further clamps to a 20px floor of its own, which
      // kicks in here since the grid-unit floor alone would compute negative.
      const expectedHeight = Math.max(
        Math.floor(
          GRID_MIN_ROW_UNITS * GRID_BASE_UNIT -
            CHART_MARGIN -
            DEFAULT_HEADER_HEIGHT,
        ),
        20,
      );

      expect(computedHeight).toEqual(expectedHeight);
    });

    test('ignores a height-only resize (an address bar) but follows a rotation', async () => {
      const setViewport = (width: number, height: number) => {
        Object.defineProperty(window, 'innerWidth', {
          writable: true,
          configurable: true,
          value: width,
        });
        Object.defineProperty(window, 'innerHeight', {
          writable: true,
          configurable: true,
          value: height,
        });
      };
      const renderedHeight = () =>
        parseInt(
          screen.getByTestId('chart-container').getAttribute('height') || '0',
          10,
        );
      const cappedHeight = (viewportHeight: number) =>
        Math.floor(
          Math.floor((viewportHeight - MOBILE_CHROME_HEIGHT) / GRID_BASE_UNIT) *
            GRID_BASE_UNIT -
            CHART_MARGIN -
            DEFAULT_HEADER_HEIGHT,
        );
      const originalInnerWidth = window.innerWidth;
      setViewport(390, 664);

      renderWrapper(createMockStore(), {
        fullSizeChartId: null,
        editMode: false,
        component: {
          ...defaultProps.component,
          meta: { ...defaultProps.component.meta, height: 200 },
        },
      });
      expect(renderedHeight()).toEqual(cappedHeight(664));

      setViewport(390, 750);
      fireEvent(window, new Event('resize'));
      expect(renderedHeight()).toEqual(cappedHeight(664));

      // A rotation changes the width too: the cap follows the new height.
      setViewport(844, 390);
      fireEvent(window, new Event('resize'));
      await waitFor(() =>
        expect(renderedHeight()).toBeLessThan(cappedHeight(664)),
      );
      setViewport(originalInnerWidth, 768);
    });

    test('does not cap the authored height while in edit mode', async () => {
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 812,
      });
      const authoredHeight = 200;

      renderWrapper(createMockStore(), {
        fullSizeChartId: null,
        editMode: true,
        component: {
          ...defaultProps.component,
          meta: {
            ...defaultProps.component.meta,
            height: authoredHeight,
          },
        },
      });

      const container = screen.getByTestId('chart-container');
      const computedHeight = parseInt(
        container.getAttribute('height') || '0',
        10,
      );
      const expectedHeight = Math.floor(
        authoredHeight * GRID_BASE_UNIT - CHART_MARGIN - DEFAULT_HEADER_HEIGHT,
      );

      expect(computedHeight).toEqual(expectedHeight);
    });
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('mobile consumption mode KPI tiles', () => {
    let restoreMatchMedia: () => void;
    let restoreFlag: () => void;

    const storeWithVizType = (vizType: string) =>
      createMockStore({
        sliceEntities: {
          ...mockState.sliceEntities,
          slices: {
            ...mockState.sliceEntities.slices,
            [chartId]: {
              ...mockState.sliceEntities.slices[chartId],
              viz_type: vizType,
            },
          },
        },
      });

    const renderedWidth = () =>
      parseInt(
        screen.getByTestId('chart-container').getAttribute('width') || '0',
        10,
      );

    const widthOf = (columns: number) =>
      Math.floor(
        columns * defaultProps.columnWidth +
          (columns - 1) * GRID_GUTTER_SIZE -
          CHART_MARGIN,
      );

    beforeEach(() => {
      restoreMatchMedia = mockMobileMatchMedia();
      restoreFlag = enableMobileConsumptionFlag();
    });

    afterEach(() => {
      restoreMatchMedia();
      restoreFlag();
    });

    test.each([
      [375, 1],
      [700, 2],
      [900, 3],
    ])(
      'at %ipx a big number in a row shares its line %i to a line and caps its height',
      (viewportWidth, tilesPerLine) => {
        restoreMatchMedia();
        restoreMatchMedia = mockMobileMatchMedia(viewportWidth);
        renderWrapper(storeWithVizType('big_number_total'), {
          fullSizeChartId: null,
          component: {
            ...defaultProps.component,
            meta: { ...defaultProps.component.meta, width: 4, height: 50 },
          },
        });

        expect(
          screen.getByTestId('dashboard-component-chart-holder'),
        ).toHaveClass(
          MOBILE_TILE_CLASS,
          `${MOBILE_TILE_CLASS}-${tilesPerLine}`,
        );
        expect(renderedWidth()).toEqual(
          widthOf(GRID_COLUMN_COUNT / tilesPerLine),
        );
        expect(
          parseInt(
            screen.getByTestId('chart-container').getAttribute('height') || '0',
            10,
          ),
        ).toEqual(
          Math.floor(
            MOBILE_TILE_MAX_ROW_UNITS * GRID_BASE_UNIT -
              CHART_MARGIN -
              DEFAULT_HEADER_HEIGHT,
          ),
        );
      },
    );

    test('other charts and wide big numbers take a full line', () => {
      const { unmount } = renderWrapper(storeWithVizType('pie'), {
        fullSizeChartId: null,
      });
      expect(
        screen.getByTestId('dashboard-component-chart-holder'),
      ).not.toHaveClass(MOBILE_TILE_CLASS);
      expect(renderedWidth()).toEqual(widthOf(GRID_COLUMN_COUNT));
      unmount();

      renderWrapper(storeWithVizType('big_number'), {
        fullSizeChartId: null,
        component: {
          ...defaultProps.component,
          meta: { ...defaultProps.component.meta, width: 8 },
        },
      });
      expect(
        screen.getByTestId('dashboard-component-chart-holder'),
      ).not.toHaveClass(MOBILE_TILE_CLASS);
      expect(renderedWidth()).toEqual(widthOf(GRID_COLUMN_COUNT));
    });

    test('big numbers keep their desktop width in edit mode', () => {
      renderWrapper(storeWithVizType('big_number_total'), {
        fullSizeChartId: null,
        editMode: true,
      });
      expect(
        screen.getByTestId('dashboard-component-chart-holder'),
      ).not.toHaveClass(MOBILE_TILE_CLASS);
      expect(renderedWidth()).toEqual(
        widthOf(defaultProps.component.meta.width),
      );
    });
  });

  test('big numbers keep their desktop width on desktop', () => {
    renderWrapper(
      createMockStore({
        sliceEntities: {
          ...mockState.sliceEntities,
          slices: {
            ...mockState.sliceEntities.slices,
            [chartId]: {
              ...mockState.sliceEntities.slices[chartId],
              viz_type: 'big_number_total',
            },
          },
        },
      }),
      { fullSizeChartId: null },
    );
    expect(
      screen.getByTestId('dashboard-component-chart-holder'),
    ).not.toHaveClass(MOBILE_TILE_CLASS);
  });

  test('should call deleteComponent when deleted', async () => {
    const deleteComponent = jest.fn();
    const store = createMockStore();
    const { rerender } = renderWrapper(store, {
      editMode: false,
      fullSizeChartId: null,
      deleteComponent,
    });

    expect(
      screen.queryByTestId('dashboard-delete-component-button'),
    ).not.toBeInTheDocument();

    rerender(
      <Provider store={store}>
        <ChartHolder
          {...defaultProps}
          deleteComponent={deleteComponent}
          fullSizeChartId={null}
          editMode
          isInView
        />
      </Provider>,
    );

    expect(
      screen.getByTestId('dashboard-delete-component-button'),
    ).toBeInTheDocument();

    userEvent.hover(screen.getByTestId('dashboard-component-chart-holder'));

    fireEvent.click(
      screen.getByTestId('dashboard-delete-component-button')
        .firstElementChild!,
    );
    expect(deleteComponent).toHaveBeenCalledTimes(1);
  });
});
