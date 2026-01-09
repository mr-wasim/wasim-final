"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FiUsers,
  FiUser,
  FiFilter,
  FiCalendar,
  FiRefreshCw,
  FiPhoneCall,
  FiDollarSign,
  FiClock,
} from "react-icons/fi";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TechnicianCallsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  const [selectedTech, setSelectedTech] = useState("all");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  // optional custom date range
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [techOptions, setTechOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [calls, setCalls] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/login");
          return;
        }
        const me = await res.json();
        if (me.role !== "admin") {
          router.push("/login");
          return;
        }
        setUser(me);
      } catch {
        router.push("/login");
      }
    })();
  }, [router]);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (selectedTech && selectedTech !== "all") params.set("techId", selectedTech);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    return params.toString();
  };

  const loadData = useCallback(
    async ({ showToast = false } = {}) => {
      if (!user) return;
      try {
        setRefreshing(true);
        if (loading) setLoading(true);

        const qs = buildParams();
        const res = await fetch(`/api/admin/technician-calls?${qs}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Failed to load technician stats");
        }

        setTechOptions(data.technicians || []);
        setSummary(data.summary || null);
        setCalls(data.calls || []);

        if (showToast) toast.success("Technician stats updated");
      } catch (err) {
        console.error("Technician calls load error:", err);
        toast.error(err.message || "Failed to load data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, month, selectedTech, dateFrom, dateTo, loading]
  );

  useEffect(() => {
    if (!user) return;
    loadData({ showToast: false });
  }, [user, loadData]);

  const handleApply = () => {
    // if custom range provided, clear month to avoid conflict OR we pass both (backend handles precedence)
    loadData({ showToast: true });
  };

  const activeTech = useMemo(
    () =>
      selectedTech === "all"
        ? null
        : techOptions.find((t) => t._id === selectedTech) || null,
    [selectedTech, techOptions]
  );

  const isAllMode = !activeTech;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow-md">
              <FiPhoneCall className="text-xl" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Technician Calls
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Track closed calls and earnings per technician by month and lifetime. Payments are sourced from payments collection for exact matching.
              </p>
            </div>
          </div>

          <button
            onClick={() => loadData({ showToast: true })}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition"
          >
            <motion.span
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{
                repeat: refreshing ? Infinity : 0,
                duration: 0.8,
                ease: "linear",
              }}
            >
              <FiRefreshCw />
            </motion.span>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <section className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
            <FiFilter className="text-slate-500" />
            Filters
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Technician select */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Technician
              </label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-slate-400 text-sm">
                  <FiUser />
                </span>
                <select
                  value={selectedTech}
                  onChange={(e) => setSelectedTech(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/60 outline-none"
                >
                  <option value="all">All Technicians</option>
                  {techOptions.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name || "Unnamed"}
                      {t.phone ? ` (${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Month select */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Month
              </label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-slate-400 text-sm">
                  <FiCalendar />
                </span>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50/60 outline-none"
                />
              </div>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                From (optional)
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 outline-none"
              />
            </div>

            {/* Date to */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                To (optional)
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-3 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 outline-none"
              />
            </div>

            {/* Apply button (full width row) */}
            <div className="col-span-1 sm:col-span-4 flex items-end justify-start sm:justify-end">
              <button
                onClick={handleApply}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition w-full sm:w-auto"
              >
                Apply
              </button>
            </div>
          </div>
        </section>

        {/* Summary cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard
            icon={<FiPhoneCall />}
            label="Calls Closed (This Month)"
            value={summary?.monthClosed ?? 0}
            accent="from-indigo-500 to-indigo-600"
          />
          <SummaryCard
            icon={<FiPhoneCall />}
            label="Calls Closed (Lifetime)"
            value={summary?.totalClosed ?? 0}
            accent="from-blue-500 to-blue-600"
          />
          <SummaryCard
            icon={<FiDollarSign />}
            label="Amount (This Month)"
            value={`₹${(summary?.monthAmount ?? 0).toFixed(0)}`}
            accent="from-emerald-500 to-emerald-600"
          />
          <SummaryCard
            icon={<FiDollarSign />}
            label="Amount (Lifetime)"
            value={`₹${(summary?.totalAmount ?? 0).toFixed(0)}`}
            accent="from-violet-500 to-violet-600"
          />
        </section>

        {/* Technicians overview / detail */}
        <section className="space-y-4">
          {/* All technicians overview */}
          {isAllMode && (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <FiUsers className="text-slate-500" />
                  <span>Technician Overview</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {techOptions.length} technicians
                </span>
              </div>

              {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-24 rounded-2xl bg-slate-100/70 animate-pulse"
                    />
                  ))}
                </div>
              )}

              {!loading && techOptions.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  No technicians found.
                </div>
              )}

              {!loading && techOptions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {techOptions.map((t) => (
                    <motion.button
                      key={t._id}
                      onClick={() => setSelectedTech(t._id)}
                      whileTap={{ scale: 0.97 }}
                      className="text-left rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 p-3 sm:p-4 transition shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl overflow-hidden bg-indigo-600 text-white grid place-items-center text-sm font-bold">
                          {t.avatar ? (
                            <img
                              src={t.avatar}
                              alt={t.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (t.name || "?")
                              .toString()
                              .trim()
                              .charAt(0)
                              .toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 truncate">
                            {t.name || "Unnamed"}
                          </div>
                          {t.phone && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {t.phone}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">
                            Month closed
                          </div>
                          <div className="font-semibold text-slate-800">
                            {t.monthClosed ?? 0}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">
                            Lifetime closed
                          </div>
                          <div className="font-semibold text-slate-800">
                            {t.totalClosed ?? 0}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">
                            Month amount
                          </div>
                          <div className="font-semibold text-emerald-700">
                            ₹{(t.monthAmount ?? 0).toFixed(0)}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">
                            Lifetime amount
                          </div>
                          <div className="font-semibold text-emerald-700">
                            ₹{(t.totalAmount ?? 0).toFixed(0)}
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Single technician detail */}
          {!isAllMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-2xl overflow-hidden bg-indigo-600 text-white grid place-items-center text-sm font-bold">
                    {activeTech?.avatar ? (
                      <img
                        src={activeTech.avatar}
                        alt={activeTech.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      (activeTech?.name || "?")
                        .toString()
                        .trim()
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm sm:text-base">
                      {activeTech?.name || "Technician"}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Selected technician overview
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTech("all")}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition"
                >
                  Clear filter
                </button>
              </div>

              {/* Calls grouped by status */}
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <StatusPanel
                    title="Pending"
                    count={calls.filter((c) => c.status === "Pending").length}
                    amount={calls
                      .filter((c) => c.status === "Pending")
                      .reduce((s, c) => s + (c.price || 0), 0)}
                  />
                  <StatusPanel
                    title="Closed"
                    count={calls.filter((c) => c.status === "Closed").length}
                    amount={calls
                      .filter((c) => c.status === "Closed")
                      .reduce((s, c) => s + (c.paymentTotal || 0), 0)}
                  />
                  <StatusPanel
                    title="Cancelled"
                    count={calls.filter((c) => c.status === "Cancelled").length}
                    amount={calls
                      .filter((c) => c.status === "Cancelled")
                      .reduce((s, c) => s + (c.price || 0), 0)}
                  />
                </div>

                {/* Lists */}
                <div className="space-y-4">
                  {["Closed", "Pending", "Cancelled"].map((st) => {
                    const list = calls.filter((c) => c.status === st);
                    return (
                      <div key={st}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-sm text-slate-800">
                            {st} ({list.length})
                          </div>
                          <div className="text-[12px] text-slate-500">
                            {st === "Closed"
                              ? `Total collected ₹${list
                                  .reduce((s, c) => s + (c.paymentTotal || 0), 0)
                                  .toFixed(0)}`
                              : `Total ₹${list
                                  .reduce((s, c) => s + (c.price || 0), 0)
                                  .toFixed(0)}`}
                          </div>
                        </div>

                        {list.length === 0 ? (
                          <div className="p-3 text-sm text-slate-500">No calls</div>
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {list.map((c) => (
                              <div
                                key={c._id}
                                className="px-3 py-2 flex items-start gap-3"
                              >
                                <div className="h-10 w-10 rounded-md bg-indigo-600 text-white grid place-items-center font-semibold">
                                  {(c.clientName || c.customerName || "?")
                                    .toString()
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="font-semibold text-sm text-slate-900">
                                      {c.clientName || c.customerName || "—"}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {formatDateTime(c.closedAt || c.createdAt)}
                                    </div>
                                  </div>
                                  <div className="text-[13px] text-slate-700">
                                    {c.phone || "—"} • {c.address || "—"}
                                  </div>
                                  <div className="text-[12px] text-slate-600 mt-1 flex items-center gap-3">
                                    <span>Price: ₹{(c.price || 0).toFixed(0)}</span>
                                    {st === "Closed" && (
                                      <span>
                                        Collected: ₹{(c.paymentTotal || 0).toFixed(0)}
                                        {c.paymentMismatch ? (
                                          <span className="ml-2 text-xs text-rose-600">
                                            (mismatch)
                                          </span>
                                        ) : (
                                          <span className="ml-2 text-xs text-emerald-700">
                                            (matched)
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ icon, label, value, accent }) {
  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-3 sm:p-4 flex items-center gap-3"
    >
      <div
        className={`h-9 w-9 rounded-2xl bg-gradient-to-br ${accent} text-white grid place-items-center shadow`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
          {value}
        </div>
      </div>
    </motion.div>
  );
}

function StatusPanel({ title, count, amount }) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="text-[11px] text-slate-500 uppercase">{title}</div>
      <div className="flex items-baseline gap-3">
        <div className="font-semibold text-lg">{count}</div>
        <div className="text-[13px] text-slate-600">₹{(amount || 0).toFixed(0)}</div>
      </div>
    </div>
  );
}
