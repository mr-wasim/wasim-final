"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiEdit, FiTrash, FiRepeat, FiX } from "react-icons/fi";
import Header from "../../components/Header"; // ✅ HEADER FIXED

/* -------------------------------------------------------------
   NORMALIZE MONGO ID
------------------------------------------------------------- */
function normalizeId(call) {
  if (!call) return null;
  if (call._id && typeof call._id === "string") return call._id;
  if (call._id && call._id.$oid) return call._id.$oid;
  if (call.id && typeof call.id === "string") return call.id;
  if (call._id && call._id.toString) return String(call._id);
  return null;
}

/* -------------------------------------------------------------
   MAIN PAGE
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

  /* -------------------------------------------------------------
     LOAD DATA
  ------------------------------------------------------------- */
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, q, status });

      const r = await fetch("/api/admin/forwarded?" + params.toString(), {
        cache: "no-store",
      });
      const d = await r.json();

      setCalls(d.items?.map((c) => ({ ...c, _id: normalizeId(c) })) || []);

      const t = await fetch("/api/admin/get-technicians").then((r) => r.json());
      setTechs(
        t.data?.map((tech) => ({
          _id: tech._id.toString(),
          name: tech.name || tech.username || "Unnamed Tech",
        })) || []
      );
    } catch (err) {
      console.error("LOAD ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  /* -------------------------------------------------------------
     DELETE
  ------------------------------------------------------------- */
  const deleteCall = async (id) => {
    if (!confirm("Delete this call permanently?")) return;
    try {
      const r = await fetch("/api/admin/delete-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------------
     EDIT SAVE
  ------------------------------------------------------------- */
  const saveEdit = async () => {
    if (!editData) return;
    const id = editData._id || normalizeId(editData);
    if (!id) return alert("Missing call ID");

    try {
      const r = await fetch("/api/admin/update-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...editData, _id: id }),
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error);

      setEditData(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------------
     CHANGE TECH
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
      if (!r.ok) throw new Error(d.error);

      setChangeTechData(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* -------------------------------------------------------------
     SKELETON LOADER (PROFESSIONAL)
  ------------------------------------------------------------- */
  if (loading) {
    return (
      <>
        <Header />
        <div className="p-4 max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-gray-200 h-28 rounded-xl shadow-sm"
              ></div>
            ))}
          </div>
        </div>
      </>
    );
  }

  /* -------------------------------------------------------------
     UI
  ------------------------------------------------------------- */
  return (
    <>
      <Header /> {/* ⭐ ALWAYS SHOW (FIXED) */}

      <div className="p-4 max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">All Calls</h1>

        {/* ---------------- FILTERS ---------------- */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl shadow">
          <input
            className="border p-2 rounded flex-1"
            placeholder="Search client / phone / address..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <select
            className="border p-2 rounded"
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
            className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
            onClick={() => {
              setPage(1);
              loadData();
            }}
          >
            Apply Filter
          </button>
        </div>

        {/* ---------------- CALL LIST ---------------- */}
        <div className="grid gap-4">
          {calls.map((call) => (
            <motion.div
              key={call._id}
              layout
              className="bg-white p-5 rounded-xl shadow border hover:shadow-md transition"
            >
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                {/* LEFT */}
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-xl">
                    {call.clientName || "—"}
                  </p>
                  <p className="text-gray-600">{call.phone || "—"}</p>
                  <p className="text-gray-700">{call.address || "—"}</p>

                  <p className="text-sm">
                    <b>Type:</b> {call.type || "—"}
                  </p>
                  <p className="text-sm">
                    <b>Price:</b> ₹{call.price ?? 0}
                  </p>
                  <p className="text-sm">
                    <b>Time Zone:</b> {call.timeZone || "—"}
                  </p>
                  <p className="text-sm">
                    <b>Notes:</b> {call.notes || "—"}
                  </p>

                  <p className="text-sm mt-2">
                    Technician:{" "}
                    <span className="font-bold text-blue-600">
                      {call.techName ||
                        call.technician?.name ||
                        "Not Assigned"}
                    </span>
                  </p>

                  <p className="text-xs text-gray-500">
                    {new Date(call.createdAt).toLocaleString()}
                  </p>
                </div>

                {/* RIGHT BUTTONS */}
                <div className="flex sm:flex-col gap-3">
                  <button
                    onClick={() =>
                      setEditData({ ...call, _id: normalizeId(call) })
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <FiEdit /> Edit
                  </button>

                  <button
                    onClick={() =>
                      setChangeTechData({
                        callId: normalizeId(call),
                        newTech: "",
                      })
                    }
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
                  >
                    <FiRepeat /> Change
                  </button>

                  <button
                    onClick={() => deleteCall(normalizeId(call))}
                    className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  >
                    <FiTrash /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ---------------- PAGINATION ---------------- */}
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow">
          <button
            className="px-4 py-2 bg-gray-300 rounded disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Prev
          </button>

          <span className="font-semibold text-lg">Page {page}</span>

          <button
            className="px-4 py-2 bg-gray-300 rounded"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      </div>

      {/* ---------------- EDIT MODAL ---------------- */}
      <AnimatePresence>
        {editData && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          >
            <div className="bg-white p-6 rounded-xl max-w-md w-full relative">
              <button
                className="absolute top-3 right-3"
                onClick={() => setEditData(null)}
              >
                <FiX className="text-xl" />
              </button>

              <h2 className="text-2xl font-bold mb-4">Edit Call</h2>

              {/* INPUTS */}
              <div className="space-y-3">
                <input
                  className="w-full border p-2 rounded"
                  value={editData.clientName || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, clientName: e.target.value })
                  }
                  placeholder="Client Name"
                />

                <input
                  className="w-full border p-2 rounded"
                  value={editData.phone || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, phone: e.target.value })
                  }
                  placeholder="Phone"
                />

                <textarea
                  className="w-full border p-2 rounded"
                  value={editData.address || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, address: e.target.value })
                  }
                  placeholder="Address"
                />

                <input
                  className="w-full border p-2 rounded"
                  value={editData.price ?? ""}
                  onChange={(e) =>
                    setEditData({ ...editData, price: e.target.value })
                  }
                  placeholder="Price"
                />

                <input
                  className="w-full border p-2 rounded"
                  value={editData.type || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, type: e.target.value })
                  }
                  placeholder="Type"
                />

                <textarea
                  className="w-full border p-2 rounded"
                  value={editData.notes || ""}
                  onChange={(e) =>
                    setEditData({ ...editData, notes: e.target.value })
                  }
                  placeholder="Notes"
                />

                <select
                  className="w-full border p-2 rounded"
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
                className="bg-blue-600 text-white w-full py-2 rounded mt-4 hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------- CHANGE TECH MODAL ---------------- */}
      <AnimatePresence>
        {changeTechData && (
          <motion.div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
          >
            <div className="bg-white p-6 rounded-xl max-w-md w-full relative">
              <button
                className="absolute top-3 right-3"
                onClick={() => setChangeTechData(null)}
              >
                <FiX className="text-xl" />
              </button>

              <h2 className="text-2xl font-bold mb-3">
                Change Technician
              </h2>

              <select
                className="w-full border p-2 rounded"
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
                onClick={submitChangeTech}
                disabled={!changeTechData.newTech}
                className="bg-green-600 text-white w-full py-2 rounded mt-4 hover:bg-green-700 disabled:opacity-50"
              >
                Update Technician
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
