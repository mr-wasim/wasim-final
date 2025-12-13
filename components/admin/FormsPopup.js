import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PopupShell from "./PopupShell"; // using the same premium shell

export default function FormsPopup({ onClose }) {
  const [forms, setForms] = useState(null); // null = loading
  const [active, setActive] = useState(null);

  // Filter states
  const [filterMode, setFilterMode] = useState("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    load();
  }, []);

  /** LOAD CUSTOMER FORMS */
  async function load(apply = false) {
    try {
      setForms(null);

      let url = "/api/admin/forms";

      if (filterMode === "month") {
        url += "?range=month";
      }

      if (filterMode === "custom" && apply && startDate && endDate) {
        url += `?start=${startDate}&end=${endDate}`;
      }

      const r = await fetch(url, { cache: "no-store" });
      const d = await r.json();

      setForms(d.items || []);
    } catch (err) {
      console.error(err);
      setForms([]);
    }
  }

  return (
    <PopupShell title="Customer Forms" onClose={onClose} width="max-w-4xl">

      {/* === FILTER BAR === */}
      <div className="mb-5 p-3 bg-gray-50 rounded-2xl border">

        {/* FILTER BUTTONS */}
        <div className="flex flex-wrap gap-3 mb-3">
          <button
            onClick={() => {
              setFilterMode("month");
              load();
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterMode === "month"
                ? "bg-blue-600 text-white shadow"
                : "bg-white border"
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => setFilterMode("custom")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
              filterMode === "custom"
                ? "bg-blue-600 text-white shadow"
                : "bg-white border"
            }`}
          >
            Custom Date
          </button>
        </div>

        {/* DATE RANGE FILTER */}
        {filterMode === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">

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
                className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === LOADING SKELETON === */}
      {forms === null && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 bg-white rounded-2xl border shadow animate-pulse">
              <div className="h-4 bg-gray-300 w-1/3 rounded mb-2"></div>
              <div className="h-3 bg-gray-200 w-1/4 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* === EMPTY STATE === */}
      {forms !== null && forms.length === 0 && (
        <div className="text-center py-10 text-gray-500 bg-yellow-50 border rounded-xl">
          No forms found.
        </div>
      )}

      {/* === FORMS LIST === */}
      {forms !== null && forms.length > 0 && (
        <div className="space-y-3">

          {forms.map((f) => (
            <motion.div
              key={f._id}
              onClick={() => setActive(f)}
              whileHover={{ scale: 1.02 }}
              className="p-4 bg-white rounded-2xl shadow border cursor-pointer transition"
              style={{ transform: "translateZ(0)" }}
            >
              <div className="flex justify-between">
                <div>
                  <div className="text-lg font-semibold text-gray-800">
                    {f.clientName || f.name || "Unknown Customer"}
                  </div>
                  <div className="text-sm text-gray-500">{f.phone || "N/A"}</div>
                </div>

                <div className="text-right text-gray-400 text-sm">
                  {new Date(f.createdAt).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          ))}

        </div>
      )}

      {/* === FULL DETAILS POPUP === */}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="bg-white w-[92%] max-w-xl rounded-2xl p-6 shadow-xl border"
            >
              {/* HEADER */}
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-gray-800">
                  {active.clientName || active.name}
                </h3>
                <button
                  className="text-gray-600 hover:text-red-500 text-xl"
                  onClick={() => setActive(null)}
                >
                  ✕
                </button>
              </div>

              {/* DETAILS CONTENT */}
              <div className="space-y-2 text-gray-700 text-sm">
                <p><b>Phone:</b> {active.phone}</p>
                <p><b>Address:</b> {active.address}</p>
                <p><b>Service Type:</b> {active.type}</p>
                <p><b>Created:</b> {new Date(active.createdAt).toLocaleString()}</p>

                {active.extraNotes && (
                  <p><b>Notes:</b> {active.extraNotes}</p>
                )}
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
