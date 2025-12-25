// pages/api/tech/payment.js
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

/**
 * Helper: normalize text for matching keys
 */
function norm(str = "") {
  return String(str || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\d\s+,-]/g, "")
    .trim();
}

/** Escape for regex */
function escapeRegExp(string) {
  return String(string || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Safe numeric */
function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * POST /api/tech/payment
 *
 * Expected body:
 * {
 *  receiver: string,
 *  mode: string,
 *  onlineAmount: number|string,
 *  cashAmount: number|string,
 *  receiverSignature: string (dataURL/base64),
 *  calls: [ { callId?, clientName, phone, address, type, price, onlineAmount, cashAmount } ]
 * }
 *
 * Behaviour:
 * - Validate inputs
 * - For each call with callId:
 *     * verify canonical forwarded_calls price equals provided price (fail if mismatch)
 *     * mark that call Paid and push payment entry (bulk)
 * - For calls without callId:
 *     * use regex match on name/phone/address + price to update matching forwarded_calls
 * - Save a payments document with techId and techUsername so admin can see which technician recorded it
 *
 * Performance notes:
 * - Uses bulkWrite for updates (fast)
 * - Recommend indexes on forwarded_calls: { _id:1 }, { clientName: "text" } or { phone:1 }, { address:1 }, { price:1 }
 */
async function handler(req, res, user) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed" });

  try {
    const body = req.body || {};

    const {
      receiver,
      mode,
      onlineAmount = 0,
      cashAmount = 0,
      receiverSignature,
      calls = [],
    } = body;

    // Basic validation
    if (!receiver || typeof receiver !== "string" || !receiver.trim()) {
      return res.status(400).json({ success: false, error: "Receiver (paying name) is required" });
    }
    if (!receiverSignature || typeof receiverSignature !== "string") {
      return res.status(400).json({ success: false, error: "Receiver signature is required (base64/dataURL)" });
    }
    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({ success: false, error: "At least one call must be provided" });
    }

    const db = await getDb();
    const paymentsColl = db.collection("payments");
    const callsColl = db.collection("forwarded_calls");

    // Normalize tech id for storage (store both raw and ObjectId when possible)
    const techId = ObjectId.isValid(user.id) ? new ObjectId(user.id) : user.id;
    const techUsername = user.username || user.email || user.name || null;

    const online = safeNumber(onlineAmount);
    const cash = safeNumber(cashAmount);
    const total = online + cash;

    // Build sanitized calls array
    const storedCalls = calls.map((c) => ({
      callId: c.callId ? String(c.callId) : null,
      clientName: c.clientName ? String(c.clientName) : "",
      phone: c.phone ? String(c.phone) : "",
      address: c.address ? String(c.address) : "",
      type: c.type ? String(c.type) : "",
      price: safeNumber(c.price),
      onlineAmount: safeNumber(c.onlineAmount),
      cashAmount: safeNumber(c.cashAmount),
    }));

    // SERVER-SIDE VALIDATION: price checks for entries with callId (strict)
    // and also ensure entered amounts sum equals price.
    // We'll fetch all forwarded_calls for the callIds in one query to validate quickly.
    const callIdsWithId = storedCalls.filter((s) => s.callId).map((s) => s.callId);
    const callObjectIds = [];
    const callStringIds = [];
    for (const id of callIdsWithId) {
      if (ObjectId.isValid(id)) callObjectIds.push(new ObjectId(id));
      else callStringIds.push(id);
    }

    const idQuery = [];
    if (callObjectIds.length) idQuery.push({ _id: { $in: callObjectIds } });
    if (callStringIds.length) idQuery.push({ _id: { $in: callStringIds } });

    if (idQuery.length) {
      const found = await callsColl.find({ $or: idQuery }).project({ _id: 1, price: 1, clientName: 1, phone: 1, address: 1 }).toArray();
      const foundMap = new Map(found.map((f) => [String(f._id), f]));

      for (const sc of storedCalls) {
        if (!sc.callId) continue;
        const f = foundMap.get(String(sc.callId));
        if (!f) {
          // call referenced but not found - reject to avoid silent mismatches
          return res.status(400).json({ success: false, error: `Call not found: ${sc.callId}` });
        }
        const expectedPrice = safeNumber(f.price);
        const entered = Number(sc.onlineAmount || 0) + Number(sc.cashAmount || 0);
        if (entered !== expectedPrice) {
          return res.status(400).json({
            success: false,
            error: `Price mismatch for call ${sc.callId}. Expected ₹${expectedPrice}, entered ₹${entered}`,
          });
        }
      }
    }

    // For calls without callId: ensure entered amounts equal provided price in payload (server-side check)
    for (const sc of storedCalls) {
      if (sc.callId) continue;
      const entered = Number(sc.onlineAmount || 0) + Number(sc.cashAmount || 0);
      if (entered !== sc.price) {
        return res.status(400).json({
          success: false,
          error: `Price mismatch for customer ${sc.clientName || sc.phone || "unknown"}. Expected ₹${sc.price}, entered ₹${entered}`,
        });
      }
    }

    // Prepare paymentDoc (include tech info)
    const paymentDoc = {
      techId,
      techUsername,
      receiver: String(receiver).trim(),
      mode: mode ? String(mode) : "",
      onlineAmount: online,
      cashAmount: cash,
      totalAmount: total,
      receiverSignature: receiverSignature,
      calls: storedCalls,
      createdAt: new Date(),
      createdBy: {
        _id: user._id || user.id || null,
        username: techUsername,
      },
    };

    // Insert payment doc
    const insertResult = await paymentsColl.insertOne(paymentDoc);
    const paymentId = insertResult.insertedId ? String(insertResult.insertedId) : null;

    // Build bulk update ops for forwarded_calls
    const bulkOps = [];
    const updatedCallIds = [];
    const updatedByNamePhoneMatches = [];

    // 1) For entries with callId - update specific docs (only those not already Paid)
    for (const sc of storedCalls) {
      if (!sc.callId) continue;
      // prefer ObjectId if valid
      let filterId;
      if (ObjectId.isValid(sc.callId)) filterId = { _id: new ObjectId(sc.callId) };
      else filterId = { _id: sc.callId };

      // Only update if not already paid to avoid double-updating
      bulkOps.push({
        updateOne: {
          filter: { ...filterId, $or: [{ paymentStatus: { $exists: false } }, { paymentStatus: { $ne: "Paid" } }] },
          update: {
            $set: {
              paymentStatus: "Paid",
              paymentRef: paymentId,
              paymentAt: new Date(),
            },
            $push: {
              payments: {
                paymentId,
                onlineAmount: sc.onlineAmount,
                cashAmount: sc.cashAmount,
                createdAt: new Date(),
                recordedBy: techUsername,
              },
            },
          },
        },
      });
      updatedCallIds.push(sc.callId);
    }

    // 2) For entries WITHOUT callId: try to update matching docs by normalized name/phone/address + price
    //    We will use regex clauses (case-insensitive) but include price equality to avoid wrong matches.
    for (const sc of storedCalls.filter((s) => !s.callId)) {
      const clauses = [];
      if (sc.clientName) clauses.push({ clientName: { $regex: new RegExp(escapeRegExp(sc.clientName), "i") } });
      if (sc.phone) clauses.push({ phone: { $regex: new RegExp(escapeRegExp(sc.phone), "i") } });
      if (sc.address) clauses.push({ address: { $regex: new RegExp(escapeRegExp(sc.address), "i") } });

      if (clauses.length === 0) continue;

      // Filter: any of the clauses, price equals, and not already paid
      const filter = {
        $and: [
          { $or: clauses },
          { price: safeNumber(sc.price) },
          { $or: [{ paymentStatus: { $exists: false } }, { paymentStatus: { $ne: "Paid" } }] },
        ],
      };

      // updateMany to mark all matches (lifetime behavior)
      bulkOps.push({
        updateMany: {
          filter,
          update: {
            $set: {
              paymentStatus: "Paid",
              paymentRef: paymentId,
              paymentAt: new Date(),
            },
            $push: {
              payments: {
                paymentId,
                onlineAmount: sc.onlineAmount,
                cashAmount: sc.cashAmount,
                createdAt: new Date(),
                recordedBy: techUsername,
              },
            },
          },
        },
      });

      updatedByNamePhoneMatches.push({ name: sc.clientName, phone: sc.phone, address: sc.address, price: sc.price });
    }

    // Execute bulk if we have ops
    let updatedCount = 0;
    if (bulkOps.length > 0) {
      try {
        const bulkResult = await callsColl.bulkWrite(bulkOps, { ordered: false });
        // bulkResult contains nModified / modifiedCount depending on driver
        // Sum up modified counts (different drivers expose different props)
        updatedCount = (bulkResult.modifiedCount ?? 0) + (bulkResult.nModified ?? 0);
      } catch (bulkErr) {
        // Bulk may error (partial). Still continue but log.
        console.error("bulkWrite error:", bulkErr);
      }
    }

    // Return response with what we updated
    return res.status(200).json({
      success: true,
      paymentId,
      updatedCallIds,
      updatedByNamePhoneMatches,
      updatedCount,
    });
  } catch (err) {
    console.error("tech/payment error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}

export default requireRole("technician")(handler);
