import type { ConditionDef } from '@/types'

export const CONDITIONS: ConditionDef[] = [
  { id: 'blinded',       name: 'Blinded',       text: "Can't see; auto-fails sight checks. Attacks vs it have advantage; its attacks have disadvantage." },
  { id: 'charmed',       name: 'Charmed',       text: "Can't attack the charmer or target them with harmful effects. Charmer has advantage on social checks." },
  { id: 'deafened',      name: 'Deafened',      text: "Can't hear; auto-fails checks requiring hearing." },
  { id: 'frightened',    name: 'Frightened',    text: 'Disadvantage on checks/attacks while source of fear is in line of sight. Cannot willingly move closer.' },
  { id: 'grappled',      name: 'Grappled',      text: 'Speed becomes 0; ends if grappler is incapacitated or moved out of reach.' },
  { id: 'incapacitated', name: 'Incapacitated', text: "Can't take actions or reactions." },
  { id: 'invisible',     name: 'Invisible',     text: 'Attacks vs it have disadvantage; its attacks have advantage.' },
  { id: 'paralyzed',     name: 'Paralyzed',     text: "Incapacitated, can't move/speak. Auto-fails Str/Dex saves. Attacks vs it have advantage; hits within 5 ft. are critical." },
  { id: 'petrified',     name: 'Petrified',     text: 'Transformed to stone; incapacitated. Resistant to all damage; immune to poison/disease.' },
  { id: 'poisoned',      name: 'Poisoned',      text: 'Disadvantage on attack rolls and ability checks.' },
  { id: 'prone',         name: 'Prone',         text: 'Only crawl. Attacks vs it have advantage if within 5 ft., else disadvantage. Its attacks have disadvantage.' },
  { id: 'restrained',    name: 'Restrained',    text: 'Speed 0; attacks vs it have advantage; its attacks have disadvantage; disadvantage on Dex saves.' },
  { id: 'stunned',       name: 'Stunned',       text: "Incapacitated, can't move, speaks falteringly. Auto-fails Str/Dex saves. Attacks vs it have advantage." },
  { id: 'unconscious',   name: 'Unconscious',   text: 'Incapacitated, drops what it holds, falls prone. Auto-fails Str/Dex saves. Hits within 5 ft. are critical.' },
  { id: 'exhaustion',    name: 'Exhaustion',    text: 'Levels 1–6 with escalating penalties (disadv on checks → speed halved → disadv on attacks/saves → HP max halved → speed 0 → death).' },
]
