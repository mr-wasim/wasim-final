"use client";

/**
 * pages/admin/forwarded.js
 *
 * Technician-filter fixed:
 * - immediate load when technician selected (no duplicate debounce)
 * - client-side fallback filter if backend doesn't respect "technician" param
 * - shows all when technician="" (All Technicians)
 *
 * Full page: infinite scroll, export, abortcontroller, debounce, stable refs.
 */

import Header from "../../components/Header";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiSearch,
  FiDownload,
  FiX,
  FiUser,
  FiRefreshCw,
  FiChevronDown,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

/* ---------------------------
  Config & helpers
----------------------------*/
const PAGE_SIZE = 20;

const statusColors = {
  Pending: "bg-yellow-100 text-yellow-700",
  "In Process": "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Canceled: "bg-red-100 text-red-700",
};

function escapeCSV(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[,\"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* small helpers */
function IconButton({ title, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${className}`}
    >
      {children}
    </button>
  );
}

function SkeletonRows({ count = 5 }) {
  return (
    <div className="p-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse h-12 bg-slate-100 rounded mb-3" />
      ))}
    </div>
  );
}

function EmptyState({ title = "No records", description = "" }) {
  return (
    <div className="p-8 text-center text-slate-500">
      <div className="text-lg font-semibold mb-1">{title}</div>
      {description && <div className="text-sm">{description}</div>}
    </div>
  );
}

/* ---------------------------
  MAIN
----------------------------*/
export default function ForwardedList() {
  /* ---------- Auth/user ---------- */
  const [user, setUser] = useState(null);

  /* ---------- Data ---------- */
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  /* ---------- Technicians ---------- */
  const [rawTechs, setRawTechs] = useState([]);
  const technicians = useMemo(() => {
    const s = new Set();
    rawTechs.forEach((t) => {
      const name =
        (typeof t === "string" && t) ||
        t?.techName ||
        t?.technicianName ||
        t?.techUsername ||
        t?.username ||
        t?.name ||
        t?.tech ||
        "";
      if (name) s.add(String(name).trim());
    });
    return Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [rawTechs]);

  /* ---------- Loading & pagination ---------- */
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  /* ---------- Filters (UI state) ---------- */
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [technician, setTechnician] = useState("");

  /* ---------- Modal ---------- */
  const [viewItem, setViewItem] = useState(null);

  /* ---------- Refs ---------- */
  const observer = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // stable refs for current filter values
  const qRef = useRef("");
  const statusRef = useRef("");
  const technicianRef = useRef("");
  const isMountedRef = useRef(false);

  // manual load flag to avoid duplicate debounce
  const manualLoadRef = useRef(false);

  // sync refs with state
  useEffect(() => {
    qRef.current = q;
  }, [q]);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);
  useEffect(() => {
    technicianRef.current = technician;
  }, [technician]);

  /* ---------------------------
     Auth + initial load
  ----------------------------*/
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await fetch("/api/auth/me", { cache: "no-store" });
        const me = await resp.json();
        if (!resp.ok || !me || me.role !== "admin") {
          window.location.href = "/login";
          return;
        }
        if (!mounted) return;
        setUser(me);
        // load techs and data
        loadTechniciansStable();
        await loadDataStable({ pageNum: 1, reset: true });
        isMountedRef.current = true;
      } catch (err) {
        console.error("AUTH ERROR:", err);
        window.location.href = "/login";
      }
    })();

    return () => {
      mounted = false;
      try {
        abortRef.current?.abort();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------
     Technicians loader + fallback
  ----------------------------*/
  async function loadTechniciansStable() {
    try {
      const res = await fetch("/api/admin/technicians", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!data) {
        await fallbackExtractTechsStable();
        return;
      }
      if (Array.isArray(data) && data.length) {
        setRawTechs(data);
        return;
      }
      if (data.success && Array.isArray(data.items) && data.items.length) {
        setRawTechs(data.items);
        return;
      }
      if (Array.isArray(data.technicians) && data.technicians.length) {
        setRawTechs(data.technicians);
        return;
      }
      await fallbackExtractTechsStable();
    } catch (err) {
      console.error("loadTechniciansStable error:", err);
      await fallbackExtractTechsStable();
    }
  }

  async function fallbackExtractTechsStable() {
    try {
      const res = await fetch("/api/admin/forwarded?pageSize=all", { cache: "no-store" });
      if (!res.ok) {
        setRawTechs([]);
        return;
      }
      const data = await res.json();
      const arr = Array.isArray(data.items) ? data.items : data.items ?? [];
      const names = [];
      arr.forEach((it) => {
        const name =
          it?.techName ||
          it?.technicianName ||
          it?.techUsername ||
          it?.username ||
          it?.tech ||
          "";
        if (name) names.push(name);
      });
      setRawTechs(Array.from(new Set(names)));
    } catch (err) {
      console.error("fallbackExtractTechsStable error:", err);
      setRawTechs([]);
    }
  }

  /* ---------------------------
     normalize tech name from item
  ----------------------------*/
  function getTechNameFromItem(it) {
    return (
      (it && (it.techName || it.technicianName || it.techUsername || it.username || it.tech)) || ""
    );
  }

  /* ---------------------------
     Main data loader (stable)
     - reads q/status/technician from refs
     - applies client-side filter if technicianRef present
  ----------------------------*/
  async function loadDataStable({ pageNum = 1, reset = false } = {}) {
    // abort previous
    try {
      abortRef.current?.abort();
    } catch {}
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (loading && !reset) return;
    setLoading(true);
    if (reset) {
      setItems([]);
      setHasMore(true);
    }

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("pageSize", String(PAGE_SIZE));

      const qVal = qRef.current?.trim();
      const statusVal = statusRef.current;
      const techVal = technicianRef.current;

      if (qVal) params.set("q", qVal);
      if (statusVal) params.set("status", statusVal);
      // we set technician param — best-effort for backend
      if (techVal) params.set("technician", techVal);

      const url = `/api/admin/forwarded?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store", signal });

      if (!res.ok) {
        const t = await res.text().catch(() => null);
        throw new Error(t || "Failed to fetch forwarded records");
      }

      const d = await res.json();
      const serverItems = Array.isArray(d.items) ? d.items : d.items ?? [];

      // client-side fallback filtering: if techVal present, filter results by tech name match
      const filtered = techVal
        ? serverItems.filter((it) => {
            const name = String(getTechNameFromItem(it)).trim();
            return name === techVal;
          })
        : serverItems;

      if (reset) setItems(filtered);
      else setItems((prev) => [...prev, ...filtered]);

      setTotal(Number(d.total || 0));
      // keep server's hasMore — we still need to fetch more pages if server says so
      setHasMore(Boolean(d.hasMore));
    } catch (err) {
      if (err.name === "AbortError") {
        // ignore
      } else {
        console.error("loadDataStable error:", err);
      }
    } finally {
      setInitialLoad(false);
      setLoading(false);
    }
  }

  /* ---------------------------
     Debounced filters effect
     - skip on initial mount
     - skip duplicate when manualLoadRef set (we call load immediately for technician)
  ----------------------------*/
  useEffect(() => {
    if (!isMountedRef.current) return;

    // if last change was manual load (select technician triggered immediate load), skip debounce call
    if (manualLoadRef.current) {
      manualLoadRef.current = false;
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      loadDataStable({ pageNum: 1, reset: true });
    }, 320);

    return () => clearTimeout(debounceRef.current);
  }, [q, status, technician]); // loadDataStable not included intentionally

  /* ---------------------------
     page change for infinite scroll
  ----------------------------*/
  useEffect(() => {
    if (page === 1) return;
    loadDataStable({ pageNum: page, reset: false });
  }, [page]);

  /* ---------------------------
     infinite scroll observer
  ----------------------------*/
  const lastItemRef = (node) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();

    observer.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((p) => p + 1);
        }
      },
      { threshold: 0.9 }
    );

    if (node) observer.current.observe(node);
  };

  /* ---------------------------
     CSV export
  ----------------------------*/
  async function downloadAllStable(e) {
    if (e && e.preventDefault) e.preventDefault();

    try {
      const params = new URLSearchParams();
      params.set("pageSize", "all");

      const qVal = qRef.current?.trim();
      const statusVal = statusRef.current;
      const techVal = technicianRef.current;

      if (qVal) params.set("q", qVal);
      if (statusVal) params.set("status", statusVal);
      if (techVal) params.set("technician", techVal);

      const url = `/api/admin/forwarded?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => null);
        throw new Error(t || "Export failed");
      }
      const d = await res.json();
      const all = Array.isArray(d.items) ? d.items : d.items ?? [];

      // If backend didn't filter by technician, apply client-side filter for CSV too
      const finalAll = techVal
        ? all.filter((it) => {
            const name = String(getTechNameFromItem(it)).trim();
            return name === techVal;
          })
        : all;

      if (!finalAll.length) {
        alert("No records to export for current filters.");
        return;
      }

      const headers = [
        "Client",
        "Phone",
        "Address",
        "Service Type",
        "Price",
        "Status",
        "Technician",
        "Date",
      ];

      const rows = finalAll.map((c) => [
        c.clientName || c.customerName || "—",
        c.phone || "",
        c.address || "",
        c.type || c.serviceType || "",
        c.price ?? "",
        c.status || "",
        c.techName || c.technicianName || c.techUsername || "",
        c.createdAt ? new Date(c.createdAt).toLocaleString() : "",
      ]);

      const csv =
        [headers, ...rows].map((r) => r.map((c) => escapeCSV(c)).join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = `forwarded-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlObj);
    } catch (err) {
      console.error("downloadAllStable error:", err);
      alert("Export failed. Check console.");
    }
  }

  /* ---------------------------
     Reset filters
  ----------------------------*/
  function resetFiltersStable(e) {
    if (e && e.preventDefault) e.preventDefault();
    setQ("");
    setStatus("");
    setTechnician("");
    setPage(1);
    qRef.current = "";
    statusRef.current = "";
    technicianRef.current = "";
    // ensure manual flag cleared
    manualLoadRef.current = false;
    loadDataStable({ pageNum: 1, reset: true });
  }

  /* ---------------------------
     Technician select handler (immediate load + avoid duplicate debounce)
  ----------------------------*/
  function handleTechnicianChange(e) {
    const val = e.target.value;
    setTechnician(val);
    technicianRef.current = val;
    // mark manual to skip upcoming debounce effect
    manualLoadRef.current = true;
    // clear any scheduled debounce
    clearTimeout(debounceRef.current);
    // reset page and load immediately
    setPage(1);
    loadDataStable({ pageNum: 1, reset: true });
  }

  /* ---------------------------
     Render
  ----------------------------*/
  return (
    <div className="bg-slate-50 min-h-screen">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* header + actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow">
              <FiUser />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Forwarded Calls</h1>
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold">{items.length}</span> • Total{" "}
                <span className="font-semibold">{total}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <IconButton
              title="Refresh"
              onClick={() => {
                setPage(1);
                loadDataStable({ pageNum: 1, reset: true });
              }}
              className="bg-white border text-slate-800"
            >
              <FiRefreshCw />
              <span className="hidden sm:inline">Refresh</span>
            </IconButton>

            <IconButton
              title="Export CSV (all filtered)"
              onClick={downloadAllStable}
              className="bg-indigo-600 text-white"
            >
              <FiDownload />
              <span className="hidden sm:inline">Export CSV</span>
            </IconButton>
          </div>
        </div>

        {/* filters */}
        <section className="bg-white rounded-2xl p-4 shadow-sm border grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div>
            <label className="text-xs font-semibold text-slate-500">Search</label>
            <div className="relative mt-1">
              <FiSearch className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                aria-label="Search name phone address"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name / Phone / Address"
                className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Technician */}
          <div>
            <label className="text-xs font-semibold text-slate-500">Technician</label>
            <div className="relative mt-1">
              <select
                value={technician}
                onChange={handleTechnicianChange}
                className="w-full border px-3 py-2 rounded-xl text-sm appearance-none"
              >
                <option value="">All Technicians</option>
                {technicians.length > 0 ? (
                  technicians.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))
                ) : (
                  <option disabled>Loading technicians…</option>
                )}
              </select>
              <FiChevronDown className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {technicians.length ? `${technicians.length} technicians` : "No technicians loaded"}
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-slate-500">Status</label>
            <div className="mt-1">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full border px-3 py-2 rounded-xl text-sm"
              >
                <option value="">All Status</option>
                <option>Pending</option>
                <option>In Process</option>
                <option>Completed</option>
                <option>Canceled</option>
              </select>
            </div>
          </div>

          {/* Reset */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFiltersStable}
              className="w-full bg-slate-200 text-slate-800 py-2 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              <FiX /> Reset Filters
            </button>
          </div>
        </section>

        {/* table */}
        <section className="bg-white rounded-2xl shadow border overflow-hidden">
          {initialLoad ? (
            <SkeletonRows count={6} />
          ) : items.length === 0 ? (
            <EmptyState title="No records found" description="No forwarded calls match the selected filters." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="p-3 text-left">Client</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Technician</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((it, i) => {
                    const isLast = i === items.length - 1;
                    return (
                      <tr
                        key={it._id || i}
                        ref={isLast ? lastItemRef : null}
                        onClick={() => setViewItem(it)}
                        className="border-t hover:bg-indigo-50 cursor-pointer"
                      >
                        <td className="p-3 font-medium">{it.clientName || it.customerName || "—"}</td>
                        <td className="p-3">{it.phone || "—"}</td>
                        <td className="p-3">{it.type || it.serviceType || "—"}</td>
                        <td className="p-3 flex items-center gap-2">
                          <FiUser className="text-slate-400" />
                          {it.techName || it.technicianName || it.techUsername || "—"}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              statusColors[it.status] || "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {it.status || "—"}
                          </span>
                        </td>
                        <td className="p-3">{it.createdAt ? formatDateTime(it.createdAt) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 text-center text-xs text-slate-500">
            {loading ? "Loading..." : hasMore ? "Scroll to load more" : "All records loaded"}
          </div>
        </section>
      </main>

      {/* modal */}
      <AnimatePresence>
        {viewItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              className="absolute inset-0 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewItem(null)}
            />
            <motion.div
              className="bg-white p-6 rounded-2xl max-w-lg w-full z-50"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="flex justify-between items-start">
                <h2 className="text-lg font-semibold mb-3">Customer Details</h2>
                <button onClick={() => setViewItem(null)} className="text-slate-500">
                  <FiX size={20} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm">
                <div><b>Name:</b> {viewItem.clientName || viewItem.customerName || "—"}</div>
                <div><b>Phone:</b> {viewItem.phone || "—"}</div>
                <div><b>Address:</b> {viewItem.address || "—"}</div>
                <div><b>Service:</b> {viewItem.type || viewItem.serviceType || "—"}</div>
                <div><b>Technician:</b> {viewItem.techName || viewItem.technicianName || viewItem.techUsername || "—"}</div>
                <div><b>Status:</b> {viewItem.status || "—"}</div>
                <div><b>Date:</b> {viewItem.createdAt ? formatDateTime(viewItem.createdAt) : "—"}</div>
              </div>

              <div className="mt-4">
                <button onClick={() => setViewItem(null)} className="w-full bg-indigo-600 text-white py-2 rounded-xl">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
