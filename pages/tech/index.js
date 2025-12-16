"use client";

import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  useMemo,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

// SUCCESS SOUND (optional)
const successSound =
  typeof window !== "undefined" ? new Audio("/forward.mp3") : null;

function playSuccessSound() {
  try {
    if (!successSound) return;
    successSound.currentTime = 0;
    successSound.play().catch(() => {});
  } catch {}
}

export default function TechHome() {
  // ---------- Auth / general ----------
  const [user, setUser] = useState(null);
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    clientName: "",
    address: "",
    payment: "",
    phone: "",
    status: "Services Done",
    signature: "",
  });

  const sigRef = useRef();
  const [canvasWidth, setCanvasWidth] = useState(500);

  // Calls modal / picker
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);

  // Success overlay
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  // Responsive canvas
  useEffect(() => {
    const updateSize = () =>
      setCanvasWidth(window.innerWidth < 500 ? window.innerWidth - 40 : 500);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // ---------- Load calls ----------
  const loadCalls = async () => {
    try {
      setCallsLoading(true);
      const qs = new URLSearchParams({ tab: "All Calls", page: "1", pageSize: "50" });
      const r = await fetch("/api/tech/my-calls?" + qs.toString(), { cache: "no-store" });
      const d = await r.json();
      if (d?.success && Array.isArray(d.items)) {
        const mapped = d.items.map((i) => ({
          _id: i._id || i.id || "",
          clientName: i.clientName ?? i.customerName ?? i.name ?? i.fullName ?? "",
          phone: i.phone ?? "",
          address: i.address ?? "",
          type: i.type ?? "",
          price: i.price ?? 0,
          status: i.status ?? "Pending",
          createdAt: i.createdAt ?? "",
          timeZone: i.timeZone ?? "",
          notes: i.notes ?? "",
        }));
        setCalls(mapped);
      } else {
        console.warn("No calls found");
      }
    } catch (err) {
      console.error("Calls load error:", err);
    } finally {
      setCallsLoading(false);
    }
  };

  // ---------- Auth + initial load ----------
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
        loadCalls();
      } catch {
        window.location.href = "/login";
      }
    })();
  }, []);

  function clearSig() {
    try {
      sigRef.current?.clear();
    } catch {}
    setForm((p) => ({ ...p, signature: "" }));
  }

  function handleSelectCall(call) {
    if (!call) return;
    startTransition(() => {
      setSelectedCall(call);
      setForm((prev) => ({
        ...prev,
        clientName: call.clientName || "",
        address: call.address || "",
        phone: call.phone || "",
        payment: call.price ?? "",
      }));
      setCallModalOpen(false);
    });
  }

  // ---------- CAMERA-ONLY professional workflow ----------
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // Staging area: images captured but not yet "done"
  // Each item: { id, dataUrl, size, status: "pending"|"done"|"uploaded", capturedAt }
  const [stagedImages, setStagedImages] = useState([]);

  const MAX_FILES = 100;
  const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5 MB cap

  // Start camera
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Camera not supported in this browser");
      return;
    }
    try {
      let stream;
      try {
        // try rear camera (mobile)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // fallback default camera (PC)
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch {}
      }
      setCameraOn(true);
    } catch (err) {
      console.error("startCamera error:", err);
      if (err.name === "NotReadableError") {
        toast.error("Camera already in use. Close other apps using camera.");
      } else if (err.name === "NotAllowedError") {
        toast.error("Camera permission denied. Please allow camera access.");
      } else {
        toast.error("Unable to open camera");
      }
    }
  }

  // Stop camera
  function stopCamera() {
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    setCameraOn(false);
  }

  useEffect(() => {
    return () => {
      try {
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  // util: dataURL -> Blob and size
  async function dataURLToBlob(dataUrl) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return blob;
  }

  // compress canvas to target (same logic as before but simpler)
  async function compressCanvasToTarget(canvas, targetSizeBytes) {
    for (let q = 0.9; q >= 0.25; q -= 0.07) {
      const data = canvas.toDataURL("image/jpeg", q);
      const size = (await dataURLToBlob(data)).size;
      if (size <= targetSizeBytes || q <= 0.25) {
        return { dataUrl: data, size };
      }
    }
    let w = canvas.width;
    let h = canvas.height;
    for (let attempt = 0; attempt < 5; attempt++) {
      w = Math.max(200, Math.round(w * 0.8));
      h = Math.max(200, Math.round(h * 0.8));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(canvas, 0, 0, w, h);
      for (let q = 0.6; q >= 0.25; q -= 0.07) {
        const data = c.toDataURL("image/jpeg", q);
        const size = (await dataURLToBlob(data)).size;
        if (size <= targetSizeBytes || q <= 0.25) {
          return { dataUrl: data, size };
        }
      }
    }
    const fallback = canvas.toDataURL("image/jpeg", 0.25);
    return { dataUrl: fallback, size: (await dataURLToBlob(fallback)).size };
  }

  // Capture
  async function capturePhoto() {
    if (!videoRef.current) return;
    if (stagedImages.length >= MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} images allowed`);
      return;
    }

    setCapturing(true);
    try {
      const video = videoRef.current;
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      const MAX_WIDTH = 1600;
      let targetW = vw;
      let targetH = vh;
      if (targetW > MAX_WIDTH) {
        const scale = MAX_WIDTH / targetW;
        targetW = Math.round(targetW * scale);
        targetH = Math.round(targetH * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(video, 0, 0, targetW, targetH);

      const usedBytes = stagedImages.reduce((a, s) => a + (s.size || 0), 0);
      const remainingBudget = Math.max(2000, MAX_TOTAL_BYTES - usedBytes);
      const remainingSlots = Math.max(1, MAX_FILES - stagedImages.length);
      const perImageTarget = Math.max(6 * 1024, Math.floor(remainingBudget / remainingSlots));

      const { dataUrl, size } = await compressCanvasToTarget(canvas, perImageTarget);

      const newTotal = usedBytes + size;
      if (newTotal > MAX_TOTAL_BYTES) {
        // try more aggressive approach
        let resizedW = Math.max(200, Math.round(targetW * 0.6));
        let resizedH = Math.max(200, Math.round(targetH * 0.6));
        let finalData = null;
        let finalSize = null;
        for (let attempt = 0; attempt < 5; attempt++) {
          const c2 = document.createElement("canvas");
          c2.width = resizedW;
          c2.height = resizedH;
          const ctx2 = c2.getContext("2d");
          ctx2.fillStyle = "#fff";
          ctx2.fillRect(0, 0, resizedW, resizedH);
          ctx2.drawImage(video, 0, 0, resizedW, resizedH);
          const out = await compressCanvasToTarget(c2, Math.max(1000, Math.floor(MAX_TOTAL_BYTES - usedBytes)));
          finalData = out.dataUrl;
          finalSize = out.size;
          if (usedBytes + finalSize <= MAX_TOTAL_BYTES) break;
          resizedW = Math.max(200, Math.round(resizedW * 0.7));
          resizedH = Math.max(200, Math.round(resizedH * 0.7));
        }
        if (!finalData || usedBytes + finalSize > MAX_TOTAL_BYTES) {
          toast.error("Cannot add photo — 5MB total limit would be exceeded. Remove some images first.");
          setCapturing(false);
          return;
        }
        setStagedImages((p) => [
          ...p,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            dataUrl: finalData,
            size: finalSize,
            status: "pending",
            capturedAt: new Date().toISOString(),
          },
        ]);
        toast.success("Photo captured (compressed)");
      } else {
        setStagedImages((p) => [
          ...p,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            dataUrl,
            size,
            status: "pending",
            capturedAt: new Date().toISOString(),
          },
        ]);
        toast.success("Photo captured");
      }
    } catch (err) {
      console.error("capturePhoto error:", err);
      toast.error("Failed to capture photo");
    } finally {
      setCapturing(false);
    }
  }

  // Toggle Done
  function toggleDone(id) {
    setStagedImages((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: s.status === "done" ? "pending" : "done" } : s))
    );
  }

  // Remove image
  function removeImage(id) {
    setStagedImages((prev) => prev.filter((s) => s.id !== id));
  }

  // Retake
  async function retakeImage(id) {
    removeImage(id);
    await startCamera();
    toast("Camera opened — capture new photo to replace");
  }

  function markAllDone() {
    setStagedImages((prev) => prev.map((s) => ({ ...s, status: "done" })));
  }

  function uncheckAll() {
    setStagedImages((prev) => prev.map((s) => ({ ...s, status: "pending" })));
  }

  // ---------- SUBMIT (multipart with files using multer on backend) ----------
  async function submit(e) {
    e.preventDefault();

    // require at least one "done" image
    const imagesToUpload = stagedImages.filter((s) => s.status === "done");
    if (imagesToUpload.length === 0) {
      toast.error("Please mark at least one captured photo as Done ✓ before submitting (sticker upload is required).");
      return;
    }

    // check total size
    const totalUploadBytes = imagesToUpload.reduce((a, s) => a + (s.size || 0), 0);
    if (totalUploadBytes > MAX_TOTAL_BYTES) {
      toast.error("Selected photos exceed 5MB total. Remove some images or reduce selection.");
      return;
    }

    try {
      setSubmitting(true);

      // prepare FormData
      const fd = new FormData();
      fd.append("clientName", form.clientName);
      fd.append("address", form.address);
      fd.append("payment", String(form.payment || ""));
      fd.append("phone", form.phone);
      fd.append("status", form.status);
      // signature (base64) if present
      const signature = form.signature || sigRef.current?.toDataURL();
      if (signature) fd.append("signature", signature);

      // convert each dataUrl -> File and append as 'stickers'
      for (let i = 0; i < imagesToUpload.length; i++) {
        const img = imagesToUpload[i];
        const response = await fetch(img.dataUrl);
        const blob = await response.blob();
        // generate a filename
        const filename = `sticker_${Date.now()}_${i}.jpg`;
        const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
        fd.append("stickers", file);
      }

      // send multipart request (do NOT set Content-Type — browser will set boundary)
      const r = await fetch("/api/tech/submit-form", {
        method: "POST",
        body: fd,
      });

      const d = await r.json();
      if (!r.ok) {
        toast.error(d.error || "Upload failed");
        setSubmitting(false);
        return;
      }

      // success
      playSuccessSound();
      toast.success("Form submitted successfully");

      // mark uploaded images in UI briefly
      setStagedImages((prev) => prev.map((s) => (s.status === "done" ? { ...s, status: "uploaded" } : s)));
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1400);

      // clear uploaded images after short delay
      setTimeout(() => {
        setStagedImages((prev) => prev.filter((s) => s.status !== "uploaded"));
      }, 900);

      // clear form and stop camera
      setForm({
        clientName: "",
        address: "",
        payment: "",
        phone: "",
        status: "Services Done",
        signature: "",
      });
      setSelectedCall(null);
      clearSig();
      stopCamera();
    } catch (err) {
      console.error("submit error:", err);
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const totalStagedBytes = stagedImages.reduce((a, s) => a + (s.size || 0), 0);
  const totalStagedKB = (totalStagedBytes / 1024).toFixed(1);

  // ---------- Skeleton & filteredCalls ----------
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

  const filteredCalls = useMemo(() => {
    if (!callSearch.trim()) return calls;
    const q = callSearch.toLowerCase();
    return calls.filter(
      (c) =>
        (c.clientName || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
    );
  }, [calls, callSearch]);

  // ========= RENDER =========
  return (
    <div className="pb-16">
      <Header user={user} />

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="card shadow-md p-4 rounded-2xl border border-gray-100 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div>📝</div>
            <div className="font-semibold text-lg">Service Form</div>
          </div>

          {loading ? (
            <Skeleton />
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              {/* SELECT CALL */}
              <div className="space-y-1">
                <div className="text-sm font-semibold text-gray-700">Select Call (Auto-fill)</div>
                <button
                  type="button"
                  onClick={() => setCallModalOpen(true)}
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex justify-between"
                >
                  <span className="truncate">
                    {selectedCall ? `${selectedCall.clientName} (${selectedCall.phone})` : "Choose from your assigned calls"}
                  </span>
                  <span className="text-gray-500 text-xs">▾</span>
                </button>
              </div>

              {/* FORM INPUTS */}
              <input
                className="input border rounded-lg p-2"
                placeholder="Client Name"
                value={form.clientName}
                onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))}
                required
              />

              <input
                className="input border rounded-lg p-2"
                placeholder="Client Address"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                required
              />

              <input
                className="input border rounded-lg p-2"
                type="number"
                placeholder="Payment (₹)"
                value={form.payment}
                onChange={(e) => setForm((p) => ({ ...p, payment: e.target.value }))}
              />

              <input
                className="input border rounded-lg p-2"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                required
              />

              <select
                className="input border rounded-lg p-2"
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              >
                <option>Services Done</option>
                <option>Installation Done</option>
                <option>Complaint Done</option>
                <option>Under Process</option>
              </select>

              {/* CAMERA-ONLY STICKER SECTION */}
              <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Upload Sticker</div>
                    <div className="text-xs text-slate-500">
                      Capture photos from camera only. After capturing, mark <span className="font-semibold">Done ✓</span> for images you want to upload. Sticker upload is <span className="font-semibold">required</span>. Total compressed upload ≤ 5MB. Max 100 images.
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 text-right">
                    <div>{stagedImages.length} / {MAX_FILES} captured</div>
                    <div>{totalStagedKB} KB total</div>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  {!cameraOn ? (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-white text-sm"
                    >
                      📷 Open Camera
                    </button>
                  ) : (
                    <>
                      <div className="w-full">
                        <video ref={videoRef} className="w-full rounded-lg bg-black" playsInline />
                      </div>
                      <div className="flex gap-2 w-full">
                        <button
                          type="button"
                          onClick={capturePhoto}
                          disabled={capturing}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-blue-600 text-white text-sm"
                        >
                          {capturing ? "Capturing..." : "Capture Photo"}
                        </button>
                        <button
                          type="button"
                          onClick={stopCamera}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-white text-sm"
                        >
                          Close Camera
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={markAllDone} className="text-sm px-3 py-1 rounded bg-emerald-600 text-white">Mark All Done</button>
                  <button type="button" onClick={uncheckAll} className="text-sm px-3 py-1 rounded bg-gray-200">Uncheck All</button>
                  <div className="text-xs text-slate-500 ml-auto">Selected to upload: <span className="font-semibold">{stagedImages.filter(s => s.status === "done").length}</span></div>
                </div>

                {/* thumbnails */}
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {stagedImages.map((s) => (
                    <div key={s.id} className="relative rounded-lg overflow-hidden border border-slate-200 bg-white">
                      <img src={s.dataUrl} alt="staged" className="w-full h-24 object-cover" />
                      <div className="p-1 text-[11px] text-slate-600 flex items-center justify-between">
                        <div className="truncate">Photo</div>
                        <div className="text-xs">{((s.size || 0)/1024).toFixed(1)} KB</div>
                      </div>

                      <div className="p-1 flex items-center gap-1">
                        <label className="inline-flex items-center gap-1 text-xs">
                          <input type="checkbox" checked={s.status === "done"} onChange={() => toggleDone(s.id)} />
                          <span>Done</span>
                        </label>

                        <button type="button" onClick={() => retakeImage(s.id)} className="text-xs ml-auto px-1 py-0.5 rounded bg-yellow-100">Retake</button>
                        <button type="button" onClick={() => removeImage(s.id)} className="text-xs px-1 py-0.5 rounded bg-red-100">Remove</button>
                      </div>

                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[11px] px-1 rounded">
                        {s.status === "uploaded" ? "Uploaded" : s.status === "done" ? "Done" : "Pending"}
                      </div>
                    </div>
                  ))}
                </div>

                {totalStagedBytes > MAX_TOTAL_BYTES && (
                  <div className="text-xs text-red-600 mt-1">
                    Total staged images exceed 5MB. Remove some or uncheck some before uploading.
                  </div>
                )}
              </div>

              {/* SIGNATURE PAD */}
              <div>
                <div className="text-sm font-semibold mb-1">Client Signature</div>
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
                  <button type="button" onClick={clearSig} className="underline ml-2">Clear</button>
                </div>
              </div>

              <button
                className="bg-blue-600 text-white font-semibold py-2 rounded-lg mt-2 active:scale-95 disabled:opacity-60"
                disabled={submitting || totalStagedBytes > MAX_TOTAL_BYTES}
              >
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </form>
          )}
        </div>
      </main>

      <BottomNav />

      {/* CALL SELECTION MODAL */}
      <AnimatePresence>
        {callModalOpen && (
          <motion.div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-4 max-h-[80vh] flex flex-col" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className="flex justify-between mb-3">
                <h2 className="font-semibold">Select Call</h2>
                <button onClick={() => setCallModalOpen(false)} className="text-gray-500 hover:text-black text-lg">✕</button>
              </div>

              <input className="border rounded-lg px-3 py-2 mb-2 text-sm" placeholder="Search by name / phone / address" value={callSearch} onChange={(e) => setCallSearch(e.target.value)} />

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {callsLoading && <div className="text-center text-gray-500 py-4 text-sm">Loading calls...</div>}

                {!callsLoading && filteredCalls.map((c) => (
                  <button key={c._id} type="button" onClick={() => handleSelectCall(c)} className="w-full border rounded-xl px-3 py-2 text-sm hover:bg-blue-50 text-left transition">
                    <div className="font-semibold">{c.clientName}</div>
                    <div className="text-xs text-gray-600">{c.phone}</div>
                    <div className="text-xs text-gray-500">{c.address}</div>
                    <div className="text-[11px] text-gray-400">{c.type} • ₹{c.price}</div>
                  </button>
                ))}

                {!callsLoading && filteredCalls.length === 0 && <div className="text-center text-gray-500 py-4 text-sm">No calls found.</div>}
              </div>

              <button onClick={() => setCallModalOpen(false)} className="mt-3 bg-gray-900 text-white py-2 rounded-xl text-sm">Close</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUCCESS OVERLAY */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.7, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.7, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 180, damping: 15 }} className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-xs w-full overflow-hidden">
              <div className="pointer-events-none absolute -top-10 -left-10 h-24 w-24 bg-blue-100 rounded-full opacity-70" />
              <div className="pointer-events-none absolute -bottom-12 -right-6 h-28 w-28 bg-emerald-100 rounded-full opacity-70" />

              <div className="relative z-10 flex flex-col items-center gap-2">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 220, delay: 0.05 }} className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
                  <span className="text-white text-3xl">✔</span>
                </motion.div>
                <div className="text-base font-semibold text-gray-900">Service Saved Successfully</div>
                <div className="text-xs text-gray-600">Client details, signature & photos uploaded. Great job! ✨</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
