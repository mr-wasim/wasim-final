import Header from "../../components/Header";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

export default function Techs() {

  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      const u = await me.json();

      if (u.role !== "admin") {
        window.location.href = "/login";
        return;
      }

      setUser(u);
      loadTechs();
    })();
  }, []);

  async function loadTechs() {
    const r = await fetch("/api/admin/techs", { cache: "no-store" });
    const d = await r.json();
    setItems(d.items || []);
  }

  async function deleteTech(id) {
    const r = await fetch("/api/admin/delete-tech?id=" + id, {
      method: "DELETE",
    });

    const d = await r.json();

    if (!d.success) {
      toast.error("Error deleting technician");
      return;
    }

    toast.success("Technician deleted successfully");
    setItems(items.filter((t) => t._id !== id));
    setConfirmDelete(null);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white/40 via-white/10 to-white/40 backdrop-blur-xl">

      <Header user={user} />

      <main className="max-w-6xl mx-auto p-6">

        {/* PAGE TITLE */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Technicians</h1>

          <Link
            href="/admin/create-tech"
            className="px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700"
          >
            + Create Technician
          </Link>
        </div>

        {/* GRID */}
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((t) => (
            <motion.div
              key={t._id}
              whileHover={{ scale: 1.02 }}
              className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-lg rounded-2xl p-5 
                         flex flex-col justify-between transition"
            >
              {/* NAME */}
              <div>
                <div className="text-xl font-semibold text-gray-800">{t.username}</div>
                <div className="text-sm text-gray-600 mt-1">
                  Joined: {new Date(t.createdAt).toLocaleDateString()}
                </div>

                <div className="mt-2 text-sm text-gray-500">
                  Phone: {t.phone || "-"}
                </div>
              </div>

              {/* ACTIONS */}
              <div className="flex justify-between mt-5">
                <Link
                  href={`/admin/tech/${t._id}`}
                  className="px-3 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600"
                >
                  View
                </Link>

                <button
                  onClick={() => setConfirmDelete(t)}
                  className="px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* DELETE CONFIRM POPUP */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur flex items-center justify-center z-[999]"
          >
            <motion.div
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl shadow-xl w-[90%] max-w-sm"
            >
              <h2 className="text-xl font-bold mb-3 text-gray-800">Delete Technician?</h2>

              <p className="text-gray-700 mb-5">
                Are you sure you want to delete <b>{confirmDelete.username}</b>?  
                <br />This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2 rounded-xl bg-gray-300 hover:bg-gray-400"
                >
                  Cancel
                </button>

                <button
                  onClick={() => deleteTech(confirmDelete._id)}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
