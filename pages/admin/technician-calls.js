// pages/admin/technician-calls.js
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

  const loadData = useCallback(
    async ({ showToast = false } = {}) => {
      if (!user || !month) return;
      try {
        setRefreshing(true);
        if (loading) setLoading(true);

        const params = new URLSearchParams({
          month,
        });
        if (selectedTech && selectedTech !== "all") {
          params.set("techId", selectedTech);
        }

        const res = await fetch(
          `/api/admin/technician-calls?${params.toString()}`,
          {
            cache: "no-store",
          }
        );

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
    [user, month, selectedTech, loading]
  );

  useEffect(() => {
    if (!user) return;
    loadData({ showToast: false });
  }, [user, loadData]);

  const handleApply = () => {
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
                Track closed calls and earnings per technician by month and lifetime.
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {/* Apply button */}
            <div className="flex items-end justify-start sm:justify-end">
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
            value={`₹${summary?.monthAmount ?? 0}`}
            accent="from-emerald-500 to-emerald-600"
          />
          <SummaryCard
            icon={<FiDollarSign />}
            label="Amount (Lifetime)"
            value={`₹${summary?.totalAmount ?? 0}`}
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
                        <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center text-sm font-bold">
                          {(t.name || "?")
                            .toString()
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
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
                            ₹{t.monthAmount ?? 0}
                          </div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">
                            Lifetime amount
                          </div>
                          <div className="font-semibold text-emerald-700">
                            ₹{t.totalAmount ?? 0}
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
                  <div className="h-9 w-9 rounded-2xl bg-indigo-600 text-white grid place-items-center text-sm font-bold">
                    {(activeTech?.name || "?")
                      .toString()
                      .trim()
                      .charAt(0)
                      .toUpperCase()}
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

              {/* Calls table */}
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="hidden md:grid grid-cols-[1.4fr,1fr,2fr,1fr,1.3fr] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
                  <span>Customer</span>
                  <span>Phone</span>
                  <span>Address</span>
                  <span>Price</span>
                  <span>Closed Date</span>
                </div>

                {loading && (
                  <div className="p-4 space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-16 rounded-xl bg-slate-100/70 animate-pulse"
                      />
                    ))}
                  </div>
                )}

                {!loading && calls.length === 0 && (
                  <div className="p-6 text-center text-sm text-slate-500">
                    No closed calls found for this technician and month.
                  </div>
                )}

                {!loading && calls.length > 0 && (
                  <div className="divide-y divide-slate-100">
                    {calls.map((c) => (
                      <div
                        key={c._id}
                        className="px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-slate-50/60 transition"
                      >
                        {/* desktop */}
                        <div className="hidden md:grid grid-cols-[1.4fr,1fr,2fr,1fr,1.3fr] gap-3 items-start text-sm text-slate-800">
                          {/* customer */}
                          <div className="flex items-start gap-2">
                            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white grid place-items-center text-sm font-bold">
                              {(c.clientName || c.customerName || "?")
                                .toString()
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold">
                                {c.clientName || c.customerName || "—"}
                              </div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <FiPhoneCall className="text-[10px]" />
                                Service: {c.type || c.serviceType || "—"}
                              </div>
                            </div>
                          </div>

                          {/* phone */}
                          <div className="text-sm text-slate-800">
                            {c.phone || "—"}
                          </div>

                          {/* address */}
                          <div className="text-xs sm:text-sm text-slate-700 line-clamp-2">
                            {c.address || "—"}
                          </div>

                          {/* price */}
                          <div className="font-semibold text-emerald-700 text-sm">
                            ₹{c.price ?? 0}
                          </div>

                          {/* date */}
                          <div className="flex flex-col text-xs sm:text-sm text-slate-700 gap-0.5">
                            <div className="flex items-center gap-1">
                              <FiClock className="text-slate-400" />
                              <span>{formatDateTime(c.closedAt || c.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        {/* mobile */}
                        <div className="md:hidden space-y-1.5 text-sm text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white grid place-items-center text-sm font-bold">
                              {(c.clientName || c.customerName || "?")
                                .toString()
                                .trim()
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold">
                                {c.clientName || c.customerName || "—"}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {c.phone || "—"}
                              </div>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500">
                            {c.type || c.serviceType || "—"} • ₹{c.price ?? 0}
                          </div>

                          <div className="text-[11px] text-slate-500">
                            {formatDateTime(c.closedAt || c.createdAt)}
                          </div>

                          <div className="text-[11px] text-slate-500 line-clamp-2">
                            {c.address || "—"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
