import Header from "../../components/Header";
import BottomNav from "../../components/BottomNav";
import SignaturePad from "react-signature-canvas";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function Payments(){
  const [user,setUser]=useState(null);
  const [form,setForm]=useState({ 
    receiver:'', 
    mode:'', 
    onlineAmount:0, 
    cashAmount:0, 
    receiverSignature:'' 
  });
  const sigRef = useRef();
  const [canvasWidth, setCanvasWidth] = useState(500);

  // ✅ Responsive SignaturePad width
  useEffect(()=>{
    function updateSize(){
      if(window.innerWidth < 640){ 
        setCanvasWidth(window.innerWidth - 40); 
      } else {
        setCanvasWidth(500);
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return ()=>window.removeEventListener("resize", updateSize);
  },[]);

  // ✅ User check
  useEffect(()=>{
    (async ()=>{
      const me = await fetch('/api/auth/me');
      if(!me.ok){ window.location.href='/login'; return; }
      const u = await me.json(); 
      if(u.role!=='technician'){ window.location.href='/login'; return; } 
      setUser(u);
    })();
  },[]);

  function clearSig(){ 
    sigRef.current?.clear(); 
    setForm({...form, receiverSignature:''}); 
  }

  // ✅ Submit form
  async function submit(e){
    e.preventDefault();
    const receiverSignature = form.receiverSignature || sigRef.current?.toDataURL();
    if(!receiverSignature){ toast.error('Receiver signature required'); return; }
    if(!form.receiver){ toast.error('Please enter paying name'); return; }

    const r = await fetch('/api/tech/payment', { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify({...form, receiverSignature}) 
    });

    const d = await r.json();
    if(!r.ok){ toast.error(d.error||'Failed'); return; }
    toast.success('Payment recorded');
    setForm({ receiver:'', mode:'', onlineAmount:0, cashAmount:0, receiverSignature:'' });
    clearSig();
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
                onChange={e=>setForm({...form, receiver:e.target.value})} 
              />
            </div>

            {/* Payment Mode */}
            <div>
              <div className="label">Payment mode</div>
              <div className="flex flex-wrap gap-2">
                {["Online","Cash","Both"].map(m=>(
                  <button 
                    type="button" 
                    key={m}
                    onClick={()=>setForm({...form,mode:m})} 
                    className={`btn ${form.mode===m ? 'bg-blue-600 text-white':'bg-gray-100'}`}
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
                onChange={e=>setForm({...form,onlineAmount:Number(e.target.value)})} 
              />
            )}

            {form.mode === "Cash" && (
              <input 
                className="input w-full" 
                type="number" 
                placeholder="Cash amount (₹)" 
                value={form.cashAmount} 
                onChange={e=>setForm({...form,cashAmount:Number(e.target.value)})} 
              />
            )}

            {form.mode === "Both" && (
              <div className="grid gap-2">
                <input 
                  className="input w-full" 
                  type="number" 
                  placeholder="Online amount (₹)" 
                  value={form.onlineAmount} 
                  onChange={e=>setForm({...form,onlineAmount:Number(e.target.value)})} 
                />
                <input 
                  className="input w-full" 
                  type="number" 
                  placeholder="Cash amount (₹)" 
                  value={form.cashAmount} 
                  onChange={e=>setForm({...form,cashAmount:Number(e.target.value)})} 
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
                    className:'sigCanvas w-full',
                    width: canvasWidth,
                    height: 200,
                  }} 
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Signature required. <button type="button" onClick={clearSig} className="underline">Clear</button>
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
