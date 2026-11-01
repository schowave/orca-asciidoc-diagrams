// PlantUML stdlib libraries bundled into the preview (lower-case, as in `!include <name/...>`).
// gcp, elastic and edgy are left out: their sources declare no license.
export const STDLIB = [
  'c4',
  'kubernetes',
  'k8s',
  'azure',
  'archimate',
  'eip',
  'domainstory',
  'office',
  'logos',
  'tupadr3',
]

/**
 * The libraries for this build: PLANTUML_STDLIB (comma-separated, e.g. "c4,awslib14") overrides the
 * default list above. Names are the lower-case stdlib folder names from
 * https://github.com/plantuml/plantuml-stdlib/tree/master/stdlib.
 */
export function selectedStdlib() {
  const env = process.env.PLANTUML_STDLIB
  if (!env) return STDLIB
  return env.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}
