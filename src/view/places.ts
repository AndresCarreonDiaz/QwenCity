/**
 * The town map: named places with coordinates, and a heuristic that maps an
 * agent's current action text to where they are. Coordinates are in a 0..100
 * space; the frontend scales them to the canvas. This is what lets characters be
 * placed on a map and walk between buildings as their plans unfold.
 */
export type PlaceType = "cafe" | "bakery" | "home" | "park" | "plaza";

export interface Place {
  id: string;
  label: string;
  x: number;
  y: number;
  type: PlaceType;
}

// Laid out as a small city: Main Street (y=48) carries the downtown strip with
// the café and bakery facing off across the central boulevard (x=50), the plaza
// sits dead-center at the boulevard's heart (y=60) with a promenade (y=70)
// south of it, homes anchor the corners on residential avenues (x=13/x=87), and
// the park closes the boulevard at the bottom. The frontend draws the streets
// and routes characters along them, so coordinates here are load-bearing for
// the walkability of the city.
export const PLACES: Place[] = [
  { id: "cafe", label: "Maya's Café", x: 40, y: 34, type: "cafe" },
  { id: "bakery", label: "Ana's Bakery", x: 60, y: 34, type: "bakery" },
  { id: "maya_home", label: "Maya's Place", x: 13, y: 17, type: "home" },
  { id: "tom_home", label: "Tom's Place", x: 87, y: 17, type: "home" },
  { id: "ana_home", label: "Ana's Place", x: 87, y: 82, type: "home" },
  { id: "leo_home", label: "Leo's Place", x: 13, y: 82, type: "home" },
  { id: "park", label: "The Park", x: 50, y: 85, type: "park" },
  { id: "plaza", label: "Town Plaza", x: 50, y: 60, type: "plaza" },
];

const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));

/** which home belongs to which agent (default cast; others fall back to plaza) */
const HOME_BY_AGENT: Record<string, string> = {
  maya: "maya_home",
  tom: "tom_home",
  ana: "ana_home",
  leo: "leo_home",
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
  if (/\bbakery|pastr\w*|bread|flour|dough|inventory|restock|shelv\w*|display case|oven\b/.test(a)) return "bakery";
  if (/\bcaf[eé]|coffee|barista|tables|counter|opening up|brew|espresso|shop\b/.test(a)) return "cafe";
  if (/\bpark|stroll|walk|outside|air|garden|bench|neighbou?r\b/.test(a)) return "park";
  if (/\bhome|shower|dress|sleep|bed|waking|nap|rest|breakfast|winding down|\bread|journal|window\b/.test(a)) {
    return HOME_BY_AGENT[agentId] ?? "plaza";
  }
  if (/\btalking with|chat|conversation|catch up|clear the air|apolog\b/.test(a)) return "plaza";
  return "plaza";
}
