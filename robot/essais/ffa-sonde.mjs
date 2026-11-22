// robot/essais/ffa-sonde.mjs — essai de lecture du calendrier FFA (lecture seule, rien n'est écrit).
// Sert à voir comment les pages sont construites avant d'écrire la source FFA.
const adresses = [
  'https://bases.athle.fr/asp.net/liste.aspx?frmbase=calendrier&frmmode=1&frmespace=0&frmsaison=2027&frmdepartement=074',
  'https://www.athle.fr/robots.txt',
  'https://www.athle.fr/competitions',
  'https://calendrier.athle.fr/',
];
for (const url of adresses) {
  try {
    const rep = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (club YOT, calendrier des membres)' }, redirect: 'follow' });
    const html = await rep.text();
    console.log(`\n===== ${url}\nHTTP ${rep.status} · ${rep.headers.get('content-type')} · ${html.length} caractères · url finale ${rep.url}`);
    console.log(html.replace(/\s+/g, ' ').slice(0, 6000));
  } catch (e) { console.log(`\n===== ${url}\nÉCHEC ${e.message}`); }
}
