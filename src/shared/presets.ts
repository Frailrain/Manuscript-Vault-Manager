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
}

export const GENRE_PRESETS: GenrePreset[] = [
  {
    id: 'none',
    name: 'None (no custom tracking)',
    tagline: 'Standard MVM output with no genre-specific fields.',
    characterSectionLabel: '',
    locationSectionLabel: '',
    characterFields: [],
    locationFields: []
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
    locationFields: [
      {
        key: 'danger-level',
        label: 'Danger Level',
        type: 'text',
        description:
          "Rating, tier, zone name, or descriptor of the location's difficulty or threat."
      },
      {
        key: 'notable-loot',
        label: 'Notable Loot',
        type: 'list',
        description:
          'Named items, resources, or rewards found here.'
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
    ]
  },
  {
    id: 'custom',
    name: 'Custom (define your own fields)',
    tagline: 'Pick any fields you want for your world.',
    characterSectionLabel: 'Tracking',
    locationSectionLabel: 'Tracking',
    characterFields: [],
    locationFields: []
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
