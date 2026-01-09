"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiUsers,
  FiUser,
  FiFilter,
  FiCalendar,
  FiRefreshCw,
  FiPhoneCall,
  FiDollarSign,
  FiClock,
  FiChevronDown,
  FiChevronUp,
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
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function formatDuration(ms) {
  if (!ms || ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (days) return `${days}d ${hours}h ${mins}m`;
  if (hours) return `${hours}h ${mins}m`;
  if (mins) return `${mins}m`;
  return `${sec}s`;
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

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [techOptions, setTechOptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [calls, setCalls] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusTab, setStatusTab] = useState("Closed"); // Closed | Pending | Cancelled
  const [query, setQuery] = useState("");
  const [expandedCall, setExpandedCall] = useState(null);

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

        // Normalize numbers for safety
        const technicians = (data.technicians || []).map((t) => ({
          ...t,
          monthAmount: safeNum(t.monthAmount),
          totalAmount: safeNum(t.totalAmount),
          monthClosed: Number(t.monthClosed || 0),
          totalClosed: Number(t.totalClosed || 0),
        }));

        const callsNorm = (data.calls || []).map((c) => {
          return {
            ...c,
            price: safeNum(c.price),
            submittedAmount: safeNum(c.submittedAmount),
            lastPaymentAt: c.lastPaymentAt ? new Date(c.lastPaymentAt) : null,
            closedAt: c.closedAt ? new Date(c.closedAt) : null,
            createdAt: c.createdAt ? new Date(c.createdAt) : null,
            clientAvatar: c.clientAvatar || c.avatar || c.profilePic || null,
            paymentDocs: c.paymentDocs || [],
          };
        });

        setTechOptions(technicians);
        setSummary({
          monthClosed: Number(data.summary?.monthClosed || 0),
          monthAmount: safeNum(data.summary?.monthAmount || 0),
          monthSubmitted: safeNum(data.summary?.monthSubmitted || 0),
          totalClosed: Number(data.summary?.totalClosed || 0),
          totalAmount: safeNum(data.summary?.totalAmount || 0),
        });
        setCalls(callsNorm);

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

  const handleApply = () => loadData({ showToast: true });

  const activeTech = useMemo(
    () => (selectedTech === "all" ? null : techOptions.find((t) => t._id === selectedTech) || null),
    [selectedTech, techOptions]
  );
  const isAllMode = !activeTech;

  const counts = {
    Closed: calls.filter((c) => c.status === "Closed").length,
    Pending: calls.filter((c) => c.status === "Pending").length,
    Cancelled: calls.filter((c) => c.status === "Cancelled").length,
  };
  const amounts = {
    Closed: calls.filter((c) => c.status === "Closed").reduce((s, c) => s + c.submittedAmount, 0),
    Pending: calls.filter((c) => c.status === "Pending").reduce((s, c) => s + c.price, 0),
    Cancelled: calls.filter((c) => c.status === "Cancelled").reduce((s, c) => s + c.price, 0),
  };

  const filteredList = calls.filter(
    (c) =>
      c.status === statusTab &&
      (((c.clientName || c.customerName || "").toLowerCase().includes(query.toLowerCase()) ||
        (c.phone || "").includes(query) ||
        (c.address || "").toLowerCase().includes(query.toLowerCase())))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.03 }} className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white grid place-items-center shadow-md">
              <FiPhoneCall className="text-xl" />
            </motion.div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Technician Calls</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Reconciled amounts from payments. Profile images, pending/cancelled/closed grouping and search included.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search customer / phone / address" className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none" />
            <button onClick={() => loadData({ showToast: true })} disabled={refreshing} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition">
              <motion.span animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={{ repeat: refreshing ? Infinity : 0, duration: 0.8, ease: "linear" }}>
                <FiRefreshCw />
              </motion.span>
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <section className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
            <FiFilter className="text-slate-500" /> Filters
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Technician</label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-slate-400 text-sm"><FiUser /></span>
                <select value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 outline-none">
                  <option value="all">All Technicians</option>
                  {techOptions.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}{t.phone ? ` (${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Month</label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-slate-400 text-sm"><FiCalendar /></span>
                <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full pl-3 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 outline-none" />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full pl-3 pr-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50/60 outline-none" />
            </div>

            <div className="flex justify-end">
              <button onClick={handleApply} className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition">Apply</button>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <SummaryCard icon={<FiPhoneCall />} label="Calls Closed (This Month)" value={summary?.monthClosed ?? 0} accent="from-indigo-500 to-indigo-600" />
          <SummaryCard icon={<FiPhoneCall />} label="Calls Closed (Lifetime)" value={summary?.totalClosed ?? 0} accent="from-blue-500 to-blue-600" />
          <SummaryCard icon={<FiDollarSign />} label="Amount (This Month)" value={`₹${safeNum(summary?.monthAmount).toFixed(0)}`} accent="from-emerald-500 to-emerald-600" />
          <SummaryCard icon={<FiDollarSign />} label="Amount (Lifetime)" value={`₹${safeNum(summary?.totalAmount).toFixed(0)}`} accent="from-violet-500 to-violet-600" />
        </section>

        {/* Technicians + Detail */}
        <section className="space-y-4">
          {isAllMode && (
            <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FiUsers className="text-slate-500" /> Technician Overview</div>
                <span className="text-[11px] text-slate-500">{techOptions.length} technicians</span>
              </div>

              {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-2xl bg-slate-100/70 animate-pulse" />
                  ))}
                </div>
              )}

              {!loading && techOptions.length === 0 && <div className="p-6 text-center text-sm text-slate-500">No technicians found.</div>}

              {!loading && techOptions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {techOptions.map((t) => (
                    <motion.button key={t._id} whileTap={{ scale: 0.97 }} onClick={() => setSelectedTech(t._id)} className="text-left rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 transition shadow-sm hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
                          {t.avatar ? <img src={t.avatar} alt={t.name} className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-lg font-bold text-slate-700">{(t.name || "?").toString().trim().charAt(0).toUpperCase()}</div>}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-slate-900 truncate">{t.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{t.phone || "—"}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-slate-600">
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Month closed</div>
                          <div className="font-semibold text-slate-800">{t.monthClosed ?? 0}</div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Lifetime closed</div>
                          <div className="font-semibold text-slate-800">{t.totalClosed ?? 0}</div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Month amount</div>
                          <div className="font-semibold text-emerald-700">₹{safeNum(t.monthAmount).toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Lifetime amount</div>
                          <div className="font-semibold text-emerald-700">₹{safeNum(t.totalAmount).toFixed(0)}</div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isAllMode && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
                    {activeTech?.avatar ? <img src={activeTech.avatar} alt={activeTech.name} className="h-full w-full object-cover" /> : <div className="h-full w-full grid place-items-center text-lg font-bold text-slate-700">{(activeTech?.name || "?").toString().trim().charAt(0).toUpperCase()}</div>}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 text-sm sm:text-base">{activeTech?.name}</div>
                    <div className="text-[12px] text-slate-500">Selected technician overview</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedTech("all")} className="px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200">Clear filter</button>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {["Closed", "Pending", "Cancelled"].map((st) => (
                      <button key={st} onClick={() => setStatusTab(st)} className={`px-3 py-2 rounded-lg text-sm font-semibold ${statusTab === st ? "bg-indigo-600 text-white" : "bg-slate-50 text-slate-700"} transition`}>
                        {st} <span className="ml-2 inline-block text-xs bg-white/10 px-2 py-0.5 rounded-md">{counts[st] || 0}</span>
                      </button>
                    ))}
                  </div>

                  <div className="text-sm text-slate-500">Total: ₹{safeNum(amounts[statusTab]).toFixed(0)}</div>
                </div>

                <div className="mb-3 text-sm text-slate-500">Showing <span className="font-semibold text-slate-700">{statusTab}</span> calls for selected period.</div>

                {loading ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-16 rounded-xl bg-slate-100/70 animate-pulse" />))}</div>
                ) : filteredList.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">No calls in this category.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredList.map((c) => {
                      const clientName = c.clientName || c.customerName || "—";
                      const avatar = c.clientAvatar;
                      const matched = safeNum(c.submittedAmount);
                      const price = safeNum(c.price);
                      const matchPercent = price > 0 ? Math.min(100, Math.round((matched / price) * 100)) : 0;
                      const afterClosedMs = (c.lastPaymentAt && c.closedAt) ? (c.lastPaymentAt - c.closedAt) : null;

                      return (
                        <motion.div key={c._id} whileHover={{ backgroundColor: "#f8fafc" }} className="px-3 py-3 flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-md overflow-hidden bg-indigo-600 text-white grid place-items-center font-semibold text-lg flex-shrink-0">
                              {avatar ? <img src={avatar} alt={clientName} className="h-full w-full object-cover" /> : (clientName[0] || "?").toString().toUpperCase()}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-semibold text-sm text-slate-900">{clientName}</div>
                                  <div className="text-[13px] text-slate-700">{c.phone || "—"} • {c.address || "—"}</div>
                                </div>
                                <div className="text-[12px] text-slate-500">{formatDateTime(c.closedAt || c.createdAt)}</div>
                              </div>

                              <div className="text-[12px] text-slate-600 mt-2 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div>Price: <span className="font-semibold">₹{price.toFixed(0)}</span></div>
                                  <div>
                                    Collected: <span className="font-semibold">₹{matched.toFixed(0)}</span>
                                    {matched >= price ? <span className="ml-2 text-xs text-emerald-700">(matched)</span> : matched > 0 ? <span className="ml-2 text-xs text-amber-600">(partial)</span> : <span className="ml-2 text-xs text-rose-600">(unsubmitted)</span>}
                                  </div>
                                </div>

                                <div className="text-right text-xs text-slate-500">
                                  <div>Last payment: {c.lastPaymentAt ? formatDateTime(c.lastPaymentAt) : "—"}</div>
                                  <div>Δ: {afterClosedMs ? `${formatDuration(afterClosedMs)} after close` : "—"}</div>
                                </div>
                              </div>

                              {/* progress */}
                              <div className="mt-3">
                                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                  <div style={{ width: `${matchPercent}%` }} className={`h-2 ${matchPercent >= 100 ? "bg-emerald-500" : matchPercent > 0 ? "bg-amber-400" : "bg-rose-400"}`} />
                                </div>
                                <div className="text-[11px] text-slate-500 mt-1">{matchPercent}% of price submitted</div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <button onClick={() => setExpandedCall(expandedCall === c._id ? null : c._id)} className="px-3 py-1 rounded-lg bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                {expandedCall === c._id ? <><FiChevronUp/> Hide</> : <><FiChevronDown/> Details</>}
                              </button>
                            </div>
                          </div>

                          <AnimatePresence initial={false}>
                            {expandedCall === c._id && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 p-3 text-sm text-slate-700 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold">Payment details</div>
                                    <div className="text-xs text-slate-500">Status: <span className="font-semibold">{c.paymentStatus || (matched >= price ? "Submitted" : matched > 0 ? "Partial" : "Unsubmitted")}</span></div>
                                  </div>

                                  {c.paymentDocs && c.paymentDocs.length > 0 ? (
                                    <div className="space-y-2">
                                      {c.paymentDocs.map((pd) => (
                                        <div key={pd._id} className="flex items-center justify-between bg-white rounded-md p-2 border border-slate-100">
                                          <div className="text-[13px]">
                                            <div className="font-medium">{new Date(pd.createdAt).toLocaleString()}</div>
                                            <div className="text-xs text-slate-500">Mode: payment record</div>
                                          </div>
                                          <div className="text-sm text-slate-700">
                                            <div>Online: ₹{safeNum(pd.onlineAmount).toFixed(0)}</div>
                                            <div>Cash: ₹{safeNum(pd.cashAmount).toFixed(0)}</div>
                                            <div className="font-semibold">Total: ₹{(safeNum(pd.onlineAmount) + safeNum(pd.cashAmount)).toFixed(0)}</div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-slate-500">No payment records found for this call in the selected period.</div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
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
    <motion.div whileHover={{ scale: 1.01 }} className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-3 sm:p-4 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-2xl bg-gradient-to-br ${accent} text-white grid place-items-center shadow`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-base sm:text-lg font-bold text-slate-900 truncate">{value}</div>
      </div>
    </motion.div>
  );
}
