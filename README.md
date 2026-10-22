# OpenRoadMP Scripts

Community scripts for our OpenRoadMP Ubuntu server.

## Included gamemode

`gamemodes/community/index.ts`:
- Player welcome messages
- `/rules`: community rules
- `/discord`: Discord invite
- `/website`: website URL
- `/helpcommunity`: list commands

### Configure

Edit `gamemodes/community/index.ts` and replace `REPLACE_ME` and `https://example.com` with your links.

### Install on Ubuntu

This repository includes only our custom gamemodes, not the complete OpenRoadMP server. If you cloned it into your home folder, link the custom gamemode into the existing server directory:

```bash
cd ~/OpenRoadMP-Scripts
git pull --ff-only
# Replace /opt/openroadmp if your server uses a different path.
ln -s "$HOME/OpenRoadMP-Scripts/gamemodes/community" /opt/openroadmp/gamemodes/community
```

Do not run `ln -s` if `/opt/openroadmp/gamemodes/community` already exists. Verify the folder paths with `pwd` first. If your server runs under a different user, it must have permission to read the linked directory.

Edit your existing server.cfg to include both modes:

```ini
gamemodes = [freeroam, community]
```

Restart the server once after changing server.cfg.

For subsequent script changes:

```bash
cd ~/OpenRoadMP-Scripts
git pull --ff-only
```

Then enter `gamemode restart community` in the **OpenRoadMP server console** (not the Linux shell).

## Notes

- Do not upload `server.cfg`, your server key, player databases or other secrets to a public repository.
- This has not yet been tested on your live Ubuntu server; check `server.log` if a gamemode fails to start.
- Documentation: https://openroadmp.com/docs/server and https://openroadmp.com/docs/scripting
