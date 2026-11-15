// Hungarian text is the key; keep the German translation beside it.
const german = {
  "Családi kívánságlista": "Wünsche für die Familie",
  "Családunk apró örömei": "Die kleinen Freuden unserer Familie",
  "Apró kívánságok, szívből jövő ajándékok. Van mit várni!": "Kleine Wünsche. Geschenke von Herzen. Vorfreude für alle.",
  "Betöltés…": "Wird geladen…",
  "Bejelentkezés": "Anmelden",
  "Lépj be, és meríts ötletet az ajándékozáshoz.": "Melde dich an und entdecke Geschenkideen.",
  "Felhasználónév": "Benutzername",
  "Jelszó": "Passwort",
  "Használj 3–32 ékezet nélküli betűt, számot vagy aláhúzásjelet.": "Verwende 3–32 Buchstaben (A–Z), Zahlen oder Unterstriche.",
  "Kijelentkezés": "Abmelden",
  "Kívánság hozzáadása vagy szerkesztése": "Wunsch hinzufügen oder bearbeiten",
  "Megnevezés": "Bezeichnung",
  "Termék linkje (nem kötelező)": "Produktlink (optional)",
  "Megjegyzés (nem kötelező)": "Notizen (optional)",
  "Kívánság mentése": "Wunsch speichern",
  "Mégse": "Abbrechen",
  "Kívánságlistáink": "Unsere Wunschlisten",
  "Listák frissítése": "Listen aktualisieren",
  "Még nincsenek kívánságok.": "Noch keine Wünsche.",
  "Ajándék megtekintése": "Geschenk ansehen",
  "Családunknak készült, egy kis odafigyeléssel és sok szeretettel.": "Für unsere Familie gemacht, mit Aufmerksamkeit und ganz viel Liebe.",
  "Valaki már lefoglalta ezt a kívánságot. Frissítsd a listát.": "Dieser Wunsch wurde bereits reserviert. Aktualisiere die Liste.",
  "Ehhez a művelethez nincs jogosultságod.": "Du hast keine Berechtigung für diese Aktion.",
  "Ellenőrizd a megadott adatokat és a mezők hosszát.": "Prüfe deine Angaben und die Länge der Eingaben.",
  "A kapcsolódó adat már nem érhető el. Frissítsd a listát.": "Der zugehörige Eintrag ist nicht mehr verfügbar. Aktualisiere die Liste.",
  "A kívánság már nem érhető el, vagy nem módosíthatod. Frissítsd a listát.": "Der Wunsch ist nicht mehr verfügbar oder du darfst ihn nicht bearbeiten. Aktualisiere die Liste.",
  "Hibás felhasználónév vagy jelszó.": "Benutzername oder Passwort ist falsch.",
  "A fiók még nincs megerősítve. Kérd az adminisztrátor segítségét.": "Das Konto wurde noch nicht bestätigt. Bitte die Administration um Hilfe.",
  "Túl sok próbálkozás. Próbáld újra egy kicsit később.": "Zu viele Versuche. Bitte versuche es später erneut.",
  "A munkamenet lejárt. Jelentkezz be újra.": "Deine Sitzung ist abgelaufen. Melde dich erneut an.",
  "Nem sikerült a művelet. Ellenőrizd az internetkapcsolatot, és próbáld újra.": "Die Aktion ist fehlgeschlagen. Prüfe deine Internetverbindung und versuche es erneut.",
  "Töltsd ki ezt a mezőt.": "Bitte fülle dieses Feld aus.",
  "Adj meg egy érvényes webcímet.": "Gib eine gültige Webadresse ein.",
  "Rövidítsd le a megadott szöveget.": "Bitte kürze den eingegebenen Text.",
  "Folyamatban…": "Wird bearbeitet…",
  "Kész.": "Erledigt.",
  "A fiókod még nincs hozzáadva a családhoz.": "Dein Konto wurde noch nicht zur Familie hinzugefügt.",
  "Bejelentkezve: {name}": "Angemeldet als: {name}",
  "Titok, hogy ki készül ajándékkal.": "Wer dich beschenkt, bleibt eine Überraschung.",
  "Szerkesztés": "Bearbeiten",
  "Törlés": "Löschen",
  "Biztosan törlöd ezt a kívánságot: „{title}”?": "Möchtest du diesen Wunsch wirklich löschen: „{title}“?",
  "Te foglaltad le": "Von dir reserviert",
  "Már lefoglalták": "Bereits reserviert",
  "Még szabad": "Noch verfügbar",
  "Lefoglalás": "Reservieren",
  "Foglalás visszavonása": "Reservierung aufheben",
  "Kívánságok betöltése…": "Wünsche werden geladen…",
  "Jelentkezz be a családi fiókoddal.": "Melde dich mit deinem Familienkonto an.",
  "A kívánságok betöltve.": "Wünsche geladen.",
  "Beállítás szükséges: add meg a Supabase URL-jét és nyilvános kulcsát a config.js fájlban. Útmutató: README.md.": "Einrichtung erforderlich: Trage die Supabase-URL und den öffentlichen Schlüssel in config.js ein. Anleitung: README.md.",
  "A felhasználónév 3–32 ékezet nélküli betűből, számból vagy aláhúzásjelből állhat.": "Der Benutzername darf aus 3–32 Buchstaben (A–Z), Zahlen oder Unterstrichen bestehen.",
  "Add meg a kívánság megnevezését.": "Gib eine Bezeichnung für deinen Wunsch ein.",
  "A termék linkje http:// vagy https:// kezdetű legyen.": "Der Produktlink muss mit http:// oder https:// beginnen.",
  "Nyelv": "Sprache"
};
let language = "hu";
try {
  const saved = localStorage.getItem("wishlist-language");
  if (saved === "de" || saved === "hu") language = saved;
} catch { /* Language switching also works when storage is unavailable. */ }

export function t(key, values = {}) {
  const text = language === "de" ? german[key] || key : key;
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

export function setText(element, key, values = {}) {
  element.dataset.i18n = key;
  element.dataset.i18nValues = JSON.stringify(values);
  element.textContent = t(key, values);
}

function translate(root) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n, JSON.parse(element.dataset.i18nValues || "{}"));
  }
  for (const element of root.querySelectorAll("[data-i18n-title]")) {
    element.title = t(element.dataset.i18nTitle);
  }
}

function applyLanguage() {
  document.documentElement.lang = language;
  translate(document);
  for (const template of document.querySelectorAll("template")) translate(template.content);
  // Clear cached validation messages; the next validation uses the chosen language.
  for (const input of document.querySelectorAll("input, textarea")) input.setCustomValidity("");
}

const picker = document.querySelector("#language");
picker.value = language;
picker.addEventListener("change", () => {
  language = picker.value;
  try { localStorage.setItem("wishlist-language", language); } catch { /* Optional persistence. */ }
  applyLanguage();
});
applyLanguage();
