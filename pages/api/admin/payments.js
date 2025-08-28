
import { requireRole, getDb } from "../../../lib/api-helpers.js";
import { ObjectId } from "mongodb";
import Papa from "papaparse";

async function handler(req,res,user){
  const db = await getDb();
  const { techId='', range='today', from='', to='', csv='' } = req.query;
  const match = {};
  if(techId) match.techId = new ObjectId(techId);
  const now = new Date();
  if(range==='today'){
    const start = new Date(); start.setHours(0,0,0,0);
    match.createdAt = { $gte: start };
  } else if(range==='7'){
    const start = new Date(now.getTime()-7*24*3600*1000); match.createdAt = { $gte: start };
  } else if(range==='30'){
    const start = new Date(now.getTime()-30*24*3600*1000); match.createdAt = { $gte: start };
  } else if(range==='custom' && (from||to)){
    match.createdAt = {};
    if(from) match.createdAt.$gte = new Date(from);
    if(to) match.createdAt.$lte = new Date(to+'T23:59:59');
  }
  const items = await db.collection('payments').find(match).sort({createdAt:-1}).toArray();
  const sum = items.reduce((a,p)=>({ online:a.online+(p.onlineAmount||0), cash:a.cash+(p.cashAmount||0), total:a.total+(p.onlineAmount||0)+(p.cashAmount||0) }), {online:0,cash:0,total:0});
  if(csv==='1'){
    const csvText = Papa.unparse(items.map(({_id,receiverSignature,...x})=>x));
    return res.json({ csv: csvText });
  }
  res.json({ items: items.map(x=>({ ...x, _id: x._id.toString() })), sum });
}
export default requireRole('admin')(handler);
