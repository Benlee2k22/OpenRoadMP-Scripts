# GlobalMP Tablet — Garage and Dealership (Phase 1)

This release connects a truck showroom to the existing freeroam economy and `data/freeroam.db` truck ownership records. Truck prices are enforced server-side (brand-based from €78k–€100k); buying debits the live player balance and saves it to SQLite, then adds the owned truck. Selling an inactive owned truck credits 60% of its current listed brand price. Driving only works for trucks owned by the account. Existing saved tuning is still restored by the original `driveSaved` function. Existing owned trucks are grandfathered (they remain owned without a new purchase).

**Safety:** This release is not a proven universal anti-spawn mechanism. The installer removes the original free dealer from the freeroam `/garage` menu. The game-native vehicle dealership, `/car` (DLC cars), administrative commands and other gamemodes may have separate vehicle controls; these must be audited before claiming all spawning is locked down. Starting fallback vehicles remain as configured in freeroam.

## Installation on Ubuntu

Stop OpenRoadMP, then back up the entire freeroam directory **including data**:

```bash
sudo cp -a /opt/openroadmp/gamemodes/freeroam /opt/openroadmp/gamemodes/freeroam.backup-before-dealership
cd ~/OpenRoadMP-Scripts
git pull --ff-only
sudo cp tablet/tablet.ts tablet/vtc.ts tablet/dealership.ts /opt/openroadmp/gamemodes/freeroam/
sudo cp tablet/client/tablet.html /opt/openroadmp/gamemodes/freeroam/client/
sudo python3 tablet/disable-free-dealer.py
```

Keep your existing tablet command registration. Do not overwrite `data/freeroam.db` or `data/globalmp-vtc.db`.

Run a TypeScript check before starting the server:

```bash
cd /opt/openroadmp/gamemodes/freeroam
npm run check
```

If type checking fails, **do not deploy**; share the error. Otherwise restart freeroam from the OpenRoadMP console and test with a low-value test account. The original start balance is €5,000, so you may need a funded test account to test purchases.

## Known limitations

- Prices are per manufacturer, not individual model. This is a first working economy pass.
- Purchases use sequential live-money and SQLite updates; they are not a cross-system ACID transaction. For production-scale use, add a transaction ledger, compensation and audit logs.
- The existing game's native dealer and other gamemodes are not controlled by this tablet.
- No truck image assets are shipped; the showroom uses glass cards and manufacturer names.
- Selling your current truck is blocked to avoid deleting an actively driven vehicle.

## Starter vehicles, achievements and resale

New players with no saved trucks receive one starter truck (Iveco preferred, Renault fallback) **on first opening the tablet garage**. Existing truck owners are marked as already granted; their original garage and tuning remain unchanged. The one-time grant is tracked in `data/globalmp-starters.db`, which must be backed up alongside the original freeroam and VTC databases. The current implementation does not automatically award the starter at connection/spawn before the tablet opens.

Prestige models have delivery milestones checked server-side: Mercedes Actros 25, Scania S/Super 50, Volvo FH16 100. These are purchases after unlocking, not free rewards. Model detection is name-based and needs testing against the actual OpenRoadMP catalog.

The active truck cannot be sold and players must retain at least one truck. Select another owned truck before selling. Sale refunds are 60% of the brand list price. The browser may not support native `confirm()`; the UI falls back to executing the request when unavailable.

**Important:** These changes have not yet been type-checked against the actual freeroam source or tested in-game. Do not overwrite your `data/` directory. On Ubuntu install with `npm install` if `tsc` is missing, then `npm run check` before restarting. Review compile errors before going live.
