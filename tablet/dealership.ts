import { addTruck, currentTruck, deleteTruck, getTruck, loadPlayer, saveMoney, setCurrentTruck, trucksOf } from "./db.ts";
import { driveSaved } from "./garage.ts";
import { SETTINGS } from "./settings.ts";

// Prices are server-authoritative; never accept a price from the browser.
const prices: Record<string,number> = {
 "Scania": 95000, "Volvo": 100000, "Mercedes-Benz": 92000,
 "MAN": 85000, "DAF": 82000, "Iveco": 78000, "Renault": 80000,
 "Kenworth": 95000, "Peterbilt": 100000, "International": 85000,
 "Mack": 90000, "Western Star": 98000, "Freightliner": 85000
};
export const priceOf = (brand:string):number => prices[brand] ?? 90000;
const catalog=()=>mp.vehicles.trucks().filter(t=>!t.name.includes("/"));
export function dealershipState(player:OpenRoadMP.Player) {
 const p=loadPlayer(player,SETTINGS.startMoney);
 return {
  money: typeof player.money==="number"?player.money:p.money,
  slots:SETTINGS.garageSlots,
  owned:trucksOf(player).map(t=>({id:t.id,name:t.name,label:t.label,parts:t.tuning?.parts.length??0,price:priceOf(t.label.split(" ")[0])})),
  current:currentTruck(player)?.id??null,
  catalog:catalog().map(t=>({name:t.name,label:t.brand+" "+t.model,brand:t.brand,model:t.model,price:priceOf(t.brand),dlc:!!t.dlc}))
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
  if(currentTruck(player)?.id===truck.id)throw Error("Switch trucks before selling your active truck.");
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
