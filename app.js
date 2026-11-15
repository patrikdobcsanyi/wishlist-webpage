import { t, setText } from "./i18n.js";
import { supabaseUrl, supabasePublishableKey } from "./config.js";

const $ = (selector) => document.querySelector(selector);
const status = $("#status");
const form = $("#wish-form");
let db;
let user;
let generation = 0;
let previewVersion = 0;
let previewImage = null;
let previewSource = "";

function displayImage(element, url) {
  element.hidden = true;
  element.removeAttribute("src");
  if (!url || !/^https:\/\//i.test(url)) return;
  element.onerror = () => { element.hidden = true; };
  element.hidden = false;
  element.src = url;
}

function resetPreview() {
  previewVersion++;
  previewImage = null;
  previewSource = "";
  $("#link-preview").hidden = true;
  displayImage($("#preview-image"), null);
  $("#preview-title").textContent = "";
  setText($("#preview-status"), "");
  $("#fetch-preview").disabled = false;
  form.querySelector('button:not([type])').disabled = false;
}

async function fetchPreview() {
  resetPreview();
  const url = form.elements.url.value.trim();
  if (!url) return;
  if (!/^https:\/\//i.test(url)) {
    setText($("#preview-status"), "Az előnézethez https:// kezdetű link szükséges.");
    return;
  }
  const version = previewVersion;
  const titleBefore = form.elements.title.value;
  $("#fetch-preview").disabled = true;
  form.querySelector('button:not([type])').disabled = true;
  setText($("#preview-status"), "Előnézet betöltése…");
  try {
    const { data, error } = await db.functions.invoke("link-preview", { body: { url } });
    if (version !== previewVersion || url !== form.elements.url.value.trim()) return;
    if (error || data?.error) throw new Error("preview_unavailable");
    previewSource = url;
    previewImage = typeof data?.image === "string" && /^https:\/\//i.test(data.image) ? data.image : null;
    const title = typeof data?.title === "string" ? data.title.slice(0, 120) : "";
    if (!titleBefore.trim() && !form.elements.title.value.trim()) form.elements.title.value = title;
    displayImage($("#preview-image"), previewImage);
    $("#preview-title").textContent = title;
    $("#link-preview").hidden = !title && !previewImage;
    $("#remove-image").hidden = !previewImage;
    setText($("#preview-status"), previewImage ? "Az előnézet betöltve." : "Nem található kép. A kívánság kép nélkül is menthető.");
  } catch {
    if (version === previewVersion) setText($("#preview-status"), "Az előnézet nem érhető el. A kívánság kép nélkül is menthető.");
  } finally {
    if (version === previewVersion) {
      $("#fetch-preview").disabled = false;
      form.querySelector('button:not([type])').disabled = false;
    }
  }
}

form.addEventListener("reset", resetPreview);
form.elements.url.addEventListener("input", resetPreview);
form.elements.url.addEventListener("change", () => { if (db && user) fetchPreview(); });
$("#fetch-preview").addEventListener("click", fetchPreview);
$("#remove-image").addEventListener("click", () => {
  previewImage = null;
  displayImage($("#preview-image"), null);
  $("#remove-image").hidden = true;
});

// Only our own translated messages are displayed directly.
function userError(message) {
  return Object.assign(new Error(message), { userFacing: true });
}

function report(error) {
  const messages = {
    "23505": "Valaki már lefoglalta ezt a kívánságot. Frissítsd a listát.",
    "42501": "Ehhez a művelethez nincs jogosultságod.",
    "23514": "Ellenőrizd a megadott adatokat és a mezők hosszát.",
    "23503": "A kapcsolódó adat már nem érhető el. Frissítsd a listát.",
    "PGRST116": "A kívánság már nem érhető el, vagy nem módosíthatod. Frissítsd a listát.",
    invalid_credentials: "Hibás felhasználónév vagy jelszó.",
    email_not_confirmed: "A fiók még nincs megerősítve. Kérd az adminisztrátor segítségét.",
    over_request_rate_limit: "Túl sok próbálkozás. Próbáld újra egy kicsit később.",
    session_not_found: "A munkamenet lejárt. Jelentkezz be újra.",
    refresh_token_not_found: "A munkamenet lejárt. Jelentkezz be újra.",
  };
  setText(status, error.userFacing ? error.message
    : messages[error.code] || "Nem sikerült a művelet. Ellenőrizd az internetkapcsolatot, és próbáld újra.");
}

// Native validation otherwise follows the browser's language, not the page's.
for (const input of document.querySelectorAll("input, textarea")) {
  input.addEventListener("input", () => input.setCustomValidity(""));
  input.addEventListener("invalid", () => {
    input.setCustomValidity("");
    if (input.validity.valueMissing) input.setCustomValidity(t("Töltsd ki ezt a mezőt."));
    else if (input.validity.patternMismatch || input.validity.tooShort) {
      input.setCustomValidity(t("Használj 3–32 ékezet nélküli betűt, számot vagy aláhúzásjelet."));
    } else if (input.validity.typeMismatch) input.setCustomValidity(t("Adj meg egy érvényes webcímet."));
    else if (input.validity.tooLong) input.setCustomValidity(t("Rövidítsd le a megadott szöveget."));
  });
}

async function run(button, action) {
  button.disabled = true;
  setText(status, "Folyamatban…");
  try {
    await action();
    setText(status, "Kész.");
  } catch (error) {
    report(error);
  } finally {
    button.disabled = false;
  }
}

function actionButton(container, label, action) {
  const button = document.createElement("button");
  button.type = "button";
  setText(button, label);
  button.addEventListener("click", () => run(button, action));
  container.append(button);
}

async function loadWishes() {
  const current = ++generation;
  const results = await Promise.all([
    db.from("profiles").select("id, display_name").order("display_name"),
    db.from("wishes").select("id, owner_id, title, url, notes, image_url").order("created_at"),
    db.from("claims").select("wish_id, claimant_id"),
  ]);
  if (current !== generation || !user) return;
  for (const result of results) if (result.error) throw result.error;
  const [profiles, wishes, claims] = results.map((result) => result.data);
  const me = profiles.find((profile) => profile.id === user.id);
  if (!me) throw userError("A fiókod még nincs hozzáadva a családhoz.");
  setText($("#signed-in"), "Bejelentkezve: {name}", { name: me.display_name });
  $("#profiles").replaceChildren();

  for (const profile of profiles) {
    const section = $("#profile-template").content.cloneNode(true);
    section.querySelector('[data-field="name"]').textContent = profile.display_name;
    const ownWishes = wishes.filter((wish) => wish.owner_id === profile.id);
    section.querySelector('[data-field="empty"]').hidden = ownWishes.length > 0;
    for (const wish of ownWishes) {
      const item = $("#wish-template").content.cloneNode(true);
      const field = (name) => item.querySelector(`[data-field="${name}"]`);
      displayImage(field("image"), wish.image_url);
      field("title").textContent = wish.title;
      field("notes").textContent = wish.notes;
      field("url").hidden = !wish.url;
      if (wish.url && /^https?:\/\//i.test(wish.url)) field("url").href = wish.url;
      const actions = field("actions");
      if (wish.owner_id === user.id) {
        setText(field("claim"), "Titok, hogy ki készül ajándékkal.");
        actionButton(actions, "Szerkesztés", async () => {
          resetPreview();
          previewImage = wish.image_url || null;
          previewSource = wish.url || "";
          displayImage($("#preview-image"), previewImage);
          $("#link-preview").hidden = !previewImage;
          $("#remove-image").hidden = !previewImage;
          form.elements.wishId.value = wish.id;
          form.elements.title.value = wish.title;
          form.elements.url.value = wish.url || "";
          form.elements.notes.value = wish.notes;
          form.elements.title.focus();
        });
        actionButton(actions, "Törlés", async () => {
          if (!confirm(t("Biztosan törlöd ezt a kívánságot: „{title}”?", { title: wish.title }))) return;
          await db.from("wishes").delete().eq("id", wish.id).throwOnError();
          if (form.elements.wishId.value === wish.id) form.reset();
          await loadWishes();
        });
      } else {
        const claim = claims.find((entry) => entry.wish_id === wish.id);
        setText(field("claim"), claim
          ? claim.claimant_id === user.id ? "Te foglaltad le" : "Már lefoglalták"
          : "Még szabad");
        if (!claim) actionButton(actions, "Lefoglalás", async () => {
          await db.from("claims").insert({ wish_id: wish.id }).throwOnError();
          await loadWishes();
        });
        if (claim?.claimant_id === user.id) actionButton(actions, "Foglalás visszavonása", async () => {
          await db.from("claims").delete().eq("wish_id", wish.id).throwOnError();
          await loadWishes();
        });
      }
      section.querySelector("ul").append(item);
    }
    $("#profiles").append(section);
  }
  $("#family").hidden = false;
}

async function showSession(session) {
  generation++;
  user = session?.user;
  $("#login-form").hidden = Boolean(user);
  $("#account").hidden = !user;
  $("#family").hidden = true;
  $("#profiles").replaceChildren();
  setText($("#signed-in"), "");
  form.reset();
  setText(status, user ? "Kívánságok betöltése…" : "Jelentkezz be a családi fiókoddal.");
  if (user) {
    try {
      await loadWishes();
      if (user) setText(status, "A kívánságok betöltve.");
    } catch (error) { report(error); }
  }
}

async function start() {
  if (!supabaseUrl || !supabasePublishableKey) {
    setText(status, "Beállítás szükséges: add meg a Supabase URL-jét és nyilvános kulcsát a config.js fájlban. Útmutató: README.md.");
    return;
  }
  // Load the client only after the connection settings are configured.
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.1");
  db = createClient(supabaseUrl, supabasePublishableKey);
  $("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const login = event.currentTarget;
    run(event.submitter, async () => {
      const username = login.elements.username.value.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,32}$/.test(username)) {
        throw userError("A felhasználónév 3–32 ékezet nélküli betűből, számból vagy aláhúzásjelből állhat.");
      }
      // Supabase password auth expects an email. These admin-created identifiers
      // are not mailboxes; the family signs in with just the username.
      const { error } = await db.auth.signInWithPassword({
        email: `${username}@family.invalid`, password: login.elements.password.value,
      });
      if (error) throw error;
      login.reset();
    });
  });
  $("#logout").addEventListener("click", (event) => run(event.currentTarget, async () => {
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) throw error;
  }));
  $("#refresh").addEventListener("click", (event) => run(event.currentTarget, loadWishes));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    run(event.submitter, async () => {
      const title = form.elements.title.value.trim();
      const url = form.elements.url.value.trim();
      if (!title) throw userError("Add meg a kívánság megnevezését.");
      if (url && !/^https?:\/\//i.test(url)) throw userError("A termék linkje http:// vagy https:// kezdetű legyen.");
      const values = { title, url: url || null, notes: form.elements.notes.value.trim(),
        image_url: previewSource === url ? previewImage : null };
      const id = form.elements.wishId.value;
      const query = id ? db.from("wishes").update(values).eq("id", id) : db.from("wishes").insert(values);
      await query.select("id").single().throwOnError();
      form.reset();
      await loadWishes();
    });
  });
  // Do not await Supabase calls inside the auth callback.
  db.auth.onAuthStateChange((event, session) => {
    if (event !== "TOKEN_REFRESHED") setTimeout(() => showSession(session), 0);
  });
}

start().catch(report);
