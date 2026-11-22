// =====================================================================
// robot/sources/liste.mjs — courses tenues à la main (une mise à jour par an suffit) :
//   robot/liste-marathons.json   grands marathons et semis
//   robot/liste-triathlons.json  grands triathlons, avant leur arrivée au calendrier FFTri / IRONMAN
//   robot/liste-regionale.json   courses sur route, trails et cross de la région et de Genève
// L'identifiant est le nom + l'année : l'édition suivante devient une nouvelle course.
// =====================================================================
import { readFile } from 'node:fs/promises';
import { slug } from '../outils.mjs';

const FICHIERS = [
  ['../liste-marathons.json', 'course_a_pied'],
  ['../liste-triathlons.json', 'triathlon'],
  ['../liste-regionale.json', 'course_a_pied'],
];

export async function lire() {
  const toutes = [];
  for (const [fichier, discipline] of FICHIERS) {
    const { courses } = JSON.parse(await readFile(new URL(fichier, import.meta.url), 'utf8'));
    for (const c of courses) {
      toutes.push({
        nom: c.nom,
        date_course: c.date,
        date_a_confirmer: !!c.a_confirmer,
        jour_inconnu: !!c.jour_inconnu,
        periode: c.periode ?? null,
        lieu: c.lieu ?? null,
        departement: c.departement ?? null,
        discipline: c.discipline ?? discipline,
        format: c.format ?? null,
        source: 'liste',
        source_ref: `${slug(c.nom)}-${c.date.slice(0, 4)}`,
        url_source: c.url ?? null,
        cle: c.cle ?? null,   // retiré avant l'envoi (sert à repérer la course chez FFTri / IRONMAN)
      });
    }
  }
  return toutes;
}
