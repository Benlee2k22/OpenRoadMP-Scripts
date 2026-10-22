// OpenRoadMP Community Essentials
// A standalone addon: does not replace the built-in freeroam mode.

const DISCORD_URL = "https://discord.gg/REPLACE_ME";
const WEBSITE_URL = "https://example.com";
const RULES = [
  "Respect other players and staff.",
  "No intentional ramming, blocking or trolling.",
  "Drive responsibly during organised convoys.",
  "No spam, harassment or discriminatory language.",
];

mp.events.on("gamemodeStarted", () => {
  mp.log("[community] Community Essentials loaded.");
});

mp.events.on("playerJoin", (player) => {
  mp.chat.send(player, "Welcome to the community server, " + player.name + "!");
  mp.chat.send(player, "Use /rules to read the rules and /discord for our community link.");
});

mp.commands.add("rules", "Read the server rules", (player) => {
  mp.chat.send(player, "--- Server Rules ---");
  for (let i = 0; i < RULES.length; i++) {
    mp.chat.send(player, (i + 1) + ". " + RULES[i]);
  }
});

mp.commands.add("discord", "Get the Discord invite", (player) => {
  mp.chat.send(player, "Join our Discord: " + DISCORD_URL);
});

mp.commands.add("website", "Get the server website", (player) => {
  mp.chat.send(player, "Website: " + WEBSITE_URL);
});

mp.commands.add("helpcommunity", "Show community commands", (player) => {
  mp.chat.send(player, "Community commands: /rules, /discord, /website, /helpcommunity");
});
