// pages/api/tech/check-payment.js
import { getDb } from "../../../lib/api-helpers";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    const { callId } = req.body;

    if (!callId) {
      return res.status(400).json({
        success: false,
        message: "callId missing",
      });
    }

    const db = await getDb();

    // call fetch
    const call = await db.collection("forwarded_calls").findOne({
      _id: new ObjectId(callId),
    });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: "Call not found",
      });
    }

    // ensure field exists
    let paymentStatus = "Pending";

    if (call.paymentStatus === "Paid") {
      paymentStatus = "Paid";
    }

    return res.json({
      success: true,
      callId,
      paymentStatus,
    });
  } catch (err) {
    console.error("check-payment error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}
