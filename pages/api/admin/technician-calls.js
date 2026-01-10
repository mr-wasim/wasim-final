export const runtime = 'nodejs';

import { ObjectId } from 'mongodb';
import { getDb } from '../../../lib/api-helpers.js';
import { requireRole } from '../../../lib/api-helpers.js';

function toObjIdIfPossible(id) {
  try {
    if (ObjectId.isValid(id)) return new ObjectId(id);
  } catch (e) {}
  return id;
}

async function handler(req, res, user) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const db = await getDb();
    const callsColl = db.collection('forwarded_calls');
    const techsColl = db.collection('technicians');
    const paymentsColl = db.collection('payments');

    let { month = '', techId = '', dateFrom = '', dateTo = '' } = req.query;

    // compute date range (dateFrom/dateTo override month)
    let start, end;
    if (dateFrom || dateTo) {
      if (dateFrom) start = new Date(dateFrom + 'T00:00:00');
      if (dateTo) end = new Date(dateTo + 'T23:59:59.999');
      if (start && !end) { const tmp = new Date(start); tmp.setDate(tmp.getDate() + 1); end = tmp; }
      if (!start && end) { const tmp = new Date(end); tmp.setMonth(tmp.getMonth() - 1); start = tmp; }
    } else if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(n => parseInt(n, 10));
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 1, 0, 0, 0, 0);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    }

    // tech filter (support string/ObjectId)
    const techCandidates = [];
    if (techId && typeof techId === 'string') {
      techCandidates.push(techId);
      const maybeObj = toObjIdIfPossible(techId);
      if (maybeObj && typeof maybeObj !== 'string') techCandidates.push(maybeObj);
    }

    // ----- month summary by status (counts & closed-amount by price) -----
    const monthSummaryArr = await callsColl.aggregate([
      { $addFields: { closedDate: { $ifNull: ['$closedAt', '$createdAt'] }, priceNum: { $ifNull: ['$price', 0] } } },
      { $match: { closedDate: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
      { $group: { _id: '$status', countInMonth: { $sum: 1 }, amountInMonth: { $sum: '$priceNum' } } }
    ]).toArray();

    const monthByStatus = {};
    monthSummaryArr.forEach(r => { monthByStatus[r._id || 'UNKNOWN'] = { count: r.countInMonth || 0, amount: r.amountInMonth || 0 }; });

    // ----- lifetime closed summary -----
    const lifetimeArr = await callsColl.aggregate([
      { $addFields: { priceNum: { $ifNull: ['$price', 0] } } },
      { $match: { status: 'Closed', ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
      { $group: { _id: null, totalClosed: { $sum: 1 }, totalAmount: { $sum: '$priceNum' } } }
    ]).toArray();
    const lifetimeSummary = lifetimeArr[0] || { totalClosed: 0, totalAmount: 0 };

    // ----- per-tech month & lifetime aggregated by calls (closed) -----
    const monthStatsArr = await callsColl.aggregate([
      { $addFields: { closedDate: { $ifNull: ['$closedAt', '$createdAt'] }, priceNum: { $ifNull: ['$price', 0] } } },
      { $match: { status: 'Closed', closedDate: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
      { $group: { _id: '$techId', monthClosed: { $sum: 1 }, monthAmountByPrice: { $sum: '$priceNum' } } }
    ]).toArray();
    const monthMap = new Map();
    monthStatsArr.forEach(r => monthMap.set(String(r._id), { monthClosed: r.monthClosed || 0, monthAmountByPrice: r.monthAmountByPrice || 0 }));

    const lifeStatsArr = await callsColl.aggregate([
      { $addFields: { priceNum: { $ifNull: ['$price', 0] } } },
      { $match: { status: 'Closed', ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
      { $group: { _id: '$techId', totalClosed: { $sum: 1 }, totalAmount: { $sum: '$priceNum' } } }
    ]).toArray();
    const lifeMap = new Map();
    lifeStatsArr.forEach(r => lifeMap.set(String(r._id), { totalClosed: r.totalClosed || 0, totalAmount: r.totalAmount || 0 }));

    // ----- payments aggregated by tech in the same payment period (submitted amounts) -----
    // we flatten payments.calls and sum online+cash per tech
    const paymentsByTechArr = await paymentsColl.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
      { $unwind: { path: '$calls', preserveNullAndEmptyArrays: false } },
      {
        $addFields: {
          techIdStr: { $toString: '$techId' },
          callPaymentAmount: { $add: [{ $ifNull: ['$calls.onlineAmount', 0] }, { $ifNull: ['$calls.cashAmount', 0] }] }
        }
      },
      { $group: { _id: '$techIdStr', submittedSum: { $sum: '$callPaymentAmount' } } }
    ]).toArray();

    const paymentsMap = new Map();
    paymentsByTechArr.forEach(r => paymentsMap.set(String(r._id), r.submittedSum || 0));

    // ----- technicians list (include alternate name fields) -----
    const techDocs = await techsColl.find({}, { projection: { _id: 1, name: 1, fullName: 1, techName: 1, username: 1, phone: 1, avatar: 1, profilePic: 1, bio: 1 } }).sort({ name: 1 }).toArray();

    // total submitted across all techs (this month)
    let canonicalMonthSubmittedTotal = 0;

    const technicians = techDocs.map(t => {
      const key = String(t._id);
      const monthCallStat = monthMap.get(key) || { monthClosed: 0, monthAmountByPrice: 0 };
      const lifeStat = lifeMap.get(key) || { totalClosed: 0, totalAmount: 0 };
      const monthSubmitted = paymentsMap.get(key) || 0; // WHAT was actually submitted this month for this tech

      canonicalMonthSubmittedTotal += monthSubmitted;

      // choose best display name from available fields
      const displayName = (t.name && t.name.trim()) ||
        (t.fullName && t.fullName.trim()) ||
        (t.techName && t.techName.trim()) ||
        (t.username && t.username.trim()) ||
        'Unnamed';

      return {
        _id: key,
        name: displayName,
        username: t.username || '',
        phone: t.phone || '',
        avatar: t.avatar || t.profilePic || null,
        bio: t.bio || '',
        // calls-based metrics
        monthClosed: monthCallStat.monthClosed,
        monthAmountByPrice: monthCallStat.monthAmountByPrice, // for reference if you want price-based canonical closed amount
        totalClosed: lifeStat.totalClosed,
        totalAmount: lifeStat.totalAmount,
        // payment-submitted metrics (what you asked: month total = sum of submitted amounts)
        monthSubmitted: monthSubmitted,
        monthAmount: monthSubmitted // <= user requested: per-tech month amount = submitted amount
      };
    });

    // ----- calls list (only when tech filter provided) - matchedPayments included -----
    let callsList = [];
    if (techCandidates.length) {
      const callsPipeline = [
        { $addFields: { closedDate: { $ifNull: ['$closedAt', '$createdAt'] }, priceNum: { $ifNull: ['$price', 0] }, callIdStr: { $toString: '$_id' } } },
        { $match: { techId: { $in: techCandidates }, closedDate: { $gte: start, $lt: end } } },
        { $sort: { closedDate: -1 } },

        {
          $lookup: {
            from: 'payments',
            let: { callIdStr: '$callIdStr' },
            pipeline: [
              { $match: { createdAt: { $gte: start, $lt: end } } },
              { $project: { _id: 1, createdAt: 1, mode: 1, receiver: 1, calls: 1 } }
            ],
            as: 'paymentDocs'
          }
        },

        {
          $project: {
            _id: { $toString: '$_id' },
            techId: { $toString: '$techId' },
            clientName: 1,
            customerName: 1,
            phone: 1,
            address: 1,
            status: 1,
            price: '$priceNum',
            createdAt: 1,
            closedAt: 1,
            matchedPayments: {
              $reduce: {
                input: '$paymentDocs',
                initialValue: [],
                in: {
                  $concatArrays: [
                    '$$value',
                    {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ['$$this.calls', []] },
                            as: 'pc',
                            cond: { $eq: [{ $toString: '$$pc.callId' }, '$callIdStr'] }
                          }
                        },
                        as: 'mc',
                        in: {
                          paymentId: { $toString: '$$this._id' },
                          paymentCreatedAt: '$$this.createdAt',
                          onlineAmount: { $ifNull: ['$$mc.onlineAmount', 0] },
                          cashAmount: { $ifNull: ['$$mc.cashAmount', 0] },
                          receiver: '$$this.receiver',
                          mode: '$$this.mode'
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        },

        {
          $addFields: {
            submittedAmount: {
              $reduce: {
                input: '$matchedPayments',
                initialValue: 0,
                in: { $add: ['$$value', { $add: ['$$this.onlineAmount', '$$this.cashAmount'] }] }
              }
            },
            lastPaymentAt: { $max: '$matchedPayments.paymentCreatedAt' }
          }
        },

        {
          $project: {
            _id: 1,
            techId: 1,
            clientName: 1,
            customerName: 1,
            phone: 1,
            address: 1,
            status: 1,
            price: 1,
            createdAt: 1,
            closedAt: 1,
            submittedAmount: 1,
            matchedPayments: 1,
            paymentStatus: { $cond: [{ $gt: ['$submittedAmount', 0] }, 'Submitted', 'Unsubmitted'] },
            lastPaymentAt: 1,
            clientAvatar: { $ifNull: ['$clientAvatar', '$avatar'] }
          }
        },

        { $limit: 500 }
      ];

      callsList = await callsColl.aggregate(callsPipeline).toArray();
    }

    // ----- flattened payments (for reconciliation) -----
    const paymentsPipeline = [
      { $match: { createdAt: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
      { $project: { _id: 1, createdAt: 1, mode: 1, receiver: 1, techId: 1, calls: { $ifNull: ['$calls', []] } } },
      { $unwind: '$calls' },
      { $addFields: { callIdStr: { $toString: '$calls.callId' }, paymentIdStr: { $toString: '$_id' } } },
      {
        $project: {
          paymentId: '$paymentIdStr',
          paymentCreatedAt: 1,
          mode: 1,
          receiver: 1,
          techId: { $toString: '$techId' },
          onlineAmount: { $ifNull: ['$calls.onlineAmount', 0] },
          cashAmount: { $ifNull: ['$calls.cashAmount', 0] },
          callId: '$callIdStr',
          clientName: '$calls.clientName',
          phone: '$calls.phone',
          address: '$calls.address'
        }
      },
      {
        $lookup: {
          from: 'forwarded_calls',
          let: { cid: '$callId' },
          pipeline: [
            { $addFields: { idStr: { $toString: '$_id' } } },
            { $match: { $expr: { $eq: ['$idStr', '$$cid'] } } },
            { $project: { _id: 1, closedAt: 1, status: 1, price: 1 } }
          ],
          as: 'callDoc'
        }
      },
      { $addFields: { callDoc: { $arrayElemAt: ['$callDoc', 0] } } },
      {
        $project: {
          paymentId: 1,
          paymentCreatedAt: 1,
          mode: 1,
          receiver: 1,
          techId: 1,
          onlineAmount: 1,
          cashAmount: 1,
          totalAmount: { $add: ['$onlineAmount', '$cashAmount'] },
          callId: 1,
          clientName: 1,
          callClosedAt: '$callDoc.closedAt',
          callStatus: '$callDoc.status'
        }
      },
      { $sort: { paymentCreatedAt: -1 } },
      { $limit: 2000 }
    ];

    const paymentsList = await paymentsColl.aggregate(paymentsPipeline).toArray();

    // canonical summary: monthAmount = sum of submitted payments across techs (user requirement)
    const summary = {
      monthClosed: monthByStatus['Closed']?.count || 0,
      monthAmount: canonicalMonthSubmittedTotal || 0, // THIS MONTH money = submitted sums across techs
      monthSubmitted: paymentsList.reduce((s, p) => s + (p.totalAmount || 0), 0),
      monthPending: monthByStatus['Pending']?.count || 0,
      monthPendingAmount: monthByStatus['Pending']?.amount || 0,
      totalClosed: lifetimeSummary.totalClosed || 0,
      totalAmount: lifetimeSummary.totalAmount || 0
    };

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({ success: true, technicians, summary, calls: callsList, payments: paymentsList, monthSummaryByStatus: monthByStatus });
  } catch (err) {
    console.error('technician-calls error:', err);
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
}

export default requireRole('admin')(handler);
