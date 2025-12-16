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

// optional success sound
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
  // ---------- auth & form state ----------
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

  // calls picker
  const [calls, setCalls] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callSearch, setCallSearch] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);

  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);

  useEffect(() => {
    const updateSize = () => setCanvasWidth(window.innerWidth < 500 ? window.innerWidth - 40 : 500);
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // load calls (unchanged)
  const loadCalls = async () => {
    try {
      setCallsLoading(true);
      const params = new URLSearchParams({ tab: "All Calls", page: "1", pageSize: "50" });
      const r = await fetch("/api/tech/my-calls?" + params.toString(), { cache: "no-store" });
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
      }
    } catch (err) {
      console.error("Calls load error:", err);
    } finally {
      setCallsLoading(false);
    }
  };

  // auth + initial load (unchanged)
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
    try { sigRef.current?.clear(); } catch {}
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

  // ---------- camera strategy ----------
  // We support two flows:
  // 1) Mobile: use hidden <input type="file" accept="image/*" capture="environment"> to open system camera app
  // 2) Desktop / fallback: open in-app camera modal using getUserMedia
  //
  // After capture (either route), image is added to stagedImages where user can mark Done ✓, Retake, Remove.

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraModalOpen, setCameraModalOpen] = useState(false); // for desktop in-app camera
  const [cameraOn, setCameraOn] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // stagedImages: { id, dataUrl, blob (File/Blob), size, status: 'pending'|'done'|'uploaded', capturedAt }
  const [stagedImages, setStagedImages] = useState([]);

  const MAX_FILES = 100;
  const MAX_TOTAL_BYTES = 5 * 1024 * 1024; // 5MB

  // util: detect mobile (simple)
  function isMobile() {
    if (typeof navigator === "undefined") return false;
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // Open camera: decide route
  function openCameraForCapture() {
    // if mobile -> use file input with capture (system camera app)
    if (isMobile()) {
      if (fileInputRef.current) {
        // reset value to allow re-capture
        fileInputRef.current.value = "";
        fileInputRef.current.click();
      } else {
        toast.error("Camera not available");
      }
    } else {
      // desktop -> open in-app camera modal
      openInAppCamera();
    }
  }

  // hidden file input change handler (mobile route)
  async function onFileInputChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    // convert file to dataURL for preview + possibly compress
    try {
      const dataUrl = await fileToDataUrl(file);
      // compress with canvas to try to keep size budget
      const { dataUrl: compressed, blob, size } = await compressDataUrl(dataUrl, file.type);
      addStagedImage(compressed, blob || file, size || (file.size || 0));
      toast.success("Photo captured");
    } catch (err) {
      console.error("onFileInputChange error:", err);
      toast.error("Failed to process captured photo");
    }
  }

  // file -> dataURL
  function fileToDataUrl(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  // compress dataURL: return { dataUrl, blob, size }
  async function compressDataUrl(dataUrl, mime = "image/jpeg", targetPerImage = 40 * 1024) {
    // conservative: aim for small size but keep quality
    try {
      const img = await loadImage(dataUrl);
      const maxWidth = 1400;
      let w = img.width;
      let h = img.height;
      if (w > maxWidth) {
        const scale = maxWidth / w;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      // try quality steps
      for (let q = 0.9; q >= 0.25; q -= 0.07) {
        const out = canvas.toDataURL(mime, q);
        const blob = await (await fetch(out)).blob();
        if (blob.size <= Math.max(12 * 1024, targetPerImage) || q <= 0.25) {
          return { dataUrl: out, blob, size: blob.size };
        }
      }
      // fallback last
      const out = canvas.toDataURL(mime, 0.25);
      const blob = await (await fetch(out)).blob();
      return { dataUrl: out, blob, size: blob.size };
    } catch (err) {
      // if anything fails, return original
      const blob = await (await fetch(dataUrl)).blob();
      return { dataUrl, blob, size: blob.size };
    }
  }

  function loadImage(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
  }

  // add staged image
  function addStagedImage(dataUrl, blob, size) {
    if (stagedImages.length >= MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} images allowed`);
      return;
    }
    const used = stagedImages.reduce((a, s) => a + (s.size || 0), 0);
    if (used + (size || 0) > MAX_TOTAL_BYTES) {
      toast.error("Total images would exceed 5MB. Remove some first.");
      return;
    }
    setStagedImages((p) => [
      ...p,
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        dataUrl,
        blob,
        size,
        status: "pending",
        capturedAt: new Date().toISOString(),
      },
    ]);
  }

  // ---------- In-app camera (desktop) ----------
  async function openInAppCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("Camera not supported in this browser");
      return;
    }
    try {
      // request environment but fallback to default
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        try { await videoRef.current.play(); } catch {}
      }
      setCameraOn(true);
      setCameraModalOpen(true);
    } catch (err) {
      console.error("openInAppCamera error:", err);
      if (err.name === "NotReadableError") {
        toast.error("Camera already in use. Close other apps which use the camera.");
      } else if (err.name === "NotAllowedError") {
        toast.error("Camera permission denied.");
      } else {
        toast.error("Unable to open camera");
      }
    }
  }

  function closeInAppCamera() {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    streamRef.current = null;
    setCameraOn(false);
    setCameraModalOpen(false);
  }

  // capture frame from in-app camera
  async function captureFromInAppCamera() {
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
      const MAX_W = 1600;
      let w = vw, h = vh;
      if (w > MAX_W) {
        const scale = MAX_W / w;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0,0,w,h);
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const { dataUrl: compressed, blob, size } = await compressDataUrl(dataUrl, "image/jpeg", 40 * 1024);
      addStagedImage(compressed, blob, size);
      toast.success("Photo captured");
    } catch (err) {
      console.error("captureFromInAppCamera error:", err);
      toast.error("Capture failed");
    } finally {
      setCapturing(false);
      // keep camera open so user can capture multiple; close only on user's action
    }
  }

  // retake logic: reopen camera route depending on environment
  async function retakeImage(id) {
    // remove the image and reopen capture flow
    setStagedImages((p) => p.filter((s) => s.id !== id));
    // attempt to open camera again
    openCameraForCapture();
  }

  function removeImage(id) {
    setStagedImages((p) => p.filter((s) => s.id !== id));
  }

  function toggleDone(id) {
    setStagedImages((prev) => prev.map((s) => (s.id === id ? { ...s, status: s.status === "done" ? "pending" : "done" } : s)));
  }

  function markAllDone() {
    setStagedImages((p) => p.map((s) => ({ ...s, status: "done" })));
  }
  function uncheckAll() {
    setStagedImages((p) => p.map((s) => ({ ...s, status: "pending" })));
  }

  // ---------- Submit: send only images marked 'done' as multipart files ----------
  async function submit(e) {
    e.preventDefault();

    const imagesToUpload = stagedImages.filter((s) => s.status === "done");
    if (imagesToUpload.length === 0) {
      toast.error("Please mark at least one captured photo as Done ✓ before submitting (sticker upload is required).");
      return;
    }
    const totalBytes = imagesToUpload.reduce((a,s) => a + (s.size || 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      toast.error("Selected photos exceed 5MB total. Remove some images or reduce selection.");
      return;
    }

    try {
      setSubmitting(true);

      const fd = new FormData();
      fd.append("clientName", form.clientName);
      fd.append("address", form.address);
      fd.append("payment", String(form.payment || ""));
      fd.append("phone", form.phone);
      fd.append("status", form.status);
      const signature = form.signature || sigRef.current?.toDataURL();
      if (signature) fd.append("signature", signature);

      // append each blob/file as 'stickers'
      for (let i = 0; i < imagesToUpload.length; i++) {
        const s = imagesToUpload[i];
        // ensure we have a Blob/File
        const blob = s.blob instanceof Blob ? s.blob : await (await fetch(s.dataUrl)).blob();
        // create a filename preserving jpg extension
        const filename = `sticker_${Date.now()}_${i}.jpg`;
        const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
        fd.append("stickers", file);
      }

      const r = await fetch("/api/service-forms/create", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) {
        toast.error(d.message || d.error || "Upload failed");
        setSubmitting(false);
        return;
      }

      // on success: mark uploaded, show overlay, clear uploaded entries after small delay
      setStagedImages((prev) => prev.map((s) => (s.status === "done" ? { ...s, status: "uploaded" } : s)));
      playSuccessSound();
      toast.success("Form submitted successfully");
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 1500);

      setTimeout(() => {
        setStagedImages((prev) => prev.filter((s) => s.status !== "uploaded"));
      }, 900);

      // reset form and close camera
      setForm({ clientName: "", address: "", payment: "", phone: "", status: "Services Done", signature: "" });
      setSelectedCall(null);
      clearSig();
      closeInAppCamera();
    } catch (err) {
      console.error("submit error:", err);
      toast.error("Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  const totalStagedBytes = stagedImages.reduce((a, s) => a + (s.size || 0), 0);
  const totalStagedKB = (totalStagedBytes / 1024).toFixed(1);

  // ---------- Helper UI pieces ----------
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
    return calls.filter((c) => (c.clientName || "").toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q) || (c.address || "").toLowerCase().includes(q));
  }, [calls, callSearch]);

  // ---------- render ----------
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
                <button type="button" onClick={() => setCallModalOpen(true)} className="w-full border rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 flex justify-between">
                  <span className="truncate">{selectedCall ? `${selectedCall.clientName} (${selectedCall.phone})` : "Choose from your assigned calls"}</span>
                  <span className="text-gray-500 text-xs">▾</span>
                </button>
              </div>

              {/* FORM INPUTS */}
              <input className="input border rounded-lg p-2" placeholder="Client Name" value={form.clientName} onChange={(e) => setForm((p) => ({ ...p, clientName: e.target.value }))} required />
              <input className="input border rounded-lg p-2" placeholder="Client Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} required />
              <input className="input border rounded-lg p-2" type="number" placeholder="Payment (₹)" value={form.payment} onChange={(e) => setForm((p) => ({ ...p, payment: e.target.value }))} />
              <input className="input border rounded-lg p-2" placeholder="Phone Number" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} required />
              <select className="input border rounded-lg p-2" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option>Services Done</option>
                <option>Installation Done</option>
                <option>Complaint Done</option>
                <option>Under Process</option>
              </select>

              {/* HIDDEN FILE INPUT (mobile camera app trigger) */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={onFileInputChange}
              />

              {/* CAMERA / STICKER UI */}
              <div className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Upload Sticker</div>
                    <div className="text-xs text-slate-500">
                      Tap Upload → camera app opens (mobile) or in-app camera (desktop). After capture, mark <span className="font-semibold">Done ✓</span> to select images for upload. Sticker upload is <span className="font-semibold">required</span>. Total ≤ 5MB. Max 100 images.
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 text-right">
                    <div>{stagedImages.length} / {MAX_FILES} captured</div>
                    <div>{totalStagedKB} KB</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={openCameraForCapture} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 bg-white text-sm">📷 Upload (Camera)</button>
                  <button type="button" onClick={markAllDone} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-emerald-600 text-white text-sm">Mark All Done</button>
                  <button type="button" onClick={uncheckAll} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-gray-200 text-sm">Uncheck All</button>
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

                {totalStagedBytes > MAX_TOTAL_BYTES && <div className="text-xs text-red-600 mt-1">Total staged images exceed 5MB. Remove or uncheck some images before upload.</div>}
              </div>

              {/* signature */}
              <div>
                <div className="text-sm font-semibold mb-1">Client Signature</div>
                <div className="border rounded-xl overflow-hidden">
                  <SignaturePad ref={sigRef} canvasProps={{ width: canvasWidth, height: 200, className: "sigCanvas w-full" }} />
                </div>
                <div className="text-xs text-gray-500 mt-1">Sign inside the box. <button type="button" onClick={clearSig} className="underline ml-2">Clear</button></div>
              </div>

              <button className="bg-blue-600 text-white font-semibold py-2 rounded-lg mt-2 active:scale-95 disabled:opacity-60" disabled={submitting || totalStagedBytes > MAX_TOTAL_BYTES}>
                {submitting ? "Submitting..." : "Submit"}
              </button>
            </form>
          )}
        </div>
      </main>

      <BottomNav />

      {/* CALL PICKER MODAL */}
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

      {/* In-app camera modal (desktop fallback) */}
      <AnimatePresence>
        {cameraModalOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="w-full max-w-2xl bg-white rounded-2xl p-4" initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}>
              <div className="flex justify-between items-center mb-3">
                <div className="font-semibold">Camera — Capture Sticker</div>
                <div className="flex gap-2">
                  <button onClick={() => { closeInAppCamera(); }} className="px-3 py-1 rounded bg-gray-100">Close</button>
                </div>
              </div>

              <div className="bg-black rounded-lg overflow-hidden">
                <video ref={videoRef} className="w-full h-96 object-cover" playsInline autoPlay />
              </div>

              <div className="mt-3 flex gap-2">
                <button onClick={captureFromInAppCamera} disabled={capturing} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">{capturing ? "Capturing..." : "Capture Photo"}</button>
                <button onClick={() => { closeInAppCamera(); }} className="flex-1 bg-gray-200 py-2 rounded-lg">Done</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* success overlay */}
      <AnimatePresence>
        {showSuccessOverlay && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ scale: 0.7, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.7, opacity: 0, y: 20 }} transition={{ type: "spring", stiffness: 180, damping: 15 }} className="relative bg-white rounded-3xl px-8 py-6 shadow-2xl text-center max-w-xs w-full overflow-hidden">
              <div className="h-14 w-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg text-white text-3xl">✔</div>
              <div className="text-base font-semibold text-gray-900 mt-3">Service Saved Successfully</div>
              <div className="text-xs text-gray-600 mt-1">Client details, signature & photos uploaded. Great job! ✨</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
