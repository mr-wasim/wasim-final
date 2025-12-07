"use client";

import { useEffect, useState, useRef } from "react";
import Header from "../../components/Header";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function Payments() {
  const [user, setUser] = useState(null);
  const [techs, setTechs] = useState([]);
  const [techId, setTechId] = useState("");

  const [items, setItems] = useState([]);
  const [sum, setSum] = useState({ online: 0, cash: 0, total: 0 });

  const [range, setRange] = useState("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

  const [viewItem, setViewItem] = useState(null);

  // Load Admin + Tech List
  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      const u = await me.json();
      if (u.role !== "admin") return (window.location.href = "/login");
      setUser(u);

      const tr = await fetch("/api/admin/techs");
      const td = await tr.json();
      setTechs(td.items || []);
    })();
  }, []);

  // Load payment data
  async function load() {
    try {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);

      const qs = new URLSearchParams({ techId, range, from, to });
      const r = await fetch("/api/admin/payments?" + qs.toString(), {
        signal: abortRef.current.signal,
      });
      const d = await r.json();

      setItems(d.items || []);
      setSum(d.sum || { online: 0, cash: 0, total: 0 });
    } catch (err) {
      if (err.name !== "AbortError") toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  // Auto load when admin detected
  useEffect(() => {
    if (user) load();
  }, [user]);

  // Export CSV
  async function exportCSV() {
    const qs = new URLSearchParams({ techId, range, from, to, csv: "1" });
    const r = await fetch("/api/admin/payments?" + qs.toString());
    const d = await r.json();

    const blob = new Blob([d.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Format Date
  const fDate = (d) => new Date(d).toLocaleString();

  // Close modal on ESC
  useEffect(() => {
    const esc = (e) => e.key === "Escape" && setViewItem(null);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header user={user} />

      <main className="max-w-6xl mx-auto p-4 space-y-4">

        {/* Filter Bar */}
        <div className="bg-white rounded-xl shadow p-4 grid md:grid-cols-6 gap-3 border">
          <select className="border p-2 rounded" value={techId} onChange={(e) => setTechId(e.target.value)}>
            <option value="">All Technicians</option>
            {techs.map((t) => <option key={t._id} value={t._id}>{t.username}</option>)}
          </select>

          <select className="border p-2 rounded" value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="month">This Month</option>
            <option value="lastmonth">Last Month</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
            <option value="custom">Custom</option>
          </select>

          {range === "custom" && (
            <>
              <input type="date" className="border p-2 rounded" value={from} onChange={(e) => setFrom(e.target.value)} />
              <input type="date" className="border p-2 rounded" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}

          <button onClick={load} className="bg-blue-600 text-white rounded p-2 hover:bg-blue-700">Load</button>
          <button onClick={exportCSV} className="bg-gray-200 rounded p-2 hover:bg-gray-300">Export CSV</button>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-4 bg-white shadow rounded-xl border">
            <div className="text-sm text-gray-500">Online</div>
            <div className="text-3xl font-bold text-blue-600">₹{sum.online}</div>
          </div>
          <div className="p-4 bg-white shadow rounded-xl border">
            <div className="text-sm text-gray-500">Cash</div>
            <div className="text-3xl font-bold text-green-600">₹{sum.cash}</div>
          </div>
          <div className="p-4 bg-white shadow rounded-xl border">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-3xl font-bold text-gray-900">₹{sum.total}</div>
          </div>
        </div>

        {/* Payment Table */}
        <div className="bg-white shadow rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr className="text-left">
                <th className="p-3">Technician</th>
                <th className="p-3">Paying</th>
                <th className="p-3">Calls</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Online</th>
                <th className="p-3">Cash</th>
                <th className="p-3">Total</th>
                <th className="p-3">View</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-gray-500">Loading…</td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-gray-400">No payments found</td>
                </tr>
              )}

              {!loading &&
                items.map((p) => {
                  const online = Number(p.onlineAmount || 0);
                  const cash = Number(p.cashAmount || 0);
                  const total = online + cash;

                  return (
                    <tr key={p._id} className="border-t hover:bg-blue-50 transition">
                      <td className="p-3">{p.techUsername}</td>
                      <td className="p-3">{p.receiver}</td>

                      <td className="p-3">
                        {p.calls?.length || 0} calls
                        <div className="text-xs text-gray-500">
                          {p.calls?.map((c) => c.clientName).join(", ")}
                        </div>
                      </td>

                      <td className="p-3">{p.mode}</td>
                      <td className="p-3 text-blue-600">₹{online}</td>
                      <td className="p-3 text-green-600">₹{cash}</td>
                      <td className="p-3 font-semibold">₹{total}</td>

                      <td className="p-3">
                        <button
                          className="text-blue-600 underline"
                          onClick={() => setViewItem(p)}
                        >
                          View
                        </button>
                      </td>

                      <td className="p-3">{fDate(p.createdAt)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </main>

      {/* -------- MODAL: PAYMENT DETAILS -------- */}
      <AnimatePresence>
        {viewItem && (
          <motion.div
            className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setViewItem(null)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 relative overflow-y-auto max-h-[90vh]"
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
            >
              <button className="absolute top-3 right-3 text-xl" onClick={() => setViewItem(null)}>✕</button>

              <h2 className="text-xl font-bold mb-3">Payment Details</h2>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><b>Technician:</b> {viewItem.techUsername}</div>
                <div><b>Paying Name:</b> {viewItem.receiver}</div>
                <div><b>Mode:</b> {viewItem.mode}</div>
                <div><b>Date:</b> {fDate(viewItem.createdAt)}</div>
              </div>

              <h3 className="font-semibold mb-2">Call Breakdown</h3>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                {viewItem.calls?.map((c, i) => {
                  const online = Number(c.onlineAmount || 0);
                  const cash = Number(c.cashAmount || 0);
                  const total = online + cash;

                  return (
                    <div key={i} className="border rounded-lg p-3 bg-gray-50 text-sm">
                      <div><b>Client:</b> {c.clientName}</div>
                      <div><b>Phone:</b> {c.phone}</div>
                      <div><b>Address:</b> {c.address}</div>
                      <div><b>Service:</b> {c.type}</div>
                      <div><b>Service Price:</b> ₹{c.price}</div>
                      <div><b>Online:</b> ₹{online}</div>
                      <div><b>Cash:</b> ₹{cash}</div>
                      <div><b>Total:</b> ₹{total}</div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 pt-4 border-t text-sm">
                <b>Total Online:</b> ₹{viewItem.onlineAmount} <br />
                <b>Total Cash:</b> ₹{viewItem.cashAmount} <br />
                <b>Grand Total:</b> ₹{Number(viewItem.onlineAmount || 0) + Number(viewItem.cashAmount || 0)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
