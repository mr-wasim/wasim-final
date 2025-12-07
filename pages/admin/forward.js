"use client";

import Header from "../../components/Header";
import { useEffect, useRef, useState, useTransition, useCallback } from "react";
import toast from "react-hot-toast";

// ⛔ No re-render inputs → using refs (FASTEST)
export default function Forward() {
  const [user, setUser] = useState(null);
  const [techs, setTechs] = useState([]);
  const [loading, startTransition] = useTransition();

  // FORM refs (0 re-renders)
  const clientNameRef = useRef();
  const phoneRef = useRef();
  const addressRef = useRef();
  const priceRef = useRef();
  const typeRef = useRef();
  const timeZoneRef = useRef();
  const notesRef = useRef();
  const techRef = useRef();

  // ============== ULTRA FAST DATA LOAD ==============
  useEffect(() => {
    (async () => {
      try {
        const [meRes, techRes] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/admin/techs"),
        ]);

        if (!meRes.ok) throw new Error("User fetch failed");
        const me = await meRes.json();

        if (me.role !== "admin") {
          toast.error("Unauthorized.");
          return (window.location.href = "/login");
        }

        setUser(me);

        const techData = await techRes.json();
        setTechs(techData.items || []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load data");
      }
    })();
  }, []);

  // ============== SUBMIT (0ms UI BLOCK) ==============
  const submit = useCallback(
    async (e) => {
      e.preventDefault();

      const payload = {
        clientName: clientNameRef.current.value.trim(),
        phone: phoneRef.current.value.trim(),
        address: addressRef.current.value.trim(),
        price: priceRef.current.value.trim(),
        type: typeRef.current.value.trim(),
        timeZone: timeZoneRef.current.value.trim(),
        notes: notesRef.current.value.trim(),
        techId: techRef.current.value,
      };

      if (!payload.clientName || !payload.phone || !payload.address || !payload.techId) {
        toast.error("All required fields must be filled");
        return;
      }

      startTransition(async () => {
        try {
          const r = await fetch("/api/admin/forward", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const d = await r.json().catch(() => ({}));

          if (!r.ok) {
            toast.error(d.error || "Forward failed");
            return;
          }

          toast.success("Call forwarded instantly ⚡");

          // RESET FORM (0 lag)
          clientNameRef.current.value = "";
          phoneRef.current.value = "";
          addressRef.current.value = "";
          priceRef.current.value = "";
          typeRef.current.value = "";
          timeZoneRef.current.value = "";
          notesRef.current.value = "";
          techRef.current.value = "";
        } catch (err) {
          console.error(err);
          toast.error("Network error");
        }
      });
    },
    []
  );

  return (
    <div>
      <Header user={user} />

      <main className="max-w-3xl mx-auto p-4 space-y-3">
        <div className="p-4 shadow-md rounded-xl border border-gray-200 bg-white">
          <div className="font-semibold text-lg mb-3">📞 Ultra Fast Call Forward</div>

          <form onSubmit={submit} className="grid gap-3">

            <input ref={clientNameRef} className="input border p-2 rounded" placeholder="Client Name" required />

            <input ref={phoneRef} className="input border p-2 rounded" placeholder="Phone Number" required />

            <input ref={addressRef} className="input border p-2 rounded" placeholder="Address" required />

            <input ref={priceRef} className="input border p-2 rounded" placeholder="Price" type="number" min="0" required />

            <input ref={typeRef} className="input border p-2 rounded" placeholder="Type (Chimney / Hob)" required />

            <input ref={timeZoneRef} className="input border p-2 rounded" placeholder="Time Zone (Morning / Evening)" />

            <textarea ref={notesRef} className="input border p-2 rounded" placeholder="Notes" rows={3} />

            <select ref={techRef} className="input border p-2 rounded" required>
              <option value="">Select Technician</option>
              {techs.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.username}
                </option>
              ))}
            </select>

            <button
              disabled={loading}
              className={`bg-blue-600 text-white rounded p-2 mt-2 transition ${
                loading ? "opacity-50" : "hover:bg-blue-700"
              }`}
            >
              {loading ? "Forwarding..." : "Forward Instantly ⚡"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
