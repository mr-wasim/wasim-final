
import { requireRole, getDb } from "../../../lib/api-helpers.js";

async function handler(req,res,user){
  const db = await getDb();
  const { q='', status='', page=1, limit=20 } = req.query;
  const match = {};
  if(q){
    match.$or=[
      { clientName: { $regex:q,$options:'i' } },
      { phone: { $regex:q,$options:'i' } },
      { address: { $regex:q,$options:'i' } },
      { techName: { $regex:q,$options:'i' } },
    ];
  }
  if(status){ match.status = status; }
  const coll = db.collection('forwarded_calls');
  const items = await coll.find(match).sort({createdAt:-1}).skip((Number(page)-1)*Number(limit)).limit(Number(limit)).toArray();
  res.json({ items: items.map(x=>({ ...x, _id: x._id.toString() })) });
}
export default requireRole('admin')(handler);
