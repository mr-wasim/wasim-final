import Header from "../../components/Header";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

export default function Forward() {
  const [user, setUser] = useState(null);
  const [techs, setTechs] = useState([]);
  const [form, setForm] = useState({
    clientName: "",
    phone: "",
    address: "",
    techId: "",
    price: "",
    type: "",
  });

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me");
      const u = await me.json();
      if (u.role !== "admin") {
        window.location.href = "/login";
        return;
      }
      setUser(u);
      const r = await fetch("/api/admin/techs");
      const d = await r.json();
      setTechs(d.items);
    })();
  }, []);

  async function submit(e) {
    e.preventDefault();
    const r = await fetch("/api/admin/forward-call", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form), // ✅ अब price और type भी backend को भेजे जाएंगे
    });
    const d = await r.json();
    if (!r.ok) {
      toast.error(d.error || "Failed");
      return;
    }
    toast.success("Call forwarded");
    setForm({
      clientName: "",
      phone: "",
      address: "",
      techId: "",
      price: "",
      type: "",
    });
  }

  return (
    <div>
      <Header user={user} />
      <main className="max-w-3xl mx-auto p-4 space-y-3">
        <div className="card">
          <div className="font-semibold mb-3">Call Forwarding</div>
          <form onSubmit={submit} className="grid gap-2">
            <input
              className="input"
              placeholder="Client Name"
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Client Phone Number"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
            />
            <input
              className="input"
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              required
            />

            {/* ✅ नया फील्ड: Price */}
            <input
              className="input"
              placeholder="Price"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              required
            />

            {/* ✅ नया फील्ड: Type */}
            <input
              className="input"
              placeholder="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              required
            />

            <select
              className="input"
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

            <button className="btn bg-blue-600 text-white">Forward</button>
          </form>
        </div>
      </main>
    </div>
  );
}
