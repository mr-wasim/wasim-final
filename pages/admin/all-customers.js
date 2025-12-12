// // pages/admin/all-customers.js
// "use client";
// import {
//   useEffect,
//   useMemo,
//   useState,
//   useCallback,
//   useRef,
// } from "react";
// import { useRouter } from "next/router";
// import Header from "../../components/Header";
// import toast from "react-hot-toast";
// import { motion } from "framer-motion";

// import {
//   FiSearch,
//   FiFilter,
//   FiRefreshCw,
//   FiDownload,
//   FiUsers,
//   FiPhone,
//   FiMapPin,
//   FiAlertTriangle,
//   FiCalendar,
// } from "react-icons/fi";

// const PAGE_SIZE = 20;

// // FORMAT DATE
// function formatDateTime(value) {
//   if (!value) return "—";
//   const d = new Date(value);
//   if (isNaN(d.getTime())) return "—";
//   return d.toLocaleString("en-IN", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// // SAFE CSV
// function escapeCSV(v) {
//   if (v == null) return "";
//   const s = String(v);
//   if (/[,\"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
//   return s;
// }

// export default function AllCustomersPage() {
//   const router = useRouter();
//   const [user, setUser] = useState(null);

//   // FILTERS
//   const [search, setSearch] = useState("");
//   const [dateFrom, setDateFrom] = useState("");
//   const [dateTo, setDateTo] = useState("");

//   // DATA
//   const [items, setItems] = useState([]);
//   const [page, setPage] = useState(1);
//   const [total, setTotal] = useState(0);

//   const [hasMore, setHasMore] = useState(false);
//   const [initialLoading, setInitialLoading] = useState(true);
//   const [isFetching, setIsFetching] = useState(false);

//   // ⭐ Infinite Scroll Ref
//   const bottomRef = useRef(null);

//   // -------------------------
//   // AUTH CHECK
//   // -------------------------
//   useEffect(() => {
//     (async () => {
//       try {
//         const r = await fetch("/api/auth/me");
//         const me = await r.json();
//         if (!r.ok || me.role !== "admin") return router.push("/login");
//         setUser(me);
//       } catch {
//         router.push("/login");
//       }
//     })();
//   }, []);

//   // -------------------------
//   // LOAD DATA (with pagination)
//   // -------------------------
//   const load = useCallback(
//     async ({ resetPage = false, showToast = false } = {}) => {
//       if (!user) return;

//       try {
//         setIsFetching(true);

//         if (resetPage) {
//           setPage(1);
//         }

//         const currentPage = resetPage ? 1 : page;

//         const params = new URLSearchParams({
//           page: String(currentPage),
//           pageSize: String(PAGE_SIZE),
//         });

//         if (search.trim()) params.set("search", search.trim());
//         if (dateFrom) params.set("from", dateFrom);
//         if (dateTo) params.set("to", dateTo);

//         const res = await fetch(
//           `/api/admin/all-customers?${params.toString()}`,
//           { cache: "no-store" }
//         );
//         const data = await res.json();

//         if (!res.ok || !data.success) {
//           throw new Error(data.error || "Failed loading data");
//         }

//         // ⭐ Infinite scroll: Append data instead of replace
//         if (resetPage || currentPage === 1) {
//           setItems(data.items);
//         } else {
//           setItems((prev) => [...prev, ...data.items]);
//         }

//         setTotal(data.total || 0);
//         setHasMore(data.hasMore);

//         if (showToast) toast.success("Data refreshed");
//       } catch (err) {
//         toast.error(err.message || "Error loading");
//       } finally {
//         setInitialLoading(false);
//         setIsFetching(false);
//       }
//     },
//     [user, page, search, dateFrom, dateTo]
//   );

//   // FIRST LOAD + PAGE CHANGE
//   useEffect(() => {
//     if (!user) return;
//     load({ resetPage: page === 1 });
//   }, [user, page]);

//   // TOTAL PAGES
//   const totalPages = useMemo(() => {
//     if (!total) return 1;
//     return Math.ceil(total / PAGE_SIZE);
//   }, [total]);

//   // FILTER EVENTS
//   const handleApplyFilters = () => {
//     setPage(1);
//     load({ resetPage: true, showToast: true });
//   };

//   const handleResetFilters = () => {
//     setSearch("");
//     setDateFrom("");
//     setDateTo("");
//     setPage(1);
//     load({ resetPage: true, showToast: true });
//   };

//   // ⭐ EXPORT FULL DATABASE CSV (no limit)
//   const handleExportCSV = async () => {
//     try {
//       const params = new URLSearchParams();
//       params.set("pageSize", "all");
//       if (search.trim()) params.set("search", search.trim());
//       if (dateFrom) params.set("from", dateFrom);
//       if (dateTo) params.set("to", dateTo);

//       const r = await fetch(`/api/admin/all-customers?${params}`, {
//         cache: "no-store",
//       });
//       const data = await r.json();

//       if (!data.success) return toast.error("Export failed");

//       const all = data.items;
//       if (!all.length) return toast.error("No data");

//       const headers = [
//         "Customer Name",
//         "Phone",
//         "Address",
//         "Service Type",
//         "Price",
//         "Date",
//         "Technician",
//       ];

//       const rows = all.map((c) => [
//         c.clientName || c.customerName || "—",
//         c.phone || "",
//         c.address || "",
//         c.type || c.serviceType || "",
//         c.price ?? 0,
//         formatDateTime(c.createdAt || c.serviceDate),
//         c.techName || c.technicianName || c.techUsername || "Unknown",
//       ]);

//       const csvLines = [
//         headers.join(","),
//         ...rows.map((r) => r.map(escapeCSV).join(",")),
//       ];

//       const blob = new Blob([csvLines.join("\n")], {
//         type: "text/csv",
//       });

//       const url = URL.createObjectURL(blob);
//       const a = document.createElement("a");
//       const fname = new Date().toISOString().split("T")[0];

//       a.href = url;
//       a.download = `customers-${fname}.csv`;
//       document.body.appendChild(a);
//       a.click();
//       document.body.removeChild(a);

//       URL.revokeObjectURL(url);

//       toast.success(`Exported ${all.length} records`);
//     } catch (err) {
//       toast.error("Export failed");
//     }
//   };

//   // ⭐ INFINITE SCROLL OBSERVER
//   useEffect(() => {
//     if (!bottomRef.current) return;

//     const observer = new IntersectionObserver(
//       (entries) => {
//         const e = entries[0];
//         if (e.isIntersecting && hasMore && !isFetching) {
//           setPage((p) => p + 1);
//         }
//       },
//       { threshold: 1 }
//     );

//     observer.observe(bottomRef.current);
//     return () => observer.disconnect();
//   }, [bottomRef, hasMore, isFetching]);

//   const isEmpty = !initialLoading && items.length === 0;

//   // ----------------------------------------------------------
//   // UI STARTS
//   // ----------------------------------------------------------
//   return (
//     <div className="min-h-screen bg-slate-50">
//       <Header user={user} />

//       <main className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
//         {/* HEADER */}
//         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
//           <div className="flex items-center gap-3">
//             <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white grid place-items-center shadow-md">
//               <FiUsers />
//             </div>
//             <div>
//               <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
//                 All Customers
//               </h1>
//               <p className="text-xs sm:text-sm text-slate-500">
//                 All forwarded calls and customer records.
//               </p>
//             </div>
//           </div>

//           <div className="flex gap-2">
//             <button
//               onClick={handleExportCSV}
//               className="px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 text-white shadow-sm"
//             >
//               <FiDownload className="inline mr-1" /> Export CSV
//             </button>

//             <button
//               onClick={() => load({ resetPage: true, showToast: true })}
//               disabled={isFetching}
//               className="px-3 py-2 rounded-xl bg-white border text-sm text-slate-700"
//             >
//               <motion.span
//                 animate={isFetching ? { rotate: 360 } : {}}
//                 transition={{
//                   repeat: Infinity,
//                   duration: 0.7,
//                   ease: "linear",
//                 }}
//               >
//                 <FiRefreshCw />
//               </motion.span>{" "}
//               Refresh
//             </button>
//           </div>
//         </div>

//         {/* FILTER BAR */}
//         <section className="rounded-2xl bg-white border shadow-sm p-3 space-y-3">
//           <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-600">
//             <FiFilter /> Filters
//           </div>

//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//             {/* SEARCH */}
//             <div>
//               <label className="block text-[11px] mb-1">Search</label>
//               <div className="relative">
//                 <FiSearch className="absolute left-2 top-2.5 text-slate-400" />
//                 <input
//                   value={search}
//                   onChange={(e) => setSearch(e.target.value)}
//                   className="w-full pl-8 py-2 border rounded-xl"
//                   placeholder="name / phone / address"
//                 />
//               </div>
//             </div>

//             {/* FROM */}
//             <div>
//               <label className="block text-[11px] mb-1">From date</label>
//               <div className="relative">
//                 <FiCalendar className="absolute left-2 top-2.5 text-slate-400" />
//                 <input
//                   type="date"
//                   value={dateFrom}
//                   onChange={(e) => setDateFrom(e.target.value)}
//                   className="w-full pl-8 py-2 border rounded-xl"
//                 />
//               </div>
//             </div>

//             {/* TO */}
//             <div>
//               <label className="block text-[11px] mb-1">To date</label>
//               <div className="relative">
//                 <FiCalendar className="absolute left-2 top-2.5 text-slate-400" />
//                 <input
//                   type="date"
//                   value={dateTo}
//                   onChange={(e) => setDateTo(e.target.value)}
//                   className="w-full pl-8 py-2 border rounded-xl"
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="flex justify-end gap-2 pt-2">
//             <button
//               onClick={handleResetFilters}
//               className="px-3 py-1.5 rounded-xl bg-slate-200"
//             >
//               Reset
//             </button>
//             <button
//               onClick={handleApplyFilters}
//               className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white"
//             >
//               Apply Filters
//             </button>
//           </div>
//         </section>

//         {/* META BAR */}
//         <div className="text-xs text-slate-600 flex gap-2">
//           Page {page} / {totalPages} • Showing {items.length} • Total {total}
//         </div>

//         {/* TABLE */}
//         <section className="rounded-2xl bg-white border shadow-sm overflow-hidden">
//           <div className="hidden md:grid grid-cols-[1.4fr,1fr,2fr,1fr,1fr,1.4fr] px-4 py-2 bg-slate-50 border-b text-[11px] font-semibold">
//             <span>Customer</span>
//             <span>Phone</span>
//             <span>Address</span>
//             <span>Service</span>
//             <span>Price</span>
//             <span>Date / Tech</span>
//           </div>

//           {/* LOADING SKELETON */}
//           {initialLoading && (
//             <div className="p-4">
//               {Array.from({ length: 4 }).map((_, i) => (
//                 <div key={i} className="h-16 bg-slate-100 animate-pulse mb-3" />
//               ))}
//             </div>
//           )}

//           {/* EMPTY */}
//           {!initialLoading && isEmpty && (
//             <div className="p-8 text-center text-slate-500">
//               No customers found.
//             </div>
//           )}

//           {/* LIST */}
//           {!initialLoading && !isEmpty && (
//             <div className="divide-y">
//               {items.map((c) => {
//                 const tech =
//                   c.techName ||
//                   c.technicianName ||
//                   c.techUsername ||
//                   "Unknown";

//                 return (
//                   <div
//                     key={c._id}
//                     className="px-4 py-3 hover:bg-slate-50 transition"
//                   >
//                     {/* DESKTOP */}
//                     <div className="hidden md:grid grid-cols-[1.4fr,1fr,2fr,1fr,1fr,1.4fr] gap-3">
//                       <div className="flex gap-2">
//                         <div className="h-9 w-9 bg-indigo-600 rounded-xl text-white grid place-items-center">
//                           {(c.clientName || "?")[0]}
//                         </div>
//                         <div>
//                           <div className="font-semibold">{c.clientName}</div>
//                           <div className="text-[11px] text-slate-500">
//                             {tech}
//                           </div>
//                         </div>
//                       </div>

//                       <div className="flex items-center gap-1">
//                         <FiPhone className="text-slate-400" />
//                         {c.phone}
//                       </div>

//                       <div className="flex items-start gap-1 text-sm">
//                         <FiMapPin className="text-slate-400 mt-0.5" />
//                         {c.address}
//                       </div>

//                       <div className="flex items-center gap-1">
//                         <FiAlertTriangle className="text-slate-400" />
//                         {c.type}
//                       </div>

//                       <div className="font-semibold text-emerald-700">
//                         ₹{c.price}
//                       </div>

//                       <div className="text-xs">
//                         <FiCalendar className="inline mr-1 text-slate-400" />
//                         {formatDateTime(c.createdAt)}
//                       </div>
//                     </div>

//                     {/* MOBILE */}
//                     <div className="md:hidden space-y-1">
//                       <div className="flex items-center gap-2">
//                         <div className="h-8 w-8 bg-indigo-600 rounded-xl text-white grid place-items-center">
//                           {(c.clientName || "?")[0]}
//                         </div>
//                         <div>
//                           <div className="font-semibold">{c.clientName}</div>
//                           <div className="text-[11px] text-slate-500">{tech}</div>
//                         </div>
//                       </div>

//                       <div className="text-sm">
//                         <FiPhone className="inline mr-1" />
//                         {c.phone}
//                       </div>

//                       <div className="text-sm">
//                         <FiMapPin className="inline mr-1" />
//                         {c.address}
//                       </div>

//                       <div className="text-xs text-slate-500">
//                         <FiCalendar className="inline mr-1" />
//                         {formatDateTime(c.createdAt)}
//                       </div>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           )}

//           {/* ⭐ INFINITE SCROLL LOADER */}
//           <div
//             ref={bottomRef}
//             className="py-6 text-center text-xs text-slate-500"
//           >
//             {isFetching
//               ? "Loading more..."
//               : hasMore
//               ? "Scroll to load more..."
//               : "All records loaded"}
//           </div>
//         </section>

//         {/* ORIGINAL PAGINATION BUTTONS (KEEP VISIBLE FOR SAFETY) */}
//         {!initialLoading && (
//           <div className="flex items-center justify-between mt-4">
//             <button
//               disabled={page <= 1 || isFetching}
//               onClick={() => setPage((p) => Math.max(1, p - 1))}
//               className="px-3 py-2 rounded-xl border text-sm bg-white"
//             >
//               ← Prev
//             </button>

//             <span className="text-sm text-slate-600">
//               {page} / {totalPages}
//             </span>

//             <button
//               disabled={!hasMore || isFetching}
//               onClick={() => setPage((p) => p + 1)}
//               className="px-3 py-2 rounded-xl border text-sm bg-white"
//             >
//               Next →
//             </button>
//           </div>
//         )}
//       </main>
//     </div>
//   );
// }
