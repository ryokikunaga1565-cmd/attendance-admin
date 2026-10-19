import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { auth, db } from "./firebase-auth.js";
import { adminUid, gasUrl } from "./config.js";
import { createBridge } from "./bridge-core.js";
const bridge = createBridge({
  auth, adminUid, gasUrl,
  makeId: () => crypto.randomUUID(),
  listen: (uid, id, next, error) => onSnapshot(doc(db, "adminResponses", uid, "requests", id), snapshot => next(snapshot.exists() ? snapshot.data() : null), error),
  send: (url, body) => fetch(url, {
    method: "POST", mode: "no-cors", credentials: "omit", redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify(body)
  })
});
export const callAdmin = bridge.call;
export const cancelAdminCalls = bridge.cancelAll;
