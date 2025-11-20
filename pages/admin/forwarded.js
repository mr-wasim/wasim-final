import Header from "../../components/Header";
import { useEffect, useState } from "react";

export default function ForwardedList() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [viewItem, setViewItem] = useState(null); // 👈 POPUP DATA

  async function load() {
    const params = new URLSearchParams({ page, q, status });
    const r = await fetch("/api/admin/forwarded?" + params.toString());
    const d = await r.json();
    setItems(d.items);
  }

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      const u = await me.json();
      if (u.role !== "admin") {
        window.location.href = "/login";
        return;
      }
      setUser(u);
      await load();
    })();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Header user={user} />

      <main className="max-w-6xl mx-auto p-4 space-y-4">

        {/* 🔍 FILTER BAR */}
        <div className="bg-white shadow rounded-lg p-4 grid md:grid-cols-4 gap-3 border border-gray-200">
          <input
            className="input border border-gray-300 rounded-md px-3 py-2"
            placeholder="Search name / phone / address"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="input border border-gray-300 rounded-md px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option>Pending</option>
            <option>In Process</option>
            <option>Completed</option>
            <option>Closed</option>
          </select>

          <button
            onClick={() => {
              setPage(1);
              load();
            }}
            className="btn bg-blue-600 text-white rounded-md py-2"
          >
            Apply Filter
          </button>
        </div>

        {/* 📋 CALL LIST TABLE */}
        <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr className="text-left text-gray-700">
                <th className="p-3">Client</th>
                <th className="p-3">Phone</th>
                <th className="p-3 w-64">Address</th>
                <th className="p-3">Technician</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>

            <tbody>
              {items.map((it) => (
                <tr
                  key={it._id}
                  onClick={() => setViewItem(it)}
                  className="border-t cursor-pointer hover:bg-blue-50 transition"
                >
                  <td className="p-3">{it.clientName}</td>
                  <td className="p-3">{it.phone}</td>
                  <td className="p-3">{it.address}</td>
                  <td className="p-3">{it.techName}</td>
                  <td className="p-3 font-medium">{it.status}</td>
                  <td className="p-3">
                    {new Date(it.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* PAGE BUTTONS */}
          <div className="flex justify-between items-center p-3 bg-gray-100">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setTimeout(load, 0);
              }}
              className="btn bg-gray-200 px-4 py-1 rounded disabled:opacity-50"
            >
              Prev
            </button>

            <div className="text-gray-600">Page {page}</div>

            <button
              onClick={() => {
                setPage((p) => p + 1);
                setTimeout(load, 0);
              }}
              className="btn bg-gray-200 px-4 py-1 rounded"
            >
              Next
            </button>
          </div>
        </div>
      </main>

      {/* 🟦 DETAILS POPUP */}
      {viewItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-3">
          <div className="bg-white w-full max-w-md rounded-xl shadow-xl p-6 space-y-3 relative">
            
            <button
              onClick={() => setViewItem(null)}
              className="absolute top-3 right-3 text-xl text-gray-500 hover:text-black"
            >
              ✕
            </button>

            <h2 className="text-xl font-semibold mb-2 text-center">
              Call Details
            </h2>

            <div className="space-y-2 text-sm">
              <p><b>Client Name:</b> {viewItem.clientName}</p>
              <p><b>Phone:</b> {viewItem.phone}</p>
              <p><b>Address:</b> {viewItem.address}</p>
              <p><b>Type:</b> {viewItem.type}</p>
              <p><b>Price:</b> ₹{viewItem.price}</p>
              <p><b>Technician:</b> {viewItem.techName}</p>
              <p><b>Status:</b> {viewItem.status}</p>
              <p><b>Date:</b> {new Date(viewItem.createdAt).toLocaleString()}</p>
            </div>

            <button
              onClick={() => setViewItem(null)}
              className="w-full mt-4 bg-blue-600 text-white py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
