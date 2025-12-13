import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PopupShell from "./PopupShell";

export default function ForwardedPopup({ onClose }) {
  const [items, setItems] = useState(null); // null = loading
  const [active, setActive] = useState(null);

  // Filters
  const [filterMode, setFilterMode] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    load();
  }, []);

  /** LOAD FORWARDED CALLS */
  async function load(apply = false) {
    try {
      setItems(null);

      let url = "/api/admin/forwarded-all"; // YOUR API FILE NAME

      // backend currently does not support filters → we filter on frontend later
      // but we keep structure for future
      if (filterMode === "month") url += "?range=month";

      if (filterMode === "custom" && apply && startDate && endDate)
        url += `?start=${startDate}&end=${endDate}`;

      const r = await fetch(url, { cache: "no-store" });
      let d = await r.json();

      // ⚠️ FIX: d is ARRAY, not object
      if (!Array.isArray(d)) d = [];

      setItems(d);
    } catch (err) {
      console.error(err);
      setItems([]);
    }
  }

  return (
    <PopupShell title="Forwarded Calls" onClose={onClose} width="max-w-4xl">

      {/* === FILTER SECTION (UI READY, BACKEND READY) === */}
      <div className="mb-5 p-3 bg-gray-50 rounded-2xl border">
        <div className="flex flex-wrap gap-3 mb-3">
          <button
            onClick={() => {
              setFilterMode("month");
              load();
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              filterMode === "month"
                ? "bg-blue-600 text-white shadow"
                : "bg-white border"
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => setFilterMode("custom")}
            className={`px-4 py-2 rounded-xl text-sm font-medium ${
              filterMode === "custom"
                ? "bg-blue-600 text-white shadow"
                : "bg-white border"
            }`}
          >
            Custom Date
          </button>
        </div>

        {filterMode === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white p-2 px-4 rounded-xl border shadow-sm w-full"
            />

            <span className="text-center text-gray-500">to</span>

            <div className="flex gap-2">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white p-2 px-4 rounded-xl border shadow-sm w-full"
              />

              <button
                onClick={() => load(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === LOADING SKELETON === */}
      {items === null && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 bg-white rounded-xl border shadow animate-pulse">
              <div className="h-4 bg-gray-300 w-1/3 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 w-1/4 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* === EMPTY === */}
      {items !== null && items.length === 0 && (
        <div className="text-center py-10 bg-yellow-50 border rounded-xl text-gray-700">
          No forwarded calls found.
        </div>
      )}

      {/* === LIST === */}
      {items !== null && items.length > 0 && (
        <div className="space-y-3">
          {items.map((c) => (
            <motion.div
              key={c._id}
              onClick={() => setActive(c)}
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-white rounded-xl shadow border hover:border-blue-400 cursor-pointer"
            >
              <div className="flex justify-between">
                <div>
                  <div className="text-lg font-semibold">{c.clientName}</div>
                  <div className="text-sm text-gray-500">{c.phone}</div>
                </div>

                <div className="text-sm text-gray-400">
                  {new Date(c.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="text-sm mt-1"><b>Tech:</b> {c.techName || "-"}</div>
              <div className="text-sm"><b>Status:</b> {c.status}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* === DETAILS POPUP === */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]"
          >
            <motion.div
              initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}
              className="bg-white w-[92%] max-w-lg rounded-2xl p-6 shadow-xl border"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Call Details</h3>
                <button
                  className="text-gray-600 hover:text-red-500 text-xl"
                  onClick={() => setActive(null)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-sm text-gray-700">
                <p><b>Name:</b> {active.clientName}</p>
                <p><b>Phone:</b> {active.phone}</p>
                <p><b>Technician:</b> {active.techName || "-"}</p>
                <p><b>Status:</b> {active.status}</p>
                <p><b>Address:</b> {active.address}</p>
                <p><b>Date:</b> {new Date(active.createdAt).toLocaleString()}</p>
              </div>

              <button
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-xl shadow hover:bg-red-600"
                onClick={() => setActive(null)}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </PopupShell>
  );
}
