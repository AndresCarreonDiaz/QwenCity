/**
 * The town map: named places with coordinates, and a heuristic that maps an
 * agent's current action text to where they are. Coordinates are in a 0..100
 * space; the frontend scales them to the canvas. This is what lets characters be
 * placed on a map and walk between buildings as their plans unfold.
 */
export type PlaceType = "cafe" | "bakery" | "home" | "park" | "plaza" | "shop";

export interface Place {
  id: string;
  label: string;
  x: number;
  y: number;
  type: PlaceType;
  /** what's physically around a character standing here — fed into decision
   * prompts so actions reference real surroundings (and into nothing else) */
  flavor: string;
  /** a position-only anchor: the building is already drawn by the decor layer, so
   * the frontend places characters here without drawing another structure */
  anchor?: boolean;
}

// Laid out as a small city: Main Street (y=48) carries the downtown strip with
// the café and bakery facing off across the central boulevard (x=50), the plaza
// sits dead-center at the boulevard's heart (y=60) with a promenade (y=70)
// south of it, homes anchor the corners on residential avenues (x=13/x=87), and
// the park closes the boulevard at the bottom. The frontend draws the streets
// and routes characters along them, so coordinates here are load-bearing for
// the walkability of the city.
export const PLACES: Place[] = [
  { id: "cafe", label: "Maya's Café", x: 40, y: 34, type: "cafe", flavor: "the espresso machine, the pastry case, corner tables with regulars, outdoor tables under an umbrella, big windows onto Main Street, the rival bakery across the boulevard" },
  { id: "bakery", label: "Ana's Bakery", x: 60, y: 34, type: "bakery", flavor: "the bread oven, the display case, sacks of flour, the flower cart out front, the shop counter, the rival café across the boulevard" },
  { id: "maya_home", label: "Maya's Place", x: 13, y: 17, type: "home", flavor: "her kitchen, a worn couch, a small desk by the window overlooking the residential avenue" },
  { id: "tom_home", label: "Tom's Place", x: 87, y: 17, type: "home", flavor: "his kitchen counter, an old armchair, a journal on the desk, a window facing the street" },
  { id: "ana_home", label: "Ana's Place", x: 87, y: 82, type: "home", flavor: "her tidy kitchen, a ledger on the table, a balcony over the promenade" },
  { id: "leo_home", label: "Leo's Place", x: 13, y: 82, type: "home", flavor: "his delivery bike by the porch, a cluttered workbench, a radio in the kitchen" },
  { id: "park", label: "The Park", x: 50, y: 85, type: "park", flavor: "benches under the trees, the lawn, a quiet path, birdsong" },
  { id: "plaza", label: "Town Plaza", x: 50, y: 60, type: "plaza", flavor: "the stone fountain, benches, flower planters, street lamps, the clock tower, the diner on the corner" },
  // anchor places — the building already exists in the decor layer; these just give
  // the new residents a spot to stand at their own shop (no second structure drawn).
  { id: "flowershop", label: "The Flower Shop", x: 31, y: 35, type: "shop", anchor: true, flavor: "buckets of cut flowers, the cooler, the little bell over the door, the storefront she's slowly bringing back to life" },
  { id: "diner", label: "The Diner", x: 30, y: 58, type: "shop", anchor: true, flavor: "the counter and stools, the griddle, booths by the window, the pie case, regulars nursing coffee" },
  { id: "hotel", label: "The Plaza Hotel", x: 78, y: 34, type: "shop", anchor: true, flavor: "the front desk, the key rack, the quiet lobby, the guest ledger, a window over the plaza" },
  // more places to go — all anchors at existing decor buildings (no new structures)
  { id: "bookshop", label: "The Bookshop", x: 68, y: 35, type: "shop", anchor: true, flavor: "shelves of secondhand books, a reading nook by the window, the little bell, dust motes in the light" },
  { id: "townhall", label: "The Town Hall", x: 68, y: 58, type: "shop", anchor: true, flavor: "the public notice board, the records room, the meeting hall, the clerk's window, the old town seal" },
  { id: "market", label: "The Market", x: 22, y: 34, type: "shop", anchor: true, flavor: "produce crates, the grocer's scale, the bread rack, neighbours filling their baskets, the bell over the door" },
  { id: "tavern", label: "The Tavern", x: 28, y: 82, type: "shop", anchor: true, flavor: "the long bar, a few worn booths, a chalkboard of specials, low evening light, regulars over a pint" },
  { id: "clinic", label: "The Clinic", x: 74, y: 82, type: "shop", anchor: true, flavor: "the waiting bench, the doctor's shingle, a jar of lollipops on the desk, the quiet examining room" },
  // The South Quarter (phase-2 map expansion): a greener district below the park
  { id: "school", label: "The School", x: 24, y: 112, type: "shop", anchor: true, flavor: "the little schoolhouse, rows of desks, a chalkboard, the bell in the yard, children's drawings taped to the window" },
  { id: "library", label: "The Library", x: 76, y: 112, type: "shop", anchor: true, flavor: "the reading room, tall stacks, the card catalogue, a green desk lamp, the hush of turning pages" },
  { id: "garden", label: "The Community Garden", x: 26, y: 128, type: "shop", anchor: true, flavor: "raised beds, the greenhouse, watering cans, tomato vines, a wheelbarrow, neighbours working the soil" },
  // ===== CITY EXPANSION destinations: Uptown, West/East avenues, Midtown lane, South waterfront =====
  { id: "up_gallery", label: "The North Gallery", x: 22, y: 10.5, type: "shop", anchor: true, flavor: "Whitewashed halls hung with local canvases, the smell of fresh paint and floor wax drifting out to the sidewalk." },
  { id: "up_museum", label: "Uptown Museum", x: 30, y: 10.5, type: "shop", anchor: true, flavor: "Marble steps climb past glass cases of dusty relics glowing under soft amber spotlights." },
  { id: "up_theatre", label: "The Marquee Theatre", x: 37, y: 10.5, type: "shop", anchor: true, flavor: "A red-brick playhouse where the marquee bulbs buzz and velvet curtains muffle a rehearsing chorus." },
  { id: "up_inn", label: "The Grand North Inn", x: 66, y: 10.5, type: "shop", anchor: true, flavor: "A teal-and-cream five-story lobby smelling of coffee and rain-damp coats, bellhops nodding by the brass doors." },
  { id: "chapel", label: "West Avenue Chapel", x: 6, y: 39, type: "shop", anchor: true, flavor: "Worn stone steps, a little bell up in the steeple, candlelight falling through narrow windows, and the quiet smell of old wood and beeswax." },
  { id: "laundromat", label: "The Washhouse", x: 19, y: 60, type: "shop", anchor: true, flavor: "Rows of humming machines, the warm smell of soap and dryer lint, coins lined up on the sill, and neighbours trading gossip over the spin cycle." },
  { id: "east_gym", label: "The East Gym", x: 81, y: 60, type: "shop", anchor: true, flavor: "the squeak of sneakers on a rubber floor, a rack of chalked dumbbells, a fogged mirror wall, and a heavy bag swaying under the low hum of a treadmill." },
  { id: "east_barber", label: "The Barbershop", x: 95, y: 74, type: "shop", anchor: true, flavor: "a red-and-white pole turning out front, warm lather and hot towels, the snip of scissors and low buzz of clippers over a cracked leather chair." },
  { id: "toy_shop", label: "The Toy Shop", x: 44, y: 95, type: "shop", anchor: true, flavor: "A window crammed with wooden trains and paper kites, shelves of marbles and spinning tops, a rocking horse by the door, and a little brass bell that jingles on the way in." },
  { id: "midtown_tearoom", label: "The Midtown Tearoom", x: 56, y: 95, type: "shop", anchor: true, flavor: "Steam curling off a fat brown teapot, tiered plates of scones and clotted cream, lace doilies and mismatched china, with the garden hedge framing the window." },
  { id: "teahouse", label: "The Lakeside Teahouse", x: 33, y: 108.5, type: "shop", anchor: true, flavor: "steam curling off celadon cups, low tables at the window, the lake glittering just beyond the glass." },
  { id: "boathouse", label: "The Boathouse", x: 50, y: 108.5, type: "shop", anchor: true, flavor: "rowboats racked to the rafters, oars and life-rings on their pegs, the smell of varnish and cool lake water drifting up the ramp." },
  { id: "lakeview_inn", label: "The Lakeview Inn", x: 88, y: 124, type: "shop", anchor: true, flavor: "a little inn with rooms facing the water, rocking chairs on the porch, lanterns warming to amber at dusk." },
];

/** public destinations a character can head to (everything but private homes) —
 *  offered in the decision prompt so the cast actually spreads across the town */
export const DESTINATIONS = PLACES.filter((p) => p.type !== "home").map((p) => p.label);

const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));

/** which home belongs to which agent (default cast; others fall back to plaza) */
const HOME_BY_AGENT: Record<string, string> = {
  maya: "maya_home",
  tom: "tom_home",
  ana: "ana_home",
  leo: "leo_home",
  // the new residents live at/above their own shop
  nadia: "flowershop",
  ruth: "diner",
  sam: "bakery",
  gil: "hotel",
};

export function placeById(id: string): Place | undefined {
  return PLACE_BY_ID.get(id);
}

/**
 * Infer a character's location from their current action text. Keyword-based and
 * deliberately forgiving — good enough to place sprites believably and let them
 * migrate between buildings as the day goes on.
 */
export function locationForAction(agentId: string, action: string): string {
  const a = action.toLowerCase();
  // ===== CITY EXPANSION destinations (checked first; specific keywords) =====
  if (/\bgallery\b|\bpaintings?\b|\bcanvas\b|\bmural\b|\bsketch\w*|\bartwork\b|\bart show\b|\bart opening\b|\bart\b/.test(a)) return "up_gallery";
  if (/\bmuseum\b|\bexhibit\w*|\bartifacts?\b|\brelics?\b|\bfossils?\b|\btours?\b|\bhistory\b|\bdisplay(?!\s+case)/.test(a)) return "up_museum";
  if (/\btheatre\b|\btheater\b|\bmarquee\b|\bmatinee\b|\bcurtain\b|\bplaybill\b|\brehears\w*|\bthe play\b|\bthe show\b/.test(a)) return "up_theatre";
  if (/\bchapel\b|\bsteeple\b|\bpews?\b|\bprayer\b|\bprayed\b|\bpraying\b|\bcandlelit\b|\bcandles?\b|\bsermon\b|\bchurch service\b|\bsunday service\b/.test(a)) return "chapel";
  if (/\blaundr\w*|\bwashhouse\b|\bwashing\b|\bdryer\b|\blinens?\b|\bfolding\b|\bgossip\w*|\bsoap\b/.test(a)) return "laundromat";
  if (/\bgym\b|\bgymnasium\b|\bworkout\b|\bworking out\b|\btreadmill\b|\bdumbbells?\b|\bweights?\b|\bexercis\w*|\blifting\b|\bsweat\b|\bsweating\b/.test(a)) return "east_gym";
  if (/\bbarber\w*|\bhaircuts?\b|\bshave\b|\bshaving\b|\bclippers?\b|\brazor\b|\bgrooming\b|\btrim\b|\btrimming\b|\bbarber chair\b/.test(a)) return "east_barber";
  if (/\btoy shop\b|\btoyshop\b|\btoys?\b|\bwooden train\b|\bkite\b|\bmarbles?\b|\bspinning top\b|\brocking horse\b/.test(a)) return "toy_shop";
  if (/\btearoom\b|\bteapot\b|\bscones?\b|\bclotted cream\b|\bteacups?\b|\btea leaves\b|\bdoil(?:y|ies)\b|\bsaucers?\b|\bcrumpets?\b/.test(a)) return "midtown_tearoom";
  if (/\bteahouse\b|\blakeside teahouse\b|\btea\b|\bcup of tea\b|\bpot of tea\b|\bbrewing tea\b/.test(a)) return "teahouse";
  if (/\bboathouse\b|\bboats?\b|\browboats?\b|\boars?\b|\bdock\b|\bpaddle\w*|\blake\b|\bramp\b|\bjetty\b/.test(a)) return "boathouse";
  if (/\blakeview\b|\blakeview inn\b|\bporch\b|\brocking chair\b|\blantern\b/.test(a)) return "lakeview_inn";
  if (/\binn\b|\bgrand north\b|\bnorth inn\b|\bgrand inn\b|\bnightcap\b|\bbell(?:boy|hop)\b|\bsuitcase\b/.test(a)) return "up_inn";
  // new-resident shops (checked before the café's broad keywords so they win)
  if (/\bflower|floral|florist|bouquet|petal|vase|blooms?|stems?\b/.test(a)) return "flowershop";
  if (/\bdiner|griddle|booth|short-order|pie case|milkshake|waitress|serving breakfast\b/.test(a)) return "diner";
  if (/\bhotel|lobby|front desk|guest|check-in|check in|key rack|reception\b/.test(a)) return "hotel";
  if (/\bbookshop|bookstore|browse|browsing|paperback|novel|a book\b|reading nook\b/.test(a)) return "bookshop";
  if (/\btown hall|townhall|notice board|records|the clerk|permit|the hall\b/.test(a)) return "townhall";
  if (/\bmarket|grocer|groceries|produce|errands|the basket|picking up|shopping\b/.test(a)) return "market";
  if (/\btavern|pub\b|the bar\b|a pint|for a drink|ale\b/.test(a)) return "tavern";
  if (/\bclinic|the doctor|nurse|checkup|check-up|unwell|feeling sick|prescription\b/.test(a)) return "clinic";
  if (/\bschool|schoolhouse|classroom|pupils|a lesson|teach\w*|chalkboard\b/.test(a)) return "school";
  if (/\blibrary|librarian|the stacks|archive|reading room|study\b/.test(a)) return "library";
  if (/\bgarden|greenhouse|seedlings?|planting|watering|the soil|raised beds?|weeding\b/.test(a)) return "garden";
  if (/\bbakery|pastr\w*|bread|flour|dough|inventory|restock|shelv\w*|display case|oven|apprentice|recipe\b/.test(a)) return "bakery";
  if (/\bcaf[eé]|coffee|barista|tables|counter|opening up|brew|espresso|shop\b/.test(a)) return "cafe";
  if (/\bpark|stroll|walk|outside|air|garden|bench|neighbou?r\b/.test(a)) return "park";
  if (/\bhome|shower|dress|sleep|bed|waking|nap|rest|breakfast|winding down|\bread|journal|window\b/.test(a)) {
    return HOME_BY_AGENT[agentId] ?? "plaza";
  }
  if (/\btalking with|chat|conversation|catch up|clear the air|apolog|meeting|gather|town square|the plaza\b/.test(a)) return "plaza";
  return "plaza";
}
