import { supabaseUrl, supabasePublishableKey } from "./config.js";

const $ = (selector) => document.querySelector(selector);
const status = $("#status");
const form = $("#wish-form");
let db;
let user;
let generation = 0;

function report(error) {
  status.textContent = error.code === "23505"
    ? "Someone already claimed that wish. Refresh the list."
    : error.message || "Something went wrong. Please try again.";
}

async function run(button, action) {
  button.disabled = true;
  status.textContent = "Working…";
  try {
    await action();
    status.textContent = "Done.";
  } catch (error) {
    report(error);
  } finally {
    button.disabled = false;
  }
}

function actionButton(container, label, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", () => run(button, action));
  container.append(button);
}

async function loadWishes() {
  const current = ++generation;
  const results = await Promise.all([
    db.from("profiles").select("id, display_name").order("display_name"),
    db.from("wishes").select("id, owner_id, title, url, notes").order("created_at"),
    db.from("claims").select("wish_id, claimant_id"),
  ]);
  if (current !== generation || !user) return;
  for (const result of results) if (result.error) throw result.error;
  const [profiles, wishes, claims] = results.map((result) => result.data);
  const me = profiles.find((profile) => profile.id === user.id);
  if (!me) throw new Error("Your account has not been added to the family yet.");
  $("#signed-in").textContent = `Signed in as ${me.display_name}`;
  $("#profiles").replaceChildren();

  for (const profile of profiles) {
    const section = $("#profile-template").content.cloneNode(true);
    section.querySelector('[data-field="name"]').textContent = profile.display_name;
    const ownWishes = wishes.filter((wish) => wish.owner_id === profile.id);
    section.querySelector('[data-field="empty"]').hidden = ownWishes.length > 0;
    for (const wish of ownWishes) {
      const item = $("#wish-template").content.cloneNode(true);
      const field = (name) => item.querySelector(`[data-field="${name}"]`);
      field("title").textContent = wish.title;
      field("notes").textContent = wish.notes;
      field("url").hidden = !wish.url;
      if (wish.url && /^https?:\/\//i.test(wish.url)) field("url").href = wish.url;
      const actions = field("actions");
      if (wish.owner_id === user.id) {
        field("claim").textContent = "Reservations are a surprise.";
        actionButton(actions, "Edit", async () => {
          form.elements.wishId.value = wish.id;
          form.elements.title.value = wish.title;
          form.elements.url.value = wish.url || "";
          form.elements.notes.value = wish.notes;
          form.elements.title.focus();
        });
        actionButton(actions, "Delete", async () => {
          if (!confirm(`Delete “${wish.title}”?`)) return;
          await db.from("wishes").delete().eq("id", wish.id).throwOnError();
          if (form.elements.wishId.value === wish.id) form.reset();
          await loadWishes();
        });
      } else {
        const claim = claims.find((entry) => entry.wish_id === wish.id);
        field("claim").textContent = claim
          ? claim.claimant_id === user.id ? "Claimed by you" : "Already claimed"
          : "Available";
        if (!claim) actionButton(actions, "Claim", async () => {
          await db.from("claims").insert({ wish_id: wish.id }).throwOnError();
          await loadWishes();
        });
        if (claim?.claimant_id === user.id) actionButton(actions, "Release", async () => {
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
  $("#signed-in").textContent = "";
  form.reset();
  status.textContent = user ? "Loading wishes…" : "Log in with your family account.";
  if (user) {
    try {
      await loadWishes();
      if (user) status.textContent = "Wishes loaded.";
    } catch (error) { report(error); }
  }
}

async function start() {
  if (!supabaseUrl || !supabasePublishableKey) {
    status.textContent = "Setup needed: add your Supabase URL and publishable key to config.js. See README.md.";
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
        throw new Error("Use 3–32 letters, numbers, or underscores for your username.");
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
      if (!title) throw new Error("Please enter a wish title.");
      if (url && !/^https?:\/\//i.test(url)) throw new Error("Use an http:// or https:// product link.");
      const values = { title, url: url || null, notes: form.elements.notes.value.trim() };
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
