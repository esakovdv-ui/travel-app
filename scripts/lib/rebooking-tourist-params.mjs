/**
 * Парсинг «Детализация по детям» и расчёт параметров tourists для ссылок /rebooking.
 */

const MAX_KIDS_IN_URL = 3;
const MIN_CHILD_AGE = 0;
const MAX_CHILD_AGE = 15;
const MAX_ADULTS_TOURVISOR = 6;

/**
 * @param {string} raw — например «4 дет.: 7, 8 лет» или «2 дет.: 1, 3 лет»
 * @returns {{ declaredKids: number, ages: number[] }}
 */
export function parseChildrenDetails(raw) {
  const text = String(raw || '').trim();
  if (!text) return { declaredKids: 0, ages: [] };

  const countMatch = text.match(/(\d+)\s*дет/i);
  const declaredKids = countMatch ? Number(countMatch[1]) : 0;

  const part = text.includes(':') ? text.split(':').slice(1).join(':') : text;
  const ages = [...part.matchAll(/\d+/g)].map((m) => Number(m[0]));

  return { declaredKids, ages };
}

/**
 * @param {{ people?: number|string, childrenDetails?: string }} input
 * @returns {{
 *   people: number|undefined,
 *   adults: number|undefined,
 *   kids: number,
 *   kid1?: number,
 *   kid2?: number,
 *   kid3?: number,
 *   warnings: string[],
 * }}
 */
export function buildTouristParams(input) {
  const warnings = [];
  const peopleRaw = input.people;
  const people =
    peopleRaw != null && peopleRaw !== '' && Number.isFinite(Number(peopleRaw))
      ? Math.max(0, Math.round(Number(peopleRaw)))
      : undefined;

  const { declaredKids, ages } = parseChildrenDetails(input.childrenDetails);

  if (declaredKids === 0 && ages.length === 0) {
    return {
      people,
      adults: people,
      kids: 0,
      warnings,
    };
  }

  const childAges = ages.filter((a) => a >= MIN_CHILD_AGE && a <= MAX_CHILD_AGE);
  const teenCount = ages.filter((a) => a > MAX_CHILD_AGE).length;
  if (teenCount > 0) {
    warnings.push(`ages_16_plus:${teenCount}`);
  }

  let selectedAges = [...childAges];
  if (declaredKids > MAX_KIDS_IN_URL || selectedAges.length > MAX_KIDS_IN_URL) {
    selectedAges = [...childAges].sort((a, b) => b - a).slice(0, MAX_KIDS_IN_URL);
    if (declaredKids > MAX_KIDS_IN_URL) {
      warnings.push(`kids_capped_to_${MAX_KIDS_IN_URL}_oldest`);
    }
  }

  if (declaredKids > 0 && selectedAges.length < declaredKids && selectedAges.length < declaredKids) {
    if (ages.length < declaredKids) {
      warnings.push(`ages_missing:${declaredKids - ages.length}`);
    }
  }

  const kids = Math.min(MAX_KIDS_IN_URL, selectedAges.length);
  const kidSlots = selectedAges.slice(0, kids);

  let adults =
    people != null ? Math.max(people - kids, 0) : undefined;

  if (adults != null && adults > MAX_ADULTS_TOURVISOR) {
    warnings.push(`adults_capped_to_${MAX_ADULTS_TOURVISOR}`);
    adults = MAX_ADULTS_TOURVISOR;
  }

  const result = {
    people,
    adults,
    kids,
    warnings,
  };

  if (kidSlots[0] != null) result.kid1 = kidSlots[0];
  if (kidSlots[1] != null) result.kid2 = kidSlots[1];
  if (kidSlots[2] != null) result.kid3 = kidSlots[2];

  return result;
}
