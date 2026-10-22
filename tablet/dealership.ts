import { addTruck, currentTruck, deleteTruck, getTruck, loadPlayer, saveMoney, setCurrentTruck, trucksOf } from "./db.ts";
import { driveSaved } from "./garage.ts";
import { SETTINGS } from "./settings.ts";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const dataDir=fileURLToPath(new URL("./data/",import.meta.url));
mkdirSync(dataDir,{recursive:true});
const grants=new DatabaseSync(dataDir+"/globalmp-starters.db");
grants.exec("CREATE TABLE IF NOT EXISTS starter_grants(account TEXT PRIMARY KEY, granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
const playerKey=(p:OpenRoadMP.Player)=>String(p.accountId||"name:"+p.name);
const achievementFor=(brand:string,model:string)=> /scania/i.test(brand)&&/s|super/i.test(model)?{deliveries:50,label:"50 completed deliveries"}:/volvo/i.test(brand)&&/fh16/i.test(model)?{deliveries:100,label:"100 completed deliveries"}:/mercedes/i.test(brand)&&/actros/i.test(model)?{deliveries:25,label:"25 completed deliveries"}:null;
function starter(player:OpenRoadMP.Player){
 const key=playerKey(player);
 if(grants.prepare("SELECT account FROM starter_grants WHERE account=?").get(key))return;
 // Existing garages are grandfathered and count as already having received a starter.
 if(trucksOf(player).length){grants.prepare("INSERT OR IGNORE INTO starter_grants(account) VALUES(?)").run(key);return;}
 const candidates=catalog();
 const first=candidates.find(t=>/iveco/i.test(t.brand))??candidates.find(t=>/renault/i.test(t.brand))??candidates[0];
 if(!first)return;
 const id=addTruck(player,first.name,first.brand+" "+first.model);
 grants.prepare("INSERT OR IGNORE INTO starter_grants(account) VALUES(?)").run(key);
 const saved=getTruck(player,id);if(saved)driveSaved(player,saved);
}


// Prices are server-authoritative; never accept a price from the browser.
const prices: Record<string,number> = {
 "Scania": 95000, "Volvo": 100000, "Mercedes-Benz": 92000,
 "MAN": 85000, "DAF": 82000, "Iveco": 78000, "Renault": 80000,
 "Kenworth": 95000, "Peterbilt": 100000, "International": 85000,
 "Mack": 90000, "Western Star": 98000, "Freightliner": 85000
};
export const priceOf = (brand:string):number => prices[brand] ?? 90000;
// One catalog for display and purchase validation: DLC trucks are excluded server-side.
const catalog=()=>mp.vehicles.trucks().filter(t=>!t.name.includes("/") && !t.dlc);
export function dealershipState(player:OpenRoadMP.Player) {
 starter(player);
 const p=loadPlayer(player,SETTINGS.startMoney);
 return {
  money: typeof player.money==="number"?player.money:p.money,
  slots:SETTINGS.garageSlots,
  owned:trucksOf(player).map(t=>({id:t.id,name:t.name,label:t.label,parts:t.tuning?.parts.length??0,price:priceOf(t.label.split(" ")[0])})),
  current:currentTruck(player)?.id??null,
  catalog:catalog().map(t=>({name:t.name,label:t.brand+" "+t.model,brand:t.brand,model:t.model,price:priceOf(t.brand),dlc:!!t.dlc,achievement:achievementFor(t.brand,t.model),unlocked:!achievementFor(t.brand,t.model)||p.deliveries>=achievementFor(t.brand,t.model)!.deliveries}))
 };
}
export function dealershipAction(player:OpenRoadMP.Player,action:string,value:unknown) {
 if(action==="drive"){
  const truck=getTruck(player,Number(value));
  if(!truck)throw Error("You do not own this truck.");
  driveSaved(player,truck);
 }else if(action==="buy"){
  const truck=catalog().find(t=>t.name===String(value));
  if(!truck)throw Error("This truck is unavailable.");
  if(trucksOf(player).length>=SETTINGS.garageSlots)throw Error("Your garage is full.");
  const gate=achievementFor(truck.brand,truck.model);
  if(gate&&loadPlayer(player,SETTINGS.startMoney).deliveries<gate.deliveries)throw Error("Achievement required: "+gate.label);
  const price=priceOf(truck.brand);
  const balance=typeof player.money==="number"?player.money:loadPlayer(player,SETTINGS.startMoney).money;
  if(balance<price)throw Error("Insufficient funds: €"+price.toLocaleString());
  // No asynchronous gap between validation and deduction.
  mp.players.setMoney(player,balance-price);
  saveMoney(player,balance-price);
  try{
   const id=addTruck(player,truck.name,truck.brand+" "+truck.model);
   const saved=getTruck(player,id);
   if(saved)driveSaved(player,saved);
  }catch(err){
   mp.players.setMoney(player,balance);
   saveMoney(player,balance);
   throw err;
  }
 }else if(action==="sell"){
  const truck=getTruck(player,Number(value));
  if(!truck)throw Error("You do not own this truck.");
  if(currentTruck(player)?.id===truck.id)throw Error("You are currently driving this truck. Switch to another owned truck before selling it.");
  if(trucksOf(player).length<=1)throw Error("You must keep at least one truck in your garage.");
  // Existing grandfathered vehicles also have resale value; no extra ownership table required.
  const match=catalog().find(t=>t.name===truck.name);
  const refund=Math.floor(priceOf(match?.brand??"")*0.6);
  const balance=typeof player.money==="number"?player.money:loadPlayer(player,SETTINGS.startMoney).money;
  deleteTruck(player,truck.id);
  mp.players.setMoney(player,balance+refund);
  saveMoney(player,balance+refund);
 }else throw Error("Unknown dealership action.");
 return dealershipState(player);
}
