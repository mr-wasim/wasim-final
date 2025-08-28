
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import Papa from "papaparse";

function buildMatch({ q, status, tech, dateFrom, dateTo }){
  const match = {};
  if(q){
    match.$or = [
      { clientName: { $regex: q, $options: 'i' } },
      { phone: { $regex: q, $options: 'i' } },
      { address: { $regex: q, $options: 'i' } },
    ];
  }
  if(status){ match.status = status; }
  if(tech){ match.techUsername = tech; }
  if(dateFrom || dateTo){
    match.createdAt = {};
    if(dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if(dateTo) match.createdAt.$lte = new Date(dateTo + 'T23:59:59');
  }
  return match;
}

async function handler(req,res,user){
  const db = await getDb();
  const { q='', status='', tech='', dateFrom='', dateTo='', page=1, csv } = req.query;
  const match = buildMatch({ q, status, tech, dateFrom, dateTo });
  const coll = db.collection('service_forms');
  if(csv==='1'){
    const items = await coll.find(match).sort({createdAt:-1}).toArray();
    const csvText = Papa.unparse(items.map(({_id,signature,...x})=>x));
    return res.json({ csv: csvText });
  }
  const limit = 20; const skip = (Number(page)-1)*limit;
  const cursor = coll.find(match).sort({createdAt:-1}).skip(skip).limit(limit);
  const items = await cursor.toArray();
  const total = await coll.countDocuments(match);
  res.json({ items: items.map(x=>({ ...x, _id: x._id.toString() })), total });
}
export default requireRole('admin')(handler);
