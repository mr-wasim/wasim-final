"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiEdit, FiTrash, FiRepeat, FiX } from "react-icons/fi";

/* ---------------------- ID NORMALIZER ---------------------- */
function normalizeId(call) {
  if (!call) return null;
  if (call._id && typeof call._id === "string") return call._id;
  if (call._id && call._id.$oid) return call._id.$oid;
  if (call.id && typeof call.id === "string") return call.id;
  if (call._id && call._id.toString) return String(call._id);
  return null;
}

/* ---------------------- MAIN COMPONENT ---------------------- */
export default function AllCalls() {
  const [calls, setCalls] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const [editData, setEditData] = useState(null);
  const [changeTechData, setChangeTechData] = useState(null);

  /* ---------------------- LOAD ALL DATA ---------------------- */
  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, q, status });

      // FETCH CALLS
      const r = await fetch("/api/admin/forwarded?" + params.toString(), {
        cache: "no-store"
      });
      const d = await r.json();
      setCalls(
        d.items?.map((c) => ({ ...c, _id: normalizeId(c) })) || []
      );

      // FETCH TECHNICIANS
      const t = await fetch("/api/admin/get-technicians").then((r) => r.json());

      setTechs(
        (t.data || []).map((tech) => ({
          _id: tech._id.toString(),
          name: tech.name || tech.username || "Unnamed Tech"
        }))
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

  /* ---------------------- DELETE CALL ---------------------- */
  const deleteCall = async (id) => {
    if (!confirm("Delete this call permanently?")) return;
    try {
      const r = await fetch("/api/admin/delete-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Delete failed");

      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ---------------------- SAVE EDIT ---------------------- */
  const saveEdit = async () => {
    if (!editData) return;

    const id = editData._id || normalizeId(editData);
    if (!id) return alert("Missing call ID");

    try {
      const payload = { ...editData, _id: id };

      const r = await fetch("/api/admin/update-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
        
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");

      setEditData(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ---------------------- CHANGE TECHNICIAN ---------------------- */
  const submitChangeTech = async () => {
    if (!changeTechData?.callId || !changeTechData?.newTech) return;

    try {
      const r = await fetch("/api/admin/change-tech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changeTechData)
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Change tech failed");

      setChangeTechData(null);
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  /* ---------------------- LOADING ---------------------- */
  if (loading)
    return (
      <div className="p-6 text-center text-gray-600 text-lg">
        Loading All Calls...
      </div>
    );

  /* ---------------------- UI ---------------------- */
  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">All Calls</h1>

      {/* ---------------------- FILTERS ---------------------- */}
      <div className="flex gap-3 mb-4 bg-white p-3 rounded-lg shadow">
        <input
          className="border p-2 rounded flex-1"
          placeholder="Search..."
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
          className="bg-blue-600 text-white px-4 rounded"
          onClick={() => {
            setPage(1);
            loadData();
          }}
        >
          Apply Filter
        </button>
      </div>

      {/* ---------------------- CALL LIST ---------------------- */}
      <div className="grid gap-4">
        {calls.map((call) => (
          <motion.div
            key={call._id}
            layout
            className="bg-white p-4 rounded-xl shadow border"
          >
            <div className="flex justify-between">
              {/* LEFT */}
              <div>
                <p className="font-semibold text-lg">
                  {call.clientName || "—"}
                </p>
                <p className="text-gray-600 text-sm">{call.phone || "—"}</p>
                <p className="text-gray-700 mt-1">{call.address || "—"}</p>

                <p className="mt-1 text-sm">
                  <b>Type:</b> {call.type || "—"}
                </p>
                <p className="mt-1 text-sm">
                  <b>Price:</b> ₹{call.price ?? 0}
                </p>
                <p className="mt-1 text-sm">
                  <b>Time Zone:</b> {call.timeZone || "—"}
                </p>
                <p className="mt-1 text-sm">
                  <b>Notes:</b> {call.notes || "—"}
                </p>

                <p className="text-sm mt-2">
                  Technician:{" "}
                  <span className="font-semibold text-blue-600">
                    {call.techName ||
                      call.technician?.name ||
                      "Not Assigned"}
                  </span>
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  Date:{" "}
                  {call.createdAt
                    ? new Date(call.createdAt).toLocaleString()
                    : "—"}
                </p>
              </div>

              {/* RIGHT BUTTONS */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    setEditData({ ...call, _id: normalizeId(call) })
                  }
                  className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500 text-white"
                >
                  <FiEdit /> Edit
                </button>

                <button
                  onClick={() =>
                    setChangeTechData({
                      callId: normalizeId(call),
                      newTech: ""
                    })
                  }
                  className="flex items-center gap-2 px-3 py-1 rounded bg-amber-500 text-white"
                >
                  <FiRepeat /> Change
                </button>

                <button
                  onClick={() => deleteCall(normalizeId(call))}
                  className="flex items-center gap-2 px-3 py-1 rounded bg-red-500 text-white"
                >
                  <FiTrash /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ---------------------- PAGINATION ---------------------- */}
      <div className="flex justify-between mt-4 bg-gray-100 p-3 rounded">
        <button
          className="px-4 py-1 bg-gray-300 rounded"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </button>

        <span>Page {page}</span>

        <button
          className="px-4 py-1 bg-gray-300 rounded"
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>

      {/* ---------------------- EDIT MODAL ---------------------- */}
      <AnimatePresence>
        {editData && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl max-w-md w-full relative">
              <button
                className="absolute top-3 right-3"
                onClick={() => setEditData(null)}
              >
                <FiX />
              </button>

              <h2 className="text-xl font-bold mb-3">Edit Call</h2>

              <input
                className="w-full border p-2 mb-2 rounded"
                value={editData.clientName || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    clientName: e.target.value
                  })
                }
                placeholder="Client Name"
              />

              <input
                className="w-full border p-2 mb-2 rounded"
                value={editData.phone || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    phone: e.target.value
                  })
                }
                placeholder="Phone"
              />

              <textarea
                className="w-full border p-2 mb-2 rounded"
                value={editData.address || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    address: e.target.value
                  })
                }
                placeholder="Address"
              />

              <input
                className="w-full border p-2 mb-2 rounded"
                value={editData.price ?? ""}
                onChange={(e) =>
                  setEditData({ ...editData, price: e.target.value })
                }
                placeholder="Price"
              />

              <input
                className="w-full border p-2 mb-2 rounded"
                value={editData.type || ""}
                onChange={(e) =>
                  setEditData({ ...editData, type: e.target.value })
                }
                placeholder="Type"
              />

              <input
                className="w-full border p-2 mb-2 rounded"
                value={editData.timeZone || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    timeZone: e.target.value
                  })
                }
                placeholder="Time Zone"
              />

              <textarea
                className="w-full border p-2 mb-2 rounded"
                value={editData.notes || ""}
                onChange={(e) =>
                  setEditData({ ...editData, notes: e.target.value })
                }
                placeholder="Notes"
              />

              {/* TECHNICIAN DROPDOWN */}
              <select
                className="w-full border p-2 mb-2 rounded"
                value={editData.techId || editData.technicianId || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData,
                    techId: e.target.value
                  })
                }
              >
                <option value="">Keep Technician</option>
                {techs.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                  </option>
                ))}
              </select>

              <button
                onClick={saveEdit}
                className="bg-blue-600 text-white w-full py-2 rounded"
              >
                Save Changes
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------------------- CHANGE TECH MODAL ---------------------- */}
      <AnimatePresence>
        {changeTechData && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl max-w-md w-full relative">
              <button
                className="absolute top-3 right-3"
                onClick={() => setChangeTechData(null)}
              >
                <FiX />
              </button>

              <h2 className="text-xl font-bold mb-3">Change Technician</h2>

              <select
                className="w-full border p-2 rounded"
                value={changeTechData.newTech}
                onChange={(e) =>
                  setChangeTechData({
                    ...changeTechData,
                    newTech: e.target.value
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
                className="bg-green-600 text-white w-full py-2 rounded mt-3"
              >
                Update Technician
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
