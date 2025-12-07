"use client";

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import { FiEdit, FiTrash, FiRepeat, FiSearch, FiX } from "react-icons/fi";

/* -------------------------------------------------------------
   SAFE ID HELPER
------------------------------------------------------------- */
function getId(call) {
  if (!call) return null;
  if (typeof call._id === "string") return call._id;
  if (call._id?.$oid) return call._id.$oid;
  if (call._id?.toString) return call._id.toString();
  if (typeof call.id === "string") return call.id;
  return null;
}

/* -------------------------------------------------------------
   MAIN PAGE (ADMIN HEADER FORCED)
------------------------------------------------------------- */
export default function AllCalls() {
  const [calls, setCalls] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const [editData, setEditData] = useState(null);
  const [changeTechData, setChangeTechData] = useState(null);

  const [applying, setApplying] = useState(false);

  /* -------------------------------------------------------------
     LOAD DATA (SUPER FAST, NO EXTRA RERENDER)
  ------------------------------------------------------------- */
  const fetchData = async (opts = {}) => {
    try {
      setLoading(true);

      const finalPage = opts.page ?? page ?? 1;
      const finalQ = opts.q ?? q ?? "";
      const finalStatus = opts.status ?? status ?? "";

      const params = new URLSearchParams({
        page: String(finalPage),
        q: finalQ,
        status: finalStatus,
      });

      const [cRes, tRes] = await Promise.all([
        fetch("/api/admin/forwarded?" + params.toString(), {
          cache: "no-store",
        }),
        fetch("/api/admin/get-technicians", { cache: "no-store" }),
      ]);

      const cJson = await cRes.json();
      const tJson = await tRes.json();

      const items = Array.isArray(cJson)
        ? cJson
        : Array.isArray(cJson.items)
        ? cJson.items
        : [];

      const techList = Array.isArray(tJson?.data)
        ? tJson.data
        : Array.isArray(tJson?.techs)
        ? tJson.techs
        : [];

      setCalls(
        items.map((c) => ({
          ...c,
          _id: getId(c),
        }))
      );

      setTechs(
        techList.map((t) => ({
          _id: getId(t) || t._id?.toString?.() || t._id,
          name: t.name || t.username || "Unnamed Tech",
        }))
      );

      setPage(finalPage);
      setQ(finalQ);
      setStatus(finalStatus);
    } catch (err) {
      console.error("LOAD ERROR:", err);
    } finally {
      setLoading(false);
      setApplying(false);
    }
  };

  useEffect(() => {
    // initial load only once
    fetchData({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------------------
     DELETE CALL
  ------------------------------------------------------------- */
  const deleteCall = async (id) => {
    if (!id) return;
    if (!confirm("Delete this call permanently?")) return;

    try {
      const r = await fetch("/api/admin/delete-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Delete failed");
      fetchData({});
    } catch (err) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------------
     SAVE EDIT
  ------------------------------------------------------------- */
  const saveEdit = async () => {
    if (!editData) return;
    const id = getId(editData);
    if (!id) return alert("Missing call ID");

    try {
      const r = await fetch("/api/admin/update-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editData, _id: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");

      setEditData(null);
      fetchData({});
    } catch (err) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------------
     CHANGE TECHNICIAN
  ------------------------------------------------------------- */
  const submitChangeTech = async () => {
    if (!changeTechData?.callId || !changeTechData?.newTech) return;

    try {
      const r = await fetch("/api/admin/change-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeTechData),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Change tech failed");

      setChangeTechData(null);
      fetchData({});
    } catch (err) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------------
     SKELETON (CLEAN & LIGHT)
  ------------------------------------------------------------- */
  const Skeleton = () => (
    <div className="space-y-3 mt-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="animate-pulse bg-gray-200/70 h-24 rounded-xl shadow-sm"
        />
      ))}
    </div>
  );

  /* -------------------------------------------------------------
     BADGE FOR STATUS
  ------------------------------------------------------------- */
  const statusBadgeClass = (s) => {
    const v = (s || "").toLowerCase();
    if (v === "pending") return "bg-amber-100 text-amber-700 border-amber-200";
    if (v === "in process" || v === "in-progress")
      return "bg-blue-100 text-blue-700 border-blue-200";
    if (v === "completed")
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (v === "closed") return "bg-red-100 text-red-700 border-red-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
  };

  /* -------------------------------------------------------------
     MAIN UI
  ------------------------------------------------------------- */
  return (
    <>
      {/* ⭐ FORCE ADMIN HEADER HERE */}
      <Header user={{ role: "admin", name: "Admin" }} />

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* TITLE BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
              All Calls
            </h1>
            <p className="text-sm text-gray-500">
              View, edit, assign and manage all forwarded calls.
            </p>
          </div>

          <div className="text-xs sm:text-sm text-gray-400">
            v1.0 • Optimized • No Lag
          </div>
        </div>

        {/* FILTERS BAR */}
        <section className="bg-white/90 backdrop-blur rounded-2xl shadow-sm border border-gray-100 px-4 py-3 sm:px-5 sm:py-4 flex flex-col md:flex-row gap-3 md:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <FiSearch className="absolute left-3 top-2.5 text-gray-400 text-sm" />
            <input
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500"
              placeholder="Search by client, phone, address, technician…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <select
            className="w-full md:w-44 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500 bg-white"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Status</option>
            <option>Pending</option>
            <option>In Process</option>
            <option>Completed</option>
            <option>Closed</option>
          </select>

          {/* Apply button */}
          <button
            onClick={() => {
              setApplying(true);
              fetchData({ page: 1, q, status });
            }}
            className="w-full md:w-auto px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition"
            disabled={applying}
          >
            {applying ? "Applying…" : "Apply"}
          </button>
        </section>

        {/* LIST / SKELETON */}
        <section>
          {(loading || applying) && <Skeleton />}

          {!loading && !applying && calls.length === 0 && (
            <div className="mt-6 bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 text-sm">
              No calls found. Try changing filters or search.
            </div>
          )}

          {!loading && !applying && calls.length > 0 && (
            <div className="mt-4 space-y-3">
              {calls.map((call) => {
                const id = getId(call);
                return (
                  <div
                    key={id}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow px-4 py-4 sm:px-5 sm:py-4 flex flex-col gap-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                      {/* LEFT INFO */}
                      <div className="space-y-1 text-sm text-gray-800 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="font-semibold text-base sm:text-lg text-gray-900">
                            {call.clientName || "Unknown Client"}
                          </p>
                          {call.status && (
                            <span
                              className={[
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] border font-semibold",
                                statusBadgeClass(call.status),
                              ].join(" ")}
                            >
                              {call.status}
                            </span>
                          )}
                        </div>

                        {call.phone && (
                          <p className="text-gray-600 text-xs sm:text-sm">
                            📱 {call.phone}
                          </p>
                        )}

                        {call.address && (
                          <p className="text-gray-700 text-xs sm:text-sm">
                            📍 {call.address}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] sm:text-xs text-gray-600 mt-1">
                          {call.type && (
                            <span>
                              <b>Type:</b> {call.type}
                            </span>
                          )}
                          {call.price != null && call.price !== "" && (
                            <span>
                              <b>Price:</b> ₹{call.price}
                            </span>
                          )}
                          {call.timeZone && (
                            <span>
                              <b>Time Zone:</b> {call.timeZone}
                            </span>
                          )}
                        </div>

                        {call.notes && (
                          <p className="text-[11px] sm:text-xs text-gray-500 mt-1 line-clamp-2">
                            <b>Notes:</b> {call.notes}
                          </p>
                        )}

                        <p className="text-[11px] text-gray-500 mt-1">
                          Technician:{" "}
                          <span className="font-semibold text-blue-600">
                            {call.techName ||
                              call.technician?.name ||
                              "Not Assigned"}
                          </span>
                        </p>

                        {call.createdAt && (
                          <p className="text-[11px] text-gray-400">
                            {new Date(call.createdAt).toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>

                      {/* RIGHT ACTIONS */}
                      <div className="flex sm:flex-col gap-2 sm:items-stretch sm:justify-start text-sm">
                        <button
                          onClick={() =>
                            setEditData({
                              ...call,
                              _id: id,
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] transition"
                        >
                          <FiEdit className="text-xs" /> Edit
                        </button>

                        <button
                          onClick={() =>
                            setChangeTechData({
                              callId: id,
                              newTech: "",
                            })
                          }
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 active:scale-[0.98] transition"
                        >
                          <FiRepeat className="text-xs" /> Change
                        </button>

                        <button
                          onClick={() => deleteCall(id)}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] transition"
                        >
                          <FiTrash className="text-xs" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* PAGINATION (SIMPLE & FAST) */}
        {!loading && calls.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center justify-between text-sm">
            <button
              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200 transition"
              disabled={page <= 1}
              onClick={() => fetchData({ page: page - 1 })}
            >
              Prev
            </button>

            <span className="text-gray-600 font-semibold">
              Page <span className="text-gray-900">{page}</span>
            </span>

            <button
              className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              onClick={() => fetchData({ page: page + 1 })}
            >
              Next
            </button>
          </section>
        )}
      </main>

      {/* -------------------------------------------------------------
         EDIT MODAL
      ------------------------------------------------------------- */}
      {editData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-3 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 relative">
            <button
              onClick={() => setEditData(null)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <FiX />
            </button>

            <h2 className="text-xl font-bold mb-3 text-gray-900">
              Edit Call
            </h2>

            <div className="space-y-2 text-sm">
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2"
                placeholder="Client Name"
                value={editData.clientName || ""}
                onChange={(e) =>
                  setEditData({ ...editData, clientName: e.target.value })
                }
              />
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2"
                placeholder="Phone"
                value={editData.phone || ""}
                onChange={(e) =>
                  setEditData({ ...editData, phone: e.target.value })
                }
              />
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2 min-h-[60px]"
                placeholder="Address"
                value={editData.address || ""}
                onChange={(e) =>
                  setEditData({ ...editData, address: e.target.value })
                }
              />
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2"
                placeholder="Price"
                value={editData.price ?? ""}
                onChange={(e) =>
                  setEditData({ ...editData, price: e.target.value })
                }
              />
              <input
                className="w-full border border-gray-200 rounded-xl px-3 py-2"
                placeholder="Type"
                value={editData.type || ""}
                onChange={(e) =>
                  setEditData({ ...editData, type: e.target.value })
                }
              />
              <textarea
                className="w-full border border-gray-200 rounded-xl px-3 py-2 min-h-[60px]"
                placeholder="Notes"
                value={editData.notes || ""}
                onChange={(e) =>
                  setEditData({ ...editData, notes: e.target.value })
                }
              />

              <select
                className="w-full border border-gray-200 rounded-xl px-3 py-2"
                value={editData.techId || ""}
                onChange={(e) =>
                  setEditData({ ...editData, techId: e.target.value })
                }
              >
                <option value="">Keep Technician</option>
                {techs.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={saveEdit}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 active:scale-[0.98] transition"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
         CHANGE TECH MODAL
      ------------------------------------------------------------- */}
      {changeTechData && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-3 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 relative">
            <button
              onClick={() => setChangeTechData(null)}
              className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            >
              <FiX />
            </button>

            <h2 className="text-xl font-bold mb-3 text-gray-900">
              Change Technician
            </h2>

            <select
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              value={changeTechData.newTech}
              onChange={(e) =>
                setChangeTechData({
                  ...changeTechData,
                  newTech: e.target.value,
                })
              }
            >
              <option value="">Select Technician</option>
              {techs.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>

            <button
              disabled={!changeTechData.newTech}
              onClick={submitChangeTech}
              className="mt-4 w-full bg-emerald-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Update Technician
            </button>
          </div>
        </div>
      )}
    </>
  );
}
