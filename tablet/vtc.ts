import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

mkdirSync(fileURLToPath(new URL("./data/", import.meta.url)), { recursive: true });
const db = new DatabaseSync(fileURLToPath(new URL("./data/globalmp-vtc.db", import.meta.url)));
db.exec(`
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS vtcs(id INTEGER PRIMARY KEY AUTOINCREMENT, game TEXT NOT NULL, name TEXT NOT NULL, owner TEXT NOT NULL, join_mode TEXT NOT NULL DEFAULT 'applications' CHECK(join_mode IN ('open','applications')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(game,name));
CREATE TABLE IF NOT EXISTS vtc_members(vtc_id INTEGER NOT NULL REFERENCES vtcs(id) ON DELETE CASCADE, account TEXT NOT NULL, game TEXT NOT NULL, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('owner','manager','driver')), joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(game,account));
CREATE TABLE IF NOT EXISTS vtc_applications(id INTEGER PRIMARY KEY AUTOINCREMENT, vtc_id INTEGER NOT NULL REFERENCES vtcs(id) ON DELETE CASCADE, account TEXT NOT NULL, game TEXT NOT NULL, display_name TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_vtc_application ON vtc_applications(game,account) WHERE status='pending';
`);
const game=()=>mp.server.game || "eut2";
const account=(p:OpenRoadMP.Player)=>p.accountId || `name:${p.name}`;
const row=(sql:string,...args:(string|number)[])=>db.prepare(sql).get(...args) as Record<string,unknown>|undefined;
const rows=(sql:string,...args:(string|number)[])=>db.prepare(sql).all(...args) as Record<string,unknown>[];
const membership=(p:OpenRoadMP.Player)=>row("SELECT * FROM vtc_members WHERE game=? AND account=?",game(),account(p));
function requireRole(p:OpenRoadMP.Player,id:number) {
 const m=membership(p);
 if(!m || Number(m.vtc_id)!==id || !["owner","manager"].includes(String(m.role))) throw Error("VTC staff permission required.");
 return m;
}
function join(p:OpenRoadMP.Player,id:number,role="driver") {
 if(membership(p)) throw Error("Leave your current VTC first.");
 db.prepare("INSERT INTO vtc_members(vtc_id,account,game,display_name,role) VALUES(?,?,?,?,?)").run(id,account(p),game(),p.name,role);
 db.prepare("UPDATE vtc_applications SET status='withdrawn' WHERE game=? AND account=? AND status='pending'").run(game(),account(p));
}
export function vtcState(p:OpenRoadMP.Player) {
 const m=membership(p);
 const mine=m?row("SELECT * FROM vtcs WHERE id=?",Number(m.vtc_id)):null;
 return { mine:mine?{...mine,role:m?.role,members:rows("SELECT account,display_name,role FROM vtc_members WHERE vtc_id=? ORDER BY role,display_name",Number(m?.vtc_id))}:null,
 directory:rows("SELECT v.id,v.name,v.join_mode,COUNT(m.account) AS members FROM vtcs v LEFT JOIN vtc_members m ON m.vtc_id=v.id WHERE v.game=? GROUP BY v.id ORDER BY v.name",game()),
 applications: m&&["owner","manager"].includes(String(m.role))?rows("SELECT id,display_name,message,created_at FROM vtc_applications WHERE vtc_id=? AND status='pending' ORDER BY id",Number(m.vtc_id)):[],
 pending:rows("SELECT id,vtc_id,status FROM vtc_applications WHERE game=? AND account=? AND status='pending'",game(),account(p)) };
}
export function vtcAction(p:OpenRoadMP.Player,action:string,payload:Record<string,unknown>={}) {
 const id=Number(payload.id), name=String(payload.name||"").trim(), member=String(payload.account||"");
 if(action==="create"){
  if(membership(p)) throw Error("You are already in a VTC.");
  if(name.length<3||name.length>40) throw Error("VTC name must be 3–40 characters.");
  const mode=payload.mode==="open"?"open":"applications";
  db.exec("BEGIN IMMEDIATE");
  try{
   const r=db.prepare("INSERT INTO vtcs(game,name,owner,join_mode) VALUES(?,?,?,?)").run(game(),name,account(p),mode);
   join(p,Number(r.lastInsertRowid),"owner"); db.exec("COMMIT");
  }catch(e){db.exec("ROLLBACK");throw e}
 } else if(action==="apply"||action==="join"){
  if(membership(p)) throw Error("Leave your current VTC first.");
  const v=row("SELECT * FROM vtcs WHERE id=? AND game=?",id,game());
  if(!v) throw Error("VTC not found.");
  if(v.join_mode==="open"){join(p,id);}
  else{
   const msg=String(payload.message||"").slice(0,500);
   db.prepare("INSERT INTO vtc_applications(vtc_id,account,game,display_name,message) VALUES(?,?,?,?,?)").run(id,account(p),game(),p.name,msg);
  }
 } else if(action==="review"){
  const app=row("SELECT * FROM vtc_applications WHERE id=? AND status='pending'",id);
  if(!app) throw Error("Application no longer pending.");
  requireRole(p,Number(app.vtc_id));
  const accepted=payload.accept===true;
  db.exec("BEGIN IMMEDIATE");
  try{
   if(accepted){
    if(row("SELECT account FROM vtc_members WHERE game=? AND account=?",String(app.game),String(app.account))) throw Error("Applicant already joined a VTC.");
    db.prepare("INSERT INTO vtc_members(vtc_id,account,game,display_name,role) VALUES(?,?,?,?,?)").run(Number(app.vtc_id),String(app.account),String(app.game),String(app.display_name),"driver");
   }
   db.prepare("UPDATE vtc_applications SET status=? WHERE id=?").run(accepted?"accepted":"rejected",id);
   if(accepted) db.prepare("UPDATE vtc_applications SET status='withdrawn' WHERE game=? AND account=? AND status='pending' AND id<>?").run(String(app.game),String(app.account),id);
   db.exec("COMMIT");
  }catch(e){db.exec("ROLLBACK");throw e}
 } else if(action==="mode"){
  const m=membership(p);if(!m||m.role!=="owner")throw Error("Owner permission required.");
  db.prepare("UPDATE vtcs SET join_mode=? WHERE id=?").run(payload.mode==="open"?"open":"applications",Number(m.vtc_id));
 } else if(action==="role"){
  const m=membership(p);if(!m||m.role!=="owner")throw Error("Owner permission required.");
  if(member===account(p))throw Error("Cannot change your own role.");
  if(!["manager","driver"].includes(String(payload.role)))throw Error("Invalid role.");
  db.prepare("UPDATE vtc_members SET role=? WHERE vtc_id=? AND game=? AND account=? AND role<>'owner'").run(String(payload.role),Number(m.vtc_id),game(),member);
 } else if(action==="kick"){
  const m=membership(p);if(!m||!["owner","manager"].includes(String(m.role)))throw Error("Staff permission required.");
  if(member===account(p))throw Error("Cannot kick yourself.");
  const target=row("SELECT role FROM vtc_members WHERE vtc_id=? AND game=? AND account=?",Number(m.vtc_id),game(),member);
  if(!target||target.role==="owner"||(m.role==="manager"&&target.role==="manager"))throw Error("Cannot remove that member.");
  db.prepare("DELETE FROM vtc_members WHERE vtc_id=? AND game=? AND account=?").run(Number(m.vtc_id),game(),member);
 } else if(action==="leave"){
  const m=membership(p);if(!m)throw Error("Not in a VTC.");
  if(m.role==="owner"){
   const others=rows("SELECT account FROM vtc_members WHERE vtc_id=? AND account<>? LIMIT 1",Number(m.vtc_id),account(p));
   if(others.length)throw Error("Transfer ownership or remove other members before leaving.");
   db.prepare("DELETE FROM vtcs WHERE id=?").run(Number(m.vtc_id));
  } else db.prepare("DELETE FROM vtc_members WHERE game=? AND account=?").run(game(),account(p));
 } else throw Error("Unknown VTC action.");
 return vtcState(p);
}
