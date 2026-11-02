// ============================================
// Verbindung zu Firebase: Anmeldung und gemeinsamer Haushalt.
//
// Aufbau in der Cloud (Firestore):
//   haushalte/{id}
//     mitglieder: [Nutzer IDs]
//     salz, pruefwert: für das Haushalts Passwort (Prüfwert ist verschlüsselt)
//     namen: { NutzerID: verschlüsselter Anzeigename }
//   einladungen/{CODE}
//     haushaltId, gueltigBis, salz, pruefwert
//
// Die Firebase Bausteine werden erst geladen, wenn sie gebraucht
// werden. Ohne Internet funktioniert die App ganz normal weiter.
//
// Läuft die App auf dem eigenen Rechner (localhost), verbindet sie
// sich mit den Firebase Emulatoren statt mit der echten Cloud.
// So lässt sich alles gefahrlos testen.
// ============================================

import { FIREBASE_KONFIG, FIREBASE_VERSION } from "./firebase-konfig.js";
import * as tresor from "./verschluesselung.js";

// Unter diesem Namen merkt sich das Handy, zu welchem Haushalt es gehört
const HAUSHALT_SPEICHER = "finanzplaner_haushalt";

// So lange ist eine Einladung gültig
const EINLADUNG_TAGE = 7;

// Zeichen für Einladungscodes: ohne leicht verwechselbare (0, O, 1, I)
const CODE_ZEICHEN = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

let fb = null;          // { auth, db, A (Anmeldung), F (Datenbank) }
let ladeVorgang = null; // läuft gerade das Laden?

// Läuft die App auf dem eigenen Rechner? Dann Emulatoren benutzen.
export function istEmulator() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

// Firebase laden (nur einmal) und warten, bis klar ist, ob jemand angemeldet ist
export function laden() {
  if (!ladeVorgang) {
    ladeVorgang = (async function () {
      const basis = "https://www.gstatic.com/firebasejs/" + FIREBASE_VERSION + "/";
      const [appModul, A, F] = await Promise.all([
        import(basis + "firebase-app.js"),
        import(basis + "firebase-auth.js"),
        import(basis + "firebase-firestore.js")
      ]);
      const app = appModul.initializeApp(FIREBASE_KONFIG);
      const auth = A.getAuth(app);
      auth.languageCode = "de";
      const db = F.getFirestore(app);
      if (istEmulator()) {
        A.connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
        F.connectFirestoreEmulator(db, "127.0.0.1", 8080);
      }
      // Warten, bis Firebase weiß, ob schon jemand angemeldet ist
      await new Promise(function (fertig) {
        const abmelden = A.onAuthStateChanged(auth, function () { abmelden(); fertig(); });
      });
      fb = { auth: auth, db: db, A: A, F: F };
      return fb;
    })().catch(function (fehler) {
      ladeVorgang = null; // beim nächsten Mal neu versuchen
      throw fehler;
    });
  }
  return ladeVorgang;
}

// Zugriff auf die geladenen Firebase Bausteine (für den Abgleich in sync.js)
export function firebase() {
  return fb;
}

// Der angemeldete Nutzer (oder null)
export function nutzer() {
  return fb ? fb.auth.currentUser : null;
}

// Name zum Anzeigen
export function anzeigeName(u) {
  return (u && (u.displayName || u.email)) || "Unbekannt";
}

// Verständliche Fehlermeldung zu einem Firebase Fehler
export function fehlerText(fehler) {
  const code = fehler && fehler.code;
  if (code === "permission-denied") return "Keine Berechtigung. Sind die Sicherheitsregeln in Firebase eingetragen?";
  if (code === "unavailable" || code === "auth/network-request-failed") return "Keine Verbindung. Bist du online?";
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return "Die Anmeldung wurde abgebrochen.";
  if (code === "auth/popup-blocked") return "Das Anmeldefenster wurde blockiert.";
  if (code === "auth/unauthorized-domain") return "Diese Adresse ist in Firebase nicht freigegeben.";
  return (fehler && fehler.message) || "Unbekannter Fehler.";
}

// ---------- Anmelden und Abmelden ----------

export async function anmelden() {
  await laden();
  const anbieter = new fb.A.GoogleAuthProvider();
  anbieter.setCustomParameters({ prompt: "select_account" });
  return fb.A.signInWithPopup(fb.auth, anbieter);
}

// Nur für Tests mit den Emulatoren: Anmeldung ohne Google Fenster
export async function testAnmelden(email, name) {
  if (!istEmulator()) throw new Error("Nur im Test erlaubt");
  await laden();
  const ausweis = fb.A.GoogleAuthProvider.credential(JSON.stringify({
    sub: email, email: email, email_verified: true, name: name || email
  }));
  return fb.A.signInWithCredential(fb.auth, ausweis);
}

export async function abmelden() {
  await laden();
  return fb.A.signOut(fb.auth);
}

// ---------- Haushalt auf diesem Handy ----------

// Zu welchem Haushalt gehört dieses Handy? ({ id } oder null)
export function lokalerHaushalt() {
  try {
    return JSON.parse(localStorage.getItem(HAUSHALT_SPEICHER));
  } catch (fehler) {
    return null;
  }
}

function merkeHaushalt(id) {
  localStorage.setItem(HAUSHALT_SPEICHER, JSON.stringify({ id: id, seit: new Date().toISOString() }));
}

// Die Verbindung zum Haushalt auf diesem Handy lösen (Schlüssel vergessen)
export async function verbindungLoesen() {
  const h = lokalerHaushalt();
  if (h) await tresor.vergissSchluessel(h.id);
  localStorage.removeItem(HAUSHALT_SPEICHER);
}

// Angemeldeten Nutzer verlangen
function brauchtNutzer() {
  const u = nutzer();
  if (!u) throw new Error("Bitte zuerst mit Google anmelden.");
  return u;
}

// ---------- Haushalt anlegen ----------

export async function haushaltAnlegen(passwort) {
  await laden();
  const u = brauchtNutzer();
  const hinweis = tresor.pruefePasswort(passwort);
  if (hinweis) throw new Error(hinweis);

  const F = fb.F;
  const salz = tresor.neuesSalz();
  const schluessel = await tresor.schluesselAusPasswort(passwort, salz);
  const pruefwert = await tresor.erstellePruefwert(schluessel);
  const name = await tresor.verschluesseln(schluessel, anzeigeName(u));

  const ref = F.doc(F.collection(fb.db, "haushalte"));
  const namen = {};
  namen[u.uid] = name;
  await F.setDoc(ref, {
    mitglieder: [u.uid],
    erstelltVon: u.uid,
    salz: salz,
    pruefwert: pruefwert,
    namen: namen,
    erstellt: F.serverTimestamp()
  });

  await tresor.merkeSchluessel(ref.id, schluessel);
  merkeHaushalt(ref.id);
  return ref.id;
}

// ---------- Einladung ----------

// "7q4m k2xp" wird zu "7Q4MK2XP"
function normiereCode(eingabe) {
  return String(eingabe || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// "7Q4MK2XP" wird zu "7Q4M-K2XP" (besser lesbar)
export function codeZumAnzeigen(code) {
  return code.slice(0, 4) + "-" + code.slice(4);
}

// Zufälliger Code aus 8 Zeichen (32 mögliche Zeichen je Stelle)
function neuerCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), function (b) {
    return CODE_ZEICHEN[b % CODE_ZEICHEN.length];
  }).join("");
}

// Erstellt eine Einladung für den eigenen Haushalt. Ergebnis: { code, gueltigBis (Date) }
export async function einladungErstellen() {
  await laden();
  const u = brauchtNutzer();
  const h = lokalerHaushalt();
  if (!h) throw new Error("Dieses Handy gehört noch zu keinem Haushalt.");

  const F = fb.F;
  const haushalt = await F.getDoc(F.doc(fb.db, "haushalte", h.id));
  if (!haushalt.exists()) throw new Error("Der Haushalt wurde nicht gefunden.");
  const gueltigBis = new Date(Date.now() + EINLADUNG_TAGE * 86400000);

  // Falls ein Code zufällig schon vergeben ist, einen neuen versuchen
  for (let versuch = 0; versuch < 3; versuch++) {
    const code = neuerCode();
    try {
      await F.setDoc(F.doc(fb.db, "einladungen", code), {
        haushaltId: h.id,
        erstelltVon: u.uid,
        gueltigBis: F.Timestamp.fromDate(gueltigBis),
        salz: haushalt.data().salz,
        pruefwert: haushalt.data().pruefwert
      });
      return { code: codeZumAnzeigen(code), gueltigBis: gueltigBis };
    } catch (fehler) {
      if (fehler.code !== "permission-denied" || versuch === 2) throw fehler;
    }
  }
}

// ---------- Beitreten ----------

export async function beitreten(codeEingabe, passwort) {
  await laden();
  const u = brauchtNutzer();
  const F = fb.F;

  const code = normiereCode(codeEingabe);
  if (code.length !== 8) throw new Error("Der Einladungscode hat 8 Zeichen, zum Beispiel 7Q4M-K2XP.");

  const einladung = await F.getDoc(F.doc(fb.db, "einladungen", code));
  if (!einladung.exists()) throw new Error("Diesen Einladungscode gibt es nicht. Bitte prüfe ihn noch einmal.");
  const e = einladung.data();
  if (e.gueltigBis.toMillis() < Date.now()) throw new Error("Diese Einladung ist abgelaufen. Bitte lass dir eine neue schicken.");

  // Passwort prüfen, bevor man beitritt
  const schluessel = await tresor.schluesselAusPasswort(passwort || "", e.salz);
  if (!(await tresor.stimmtSchluessel(schluessel, e.pruefwert))) {
    throw new Error("Das Haushalts Passwort stimmt nicht.");
  }

  const aenderung = {
    mitglieder: F.arrayUnion(u.uid),
    beitrittCode: code
  };
  aenderung["namen." + u.uid] = await tresor.verschluesseln(schluessel, anzeigeName(u));

  try {
    await F.updateDoc(F.doc(fb.db, "haushalte", e.haushaltId), aenderung);
  } catch (fehler) {
    // Schon Mitglied? Dann ist das Ziel ja erreicht.
    const schonDabei = await F.getDoc(F.doc(fb.db, "haushalte", e.haushaltId)).then(
      function (s) { return s.exists() && s.data().mitglieder.includes(u.uid); },
      function () { return false; }
    );
    if (!schonDabei) throw fehler;
  }

  await tresor.merkeSchluessel(e.haushaltId, schluessel);
  merkeHaushalt(e.haushaltId);
  return e.haushaltId;
}

// ---------- Infos zum Haushalt ----------

// Ergebnis: { zustand: "ok" | "schluesselFehlt" | "nichtGefunden", namen, anzahl }
export async function haushaltInfo() {
  await laden();
  const u = brauchtNutzer();
  const h = lokalerHaushalt();
  if (!h) return { zustand: "keinHaushalt" };

  const F = fb.F;
  let daten;
  try {
    const s = await F.getDoc(F.doc(fb.db, "haushalte", h.id));
    if (!s.exists()) return { zustand: "nichtGefunden" };
    daten = s.data();
  } catch (fehler) {
    // Kein Mitglied mehr (z. B. mit einem anderen Google Konto angemeldet)
    if (fehler.code === "permission-denied") return { zustand: "nichtGefunden" };
    throw fehler;
  }
  if (!daten.mitglieder.includes(u.uid)) return { zustand: "nichtGefunden" };

  const schluessel = await tresor.holeSchluessel(h.id);
  if (!schluessel) return { zustand: "schluesselFehlt", anzahl: daten.mitglieder.length };

  // Namen der Mitglieder entschlüsseln
  const namen = [];
  for (const uid of daten.mitglieder) {
    try {
      namen.push(await tresor.entschluesseln(schluessel, daten.namen[uid]));
    } catch (fehler) {
      namen.push("Unbekannt");
    }
  }
  return { zustand: "ok", namen: namen, anzahl: daten.mitglieder.length };
}

// Passwort neu eingeben, falls das Handy den Schlüssel vergessen hat
export async function passwortErneutEingeben(passwort) {
  await laden();
  brauchtNutzer();
  const h = lokalerHaushalt();
  const s = await fb.F.getDoc(fb.F.doc(fb.db, "haushalte", h.id));
  const schluessel = await tresor.schluesselAusPasswort(passwort || "", s.data().salz);
  if (!(await tresor.stimmtSchluessel(schluessel, s.data().pruefwert))) {
    throw new Error("Das Haushalts Passwort stimmt nicht.");
  }
  await tresor.merkeSchluessel(h.id, schluessel);
}

// ---------- Haushalt verlassen ----------

export async function haushaltVerlassen() {
  await laden();
  const u = brauchtNutzer();
  const h = lokalerHaushalt();
  if (h) {
    const F = fb.F;
    const aenderung = { mitglieder: F.arrayRemove(u.uid) };
    aenderung["namen." + u.uid] = F.deleteField();
    try {
      await F.updateDoc(F.doc(fb.db, "haushalte", h.id), aenderung);
    } catch (fehler) {
      // Haushalt gibt es nicht mehr oder man ist schon raus: lokal trotzdem lösen
      if (fehler.code !== "permission-denied" && fehler.code !== "not-found") throw fehler;
    }
  }
  await verbindungLoesen();
}
