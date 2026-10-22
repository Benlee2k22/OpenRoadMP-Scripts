import { jobsState, startJob, cancelJob, claimJob, assignFreight } from "./jobs.ts";
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
 page.on("jobsState",who=>jobsState(who));
 page.on("jobsAction",(who,action:string,id:unknown)=>{console.log("[GlobalMP jobs] action",who.name,action,String(id));try{if(action==="start")return startJob(who,id);if(action==="assign")return assignFreight(who,id);if(action==="cancel")return cancelJob(who);if(action==="claim")return claimJob(who);throw Error("Unknown job action")}catch(error){console.error("[GlobalMP jobs] FAILED",who.name,action,error);throw error;}});
 page.on("careerState",who=>careerState(who));
 page.on("careerClaim",(who,id:unknown)=>claimCareer(who,id));
 page.on("garageState",who=>dealershipState(who));
 page.on("garageAction",(who,action:string,value:unknown)=>dealershipAction(who,action,value));
 page.on("vtcState",who=>vtcState(who));
 page.on("vtcAction",(who,action:string,payload:Record<string,unknown>)=>vtcAction(who,action,payload));
}
mp.events.on("playerLeave",player=>tablets.delete(player.id));

// Recovery command for orphaned native freight jobs from earlier tablet builds.
// Does not alter GlobalMP contract history or cancel an unrelated contract.
mp.commands.add("canceljob","Cancel your active freight job and clear GPS",(player:OpenRoadMP.Player)=>{
 if(!player.job){mp.players.navigateTo(player,null);return;}
 mp.players.cancelJob(player);
 mp.players.navigateTo(player,null);
 
});
