"use client";

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import toast from "react-hot-toast";

export default function CustomerPaymentsAdmin() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);

  const [summary, setSummary] = useState({
    totalCustomers: 0,
    paidCount: 0,
    pendingCount: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/admin/customer-payments");
        const d = await r.json();
        if (!d.success) throw new Error(d.error || "Failed");

        setData(d.items);
        setSummary({
          totalCustomers: d.totalCustomers,
          paidCount: d.paidCount,
          pendingCount: d.pendingCount,
        });
      } catch (e) {
        toast.error(e.message || "Load failed");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="max-w-6xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">
          Customer Payments (Lifetime)
        </h1>

        {/* SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-white border">
            <div className="text-gray-500 text-sm">Total Customers</div>
            <div className="text-2xl font-bold">{summary.totalCustomers}</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-emerald-700 text-sm">Payment Done</div>
            <div className="text-2xl font-bold text-emerald-700">
              {summary.paidCount}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
            <div className="text-rose-700 text-sm">Payment Pending</div>
            <div className="text-2xl font-bold text-rose-700">
              {summary.pendingCount}
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white border rounded-xl overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-3 text-left">Customer</th>
                <th className="p-3 text-left">Phone</th>
                <th className="p-3 text-left">Address</th>
                <th className="p-3 text-left">Amount</th>
                <th className="p-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="5" className="p-6 text-center">
                    Loading...
                  </td>
                </tr>
              )}

              {!loading &&
                data.map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-3 font-medium">{c.clientName}</td>
                    <td className="p-3">{c.phone}</td>
                    <td className="p-3 max-w-[300px] truncate">
                      {c.address}
                    </td>
                    <td className="p-3">₹{c.price}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-bold ${
                          c.status === "Paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
