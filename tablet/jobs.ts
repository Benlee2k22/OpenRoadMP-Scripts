import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPlayer, saveMoney } from "./db.ts";
import { SETTINGS } from "./settings.ts";

// Verified against the freeroam database's server-side completed-deliveries counter.
// This does NOT independently verify a cargo type, route or trailer condition.
const dir=fileURLToPath(new URL("./data/",import.meta.url));
mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(dir+"globalmp-jobs.db");
db.exec(`CREATE TABLE IF NOT EXISTS contracts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 account TEXT NOT NULL, tier TEXT NOT NULL,
 start_deliveries INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'active',
 bonus INTEGER NOT NULL DEFAULT 0,
 started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 finished_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_job ON contracts(account) WHERE status='active';`);
const account=(p:OpenRoadMP.Player)=>String(p.accountId||"name:"+p.name);
const tiers=[
 {id:"local",title:"Local Freight",description:"Complete 1 verified delivery",deliveries:1,bonus:1500},
 {id:"regional",title:"Regional Logistics",description:"Complete 3 verified deliveries",deliveries:3,bonus:6000},
 {id:"longhaul",title:"Long Haul Contract",description:"Complete 5 verified deliveries",deliveries:5,bonus:15000}
] as const;
const stats=(p:OpenRoadMP.Player)=>loadPlayer(p,SETTINGS.startMoney);
const count=(p:OpenRoadMP.Player)=>Math.max(0,Math.floor(Number(stats(p).deliveries)||0));
function active(p:OpenRoadMP.Player){
 return db.prepare("SELECT * FROM contracts WHERE account=? AND status='active' ORDER BY id DESC LIMIT 1").get(account(p)) as {id:number;tier:string;start_deliveries:number;bonus:number}|undefined;
}
export function jobsState(player:OpenRoadMP.Player){
 const done=count(player),job=active(player);
 const tier=job&&tiers.find(t=>t.id===job.tier);
 const history=db.prepare("SELECT id,tier,bonus,started_at,finished_at FROM contracts WHERE account=? AND status='completed' ORDER BY id DESC LIMIT 20").all(account(player));
 return {deliveries:done,offers:tiers,active:job&&tier?{id:job.id,title:tier.title,required:tier.deliveries,completed:Math.min(tier.deliveries,Math.max(0,done-job.start_deliveries)),bonus:job.bonus}:null,history};
}
export function startJob(player:OpenRoadMP.Player,id:unknown){
 const tier=tiers.find(t=>t.id===id);
 if(!tier)throw Error("Unknown contract");
 if(active(player))throw Error("Finish or cancel your current contract first");
 db.prepare("INSERT INTO contracts(account,tier,start_deliveries,bonus) VALUES(?,?,?,?)").run(account(player),tier.id,count(player),tier.bonus);
 return jobsState(player);
}
export function cancelJob(player:OpenRoadMP.Player){
 const job=active(player);if(!job)throw Error("No active contract");
 db.prepare("UPDATE contracts SET status='cancelled',finished_at=CURRENT_TIMESTAMP WHERE id=? AND account=? AND status='active'").run(job.id,account(player));
 return jobsState(player);
}
export function claimJob(player:OpenRoadMP.Player){
 const job=active(player);if(!job)throw Error("No active contract");
 const tier=tiers.find(t=>t.id===job.tier);if(!tier)throw Error("Unknown contract type");
 if(count(player)-job.start_deliveries<tier.deliveries)throw Error("Deliveries not completed yet");
 const p=stats(player),balance=typeof player.money==="number"?player.money:Number(p.money);
 if(!Number.isFinite(balance))throw Error("Player balance unavailable");
 // Persist completion before paying, to prevent repeated claims. Separate DBs
 // mean a crash between writes requires manual reconciliation.
 const result=db.prepare("UPDATE contracts SET status='completed',finished_at=CURRENT_TIMESTAMP WHERE id=? AND account=? AND status='active'").run(job.id,account(player));
 if(!result.changes)throw Error("Contract already settled");
 try{mp.players.setMoney(player,balance+job.bonus);saveMoney(player,balance+job.bonus);}
 catch(err){db.prepare("UPDATE contracts SET status='active',finished_at=NULL WHERE id=? AND account=? AND status='completed'").run(job.id,account(player));throw err;}
 return jobsState(player);
}
