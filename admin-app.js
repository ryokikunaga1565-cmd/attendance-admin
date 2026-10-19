import {login, watchLogin, logout} from './firebase-auth.js';
import {watchAdminData, sendAdminCommand, cancelAdminCommands} from './firestore-api.js?v=20261019-2';

const ADMIN_UID = '7pL6jRnmVFf0onlggWpFrwPFuGZ2';
const $ = id => document.getElementById(id);
let stopWatching = null, busy = false, showAll = false, ready = false, serverReady = false;
let requests = [], devices = [], session = 0;

function say(message, error = false) {
  $('operationMessage').textContent = message;
  $('operationMessage').className = 'status ' + (error ? 'warning' : 'success');
}
function updateButtons() {
  document.querySelectorAll('[data-command]').forEach(button => {
    button.disabled = busy || !serverReady || (button.dataset.mutation !== undefined && !ready);
  });
}
function target(item) {
  return {employee: item.employee, deviceId: item.deviceId, requestedAt: item.requestedAt};
}
function text(tag, content, className = '') {
  const element = document.createElement(tag);
  element.textContent = content;
  element.className = className;
  return element;
}
function actionButton(label, action, item, danger = false) {
  const button = text('button', label, 'approve' + (danger ? ' danger' : ''));
  button.type = 'button';
  button.dataset.command = '';
  button.dataset.mutation = '';
  button.addEventListener('click', () => {
    if (busy || !ready) return;
    const message = item.employee + ' さんの端末を' + (danger ? '無効化' : '承認') + 'しますか？\n端末ID：' + item.deviceId;
    if (confirm(message)) void run(action, [target(item)]);
  });
  return button;
}
function renderLists() {
  const list = $('requestList');
  list.replaceChildren();
  $('deviceRequestCount').textContent = ready ? requests.length + '件' : '未取得';
  $('requestStatus').textContent = ready ? '承認待ち：' + requests.length + '件' : '最新の申請情報を確認してください。';
  $('approveAllButton').hidden = !ready || requests.length === 0;
  if (ready && !requests.length) list.append(text('p', '現在、承認待ちの申請はありません。', 'status'));
  for (const item of requests) {
    const panel = text('div', '', 'request');
    panel.append(text('strong', item.employee), text('p', '申請日時：' + item.requestedAt, 'status'),
      text('p', '端末ID：' + item.deviceId, 'status'), actionButton('承認する', 'approveDevice', item));
    list.append(panel);
  }
  const deviceList = $('approvedDeviceList');
  deviceList.replaceChildren();
  $('toggleDeviceHistoryButton').textContent = showAll ? '有効な端末のみ表示' : 'すべて表示（無効化済みを含む）';
  const items = showAll ? devices : devices.filter(d => d.enabled === '有効' && d.status === '承認済み');
  if (ready && !items.length) deviceList.append(text('p', '対象の端末はありません。', 'status'));
  for (const item of items) {
    const panel = text('div', '', 'request');
    panel.append(text('strong', item.employee), text('p', '端末ID：' + item.deviceId, 'status'),
      text('p', '登録日時：' + item.registeredAt, 'status'), text('p', '状態：' + item.status, 'status'));
    if (item.enabled === '有効' && item.status === '承認済み')
      panel.append(actionButton('無効化する', 'disableDevice', item, true));
    deviceList.append(panel);
  }
  updateButtons();
}

function render(data, fromCache) {
  serverReady = !fromCache;
  const summary = data?.syncSummary;
  ready = data?.schemaVersion === 2 && Array.isArray(data.requests) && Array.isArray(data.devices) &&
    summary && ['pending', 'edits', 'other'].every(key => Number.isInteger(summary[key]) && summary[key] >= 0);
  if (!ready) {
    requests = []; devices = [];
    $('syncPending').textContent = '—'; $('syncEdits').textContent = '—';
    $('syncSummaryMessage').textContent = 'データの準備が必要です。GASの差し替え・初期設定を確認してください。';
    $('syncCheckedAt').textContent = '';
    $('dataStatus').textContent = '最新情報をまだ取得できていません。';
  } else {
    requests = data.requests; devices = data.devices;
    $('syncPending').textContent = summary.pending + '件';
    $('syncEdits').textContent = summary.edits + '件';
    $('syncSummaryMessage').textContent = (summary.pending + summary.edits > 0 ?
      '反映待ちがあります。同期用PCが起動し、勤務表同期が動作すると順次反映されます。' :
      '現在、反映待ちの記録はありません。') + (summary.other > 0 ? ' 状態の確認が必要な記録：' + summary.other + '件。' : '');
    $('syncCheckedAt').textContent = '確認日時：' + summary.checkedAt + '（全年度を集計）';
    $('dataStatus').textContent = fromCache ? '保存されていた情報を表示しています。通信を確認中です。' :
      'Google側の確認日時：' + summary.checkedAt + '。起動時・「更新」を押したときに取得します。';
  }
  renderLists();
}

async function run(action, targets = []) {
  if (busy || !serverReady) return;
  const mySession = session;
  busy = true; updateButtons();
  say(action === 'refreshAdmin' ? '最新の情報を取得中...' : '処理中です。完了までお待ちください。');
  try {
    const result = await sendAdminCommand(action, targets);
    if (mySession === session) say(result.message);
  } catch (error) {
    if (mySession === session) say(error.message || '処理結果を確認できませんでした。「更新」で確認してください。', true);
  } finally {
    if (mySession === session) { busy = false; updateButtons(); }
  }
}

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('loginForm').querySelector('button');
  button.disabled = true; $('loginMessage').textContent = 'ログイン中...';
  try {
    await login($('loginEmail').value.trim(), $('loginPassword').value);
    $('loginForm').reset();
  } catch (_) {
    $('loginMessage').textContent = 'ログインできませんでした。入力内容を確認してください。';
  } finally { button.disabled = false; }
});
$('logoutButton').addEventListener('click', async () => {
  try { await logout(); } catch (_) { say('ログアウトできませんでした。もう一度お試しください。', true); }
});
document.querySelectorAll('[data-refresh]').forEach(button => button.addEventListener('click', () => void run('refreshAdmin')));
$('toggleDeviceHistoryButton').addEventListener('click', () => { showAll = !showAll; renderLists(); });
$('approveAllButton').dataset.mutation = '';
$('approveAllButton').addEventListener('click', () => {
  if (busy || !ready || !requests.length) return;
  if (requests.length > 200) { say('申請が200件を超えています。個別に承認してください。', true); return; }
  const targets = requests.map(target);
  if (confirm('表示中の申請 ' + targets.length + '件をまとめて承認しますか？')) void run('approveDevices', targets);
});

watchLogin(user => {
  const current = ++session;
  if (stopWatching) { stopWatching(); stopWatching = null; }
  cancelAdminCommands();
  busy = false; ready = false; serverReady = false; requests = []; devices = []; showAll = false;
  $('startup').hidden = true;
  $('adminScreen').hidden = true;
  $('loginScreen').hidden = !!user;
  $('loginMessage').textContent = '';
  say(''); render(null, true);
  if (!user) return;
  if (user.uid !== ADMIN_UID) {
    void logout().then(() => { $('loginMessage').textContent = 'このアカウントには管理者権限がありません。'; })
      .catch(() => { $('startup').hidden = false; $('startup').textContent = '管理者権限がありません。ページを閉じてください。'; });
    return;
  }
  $('adminScreen').hidden = false;
  let refreshed = false;
  stopWatching = watchAdminData((data, fromCache) => {
    if (session !== current) return;
    render(data, fromCache);
    if (!fromCache && !refreshed) { refreshed = true; void run('refreshAdmin'); }
  }, () => {
    if (session !== current) return;
    serverReady = false; updateButtons();
    $('dataStatus').textContent = '情報を受信できません。通信状態・Firestoreの閲覧権限を確認し、再ログインしてください。';
    say('表示中の情報を更新できていません。', true);
  });
});
