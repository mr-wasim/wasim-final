"use client";
export const dynamic = "force-dynamic";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState, useMemo } from "react";
import toast from "react-hot-toast";

export default function Payments() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deviceToken, setDeviceToken] = useState(null);

  const [form, setForm] = useState({
    receiver: "",
    mode: "",
    onlineAmount: "",
    cashAmount: "",
    receiverSignature: "",
  });

  const sigRef = useRef();
  const [canvasWidth, setCanvasWidth] = useState(500);

  // ✅ Responsive SignaturePad width
  useEffect(() => {
    const updateSize = () => {
      setCanvasWidth(window.innerWidth < 640 ? window.innerWidth - 40 : 500);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ✅ Fetch user fast (AbortController for cancel)
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const me = await fetch("/api/auth/me", { signal: controller.signal });
        if (!me.ok) {
          window.location.href = "/login";
          return;
        }
        const u = await me.json();
        if (u.role !== "technician") {
          window.location.href = "/login";
          return;
        }
        setUser(u);
      } catch (err) {
        if (err.name !== "AbortError") console.error(err);
      } finally {
        setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // ✅ Firebase Push Notification Setup (async lazy load)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { getMessaging, getToken, onMessage } = await import("firebase/messaging");
        const { initializeApp, getApps, getApp } = await import("firebase/app");

        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        const messaging = getMessaging(app);

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        });

        if (mounted && token) {
          setDeviceToken(token);
          await fetch("/api/save-fcm-token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
        }

        onMessage(messaging, (payload) => {
          toast.custom(
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg animate-fadeIn">
              📢 {payload?.notification?.title || "New Notification"}
              <br />
              {payload?.notification?.body || ""}
            </div>
          );
        });
      } catch (err) {
        console.error("🔥 Firebase Messaging Init Error:", err);
      }
    })();
    return () => (mounted = false);
  }, []);

  // ✅ Clear signature
  const clearSig = () => {
    sigRef.current?.clear();
    setForm((prev) => ({ ...prev, receiverSignature: "" }));
  };

  // ✅ Input handler (fast, stable)
  const handleChange = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // ✅ Submit form
  async function submit(e) {
    e.preventDefault();
    const receiverSignature = form.receiverSignature || sigRef.current?.toDataURL();

    if (!receiverSignature) return toast.error("Receiver signature required");
    if (!form.receiver) return toast.error("Please enter paying name");
    if (!form.mode) return toast.error("Please select payment mode");

    try {
      const r = await fetch("/api/tech/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, receiverSignature }),
      });

      const d = await r.json();
      if (!r.ok) return toast.error(d.message || "Failed to record payment");

      toast.success("✅ Payment recorded successfully");

      await fetch("/api/sendNotification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: deviceToken,
          title: "New Payment Recorded 💰",
          body: `${form.receiver} paid via ${form.mode}`,
        }),
      });

      setForm({
        receiver: "",
        mode: "",
        onlineAmount: "",
        cashAmount: "",
        receiverSignature: "",
      });
      clearSig();
    } catch (err) {
      console.error("Payment submission failed:", err);
      toast.error("Error recording payment");
    }
  }

  // ✅ Skeleton UI while loading
  if (loading)
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
        <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto"></div>
        <div className="h-6 bg-gray-200 rounded w-2/3 mx-auto"></div>
        <div className="h-40 bg-gray-200 rounded"></div>
      </div>
    );

  return (
    <div className="pb-20">
      <Header user={user} />
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card bg-white p-4 rounded-2xl shadow-md transition-all">
          <div className="flex items-center gap-2 mb-2">
            <div>💳</div>
            <div className="font-semibold text-gray-800">Payment Mode</div>
          </div>

          <form onSubmit={submit} className="grid gap-3">
            {/* Receiver */}
            <div>
              <div className="label">Who are you paying to?</div>
              <input
                className="input w-full border rounded-lg px-3 py-2 focus:ring focus:ring-blue-200"
                placeholder="Paying name"
                value={form.receiver}
                onChange={handleChange("receiver")}
              />
            </div>

            {/* Payment Mode */}
            <div>
              <div className="label">Payment mode</div>
              <div className="flex flex-wrap gap-2">
                {["Online", "Cash", "Both"].map((m) => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => setForm((p) => ({ ...p, mode: m }))}
                    className={`px-3 py-2 rounded-lg border transition ${
                      form.mode === m
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount Inputs */}
            {form.mode === "Online" && (
              <input
                className="input w-full border rounded-lg px-3 py-2"
                type="number"
                placeholder="Online amount (₹)"
                value={form.onlineAmount}
                onChange={handleChange("onlineAmount")}
              />
            )}

            {form.mode === "Cash" && (
              <input
                className="input w-full border rounded-lg px-3 py-2"
                type="number"
                placeholder="Cash amount (₹)"
                value={form.cashAmount}
                onChange={handleChange("cashAmount")}
              />
            )}

            {form.mode === "Both" && (
              <div className="grid gap-2">
                <input
                  className="input w-full border rounded-lg px-3 py-2"
                  type="number"
                  placeholder="Online amount (₹)"
                  value={form.onlineAmount}
                  onChange={handleChange("onlineAmount")}
                />
                <input
                  className="input w-full border rounded-lg px-3 py-2"
                  type="number"
                  placeholder="Cash amount (₹)"
                  value={form.cashAmount}
                  onChange={handleChange("cashAmount")}
                />
              </div>
            )}

            {/* Signature */}
            <div>
              <div className="label mb-1">Receiver Signature</div>
              <div className="border rounded-xl overflow-hidden shadow-sm">
                <SignaturePad
                  ref={sigRef}
                  canvasProps={{
                    className: "sigCanvas bg-white w-full",
                    width: canvasWidth,
                    height: 200,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Signature required.{" "}
                <button type="button" onClick={clearSig} className="underline">
                  Clear
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              className="btn bg-blue-600 text-white w-full rounded-lg py-2 font-medium hover:bg-blue-700 transition"
              type="submit"
            >
              Submit
            </button>
          </form>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
