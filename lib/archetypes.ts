// One system: 3 axes -> 8 animals. Key = [making, wide, crowd] as 0/1.

export interface Archetype {
  key: string;
  animal: string;
  emoji: string;
  tagline: string;
  oneLiner: string;
  definition: string;
  thrivesIn: string;
  watchOut: string;
}

export const ARCHETYPES: Record<string, Archetype> = {
  "000": {
    key: "000",
    animal: "Owl",
    emoji: "🦉",
    tagline: "The Diagnostician",
    oneLiner: "You find the real problem before anyone builds the wrong thing.",
    definition:
      "Your bullets lean on framing verbs, stay in one area, and describe work you mostly did yourself.",
    thrivesIn: "Discovery, audits and research-heavy roles where getting the question right is the job.",
    watchOut: "Insight with no artefact attached is easy to forget. Show what got built because of it.",
  },
  "001": {
    key: "001",
    animal: "Elephant",
    emoji: "🐘",
    tagline: "The Sense-Maker",
    oneLiner: "You turn a room full of opinions into one shared picture.",
    definition:
      "Your bullets lean on framing verbs, stay in one area, and almost always involve other people.",
    thrivesIn: "Workshops, alignment and research ops, where many stakeholders need one answer.",
    watchOut: "Facilitation reads as soft unless you name the decision that came out of it.",
  },
  "010": {
    key: "010",
    animal: "Fox",
    emoji: "🦊",
    tagline: "The Strategist",
    oneLiner: "You spot patterns across fields that specialists miss.",
    definition:
      "Your bullets lean on framing verbs, range across several domains and disciplines, and are mostly your own work.",
    thrivesIn: "Strategy, innovation and zero-to-one scoping across unfamiliar territory.",
    watchOut: "Breadth without depth can look like dabbling. Anchor each domain with one hard result.",
  },
  "011": {
    key: "011",
    animal: "Dolphin",
    emoji: "🐬",
    tagline: "The Connector",
    oneLiner: "You carry ideas between teams that don't usually talk.",
    definition:
      "Your bullets lean on framing verbs, range widely, and almost always involve other people.",
    thrivesIn: "Service design, consultancy and cross-functional roles that sit between teams.",
    watchOut: "If every bullet is 'with stakeholders', it's hard to see what was yours.",
  },
  "100": {
    key: "100",
    animal: "Beaver",
    emoji: "🦫",
    tagline: "The Craftsperson",
    oneLiner: "You make the thing, and you make it properly.",
    definition:
      "Your bullets lean on making verbs, stay in one area, and describe hands-on work you did yourself.",
    thrivesIn: "Specialist IC roles where depth and polish in one product matter most.",
    watchOut: "Craft without context reads as execution only. Say why you made each call.",
  },
  "101": {
    key: "101",
    animal: "Bee",
    emoji: "🐝",
    tagline: "The Systems Builder",
    oneLiner: "You build the pieces other people build with.",
    definition:
      "Your bullets lean on making verbs, stay in one area, and almost always involve other people.",
    thrivesIn: "Design systems, platform teams and long-running products with many contributors.",
    watchOut: "Team output can hide your part. Use 'I' for the decisions you owned.",
  },
  "110": {
    key: "110",
    animal: "Octopus",
    emoji: "🐙",
    tagline: "The Multi-Maker",
    oneLiner: "You can pick up almost any tool and ship something with it.",
    definition:
      "Your bullets lean on making verbs, range across several domains and disciplines, and are mostly your own work.",
    thrivesIn: "Startups, freelance and founding roles where one person covers many jobs.",
    watchOut: "Lots of different builds can look scattered. Lead with the one that went deepest.",
  },
  "111": {
    key: "111",
    animal: "Wolf",
    emoji: "🐺",
    tagline: "Pack Leader",
    oneLiner: "You build things, across fields, with a team behind you.",
    definition:
      "Your bullets lean on making verbs, range across several domains and disciplines, and usually involve other people.",
    thrivesIn: "Lead and senior IC roles where you set direction and still make the work.",
    watchOut: "Doing everything with everyone can blur your specialism. Pick the one you want hired for.",
  },
};

export const AXES = {
  making: { left: "Framing", right: "Making" },
  wide: { left: "Deep", right: "Wide" },
  crowd: { left: "Solo", right: "Crowd" },
} as const;
