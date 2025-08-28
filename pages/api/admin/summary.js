
import { requireRole, getDb } from "../../../lib/api-helpers.js";

async function handler(req,res,user){
  const db = await getDb();
  const techs = await db.collection('technicians').countDocuments();
  const forms = await db.collection('service_forms').countDocuments();
  const calls = await db.collection('forwarded_calls').countDocuments();
  const paymentsAgg = await db.collection('payments').aggregate([
    { $group: { _id: null, total: { $sum: { $add: ["$onlineAmount","$cashAmount"] } } } }
  ]).toArray();
  res.json({ techs, forms, calls, totalPayments: paymentsAgg[0]?.total||0 });
}
export default requireRole('admin')(handler);
