import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PopupShell from "./PopupShell";

export default function PaymentPopup({ onClose }) {
  const [payments, setPayments] = useState(null);
  const [summary, setSummary] = useState({ online: 0, cash: 0, total: 0 });
  const [active, setActive] = useState(null);

  const [filterMode, setFilterMode] = useState("month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  useEffect(() => {
    applyFilter("month");
  }, []);

  /* ---------------- APPLY FILTER (FAST + CLEAN) ---------------- */
  async function applyFilter(mode, customStart = "", customEnd = "") {
    setPayments(null);

    let url = "/api/admin/payments";

    if (mode === "today") url += "?range=today";
    if (mode === "month") url += "?range=month";

    if (mode === "custom") {
      if (!customStart || !customEnd) return;

      url += `?range=custom&from=${customStart}&to=${customEnd}`;
    }

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    setPayments(data.items || []);
    setSummary(data.sum || { online: 0, cash: 0, total: 0 });
  }

  return (
    <PopupShell title="Payments Overview" onClose={onClose} width="max-w-4xl">

      {/* SUMMARY */}
      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 mb-5">
        <div className="grid grid-cols-3 text-center">
          <div>
            <div className="text-gray-500 text-sm">Online</div>
            <div className="text-blue-700 font-bold text-xl">₹{summary.online}</div>
          </div>
          <div>
            <div className="text-gray-500 text-sm">Cash</div>
            <div className="text-green-700 font-bold text-xl">₹{summary.cash}</div>
          </div>
          <div>
            <div className="text-gray-500 text-sm">Total</div>
            <div className="text-purple-700 font-bold text-xl">₹{summary.total}</div>
          </div>
        </div>
      </div>

      {/* FILTER SYSTEM */}
      <div className="p-3 bg-gray-50 rounded-2xl border mb-5">

        <div className="flex flex-wrap gap-3 mb-3">
          <button
            onClick={() => {
              setFilterMode("month");
              applyFilter("month");
            }}
            className={`px-4 py-2 rounded-xl ${
              filterMode === "month" ? "bg-blue-600 text-white" : "bg-white border"
            }`}
          >
            This Month
          </button>

          <button
            onClick={() => {
              setFilterMode("today");
              applyFilter("today");
            }}
            className={`px-4 py-2 rounded-xl ${
              filterMode === "today" ? "bg-blue-600 text-white" : "bg-white border"
            }`}
          >
            Today
          </button>

          <button
            onClick={() => setFilterMode("custom")}
            className={`px-4 py-2 rounded-xl ${
              filterMode === "custom" ? "bg-blue-600 text-white" : "bg-white border"
            }`}
          >
            Custom Date
          </button>
        </div>

        {/* CUSTOM DATE FILTER */}
        {filterMode === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="p-2 rounded-xl border bg-white"
            />

            <span className="text-center mt-2 text-gray-500">to</span>

            <div className="flex gap-2">
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="p-2 rounded-xl border bg-white w-full"
              />

              <button
                onClick={() => applyFilter("custom", start, end)}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white"
              >
                Apply
              </button>
            </div>
          </div>
        )}
      </div>

      {/* LOADING */}
      {payments === null && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="p-4 bg-white rounded-xl border shadow animate-pulse">
              <div className="h-4 bg-gray-300 w-1/3 mb-2"></div>
              <div className="h-3 bg-gray-200 w-1/4"></div>
            </div>
          ))}
        </div>
      )}

      {/* EMPTY */}
      {payments !== null && payments.length === 0 && (
        <div className="p-6 text-center bg-yellow-50 border rounded-xl text-gray-600">
          No payments found.
        </div>
      )}

      {/* PAYMENT LIST */}
      {payments !== null && payments.length > 0 && (
        <div className="space-y-4">
          {payments.map((p) => {
            const total = (p.onlineAmount || 0) + (p.cashAmount || 0);

            return (
              <motion.div
                key={p._id}
                onClick={() => setActive(p)}
                whileHover={{ scale: 1.02 }}
                className="p-5 bg-white rounded-2xl border shadow hover:border-blue-400 cursor-pointer"
              >
                <div className="flex justify-between">

                  <div>
                    <div className="font-semibold text-lg">{p.techUsername}</div>
                    <div className="text-sm text-gray-500">Paying Name: {p.receiver}</div>
                    <div className="text-sm text-gray-600">Mode: {p.mode}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">₹{total}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(p.createdAt).toLocaleString()}
                    </div>
                  </div>

                </div>

                <div className="mt-3 text-sm text-gray-700">
                  Calls Paid: <b>{(p.calls || []).length}</b>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* DETAILS POPUP */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-[92%] max-w-2xl rounded-2xl p-6 border shadow-xl"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold">Payment Details</h3>
                <button
                  onClick={() => setActive(null)}
                  className="text-gray-500 hover:text-red-500 text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2 text-gray-700">
                <p><b>Technician:</b> {active.techUsername}</p>
                <p><b>Paying Name:</b> {active.receiver}</p>
                <p><b>Mode:</b> {active.mode}</p>
                <p><b>Online:</b> ₹{active.onlineAmount}</p>
                <p><b>Cash:</b> ₹{active.cashAmount}</p>
              </div>

              <hr className="my-3" />

              <h4 className="font-semibold mb-2">Calls Included:</h4>

              <div className="space-y-3 max-h-60 overflow-auto pr-2">
                {active.calls?.map((c, i) => (
                  <div key={i} className="p-3 bg-gray-50 rounded-xl border">
                    <div className="font-semibold">{c.clientName}</div>
                    <div className="text-sm">{c.phone}</div>
                    <div className="text-sm">Service: {c.type}</div>
                    <div className="text-sm">Price: ₹{c.price}</div>
                    <div className="text-sm">Online: ₹{c.onlineAmount}</div>
                    <div className="text-sm">Cash: ₹{c.cashAmount}</div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setActive(null)}
                className="mt-4 bg-red-500 text-white px-4 py-2 rounded-xl"
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
