// Add this module to the existing freeroam gamemode (same process and database).
import { loadPlayer } from "./db.ts";
import { openGarage } from "./garage.ts";
import { openCompanyWindow } from "./company.ts";
import { SETTINGS } from "./settings.ts";

const tablets = new Map<number, OpenRoadMP.Browser>();

export function toggleTablet(player: OpenRoadMP.Player): void {
  const current = tablets.get(player.id);
  if (current && !current.closed) {
    current.close();
    tablets.delete(player.id);
    return;
  }
  const page = mp.browsers.create(player, "tablet.html");
  tablets.set(player.id, page);
  page.on("closeTablet", (who) => {
    page.close();
    tablets.delete(who.id);
  });
  page.on("overview", (who) => {
    const saved = loadPlayer(who, SETTINGS.startMoney);
    return {
      name: who.name,
      server: mp.server.name,
      money: who.money ?? saved.money,
      deliveries: saved.deliveries,
      earned: saved.earned,
      distanceKm: saved.distanceKm,
      online: mp.players.all().length,
    };
  });
  page.on("action", (who, action: string) => {
    if (action === "garage") {
      openGarage(who);
      return { ok: true };
    }
    if (action === "company") {
      if (!SETTINGS.companies) return { ok: false, message: "Companies are disabled." };
      openCompanyWindow(who);
      return { ok: true };
    }
    return { ok: false, message: "This feature is not connected yet." };
  });
}

mp.events.on("playerLeave", (player) => tablets.delete(player.id));
