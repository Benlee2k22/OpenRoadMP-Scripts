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
// Phase 4.1 schema extension: retain every existing contract and its history.
for(const [column,definition] of [["verified","INTEGER NOT NULL DEFAULT 0"],["route","TEXT"],["awaiting","INTEGER NOT NULL DEFAULT 0"]] as const){
 try{db.exec("ALTER TABLE contracts ADD COLUMN "+column+" "+definition)}catch(e){if(!String(e).includes("duplicate column"))throw e}
}
const routes=[
 {id:"apples",cargo:"apples",source:{company:"tradeaux",city:"dusseldorf"},destination:{company:"dfh",city:"hamburg"},label:"Apples · Düsseldorf → Hamburg"},
 {id:"gravel",cargo:"gravel",source:{company:"steinbr_str",city:"magdeburg"},destination:{company:"sanbuild_bas",city:"leipzig"},label:"Gravel · Magdeburg → Leipzig"}
] as const;
const account=(p:OpenRoadMP.Player)=>String(p.accountId||"name:"+p.name);
const tiers=[
 {id:"local",title:"Local Freight",description:"Complete 1 verified delivery",deliveries:1,bonus:1500},
 {id:"regional",title:"Regional Logistics",description:"Complete 3 verified deliveries",deliveries:3,bonus:6000},
 {id:"longhaul",title:"Long Haul Contract",description:"Complete 5 verified deliveries",deliveries:5,bonus:15000}
] as const;
const stats=(p:OpenRoadMP.Player)=>loadPlayer(p,SETTINGS.startMoney);
const count=(p:OpenRoadMP.Player)=>Math.max(0,Math.floor(Number(stats(p).deliveries)||0));
function active(p:OpenRoadMP.Player){
 return db.prepare("SELECT * FROM contracts WHERE account=? AND status='active' ORDER BY id DESC LIMIT 1").get(account(p)) as {id:number;tier:string;start_deliveries:number;bonus:number;verified:number;route:string|null;awaiting:number}|undefined;
}
export function jobsState(player:OpenRoadMP.Player){
 const done=count(player),job=active(player);
 const tier=job&&tiers.find(t=>t.id===job.tier);
 const history=db.prepare("SELECT id,tier,bonus,started_at,finished_at FROM contracts WHERE account=? AND status='completed' ORDER BY id DESC LIMIT 20").all(account(player));
 return {deliveries:done,offers:tiers,routes,active:job&&tier?{id:job.id,title:tier.title,required:tier.deliveries,completed:Math.min(tier.deliveries,job.verified),bonus:job.bonus,route:job.route?routes.find(r=>r.id===job.route)?.label:null,awaiting:!!job.awaiting,liveJob:player.job?{cargo:player.job.cargo,pickup:player.job.source.city+" · "+player.job.source.company,destination:player.job.destination.city+" · "+player.job.destination.company,distanceKm:player.job.distanceKm}:null}:null,history};
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
 if(job.verified<tier.deliveries)throw Error("Deliveries not completed yet");
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

export function assignFreight(player:OpenRoadMP.Player,routeId:unknown){
 const job=active(player);if(!job)throw Error("Accept a contract first");
 const tier=tiers.find(t=>t.id===job.tier);if(!tier)throw Error("Unknown contract");
 if(job.verified>=tier.deliveries)throw Error("Claim your completed contract");
 if(job.awaiting)throw Error("A freight delivery is already assigned");
 const route=routes.find(r=>r.id===routeId);if(!route)throw Error("Unknown freight route");
 // The native game API validates companies, cargo and cities and sets pickup navigation.
 // Assignment will replace an existing game job, so do not silently overwrite one.
 if(player.job)throw Error("Finish or cancel your existing ETS2 freight job first");
 new JobBuilder({cargo:route.cargo,source:route.source,destination:route.destination}).assign(player);
 db.prepare("UPDATE contracts SET route=?,awaiting=1 WHERE id=? AND account=? AND status='active'").run(route.id,job.id,account(player));
 return jobsState(player);
}
mp.events.on("jobDelivered",(player,delivered)=>{
 const job=active(player);if(!job||!job.awaiting||!job.route)return;
 const route=routes.find(r=>r.id===job.route);if(!route)return;
 if(delivered.cargoId!==route.cargo ||
 delivered.source.cityId!==route.source.city || delivered.source.companyId!==route.source.company ||
 delivered.destination.cityId!==route.destination.city || delivered.destination.companyId!==route.destination.company)return;
 db.prepare("UPDATE contracts SET verified=verified+1,awaiting=0,route=NULL WHERE id=? AND account=? AND status='active' AND awaiting=1").run(job.id,account(player));
});
mp.events.on("jobCancelled",(player)=>{
 const job=active(player);
 if(job?.awaiting)db.prepare("UPDATE contracts SET awaiting=0,route=NULL WHERE id=? AND account=? AND status='active'").run(job.id,account(player));
});
