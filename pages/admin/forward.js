import Header from "../../components/Header";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function Forward() {
  const [user, setUser] = useState(null);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    phone: "",
    address: "",
    techId: "",
    price: "",
    type: "",
  });

  // ✅ Fetch logged-in user + technicians
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
        if (!me.ok) throw new Error("Failed to fetch user");
        const u = await me.json();

        if (!u?.role || u.role !== "admin") {
          toast.error("Unauthorized. Please login as admin.");
          window.location.href = "/login";
          return;
        }

        setUser(u);

        const r = await fetch("/api/admin/techs");
        if (!r.ok) throw new Error("Failed to fetch technicians");
        const d = await r.json();
        setTechs(d.items || []);
      } catch (err) {
        console.error("Error loading data:", err);
        toast.error("Error loading data");
      }
    })();
  }, []);

  // ✅ Submit handler
  async function submit(e) {
    e.preventDefault();

    if (!form.clientName || !form.phone || !form.address || !form.techId) {
      toast.error("Please fill all required fields");
      return;
    }

    setLoading(true);
    try {
      const r = await fetch("/api/admin/forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      // ✅ Handle empty response safely (avoid "Unexpected end of JSON input")
      let d = {};
      try {
        d = await r.json();
      } catch {
        d = {};
      }

      if (!r.ok) {
        toast.error(d.error || "Failed to forward call");
        return;
      }

      toast.success("Call forwarded successfully ✅");
      setForm({
        clientName: "",
        phone: "",
        address: "",
        techId: "",
        price: "",
        type: "",
      });
    } catch (err) {
      console.error("Submit error:", err);
      toast.error("Network or server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Header user={user} />
      <main className="max-w-3xl mx-auto p-4 space-y-3">
        <div className="card p-4 shadow-md rounded-xl border border-gray-200">
          <div className="font-semibold text-lg mb-3">📞 Call Forwarding</div>
          <form onSubmit={submit} className="grid gap-3">
            <input
              className="input border p-2 rounded"
              placeholder="Client Name"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              required
            />
            <input
              className="input border p-2 rounded"
              placeholder="Client Phone Number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
            <input
              className="input border p-2 rounded"
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />

            {/* ✅ Price */}
            <input
              className="input border p-2 rounded"
              placeholder="Price"
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />

            {/* ✅ Type */}
            <input
              className="input border p-2 rounded"
              placeholder="Type (e.g. Chimney / Hob)"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
            />

            {/* ✅ Technician Select */}
            <select
              className="input border p-2 rounded"
              value={form.techId}
              onChange={(e) => setForm({ ...form, techId: e.target.value })}
              required
            >
              <option value="">Select Technician</option>
              {techs.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.username}
                </option>
              ))}
            </select>

            <button
              disabled={loading}
              className={`btn bg-blue-600 text-white rounded p-2 mt-2 transition ${
                loading ? "opacity-70 cursor-not-allowed" : "hover:bg-blue-700"
              }`}
            >
              {loading ? "Forwarding..." : "Forward"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
