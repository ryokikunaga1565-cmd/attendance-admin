// GASのno-cors送信自体を成功扱いせず、認証付きFirestoreの処理結果を待つ。
export function createBridge({ auth, adminUid, gasUrl, listen, send, makeId, timeoutMs = 90000 }) {
  const pending = new Set();
  function cancelAll() {
    for (const cancel of [...pending]) cancel();
  }
  async function call(action, payload = {}) {
    const user = auth.currentUser;
    if (!user || user.uid !== adminUid) throw new Error("管理者としてログインしてください。");
    const idToken = await user.getIdToken();
    if (auth.currentUser !== user) throw new Error("ログイン状態が変わりました。");
    const requestId = makeId();
    return new Promise((resolve, reject) => {
      let stop = null, settled = false, sent = false;
      const finish = (error, value) => {
        if (settled) return;
        settled = true; clearTimeout(timer); stop?.(); pending.delete(cancel);
        error ? reject(error) : resolve(value);
      };
      const cancel = () => finish(new Error("ログアウトにより画面の待機を終了しました。処理結果は再ログイン後に更新して確認してください。"));
      const timer = setTimeout(() => finish(new Error("処理結果を確認できませんでした。重ねて操作せず、更新して状態を確認してください。")), timeoutMs);
      pending.add(cancel);
      try {
        stop = listen(user.uid, requestId, result => {
          if (settled) return;
          if (result?.status === "complete") {
            if (result.ok) finish(null, result.data);
            else finish(new Error(result.error || "処理を完了できませんでした。更新して状態を確認してください。"));
            return;
          }
          if (sent) return;
          sent = true;
          if (auth.currentUser !== user) { cancel(); return; }
          Promise.resolve().then(() => send(gasUrl, { requestId, action, payload, idToken }))
            .catch(() => {
              // リダイレクトで送信応答が失敗しても、処理が実行された可能性がある。
              // 結果の監視を続け、書き込みを自動再送しない。
            });
        }, () => finish(new Error("結果の読み取りが許可されていません。Firestoreのルールとログイン状態を確認してください。")));
        if (settled) stop?.();
      } catch {
        finish(new Error("接続を開始できませんでした。設定を確認してください。"));
      }
    });
  }
  return { call, cancelAll };
}
