import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";

export default function TechHome() {
  const [user, setUser] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    clientName: "",
    address: "",
    payment: "",
    phone: "",
    status: "Services Done",
    signature: "",
  });
  const [canvasWidth, setCanvasWidth] = useState(500);
  const sigRef = useRef();

  // ✅ Responsive canvas resize
  useEffect(() => {
    const updateSize = () => {
      setCanvasWidth(window.innerWidth < 500 ? window.innerWidth - 40 : 500);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ✅ Fast auth check + Skeleton
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { cache: "no-store" });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await me.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }
        startTransition(() => {
          setUser(u);
          setLoading(false);
        });
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  function clearSig() {
    sigRef.current?.clear();
    setForm({ ...form, signature: "" });
  }

  async function submit(e) {
    e.preventDefault();
    const signature = form.signature || sigRef.current?.toDataURL();
    const r = await fetch("/api/tech/submit-form", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, signature }),
    });
    const d = await r.json();
    if (!r.ok) {
      toast.error(d.error || "Failed");
      return;
    }
    toast.success("Form submitted ✅");
    setForm({
      clientName: "",
      address: "",
      payment: 0,
      phone: "",
      status: "Services Done",
      signature: "",
    });
    clearSig();
  }

  // ✅ Skeleton Component
  const Skeleton = () => (
    <div className="animate-pulse space-y-4 p-4">
      <div className="h-6 bg-gray-200 rounded w-1/3"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-200 rounded"></div>
      <div className="h-32 bg-gray-200 rounded"></div>
      <div className="h-10 bg-gray-300 rounded w-1/2 mx-auto"></div>
    </div>
  );

  return (
    <div className="pb-16">
      <Header user={user} />
      <main className="max-w-2xl mx-auto p-4 space-y-3 transition-all duration-150">
        <div className="card shadow-md p-4 rounded-2xl border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div>📝</div>
            <div className="font-semibold text-lg">Service Form</div>
          </div>

          {loading ? (
            <Skeleton />
          ) : (
            <form onSubmit={submit} className="grid gap-2">
              <input
                className="input border rounded-lg p-2"
                placeholder="Client Name"
                value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                required
              />
              <input
                className="input border rounded-lg p-2"
                placeholder="Client Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
              <input
                className="input border rounded-lg p-2"
                type="number"
                placeholder="Payment (₹)"
                value={form.payment}
                onChange={(e) =>
                  setForm({ ...form, payment: Number(e.target.value) })
                }
              />
              <input
                className="input border rounded-lg p-2"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                required
              />
              <select
                className="input border rounded-lg p-2"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option>Services Done</option>
                <option>Installation Done</option>
                <option>Complaint Done</option>
                <option>Under Process</option>
              </select>

              {/* ✅ Signature Pad */}
              <div>
                <div className="label mb-1">Client Signature</div>
                <div className="border rounded-xl overflow-hidden">
                  <SignaturePad
                    ref={sigRef}
                    canvasProps={{
                      width: canvasWidth,
                      height: 200,
                      className: "sigCanvas w-full",
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Sign inside the box.
                  <button
                    type="button"
                    onClick={clearSig}
                    className="underline ml-2"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <button
                className="btn bg-blue-600 text-white font-semibold py-2 rounded-lg mt-2 transition-transform duration-150 active:scale-95"
                disabled={isPending}
              >
                {isPending ? "Submitting..." : "Submit"}
              </button>
            </form>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
