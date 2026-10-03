import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Layers,
  PieChart,
  TrendingUp,
} from 'lucide-react';
import { Lead, LeadSourceType, LeadStatus } from '../types/leadguard';

export type TimeframeOption = '7d' | '30d' | '90d' | 'all';

interface LeadsOverTimeChartProps {
  leads: Lead[];
  timeframe: TimeframeOption;
  onTimeframeChange: (tf: TimeframeOption) => void;
}

function parseLeadDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const fallback = new Date(dateStr);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(key: string, showYear = false): string {
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mIdx = parseInt(parts[1], 10) - 1;
  const mName = months[mIdx] || parts[1];
  const day = parseInt(parts[2], 10);
  return showYear ? `${day} ${mName} ${parts[0]}` : `${day} ${mName}`;
}

export const LeadsOverTimeChart: React.FC<LeadsOverTimeChartProps> = ({
  leads,
  timeframe,
  onTimeframeChange,
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<{
    dateKey: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  const { chartData, maxCount, totalInPeriod } = useMemo(() => {
    const now = new Date();
    let days = 30;
    if (timeframe === '7d') days = 7;
    if (timeframe === '30d') days = 30;
    if (timeframe === '90d') days = 90;

    // Build timeline buckets
    const bucketMap = new Map<string, number>();

    if (timeframe === 'all') {
      // Find oldest lead or default to 30 days ago
      let oldest = new Date();
      for (const lead of leads) {
        const d = parseLeadDate(lead.date_added);
        if (d && d < oldest) oldest = d;
      }
      const diffDays = Math.max(7, Math.ceil((now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)));
      days = Math.min(diffDays, 365); // Cap to 365 buckets
    }

    // Populate empty buckets for continuous curve
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      bucketMap.set(formatDateKey(d), 0);
    }

    // Accumulate leads into buckets
    let inPeriodCount = 0;
    for (const lead of leads) {
      const d = parseLeadDate(lead.date_added);
      if (!d) continue;
      const key = formatDateKey(d);
      if (bucketMap.has(key)) {
        bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
        inPeriodCount++;
      }
    }

    const data = Array.from(bucketMap.entries()).map(([dateKey, count]) => ({
      dateKey,
      count,
    }));

    const max = Math.max(...data.map((d) => d.count), 4);

    return {
      chartData: data,
      maxCount: max,
      totalInPeriod: inPeriodCount,
    };
  }, [leads, timeframe]);

  // SVG Geometry Calculation
  const width = 760;
  const height = 220;
  const paddingX = 40;
  const paddingY = 25;
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    return chartData.map((d, index) => {
      const x = paddingX + (index / Math.max(1, chartData.length - 1)) * innerWidth;
      const y = paddingY + innerHeight - (d.count / maxCount) * innerHeight;
      return { ...d, x, y };
    });
  }, [chartData, maxCount, innerWidth, innerHeight, paddingX, paddingY]);

  // Construct SVG Path Strings
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    if (points.length === 1) {
      return `M ${points[0].x} ${points[0].y} L ${width - paddingX} ${points[0].y}`;
    }
    // Smooth Catmull-Rom or bezier curve
    return points.reduce((acc, curr, idx, arr) => {
      if (idx === 0) return `M ${curr.x} ${curr.y}`;
      const prev = arr[idx - 1];
      const cp1x = prev.x + (curr.x - prev.x) / 2;
      const cp1y = prev.y;
      const cp2x = prev.x + (curr.x - prev.x) / 2;
      const cp2y = curr.y;
      return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
    }, '');
  }, [points, width, paddingX]);

  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const bottomY = paddingY + innerHeight;
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    return `${pathD} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  }, [pathD, points, paddingY, innerHeight]);

  // Select 5 evenly spaced date labels
  const labelIndices = useMemo(() => {
    if (points.length <= 5) return points.map((_, i) => i);
    const step = (points.length - 1) / 4;
    return [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), points.length - 1];
  }, [points]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-800" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Leads Ingestion Over Time
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Total of <span className="font-mono font-semibold text-slate-900">{totalInPeriod}</span> inquiries captured during this period
          </p>
        </div>

        {/* Timeframe Switcher Tabs */}
        <div
          role="group"
          aria-label="Chart timeframe selector"
          className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start sm:self-auto"
        >
          {(
            [
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: '90d', label: '90 Days' },
              { id: 'all', label: 'All Time' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTimeframeChange(tab.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                timeframe === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SVG Line / Area Graph */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[240px] overflow-visible"
        >
          <defs>
            <linearGradient id="leadAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" stopOpacity="0.22" />
              <stop offset="85%" stopColor="#0f172a" stopOpacity="0.02" />
              <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Horizontal Gridlines */}
          {[0, 0.33, 0.66, 1].map((ratio) => {
            const y = paddingY + innerHeight * ratio;
            const value = Math.round(maxCount * (1 - ratio));
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="text-[10px] font-mono fill-slate-400"
                >
                  {value}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          {areaD && <path d={areaD} fill="url(#leadAreaGradient)" />}

          {/* Main Trend Line */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="#0f172a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Interactive Hover Nodes */}
          {points.map((pt) => {
            const isHovered = hoveredPoint?.dateKey === pt.dateKey;
            return (
              <g
                key={pt.dateKey}
                onMouseEnter={() => setHoveredPoint(pt)}
                onMouseLeave={() => setHoveredPoint(null)}
                className="cursor-pointer"
              >
                {/* Transparent wider hit zone */}
                <rect
                  x={pt.x - 12}
                  y={0}
                  width={24}
                  height={height}
                  fill="transparent"
                />

                {/* Visible Data Point */}
                {(pt.count > 0 || isHovered) && (
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 5 : 3.5}
                    fill={isHovered ? '#0f172a' : '#ffffff'}
                    stroke="#0f172a"
                    strokeWidth={isHovered ? 3 : 2}
                    className="transition-all duration-150"
                  />
                )}
              </g>
            );
          })}

          {/* Bottom X-Axis Date Labels */}
          {labelIndices.map((idx) => {
            const pt = points[idx];
            if (!pt) return null;
            return (
              <text
                key={pt.dateKey}
                x={pt.x}
                y={height - 6}
                textAnchor="middle"
                className="text-[10px] font-mono fill-slate-400"
              >
                {formatDisplayDate(pt.dateKey, timeframe === '90d' || timeframe === 'all')}
              </text>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none z-10 px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-mono shadow-md border border-slate-800 -translate-x-1/2 -translate-y-full mb-2"
            style={{
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${(hoveredPoint.y / height) * 100}%`,
            }}
          >
            <div className="font-bold text-white">
              {hoveredPoint.count} {hoveredPoint.count === 1 ? 'lead' : 'leads'}
            </div>
            <div className="text-[10px] text-slate-300">
              {formatDisplayDate(hoveredPoint.dateKey, true)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface LeadQualityChartProps {
  leads: Lead[];
}

export const LeadQualityChart: React.FC<LeadQualityChartProps> = ({ leads }) => {
  const total = leads.length;
  const hotCount = leads.filter((l) => l.status === LeadStatus.HOT).length;
  const warmCount = leads.filter((l) => l.status === LeadStatus.WARM).length;
  const coldCount = leads.filter((l) => l.status === LeadStatus.COLD).length;

  const hotPct = total > 0 ? Math.round((hotCount / total) * 100) : 0;
  const warmPct = total > 0 ? Math.round((warmCount / total) * 100) : 0;
  const coldPct = total > 0 ? Math.max(0, 100 - hotPct - warmPct) : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-slate-800" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Lead Quality Distribution
          </h2>
        </div>
        <span className="font-mono text-xs text-slate-500 tabular-nums">
          {total} Total Evaluated
        </span>
      </div>

      {/* Stacked Multi-Segment Progress Bar */}
      <div className="space-y-2">
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
          <div
            style={{ width: `${hotPct}%` }}
            className="bg-emerald-600 h-full transition-all duration-300"
            title={`HOT: ${hotCount} (${hotPct}%)`}
          />
          <div
            style={{ width: `${warmPct}%` }}
            className="bg-amber-500 h-full transition-all duration-300"
            title={`WARM: ${warmCount} (${warmPct}%)`}
          />
          <div
            style={{ width: `${coldPct}%` }}
            className="bg-slate-400 h-full transition-all duration-300"
            title={`COLD: ${coldCount} (${coldPct}%)`}
          />
        </div>
      </div>

      {/* Segment Cards */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800">HOT</span>
            <span className="text-[11px] font-mono text-emerald-700">80–100</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-emerald-900 tabular-nums">
              {hotCount}
            </span>
            <span className="text-xs font-mono font-semibold text-emerald-700">
              {hotPct}%
            </span>
          </div>
          <div className="text-[10px] text-emerald-700 mt-1 truncate">
            Immediate Follow-up
          </div>
        </div>

        <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800">WARM</span>
            <span className="text-[11px] font-mono text-amber-700">50–79</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-amber-900 tabular-nums">
              {warmCount}
            </span>
            <span className="text-xs font-mono font-semibold text-amber-700">
              {warmPct}%
            </span>
          </div>
          <div className="text-[10px] text-amber-700 mt-1 truncate">
            Verify Requirements
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">COLD</span>
            <span className="text-[11px] font-mono text-slate-500">0–49</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
              {coldCount}
            </span>
            <span className="text-xs font-mono font-semibold text-slate-600">
              {coldPct}%
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1 truncate">
            Standard Queue
          </div>
        </div>
      </div>
    </div>
  );
};

interface LeadSourceChartProps {
  leads: Lead[];
}

export const LeadSourceChart: React.FC<LeadSourceChartProps> = ({ leads }) => {
  const total = leads.length;

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const src = lead.source || 'Other';
      counts[src] = (counts[src] || 0) + 1;
    }

    // Only display categories that actually have data
    return Object.entries(counts)
      .map(([source, count]) => ({
        source: source as LeadSourceType,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [leads, total]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-slate-800" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Lead Source Breakdown
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {sourceData.length} Active Channels
        </span>
      </div>

      {sourceData.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No lead source data available yet.
        </div>
      ) : (
        <div className="space-y-3">
          {sourceData.map((item) => (
            <div key={item.source} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">{item.source}</span>
                <span className="font-mono text-slate-600">
                  <span className="font-bold text-slate-900">{item.count}</span>{' '}
                  <span className="text-slate-400">({item.percentage}%)</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-slate-900 h-full rounded-full transition-all duration-300"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface ServiceDemandChartProps {
  leads: Lead[];
}

export const ServiceDemandChart: React.FC<ServiceDemandChartProps> = ({ leads }) => {
  const total = leads.length;

  const serviceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const lead of leads) {
      const s = (lead.service || 'General Inquiry').trim();
      counts[s] = (counts[s] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([service, count]) => ({
        service,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6); // Top 6 services
  }, [leads, total]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-800" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Service Demand
          </h2>
        </div>
        <span className="text-xs text-slate-500 font-mono">
          Top Inquired Services
        </span>
      </div>

      {serviceData.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-500">
          No service inquiries logged yet.
        </div>
      ) : (
        <div className="space-y-3">
          {serviceData.map((item, idx) => (
            <div key={item.service} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 truncate max-w-[200px]" title={item.service}>
                  <span className="text-slate-400 font-mono mr-1.5">#{idx + 1}</span>
                  {item.service}
                </span>
                <span className="font-mono text-slate-600">
                  <span className="font-bold text-slate-900">{item.count}</span>{' '}
                  <span className="text-slate-400">({item.percentage}%)</span>
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="bg-slate-700 h-full rounded-full transition-all duration-300"
                  style={{ width: `${item.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
