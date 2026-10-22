# GlobalMP Garage + VTC tablet

The custom garage reuses the original freeroam `db.ts` tables and `driveSaved()` in `garage.ts`, so existing owned trucks, current truck and tuning are preserved. The dealer keeps freeroam's free-truck model (no new purchases or economy deductions).

The VTC system is independent from the temporary built-in `mp.companies` feature. It stores company names, memberships, ranks, configurable open/application joining and applications in `freeroam/data/globalmp-vtc.db`. It does **not yet** synchronize membership to the game's top-bar `mp.companies`, implement logo/banner uploads, company bank, statistics or ownership transfer. Do not disable or overwrite your original freeroam database.

## Deploy

**Stop the OpenRoadMP server first.** Back up the whole freeroam directory, including its `data` folder:

```bash
sudo cp -a /opt/openroadmp/gamemodes/freeroam /opt/openroadmp/gamemodes/freeroam.backup-before-tablet-vtc
cd ~/OpenRoadMP-Scripts
git pull --ff-only
sudo cp tablet/tablet.ts tablet/vtc.ts /opt/openroadmp/gamemodes/freeroam/
sudo cp tablet/client/tablet.html /opt/openroadmp/gamemodes/freeroam/client/
```

Keep the existing `/tablet` registration in `commands.ts`:

```ts
import { toggleTablet } from "./tablet.ts"
```

and inside `registerCommands()`:

```ts
command({name:"tablet",de:"Tablet öffnen",en:"Open tablet",run(player){toggleTablet(player)}})
```

Do not add tablet as a separate gamemode; the code must run within freeroam. Restart OpenRoadMP and test `/tablet`. Confirm both garage and VTC screens work and check the console for type-check errors. Changes to VTC membership survive restarts. This has not been tested on your live server.

**Important:** This creates a new SQLite file under freeroam/data. Back it up alongside freeroam.db. The public GitHub repo should contain code only, never these databases or server credentials.
