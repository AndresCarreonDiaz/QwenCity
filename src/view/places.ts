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

export const PLACES: Place[] = [
  { id: "cafe", label: "Maya's Café", x: 38, y: 44, type: "cafe" },
  { id: "bakery", label: "Ana's Bakery", x: 62, y: 40, type: "bakery" },
  { id: "maya_home", label: "Maya's Place", x: 16, y: 20, type: "home" },
  { id: "tom_home", label: "Tom's Place", x: 84, y: 22, type: "home" },
  { id: "ana_home", label: "Ana's Place", x: 86, y: 72, type: "home" },
  { id: "leo_home", label: "Leo's Place", x: 14, y: 76, type: "home" },
  { id: "park", label: "The Park", x: 50, y: 78, type: "park" },
  { id: "plaza", label: "Town Plaza", x: 50, y: 52, type: "plaza" },
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
  if (/\bbakery|pastry|bread|flour|dough|inventory|restock|oven\b/.test(a)) return "bakery";
  if (/\bcaf[eé]|coffee|barista|tables|counter|opening up|brew|espresso|shop\b/.test(a)) return "cafe";
  if (/\bpark|stroll|walk|outside|air|garden|bench|neighbou?r\b/.test(a)) return "park";
  if (/\bhome|shower|dress|sleep|bed|waking|nap|rest|breakfast|winding down\b/.test(a)) {
    return HOME_BY_AGENT[agentId] ?? "plaza";
  }
  if (/\btalking with|chat|conversation|catch up|clear the air|apolog\b/.test(a)) return "plaza";
  return "plaza";
}
