import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LabelList,
} from "recharts";
import { FaChartBar, FaTable, FaTrophy } from "react-icons/fa";
import useAxiosSecure from "../../../hooks/useAxiosSecure";

// ৳1,234 style money (kept private to this file)
const money = (n) => `৳${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

// Chart colours, checked for colour-blind safety on light and dark backgrounds.
// Series 1 = blue, series 2 = orange (the same hue in each mode, stepped for the background).
const PALETTE = {
    light: { s1: "#2a78d6", s2: "#eb6834", grid: "#e5e5e5", axis: "#6b6b6b", text: "#1f1f1f", cursor: "rgba(0,0,0,0.05)" },
    dark: { s1: "#3987e5", s2: "#d95926", grid: "#2f3640", axis: "#9aa3ad", text: "#e6e6e6", cursor: "rgba(255,255,255,0.06)" },
};

// Follows the daisyUI theme (data-theme) or the system setting
const useIsDark = () => {
    const read = () => {
        const theme = document.documentElement.getAttribute("data-theme") || "";
        if (theme) return /dark|night|dim|black|business|coffee|dracula|forest|halloween|luxury|synthwave|sunset/.test(theme);
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
    };
    const [dark, setDark] = useState(read);
    useEffect(() => {
        const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
        const update = () => setDark(read());
        const obs = new MutationObserver(update);
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
        mq?.addEventListener?.("change", update);
        return () => {
            obs.disconnect();
            mq?.removeEventListener?.("change", update);
        };
    }, []);
    return dark;
};

// "2026-10-18" -> "18 Oct"
const shortDay = (key) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

const RANGES = [7, 14, 30];

const AdminAnalytics = () => {
    const axiosSecure = useAxiosSecure();
    const dark = useIsDark();
    const c = dark ? PALETTE.dark : PALETTE.light;
    const [days, setDays] = useState(14);

    const { data, isLoading, isError, error, refetch } = useQuery({
        queryKey: ["adminAnalytics", days],
        retry: 1,
        queryFn: async () => (await axiosSecure.get("/admin/analytics", { params: { days } })).data,
    });

    return (
        <div className="bg-base-100 rounded-xl shadow-sm p-5 md:p-6">
            {/* Header + date range (one row of controls above the charts) */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FaChartBar className="text-[#CAEB66]" /> Analytics
                </h3>
                <div className="join">
                    {RANGES.map((d) => (
                        <button
                            key={d}
                            onClick={() => setDays(d)}
                            className={`btn btn-sm join-item ${days === d ? "bg-[#CAEB66] text-black border-0 hover:bg-[#b8d955]" : ""}`}
                        >
                            {d} days
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-16">
                    <span className="loading loading-spinner loading-lg"></span>
                </div>
            ) : isError ? (
                <div className="text-center py-10">
                    <p className="text-error">{error?.response?.data?.message || "Failed to load analytics."}</p>
                    <button onClick={() => refetch()} className="btn btn-sm mt-3">Try again</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <RevenueChart data={data} c={c} />
                    <RegionChart data={data} c={c} />
                    <TopRiders data={data} c={c} />
                </div>
            )}
        </div>
    );
};

// Chart card with a "table" toggle so the numbers are always readable
const ChartCard = ({ title, subtitle, table, children, className = "" }) => {
    const [showTable, setShowTable] = useState(false);
    return (
        <div className={`rounded-xl border border-base-300 p-4 ${className}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <p className="font-semibold">{title}</p>
                    {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
                </div>
                {table && (
                    <button
                        onClick={() => setShowTable((v) => !v)}
                        className="btn btn-ghost btn-xs"
                        aria-pressed={showTable}
                        title={showTable ? "Show chart" : "Show table"}
                    >
                        {showTable ? <FaChartBar /> : <FaTable />} {showTable ? "Chart" : "Table"}
                    </button>
                )}
            </div>
            {showTable ? table : children}
        </div>
    );
};

// Tooltip box in the app's style; values in text colour, a small swatch carries the series colour
const TipBox = ({ title, rows }) => (
    <div className="rounded-lg border border-base-300 bg-base-100 shadow-lg px-3 py-2 text-xs">
        <p className="font-semibold mb-1">{title}</p>
        {rows.map((r) => (
            <p key={r.label} className="flex items-center gap-2">
                {r.color && <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: r.color }}></span>}
                <span className="text-gray-500">{r.label}</span>
                <span className="font-semibold ml-auto pl-3">{r.value}</span>
            </p>
        ))}
    </div>
);

// ---------- Revenue per day (one series: no legend, the title names it) ----------
const RevenueChart = ({ data, c }) => {
    const rows = data.revenueByDay.map((d) => ({ ...d, label: shortDay(d.date) }));
    const best = rows.reduce((m, d) => (d.revenue > m.revenue ? d : m), rows[0] || { revenue: 0 });

    return (
        <ChartCard
            className="xl:col-span-2"
            title={`Revenue per day · ${money(data.totals.revenue)}`}
            subtitle={`${data.totals.parcels} paid parcels in the last ${data.days} days${best?.revenue ? ` · best day ${best.label} (${money(best.revenue)})` : ""}`}
            table={
                <div className="overflow-x-auto max-h-64">
                    <table className="table table-xs">
                        <thead>
                            <tr><th>Day</th><th className="text-right">Parcels</th><th className="text-right">Revenue</th></tr>
                        </thead>
                        <tbody>
                            {[...rows].reverse().map((d) => (
                                <tr key={d.date}>
                                    <td>{d.label}</td>
                                    <td className="text-right">{d.parcels}</td>
                                    <td className="text-right">{money(d.revenue)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
        >
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
                        <CartesianGrid vertical={false} stroke={c.grid} />
                        <XAxis
                            dataKey="label"
                            tick={{ fill: c.axis, fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                            minTickGap={16}
                        />
                        <YAxis
                            tick={{ fill: c.axis, fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                            width={56}
                            tickFormatter={(v) => money(v)}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: c.cursor }}
                            content={({ active, payload }) =>
                                active && payload?.length ? (
                                    <TipBox
                                        title={payload[0].payload.label}
                                        rows={[
                                            { label: "Revenue", value: money(payload[0].payload.revenue), color: c.s1 },
                                            { label: "Paid parcels", value: payload[0].payload.parcels },
                                        ]}
                                    />
                                ) : null
                            }
                        />
                        <Bar dataKey="revenue" name="Revenue" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
};

// ---------- Parcels per region (two series: legend + direct value labels) ----------
const RegionChart = ({ data, c }) => {
    const rows = data.parcelsByRegion;
    const height = Math.max(160, rows.length * 44 + 40);

    return (
        <ChartCard
            title="Parcels per region"
            subtitle="All paid parcels, by the sender's and receiver's division"
            table={
                <div className="overflow-x-auto">
                    <table className="table table-xs">
                        <thead>
                            <tr><th>Region</th><th className="text-right">Sent from</th><th className="text-right">Sent to</th></tr>
                        </thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.region}>
                                    <td>{r.region}</td>
                                    <td className="text-right">{r.sent}</td>
                                    <td className="text-right">{r.received}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            }
        >
            {rows.length === 0 ? (
                <p className="text-sm text-gray-500 py-10 text-center">No paid parcels yet.</p>
            ) : (
                <div style={{ height }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={rows}
                            layout="vertical"
                            margin={{ top: 0, right: 28, left: 0, bottom: 0 }}
                            barGap={2}
                            barCategoryGap="22%"
                        >
                            <CartesianGrid horizontal={false} stroke={c.grid} />
                            <XAxis type="number" allowDecimals={false} tick={{ fill: c.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis
                                type="category"
                                dataKey="region"
                                tick={{ fill: c.text, fontSize: 12 }}
                                axisLine={false}
                                tickLine={false}
                                width={88}
                            />
                            <Tooltip
                                cursor={{ fill: c.cursor }}
                                content={({ active, payload }) =>
                                    active && payload?.length ? (
                                        <TipBox
                                            title={payload[0].payload.region}
                                            rows={[
                                                { label: "Sent from", value: payload[0].payload.sent, color: c.s1 },
                                                { label: "Sent to", value: payload[0].payload.received, color: c.s2 },
                                            ]}
                                        />
                                    ) : null
                                }
                            />
                            <Legend
                                verticalAlign="top"
                                align="left"
                                height={28}
                                iconType="square"
                                iconSize={10}
                                formatter={(value) => <span style={{ color: c.text, fontSize: 12 }}>{value}</span>}
                            />
                            <Bar dataKey="sent" name="Sent from" fill={c.s1} radius={[0, 4, 4, 0]} maxBarSize={14}>
                                <LabelList dataKey="sent" position="right" fill={c.text} fontSize={11} />
                            </Bar>
                            <Bar dataKey="received" name="Sent to" fill={c.s2} radius={[0, 4, 4, 0]} maxBarSize={14}>
                                <LabelList dataKey="received" position="right" fill={c.text} fontSize={11} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}
        </ChartCard>
    );
};

// ---------- Top riders this month (a ranked list with value bars) ----------
const TopRiders = ({ data, c }) => {
    const riders = data.topRiders;
    const max = Math.max(1, ...riders.map((r) => r.earned));
    const monthName = new Date(`${data.month}-01T00:00:00Z`).toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });

    return (
        <ChartCard title="Top riders this month" subtitle={`By earnings in ${monthName}`}>
            {riders.length === 0 ? (
                <p className="text-sm text-gray-500 py-10 text-center">No finished jobs this month yet.</p>
            ) : (
                <ol className="space-y-3">
                    {riders.map((r, i) => (
                        <li key={r.email}>
                            <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="flex items-center gap-2 min-w-0">
                                    <span className={`w-6 text-center font-bold ${i === 0 ? "text-[#CAEB66]" : "text-gray-500"}`}>
                                        {i === 0 ? <FaTrophy className="inline" /> : i + 1}
                                    </span>
                                    <span className="font-medium truncate">{r.name}</span>
                                </span>
                                <span className="whitespace-nowrap">
                                    <span className="font-semibold">{money(r.earned)}</span>
                                    <span className="text-xs text-gray-500"> · {r.jobs} {r.jobs === 1 ? "job" : "jobs"}</span>
                                </span>
                            </div>
                            <div className="ml-8 mt-1.5 h-2 rounded-full" style={{ background: c.grid }}>
                                <div
                                    className="h-2 rounded-full"
                                    style={{ width: `${(r.earned / max) * 100}%`, background: c.s1 }}
                                    title={`${r.name}: ${money(r.earned)}`}
                                ></div>
                            </div>
                        </li>
                    ))}
                </ol>
            )}
        </ChartCard>
    );
};

export default AdminAnalytics;