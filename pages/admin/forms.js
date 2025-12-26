"use client";
import Header from "../../components/Header";
import { useEffect, useState } from "react";
import { saveAs } from "../../utils/csv";

// ✅ Realistic shimmer skeleton component (UPDATED: 9 columns)
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <td key={i} className="p-2">
          <div className="h-5 bg-gray-200 rounded w-full"></div>
        </td>
      ))}
    </tr>
  );
}

export default function AdminForms() {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tech, setTech] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [typingTimeout, setTypingTimeout] = useState(null);

  // ⚡ FAST FETCH
  const load = async (p = page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        q,
        status,
        tech,
        dateFrom,
        dateTo,
        page: p,
      });
      const res = await fetch(`/api/admin/forms?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch user + first data
  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me", { cache: "no-store" });
      const u = await me.json();
      if (u.role !== "admin") return (window.location.href = "/login");
      setUser(u);
      await load();
    })();
  }, []);

  // ✅ Debounce search
  const handleDebounce = (setter) => (e) => {
    const val = e.target.value;
    setter(val);
    clearTimeout(typingTimeout);
    setTypingTimeout(setTimeout(() => load(1), 300));
  };

  const exportCSV = async () => {
    const params = new URLSearchParams({
      q,
      status,
      tech,
      dateFrom,
      dateTo,
      csv: "1",
    });
    const res = await fetch(`/api/admin/forms?${params.toString()}`);
    const d = await res.json();
    saveAs("forms.csv", d.csv);
  };

  return (
    <div>
      <Header user={user} />
      <main className="max-w-6xl mx-auto p-4 space-y-3">
        {/* Filters */}
        <div className="card grid md:grid-cols-6 gap-2">
          <input
            className="input md:col-span-2"
            placeholder="Search name/phone/address"
            value={q}
            onChange={handleDebounce(setQ)}
          />

          <select
            className="input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              load(1);
            }}
          >
            <option value="">All Status</option>
            <option>Services Done</option>
            <option>Installation Done</option>
            <option>Complaint Done</option>
            <option>Under Process</option>
          </select>

          <input
            className="input"
            placeholder="Technician username"
            value={tech}
            onChange={handleDebounce(setTech)}
          />

          <input
            className="input"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            className="input"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />

          <div className="md:col-span-6 flex gap-2">
            <button
              onClick={() => {
                setPage(1);
                load(1);
              }}
              className="btn bg-blue-600 text-white"
            >
              Filter
            </button>
            <button onClick={exportCSV} className="btn bg-gray-100">
              Export CSV
            </button>
          </div>
        </div>

        {/* Table Section */}
        <div className="card overflow-x-auto min-h-[200px] relative">
          {loading ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Technician</th>
                  <th className="p-2">Client</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Address</th>
                  <th className="p-2">Payment</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Signature</th>
                  <th className="p-2">Sticker</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </tbody>
            </table>
          ) : items.length > 0 ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="p-2">Technician</th>
                    <th className="p-2">Client</th>
                    <th className="p-2">Phone</th>
                    <th className="p-2">Address</th>
                    <th className="p-2">Payment</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Signature</th>
                    <th className="p-2">Sticker</th>
                    <th className="p-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it._id}
                      className="border-t hover:bg-gray-50 transition"
                    >
                      <td className="p-2">{it.techUsername}</td>
                      <td className="p-2">{it.clientName}</td>
                      <td className="p-2">{it.phone}</td>
                      <td className="p-2">{it.address}</td>
                      <td className="p-2">₹{it.payment || 0}</td>
                      <td className="p-2">{it.status}</td>

                      {/* Signature */}
                      <td className="p-2">
                        {it.signature ? (
                          <img
                            src={it.signature}
                            alt="sig"
                            className="h-10 rounded border"
                          />
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* ✅ Sticker */}
                      <td className="p-2">
                        {it.stickerUrl ? (
                          <a
                            href={it.stickerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={it.stickerUrl}
                              alt="sticker"
                              className="h-10 rounded border hover:scale-105 transition cursor-pointer"
                            />
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="p-2">
                        {new Date(it.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between mt-3">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    const p = page - 1;
                    setPage(p);
                    load(p);
                  }}
                  className="btn bg-gray-100"
                >
                  Prev
                </button>

                <div className="text-sm text-gray-600">
                  Page {page} • Total {total}
                </div>

                <button
                  onClick={() => {
                    const p = page + 1;
                    setPage(p);
                    load(p);
                  }}
                  className="btn bg-gray-100"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-500 py-10">
              No records found
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
