export type ProfileId = "nokia3310" | "generic";

export interface Profile {
  id: ProfileId;
  name: string;
  cols: number;
  rows: number;
}

export const PROFILES: Record<ProfileId, Profile> = {
  nokia3310: { id: "nokia3310", name: "Nokia 3310", cols: 14, rows: 6 },
  generic: { id: "generic", name: "Generic", cols: 20, rows: 10 },
};

export const DEFAULT_PROFILE: ProfileId = "nokia3310";

export function isProfileId(x: unknown): x is ProfileId {
  return x === "nokia3310" || x === "generic";
}

export interface Link {
  label: string;
  href: string;
}

export interface Input {
  name: string;
  /** Path the query is submitted to as `?q=`. */
  action: string;
}

export interface Card {
  id: string;
  title: string;
  lines: string[];
  links: Link[];
  input?: Input;
}

export interface Deck {
  path: string;
  cards: Card[];
  offline?: boolean;
  error?: boolean;
}
