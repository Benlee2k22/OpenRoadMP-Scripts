# GlobalMP tablet (freeroam integration)

This is a **starter tablet**, not yet a replacement for every OpenRoadMP interface. It reads the existing freeroam SQLite-backed player stats and opens the existing garage and company interfaces. Jobs, VTC applications, convoys and settings are placeholders.

## Install (on Ubuntu, server stopped)

Back up the live gamemode **including its data** before editing:

```bash
sudo cp -a /opt/openroadmp/gamemodes/freeroam /opt/openroadmp/gamemodes/freeroam.backup
cd ~/OpenRoadMP-Scripts && git pull --ff-only
sudo cp tablet/tablet.ts /opt/openroadmp/gamemodes/freeroam/tablet.ts
sudo cp tablet/client/tablet.html /opt/openroadmp/gamemodes/freeroam/client/tablet.html
```

Edit `/opt/openroadmp/gamemodes/freeroam/commands.ts`:

1. Add this import with the other imports:

```ts
import { toggleTablet } from "./tablet.ts"
```

2. Before the registration function at the bottom, add:

```ts
command({
  name: "tablet",
  de: "öffnet das GlobalMP Tablet",
  en: "opens the GlobalMP driver tablet",
  run(player) { toggleTablet(player) },
})
```

**Do not** add `tablet` as a separate gamemode in server.cfg: it must run in the same freeroam process so it can access the same database and functions.

Start the server, check that the freeroam type check succeeds, then try `/tablet` in-game. Repeat `/tablet` to close it. If you need to undo the change, stop the server and restore the backup.

This code has not yet been compiled against your server's exact `openroadmp.d.ts`; if the type check fails, capture the error and report it before continuing. The tablet uses the same browser API patterns as the provided `speedometer.ts` example.
