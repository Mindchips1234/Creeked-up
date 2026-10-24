// Fish ID helper ("Fish scan").
//
// Why not photo AI? There's no free, reliable fish-ID model we can run here. iNaturalist's
// photo-ID service isn't public (access is by request and fee-based, per iNaturalist staff:
// https://forum.inaturalist.org/t/hidden-computer-vision-api/41775), and general image
// models don't know Ontario fish. So this is a quick visual key: tap what you see on the
// fish and it ranks the likely species. The traits are common field-guide marks written
// from general knowledge; double-check with a field guide or iNaturalist before keeping a fish.

const ID_TRAITS = [
  { id: "whiskers",   label: "Whiskers around the mouth" },
  { id: "adipose",    label: "Small fleshy fin between back fin and tail" },
  { id: "spiny",      label: "Sharp spines on the back fin" },
  { id: "tall",       label: "Tall, flat, round body" },
  { id: "long",       label: "Long, torpedo-shaped body" },
  { id: "duckbill",   label: "Flat, duck-bill snout with lots of teeth" },
  { id: "bars",       label: "Dark vertical bars" },
  { id: "sidestripe", label: "Dark stripe along the side" },
  { id: "spots",      label: "Spots or speckles" },
  { id: "redeye",     label: "Red eyes" },
  { id: "earflap",    label: "Coloured flap at the back of the gill cover" },
  { id: "glassyeye",  label: "Big, glassy, cloudy eyes" },
  { id: "whitetail",  label: "White tip on the bottom of the tail" },
  { id: "pinkstripe", label: "Pink or red stripe along the side" },
  { id: "whiteedge",  label: "White edge on the lower fins" },
  { id: "silver",     label: "Mostly silver, forked tail" },
  { id: "bigscales",  label: "Big gold or bronze scales" },
  { id: "suckermouth",label: "Mouth on the underside, thick lips" },
  { id: "yellow",     label: "Yellow or gold body" },
];

const ID_GUIDE = {
  "pumpkinseed":     { traits: ["spiny", "tall", "earflap", "spots"], check: "Orange-red spot on the tip of the ear flap, wavy blue lines on the cheek." },
  "bluegill":        { traits: ["spiny", "tall", "earflap", "bars"], check: "All-dark ear flap with no red spot, small mouth, often faint bars." },
  "rock-bass":       { traits: ["spiny", "tall", "redeye", "spots"], check: "Bright red eye and rows of dark spots; thicker than a sunfish." },
  "yellow-perch":    { traits: ["spiny", "yellow", "bars", "long"], check: "Yellow body with 6 to 8 dark bars, orange lower fins." },
  "brown-bullhead":  { traits: ["whiskers", "adipose"], check: "Square tail (not forked), brown with mottling, chin whiskers dark." },
  "channel-catfish": { traits: ["whiskers", "adipose", "spots", "silver"], check: "Deeply forked tail and small dark spots on a grey-silver body." },
  "white-sucker":    { traits: ["suckermouth", "long"], check: "Round mouth under the snout with thick, bumpy lips. No whiskers." },
  "common-carp":     { traits: ["whiskers", "bigscales", "suckermouth", "yellow"], check: "Two pairs of short whiskers, big scales, one long back fin." },
  "freshwater-drum": { traits: ["spiny", "silver", "suckermouth"], check: "Humped back, rounded tail, long back fin that runs almost to the tail." },
  "black-crappie":   { traits: ["spiny", "tall", "spots"], check: "Silver with black speckles all over, big mouth, 7 to 8 spines on the back fin." },
  "smallmouth-bass": { traits: ["spiny", "bars", "redeye", "yellow"], check: "Bronze with faint vertical bars. Jaw ends below the eye, not past it." },
  "largemouth-bass": { traits: ["spiny", "sidestripe"], check: "Dark stripe along the side. Jaw reaches past the back of the eye." },
  "walleye":         { traits: ["spiny", "long", "glassyeye", "whitetail", "yellow"], check: "White tip on the lower tail lobe and big glassy eyes. Sharp teeth." },
  "northern-pike":   { traits: ["long", "duckbill", "spots"], check: "Light, bean-shaped spots on a dark green body." },
  "muskellunge":     { traits: ["long", "duckbill", "bars", "spots"], check: "Dark bars or spots on a light body; tail lobes pointed. Usually much bigger than pike." },
  "brook-trout":     { traits: ["adipose", "spots", "whiteedge"], check: "Worm-like markings on the back, red spots with blue halos, white-edged lower fins." },
  "splake":          { traits: ["adipose", "spots", "whiteedge"], check: "Looks like a brook trout but with a slightly forked tail. Hard to tell apart." },
  "lake-trout":      { traits: ["adipose", "spots", "long", "whiteedge"], check: "Light spots on a dark grey body and a deeply forked tail." },
  "rainbow-trout":   { traits: ["adipose", "spots", "pinkstripe", "silver"], check: "Pink stripe along the side and black spots on the tail." },
  "brown-trout":     { traits: ["adipose", "spots", "yellow"], check: "Black and red spots, often with pale halos. Few or no spots on the tail." },
  "lake-whitefish":  { traits: ["adipose", "silver", "suckermouth"], check: "Small mouth under a blunt snout, silver body, no spots." },
  "coho-salmon":     { traits: ["adipose", "silver", "spots"], check: "Spots on the upper tail only. Gums white at the base of the teeth." },
  "chinook-salmon":  { traits: ["adipose", "silver", "spots"], check: "Spots on the whole tail. Black gums at the base of the teeth." },
  "atlantic-salmon": { traits: ["adipose", "silver", "spots"], check: "X-shaped spots, mostly above the side line. Few or no spots on the tail." },
  "aurora-trout":    { traits: ["adipose", "whiteedge"], check: "Like a brook trout but with few or no spots. Very rare, check the rules." },
};

// Ranks species by how many of the chosen traits they have. Species missing a chosen
// trait still show if they match others, so one wrong tap doesn't hide the right fish.
function identify(chosen) {
  if (!chosen.length) return [];
  return Object.entries(ID_GUIDE)
    .map(([id, g]) => {
      const hits = chosen.filter((t) => g.traits.includes(t)).length;
      return { id, hits, score: hits / chosen.length - (g.traits.length - hits) * 0.01, check: g.check };
    })
    .filter((r) => r.hits > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

if (typeof module !== "undefined") module.exports = { ID_TRAITS, ID_GUIDE, identify };
