// pages/admin/all-customers.js
"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/router";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  FiSearch,
  FiFilter,
  FiRefreshCw,
  FiDownload,
  FiUsers,
  FiPhone,
  FiMapPin,
  FiAlertTriangle,
  FiCalendar,
} from "react-icons/fi";

const PAGE_SIZE = 20;

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

function escapeCSV(value) {
  if (value == null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export default function AllCustomersPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // auth check (admin)
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

  const load = useCallback(
    async ({ resetPage = false, showToast = false } = {}) => {
      if (!user) return;
      try {
        setIsFetching(true);
        if (resetPage) setPage(1);

        const currentPage = resetPage ? 1 : page;

        const params = new URLSearchParams({
          page: String(currentPage),
          pageSize: String(PAGE_SIZE),
        });

        if (search.trim()) params.set("search", search.trim());
        if (dateFrom) params.set("from", dateFrom);
        if (dateTo) params.set("to", dateTo);

        const res = await fetch(`/api/admin/all-customers?${params.toString()}`, {
          cache: "no-store",
        });

        const data = await res.json();
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || "Failed to load customers");
        }

        setItems(data.items || []);
        setTotal(data.total || 0);
        setHasMore(data.hasMore ?? (data.items?.length === PAGE_SIZE));

        if (showToast) toast.success("Data refreshed");
      } catch (err) {
        console.error("All customers load error:", err);
        toast.error(err.message || "Failed to load data");
      } finally {
        setInitialLoading(false);
        setIsFetching(false);
      }
    },
    [user, page, search, dateFrom, dateTo]
  );

  useEffect(() => {
    if (!user) return;
    load({ resetPage: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  const totalPages = useMemo(() => {
    if (!total) return page;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total, page]);

  const handleApplyFilters = () => {
    setPage(1);
    load({ resetPage: true, showToast: true });
  };

  const handleResetFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    load({ resetPage: true, showToast: true });
  };

  const handleExportCSV = () => {
    if (!items.length) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Customer Name",
      "Phone",
      "Address",
      "Service Type",
      "Price",
      "Service Date",
      "Technician Name",
    ];

    const rows = items.map((c) => {
      const techLabel =
        c.techName ||
        c.technicianName ||
        c.techUsername ||
        "Unknown technician";
      return [
        c.clientName || c.customerName || "—",
        c.phone || "",
        c.address || "",
        c.type || c.serviceType || "",
        c.price ?? 0,
        formatDateTime(c.createdAt || c.serviceDate),
        techLabel,
      ];
    });

    const csvLines = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ];

    const blob = new Blob([csvLines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().split("T")[0];
    a.href = url;
    a.download = `chimney-all-customers-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Exported CSV (Excel compatible)");
  };

  const isEmpty = !initialLoading && items.length === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
        {/* Title + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow-md">
              <FiUsers className="text-xl" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                All Customers
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                All forwarded calls and customer records across all technicians.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm active:scale-95 transition"
            >
              <FiDownload />
              Export (Excel / CSV)
            </button>
            <button
              onClick={() => load({ resetPage: false, showToast: true })}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-95 transition"
            >
              <motion.span
                animate={isFetching ? { rotate: 360 } : { rotate: 0 }}
                transition={{
                  repeat: isFetching ? Infinity : 0,
                  duration: 0.8,
                  ease: "linear",
                }}
              >
                <FiRefreshCw />
              </motion.span>
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <section className="rounded-2xl bg-white border border-slate-200/70 shadow-sm p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
            <FiFilter className="text-slate-500" />
            Filters
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="col-span-1 sm:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Search (name / phone / address)
              </label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-slate-400 text-sm">
                  <FiSearch />
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="eg. Rahul, 98765..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/60"
                />
              </div>
            </div>

            {/* Date from */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                From date
              </label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-slate-400 text-sm">
                  <FiCalendar />
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/60"
                />
              </div>
            </div>

            {/* Date to */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                To date
              </label>
              <div className="relative">
                <span className="absolute left-2 top-2.5 text-slate-400 text-sm">
                  <FiCalendar />
                </span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-slate-50/60"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end pt-1">
            <button
              onClick={handleResetFilters}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 active:scale-95 transition"
            >
              Reset
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition"
            >
              Apply Filters
            </button>
          </div>
        </section>

        {/* Meta info */}
        <div className="text-xs sm:text-sm text-slate-600 flex flex-wrap items-center gap-2">
          <span>
            Page{" "}
            <span className="font-semibold">
              {page}
            </span>{" "}
            of{" "}
            <span className="font-semibold">
              {totalPages}
            </span>
          </span>
          <span className="text-slate-400">•</span>
          <span>
            Showing <span className="font-semibold">{items.length}</span> records on this page
          </span>
          {typeof total === "number" && total > 0 && (
            <>
              <span className="text-slate-400">•</span>
              <span>
                Total{" "}
                <span className="font-semibold">{total}</span>{" "}
                records
              </span>
            </>
          )}
        </div>

        {/* Table / cards */}
        <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="hidden md:grid grid-cols-[1.4fr,1fr,2fr,1fr,1fr,1.4fr] gap-3 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
            <span>Customer</span>
            <span>Phone</span>
            <span>Address</span>
            <span>Service</span>
            <span>Price</span>
            <span>Service Date / Technician</span>
          </div>

          {initialLoading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl bg-slate-100/70 animate-pulse"
                />
              ))}
            </div>
          )}

          {isEmpty && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No customers found for selected filters.
            </div>
          )}

          {!initialLoading && !isEmpty && (
            <div className="divide-y divide-slate-100">
              {items.map((c) => {
                const techLabel =
                  c.techName ||
                  c.technicianName ||
                  c.techUsername ||
                  "Unknown technician";

                return (
                  <div
                    key={c._id}
                    className="px-3 sm:px-4 py-3 sm:py-3.5 hover:bg-slate-50/60 transition"
                  >
                    {/* desktop row */}
                    <div className="hidden md:grid grid-cols-[1.4fr,1fr,2fr,1fr,1fr,1.4fr] gap-3 items-start text-sm text-slate-800">
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
                            <FiUsers className="text-[10px]" />
                            {techLabel}
                          </div>
                        </div>
                      </div>

                      {/* phone */}
                      <div className="flex items-center gap-1 text-sm">
                        <FiPhone className="text-slate-400" />
                        <span>{c.phone || "—"}</span>
                      </div>

                      {/* address */}
                      <div className="flex items-start gap-1 text-xs sm:text-sm text-slate-700">
                        <FiMapPin className="mt-0.5 text-slate-400 shrink-0" />
                        <span className="line-clamp-2">
                          {c.address || "—"}
                        </span>
                      </div>

                      {/* service type */}
                      <div className="flex items-center gap-1 text-xs sm:text-sm">
                        <FiAlertTriangle className="text-slate-400" />
                        <span>{c.type || c.serviceType || "—"}</span>
                      </div>

                      {/* price */}
                      <div className="font-semibold text-sm text-emerald-700">
                        ₹{c.price ?? 0}
                      </div>

                      {/* date + tech */}
                      <div className="flex flex-col gap-1 text-xs sm:text-sm">
                        <div className="flex items-center gap-1 text-slate-600">
                          <FiCalendar className="text-slate-400" />
                          <span>{formatDateTime(c.createdAt || c.serviceDate)}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Technician:{" "}
                          <span className="font-semibold">
                            {techLabel}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* mobile layout */}
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
                          <div className="text-[11px] text-slate-500 flex items-center gap-1">
                            <FiUsers className="text-[10px]" />
                            {techLabel}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-slate-700">
                        <FiPhone className="text-slate-400" />
                        <span>{c.phone || "—"}</span>
                      </div>

                      <div className="flex items-start gap-1 text-xs text-slate-700">
                        <FiMapPin className="text-slate-400 mt-0.5" />
                        <span className="line-clamp-2">
                          {c.address || "—"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 text-slate-700">
                          <FiAlertTriangle className="text-slate-400" />
                          <span>{c.type || c.serviceType || "—"}</span>
                        </div>
                        <div className="font-semibold text-emerald-700 text-sm">
                          ₹{c.price ?? 0}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <FiCalendar className="text-slate-400" />
                          <span>{formatDateTime(c.createdAt || c.serviceDate)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Pagination */}
        {!initialLoading && (
          <div className="flex items-center justify-between gap-3">
            <button
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition"
            >
              ← Prev
            </button>
            <div className="text-xs sm:text-sm text-slate-600">
              Page <span className="font-semibold">{page}</span> /{" "}
              <span className="font-semibold">{totalPages}</span>
            </div>
            <button
              disabled={(!hasMore && page >= totalPages) || isFetching}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 active:scale-95 transition"
            >
              Next →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
