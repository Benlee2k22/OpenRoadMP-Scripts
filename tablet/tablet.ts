import { careerState, claimCareer } from "./progression.ts";
import { dealershipState, dealershipAction } from "./dealership.ts";
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
 page.on("careerState",who=>careerState(who));
 page.on("careerClaim",(who,id:unknown)=>claimCareer(who,id));
 page.on("garageState",who=>dealershipState(who));
 page.on("garageAction",(who,action:string,value:unknown)=>dealershipAction(who,action,value));
 page.on("vtcState",who=>vtcState(who));
 page.on("vtcAction",(who,action:string,payload:Record<string,unknown>)=>vtcAction(who,action,payload));
}
mp.events.on("playerLeave",player=>tablets.delete(player.id));
