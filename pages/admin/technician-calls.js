'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import Header from '../../components/Header';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers,
  FiUser,
  FiFilter,
  FiCalendar,
  FiRefreshCw,
  FiPhoneCall,
  FiDollarSign,
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';

// small helpers unchanged
function fmtDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}
function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function TechnicianCallsPage() {
  const [user, setUser] = useState(null);
  const [techs, setTechs] = useState([]);
  const [calls, setCalls] = useState([]);
  const [payments, setPayments] = useState([]);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedTech, setSelectedTech] = useState('all');
  const [statusTab, setStatusTab] = useState('Closed');
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          setUser(null);
          return;
        }
        const me = await res.json();
        if (me.role !== 'admin') {
          setUser(null);
          return;
        }
        setUser(me);
      } catch (e) {
        setUser(null);
      }
    })();
  }, []);

  const buildQS = useCallback(() => {
    const p = new URLSearchParams();
    if (month) p.set('month', month);
    if (selectedTech && selectedTech !== 'all') p.set('techId', selectedTech);
    if (dateFrom) p.set('dateFrom', dateFrom);
    if (dateTo) p.set('dateTo', dateTo);
    return p.toString();
  }, [month, selectedTech, dateFrom, dateTo]);

  const load = useCallback(
    async ({ notify = false } = {}) => {
      if (!user) return;
      try {
        setRefreshing(true);
        if (loading) setLoading(true);

        const qs = buildQS();
        const res = await fetch(`/api/admin/technician-calls?${qs}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load stats');

        // normalize technicians: ensure display name and numeric fields
        const techsNorm = (data.technicians || []).map((t) => ({
          ...t,
          monthAmount: safeNum(t.monthAmount || 0),
          monthSubmitted: safeNum(t.monthSubmitted || 0),
          monthAmountByPrice: safeNum(t.monthAmountByPrice || 0),
          totalAmount: safeNum(t.totalAmount || 0),
          monthClosed: Number(t.monthClosed || 0),
          totalClosed: Number(t.totalClosed || 0),
        }));

        // calls / payments
        const callsNorm = (data.calls || []).map((c) => ({
          ...c,
          price: safeNum(c.price),
          submittedAmount: safeNum(c.submittedAmount),
          lastPaymentAt: c.lastPaymentAt || null,
        }));
        const paymentsNorm = (data.payments || []).map((p) => ({
          ...p,
          totalAmount: safeNum(p.totalAmount),
          onlineAmount: safeNum(p.onlineAmount),
          cashAmount: safeNum(p.cashAmount),
        }));

        setTechs(techsNorm);
        setCalls(callsNorm);
        setPayments(paymentsNorm);
        setSummary(data.summary || null);

        if (notify) toast.success('Updated');
      } catch (err) {
        console.error('Load error', err);
        toast.error(err.message || 'Failed to load');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, buildQS, loading]
  );

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const counts = useMemo(
    () => ({
      Closed: calls.filter((c) => c.status === 'Closed').length,
      Pending: calls.filter((c) => c.status === 'Pending').length,
      Cancelled: calls.filter((c) => c.status === 'Cancelled').length,
    }),
    [calls]
  );

  const filteredCalls = useMemo(() => {
    return calls.filter(
      (c) =>
        c.status === statusTab &&
        (query.trim() === '' ||
          ((c.clientName || '').toLowerCase().includes(query.toLowerCase()) || (c.phone || '').includes(query)))
    );
  }, [calls, statusTab, query]);

  // total amount panel: when Closed and 'all' selected, use server summary (canonical)
  const totalPanelAmount = useMemo(() => {
    if (statusTab === 'Closed') {
      if (selectedTech !== 'all') {
        const t = techs.find((x) => x._id === selectedTech);
        if (t) return safeNum(t.monthAmount || t.monthSubmitted || 0);
        return 0;
      }
      // prefer server summary.monthAmount (submitted-sum) when available
      if (summary && typeof summary.monthAmount === 'number') return safeNum(summary.monthAmount);
      // fallback: sum of closed prices
      return calls.filter((c) => c.status === 'Closed').reduce((s, x) => s + safeNum(x.price), 0);
    }
    // Pending/Cancelled: sum of filtered list prices
    return filteredCalls.reduce((s, x) => s + safeNum(x.price), 0);
  }, [statusTab, selectedTech, techs, calls, filteredCalls, summary]);

  // shared input styling - responsive & accessible
  const inputCls = 'w-full mt-1 p-3 rounded-lg border bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200';
  const selectCls = inputCls + ' appearance-none';
  const btnPrimary = 'px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400';
  const btnSecondary = 'px-3 py-2 rounded-lg bg-white border text-sm hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200';

  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Top row: title + search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-400 text-white grid place-items-center shadow">
              <FiPhoneCall size={20} aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold leading-tight">Technician Calls</h2>
              <p className="text-xs sm:text-sm text-slate-500">Payments = submitted amounts · Counts = closed / pending / cancelled</p>
            </div>
          </div>

          <div className="flex w-full sm:w-auto items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search customer · phone · address"
              className={inputCls + ' flex-1'}
              aria-label="Search calls"
            />
            <button onClick={() => load({ notify: true })} className={btnSecondary} aria-label="Refresh data">
              <motion.span animate={refreshing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.9, repeat: refreshing ? Infinity : 0 }}>
                <FiRefreshCw />
              </motion.span>
              <span className="ml-2">Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className="text-xs font-semibold">Technician</label>
              <select value={selectedTech} onChange={(e) => setSelectedTech(e.target.value)} className={selectCls} aria-label="Select technician">
                <option value="all">All Technicians</option>
                {techs.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name} {t.phone ? `(${t.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold">Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls} aria-label="Select month" />
            </div>

            <div>
              <label className="text-xs font-semibold">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} aria-label="From date" />
            </div>

            <div>
              <label className="text-xs font-semibold">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} aria-label="To date" />
            </div>

            <div className="flex justify-end">
              <button onClick={() => load({ notify: true })} className={btnPrimary} aria-label="Apply filters">
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <SmallCard icon={<FiPhoneCall />} label="Calls Closed (This Month)" value={summary ? summary.monthClosed : techs.reduce((s, t) => s + (t.monthClosed || 0), 0)} />
          <SmallCard icon={<FiUsers />} label="Calls Closed (Lifetime)" value={summary ? summary.totalClosed : techs.reduce((s, t) => s + (t.totalClosed || 0), 0)} />
          <SmallCard icon={<FiDollarSign />} label="Amount (This Month)" value={`₹${safeNum(summary?.monthAmount ?? techs.reduce((s,t)=>s + (t.monthAmount||t.monthSubmitted||0),0)).toFixed(0)}`} />
          {/* space reserved for future card */}
        </div>

        {/* Technician overview / detail */}
        {selectedTech === 'all' ? (
          <div className="bg-white rounded-2xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Technician Overview</h3>
              <div className="text-xs text-slate-500">{techs.length} technicians</div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {loading
                ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 rounded-lg bg-slate-100 animate-pulse" />)
                : techs.map((t) => (
                    <button
                      key={t._id}
                      onClick={() => setSelectedTech(t._id)}
                      className="text-left bg-white p-3 rounded-xl border shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-200"
                      aria-label={`Open technician ${t.name} details`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-200 grid place-items-center flex-shrink-0">
                          {t.avatar ? (
                            <img src={t.avatar} alt={`${t.name} avatar`} className="h-full w-full object-cover" />
                          ) : (
                            <span className="font-semibold text-slate-700">{(t.name || '?')[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate break-words">{t.name}</div>
                          <div className="text-xs text-slate-500 truncate">{t.phone || '—'}</div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-slate-600">
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Month closed</div>
                          <div className="font-semibold">{t.monthClosed}</div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Lifetime closed</div>
                          <div className="font-semibold">{t.totalClosed}</div>
                        </div>

                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Month amount (submitted)</div>
                          <div className="font-semibold text-emerald-700">₹{safeNum(t.monthAmount || t.monthSubmitted || 0).toFixed(0)}</div>
                        </div>
                        <div>
                          <div className="uppercase text-[10px] text-slate-400">Lifetime amount</div>
                          <div className="font-semibold text-emerald-700">₹{safeNum(t.totalAmount || 0).toFixed(0)}</div>
                        </div>
                      </div>
                    </button>
                  ))}
            </div>
          </div>
        ) : (
          <TechDetail
            tech={techs.find((x) => x._id === selectedTech)}
            statusTab={statusTab}
            setStatusTab={setStatusTab}
            counts={counts}
            totalPanelAmount={totalPanelAmount}
            calls={filteredCalls.filter((c) => c.techId === selectedTech || selectedTech === 'all')}
            expanded={expanded}
            setExpanded={setExpanded}
          />
        )}
      </main>
    </div>
  );
}

function SmallCard({ icon, label, value }) {
  return (
    <motion.div whileHover={{ scale: 1.01 }} className="bg-white p-3 rounded-xl border flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-indigo-600 text-white grid place-items-center">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-500 uppercase truncate">{label}</div>
        <div className="font-bold text-slate-900 truncate">{value}</div>
      </div>
    </motion.div>
  );
}

function TechDetail({ tech, statusTab, setStatusTab, counts, totalPanelAmount, calls, expanded, setExpanded }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
            {tech?.avatar ? <img src={tech.avatar} alt={`${tech.name} avatar`} className="h-full w-full object-cover" /> : <div className="grid place-items-center font-semibold">{(tech?.name || '?')[0].toUpperCase()}</div>}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{tech?.name}</div>
            <div className="text-xs text-slate-500">Selected technician</div>
          </div>
        </div>
        <div>
          <button onClick={() => { setExpanded(null); setStatusTab('Closed'); }} className="px-3 py-2 rounded-lg bg-slate-100 text-sm hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">Reset</button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-3">
          <div className="flex flex-wrap gap-2">
            {['Closed', 'Pending', 'Cancelled'].map((st) => (
              <button key={st} onClick={() => setStatusTab(st)} className={`px-3 py-2 rounded-lg text-sm ${statusTab === st ? 'bg-indigo-600 text-white' : 'bg-slate-50'}`}>
                {st} <span className="ml-2 text-xs bg-white/10 px-2 rounded">{counts[st] || 0}</span>
              </button>
            ))}
          </div>
          <div className="text-sm">Total: ₹{safeNum(totalPanelAmount).toFixed(0)}</div>
        </div>

        {calls.length === 0 ? (
          <div className="text-sm text-slate-500">No calls for this filter.</div>
        ) : (
          <div className="divide-y">
            {calls.map((c) => (
              <div key={c._id} className="py-3 flex gap-3 items-start">
                <div className="h-12 w-12 rounded-md bg-indigo-600 grid place-items-center text-white font-semibold flex-shrink-0">{c.clientName ? (c.clientName[0] || '?').toUpperCase() : '?'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.clientName || c.customerName || '—'}</div>
                      <div className="text-xs text-slate-500 truncate">{c.phone || '—'} · {c.address || '—'}</div>
                    </div>
                    <div className="text-xs text-slate-500 ml-2 whitespace-nowrap">{fmtDate(c.closedAt || c.createdAt)}</div>
                  </div>

                  <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between items-start text-sm text-slate-700 gap-2">
                    <div>Price: <span className="font-semibold">₹{safeNum(c.price).toFixed(0)}</span></div>
                    <div>Collected: <span className="font-semibold">₹{safeNum(c.submittedAmount).toFixed(0)}</span></div>
                  </div>

                  <div className="mt-2">
                    <button onClick={() => setExpanded(expanded === c._id ? null : c._id)} className="text-xs bg-slate-50 px-3 py-1 rounded hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200">{expanded === c._id ? 'Hide' : 'Details'}</button>
                    <AnimatePresence>
                      {expanded === c._id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 bg-slate-50 p-3 rounded">
                          <div className="text-xs">Last payment: {c.lastPaymentAt ? fmtDate(c.lastPaymentAt) : '—'}</div>
                          <div className="mt-2">
                            {c.matchedPayments && c.matchedPayments.length > 0 ? c.matchedPayments.map((mp, idx) => (
                              <div key={idx} className="flex justify-between p-2 bg-white rounded border mb-2">
                                <div className="text-xs truncate">{fmtDate(mp.paymentCreatedAt)} · {mp.mode || '—'}</div>
                                <div className="text-sm font-semibold">₹{safeNum(mp.onlineAmount).toFixed(0)} + ₹{safeNum(mp.cashAmount).toFixed(0)}</div>
                              </div>
                            )) : <div className="text-xs text-slate-500">No matched payments for this call in the selected period.</div>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
