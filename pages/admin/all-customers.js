"use client";

/**
 * pages/admin/forwarded.js
 *
 * Production-ready admin "Forwarded Calls" page.
 * - Robust technician loader (multiple endpoints + iterative fallback)
 * - Client-side fallback filtering for technician if backend doesn't filter
 * - Animated professional modal showing requested fields
 * - Infinite scroll, CSV export, debounce, AbortController
 *
 * Paste this file as-is.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Header from "../../components/Header";
import {
  FiSearch,
  FiDownload,
  FiX,
  FiUser,
  FiRefreshCw,
  FiChevronDown,
  FiPhone,
  FiMapPin,
  FiTag,
  FiClock,
  FiDollarSign,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

const PAGE_SIZE = 20;
const ITERATIVE_PAGE_SIZE = 200;

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

function formatCurrency(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return String(v);
  return n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
}

/* ---------------------------
   Small UI helpers
----------------------------*/
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
   MAIN COMPONENT
----------------------------*/
export default function ForwardedList() {
  const [user, setUser] = useState(null);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [rawTechs, setRawTechs] = useState([]);
  const technicians = useMemo(() => {
    // Map to preserve unique canonical display names (case-insensitive dedupe)
    const map = new Map();
    rawTechs.forEach((t) => {
      const candidate =
        (typeof t === "string" && t) ||
        t?.techName ||
        t?.technicianName ||
        t?.techUsername ||
        t?.username ||
        t?.name ||
        t?.tech ||
        "";
      const name = String(candidate).trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, name);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [rawTechs]);

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [technician, setTechnician] = useState("");

  // selected item for modal
  const [viewItem, setViewItem] = useState(null);

  // refs
  const observer = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // stable refs to read current filters
  const qRef = useRef("");
  const statusRef = useRef("");
  const technicianRef = useRef("");
  const isMountedRef = useRef(false);
  const manualLoadRef = useRef(false);

  // keep refs synced
  useEffect(() => { qRef.current = q; }, [q]);
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { technicianRef.current = technician; }, [technician]);

  /* ---------------------------
     AUTH + initial load
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

        // load technicians and initial data
        await loadTechniciansStable();
        await loadDataStable({ pageNum: 1, reset: true });
        isMountedRef.current = true;
      } catch (err) {
        console.error("AUTH ERROR:", err);
        window.location.href = "/login";
      }
    })();

    return () => {
      mounted = false;
      try { abortRef.current?.abort(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------
     Technician loading (robust)
     tries multiple endpoints + iterative fallback
  ----------------------------*/
  async function loadTechniciansStable() {
    try {
      // 1) primary endpoint
      let res = await fetch("/api/admin/technicians", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (Array.isArray(data) && data.length) { setRawTechs(data); return; }
        if (data?.success && Array.isArray(data.items) && data.items.length) { setRawTechs(data.items); return; }
        if (Array.isArray(data.technicians) && data.technicians.length) { setRawTechs(data.technicians); return; }
      }

      // 2) try all=true variant
      try {
        res = await fetch("/api/admin/technicians?all=true", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (Array.isArray(data) && data.length) { setRawTechs(data); return; }
        }
      } catch (e) {
        // ignore
      }

      // 3) try technician-calls endpoint (sometimes that returns technicians)
      try {
        res = await fetch("/api/admin/technician-calls", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          // can be { success:true, technicians: [...] } or plain array
          if (Array.isArray(data)) { setRawTechs(data); return; }
          if (data?.technicians && Array.isArray(data.technicians) && data.technicians.length) {
            setRawTechs(data.technicians); return;
          }
          if (data?.items && Array.isArray(data.items) && data.items.length) {
            setRawTechs(data.items); return;
          }
        }
      } catch (e) {
        // ignore
      }

      // 4) iterative fallback: walk forwarded pages and extract tech names
      await fallbackIterativeExtractTechs();
    } catch (err) {
      console.error("loadTechniciansStable error:", err);
      await fallbackIterativeExtractTechs();
    }
  }

  async function fallbackIterativeExtractTechs() {
    try {
      const names = new Map();
      let p = 1;
      let safety = 0;
      while (true) {
        safety += 1;
        if (safety > 50) break; // safety guard
        const res = await fetch(`/api/admin/forwarded?page=${p}&pageSize=${ITERATIVE_PAGE_SIZE}`, { cache: "no-store" });
        if (!res.ok) break;
        const d = await res.json();
        const arr = Array.isArray(d.items) ? d.items : d.items ?? [];
        arr.forEach((it) => {
          const raw = it?.techName || it?.technicianName || it?.techUsername || it?.username || it?.tech || "";
          const name = String(raw).trim();
          if (!name) return;
          const key = name.toLowerCase();
          if (!names.has(key)) names.set(key, name);
        });
        if (!d.hasMore || arr.length === 0) break;
        p += 1;
      }
      setRawTechs(Array.from(names.values()));
    } catch (err) {
      console.error("fallbackIterativeExtractTechs error:", err);
      setRawTechs([]);
    }
  }

  function getTechNameFromItem(it) {
    return (it && (it.techName || it.technicianName || it.techUsername || it.username || it.tech)) || "";
  }

  /* ---------------------------
     Data loader (stable)
  ----------------------------*/
  async function loadDataStable({ pageNum = 1, reset = false } = {}) {
    try { abortRef.current?.abort(); } catch {}
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (loading && !reset) return;
    setLoading(true);
    if (reset) { setItems([]); setHasMore(true); }

    try {
      const params = new URLSearchParams();
      params.set("page", String(pageNum));
      params.set("pageSize", String(PAGE_SIZE));

      const qVal = qRef.current?.trim();
      const statusVal = statusRef.current;
      const techVal = technicianRef.current;

      if (qVal) params.set("q", qVal);
      if (statusVal) params.set("status", statusVal);
      if (techVal) params.set("technician", techVal);

      const url = `/api/admin/forwarded?${params.toString()}`;
      const res = await fetch(url, { cache: "no-store", signal });

      if (!res.ok) {
        const t = await res.text().catch(() => null);
        throw new Error(t || "Failed to fetch forwarded records");
      }

      const d = await res.json();
      const serverItems = Array.isArray(d.items) ? d.items : d.items ?? [];

      // client-side fallback filter by technician (if backend didn't filter)
      const filtered = technicianRef.current
        ? serverItems.filter((it) => {
            const name = String(getTechNameFromItem(it)).trim();
            return name === technicianRef.current;
          })
        : serverItems;

      if (reset) setItems(filtered);
      else setItems((prev) => [...prev, ...filtered]);

      setTotal(Number(d.total || (reset ? filtered.length : items.length + filtered.length) || 0));
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
     Debounce filters effect
  ----------------------------*/
  useEffect(() => {
    if (!isMountedRef.current) return;

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
  }, [q, status, technician]);

  /* ---------------------------
     Page change -> infinite scroll
  ----------------------------*/
  useEffect(() => {
    if (page === 1) return;
    loadDataStable({ pageNum: page, reset: false });
  }, [page]);

  /* ---------------------------
     Intersection observer for infinite scroll
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
     CSV export (pageSize=all)
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

      // client-side fallback if needed
      const finalAll = techVal
        ? all.filter((it) => String(getTechNameFromItem(it)).trim() === techVal)
        : all;

      if (!finalAll.length) {
        alert("No records to export for current filters.");
        return;
      }

      const headers = ["Client", "Phone", "Address", "Service Type", "Price", "Status", "Technician", "Date"];
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

      const csv = [headers, ...rows].map((r) => r.map((c) => escapeCSV(c)).join(",")).join("\n");

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
      console.error("downloadAllStable error", err);
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
    manualLoadRef.current = false;
    loadDataStable({ pageNum: 1, reset: true });
  }

  /* ---------------------------
     Technician change (immediate load)
  ----------------------------*/
  function handleTechnicianChange(e) {
    const val = e.target.value;
    setTechnician(val);
    technicianRef.current = val;
    manualLoadRef.current = true;
    clearTimeout(debounceRef.current);
    setPage(1);
    loadDataStable({ pageNum: 1, reset: true });
  }

  /* ---------------------------
     Modal details layout
  ----------------------------*/
  function DetailsRow({ label, children }) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-28 text-xs text-slate-500">{label}</div>
        <div className="text-sm text-slate-800">{children}</div>
      </div>
    );
  }

  /* ---------------------------
     Render
  ----------------------------*/
  return (
    <div className="bg-slate-50 min-h-screen">
      <Header user={user} />

      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow">
              <FiUser />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Forwarded Calls</h1>
              <p className="text-sm text-slate-500">
                Showing <span className="font-semibold">{items.length}</span> • Total <span className="font-semibold">{total}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <IconButton
              title="Refresh"
              onClick={() => { setPage(1); loadDataStable({ pageNum: 1, reset: true }); }}
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
              <table className="w-full text-sm min-w-[780px]">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="p-3 text-left">Client</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Technician</th>
                    <th className="p-3">Price</th>
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
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <FiPhone className="text-slate-400" />
                            {it.phone || "—"}
                          </div>
                        </td>
                        <td className="p-3">{it.type || it.serviceType || "—"}</td>
                        <td className="p-3 flex items-center gap-2">
                          <FiUser className="text-slate-400" />
                          {it.techName || it.technicianName || it.techUsername || "—"}
                        </td>
                        <td className="p-3 font-semibold text-emerald-700">{formatCurrency(it.price)}</td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[it.status] || "bg-slate-100 text-slate-700"}`}>
                            {it.status || "—"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <FiClock className="text-slate-400" />
                            {it.createdAt ? formatDateTime(it.createdAt) : "—"}
                          </div>
                        </td>
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
              className="bg-white rounded-2xl max-w-xl w-full z-50 shadow-2xl ring-1 ring-slate-200 overflow-hidden"
              initial={{ y: 30, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              {/* header */}
              <div className="flex items-center justify-between p-5 border-b">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-indigo-600 text-white grid place-items-center text-lg font-semibold">
                    {((viewItem.clientName || viewItem.customerName || "U")[0] || "").toUpperCase()}
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{viewItem.clientName || viewItem.customerName || "—"}</div>
                    <div className="text-xs text-slate-500 mt-1">{viewItem.address || "Address not provided"}</div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Price</div>
                    <div className="text-lg font-semibold text-emerald-700">{formatCurrency(viewItem.price)}</div>
                  </div>
                  <button onClick={() => setViewItem(null)} className="rounded-full p-2 hover:bg-slate-100 transition" aria-label="Close">
                    <FiX size={18} />
                  </button>
                </div>
              </div>

              {/* body */}
              <div className="p-6 grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-slate-50"><FiPhone className="text-slate-500" /></div>
                      <div>
                        <div className="text-xs text-slate-500">Number</div>
                        <div className="text-sm text-slate-800">{viewItem.phone || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-slate-50"><FiMapPin className="text-slate-500" /></div>
                      <div>
                        <div className="text-xs text-slate-500">Address</div>
                        <div className="text-sm text-slate-800">{viewItem.address || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-slate-50"><FiTag className="text-slate-500" /></div>
                      <div>
                        <div className="text-xs text-slate-500">Service Type</div>
                        <div className="text-sm text-slate-800">{viewItem.type || viewItem.serviceType || "—"}</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-slate-50"><FiUser className="text-slate-500" /></div>
                      <div>
                        <div className="text-xs text-slate-500">Tech Name</div>
                        <div className="text-sm text-slate-800">{viewItem.techName || viewItem.technicianName || viewItem.techUsername || "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-slate-50"><FiClock className="text-slate-500" /></div>
                      <div>
                        <div className="text-xs text-slate-500">Create Date</div>
                        <div className="text-sm text-slate-800">{viewItem.createdAt ? formatDateTime(viewItem.createdAt) : "—"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-slate-50">
                        {viewItem.status === "Completed" ? <FiCheckCircle className="text-green-600" /> : <FiAlertCircle className="text-yellow-600" />}
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Status</div>
                        <div className="text-sm text-slate-800">
                          <span className={`px-2 py-1 rounded-md text-xs font-semibold ${statusColors[viewItem.status] || "bg-slate-100 text-slate-700"}`}>
                            {viewItem.status || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* optional notes */}
                {viewItem.notes || viewItem.remarks || viewItem.comment ? (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Notes</div>
                    <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-md">{viewItem.notes || viewItem.remarks || viewItem.comment}</div>
                  </div>
                ) : null}
              </div>

              {/* footer */}
              <div className="p-5 border-t flex items-center justify-end gap-3">
                <button onClick={() => setViewItem(null)} className="px-4 py-2 rounded-lg border text-sm">Close</button>
                <button
                  onClick={() => {
                    if (!viewItem.phone) { alert("Phone number not available"); return; }
                    const tel = String(viewItem.phone).replace(/\D/g, "");
                    window.open(`https://wa.me/${tel}`, "_blank");
                  }}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm flex items-center gap-2"
                >
                  Message
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
