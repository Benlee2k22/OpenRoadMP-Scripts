import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPlayer, saveMoney } from "./db.ts";
import { SETTINGS } from "./settings.ts";

const dir=fileURLToPath(new URL("./data/",import.meta.url));
mkdirSync(dir,{recursive:true});
const db=new DatabaseSync(dir+"globalmp-progression.db");
db.exec("CREATE TABLE IF NOT EXISTS claims(account TEXT NOT NULL, achievement TEXT NOT NULL, PRIMARY KEY(account,achievement))");
const account=(p:OpenRoadMP.Player)=>String(p.accountId||"name:"+p.name);
export const achievements=[
 {id:"first",name:"First Delivery",deliveries:1,reward:2500},
 {id:"rookie",name:"Road Rookie",deliveries:5,reward:5000},
 {id:"regular",name:"Reliable Driver",deliveries:10,reward:10000},
 {id:"actros",name:"Actros Access",deliveries:25,reward:15000},
 {id:"scania",name:"Scania Specialist",deliveries:50,reward:25000},
 {id:"volvo",name:"Volvo Veteran",deliveries:100,reward:50000},
 {id:"legend",name:"Road Legend",deliveries:250,reward:100000}
] as const;
export function careerState(player:OpenRoadMP.Player){
 const p=loadPlayer(player,SETTINGS.startMoney);
 const deliveries=Math.max(0,Number(p.deliveries)||0),distanceKm=Math.max(0,Number(p.distanceKm)||0);
 const xp=deliveries*250+Math.floor(distanceKm/10);
 const level=Math.floor(Math.sqrt(xp/500))+1;
 const claimed=new Set((db.prepare("SELECT achievement FROM claims WHERE account=?").all(account(player)) as {achievement:string}[]).map(x=>x.achievement));
 return {xp,level,levelStart:500*(level-1)**2,nextLevel:500*level**2,deliveries,distanceKm,
 achievements:achievements.map(a=>({...a,unlocked:deliveries>=a.deliveries,claimed:claimed.has(a.id)}))};
}
export function claimCareer(player:OpenRoadMP.Player,id:unknown){
 const a=achievements.find(x=>x.id===id);
 if(!a)throw Error("Unknown achievement");
 const stats=loadPlayer(player,SETTINGS.startMoney);
 if((Number(stats.deliveries)||0)<a.deliveries)throw Error("Not unlocked");
 const result=db.prepare("INSERT OR IGNORE INTO claims(account,achievement) VALUES(?,?)").run(account(player),a.id);
 if(!result.changes)throw Error("Already claimed");
 try{
  const balance=typeof player.money==="number"?player.money:Number(stats.money);
  if(!Number.isFinite(balance))throw Error("Unknown balance");
  mp.players.setMoney(player,balance+a.reward);
  saveMoney(player,balance+a.reward);
 }catch(err){db.prepare("DELETE FROM claims WHERE account=? AND achievement=?").run(account(player),a.id);throw err;}
 return careerState(player);
}
