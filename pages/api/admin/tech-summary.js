
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";

async function handler(req,res,user){
  const { id } = req.query;
  const db = await getDb();
  const payments = db.collection('payments');
  const forms = db.collection('service_forms');

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);

  const agg = await payments.aggregate([
    { $match: { techId: new ObjectId(id) } },
    { $group: { _id: null, online:{ $sum: "$onlineAmount" }, cash:{ $sum: "$cashAmount" }, total:{ $sum: { $add: ["$onlineAmount","$cashAmount"] } } } }
  ]).toArray();
  const todayAgg = await payments.aggregate([
    { $match: { techId: new ObjectId(id), createdAt: { $gte: todayStart } } },
    { $group: { _id: null, total:{ $sum: { $add: ["$onlineAmount","$cashAmount"] } } } }
  ]).toArray();

  res.json({ online: agg[0]?.online||0, cash: agg[0]?.cash||0, total: agg[0]?.total||0, today: todayAgg[0]?.total||0 });
}
export default requireRole('admin')(handler);
