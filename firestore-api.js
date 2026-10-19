import {getFirestore, doc, onSnapshot} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js';
import {getApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getLoginToken} from './firebase-auth.js';

const gasUrl = 'https://script.google.com/macros/s/AKfycby7a3OQFzPVbs2E8Ho7z9dCn_EbhMD9P4ZhDr2jomv30fRqWkOBcmcKaJkX7pMucennXw/exec';
const db = getFirestore(getApp());
const waiting = new Map();
let connected = false;
let cached = null;

export function watchAdminData(onData, onError) {
  return onSnapshot(doc(db, 'adminData', 'deviceRequests'), {includeMetadataChanges: true}, snapshot => {
    connected = !snapshot.metadata.fromCache;
    cached = snapshot.exists() ? snapshot.data() : null;
    onData(cached, snapshot.metadata.fromCache);
    // サーバーが保存した、自分の操作IDに対応する結果だけで完了判定。
    if (!connected) return;
    for (const [id, pending] of waiting) {
      const result = cached?.operations?.[id];
      if (!result) continue;
      clearTimeout(pending.timer);
      waiting.delete(id);
      if (result.status === 'success') pending.resolve(result);
      else pending.reject(new Error(result.message || '処理結果を確認してください'));
    }
  }, error => {
    connected = false;
    cancelAdminCommands('情報の受信が止まりました。再ログインして状態を確認してください。');
    onError(error);
  });
}

export function cancelAdminCommands(message = 'ログアウトしました。処理中だった操作は、再ログイン後に確認してください。') {
  connected = false;
  cached = null;
  for (const pending of waiting.values()) {
    clearTimeout(pending.timer);
    pending.reject(new Error(message));
  }
  waiting.clear();
}

export async function sendAdminCommand(action, targets = []) {
  if (!connected) throw new Error('サーバーに接続できていません。接続を待つか再ログインしてください。');
  const idToken = await getLoginToken();
  if (!idToken) throw new Error('再ログインしてください。');
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      waiting.delete(requestId);
      reject(new Error('完了通知を確認できませんでした。「更新」で現在の状態を確認してください。承認・無効化は完了している場合があります。'));
    }, 90000);
    waiting.set(requestId, {resolve, reject, timer});
    // no-corsの送信完了は、GASの操作成功を意味しない。
    // Firestore経由の完了通知を上の監視で待つ。
    fetch(gasUrl, {method: 'POST', mode: 'no-cors',
      headers: {'Content-Type': 'text/plain'},
      body: JSON.stringify({action, targets, requestId, idToken})
    }).catch(() => {
      const pending = waiting.get(requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      waiting.delete(requestId);
      reject(new Error('送信結果を確認できませんでした。「更新」で現在の状態を確認してください。'));
    });
  });
}
