// =====================================================================
// robot/sources/liste.mjs — grands marathons et semis, depuis robot/liste-marathons.json
// (liste tenue à la main, une mise à jour par an suffit).
// L'identifiant est le nom + l'année : l'édition suivante devient une nouvelle course.
// =====================================================================
import { readFile } from 'node:fs/promises';
import { slug } from '../outils.mjs';

export async function lire() {
  const { courses } = JSON.parse(await readFile(new URL('../liste-marathons.json', import.meta.url), 'utf8'));
  return courses.map((c) => ({
    nom: c.nom,
    date_course: c.date,
    lieu: c.lieu ?? null,
    departement: c.departement ?? null,
    discipline: 'course_a_pied',
    format: c.format ?? null,
    source: 'liste',
    source_ref: `${slug(c.nom)}-${c.date.slice(0, 4)}`,
    url_source: c.url ?? null,
  }));
}
