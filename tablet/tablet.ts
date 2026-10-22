import { loadPlayer, trucksOf, currentTruck, getTruck, addTruck, deleteTruck } from "./db.ts";
import { driveSaved } from "./garage.ts";
import { SETTINGS } from "./settings.ts";
import { vtcState, vtcAction } from "./vtc.ts";
const tablets = new Map<number, OpenRoadMP.Browser>();
export function toggleTablet(player:OpenRoadMP.Player):void {
 const old=tablets.get(player.id);
 if(old&&!old.closed){old.close();tablets.delete(player.id);return;}
 const page=mp.browsers.create(player,"tablet.html");
 tablets.set(player.id,page);
 page.on("closeTablet",who=>{page.close();tablets.delete(who.id);});
 page.on("overview",who=>{const p=loadPlayer(who,SETTINGS.startMoney);return {name:who.name,server:mp.server.name,money:who.money??p.money,deliveries:p.deliveries,earned:p.earned,distanceKm:p.distanceKm,online:mp.players.all().length};});
 page.on("garageState",who=>({
  owned:trucksOf(who).map(t=>({id:t.id,label:t.label,parts:t.tuning?.parts.length??0})),
  current:currentTruck(who)?.id??null,slots:SETTINGS.garageSlots,
  dealer:[] // Only already-owned trucks may be driven from the tablet.
 }));
 page.on("garageAction",(who,action:string,value:unknown)=>{
  if(action==="drive"){const truck=getTruck(who,Number(value));if(!truck)throw Error("Truck not found.");driveSaved(who,truck);}
  else if(action==="giveback"){const truck=getTruck(who,Number(value));if(!truck)throw Error("Truck not found.");if(currentTruck(who)?.id===truck.id)throw Error("Cannot give back your current truck.");deleteTruck(who,truck.id);}
  else if(action==="take") throw Error("Vehicles must be purchased through the authorised dealership before appearing in your garage.");
  else throw Error("Unknown garage action.");
  return {ok:true};
 });
 page.on("vtcState",who=>vtcState(who));
 page.on("vtcAction",(who,action:string,payload:Record<string,unknown>)=>vtcAction(who,action,payload));
}
mp.events.on("playerLeave",player=>tablets.delete(player.id));
