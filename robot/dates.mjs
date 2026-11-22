// =====================================================================
// robot/dates.mjs — cherche les dates annoncées pour les courses de la base dont le jour
// n'est pas encore connu ou reste à confirmer (liste du club et propositions des membres).
//
// Source : les pages publiques de finishers.com (/course/…), autorisées par leur robots.txt ;
// la liste des pages vient de leur plan du site (sitemap). Pas de compte, pas de mot de passe.
//
// Pour chaque course : on cherche les pages au nom le plus proche, puis on n'accepte une date que si
//   • la page cite le lieu de la course (quand il est connu) ;
//   • la date tombe à 45 jours près de la date estimée (on ne saute pas d'une édition à l'autre).
// « Dim. 21 mars 2027 » → date exacte (confirmée si la page l'indique) ;
// « Fin avril 2027 »    → période affichée, le jour reste inconnu.
// Une date trouvée est marquée (date_verifiee) : l'import de la liste ne l'écrase plus.
//
// Utilisation : node robot/dates.mjs [--essai]   (appelé par le workflow « Base de courses »)
// =====================================================================

const essai = process.argv.includes('--essai');
const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
const cle = process.env.SUPABASE_CLE_SERVICE;
if (!url || !cle) throw new Error('SUPABASE_URL et SUPABASE_CLE_SERVICE doivent être définis.');
const h = { apikey: cle, Authorization: `Bearer ${cle}`, 'Content-Type': 'application/json' };
const UA = { 'User-Agent': 'YOT74-club-app (calendrier de courses du club ; lecture hebdomadaire)' };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const MOIS_AFFICHES = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'en', 'et', 'a', 'au', 'aux', 'sur', 'the', 'course', 'edition', 'eme', 'e']);
const sansAccents = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const mots = (s) => new Set(sansAccents(s).replace(/[^a-z0-9]+/g, ' ').split(' ').filter((m) => m && !VIDES.has(m)));
const score = (A, B) => {
  if (!A.size || !B.size) return 0;
  const communs = [...A].filter((m) => B.has(m)).length;
  return communs / Math.max(A.size, B.size);
};
const ecartJours = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

// --- pages finishers ---------------------------------------------------------------
async function pages() {
  const rep = await fetch('https://www.finishers.com/sitemap/events.xml', { headers: UA });
  if (!rep.ok) throw new Error(`plan du site finishers : HTTP ${rep.status}`);
  const xml = await rep.text();
  const slugs = [...new Set([...xml.matchAll(/<loc>https:\/\/www\.finishers\.com\/course\/([^<\/?#]+)<\/loc>/g)].map((m) => m[1]))];
  return slugs.map((slug) => ({ slug, mots: mots(slug.replace(/-\d+$/, '')) }));
}

function lirePage(html) {
  const texte = sansAccents(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&amp;/g, '&'))
    .replace(/\s+/g, ' ');
  const i = texte.indexOf('prochaine edition');
  if (i < 0) return { texte };
  const suite = texte.slice(i, i + 120);
  const m = MOIS.join('|');
  const exacte = suite.match(new RegExp(`(?:lun|mar|mer|jeu|ven|sam|dim)\\.?\\s*(\\d{1,2})\\s+(${m})\\s+(\\d{4})`));
  if (exacte) {
    const date = `${exacte[3]}-${String(MOIS.indexOf(exacte[2]) + 1).padStart(2, '0')}-${exacte[1].padStart(2, '0')}`;
    return { texte, date, confirmee: /date confirmee/.test(suite.slice(exacte.index, exacte.index + 60)) };
  }
  const periode = suite.match(new RegExp(`(debut|mi|fin)[\\s-]+(${m})\\s+(\\d{4})`));
  if (periode) {
    const n = MOIS.indexOf(periode[2]);
    return { texte, mois: `${periode[3]}-${String(n + 1).padStart(2, '0')}`, periode: `${{ debut: 'début', mi: 'mi', fin: 'fin' }[periode[1]]} ${MOIS_AFFICHES[n]} ${periode[3]}` };
  }
  return { texte };
}

// --- courses à préciser -------------------------------------------------------------
const aujourdhui = new Date().toISOString().slice(0, 10);
const debutMois = `${aujourdhui.slice(0, 7)}-01`;
const rep = await fetch(`${url}/rest/v1/courses?select=id,nom,lieu,date_course,jour_inconnu,date_a_confirmer,periode&source=in.(liste,membre)&masquee=eq.false&or=(jour_inconnu.eq.true,date_a_confirmer.eq.true)&date_course=gte.${debutMois}&limit=2000`, { headers: h });
if (!rep.ok) throw new Error(`Supabase ${rep.status} : ${await rep.text()}`);
const courses = await rep.json();
const catalogue = await pages();
console.log(`dates : ${courses.length} course(s) à préciser, ${catalogue.length} pages finishers`);

let trouvees = 0;
for (const c of courses) {
  const M = mots(c.nom);
  const candidates = catalogue.map((p) => ({ ...p, s: score(M, p.mots) })).filter((p) => p.s >= (c.lieu ? 0.5 : 0.8))
    .sort((a, b) => b.s - a.s).slice(0, 3);
  // date estimée : le 15 du mois quand seul le mois est connu
  const estimee = c.jour_inconnu ? `${c.date_course.slice(0, 7)}-15` : c.date_course;
  for (const p of candidates) {
    await pause(700);
    let page;
    try {
      const r = await fetch(`https://www.finishers.com/course/${p.slug}`, { headers: UA });
      if (!r.ok) continue;
      page = lirePage(await r.text());
    } catch { continue; }
    if (c.lieu && !page.texte.includes(sansAccents(c.lieu))) continue;
    let maj = null;
    if (page.date && ecartJours(page.date, estimee) <= 45) {
      maj = { date_course: page.date, jour_inconnu: false, periode: null, date_a_confirmer: !page.confirmee };
    } else if (page.periode && c.jour_inconnu && ecartJours(`${page.mois}-15`, estimee) <= 45 && page.periode !== c.periode) {
      maj = { date_course: `${page.mois}-01`, jour_inconnu: true, periode: page.periode, date_a_confirmer: true };
    } else if (!page.date && !page.periode) continue;   // page sans date lisible : candidate suivante
    if (maj) {
      // rien de nouveau ? (même date, même statut)
      const pareil = maj.date_course === c.date_course && maj.jour_inconnu === c.jour_inconnu && maj.date_a_confirmer === c.date_a_confirmer && (maj.periode ?? null) === (c.periode ?? null);
      if (!pareil) {
        trouvees++;
        console.log(`  ${c.nom} : ${c.jour_inconnu ? (c.periode ?? c.date_course.slice(0, 7)) : c.date_course} → ${maj.periode ?? maj.date_course}${maj.jour_inconnu || maj.date_a_confirmer ? '' : ' (confirmée)'} · finishers.com/course/${p.slug}`);
        if (!essai) {
          const r = await fetch(`${url}/rest/v1/courses?id=eq.${c.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ ...maj, date_verifiee: new Date().toISOString() }) });
          if (!r.ok) console.log(`    échec : ${r.status} ${await r.text()}`);
        }
      }
    }
    break;   // page de la course trouvée : on ne regarde pas les autres candidates
  }
}
console.log(`dates : ${trouvees} course(s) précisée(s)${essai ? ' (essai : rien écrit)' : ''}`);
