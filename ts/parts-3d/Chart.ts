/* *
 *
 *  (c) 2010-2020 Torstein Honsi
 *
 *  Extension for 3D charts
 *
 *  License: www.highcharts.com/license
 *
 *  !!!!!!! SOURCE GETS TRANSPILED BY TYPESCRIPT. EDIT TS FILE ONLY. !!!!!!!
 *
 * */

'use strict';

import H from '../parts/Globals.js';

/**
 * Internal types
 * @private
 */
declare global {
    namespace Highcharts {
        interface Chart {
            get3dFrame(): Chart3dFrameObject;
            is3d(): boolean;
            retrieveStacks(stacking?: string): Stack3dDictionary;
        }
        interface Chart3dFrameObject extends Chart3dFrameOptions {
            axes: Dictionary<Dictionary<(Edge3dObject|null)>>;
            back: Chart3dFrameSideObject;
            bottom: Chart3dFrameSideObject;
            front: Chart3dFrameSideObject;
            left: Chart3dFrameSideObject;
            right: Chart3dFrameSideObject;
            top: Chart3dFrameSideObject;
        }
        interface Chart3dFrameOptions {
            back?: Chart3dFrameSideOptions;
            bottom?: Chart3dFrameSideOptions;
            front?: Chart3dFrameSideOptions;
            left?: Chart3dFrameSideOptions;
            right?: Chart3dFrameSideOptions;
            size?: number;
            top?: Chart3dFrameSideOptions;
            visible?: string;
        }
        interface Chart3dFrameSideObject extends Chart3dFrameSideOptions {
            frontFacing: boolean;
            size: number;
        }
        interface Chart3dFrameSideOptions {
            color?: (ColorString|GradientColorObject|PatternObject);
            size?: number;
            visible?: ('auto'|'default'|boolean);
        }
        interface Chart3dOptions {
            alpha?: number;
            axisLabelPosition?: ('auto'|null);
            beta?: number;
            depth?: number;
            enabled?: boolean;
            fitToPlot?: boolean;
            frame?: Chart3dFrameOptions;
            viewDistance?: number;
        }
        interface ChartOptions {
            options3d?: Chart3dOptions;
        }
        interface Edge3dObject extends Position3dObject {
            xDir?: Position3dObject;
        }
        interface Fx {
            matrixSetter?(): void;
        }
        interface Stack3dDictionary {
            [index: number]: Stack3dDictionaryObject;
            totalStacks: number;
        }
        interface Stack3dDictionaryObject {
            position: number;
            series: Array<Series>;
        }
    }
}

import U from '../parts/Utilities.js';
const {
    addEvent,
    isArray,
    pick,
    wrap
} = U;

import '../parts/Chart.js';

var Chart = H.Chart,
    merge = H.merge,
    perspective = H.perspective;

/**
 * Shorthand to check the is3d flag.
 * @private
 * @return {boolean}
 *         Whether it is a 3D chart.
 */
Chart.prototype.is3d = function (): boolean {
    return (
        (this.options.chart as any).options3d &&
        (this.options.chart as any).options3d.enabled
    ); // #4280
};

Chart.prototype.propsRequireDirtyBox.push('chart.options3d');
Chart.prototype.propsRequireUpdateSeries.push('chart.options3d');

/* eslint-disable no-invalid-this */

// Legacy support for HC < 6 to make 'scatter' series in a 3D chart route to the
// real 'scatter3d' series type.
addEvent(Chart, 'afterInit', function (): void {
    var options = this.options;

    if (this.is3d()) {
        (options.series || []).forEach(function (
            s: Highcharts.SeriesOptions
        ): void {
            var type = s.type ||
                (options.chart as any).type ||
                (options.chart as any).defaultSeriesType;

            if (type === 'scatter') {
                s.type = 'scatter3d';
            }
        });
    }
});
// And do it on dynamic add (#8407)
addEvent(Chart, 'addSeries', function (
    e: {
        options: Highcharts.SeriesOptions;
    }
): void {
    if (this.is3d()) {
        if (e.options.type === 'scatter') {
            e.options.type = 'scatter3d';
        }
    }
});

/**
 * Calculate scale of the 3D view. That is required to
 * fit chart's 3D projection into the actual plotting area. Reported as #4933.
 * @notice This function should ideally take the plot values instead of a chart
 *         object, but since the chart object is needed for perspective it is
 *         not practical. Possible to make both getScale and perspective more
 *         logical and also immutable.
 *
 * @private
 * @function getScale
 *
 * @param {Highcharts.Chart} chart
 * Chart object
 *
 * @param {number} depth
 * The depth of the chart
 *
 * @return {number}
 * The scale to fit the 3D chart into the plotting area.
 *
 * @requires highcharts-3d
 */
function getScale(chart: Highcharts.Chart, depth: number): number {
    var plotLeft = chart.plotLeft,
        plotRight = chart.plotWidth + plotLeft,
        plotTop = chart.plotTop,
        plotBottom = chart.plotHeight + plotTop,
        originX = plotLeft + chart.plotWidth / 2,
        originY = plotTop + chart.plotHeight / 2,
        bbox3d = {
            minX: Number.MAX_VALUE,
            maxX: -Number.MAX_VALUE,
            minY: Number.MAX_VALUE,
            maxY: -Number.MAX_VALUE
        },
        corners: Array<Highcharts.Position3dObject>,
        scale = 1;

    // Top left corners:
    corners = [{
        x: plotLeft,
        y: plotTop,
        z: 0
    }, {
        x: plotLeft,
        y: plotTop,
        z: depth
    }];

    // Top right corners:
    [0, 1].forEach(function (i: number): void {
        corners.push({
            x: plotRight,
            y: corners[i].y,
            z: corners[i].z
        });
    });

    // All bottom corners:
    [0, 1, 2, 3].forEach(function (i: number): void {
        corners.push({
            x: corners[i].x,
            y: plotBottom,
            z: corners[i].z
        });
    });

    // Calculate 3D corners:
    corners = perspective(corners, chart, false);

    // Get bounding box of 3D element:
    corners.forEach(function (corner: Highcharts.Position3dObject): void {
        bbox3d.minX = Math.min(bbox3d.minX, corner.x);
        bbox3d.maxX = Math.max(bbox3d.maxX, corner.x);
        bbox3d.minY = Math.min(bbox3d.minY, corner.y);
        bbox3d.maxY = Math.max(bbox3d.maxY, corner.y);
    });

    // Left edge:
    if (plotLeft > bbox3d.minX) {
        scale = Math.min(
            scale,
            1 - Math.abs((plotLeft + originX) / (bbox3d.minX + originX)) % 1
        );
    }

    // Right edge:
    if (plotRight < bbox3d.maxX) {
        scale = Math.min(
            scale,
            (plotRight - originX) / (bbox3d.maxX - originX)
        );
    }

    // Top edge:
    if (plotTop > bbox3d.minY) {
        if (bbox3d.minY < 0) {
            scale = Math.min(
                scale,
                (plotTop + originY) / (-bbox3d.minY + plotTop + originY)
            );
        } else {
            scale = Math.min(
                scale,
                1 - (plotTop + originY) / (bbox3d.minY + originY) % 1
            );
        }
    }

    // Bottom edge:
    if (plotBottom < bbox3d.maxY) {
        scale = Math.min(
            scale,
            Math.abs((plotBottom - originY) / (bbox3d.maxY - originY))
        );
    }

    return scale;
}


wrap(H.Chart.prototype, 'isInsidePlot', function (
    this: Highcharts.Chart,
    proceed: Function
): boolean {
    return this.is3d() || proceed.apply(this, [].slice.call(arguments, 1));
});

var defaultOptions = H.getOptions();

/**
 * @optionparent
 */
var extendedOptions: Highcharts.Options = {

    chart: {

        /**
         * Options to render charts in 3 dimensions. This feature requires
         * `highcharts-3d.js`, found in the download package or online at
         * [code.highcharts.com/highcharts-3d.js](https://code.highcharts.com/highcharts-3d.js).
         *
         * @since    4.0
         * @product  highcharts
         * @requires highcharts-3d
         */
        options3d: {

            /**
             * Wether to render the chart using the 3D functionality.
             *
             * @since   4.0
             * @product highcharts
             */
            enabled: false,

            /**
             * One of the two rotation angles for the chart.
             *
             * @since   4.0
             * @product highcharts
             */
            alpha: 0,

            /**
             * One of the two rotation angles for the chart.
             *
             * @since   4.0
             * @product highcharts
             */
            beta: 0,

            /**
             * The total depth of the chart.
             *
             * @since   4.0
             * @product highcharts
             */
            depth: 100,

            /**
             * Whether the 3d box should automatically adjust to the chart plot
             * area.
             *
             * @since   4.2.4
             * @product highcharts
             */
            fitToPlot: true,

            /**
             * Defines the distance the viewer is standing in front of the
             * chart, this setting is important to calculate the perspective
             * effect in column and scatter charts. It is not used for 3D pie
             * charts.
             *
             * @since   4.0
             * @product highcharts
             */
            viewDistance: 25,

            /**
             * Set it to `"auto"` to automatically move the labels to the best
             * edge.
             *
             * @type    {"auto"|null}
             * @since   5.0.12
             * @product highcharts
             */
            axisLabelPosition: null,

            /**
             * Provides the option to draw a frame around the charts by defining
             * a bottom, front and back panel.
             *
             * @since    4.0
             * @product  highcharts
             * @requires highcharts-3d
             */
            frame: {

                /**
                 * Whether the frames are visible.
                 */
                visible: 'default',

                /**
                 * General pixel thickness for the frame faces.
                 */
                size: 1,

                /**
                 * The bottom of the frame around a 3D chart.
                 *
                 * @since    4.0
                 * @product  highcharts
                 * @requires highcharts-3d
                 */

                /**
                 * The color of the panel.
                 *
                 * @type      {Highcharts.ColorString|Highcharts.GradientColorObject|Highcharts.PatternObject}
                 * @default   transparent
                 * @since     4.0
                 * @product   highcharts
                 * @apioption chart.options3d.frame.bottom.color
                 */

                /**
                 * The thickness of the panel.
                 *
                 * @type      {number}
                 * @default   1
                 * @since     4.0
                 * @product   highcharts
                 * @apioption chart.options3d.frame.bottom.size
                 */

                /**
                 * Whether to display the frame. Possible values are `true`,
                 * `false`, `"auto"` to display only the frames behind the data,
                 * and `"default"` to display faces behind the data based on the
                 * axis layout, ignoring the point of view.
                 *
                 * @sample {highcharts} highcharts/3d/scatter-frame/
                 *         Auto frames
                 *
                 * @type      {boolean|"default"|"auto"}
                 * @default   default
                 * @since     5.0.12
                 * @product   highcharts
                 * @apioption chart.options3d.frame.bottom.visible
                 */

                /**
                 * The bottom of the frame around a 3D chart.
                 */
                bottom: {},

                /**
                 * The top of the frame around a 3D chart.
                 *
                 * @extends chart.options3d.frame.bottom
                 */
                top: {},

                /**
                 * The left side of the frame around a 3D chart.
                 *
                 * @extends chart.options3d.frame.bottom
                 */
                left: {},

                /**
                 * The right of the frame around a 3D chart.
                 *
                 * @extends chart.options3d.frame.bottom
                 */
                right: {},

                /**
                 * The back side of the frame around a 3D chart.
                 *
                 * @extends chart.options3d.frame.bottom
                 */
                back: {},

                /**
                 * The front of the frame around a 3D chart.
                 *
                 * @extends chart.options3d.frame.bottom
                 */
                front: {}
            }
        }
    }
};

merge(true, defaultOptions, extendedOptions);

// Add the required CSS classes for column sides (#6018)
addEvent(Chart, 'afterGetContainer', function (): void {
    if (this.styledMode) {
        this.renderer.definition({
            tagName: 'style',
            textContent:
                '.highcharts-3d-top{' +
                    'filter: url(#highcharts-brighter)' +
                '}\n' +
                '.highcharts-3d-side{' +
                    'filter: url(#highcharts-darker)' +
                '}\n'
        });

        // Add add definitions used by brighter and darker faces of the cuboids.
        [{
            name: 'darker',
            slope: 0.6
        }, {
            name: 'brighter',
            slope: 1.4
        }].forEach(function (cfg): void {
            this.renderer.definition({
                tagName: 'filter',
                id: 'highcharts-' + cfg.name,
                children: [{
                    tagName: 'feComponentTransfer',
                    children: [{
                        tagName: 'feFuncR',
                        type: 'linear',
                        slope: cfg.slope
                    }, {
                        tagName: 'feFuncG',
                        type: 'linear',
                        slope: cfg.slope
                    }, {
                        tagName: 'feFuncB',
                        type: 'linear',
                        slope: cfg.slope
                    }]
                }]
            });
        }, this);
    }
});

wrap(Chart.prototype, 'setClassName', function (
    this: Highcharts.Chart,
    proceed: Function
): void {
    proceed.apply(this, [].slice.call(arguments, 1));

    if (this.is3d()) {
        this.container.className += ' highcharts-3d-chart';
    }
});

addEvent(H.Chart, 'afterSetChartSize', function (): void {
    var chart = this,
        options3d = (chart.options.chart as any).options3d;

    if (chart.is3d()) {

        // Add a 0-360 normalisation for alfa and beta angles in 3d graph
        if (options3d) {
            options3d.alpha = options3d.alpha % 360 + (options3d.alpha >= 0 ? 0 : 360);
            options3d.beta = options3d.beta % 360 + (options3d.beta >= 0 ? 0 : 360);
        }

        var inverted = chart.inverted,
            clipBox = chart.clipBox,
            margin = chart.margin,
            x = inverted ? 'y' : 'x',
            y = inverted ? 'x' : 'y',
            w = inverted ? 'height' : 'width',
            h = inverted ? 'width' : 'height';

        (clipBox as any)[x] = -(margin[3] || 0);
        (clipBox as any)[y] = -(margin[0] || 0);
        (clipBox as any)[w] =
            chart.chartWidth + (margin[3] || 0) + (margin[1] || 0);
        (clipBox as any)[h] =
            chart.chartHeight + (margin[0] || 0) + (margin[2] || 0);

        // Set scale, used later in perspective method():
        // getScale uses perspective, so scale3d has to be reset.
        chart.scale3d = 1;
        if (options3d.fitToPlot === true) {
            chart.scale3d = getScale(chart, options3d.depth);
        }
        // Recalculate the 3d frame with every call of setChartSize,
        // instead of doing it after every redraw(). It avoids ticks
        // and axis title outside of chart.
        chart.frame3d = this.get3dFrame(); // #7942
    }
});

addEvent(Chart, 'beforeRedraw', function (): void {
    if (this.is3d()) {
        // Set to force a redraw of all elements
        this.isDirtyBox = true;
    }
});

addEvent(Chart, 'beforeRender', function (): void {
    if (this.is3d()) {
        this.frame3d = this.get3dFrame();
    }
});

// Draw the series in the reverse order (#3803, #3917)
wrap(Chart.prototype, 'renderSeries', function (
    this: Highcharts.Chart,
    proceed: Function
): void {
    var series,
        i = this.series.length;

    if (this.is3d()) {
        while (i--) {
            series = this.series[i];
            series.translate();
            series.render();
        }
    } else {
        proceed.call(this);
    }
});

addEvent(Chart, 'afterDrawChartBox', function (): void {
    if (this.is3d()) {
        var chart = this,
            renderer = chart.renderer,
            options3d = (this.options.chart as any).options3d,
            frame = chart.get3dFrame(),
            xm = this.plotLeft,
            xp = this.plotLeft + this.plotWidth,
            ym = this.plotTop,
            yp = this.plotTop + this.plotHeight,
            zm = 0,
            zp = options3d.depth,
            xmm = xm - (frame.left.visible ? frame.left.size : 0),
            xpp = xp + (frame.right.visible ? frame.right.size : 0),
            ymm = ym - (frame.top.visible ? frame.top.size : 0),
            ypp = yp + (frame.bottom.visible ? frame.bottom.size : 0),
            zmm = zm - (frame.front.visible ? frame.front.size : 0),
            zpp = zp + (frame.back.visible ? frame.back.size : 0),
            verb = chart.hasRendered ? 'animate' : 'attr';

        this.frame3d = frame;

        if (!this.frameShapes) {
            this.frameShapes = {
                bottom: renderer.polyhedron().add(),
                top: renderer.polyhedron().add(),
                left: renderer.polyhedron().add(),
                right: renderer.polyhedron().add(),
                back: renderer.polyhedron().add(),
                front: renderer.polyhedron().add()
            };
        }
        this.frameShapes.bottom[verb]({
            'class': 'highcharts-3d-frame highcharts-3d-frame-bottom',
            zIndex: frame.bottom.frontFacing ? -1000 : 1000,
            faces: [{ // bottom
                fill: H.color(frame.bottom.color).brighten(0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xmm,
                    y: ypp,
                    z: zpp
                }],
                enabled: frame.bottom.visible
            },
            { // top
                fill: H.color(frame.bottom.color).brighten(0.1).get(),
                vertexes: [{
                    x: xm,
                    y: yp,
                    z: zp
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }],
                enabled: frame.bottom.visible
            },
            { // left
                fill: H.color(frame.bottom.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xmm,
                    y: ypp,
                    z: zpp
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }],
                enabled: frame.bottom.visible && !frame.left.visible
            },
            { // right
                fill: H.color(frame.bottom.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }],
                enabled: frame.bottom.visible && !frame.right.visible
            },
            { // front
                fill: H.color(frame.bottom.color).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }],
                enabled: frame.bottom.visible && !frame.front.visible
            },
            { // back
                fill: H.color(frame.bottom.color).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zpp
                }, {
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }],
                enabled: frame.bottom.visible && !frame.back.visible
            }]
        });
        this.frameShapes.top[verb]({
            'class': 'highcharts-3d-frame highcharts-3d-frame-top',
            zIndex: frame.top.frontFacing ? -1000 : 1000,
            faces: [{ // bottom
                fill: H.color(frame.top.color).brighten(0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xmm,
                    y: ymm,
                    z: zmm
                }],
                enabled: frame.top.visible
            },
            { // top
                fill: H.color(frame.top.color).brighten(0.1).get(),
                vertexes: [{
                    x: xm,
                    y: ym,
                    z: zm
                }, {
                    x: xp,
                    y: ym,
                    z: zm
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }, {
                    x: xm,
                    y: ym,
                    z: zp
                }],
                enabled: frame.top.visible
            },
            { // left
                fill: H.color(frame.top.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xmm,
                    y: ymm,
                    z: zmm
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }, {
                    x: xm,
                    y: ym,
                    z: zp
                }],
                enabled: frame.top.visible && !frame.left.visible
            },
            { // right
                fill: H.color(frame.top.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }, {
                    x: xp,
                    y: ym,
                    z: zm
                }],
                enabled: frame.top.visible && !frame.right.visible
            },
            { // front
                fill: H.color(frame.top.color).get(),
                vertexes: [{
                    x: xmm,
                    y: ymm,
                    z: zmm
                }, {
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xp,
                    y: ym,
                    z: zm
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }],
                enabled: frame.top.visible && !frame.front.visible
            },
            { // back
                fill: H.color(frame.top.color).get(),
                vertexes: [{
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xm,
                    y: ym,
                    z: zp
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }],
                enabled: frame.top.visible && !frame.back.visible
            }]
        });
        this.frameShapes.left[verb]({
            'class': 'highcharts-3d-frame highcharts-3d-frame-left',
            zIndex: frame.left.frontFacing ? -1000 : 1000,
            faces: [{ // bottom
                fill: H.color(frame.left.color).brighten(0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }, {
                    x: xmm,
                    y: ypp,
                    z: zpp
                }],
                enabled: frame.left.visible && !frame.bottom.visible
            },
            { // top
                fill: H.color(frame.left.color).brighten(0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xm,
                    y: ym,
                    z: zp
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }, {
                    x: xmm,
                    y: ymm,
                    z: zmm
                }],
                enabled: frame.left.visible && !frame.top.visible
            },
            { // left
                fill: H.color(frame.left.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zpp
                }, {
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xmm,
                    y: ymm,
                    z: zmm
                }, {
                    x: xmm,
                    y: ypp,
                    z: zmm
                }],
                enabled: frame.left.visible
            },
            { // right
                fill: H.color(frame.left.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xm,
                    y: ym,
                    z: zp
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }],
                enabled: frame.left.visible
            },
            { // front
                fill: H.color(frame.left.color).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xmm,
                    y: ymm,
                    z: zmm
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }],
                enabled: frame.left.visible && !frame.front.visible
            },
            { // back
                fill: H.color(frame.left.color).get(),
                vertexes: [{
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xmm,
                    y: ypp,
                    z: zpp
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }, {
                    x: xm,
                    y: ym,
                    z: zp
                }],
                enabled: frame.left.visible && !frame.back.visible
            }]
        });
        this.frameShapes.right[verb]({
            'class': 'highcharts-3d-frame highcharts-3d-frame-right',
            zIndex: frame.right.frontFacing ? -1000 : 1000,
            faces: [{ // bottom
                fill: H.color(frame.right.color).brighten(0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }, {
                    x: xpp,
                    y: ypp,
                    z: zmm
                }],
                enabled: frame.right.visible && !frame.bottom.visible
            },
            { // top
                fill: H.color(frame.right.color).brighten(0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xp,
                    y: ym,
                    z: zm
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }, {
                    x: xpp,
                    y: ymm,
                    z: zpp
                }],
                enabled: frame.right.visible && !frame.top.visible
            },
            { // left
                fill: H.color(frame.right.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xp,
                    y: ym,
                    z: zm
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }],
                enabled: frame.right.visible
            },
            { // right
                fill: H.color(frame.right.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xpp,
                    y: ypp,
                    z: zpp
                }],
                enabled: frame.right.visible
            },
            { // front
                fill: H.color(frame.right.color).get(),
                vertexes: [{
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }, {
                    x: xp,
                    y: ym,
                    z: zm
                }],
                enabled: frame.right.visible && !frame.front.visible
            },
            { // back
                fill: H.color(frame.right.color).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }],
                enabled: frame.right.visible && !frame.back.visible
            }]
        });
        this.frameShapes.back[verb]({
            'class': 'highcharts-3d-frame highcharts-3d-frame-back',
            zIndex: frame.back.frontFacing ? -1000 : 1000,
            faces: [{ // bottom
                fill: H.color(frame.back.color).brighten(0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xmm,
                    y: ypp,
                    z: zpp
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }],
                enabled: frame.back.visible && !frame.bottom.visible
            },
            { // top
                fill: H.color(frame.back.color).brighten(0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }, {
                    x: xm,
                    y: ym,
                    z: zp
                }],
                enabled: frame.back.visible && !frame.top.visible
            },
            { // left
                fill: H.color(frame.back.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zpp
                }, {
                    x: xmm,
                    y: ymm,
                    z: zpp
                }, {
                    x: xm,
                    y: ym,
                    z: zp
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }],
                enabled: frame.back.visible && !frame.left.visible
            },
            { // right
                fill: H.color(frame.back.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }],
                enabled: frame.back.visible && !frame.right.visible
            },
            { // front
                fill: H.color(frame.back.color).get(),
                vertexes: [{
                    x: xm,
                    y: ym,
                    z: zp
                }, {
                    x: xp,
                    y: ym,
                    z: zp
                }, {
                    x: xp,
                    y: yp,
                    z: zp
                }, {
                    x: xm,
                    y: yp,
                    z: zp
                }],
                enabled: frame.back.visible
            },
            { // back
                fill: H.color(frame.back.color).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zpp
                }, {
                    x: xpp,
                    y: ypp,
                    z: zpp
                }, {
                    x: xpp,
                    y: ymm,
                    z: zpp
                }, {
                    x: xmm,
                    y: ymm,
                    z: zpp
                }],
                enabled: frame.back.visible
            }]
        });
        this.frameShapes.front[verb]({
            'class': 'highcharts-3d-frame highcharts-3d-frame-front',
            zIndex: frame.front.frontFacing ? -1000 : 1000,
            faces: [{ // bottom
                fill: H.color(frame.front.color).brighten(0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }],
                enabled: frame.front.visible && !frame.bottom.visible
            },
            { // top
                fill: H.color(frame.front.color).brighten(0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xmm,
                    y: ymm,
                    z: zmm
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }, {
                    x: xp,
                    y: ym,
                    z: zm
                }],
                enabled: frame.front.visible && !frame.top.visible
            },
            { // left
                fill: H.color(frame.front.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xmm,
                    y: ymm,
                    z: zmm
                }, {
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }],
                enabled: frame.front.visible && !frame.left.visible
            },
            { // right
                fill: H.color(frame.front.color).brighten(-0.1).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xpp,
                    y: ymm,
                    z: zmm
                }, {
                    x: xp,
                    y: ym,
                    z: zm
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }],
                enabled: frame.front.visible && !frame.right.visible
            },
            { // front
                fill: H.color(frame.front.color).get(),
                vertexes: [{
                    x: xp,
                    y: ym,
                    z: zm
                }, {
                    x: xm,
                    y: ym,
                    z: zm
                }, {
                    x: xm,
                    y: yp,
                    z: zm
                }, {
                    x: xp,
                    y: yp,
                    z: zm
                }],
                enabled: frame.front.visible
            },
            { // back
                fill: H.color(frame.front.color).get(),
                vertexes: [{
                    x: xpp,
                    y: ypp,
                    z: zmm
                }, {
                    x: xmm,
                    y: ypp,
                    z: zmm
                }, {
                    x: xmm,
                    y: ymm,
                    z: zmm
                }, {
                    x: xpp,
                    y: ymm,
                    z: zmm
                }],
                enabled: frame.front.visible
            }]
        });
    }
});

Chart.prototype.retrieveStacks = function (
    stacking?: string
): Highcharts.Stack3dDictionary {
    var series = this.series,
        stacks = {} as Highcharts.Stack3dDictionary,
        stackNumber: number,
        i = 1;

    this.series.forEach(function (s: Highcharts.Series): void {
        stackNumber = pick(
            s.options.stack as any,
            (stacking ? 0 : series.length - 1 - (s.index as any))
        ); // #3841, #4532
        if (!stacks[stackNumber]) {
            stacks[stackNumber] = { series: [s], position: i };
            i++;
        } else {
            stacks[stackNumber].series.push(s);
        }
    });

    stacks.totalStacks = i + 1;
    return stacks;
};

Chart.prototype.get3dFrame = function (): Highcharts.Chart3dFrameObject {
    var chart = this,
        options3d = (chart.options.chart as any).options3d,
        frameOptions = options3d.frame,
        xm = chart.plotLeft,
        xp = chart.plotLeft + chart.plotWidth,
        ym = chart.plotTop,
        yp = chart.plotTop + chart.plotHeight,
        zm = 0,
        zp = options3d.depth,
        faceOrientation = function (
            vertexes: Array<Highcharts.Position3dObject>
        ): number {
            var area = H.shapeArea3d(vertexes, chart);

            // Give it 0.5 squared-pixel as a margin for rounding errors.
            if (area > 0.5) {
                return 1;
            }
            if (area < -0.5) {
                return -1;
            }
            return 0;
        },
        bottomOrientation = faceOrientation([
            { x: xm, y: yp, z: zp },
            { x: xp, y: yp, z: zp },
            { x: xp, y: yp, z: zm },
            { x: xm, y: yp, z: zm }
        ]),
        topOrientation = faceOrientation([
            { x: xm, y: ym, z: zm },
            { x: xp, y: ym, z: zm },
            { x: xp, y: ym, z: zp },
            { x: xm, y: ym, z: zp }
        ]),
        leftOrientation = faceOrientation([
            { x: xm, y: ym, z: zm },
            { x: xm, y: ym, z: zp },
            { x: xm, y: yp, z: zp },
            { x: xm, y: yp, z: zm }
        ]),
        rightOrientation = faceOrientation([
            { x: xp, y: ym, z: zp },
            { x: xp, y: ym, z: zm },
            { x: xp, y: yp, z: zm },
            { x: xp, y: yp, z: zp }
        ]),
        frontOrientation = faceOrientation([
            { x: xm, y: yp, z: zm },
            { x: xp, y: yp, z: zm },
            { x: xp, y: ym, z: zm },
            { x: xm, y: ym, z: zm }
        ]),
        backOrientation = faceOrientation([
            { x: xm, y: ym, z: zp },
            { x: xp, y: ym, z: zp },
            { x: xp, y: yp, z: zp },
            { x: xm, y: yp, z: zp }
        ]),
        defaultShowBottom = false,
        defaultShowTop = false,
        defaultShowLeft = false,
        defaultShowRight = false,
        defaultShowFront = false,
        defaultShowBack = true;

    // The 'default' criteria to visible faces of the frame is looking up every
    // axis to decide whenever the left/right//top/bottom sides of the frame
    // will be shown
    ([] as Array<Highcharts.Axis>)
        .concat(chart.xAxis, chart.yAxis, chart.zAxis as any)
        .forEach(function (axis: Highcharts.Axis): void {
            if (axis) {
                if (axis.horiz) {
                    if (axis.opposite) {
                        defaultShowTop = true;
                    } else {
                        defaultShowBottom = true;
                    }
                } else {
                    if (axis.opposite) {
                        defaultShowRight = true;
                    } else {
                        defaultShowLeft = true;
                    }
                }
            }
        });

    var getFaceOptions = function (
        sources: Array<unknown>,
        faceOrientation: number,
        defaultVisible?: ('auto'|'default'|boolean)
    ): Highcharts.Chart3dFrameSideObject {
        var faceAttrs = ['size', 'color', 'visible'];
        var options = {} as Highcharts.Chart3dFrameSideOptions;

        for (var i = 0; i < faceAttrs.length; i++) {
            var attr = faceAttrs[i];

            for (var j = 0; j < sources.length; j++) {
                if (typeof sources[j] === 'object') {
                    var val = (sources[j] as any)[attr];

                    if (typeof val !== 'undefined' && val !== null) {
                        (options as any)[attr] = val;
                        break;
                    }
                }
            }
        }
        var isVisible = defaultVisible;

        if (options.visible === true || options.visible === false) {
            isVisible = options.visible;
        } else if (options.visible === 'auto') {
            isVisible = faceOrientation > 0;
        }

        return {
            size: pick(options.size, 1),
            color: pick(options.color, 'none'),
            frontFacing: faceOrientation > 0,
            visible: isVisible
        };
    };

    // docs @TODO: Add all frame options (left, right, top, bottom, front, back)
    // to apioptions JSDoc once the new system is up.
    var ret: Highcharts.Chart3dFrameObject = {
        axes: {},
        // FIXME: Previously, left/right, top/bottom and front/back pairs shared
        // size and color.
        // For compatibility and consistency sake, when one face have
        // size/color/visibility set, the opposite face will default to the same
        // values. Also, left/right used to be called 'side', so that's also
        // added as a fallback
        bottom: getFaceOptions(
            [frameOptions.bottom, frameOptions.top, frameOptions],
            bottomOrientation,
            defaultShowBottom
        ),
        top: getFaceOptions(
            [frameOptions.top, frameOptions.bottom, frameOptions],
            topOrientation,
            defaultShowTop
        ),
        left: getFaceOptions(
            [
                frameOptions.left,
                frameOptions.right,
                frameOptions.side,
                frameOptions
            ],
            leftOrientation,
            defaultShowLeft
        ),
        right: getFaceOptions(
            [
                frameOptions.right,
                frameOptions.left,
                frameOptions.side,
                frameOptions
            ],
            rightOrientation,
            defaultShowRight
        ),
        back: getFaceOptions(
            [frameOptions.back, frameOptions.front, frameOptions],
            backOrientation,
            defaultShowBack
        ),
        front: getFaceOptions(
            [frameOptions.front, frameOptions.back, frameOptions],
            frontOrientation,
            defaultShowFront
        )
    };


    // Decide the bast place to put axis title/labels based on the visible
    // faces. Ideally, The labels can only be on the edge between a visible face
    // and an invisble one. Also, the Y label should be one the left-most edge
    // (right-most if opposite),
    if (options3d.axisLabelPosition === 'auto') {
        var isValidEdge = function (
            face1: Highcharts.Chart3dFrameSideObject,
            face2: Highcharts.Chart3dFrameSideObject
        ): (boolean|undefined) {
            return (
                (face1.visible !== face2.visible) ||
                (
                    face1.visible &&
                    face2.visible &&
                    (face1.frontFacing !== face2.frontFacing)
                )
            );
        };

        var yEdges = [] as Array<Highcharts.Edge3dObject>;

        if (isValidEdge(ret.left, ret.front)) {
            yEdges.push({
                y: (ym + yp) / 2,
                x: xm,
                z: zm,
                xDir: { x: 1, y: 0, z: 0 }
            });
        }
        if (isValidEdge(ret.left, ret.back)) {
            yEdges.push({
                y: (ym + yp) / 2,
                x: xm,
                z: zp,
                xDir: { x: 0, y: 0, z: -1 }
            });
        }
        if (isValidEdge(ret.right, ret.front)) {
            yEdges.push({
                y: (ym + yp) / 2,
                x: xp,
                z: zm,
                xDir: { x: 0, y: 0, z: 1 }
            });
        }
        if (isValidEdge(ret.right, ret.back)) {
            yEdges.push({
                y: (ym + yp) / 2,
                x: xp,
                z: zp,
                xDir: { x: -1, y: 0, z: 0 }
            });
        }

        var xBottomEdges = [] as Array<Highcharts.Edge3dObject>;

        if (isValidEdge(ret.bottom, ret.front)) {
            xBottomEdges.push({
                x: (xm + xp) / 2,
                y: yp,
                z: zm,
                xDir: { x: 1, y: 0, z: 0 }
            });
        }
        if (isValidEdge(ret.bottom, ret.back)) {
            xBottomEdges.push({
                x: (xm + xp) / 2,
                y: yp,
                z: zp,
                xDir: { x: -1, y: 0, z: 0 }
            });
        }

        var xTopEdges = [] as Array<Highcharts.Edge3dObject>;

        if (isValidEdge(ret.top, ret.front)) {
            xTopEdges.push({
                x: (xm + xp) / 2,
                y: ym,
                z: zm,
                xDir: { x: 1, y: 0, z: 0 }
            });
        }
        if (isValidEdge(ret.top, ret.back)) {
            xTopEdges.push({
                x: (xm + xp) / 2,
                y: ym,
                z: zp,
                xDir: { x: -1, y: 0, z: 0 }
            });
        }

        var zBottomEdges = [] as Array<Highcharts.Edge3dObject>;

        if (isValidEdge(ret.bottom, ret.left)) {
            zBottomEdges.push({
                z: (zm + zp) / 2,
                y: yp,
                x: xm,
                xDir: { x: 0, y: 0, z: -1 }
            });
        }
        if (isValidEdge(ret.bottom, ret.right)) {
            zBottomEdges.push({
                z: (zm + zp) / 2,
                y: yp,
                x: xp,
                xDir: { x: 0, y: 0, z: 1 }
            });
        }

        var zTopEdges = [] as Array<Highcharts.Edge3dObject>;

        if (isValidEdge(ret.top, ret.left)) {
            zTopEdges.push({
                z: (zm + zp) / 2,
                y: ym,
                x: xm,
                xDir: { x: 0, y: 0, z: -1 }
            });
        }
        if (isValidEdge(ret.top, ret.right)) {
            zTopEdges.push({
                z: (zm + zp) / 2,
                y: ym,
                x: xp,
                xDir: { x: 0, y: 0, z: 1 }
            });
        }

        var pickEdge = function (
            edges: Array<Highcharts.Edge3dObject>,
            axis: string,
            mult: number
        ): (Highcharts.Edge3dObject|null) {
            if (edges.length === 0) {
                return null;
            }
            if (edges.length === 1) {
                return edges[0];
            }
            var best = 0,
                projections = perspective(edges, chart, false);

            for (var i = 1; i < projections.length; i++) {
                if (
                    mult * (projections[i] as any)[axis] >
                    mult * (projections[best] as any)[axis]
                ) {
                    best = i;
                } else if (
                    (
                        mult * (projections[i] as any)[axis] ===
                        mult * (projections[best] as any)[axis]
                    ) &&
                    (projections[i].z < projections[best].z)
                ) {
                    best = i;
                }
            }
            return edges[best];
        };

        ret.axes = {
            y: {
                'left': pickEdge(yEdges, 'x', -1),
                'right': pickEdge(yEdges, 'x', +1)
            },
            x: {
                'top': pickEdge(xTopEdges, 'y', -1),
                'bottom': pickEdge(xBottomEdges, 'y', +1)
            },
            z: {
                'top': pickEdge(zTopEdges, 'y', -1),
                'bottom': pickEdge(zBottomEdges, 'y', +1)
            }
        };
    } else {
        ret.axes = {
            y: {
                'left': { x: xm, z: zm, xDir: { x: 1, y: 0, z: 0 } } as any,
                'right': { x: xp, z: zm, xDir: { x: 0, y: 0, z: 1 } } as any
            },
            x: {
                'top': { y: ym, z: zm, xDir: { x: 1, y: 0, z: 0 } } as any,
                'bottom': { y: yp, z: zm, xDir: { x: 1, y: 0, z: 0 } } as any
            },
            z: {
                'top': {
                    x: defaultShowLeft ? xp : xm,
                    y: ym,
                    xDir: defaultShowLeft ?
                        { x: 0, y: 0, z: 1 } :
                        { x: 0, y: 0, z: -1 }
                } as any,
                'bottom': {
                    x: defaultShowLeft ? xp : xm,
                    y: yp,
                    xDir: defaultShowLeft ?
                        { x: 0, y: 0, z: 1 } :
                        { x: 0, y: 0, z: -1 }
                } as any
            }
        };
    }

    return ret;
};

// Animation setter for matrix property.
H.Fx.prototype.matrixSetter = function (): void {
    var interpolated;

    if (this.pos < 1 &&
            (isArray(this.start) || isArray(this.end))) {
        var start = this.start || [1, 0, 0, 1, 0, 0];
        var end = this.end || [1, 0, 0, 1, 0, 0];

        interpolated = [];
        for (var i = 0; i < 6; i++) {
            interpolated.push(this.pos * end[i] + (1 - this.pos) * start[i]);
        }
    } else {
        interpolated = this.end;
    }

    (this.elem as any).attr(
        this.prop,
        interpolated,
        null,
        true
    );
};

/**
 * Note: As of v5.0.12, `frame.left` or `frame.right` should be used instead.
 *
 * The side for the frame around a 3D chart.
 *
 * @deprecated
 * @since     4.0
 * @product   highcharts
 * @requires  highcharts-3d
 * @apioption chart.options3d.frame.side
 */

/**
 * The color of the panel.
 *
 * @deprecated
 * @type      {Highcharts.ColorString|Highcharts.GradientColorObject|Highcharts.PatternObject}
 * @default   transparent
 * @since     4.0
 * @product   highcharts
 * @apioption chart.options3d.frame.side.color
 */

/**
 * The thickness of the panel.
 *
 * @deprecated
 * @type      {number}
 * @default   1
 * @since     4.0
 * @product   highcharts
 * @apioption chart.options3d.frame.side.size
 */

''; // adds doclets above to transpiled file
