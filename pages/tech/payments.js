"use client";
export const dynamic = "force-dynamic"; // ✅ prevent Next.js static build errors

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function Payments() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    receiver: "",
    mode: "",
    onlineAmount: "",
    cashAmount: "",
    receiverSignature: "",
  });
  const sigRef = useRef();
  const [canvasWidth, setCanvasWidth] = useState(500);
  const [deviceToken, setDeviceToken] = useState(null);

  // ✅ Responsive SignaturePad width
  useEffect(() => {
    function updateSize() {
      if (typeof window !== "undefined") {
        setCanvasWidth(window.innerWidth < 640 ? window.innerWidth - 40 : 500);
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ✅ Get logged-in user
  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/auth/me");
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
        console.error("User fetch error:", err);
      }
    })();
  }, []);

  // ✅ Firebase Push Notification setup (lazy-load only on client)
  useEffect(() => {
    if (typeof window === "undefined") return; // ✅ skip on server

    (async () => {
      try {
        const { getToken, onMessage } = await import("firebase/messaging");
        const { messaging } = await import("../../utils/firebase");

        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          try {
            const token = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
            });
            if (token) {
              console.log("✅ FCM Token:", token);
              setDeviceToken(token);
              await fetch("/api/save-fcm-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
              });
            }
          } catch (err) {
            console.error("FCM Token Error:", err);
          }
        } else {
          console.warn("❌ Notification permission denied");
        }

        // Foreground message listener
        onMessage(messaging, (payload) => {
          console.log("📩 Foreground message:", payload);
          toast.custom(
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
              📢 {payload.notification?.title || "New Notification"} <br />
              {payload.notification?.body}
            </div>
          );
        });
      } catch (err) {
        console.error("Firebase Messaging Error:", err);
      }
    })();
  }, []);

  // ✅ Clear signature
  function clearSig() {
    sigRef.current?.clear();
    setForm({ ...form, receiverSignature: "" });
  }

  // ✅ Submit form
  async function submit(e) {
    e.preventDefault();
    const receiverSignature = form.receiverSignature || sigRef.current?.toDataURL();

    if (!receiverSignature) {
      toast.error("Receiver signature required");
      return;
    }
    if (!form.receiver) {
      toast.error("Please enter paying name");
      return;
    }

    try {
      const r = await fetch("/api/tech/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, receiverSignature }),
      });

      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Failed");
        return;
      }

      toast.success("Payment recorded ✅");

      // ✅ Send notification to Admin
      await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Payment Recorded",
          body: `${form.receiver} paid via ${form.mode}`,
        }),
      });

      setForm({
        receiver: "",
        mode: "",
        onlineAmount: 0,
        cashAmount: 0,
        receiverSignature: "",
      });
      clearSig();
    } catch (err) {
      console.error("Payment submission failed:", err);
      toast.error("Error recording payment");
    }
  }

  return (
    <div className="pb-20">
      <Header user={user} />
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <div>💳</div>
            <div className="font-semibold">Payment Mode</div>
          </div>

          <form onSubmit={submit} className="grid gap-3">
            {/* Receiver */}
            <div>
              <div className="label">Who are you paying to?</div>
              <input
                className="input w-full"
                placeholder="Paying name"
                value={form.receiver}
                onChange={(e) => setForm({ ...form, receiver: e.target.value })}
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
                    onClick={() => setForm({ ...form, mode: m })}
                    className={`btn ${
                      form.mode === m
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100"
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
                className="input w-full"
                type="number"
                placeholder="Online amount (₹)"
                value={form.onlineAmount}
                onChange={(e) =>
                  setForm({ ...form, onlineAmount: Number(e.target.value) })
                }
              />
            )}

            {form.mode === "Cash" && (
              <input
                className="input w-full"
                type="number"
                placeholder="Cash amount (₹)"
                value={form.cashAmount}
                onChange={(e) =>
                  setForm({ ...form, cashAmount: Number(e.target.value) })
                }
              />
            )}

            {form.mode === "Both" && (
              <div className="grid gap-2">
                <input
                  className="input w-full"
                  type="number"
                  placeholder="Online amount (₹)"
                  value={form.onlineAmount}
                  onChange={(e) =>
                    setForm({ ...form, onlineAmount: Number(e.target.value) })
                  }
                />
                <input
                  className="input w-full"
                  type="number"
                  placeholder="Cash amount (₹)"
                  value={form.cashAmount}
                  onChange={(e) =>
                    setForm({ ...form, cashAmount: Number(e.target.value) })
                  }
                />
              </div>
            )}

            {/* Signature */}
            <div>
              <div className="label mb-1">Receiver Signature</div>
              <div className="border rounded-xl overflow-hidden">
                <SignaturePad
                  ref={sigRef}
                  canvasProps={{
                    className: "sigCanvas w-full",
                    width: canvasWidth,
                    height: 200,
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Signature required.{" "}
                <button
                  type="button"
                  onClick={clearSig}
                  className="underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Submit */}
            <button className="btn bg-blue-600 text-white w-full">Submit</button>
          </form>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
