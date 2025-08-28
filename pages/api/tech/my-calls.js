
import { requireRole, getDb } from "../../../lib/api-helpers.js";

async function handler(req,res,user){
  const { tab='All Calls', page=1 } = req.query;
  const db = await getDb();
  const coll = db.collection('forwarded_calls');
  const match = { techId: { $in: [user.id, user.id && require('mongodb').ObjectId.isValid(user.id) ? new (require('mongodb').ObjectId)(user.id) : null].filter(Boolean) } };
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  if(tab==='Today Calls'){ match.createdAt = { $gte: todayStart }; }
  if(tab==='Pending'){ match.status = 'Pending'; }
  if(tab==='Completed'){ match.status = 'Completed'; }
  if(tab==='Closed'){ match.status = 'Closed'; }
  const limit = 4; const skip = (Number(page)-1)*limit;
  const total = await coll.countDocuments(match);
  const items = await coll.find(match).sort({createdAt:-1}).skip(skip).limit(limit).toArray();
  res.json({ items: items.map(x=>({ ...x, _id: x._id.toString() })), total });
}
export default requireRole('technician')(handler);
