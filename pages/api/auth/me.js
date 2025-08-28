
import { getUser } from "../../../lib/api-helpers.js";

export default async function handler(req,res){
  const u = getUser(req);
  if(!u) return res.status(401).end();
  res.json(u);
}
