// import Header from "../../components/Header";
// import { useEffect, useState, useRef, useCallback } from "react";
// import { FiSearch, FiDownload, FiX, FiPrinter } from "react-icons/fi";
// import { motion, AnimatePresence } from "framer-motion";

// const statusColors = {
//   Completed: "bg-green-100 text-green-700",
//   Pending: "bg-yellow-100 text-yellow-700",
//   Closed: "bg-red-100 text-red-700",
//   "In Process": "bg-blue-100 text-blue-700",
// };

// export default function ForwardedList() {
//   const [user, setUser] = useState(null);

//   const [items, setItems] = useState([]);
//   const [loading, setLoading] = useState(false);
//   const [initialLoad, setInitialLoad] = useState(true);
//   const [hasMore, setHasMore] = useState(true);

//   const [page, setPage] = useState(1);
//   const [q, setQ] = useState("");
//   const [status, setStatus] = useState("");

//   const [viewItem, setViewItem] = useState(null);

//   const observer = useRef(null);
//   const debounceRef = useRef(null);

//   // ------------------------------------
//   // LOAD DATA
//   // ------------------------------------
//   const load = useCallback(
//     async (reset = false) => {
//       if (loading) return;
//       setLoading(true);

//       try {
//         const params = new URLSearchParams({ page, q, status });
//         const r = await fetch("/api/admin/forwarded?" + params.toString());
//         const d = await r.json();

//         if (reset) setItems(d.items);
//         else setItems((prev) => [...prev, ...d.items]);

//         setHasMore(d.hasMore);
//       } catch (err) {
//         console.error(err);
//       }

//       setInitialLoad(false);
//       setLoading(false);
//     },
//     [page, q, status]
//   );

//   // Infinite Scroll Observer
//   const lastItemRef = useCallback(
//     (node) => {
//       if (loading) return;

//       if (observer.current) observer.current.disconnect();

//       observer.current = new IntersectionObserver(
//         (entries) => {
//           if (entries[0].isIntersecting && hasMore) {
//             setPage((p) => p + 1);
//           }
//         },
//         { threshold: 1 }
//       );

//       if (node) observer.current.observe(node);
//     },
//     [loading, hasMore]
//   );

//   // FILTER DEBOUNCE
//   useEffect(() => {
//     clearTimeout(debounceRef.current);
//     debounceRef.current = setTimeout(() => {
//       setPage(1);
//       load(true);
//     }, 400);

//     return () => clearTimeout(debounceRef.current);
//   }, [q, status]);

//   // PAGE LOAD
//   useEffect(() => {
//     if (page === 1) return;
//     load(false);
//   }, [page]);

//   // AUTH + INITIAL LOAD
//   useEffect(() => {
//     (async () => {
//       const me = await fetch("/api/auth/me");
//       const u = await me.json();
//       if (u.role !== "admin") {
//         window.location.href = "/login";
//         return;
//       }
//       setUser(u);
//       load(true);
//     })();
//   }, []);

//   // EXPORT ALL CSV
//   const downloadAll = async () => {
//     const r = await fetch("/api/admin/forwarded-all");
//     const d = await r.json();

//     const header = ["Client", "Phone", "Address", "Service Type", "Technician", "Status", "Date"];
//     const rows = d.map((x) => [
//       x.clientName,
//       x.phone,
//       x.address,
//       x.type,
//       x.techName,
//       x.status,
//       new Date(x.createdAt).toLocaleString(),
//     ]);

//     const csv =
//       [header, ...rows]
//         .map((row) => row.map((c) => `"${c || ""}"`).join(","))
//         .join("\n");

//     const blob = new Blob([csv], { type: "text/csv" });
//     const url = URL.createObjectURL(blob);

//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "all_customers.csv";
//     a.click();
//   };

//   return (
//     <div className="bg-gray-100 min-h-screen">

//       {/* ———————— DO NOT TOUCH (your existing header) ———————— */}
//       <Header user={user} />

//       <main className="max-w-7xl mx-auto p-3 space-y-4">

//         {/* ----------------------
//            MOBILE-FRIENDLY SMALL FILTER
//         ---------------------- */}
//         <motion.div
//           initial={{ opacity: 0, y: -8 }}
//           animate={{ opacity: 1, y: 0 }}
//           className="bg-white rounded-xl p-3 shadow-md border flex flex-wrap gap-3 items-center"
//         >
//           {/* Search */}
//           <div className="relative flex-1 min-w-[180px]">
//             <FiSearch className="absolute left-3 top-3 text-gray-400" size={18} />
//             <input
//               className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400"
//               placeholder="Search name / phone"
//               value={q}
//               onChange={(e) => setQ(e.target.value)}
//             />
//           </div>

//           {/* Status dropdown */}
//           <select
//             className="border px-3 py-2 rounded-lg text-sm min-w-[120px]"
//             value={status}
//             onChange={(e) => setStatus(e.target.value)}
//           >
//             <option value="">All</option>
//             <option>Pending</option>
//             <option>In Process</option>
//             <option>Completed</option>
//             <option>Closed</option>
//           </select>

//           {/* Export CSV */}
//           <button
//             onClick={downloadAll}
//             className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm"
//           >
//             <FiDownload size={16} /> CSV
//           </button>
//         </motion.div>

//         {/* ----------------------
//             CUSTOMER TABLE
//         ---------------------- */}
//         <div className="bg-white rounded-xl shadow-md border overflow-hidden">
//           <table className="w-full text-sm">
//             <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
//               <tr>
//                 <th className="p-3 text-left">Client</th>
//                 <th className="p-3 text-left">Phone</th>
//                 <th className="p-3 text-left">Service</th>
//                 <th className="p-3 text-left">Tech</th>
//                 <th className="p-3 text-left">Status</th>
//                 <th className="p-3 text-left">Date</th>
//               </tr>
//             </thead>

//             <tbody>
//               {items.map((it, i) => {
//                 const isLast = i === items.length - 1;
//                 return (
//                   <tr
//                     key={it._id}
//                     ref={isLast ? lastItemRef : null}
//                     onClick={() => setViewItem(it)}
//                     className="border-t cursor-pointer hover:bg-blue-50 transition"
//                   >
//                     <td className="p-3 font-medium">{it.clientName}</td>
//                     <td className="p-3">{it.phone}</td>
//                     <td className="p-3">{it.type || "—"}</td>
//                     <td className="p-3">{it.techName}</td>

//                     <td className="p-3">
//                       <span
//                         className={`px-3 py-1 rounded-full text-xs font-semibold ${
//                           statusColors[it.status]
//                         }`}
//                       >
//                         {it.status}
//                       </span>
//                     </td>

//                     <td className="p-3">{new Date(it.createdAt).toLocaleString()}</td>
//                   </tr>
//                 );
//               })}
//             </tbody>
//           </table>

//           {initialLoad && (
//             <div className="p-4 text-center text-gray-500">Loading…</div>
//           )}

//           {loading && !initialLoad && (
//             <div className="p-4 text-center text-gray-500">Loading more…</div>
//           )}
//         </div>
//       </main>

//       {/* ======================
//            POPUP MODAL FIXED
//       ====================== */}
//       <AnimatePresence>
//         {viewItem && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center p-3">

//             {/* Backdrop */}
//             <motion.div
//               className="absolute inset-0 bg-black/50 "
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               onClick={() => setViewItem(null)}
//             />

//             {/* Modal Box */}
//             <motion.div
//               className="relative bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full z-50"
//               initial={{ scale: 0.8, opacity: 0, y: 15 }}
//               animate={{ scale: 1, opacity: 1, y: 0 }}
//               exit={{ scale: 0.8, opacity: 0, y: 15 }}
//             >
//               <button
//                 onClick={() => setViewItem(null)}
//                 className="absolute top-3 right-3 text-gray-500"
//               >
//                 <FiX size={22} />
//               </button>

//               <h2 className="text-xl font-semibold mb-3">
//                 Customer Details
//               </h2>

//               <div className="space-y-2 text-sm">
//                 <p><b>Name:</b> {viewItem.clientName}</p>
//                 <p><b>Phone:</b> {viewItem.phone}</p>
//                 <p><b>Address:</b> {viewItem.address}</p>
//                 <p><b>Service Type:</b> {viewItem.type || "—"}</p>
//                 <p><b>Price:</b> ₹{viewItem.price}</p>
//                 <p><b>Technician:</b> {viewItem.techName}</p>
//                 <p><b>Status:</b> {viewItem.status}</p>
//                 <p><b>Date:</b> {new Date(viewItem.createdAt).toLocaleString()}</p>
//               </div>

//               <button
//                 onClick={() => setViewItem(null)}
//                 className="w-full mt-5 bg-blue-600 text-white py-2 rounded-lg"
//               >
//                 Close
//               </button>
//             </motion.div>
//           </div>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }
