import React from 'react';

// Common Props
interface ChartProps {
    data: { label: string; value: number; color?: string }[];
    height?: number;
    title?: string;
    showValues?: boolean;
}

// --- Bar Chart ---
export const BarChart: React.FC<ChartProps> = ({ data, height = 200, title, showValues = true }) => {
    if (data.length === 0) return <div className="h-full flex items-center justify-center text-gray-400">No Data</div>;

    const maxValue = Math.max(...data.map(d => d.value), 100); // Default max 100 if values are low
    const barWidth = 100 / data.length;
    const padding = 10;

    return (
        <div className="w-full flex flex-col h-full">
            {title && <h4 className="text-sm font-bold text-gray-600 mb-2 text-center">{title}</h4>}
            <div className="flex-1 relative" style={{ height }}>
                <svg width="100%" height="100%" viewBox={`0 0 100 100`} preserveAspectRatio="none" className="overflow-visible">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(p => (
                        <line key={p} x1="0" y1={100 - p} x2="100" y2={100 - p} stroke="#f3f4f6" strokeWidth="0.5" />
                    ))}

                    {/* Bars */}
                    {data.map((d, i) => {
                        const barHeight = (d.value / maxValue) * 100;
                        return (
                            <g key={i} className="group">
                                <rect
                                    x={i * barWidth + (padding / 2 / data.length)}
                                    y={100 - barHeight}
                                    width={barWidth - (padding / data.length)}
                                    height={barHeight}
                                    fill={d.color || '#3b82f6'}
                                    className="hover:opacity-80 transition-opacity"
                                />
                                {showValues && (
                                    <text
                                        x={(i * barWidth) + (barWidth / 2)}
                                        y={100 - barHeight - 2}
                                        textAnchor="middle"
                                        fontSize="4"
                                        fontWeight="bold"
                                        fill="#4b5563"
                                        className="transition-opacity"
                                        style={{ textShadow: '0 0 2px white' }} // Simple halo
                                    >
                                        {d.value.toFixed(1)}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>
            {/* X Axis Labels */}
            <div className="flex justify-between w-full mt-2 px-1">
                {data.map((d, i) => (
                    <div key={i} className="text-[10px] text-gray-500 text-center truncate" style={{ width: `${100 / data.length}%` }} title={d.label}>
                        {d.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Line Chart ---
export const LineChart: React.FC<ChartProps> = ({ data, height = 200, title }) => {
    if (data.length < 2) return <BarChart data={data} height={height} title={title} />; // Fallback to bar if not enough points

    const maxValue = Math.max(...data.map(d => d.value), 100);
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((d.value / maxValue) * 100);
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full flex flex-col h-full">
            {title && <h4 className="text-sm font-bold text-gray-600 mb-2 text-center">{title}</h4>}
            <div className="flex-1 relative" style={{ height }}>
                <svg width="100%" height="100%" viewBox={`0 0 100 100`} preserveAspectRatio="none" className="overflow-visible">
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(p => (
                        <line key={p} x1="0" y1={100 - p} x2="100" y2={100 - p} stroke="#f3f4f6" strokeWidth="0.5" />
                    ))}

                    {/* Gradient Area (Optional polish) */}
                    <defs>
                        <linearGradient id="line-gradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polygon points={`0,100 ${points} 100,100`} fill="url(#line-gradient)" />

                    {/* Line */}
                    <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Points */}
                    {data.map((d, i) => {
                        const x = (i / (data.length - 1)) * 100;
                        const y = 100 - ((d.value / maxValue) * 100);
                        return (
                            <g key={i}>
                                <circle cx={x} cy={y} r="2" fill="#fff" stroke="#2563eb" strokeWidth="1" />
                                <text
                                    x={x}
                                    y={y - 5}
                                    textAnchor="middle"
                                    fontSize="4"
                                    fontWeight="bold"
                                    fill="#4b5563"
                                    stroke="#fff"
                                    strokeWidth="0.5"
                                    paint-order="stroke"
                                >
                                    {d.value.toFixed(1)}
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>
            {/* X Axis Labels */}
            <div className="flex justify-between w-full mt-2">
                {data.map((d, i) => (
                    <div key={i} className="text-[10px] text-gray-500 text-center -ml-2 w-8 truncate" title={d.label}>
                        {d.label}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Pie Chart ---
// Simple pie chart implementation
export const PieChart: React.FC<ChartProps> = ({ data, height = 200, title }) => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let cumulativePercent = 0;

    const getCoordinatesForPercent = (percent: number) => {
        const x = Math.cos(2 * Math.PI * percent);
        const y = Math.sin(2 * Math.PI * percent);
        return [x, y];
    };

    return (
        <div className="w-full flex flex-col items-center h-full">
            {title && <h4 className="text-sm font-bold text-gray-600 mb-2">{title}</h4>}
            <div className="relative" style={{ height, width: height }}>
                <svg viewBox="-1 -1 2 2" style={{ transform: 'rotate(-90deg)' }} className="w-full h-full">
                    {data.map((d, i) => {
                        const startPercent = cumulativePercent;
                        const slicePercent = d.value / total;
                        cumulativePercent += slicePercent;
                        const endPercent = cumulativePercent;

                        const [startX, startY] = getCoordinatesForPercent(startPercent);
                        const [endX, endY] = getCoordinatesForPercent(endPercent);

                        const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

                        const pathData = [
                            `M 0 0`,
                            `L ${startX} ${startY}`,
                            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`,
                            `Z`
                        ].join(' ');

                        return (
                            <path key={i} d={pathData} fill={d.color || '#ccc'} stroke="#fff" strokeWidth="0.02" />
                        );
                    })}
                    {/* Inner Circle for Donut effect (optional, keeps it cleaner) */}
                    <circle cx="0" cy="0" r="0.6" fill="white" />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                    <span className="text-xs text-gray-400 font-medium">Total</span>
                    <span className="text-xl font-bold text-gray-700">{total}</span>
                </div>
            </div>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-3">
                {data.map((d, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></span>
                        <span className="text-xs text-gray-600">{d.label} ({d.value})</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
