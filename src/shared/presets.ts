export type GenreFieldType = 'text' | 'number' | 'list'

export interface GenreFieldDef {
  /** Machine-readable key used in YAML frontmatter and internal data. */
  key: string
  /** Display label shown in the Tracking callout and field editor. */
  label: string
  /** Field type — affects extraction schema and rendering. */
  type: GenreFieldType
  /** Help text shown to the LLM and (optionally) in the UI. */
  description: string
}

export interface GlossaryEntry {
  /** The ambiguous word or phrase. */
  term: string
  /** What the term means in this genre. */
  meaning: string
}

export interface GenrePreset {
  id: string
  name: string
  /** One-line description shown in the preset dropdown. */
  tagline: string
  /** Callout title used in vault character files. */
  characterSectionLabel: string
  /** Callout title used in vault location files. */
  locationSectionLabel: string
  characterFields: GenreFieldDef[]
  locationFields: GenreFieldDef[]
  /**
   * Genre-specific vocabulary hints injected into extraction prompts. Helps the
   * model disambiguate terms like "boss", "mate", or "bond" that carry a
   * technical meaning inside the genre.
   */
  glossary: GlossaryEntry[]
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    id: 'none',
    name: 'None (no custom tracking)',
    tagline: 'Standard MVM output with no genre-specific fields.',
    characterSectionLabel: '',
    locationSectionLabel: '',
    characterFields: [],
    locationFields: [],
    glossary: []
  },
  {
    id: 'litrpg',
    name: 'LitRPG / Progression Fantasy',
    tagline: 'Levels, classes, spells, skills, stat progression.',
    characterSectionLabel: 'Character Sheet',
    locationSectionLabel: 'Zone Info',
    characterFields: [
      {
        key: 'level',
        label: 'Level',
        type: 'number',
        description:
          'Current character level or power tier. Null if unknown.'
      },
      {
        key: 'class',
        label: 'Class',
        type: 'text',
        description:
          'Character class, path, or profession (e.g. "Mage", "Rogue", "Cultivator of the Iron Fist Path").'
      },
      {
        key: 'spells-abilities',
        label: 'Spells / Abilities',
        type: 'list',
        description:
          'Named spells, abilities, techniques, or skills the character demonstrates.'
      },
      {
        key: 'stats',
        label: 'Stats',
        type: 'text',
        description:
          'Numerical stats or attributes if the story uses an explicit stat block.'
      }
    ],
    locationFields: [],
    glossary: [
      {
        term: 'boss',
        meaning:
          'A high-tier monster, dungeon boss, or major antagonist encounter — NOT a workplace supervisor.'
      },
      {
        term: 'class',
        meaning:
          'A character archetype or progression path (Mage, Warrior, Cultivator, etc.) — NOT a school lesson or social class.'
      },
      {
        term: 'level',
        meaning:
          'A character power tier in the game system — NOT a floor of a building.'
      },
      {
        term: 'party',
        meaning: 'An adventuring group — NOT a social gathering.'
      },
      {
        term: 'raid',
        meaning:
          'A coordinated group combat event — NOT a military invasion of a village.'
      },
      {
        term: 'farm',
        meaning:
          'Grinding monsters or resources — NOT agricultural work.'
      },
      {
        term: 'grind',
        meaning:
          'Repeated combat or activity for progression — NOT physical dance or labor.'
      },
      {
        term: 'dungeon',
        meaning:
          'An instanced combat location with monsters and loot — NOT a prison cell.'
      },
      {
        term: 'mob',
        meaning:
          'A monster enemy (short for "mobile") — NOT a crowd of people.'
      },
      {
        term: 'tank',
        meaning:
          'A melee character absorbing damage for the party — NOT an armored vehicle.'
      },
      {
        term: 'dps',
        meaning: 'Damage-dealer role or damage-per-second metric.'
      },
      {
        term: 'healer',
        meaning:
          'A character focused on restoring health — profession context.'
      },
      {
        term: 'skill',
        meaning:
          'A named learnable ability in the progression system, not just general competence.'
      }
    ]
  },
  {
    id: 'romantasy',
    name: 'Romantasy',
    tagline: 'Relationship status, emotional arcs, magical bonds.',
    characterSectionLabel: 'Romance & Magic',
    locationSectionLabel: 'Atmosphere',
    characterFields: [
      {
        key: 'romantic-interest',
        label: 'Romantic Interest',
        type: 'text',
        description:
          'Name of the character this character is drawn to, if any.'
      },
      {
        key: 'relationship-status',
        label: 'Relationship Status',
        type: 'text',
        description:
          'Current relationship state, e.g. "enemies", "reluctantly allied", "bonded".'
      },
      {
        key: 'magical-abilities',
        label: 'Magical Abilities',
        type: 'list',
        description:
          'Named magical powers, bonds, or gifts.'
      },
      {
        key: 'emotional-arc',
        label: 'Emotional Arc',
        type: 'text',
        description:
          'Current emotional trajectory in the story so far.'
      }
    ],
    locationFields: [
      {
        key: 'mood',
        label: 'Mood',
        type: 'text',
        description:
          'The dominant atmosphere or feeling of this location.'
      }
    ],
    glossary: [
      {
        term: 'mate',
        meaning:
          'A destined romantic/magical partner in fated-mate fantasy — NOT a friend or workplace colleague.'
      },
      {
        term: 'bond',
        meaning:
          'A magical or soul-level connection between two characters — NOT an adhesive or financial instrument.'
      },
      {
        term: 'heat',
        meaning:
          'A period of intense attraction or reproductive cycle in shifter romance — NOT just warm temperature (in context).'
      },
      {
        term: 'alpha',
        meaning:
          'A dominant role or archetype, often in shifter/werewolf romance.'
      },
      {
        term: 'pack',
        meaning:
          'A social group of shifters or supernatural beings — NOT a container.'
      }
    ]
  },
  {
    id: 'mystery',
    name: 'Mystery / Thriller',
    tagline: 'Alibis, motives, suspicion, clues.',
    characterSectionLabel: 'Case File',
    locationSectionLabel: 'Crime Scene',
    characterFields: [
      {
        key: 'alibi',
        label: 'Alibi',
        type: 'text',
        description:
          'Where the character claims to have been at key times.'
      },
      {
        key: 'motive',
        label: 'Motive',
        type: 'text',
        description: 'Potential motive for the crime, if any.'
      },
      {
        key: 'suspicion-level',
        label: 'Suspicion Level',
        type: 'text',
        description:
          'How suspicious this character should appear to the reader: "cleared", "low", "medium", "high", "prime suspect".'
      }
    ],
    locationFields: [
      {
        key: 'evidence-found',
        label: 'Evidence Found',
        type: 'list',
        description:
          'Clues, objects, or evidence located here.'
      }
    ],
    glossary: [
      {
        term: 'alibi',
        meaning:
          'A claimed location or activity during a crime — legally significant.'
      },
      {
        term: 'motive',
        meaning:
          'A reason to commit a crime — narratively important; track carefully.'
      },
      {
        term: 'suspect',
        meaning:
          'A person under investigation — can be definitive or speculative.'
      }
    ]
  },
  {
    id: 'epic-fantasy',
    name: 'Epic Fantasy',
    tagline: 'Factions, prophecies, magic systems, bloodlines.',
    characterSectionLabel: 'Lineage & Power',
    locationSectionLabel: 'Realm',
    characterFields: [
      {
        key: 'faction-allegiance',
        label: 'Faction / Allegiance',
        type: 'text',
        description:
          'The political, religious, or ideological group this character belongs to.'
      },
      {
        key: 'bloodline-heritage',
        label: 'Bloodline / Heritage',
        type: 'text',
        description:
          'Notable ancestry, race, or birthright.'
      },
      {
        key: 'magical-traits',
        label: 'Magical Traits',
        type: 'list',
        description:
          'Inherent magical abilities, artifacts wielded, or supernatural qualities.'
      }
    ],
    locationFields: [
      {
        key: 'ruler-authority',
        label: 'Ruler / Authority',
        type: 'text',
        description:
          'Who governs or controls this place, if relevant.'
      },
      {
        key: 'controlling-faction',
        label: 'Controlling Faction',
        type: 'text',
        description:
          'Political or religious faction dominant here.'
      }
    ],
    glossary: [
      {
        term: 'bloodline',
        meaning:
          'A hereditary lineage with magical or political significance.'
      },
      {
        term: 'prophecy',
        meaning:
          'A foretelling that shapes the narrative — worth tracking across chapters.'
      },
      {
        term: 'artifact',
        meaning:
          'A named magical object with story significance — NOT any generic item.'
      },
      {
        term: 'faction',
        meaning:
          'An organized political, religious, or military group.'
      }
    ]
  },
  {
    id: 'custom',
    name: 'Custom (define your own fields)',
    tagline: 'Pick any fields you want for your world.',
    characterSectionLabel: 'Tracking',
    locationSectionLabel: 'Tracking',
    characterFields: [],
    locationFields: [],
    glossary: []
  }
]

/** Derive a machine-readable key from a human label. */
export function deriveFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Returns the preset with the given id, or undefined. */
export function findPreset(id: string): GenrePreset | undefined {
  return GENRE_PRESETS.find((p) => p.id === id)
}

/**
 * True when the given field lists exactly match the preset's fields
 * (deep equality by key/label/type/description ordering).
 */
export function fieldsMatchPreset(
  characterFields: GenreFieldDef[],
  locationFields: GenreFieldDef[],
  preset: GenrePreset
): boolean {
  return (
    fieldListsEqual(characterFields, preset.characterFields) &&
    fieldListsEqual(locationFields, preset.locationFields)
  )
}

function fieldListsEqual(a: GenreFieldDef[], b: GenreFieldDef[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!
    const y = b[i]!
    if (
      x.key !== y.key ||
      x.label !== y.label ||
      x.type !== y.type ||
      x.description !== y.description
    ) {
      return false
    }
  }
  return true
}

/**
 * Return a deep copy of the preset's fields so callers can mutate freely.
 */
export function cloneFields(fields: GenreFieldDef[]): GenreFieldDef[] {
  return fields.map((f) => ({ ...f }))
}
