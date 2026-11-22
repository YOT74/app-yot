-- =====================================================================
-- schema.sql — base de l'app du club (à exécuter une fois, dans l'ordre)
-- Supabase en ligne : SQL Editor → coller → Run.
-- Supabase local    : copié en migration (voir README, « Tester en local »).
-- =====================================================================

-- 1. Types --------------------------------------------------------------
create type statut_participation as enum
  ('interesse', 'inscrit', 'cherche_dossard', 'vend_dossard', 'finisher', 'forfait');
create type role_membre as enum ('membre', 'bureau', 'coach', 'admin');
create type type_notification as enum
  ('mot', 'inscription', 'proposition', 'validation', 'actualite', 'dossard', 'refus', 'message', 'reponse', 'adhesion');

-- 2. Tables -------------------------------------------------------------
create table membres (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  prenom text not null,
  nom text not null,
  role role_membre not null default 'membre',
  actif boolean not null default true,
  photo text,                                       -- adresse de la photo de profil (vide = avatar par défaut)
  heures_semaine numeric(4,1),                      -- temps d'entraînement hebdomadaire déclaré
  groupe text,                                      -- groupe de niveau du planning (ex. « 7-10 »), ajustable par le coach
  niveau_cap text,                                  -- niveau de course à pied (1, 2, 3), réglé par le coach
  niveau_velo text,                                 -- niveau de vélo (1, 2, 3), réglé par le coach
  en_attente boolean not null default true,         -- nouveau compte : attend la validation du bureau
  app_installee timestamptz,                        -- dernière ouverture depuis l'icône de l'écran d'accueil
  -- réglages des notifications (chacun coche ce qu'il veut recevoir)
  notif_mot boolean not null default true,          -- discussion : nouveau message sur une de mes courses, réponse à un fil où j'écris
  notif_inscription boolean not null default true,  -- quelqu'un s'inscrit à une course où je suis inscrit
  notif_proposition boolean not null default true,  -- (bureau) une course proposée à valider
  notif_validation boolean not null default true,   -- ma proposition a été validée
  notif_actualite boolean not null default true,    -- une actualité est publiée
  notif_dossard boolean not null default true,      -- un dossard à vendre / recherché sur une course où je cherche / vends
  cree_le timestamptz not null default now()
);

create table courses (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  date_course date not null,
  lieu text,
  departement text,
  discipline text not null default 'triathlon',
  format text,
  url_inscription text,
  date_limite_inscription date,
  course_club boolean not null default false,       -- course par équipe pilotée par le bureau
  infos text,
  validee boolean not null default false,           -- false = proposition en attente
  -- origine : 'membre' (proposée dans l'app) ou une source importée par le robot
  -- ('fftri', 'ironman', 'liste'…). Les courses importées arrivent déjà validées.
  source text not null default 'membre',
  source_ref text,                                  -- identifiant chez la source (mises à jour du robot)
  date_a_confirmer boolean not null default false,  -- date estimée : jour pas encore publié par l'organisateur
  url_source text,                                  -- page de la course chez la source
  corrigee boolean not null default false,          -- corrigée par le bureau : le robot ne l'écrase plus
  masquee boolean not null default false,           -- masquée par le bureau (une course importée supprimée reviendrait)
  validee_par uuid references membres(id) on delete set null,
  validee_le timestamptz,
  creee_par uuid references membres(id) on delete set null,
  cree_le timestamptz not null default now()
);

-- une course par identifiant chez sa source : le robot met à jour au lieu de dupliquer
-- (source_ref vide pour les courses proposées par les membres : pas de conflit)
alter table courses add constraint courses_source_ref unique (source, source_ref);
create index courses_date on courses (date_course);

create table participations (
  course_id uuid not null references courses(id) on delete cascade,
  membre_id uuid not null references membres(id) on delete cascade,
  statut statut_participation not null,
  dispo_equipe boolean,                                       -- courses club uniquement
  temps interval,
  classement int,
  maj_le timestamptz not null default now(),
  primary key (course_id, membre_id)
);

-- discussion d'une course : messages, et réponses (un seul niveau, comme sur Strava)
create table messages (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  membre_id uuid references membres(id) on delete set null,
  parent_id uuid references messages(id) on delete cascade,   -- vide = message ; sinon réponse à ce message
  texte text not null check (char_length(trim(texte)) between 1 and 1000),
  cree_le timestamptz not null default now()
);
create index messages_course on messages (course_id, cree_le);

create table albums (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  titre text not null,
  url text not null check (url ~* '^https?://'),
  type text not null default 'photos',              -- photos | videos | mixte
  ajoute_par uuid references membres(id) on delete set null,
  cree_le timestamptz not null default now()
);

create table seances (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  heure text,
  discipline text not null default 'course_a_pied', -- natation | velo | course_a_pied | renfo | repos
  titre text not null,
  contenu text,
  lieu text,
  groupe text,                                      -- groupe de niveau (vide = tous)
  duree text,
  intensite text,                                   -- vert | jaune | orange | rouge
  cree_par uuid references membres(id) on delete set null,
  cree_le timestamptz not null default now()
);

-- « Je viens » sur une séance (supprimé avec la séance, y compris lors d'un réimport du planning)
create table presences (
  seance_id uuid not null references seances(id) on delete cascade,
  membre_id uuid not null references membres(id) on delete cascade,
  vient boolean not null default true,               -- true = je viens, false = je ne viens pas
  cree_le timestamptz not null default now(),
  primary key (seance_id, membre_id)
);

create table partenaires (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  activite text,
  avantage text,
  code_promo text,
  lien text,
  valable_jusqu_au date,
  actif boolean not null default true,
  cree_le timestamptz not null default now()
);

create table actualites (
  id uuid primary key default gen_random_uuid(),
  titre text not null,
  contenu text,
  epinglee boolean not null default false,
  course_id uuid references courses(id) on delete set null,
  cree_par uuid references membres(id) on delete set null,
  publiee_le timestamptz not null default now(),
  -- sondage facultatif : la question est le titre, les choix sont listés ici
  sondage_options text[] check (sondage_options is null or array_length(sondage_options, 1) between 2 and 10),
  sondage_multiple boolean not null default false,   -- plusieurs réponses possibles
  sondage_clos boolean not null default false,       -- le bureau a clos le sondage
  photos text[] check (photos is null or array_length(photos, 1) <= 4)   -- adresses publiques, dossier « actualites »
);

create table votes_sondage (
  actualite_id uuid not null references actualites(id) on delete cascade,
  membre_id uuid not null references membres(id) on delete cascade,
  option smallint not null check (option >= 0),     -- rang du choix dans sondage_options (0 = premier)
  cree_le timestamptz not null default now(),
  primary key (actualite_id, membre_id, option)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  destinataire uuid not null references membres(id) on delete cascade,
  type type_notification not null,
  course_id uuid references courses(id) on delete cascade,
  actualite_id uuid references actualites(id) on delete cascade,
  auteur uuid references membres(id) on delete set null,
  extrait text,
  lue boolean not null default false,
  cree_le timestamptz not null default now()
);
create index notifications_destinataire on notifications (destinataire, lue, cree_le desc);

-- 3. Fonctions d'aide (lisent l'email du jeton de connexion) -------------
create function mon_membre_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from membres where email = lower(auth.jwt() ->> 'email') and actif and not en_attente
$$;

create function mon_role() returns role_membre
language sql stable security definer set search_path = public as $$
  select role from membres where email = lower(auth.jwt() ->> 'email') and actif and not en_attente
$$;

-- l'admin a tous les droits du bureau et du coach ; seul un admin nomme ou modifie un admin
create function est_admin() returns boolean
language sql stable as $$ select coalesce(mon_role() = 'admin', false) $$;

create function est_bureau() returns boolean
language sql stable as $$ select coalesce(mon_role() in ('bureau', 'admin'), false) $$;

-- le coach gère les séances ; le bureau aussi, pour le dépanner
create function est_coach() returns boolean
language sql stable as $$ select coalesce(mon_role() in ('coach', 'bureau', 'admin'), false) $$;

-- appelée par le workflow anti-pause (GitHub Actions) pour garder le projet actif
create function ping() returns boolean language sql stable as $$ select true $$;
grant execute on function ping() to anon;

-- 4. Règles d'accès (RLS) -----------------------------------------------
alter table membres enable row level security;
alter table courses enable row level security;
alter table participations enable row level security;
alter table albums enable row level security;
alter table seances enable row level security;
alter table presences enable row level security;
alter table messages enable row level security;
alter table votes_sondage enable row level security;
alter table partenaires enable row level security;
alter table actualites enable row level security;
alter table notifications enable row level security;

-- membres
create policy "membres visibles" on membres for select to authenticated
  using (mon_membre_id() is not null and (not en_attente or est_bureau()));
-- chacun voit sa propre fiche, même en attente de validation
create policy "ma fiche" on membres for select to authenticated
  using (email = lower(auth.jwt() ->> 'email'));
-- inscription : chacun crée SA fiche (son email, rôle membre), en attente de validation
-- par le bureau. L'email unique empêche les doublons ; un membre désactivé ne peut pas se réinscrire.
create policy "je m'inscris" on membres for insert to authenticated
  with check (email = lower(auth.jwt() ->> 'email') and role = 'membre' and actif and en_attente);
-- chacun corrige son nom et ses réglages, sans changer son rôle, son email ni se réactiver
create policy "je modifie ma fiche" on membres for update to authenticated
  using (email = lower(auth.jwt() ->> 'email') and actif)
  with check (email = lower(auth.jwt() ->> 'email') and actif and role = mon_role());
create policy "bureau gère les membres" on membres for all to authenticated
  using (est_admin() or (est_bureau() and role <> 'admin'))
  with check (est_admin() or (est_bureau() and role <> 'admin'));

-- courses : validées pour tous, propositions pour leur auteur et le bureau
create policy "courses visibles" on courses for select to authenticated
  using (mon_membre_id() is not null
         and ((validee and not masquee) or creee_par = mon_membre_id() or est_bureau()));
-- depuis l'app, on ne crée que des courses « membre » ; le robot écrit avec sa propre clé
create policy "proposer une course" on courses for insert to authenticated
  with check (creee_par = mon_membre_id() and source = 'membre' and (not validee or est_bureau()));
create policy "modifier une course" on courses for update to authenticated
  using (est_bureau() or (creee_par = mon_membre_id() and not validee))
  with check (est_bureau() or (creee_par = mon_membre_id() and not validee));
create policy "supprimer une course" on courses for delete to authenticated
  using (est_bureau() or (creee_par = mon_membre_id() and not validee));

-- participations : tout le monde voit, chacun gère la sienne
create policy "participations visibles" on participations for select to authenticated
  using (mon_membre_id() is not null);
create policy "je gère les miennes" on participations for all to authenticated
  using (membre_id = mon_membre_id() or est_bureau())
  with check (membre_id = mon_membre_id() or est_bureau());

-- discussion : tout le monde lit et écrit en son nom ; on retire ses messages (le bureau aussi)
create policy "messages visibles" on messages for select to authenticated
  using (mon_membre_id() is not null);
create policy "j'écris" on messages for insert to authenticated
  with check (membre_id = mon_membre_id());
create policy "je retire mon message" on messages for delete to authenticated
  using (membre_id = mon_membre_id() or est_bureau());

-- albums : n'importe quel membre ajoute un lien ; l'auteur ou le bureau le retire
create policy "albums visibles" on albums for select to authenticated
  using (mon_membre_id() is not null);
create policy "ajouter un album" on albums for insert to authenticated
  with check (ajoute_par = mon_membre_id());
create policy "retirer un album" on albums for delete to authenticated
  using (ajoute_par = mon_membre_id() or est_bureau());

-- séances : lues par tous, écrites par le coach (et le bureau)
create policy "seances visibles" on seances for select to authenticated
  using (mon_membre_id() is not null);
create policy "coach gère les seances" on seances for all to authenticated
  using (est_coach()) with check (est_coach());

-- présences aux séances : tout le monde voit qui vient, chacun gère la sienne
create policy "presences visibles" on presences for select to authenticated
  using (mon_membre_id() is not null);
create policy "je viens" on presences for insert to authenticated
  with check (membre_id = mon_membre_id());
create policy "je change ma réponse" on presences for update to authenticated
  using (membre_id = mon_membre_id()) with check (membre_id = mon_membre_id());
create policy "je ne viens plus" on presences for delete to authenticated
  using (membre_id = mon_membre_id());

-- partenaires et actualités : lus par tous, écrits par le bureau
create policy "partenaires visibles" on partenaires for select to authenticated
  using (mon_membre_id() is not null);
create policy "bureau gère les partenaires" on partenaires for all to authenticated
  using (est_bureau()) with check (est_bureau());
create policy "actualites visibles" on actualites for select to authenticated
  using (mon_membre_id() is not null);
create policy "bureau gère les actualites" on actualites for all to authenticated
  using (est_bureau()) with check (est_bureau());

-- sondages : tout le monde voit les votes ; chacun vote et retire son vote tant que le sondage est ouvert
create function sondage_ouvert(actu uuid, choix smallint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from actualites a where a.id = actu and a.sondage_options is not null
                 and not a.sondage_clos and choix < array_length(a.sondage_options, 1))
$$;
create policy "votes visibles" on votes_sondage for select to authenticated
  using (mon_membre_id() is not null);
create policy "je vote" on votes_sondage for insert to authenticated
  with check (membre_id = mon_membre_id() and sondage_ouvert(actualite_id, option));
create policy "je retire mon vote" on votes_sondage for delete to authenticated
  using (membre_id = mon_membre_id() and sondage_ouvert(actualite_id, option));

-- notifications : chacun ne voit que les siennes ; elles sont créées par les
-- déclencheurs ci-dessous (aucune insertion directe depuis l'app)
create policy "mes notifications" on notifications for select to authenticated
  using (destinataire = mon_membre_id());
create policy "je marque mes notifications" on notifications for update to authenticated
  using (destinataire = mon_membre_id()) with check (destinataire = mon_membre_id());
create policy "je supprime mes notifications" on notifications for delete to authenticated
  using (destinataire = mon_membre_id());

-- 5. Courses importées : les corrections du bureau priment sur le robot ------
-- Le robot écrit sans être connecté comme membre (mon_membre_id() vide).
create function proteger_corrections() returns trigger language plpgsql as $$
begin
  if old.source <> 'membre' then
    if mon_membre_id() is not null then
      -- un membre du bureau corrige un champ venu de la source → on le retient
      if (new.nom, new.date_course, new.lieu, new.departement, new.discipline, new.format)
         is distinct from (old.nom, old.date_course, old.lieu, old.departement, old.discipline, old.format) then
        new.corrigee = true;
      end if;
    elsif old.corrigee then
      -- le robot repasse : il ne touche pas aux champs corrigés
      new.nom = old.nom; new.date_course = old.date_course; new.lieu = old.lieu;
      new.departement = old.departement; new.discipline = old.discipline; new.format = old.format;
    end if;
  end if;
  return new;
end $$;
create trigger courses_corrections before update on courses
  for each row execute function proteger_corrections();

-- 6. Actions du bureau qui écrivent chez les autres --------------------------
-- refuser une proposition : prévient son auteur (avec le motif), puis la supprime
create function refuser_course(course uuid, motif text default null) returns void
language plpgsql security definer set search_path = public as $$
declare c courses;
begin
  if not est_bureau() then raise exception 'Réservé au bureau'; end if;
  select * into c from courses where id = course and not validee;
  if not found then raise exception 'Proposition introuvable'; end if;
  if c.creee_par is not null and c.creee_par <> mon_membre_id() then
    insert into notifications (destinataire, type, auteur, extrait)
    values (c.creee_par, 'refus', mon_membre_id(),
            left(c.nom || coalesce(' — ' || nullif(trim(motif), ''), ''), 300));
  end if;
  delete from courses where id = course;
end $$;
grant execute on function refuser_course(uuid, text) to authenticated;

-- message du bureau à tous les engagés d'une course (hors forfaits)
create function message_engages(course uuid, texte text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not est_bureau() then raise exception 'Réservé au bureau'; end if;
  if coalesce(trim(texte), '') = '' then raise exception 'Message vide'; end if;
  insert into notifications (destinataire, type, course_id, auteur, extrait)
  select p.membre_id, 'message', course, mon_membre_id(), left(trim(texte), 500)
  from participations p join membres m on m.id = p.membre_id
  where p.course_id = course and p.statut <> 'forfait' and m.actif and p.membre_id <> mon_membre_id();
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function message_engages(uuid, text) to authenticated;

-- sondage à choix unique : un nouveau vote remplace le précédent
create function vote_unique() returns trigger language plpgsql as $$
begin
  if not (select sondage_multiple from actualites where id = new.actualite_id) then
    delete from votes_sondage where actualite_id = new.actualite_id and membre_id = new.membre_id and option <> new.option;
  end if;
  return new;
end $$;
create trigger votes_unique before insert on votes_sondage
  for each row execute function vote_unique();

-- le coach (ou le bureau) range un membre dans un groupe de niveau
create function changer_groupe(membre uuid, nouveau text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_coach() then raise exception 'Réservé au coach'; end if;
  update membres set groupe = nullif(trim(nouveau), '') where id = membre;
end $$;
grant execute on function changer_groupe(uuid, text) to authenticated;

-- le coach (ou le bureau) range un membre dans un niveau de course à pied ou de vélo
create function changer_niveau(membre uuid, discipline text, nouveau text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not est_coach() then raise exception 'Réservé au coach'; end if;
  if discipline = 'course_a_pied' then update membres set niveau_cap = nullif(trim(nouveau), '') where id = membre;
  elsif discipline = 'velo' then update membres set niveau_velo = nullif(trim(nouveau), '') where id = membre;
  else raise exception 'Discipline inconnue'; end if;
end $$;
grant execute on function changer_niveau(uuid, text, text) to authenticated;

-- un membre ne change pas lui-même ses niveaux
create function proteger_niveaux() returns trigger
language plpgsql set search_path = public as $$
begin
  if (new.niveau_cap, new.niveau_velo) is distinct from (old.niveau_cap, old.niveau_velo) and not est_coach() then
    new.niveau_cap = old.niveau_cap; new.niveau_velo = old.niveau_velo;
  end if;
  return new;
end $$;
create trigger membres_niveaux before update on membres for each row execute function proteger_niveaux();

-- nouvelle demande d'inscription → le bureau est prévenu
create function notifier_adhesion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.en_attente then
    insert into notifications (destinataire, type, auteur, extrait)
    select m.id, 'adhesion', new.id, new.prenom || ' ' || new.nom
    from membres m
    where m.role in ('bureau', 'admin') and m.actif and not m.en_attente;
  end if;
  return new;
end $$;
create trigger membres_adhesion after insert on membres for each row execute function notifier_adhesion();

-- 7. Horodatages automatiques --------------------------------------------
create function maj_horodatage() returns trigger language plpgsql as $$
begin new.maj_le = now(); return new; end $$;
create trigger participations_maj before update on participations
  for each row execute function maj_horodatage();

-- trace qui a validé et quand, sans que l'app ait à le renseigner
create function trace_validation() returns trigger language plpgsql as $$
begin
  if new.validee and (tg_op = 'INSERT' or not old.validee) then
    new.validee_par = mon_membre_id(); new.validee_le = now();
  end if;
  return new;
end $$;
create trigger courses_validation before insert or update on courses
  for each row execute function trace_validation();

-- 8. Notifications automatiques ------------------------------------------
-- Les fonctions tournent avec les droits du propriétaire (security definer)
-- pour pouvoir écrire chez les autres membres ; chacun reste maître de ses
-- réglages (colonnes notif_* de membres).

-- discussion : une réponse à une réponse est rattachée au message de départ (un seul niveau)
create function ranger_message() returns trigger language plpgsql as $$
begin
  if new.parent_id is not null then
    select coalesce(parent_id, id) into new.parent_id from messages where id = new.parent_id;
  end if;
  return new;
end $$;
create trigger messages_ranger before insert on messages
  for each row execute function ranger_message();

-- nouveau message → les engagés de la course et ceux qui y ont déjà écrit ;
-- réponse → l'auteur du message et ceux qui ont répondu dans ce fil
create function notifier_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.parent_id is null then
    insert into notifications (destinataire, type, course_id, auteur, extrait)
    select distinct m.id, 'mot'::type_notification, new.course_id, new.membre_id, left(new.texte, 140)
    from membres m
    where m.actif and m.notif_mot and m.id is distinct from new.membre_id
      and (m.id in (select membre_id from participations where course_id = new.course_id and statut <> 'forfait')
           or m.id in (select membre_id from messages where course_id = new.course_id and id <> new.id));
  else
    insert into notifications (destinataire, type, course_id, auteur, extrait)
    select distinct m.id, 'reponse'::type_notification, new.course_id, new.membre_id, left(new.texte, 140)
    from membres m
    where m.actif and m.notif_mot and m.id is distinct from new.membre_id
      and m.id in (select membre_id from messages where (id = new.parent_id or parent_id = new.parent_id) and id <> new.id);
  end if;
  return new;
end $$;
create trigger messages_notifier after insert on messages
  for each row execute function notifier_message();

-- nouvelle inscription, dossard, sur une course
create function notifier_participation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- quelqu'un passe « inscrit » → les autres inscrits de la course
  if new.statut = 'inscrit' and (tg_op = 'INSERT' or old.statut <> 'inscrit') then
    insert into notifications (destinataire, type, course_id, auteur)
    select p.membre_id, 'inscription', new.course_id, new.membre_id
    from participations p join membres m on m.id = p.membre_id
    where p.course_id = new.course_id and p.membre_id <> new.membre_id
      and p.statut = 'inscrit' and m.actif and m.notif_inscription;
  end if;
  -- dossard : un vendeur prévient ceux qui cherchent, et inversement
  if new.statut in ('vend_dossard', 'cherche_dossard')
     and (tg_op = 'INSERT' or old.statut is distinct from new.statut) then
    insert into notifications (destinataire, type, course_id, auteur, extrait)
    select p.membre_id, 'dossard', new.course_id, new.membre_id, new.statut::text
    from participations p join membres m on m.id = p.membre_id
    where p.course_id = new.course_id and p.membre_id <> new.membre_id
      and p.statut = (case new.statut when 'vend_dossard' then 'cherche_dossard' else 'vend_dossard' end)::statut_participation
      and m.actif and m.notif_dossard;
  end if;
  return new;
end $$;
create trigger participations_notifier after insert or update on participations
  for each row execute function notifier_participation();

-- course proposée → le bureau ; course validée → son auteur
create function notifier_course() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and not new.validee then
    insert into notifications (destinataire, type, course_id, auteur, extrait)
    select m.id, 'proposition', new.id, new.creee_par, new.nom
    from membres m
    where m.role in ('bureau', 'admin') and m.actif and m.notif_proposition
      and m.id is distinct from new.creee_par;
  elsif tg_op = 'UPDATE' and new.validee and not old.validee
        and new.creee_par is not null and new.creee_par is distinct from mon_membre_id() then
    insert into notifications (destinataire, type, course_id, auteur, extrait)
    select m.id, 'validation', new.id, mon_membre_id(), new.nom
    from membres m where m.id = new.creee_par and m.actif and m.notif_validation;
  end if;
  return new;
end $$;
create trigger courses_notifier after insert or update on courses
  for each row execute function notifier_course();

-- actualité publiée → tout le club
create function notifier_actualite() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (destinataire, type, actualite_id, course_id, auteur, extrait)
  select m.id, 'actualite', new.id, new.course_id, new.cree_par, new.titre
  from membres m
  where m.actif and m.notif_actualite and m.id is distinct from new.cree_par;
  return new;
end $$;
create trigger actualites_notifier after insert on actualites
  for each row execute function notifier_actualite();

-- 9. Photos de profil (Supabase Storage) ------------------------------------
-- Dossier public « avatars » ; chacun dépose, remplace ou retire SA photo (<son id>.jpg).
-- Ignoré si le module Storage n'existe pas (base de test sans Supabase).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
    execute $p$create policy "photos lisibles" on storage.objects for select using (bucket_id = 'avatars')$p$;
    execute $p$create policy "je dépose ma photo" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and name = public.mon_membre_id()::text || '.jpg')$p$;
    execute $p$create policy "je remplace ma photo" on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and name = public.mon_membre_id()::text || '.jpg')$p$;
    execute $p$create policy "je retire ma photo" on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and name = public.mon_membre_id()::text || '.jpg')$p$;
    -- photos des actualités : tout le monde voit, seul le bureau dépose ou retire (JPEG, 2 Mo au plus)
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values ('actualites', 'actualites', true, 2097152, array['image/jpeg']) on conflict (id) do nothing;
    execute $p$create policy "photos d'actus lisibles" on storage.objects for select using (bucket_id = 'actualites')$p$;
    execute $p$create policy "le bureau dépose les photos d'actus" on storage.objects for insert to authenticated
      with check (bucket_id = 'actualites' and public.est_bureau())$p$;
    execute $p$create policy "le bureau retire les photos d'actus" on storage.objects for delete to authenticated
      using (bucket_id = 'actualites' and public.est_bureau())$p$;
  end if;
end $$;

-- 10. Droits d'exécution des fonctions ------------------------------------
-- Personne n'appelle les fonctions sans être connecté (sauf ping, pour l'anti-pause) ;
-- les fonctions de déclencheurs ne s'appellent pas depuis l'app. Les fonctions
-- restantes (changer_groupe, message_engages, refuser_course…) vérifient elles-mêmes le rôle.
revoke execute on all functions in schema public from public, anon;
grant execute on function ping() to anon;
revoke execute on function notifier_actualite(), notifier_course(), notifier_message(), notifier_participation(),
  proteger_corrections(), proteger_niveaux(), notifier_adhesion(), vote_unique(), maj_horodatage(), trace_validation(), ranger_message() from authenticated;
alter function vote_unique() set search_path = public;
alter function maj_horodatage() set search_path = public;
alter function trace_validation() set search_path = public;
alter function ranger_message() set search_path = public;
alter function est_bureau() set search_path = public;
alter function est_admin() set search_path = public;
alter function est_coach() set search_path = public;
alter function ping() set search_path = public;
alter function proteger_corrections() set search_path = public;
