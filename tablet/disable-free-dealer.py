#!/usr/bin/env python3
"""Idempotently disable the original free truck dealership without changing player data."""
from pathlib import Path
import sys
root=Path("/opt/openroadmp/gamemodes/freeroam")
f=root/"garage.ts"
if not f.exists(): sys.exit("Missing garage.ts; nothing changed")
src=f.read_text()
needle='...brands.map((brand) => ({ title: brand, content: dealer(player, brand, models) })),'
if needle in src:
    src=src.replace(needle,'// Free dealership removed: purchases are handled by the GlobalMP tablet.')
    f.write_text(src)
    print("Disabled original /garage free truck dealer; owned trucks remain accessible.")
elif "Free dealership removed: purchases" in src:
    print("Original free dealership already disabled.")
else:
    sys.exit("Unexpected garage.ts version. No changes made. Please send the source for review.")
print("Note: game-native vehicle switching, /car and admin functions need separate verification.")
