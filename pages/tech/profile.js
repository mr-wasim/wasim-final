// pages/tech/profile.js
import { useEffect, useState, useCallback, useRef } from "react";
import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import { motion, AnimatePresence } from "framer-motion";
import Cropper from "react-easy-crop";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { v4 as uuidv4 } from "uuid";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [avatarPublicId, setAvatarPublicId] = useState(null);
  const [calls, setCalls] = useState([]);

  const [mode, setMode] = useState("month");
  const [date, setDate] = useState(new Date());
  const [totalCalls, setTotalCalls] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [display, setDisplay] = useState(0);

  /* crop */
  const [cropOpen, setCropOpen] = useState(false);
  const [img, setImg] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPx, setCropPx] = useState(null);
  const inputRef = useRef();

  /* upload */
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  /* toast */
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/auth/me", { credentials: "same-origin" });
      if (!me.ok) return (window.location.href = "/login");
      const u = await me.json();
      if (u.role !== "technician") return (window.location.href = "/login");
      setUser(u);
      setAvatar(u.avatar || null);
      setAvatarPublicId(u.avatarPublicId || null);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/tech/my-calls?pageSize=1000", { credentials: "same-origin" });
        const d = await r.json();
        setCalls(d.items || []);
      } catch {
        setCalls([]);
      }
    })();
  }, []);

  useEffect(() => {
    let from, to;
    const d = new Date(date);
    if (mode === "day") {
      from = new Date(d); from.setHours(0,0,0,0);
      to = new Date(d); to.setHours(23,59,59,999);
    } else if (mode === "week") {
      from = startOfWeek(d, { weekStartsOn: 1 }); to = endOfWeek(d, { weekStartsOn: 1 });
    } else if (mode === "month") {
      from = startOfMonth(d); to = endOfMonth(d);
    } else { from = new Date(0); to = new Date(); }

    const filtered = calls.filter(c => {
      const cd = new Date(c.createdAt);
      return cd >= from && cd <= to;
    });

    const t = filtered.length;
    const e = t * 100;

    setTotalCalls(t);
    setEarnings(e);
    animateCount(e);
  }, [mode, date, calls]);

  function animateCount(target) {
    let cur = 0;
    const step = Math.max(1, Math.floor(target / 30));
    const i = setInterval(() => {
      cur += step;
      if (cur >= target) { setDisplay(target); clearInterval(i); } else setDisplay(cur);
    }, 18);
  }

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCropPx(croppedAreaPixels);
  }, []);

  function showToast(type, message, timeout = 3500) {
    setToast({ type, message });
    setTimeout(() => setToast(null), timeout);
  }

  async function saveImage() {
    if (!cropPx || !img) {
      showToast("error", "No image selected");
      return;
    }

    const prevAvatar = avatar;
    const prevPublicId = avatarPublicId;

    try {
      const canvas = document.createElement("canvas");
      const image = new Image();
      image.src = img;
      await image.decode();

      canvas.width = cropPx.width;
      canvas.height = cropPx.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(image, cropPx.x, cropPx.y, cropPx.width, cropPx.height, 0, 0, cropPx.width, cropPx.height);

      const blob = await new Promise(res => canvas.toBlob(res, "image/jpeg", 0.85));
      const file = new File([blob], `avatar-${uuidv4()}.jpg`, { type: "image/jpeg" });

      // optimistic local preview
      const localUrl = URL.createObjectURL(file);
      setAvatar(localUrl);

      // upload via XHR for progress and cookie sending
      setUploading(true);
      setProgress(0);

      const fd = new FormData();
      fd.append("file", file);

      const uploadText = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload", true);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
          else reject(new Error("Upload failed with status " + xhr.status));
        };

        xhr.onerror = (err) => reject(err || new Error("XHR upload error"));
        xhr.send(fd);
      });

      const uploadData = JSON.parse(uploadText);

      // Save profile (server updates DB and re-issues JWT cookie)
      const patchResp = await fetch("/api/tech/profile", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatar: uploadData.url,
          avatarPublicId: uploadData.public_id,
        }),
      });

      if (!patchResp.ok) {
        const text = await patchResp.text().catch(() => "Profile patch failed");
        throw new Error(text || "Profile patch failed");
      }

      const patchJson = await patchResp.json().catch(() => null);
      if (patchJson && patchJson.user) {
        setUser(patchJson.user);
        setAvatar(patchJson.user.avatar || null);
        setAvatarPublicId(patchJson.user.avatarPublicId || null);
      } else {
        // fallback: refetch /api/auth/me (token cookie should now be set)
        const me = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (me.ok) {
          const fresh = await me.json();
          setUser(fresh);
          setAvatar(fresh.avatar || null);
          setAvatarPublicId(fresh.avatarPublicId || null);
        } else {
          setAvatar(uploadData.url);
          setAvatarPublicId(uploadData.public_id || null);
        }
      }

      setUploading(false);
      setProgress(0);
      setCropOpen(false);
      setImg(null);
      setCropPx(null);
      if (inputRef.current) inputRef.current.value = "";

      showToast("success", "Profile picture successfully uploaded");
    } catch (err) {
      console.error("saveImage error", err);
      setUploading(false);
      setProgress(0);
      setAvatar(prevAvatar);
      setAvatarPublicId(prevPublicId);
      showToast("error", "Upload failed. Try again.");
    }
  }

  async function handleDeleteAvatar() {
    if (!confirm("Are you sure you want to remove your avatar?")) return;

    const prevAvatar = avatar;
    const prevPublicId = avatarPublicId;

    try {
      setAvatar(null);
      setAvatarPublicId(null);

      const resp = await fetch("/api/tech/delete-avatar", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: prevPublicId }),
      });

      if (!resp.ok) throw new Error("delete failed");

      const json = await resp.json().catch(() => null);
      if (json && json.user) {
        setUser(json.user);
        setAvatar(json.user.avatar || null);
        setAvatarPublicId(json.user.avatarPublicId || null);
      } else {
        const me = await fetch("/api/auth/me", { credentials: "same-origin" });
        if (me.ok) {
          const fresh = await me.json();
          setUser(fresh);
          setAvatar(fresh.avatar || null);
          setAvatarPublicId(fresh.avatarPublicId || null);
        }
      }

      showToast("success", "Profile picture removed");
    } catch (err) {
      console.error("delete avatar error", err);
      setAvatar(prevAvatar);
      setAvatarPublicId(prevPublicId);
      showToast("error", "Could not delete avatar. Try again.");
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-white pb-24">
      <Header user={user} />
      <main className="max-w-3xl mx-auto p-4 space-y-8">
        <section className="flex flex-col items-center text-center pt-6">
          <div className="relative">
            <div className="w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-400 shadow-lg">
              <div className="w-full h-full rounded-full bg-white overflow-hidden">
                {avatar ? <img src={avatar} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-gray-400 select-none"><span className="text-sm">NO PHOTO</span></div>}
              </div>
            </div>

            <div className="absolute bottom-0 right-0 flex gap-2">
              <button onClick={() => document.getElementById("img").click()} className="bg-white rounded-full px-3 py-1 text-xs shadow">Edit</button>
              {avatar && <button onClick={handleDeleteAvatar} className="bg-white rounded-full px-3 py-1 text-xs shadow">Remove</button>}
            </div>

            <input id="img" ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImg(URL.createObjectURL(file));
              setCropOpen(true);
            }} />
          </div>

          <h1 className="mt-4 text-2xl font-bold flex items-center gap-2">
            <span>{user.username}</span>
            <span title="Verified" className="inline-flex items-center"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden><circle cx="12" cy="12" r="10" fill="#1D9BF0" /><path d="M10.3 14.3l-2.1-2.1-1.4 1.4 3.5 3.5 7-7-1.4-1.4z" fill="#fff" /></svg></span>
          </h1>
          <p className="text-sm text-gray-500">Professional Service Technician</p>

          <div className="mt-6 w-full flex justify-around">
            <Stat label="Calls" value={calls.length} />
            <Stat label="Earnings" value={`₹${earnings}`} />
            <Stat label="Rating" value="⭐ 4.9" />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-lg">Earnings</h2>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="border rounded-lg px-3 py-1 bg-white"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="lifetime">Life Time</option></select>
          </div>

          <div className="rounded-3xl p-7 bg-gradient-to-tr from-fuchsia-500 via-pink-500 to-orange-400 text-white shadow-xl">
            <div className="text-center">
              <div className="text-sm opacity-90">Total Earnings</div>
              <div className="text-5xl font-extrabold mt-2 tracking-wide">₹{display}</div>
              <div className="mt-2 text-sm opacity-90">{totalCalls} calls × ₹100</div>
            </div>
          </div>
        </section>
      </main>
      <BottomNav />

      {/* CROP MODAL */}
      <AnimatePresence>{cropOpen && <motion.div className="fixed inset-0 bg-black/60 z-50 grid place-items-center"><motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }} className="bg-white p-4 rounded-2xl w-full max-w-2xl"><div style={{ position: "relative", width: "100%", height: 420 }}><Cropper image={img} crop={crop} zoom={zoom} aspect={1} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} /></div><div className="mt-4 flex gap-3 items-center"><input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} /><div className="ml-auto flex gap-2"><button onClick={() => { setCropOpen(false); setImg(null); if (inputRef.current) inputRef.current.value = ""; }} className="px-4 py-2 rounded bg-gray-100">Cancel</button><button onClick={saveImage} className="px-6 py-2 rounded bg-black text-white">Save</button></div></div></motion.div></motion.div>}</AnimatePresence>

      {/* UPLOAD OVERLAY */}
      <AnimatePresence>{uploading && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-60 grid place-items-center bg-black/50"><div className="bg-white rounded-xl p-6 w-80 text-center shadow-xl"><div className="mb-4"><svg className="mx-auto animate-spin" width="36" height="36" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" stroke="#eee" strokeWidth="4" fill="none"/><path d="M45 25a20 20 0 0 1-20 20" stroke="#111" strokeWidth="4" strokeLinecap="round" /></svg></div><div className="font-semibold mb-2">Updating profile</div><div className="text-sm text-gray-500 mb-4">Please wait — uploading profile picture</div><div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden"><div style={{ width: `${progress}%` }} className="h-full rounded-full transition-all bg-gradient-to-r from-green-400 via-yellow-300 to-orange-400" /></div><div className="mt-3 text-sm">{progress}%</div></div></motion.div>}</AnimatePresence>

      {/* TOAST */}
      <AnimatePresence>{toast && <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} className={`fixed left-1/2 transform -translate-x-1/2 top-6 z-70`}><div className={`px-4 py-3 rounded-md text-sm font-medium shadow-lg ${toast.type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>{toast.message}</div></motion.div>}</AnimatePresence>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-semibold text-lg">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
