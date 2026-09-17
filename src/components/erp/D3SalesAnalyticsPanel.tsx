import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { useApp } from '../../context/AppContext';
import { Order, Product } from '../../types';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  BarChart2,
  LineChart,
  PieChart,
  Download,
  FileSpreadsheet,
  Coins,
  Maximize2,
  RefreshCw,
  Sparkles,
  Info,
  CalendarRange,
} from 'lucide-react';
import { formatUSD, formatBs, formatPlainNumber } from '../../utils/formatUtils';
import { exportToCSV } from '../../utils/exportUtils';

export type D3Granularity = 'daily' | 'monthly' | 'quarterly' | 'weekday';
export type D3CurrencyDisplay = 'dual' | 'USD' | 'BS';

interface DailyDataPoint {
  date: Date;
  dateKey: string;
  label: string;
  fullDate: string;
  salesUSD: number;
  salesBs: number;
  ordersCount: number;
  unitsCount: number;
  averageTicketUSD: number;
  averageTicketBs: number;
}

interface MonthlyDataPoint {
  monthKey: string; // "2026-09"
  label: string; // "Sep 2026"
  year: number;
  monthIndex: number;
  salesUSD: number;
  salesBs: number;
  ordersCount: number;
  unitsCount: number;
  growthPercentUSD: number; // vs previous month
  growthPercentBs: number;
}

interface WeekdayDataPoint {
  dayIndex: number;
  dayName: string;
  salesUSD: number;
  salesBs: number;
  ordersCount: number;
  avgSalesUSD: number;
  avgSalesBs: number;
}

export const D3SalesAnalyticsPanel: React.FC = () => {
  const { orders, products, settings } = useApp();

  // Control state
  const [granularity, setGranularity] = useState<D3Granularity>('daily');
  const [currencyMode, setCurrencyMode] = useState<D3CurrencyDisplay>('dual');
  const [timeRange, setTimeRange] = useState<'7d' | '14d' | '30d' | '90d' | 'ytd' | 'all'>('30d');
  const [chartType, setChartType] = useState<'area_line' | 'bars' | 'stacked'>('area_line');
  const [showMovingAverage, setShowMovingAverage] = useState(true);

  // SVG Chart Container References
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Filter valid (non-cancelled) orders based on timeframe
  const validOrders = useMemo(() => {
    return orders
      .filter((o) => o.orderStatus !== 'cancelado')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (timeRange === '7d') {
      const past7 = new Date(today);
      past7.setDate(past7.getDate() - 6);
      return validOrders.filter((o) => new Date(o.createdAt) >= past7);
    }
    if (timeRange === '14d') {
      const past14 = new Date(today);
      past14.setDate(past14.getDate() - 13);
      return validOrders.filter((o) => new Date(o.createdAt) >= past14);
    }
    if (timeRange === '30d') {
      const past30 = new Date(today);
      past30.setDate(past30.getDate() - 29);
      return validOrders.filter((o) => new Date(o.createdAt) >= past30);
    }
    if (timeRange === '90d') {
      const past90 = new Date(today);
      past90.setDate(past90.getDate() - 89);
      return validOrders.filter((o) => new Date(o.createdAt) >= past90);
    }
    if (timeRange === 'ytd') {
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      return validOrders.filter((o) => new Date(o.createdAt) >= startOfYear);
    }
    return validOrders;
  }, [validOrders, timeRange]);

  // 1. Process Daily Data for D3
  const dailyData: DailyDataPoint[] = useMemo(() => {
    const map: { [key: string]: DailyDataPoint } = {};

    // Populate all date slots in range for continuous curves
    if (filteredOrders.length > 0 && (timeRange === '7d' || timeRange === '14d' || timeRange === '30d')) {
      const daysCount = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
      const now = new Date();
      for (let i = daysCount - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toISOString().split('T')[0];
        map[key] = {
          date: d,
          dateKey: key,
          label: d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
          fullDate: d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
          salesUSD: 0,
          salesBs: 0,
          ordersCount: 0,
          unitsCount: 0,
          averageTicketUSD: 0,
          averageTicketBs: 0,
        };
      }
    }

    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = d.toISOString().split('T')[0];
      if (!map[key]) {
        map[key] = {
          date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          dateKey: key,
          label: d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' }),
          fullDate: d.toLocaleDateString('es-VE', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
          salesUSD: 0,
          salesBs: 0,
          ordersCount: 0,
          unitsCount: 0,
          averageTicketUSD: 0,
          averageTicketBs: 0,
        };
      }
      const rate = o.bcvRate || settings.bcvRate;
      map[key].salesUSD += o.totalUSD;
      map[key].salesBs += o.totalUSD * rate;
      map[key].ordersCount += 1;
      o.items.forEach((it) => {
        map[key].unitsCount += it.quantity;
      });
    });

    const list = Object.values(map).sort((a, b) => a.date.getTime() - b.date.getTime());
    list.forEach((item) => {
      item.averageTicketUSD = item.ordersCount > 0 ? item.salesUSD / item.ordersCount : 0;
      item.averageTicketBs = item.ordersCount > 0 ? item.salesBs / item.ordersCount : 0;
    });
    return list;
  }, [filteredOrders, settings.bcvRate, timeRange]);

  // 2. Process Monthly Data for D3
  const monthlyData: MonthlyDataPoint[] = useMemo(() => {
    const map: { [key: string]: MonthlyDataPoint } = {};

    validOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const year = d.getFullYear();
      const monthIdx = d.getMonth();
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;

      if (!map[key]) {
        map[key] = {
          monthKey: key,
          label: d.toLocaleDateString('es-VE', { month: 'short', year: 'numeric' }),
          year,
          monthIndex: monthIdx,
          salesUSD: 0,
          salesBs: 0,
          ordersCount: 0,
          unitsCount: 0,
          growthPercentUSD: 0,
          growthPercentBs: 0,
        };
      }
      const rate = o.bcvRate || settings.bcvRate;
      map[key].salesUSD += o.totalUSD;
      map[key].salesBs += o.totalUSD * rate;
      map[key].ordersCount += 1;
      o.items.forEach((it) => {
        map[key].unitsCount += it.quantity;
      });
    });

    const list = Object.values(map).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    // Calculate month-over-month growth
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const curr = list[i];
      if (prev.salesUSD > 0) {
        curr.growthPercentUSD = ((curr.salesUSD - prev.salesUSD) / prev.salesUSD) * 100;
      }
      if (prev.salesBs > 0) {
        curr.growthPercentBs = ((curr.salesBs - prev.salesBs) / prev.salesBs) * 100;
      }
    }

    return list;
  }, [validOrders, settings.bcvRate]);

  // 3. Process Weekday Data
  const weekdayData: WeekdayDataPoint[] = useMemo(() => {
    const names = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const days: WeekdayDataPoint[] = names.map((name, idx) => ({
      dayIndex: idx,
      dayName: name,
      salesUSD: 0,
      salesBs: 0,
      ordersCount: 0,
      avgSalesUSD: 0,
      avgSalesBs: 0,
    }));

    const dayCounts = [0, 0, 0, 0, 0, 0, 0];

    filteredOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const dayIdx = d.getDay();
      const rate = o.bcvRate || settings.bcvRate;
      days[dayIdx].salesUSD += o.totalUSD;
      days[dayIdx].salesBs += o.totalUSD * rate;
      days[dayIdx].ordersCount += 1;
      dayCounts[dayIdx] += 1;
    });

    days.forEach((d, idx) => {
      const count = dayCounts[idx] || 1;
      d.avgSalesUSD = d.salesUSD / count;
      d.avgSalesBs = d.salesBs / count;
    });

    return days;
  }, [filteredOrders, settings.bcvRate]);

  // Computed KPI Metrics for Header
  const summaryKPIs = useMemo(() => {
    const totalUSD = filteredOrders.reduce((sum, o) => sum + o.totalUSD, 0);
    const totalBs = totalUSD * settings.bcvRate;
    const ordersCount = filteredOrders.length;
    const avgTicketUSD = ordersCount > 0 ? totalUSD / ordersCount : 0;
    const avgTicketBs = avgTicketUSD * settings.bcvRate;

    // Peak sales day in dataset
    let peakDay: DailyDataPoint | null = null;
    dailyData.forEach((d) => {
      if (!peakDay || d.salesUSD > peakDay.salesUSD) {
        peakDay = d;
      }
    });

    // Average daily sales
    const activeDays = dailyData.filter((d) => d.salesUSD > 0).length || 1;
    const avgDailyUSD = totalUSD / (dailyData.length || 1);
    const avgDailyBs = totalBs / (dailyData.length || 1);

    return {
      totalUSD,
      totalBs,
      ordersCount,
      avgTicketUSD,
      avgTicketBs,
      peakDay,
      avgDailyUSD,
      avgDailyBs,
    };
  }, [filteredOrders, dailyData, settings.bcvRate]);

  // ==========================================
  // D3 RENDERING ENGINE
  // ==========================================
  useEffect(() => {
    if (!svgRef.current || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const width = container.clientWidth || 800;
    const height = 380;
    const margin = {
      top: 30,
      right: currencyMode === 'dual' ? 75 : 35,
      bottom: 45,
      left: 70,
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('style', 'max-width: 100%; height: auto;');

    // Definition of Gradients & Filters
    const defs = svg.append('defs');

    // USD Indigo Gradient
    const gradUSD = defs
      .append('linearGradient')
      .attr('id', 'd3-grad-usd')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradUSD.append('stop').attr('offset', '0%').attr('stop-color', '#4f46e5').attr('stop-opacity', 0.45);
    gradUSD.append('stop').attr('offset', '100%').attr('stop-color', '#4f46e5').attr('stop-opacity', 0.02);

    // Bs Emerald Gradient
    const gradBs = defs
      .append('linearGradient')
      .attr('id', 'd3-grad-bs')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradBs.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.45);
    gradBs.append('stop').attr('offset', '100%').attr('stop-color', '#10b981').attr('stop-opacity', 0.02);

    // Main Chart Group
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // ===============================================
    // 1. DAILY VIEW (D3 Interactive Curve & Dual Axis)
    // ===============================================
    if (granularity === 'daily') {
      const data = dailyData;
      if (data.length === 0) {
        g.append('text')
          .attr('x', innerWidth / 2)
          .attr('y', innerHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#94a3b8')
          .attr('font-size', '14px')
          .text('No hay transacciones registradas en este período');
        return;
      }

      // Scales
      const xScale = d3
        .scaleTime()
        .domain(d3.extent(data, (d) => d.date) as [Date, Date])
        .range([0, innerWidth]);

      const maxUSD = Math.max(10, (d3.max(data, (d) => d.salesUSD) || 0) * 1.15);
      const maxBs = maxUSD * settings.bcvRate;

      const yScaleUSD = d3.scaleLinear().domain([0, maxUSD]).range([innerHeight, 0]).nice();
      const yScaleBs = d3.scaleLinear().domain([0, maxBs]).range([innerHeight, 0]).nice();

      // Horizontal Grid Lines
      const gridTicks = yScaleUSD.ticks(6);
      g.append('g')
        .attr('class', 'grid')
        .selectAll('line')
        .data(gridTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScaleUSD(d))
        .attr('y2', (d) => yScaleUSD(d))
        .attr('stroke', '#e2e8f0')
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-width', 1);

      // Areas & Paths Generator
      const areaUSD = d3
        .area<DailyDataPoint>()
        .curve(d3.curveMonotoneX)
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yScaleUSD(d.salesUSD));

      const lineUSD = d3
        .line<DailyDataPoint>()
        .curve(d3.curveMonotoneX)
        .x((d) => xScale(d.date))
        .y((d) => yScaleUSD(d.salesUSD));

      const areaBs = d3
        .area<DailyDataPoint>()
        .curve(d3.curveMonotoneX)
        .x((d) => xScale(d.date))
        .y0(innerHeight)
        .y1((d) => yScaleBs(d.salesBs));

      const lineBs = d3
        .line<DailyDataPoint>()
        .curve(d3.curveMonotoneX)
        .x((d) => xScale(d.date))
        .y((d) => yScaleBs(d.salesBs));

      // Draw Curves / Areas
      if (currencyMode === 'dual' || currencyMode === 'USD') {
        g.append('path')
          .datum(data)
          .attr('fill', 'url(#d3-grad-usd)')
          .attr('d', areaUSD);

        const pathUSD = g
          .append('path')
          .datum(data)
          .attr('fill', 'none')
          .attr('stroke', '#4f46e5')
          .attr('stroke-width', 3)
          .attr('d', lineUSD);

        // Path enter animation
        const totalLength = (pathUSD.node() as SVGPathElement)?.getTotalLength() || 0;
        pathUSD
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(900)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      }

      if (currencyMode === 'dual' || currencyMode === 'BS') {
        if (currencyMode === 'BS') {
          g.append('path')
            .datum(data)
            .attr('fill', 'url(#d3-grad-bs)')
            .attr('d', areaBs);
        }

        const pathBs = g
          .append('path')
          .datum(data)
          .attr('fill', 'none')
          .attr('stroke', '#10b981')
          .attr('stroke-width', currencyMode === 'dual' ? 2 : 3)
          .attr('stroke-dasharray', currencyMode === 'dual' ? '4,4' : '0')
          .attr('d', lineBs);

        const totalLengthBs = (pathBs.node() as SVGPathElement)?.getTotalLength() || 0;
        pathBs
          .attr('stroke-dasharray', currencyMode === 'dual' ? '4,4' : `${totalLengthBs} ${totalLengthBs}`)
          .attr('stroke-dashoffset', totalLengthBs)
          .transition()
          .duration(900)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      }

      // Moving Average Trendline (Optional 3-day window)
      if (showMovingAverage && data.length >= 3) {
        const maData: { date: Date; maUSD: number }[] = [];
        for (let i = 2; i < data.length; i++) {
          const avg = (data[i - 2].salesUSD + data[i - 1].salesUSD + data[i].salesUSD) / 3;
          maData.push({ date: data[i].date, maUSD: avg });
        }

        const maLine = d3
          .line<{ date: Date; maUSD: number }>()
          .curve(d3.curveBasis)
          .x((d) => xScale(d.date))
          .y((d) => yScaleUSD(d.maUSD));

        g.append('path')
          .datum(maData)
          .attr('fill', 'none')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '2,2')
          .attr('d', maLine)
          .attr('opacity', 0.85);
      }

      // X-Axis
      const xAxis = d3
        .axisBottom<Date>(xScale)
        .ticks(Math.min(data.length, Math.floor(innerWidth / 65)))
        .tickFormat((d) => d3.timeFormat('%d %b')(d as Date));

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .call((axis) => axis.select('.domain').attr('stroke', '#cbd5e1'))
        .call((axis) => axis.selectAll('text').attr('fill', '#64748b').attr('font-size', '11px').attr('font-weight', '600'));

      // Left Y-Axis (USD $)
      const yAxisLeft = d3
        .axisLeft(yScaleUSD)
        .ticks(6)
        .tickFormat((d) => `$${d3.format(',.0f')(d as number)}`);

      g.append('g')
        .call(yAxisLeft)
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('text').attr('fill', '#4f46e5').attr('font-size', '11px').attr('font-weight', '700'));

      // USD Axis Label
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -52)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#4f46e5')
        .attr('font-size', '11px')
        .attr('font-weight', '800')
        .text('Ventas en Dólares (USD $)');

      // Right Y-Axis (Bs BCV) for Dual Mode
      if (currencyMode === 'dual') {
        const yAxisRight = d3
          .axisRight(yScaleBs)
          .ticks(6)
          .tickFormat((d) => `Bs. ${d3.format(',.0f')(d as number)}`);

        g.append('g')
          .attr('transform', `translate(${innerWidth},0)`)
          .call(yAxisRight)
          .call((axis) => axis.select('.domain').remove())
          .call((axis) => axis.selectAll('text').attr('fill', '#10b981').attr('font-size', '11px').attr('font-weight', '700'));

        g.append('text')
          .attr('transform', 'rotate(90)')
          .attr('y', -innerWidth - 56)
          .attr('x', innerHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#10b981')
          .attr('font-size', '11px')
          .attr('font-weight', '800')
          .text('Equivalente en Bolívares (Bs)');
      }

      // Interactive Crosshair & Tooltip Overlay
      const crosshair = g.append('g').style('display', 'none');
      const verticalLine = crosshair
        .append('line')
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#64748b')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4');

      const circleUSD = crosshair
        .append('circle')
        .attr('r', 6)
        .attr('fill', '#4f46e5')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2.5)
        .style('filter', 'drop-shadow(0 2px 4px rgba(79,70,229,0.3))');

      const circleBs = crosshair
        .append('circle')
        .attr('r', 5)
        .attr('fill', '#10b981')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .style('display', currencyMode === 'dual' ? 'block' : 'none');

      const bisectDate = d3.bisector<DailyDataPoint, Date>((d) => d.date).left;

      // Transparent Mouse Capture Rect
      g.append('rect')
        .attr('width', innerWidth)
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair')
        .on('mouseenter', () => {
          crosshair.style('display', null);
          if (tooltipRef.current) tooltipRef.current.style.opacity = '1';
        })
        .on('mouseleave', () => {
          crosshair.style('display', 'none');
          if (tooltipRef.current) tooltipRef.current.style.opacity = '0';
        })
        .on('mousemove', (event: MouseEvent) => {
          const [mouseX] = d3.pointer(event);
          const x0 = xScale.invert(mouseX);
          const i = bisectDate(data, x0, 1);
          const d0 = data[i - 1];
          const d1 = data[i];
          let d = d0;
          if (d1 && d0) {
            d = x0.getTime() - d0.date.getTime() > d1.date.getTime() - x0.getTime() ? d1 : d0;
          }
          if (!d) return;

          const cx = xScale(d.date);
          const cyUSD = yScaleUSD(d.salesUSD);
          const cyBs = yScaleBs(d.salesBs);

          verticalLine.attr('x1', cx).attr('x2', cx);
          circleUSD.attr('cx', cx).attr('cy', cyUSD);
          if (currencyMode === 'dual') {
            circleBs.attr('cx', cx).attr('cy', cyBs);
          }

          // Tooltip Position & HTML
          if (tooltipRef.current) {
            const tt = tooltipRef.current;
            const containerRect = container.getBoundingClientRect();
            const leftOffset = margin.left + cx;
            const isRightSide = cx > innerWidth * 0.65;

            tt.style.left = `${isRightSide ? leftOffset - 240 : leftOffset + 15}px`;
            tt.style.top = `${Math.min(cyUSD + margin.top, innerHeight - 60)}px`;
            tt.innerHTML = `
              <div class="p-3 bg-slate-900/95 text-white rounded-xl shadow-2xl border border-slate-700/80 text-xs space-y-1.5 min-w-[210px] backdrop-blur-md">
                <div class="border-b border-slate-700 pb-1 flex items-center justify-between">
                  <span class="font-bold text-slate-200">${d.fullDate}</span>
                  <span class="text-[10px] font-mono text-indigo-300 bg-indigo-950 px-1.5 py-0.5 rounded border border-indigo-800">
                    ${d.ordersCount} pedidos
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <p class="text-[10px] text-indigo-400 font-bold uppercase">Monto USD</p>
                    <p class="font-mono font-black text-sm text-indigo-200">${formatUSD(d.salesUSD)}</p>
                  </div>
                  <div>
                    <p class="text-[10px] text-emerald-400 font-bold uppercase">Monto Bs BCV</p>
                    <p class="font-mono font-black text-sm text-emerald-300">${formatBs(d.salesBs)}</p>
                  </div>
                </div>
                <div class="pt-1 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Ticket Promedio: <strong class="text-white">${formatUSD(d.averageTicketUSD)}</strong></span>
                  <span>${d.unitsCount} unid.</span>
                </div>
              </div>
            `;
          }
        });
    }

    // ===============================================
    // 2. MONTHLY VIEW (D3 Grouped/Stacked Bar Chart)
    // ===============================================
    if (granularity === 'monthly') {
      const data = monthlyData;
      if (data.length === 0) {
        g.append('text')
          .attr('x', innerWidth / 2)
          .attr('y', innerHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#94a3b8')
          .attr('font-size', '14px')
          .text('No hay datos mensuales para procesar');
        return;
      }

      const xScale = d3
        .scaleBand()
        .domain(data.map((d) => d.label))
        .range([0, innerWidth])
        .padding(0.3);

      const maxUSD = Math.max(100, (d3.max(data, (d) => d.salesUSD) || 0) * 1.2);
      const maxBs = maxUSD * settings.bcvRate;

      const yScaleUSD = d3.scaleLinear().domain([0, maxUSD]).range([innerHeight, 0]).nice();
      const yScaleBs = d3.scaleLinear().domain([0, maxBs]).range([innerHeight, 0]).nice();

      // Horizontal Grid Lines
      const gridTicks = yScaleUSD.ticks(6);
      g.append('g')
        .attr('class', 'grid')
        .selectAll('line')
        .data(gridTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScaleUSD(d))
        .attr('y2', (d) => yScaleUSD(d))
        .attr('stroke', '#e2e8f0')
        .attr('stroke-dasharray', '3,3');

      // Bars Rendering
      const barGroups = g
        .selectAll('.bar-group')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'bar-group')
        .attr('transform', (d) => `translate(${xScale(d.label)}, 0)`);

      // Draw Main USD Bars
      barGroups
        .append('rect')
        .attr('x', 0)
        .attr('y', innerHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', '#4f46e5')
        .attr('rx', 6)
        .attr('ry', 6)
        .transition()
        .duration(800)
        .ease(d3.easeCubicOut)
        .attr('y', (d) => yScaleUSD(d.salesUSD))
        .attr('height', (d) => innerHeight - yScaleUSD(d.salesUSD));

      // Value text labels above bars
      barGroups
        .append('text')
        .attr('x', xScale.bandwidth() / 2)
        .attr('y', (d) => yScaleUSD(d.salesUSD) - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', '#1e293b')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('font-family', 'monospace')
        .text((d) => (currencyMode === 'BS' ? formatBs(d.salesBs) : formatUSD(d.salesUSD)));

      // Growth % badges above text
      barGroups
        .filter((d) => d.growthPercentUSD !== 0)
        .append('text')
        .attr('x', xScale.bandwidth() / 2)
        .attr('y', (d) => yScaleUSD(d.salesUSD) - 22)
        .attr('text-anchor', 'middle')
        .attr('fill', (d) => (d.growthPercentUSD >= 0 ? '#10b981' : '#f43f5e'))
        .attr('font-size', '9px')
        .attr('font-weight', '800')
        .text((d) => `${d.growthPercentUSD > 0 ? '+' : ''}${d.growthPercentUSD.toFixed(1)}%`);

      // X-Axis
      const xAxis = d3.axisBottom(xScale);
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(xAxis)
        .call((axis) => axis.select('.domain').attr('stroke', '#cbd5e1'))
        .call((axis) => axis.selectAll('text').attr('fill', '#475569').attr('font-size', '11px').attr('font-weight', '600'));

      // Left Y-Axis
      const yAxisLeft = d3
        .axisLeft(yScaleUSD)
        .ticks(6)
        .tickFormat((d) => `$${d3.format(',.0f')(d as number)}`);

      g.append('g')
        .call(yAxisLeft)
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('text').attr('fill', '#4f46e5').attr('font-size', '11px').attr('font-weight', '700'));

      // Axis Labels
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -52)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#4f46e5')
        .attr('font-size', '11px')
        .attr('font-weight', '800')
        .text('Ventas Mensuales (USD $)');
    }

    // ===============================================
    // 3. WEEKDAY DISTRIBUTION VIEW
    // ===============================================
    if (granularity === 'weekday') {
      const data = weekdayData;
      const xScale = d3
        .scaleBand()
        .domain(data.map((d) => d.dayName))
        .range([0, innerWidth])
        .padding(0.35);

      const maxUSD = Math.max(10, (d3.max(data, (d) => d.salesUSD) || 0) * 1.15);
      const yScaleUSD = d3.scaleLinear().domain([0, maxUSD]).range([innerHeight, 0]).nice();

      // Grid
      const gridTicks = yScaleUSD.ticks(5);
      g.append('g')
        .selectAll('line')
        .data(gridTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (d) => yScaleUSD(d))
        .attr('y2', (d) => yScaleUSD(d))
        .attr('stroke', '#e2e8f0')
        .attr('stroke-dasharray', '3,3');

      // Bars
      const bars = g
        .selectAll('.w-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'w-bar')
        .attr('x', (d) => xScale(d.dayName) || 0)
        .attr('y', innerHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('fill', (d) => (d.salesUSD === maxUSD / 1.15 ? '#f59e0b' : '#06b6d4'))
        .attr('rx', 6)
        .attr('ry', 6)
        .transition()
        .duration(800)
        .attr('y', (d) => yScaleUSD(d.salesUSD))
        .attr('height', (d) => innerHeight - yScaleUSD(d.salesUSD));

      // Labels
      g.selectAll('.w-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'w-label')
        .attr('x', (d) => (xScale(d.dayName) || 0) + xScale.bandwidth() / 2)
        .attr('y', (d) => yScaleUSD(d.salesUSD) - 8)
        .attr('text-anchor', 'middle')
        .attr('fill', '#0f172a')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .text((d) => formatUSD(d.salesUSD));

      // X-Axis
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(xScale))
        .call((axis) => axis.select('.domain').attr('stroke', '#cbd5e1'))
        .call((axis) => axis.selectAll('text').attr('fill', '#475569').attr('font-size', '11px').attr('font-weight', '600'));

      // Y-Axis
      g.append('g')
        .call(d3.axisLeft(yScaleUSD).ticks(5).tickFormat((d) => `$${d3.format(',.0f')(d as number)}`))
        .call((axis) => axis.select('.domain').remove())
        .call((axis) => axis.selectAll('text').attr('fill', '#0891b2').attr('font-size', '11px').attr('font-weight', '700'));
    }
  }, [
    dailyData,
    monthlyData,
    weekdayData,
    granularity,
    currencyMode,
    showMovingAverage,
    settings.bcvRate,
  ]);

  // Handle Export of Visual Chart Dataset to CSV
  const handleExportDataCSV = () => {
    if (granularity === 'daily') {
      const headers = [
        'Fecha',
        'Dia',
        'Ventas USD',
        'Ventas Bs BCV',
        'Numero Pedidos',
        'Unidades Vendidas',
        'Ticket Promedio USD',
        'Tasa BCV',
      ];
      const rows = dailyData.map((d) => [
        d.dateKey,
        d.fullDate,
        d.salesUSD.toFixed(2),
        d.salesBs.toFixed(2),
        d.ordersCount,
        d.unitsCount,
        d.averageTicketUSD.toFixed(2),
        settings.bcvRate.toFixed(2),
      ]);
      exportToCSV(`Ventas_Diarias_D3_${timeRange}`, [headers, ...rows]);
    } else if (granularity === 'monthly') {
      const headers = [
        'Mes',
        'Clave',
        'Ventas USD',
        'Ventas Bs BCV',
        'Crecimiento USD %',
        'Numero Pedidos',
        'Unidades Vendidas',
      ];
      const rows = monthlyData.map((d) => [
        d.label,
        d.monthKey,
        d.salesUSD.toFixed(2),
        d.salesBs.toFixed(2),
        d.growthPercentUSD.toFixed(2),
        d.ordersCount,
        d.unitsCount,
      ]);
      exportToCSV(`Ventas_Mensuales_D3`, [headers, ...rows]);
    } else {
      const headers = [
        'Dia de la Semana',
        'Ventas USD',
        'Ventas Bs BCV',
        'Pedidos',
        'Promedio USD',
      ];
      const rows = weekdayData.map((d) => [
        d.dayName,
        d.salesUSD.toFixed(2),
        d.salesBs.toFixed(2),
        d.ordersCount,
        d.avgSalesUSD.toFixed(2),
      ]);
      exportToCSV(`Ventas_Por_Dia_Semana_D3`, [headers, ...rows]);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden space-y-4">
      {/* Top Header Controls Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 bg-slate-50/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left Title & Indicator */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-xs">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Panel Analítico D3.js: Ventas Comparativas Multimoneda
              </h2>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 font-mono font-bold text-[10px] rounded-md border border-indigo-200">
                D3 v7 Data Visualization
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Curvas dinámicas, doble eje Y y comparativa temporal en USD $ y Bolívares (Tasa BCV: {formatPlainNumber(settings.bcvRate, 2)} Bs/$)
            </p>
          </div>
        </div>

        {/* Right Controls: Granularity, Currency, and Export */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          
          {/* Granularity Tabs */}
          <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setGranularity('daily')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                granularity === 'daily'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Diario
            </button>
            <button
              onClick={() => setGranularity('monthly')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                granularity === 'monthly'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Mensual
            </button>
            <button
              onClick={() => setGranularity('weekday')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                granularity === 'weekday'
                  ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              Por Día
            </button>
          </div>

          {/* Time Range Filter (For Daily mode) */}
          {granularity === 'daily' && (
            <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                onClick={() => setTimeRange('7d')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  timeRange === '7d' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7D
              </button>
              <button
                onClick={() => setTimeRange('14d')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  timeRange === '14d' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                14D
              </button>
              <button
                onClick={() => setTimeRange('30d')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  timeRange === '30d' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30D
              </button>
              <button
                onClick={() => setTimeRange('all')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                  timeRange === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todo
              </button>
            </div>
          )}

          {/* Currency Toggle (Dual vs Single) */}
          <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
            <button
              onClick={() => setCurrencyMode('dual')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                currencyMode === 'dual' ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Doble Eje: USD $ (Izq) y Bs BCV (Der) simultáneos"
            >
              Doble Eje (USD + Bs)
            </button>
            <button
              onClick={() => setCurrencyMode('USD')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                currencyMode === 'USD' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              USD $
            </button>
            <button
              onClick={() => setCurrencyMode('BS')}
              className={`px-2.5 py-1.5 rounded-lg font-semibold transition ${
                currencyMode === 'BS' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bs BCV
            </button>
          </div>

          {/* Export Dataset */}
          <button
            onClick={handleExportDataCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition cursor-pointer shadow-2xs"
            title="Exportar serie de datos D3 a archivo CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Datos</span>
          </button>
        </div>

      </div>

      {/* KPI Highlight Strip */}
      <div className="px-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Facturación Total del Período</p>
          <p className="text-base font-black text-slate-900 mt-0.5">{formatUSD(summaryKPIs.totalUSD)}</p>
          <p className="text-[10px] text-emerald-600 font-bold">{formatBs(summaryKPIs.totalBs)}</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Promedio Diario (Run-Rate)</p>
          <p className="text-base font-black text-indigo-600 mt-0.5">{formatUSD(summaryKPIs.avgDailyUSD)}</p>
          <p className="text-[10px] text-slate-500">{formatBs(summaryKPIs.avgDailyBs)} / día</p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Pico Máximo de Ventas</p>
          <p className="text-base font-black text-slate-900 mt-0.5">
            {summaryKPIs.peakDay ? formatUSD(summaryKPIs.peakDay.salesUSD) : '$0.00'}
          </p>
          <p className="text-[10px] text-indigo-600 font-medium">
            {summaryKPIs.peakDay ? summaryKPIs.peakDay.label : 'Sin registro'}
          </p>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Ticket Medio & Pedidos</p>
          <p className="text-base font-black text-slate-900 mt-0.5">{formatUSD(summaryKPIs.avgTicketUSD)}</p>
          <p className="text-[10px] text-slate-500">{summaryKPIs.ordersCount} operaciones realizadas</p>
        </div>
      </div>

      {/* D3 Main SVG Canvas Area */}
      <div className="px-4 pb-4">
        <div
          ref={chartContainerRef}
          className="relative w-full bg-slate-50/40 rounded-xl border border-slate-200/60 p-2 overflow-hidden"
        >
          {/* SVG Elements generated by D3 */}
          <svg ref={svgRef} className="w-full overflow-visible"></svg>

          {/* Dynamic Floating D3 Tooltip */}
          <div
            ref={tooltipRef}
            className="absolute pointer-events-none transition-opacity duration-150 opacity-0 z-20"
          ></div>
        </div>

        {/* Dynamic Legend and Helper info */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 px-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
              <span className="font-bold text-slate-700">Ventas en USD ($)</span>
            </div>

            {currencyMode === 'dual' && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-1 border-t-2 border-dashed border-emerald-500"></span>
                <span className="font-bold text-emerald-700">Equivalente Bs. (Eje Derecho)</span>
              </div>
            )}

            {granularity === 'daily' && (
              <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={showMovingAverage}
                  onChange={(e) => setShowMovingAverage(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span className="text-amber-700 font-semibold">Media Móvil (3 días)</span>
              </label>
            )}
          </div>

          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <Info className="w-3.5 h-3.5" />
            <span>Pasa el cursor sobre la gráfica para inspeccionar detalles por fecha y tasa.</span>
          </div>
        </div>
      </div>

    </div>
  );
};
