import { setupSchedule } from './schedule-ui.js';
import { setupMaster } from './master-ui.js';
import { auth, watchLogin, login, logout } from './firebase-auth.js';
import { adminUid } from './config.js';
import { callAdmin, cancelAdminCalls } from './firestore-api.js';

const $ = id => document.getElementById(id);
let current = null, busy = false, showAll = false, session = 0;
const master = setupMaster({call:callAdmin, authorized:()=>auth.currentUser?.uid===adminUid, setBusy, isBusy:()=>busy, message});
const schedule = setupSchedule({call:callAdmin, authorized:()=>auth.currentUser?.uid===adminUid, setBusy, isBusy:()=>busy, message});
function message(text, error = false) {
  $('pageMessage').textContent = text;
  $('pageMessage').style.color = error ? '#b91c1c' : '#475569';
}
function setBusy(value) {
  busy = value;
  document.querySelectorAll('#adminScreen button:not([data-logout])').forEach(button => { button.disabled = value; });
  if(!value) { master.restoreDisabled(); schedule.restoreDisabled(); }
}
function element(tag, text, className) {
  const item = document.createElement(tag); item.textContent = text;
  if (className) item.className = className;
  return item;
}
function render() {
  if (!current) return;
  const { requests, devices, summary } = current;
  $('adminStatus').textContent = '管理者認証：成功';
  $('status').textContent = '承認待ち：' + requests.length + '件';
  $('approveAllButton').style.display = requests.length >= 2 ? 'block' : 'none';
  $('approveAllButton').textContent = requests.length + '件をまとめて承認';
  $('requestList').replaceChildren();
  if (!requests.length) $('requestList').textContent = '現在、承認待ちの申請はありません。';
  for (const request of requests) {
    const panel = element('div', '', 'request');
    panel.append(element('strong', request.employee), element('p', '申請日時：' + request.requestedAt, 'status'));
    const button = element('button', '承認する', 'approve'); button.type = 'button';
    button.onclick = () => approveRequest(request); panel.append(button); $('requestList').append(panel);
  }
  $('toggleDeviceHistoryButton').textContent = showAll ? '有効な端末だけ表示' : 'すべて表示（無効化済みを含む）';
  $('approvedDeviceList').replaceChildren();
  const visible = devices.filter(device => showAll || (device.enabled === '有効' && device.status === '承認済み'));
  if (!visible.length) $('approvedDeviceList').textContent = '対象の端末はありません。';
  for (const device of visible) {
    const panel = element('div', '', 'request');
    panel.append(element('strong', device.employee), element('p', '登録日時：' + device.registeredAt, 'status'), element('p', '状態：' + device.status + ' ／ ' + device.enabled, 'status'));
    if (device.enabled === '有効' && device.status === '承認済み') {
      const button = element('button', '無効化する'); button.type = 'button';
      button.style.cssText = 'width:100%;background:#b91c1c;color:white';
      button.onclick = () => disableDevice(device); panel.append(button);
    }
    $('approvedDeviceList').append(panel);
  }
  $('syncPending').textContent = summary.available ? summary.pending + '件' : '—';
  $('syncEdits').textContent = summary.available ? summary.edits + '件' : '—';
  $('syncSummaryMessage').textContent = !summary.available ? '年度別出勤表が見つからないため、件数を確認できません。' :
    (summary.pending + summary.edits > 0 ? '反映待ちがあります。同期用PCで勤務表同期が動作すると順次反映されます。' : '現在、反映待ちの記録はありません。') +
    (summary.other > 0 ? ' 状態の確認が必要な記録：' + summary.other + '件。' : '');
  $('syncCheckedAt').textContent = '確認日時：' + summary.checkedAt + '（全年度を集計）';
  setBusy(busy);
}
async function refreshAdmin() {
  if (busy || auth.currentUser?.uid !== adminUid) return;
  const epoch = session;
  if(schedule.isVisible()) await schedule.load(); else await master.load();
  if (epoch !== session) return;
  setBusy(true); message('最新の情報を確認しています…');
  try {
    const result = await callAdmin('getOverview');
    if (epoch !== session) return;
    current = result; render(); message('更新しました。');
  } catch (error) {
    if (epoch === session) message(error.message + (current ? ' 表示中の一覧は前回取得した内容です。' : ''), true);
  } finally { if (epoch === session) setBusy(false); }
}
async function mutate(action, payload) {
  if (busy) return;
  const epoch = session; setBusy(true); message('処理結果を確認しています…');
  let completed = false;
  try {
    const result = await callAdmin(action, payload);
    if (epoch !== session) return;
    completed = true;
    const data = await callAdmin('getOverview');
    if (epoch !== session) return;
    current = data; render();
    const failed = result.results?.filter(item => !item.ok) || [];
    const note = result.results ? ' 成功：' + result.results.filter(item => item.ok).length + '件／未完了：' + failed.length + '件。' : '';
    message(result.message + note + (failed.length ? ' 未完了：' + failed.map(item => item.employee).join('、') : ''), failed.length > 0);
  } catch (error) {
    if (epoch === session) message((completed ? '操作は完了しましたが、一覧を更新できませんでした。' : '') + error.message, true);
  } finally { if (epoch === session) setBusy(false); }
}
function approveRequest(request) {
  if (!busy && confirm(request.employee + ' さんの端末を承認しますか？')) mutate('approveDevice', request);
}
function disableDevice(device) {
  if (!busy && confirm(device.employee + ' さんの端末を無効化しますか？')) mutate('disableDevice', device);
}
function approveAllRequests() {
  const targets = current?.requests.map(({ employee, deviceId }) => ({ employee, deviceId })) || [];
  if (!busy && targets.length >= 2 && confirm(targets.length + '件の端末登録をまとめて承認しますか？')) mutate('approveDevices', { devices: targets });
}
function toggleDeviceHistory() { showAll = !showAll; render(); }
Object.assign(window, { refreshAdmin, loadSyncSummary: refreshAdmin, loadRequests: refreshAdmin, loadApprovedDevices: refreshAdmin, approveAllRequests, toggleDeviceHistory });

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button'); button.disabled = true;
  $('loginMessage').textContent = 'ログイン中…';
  try {
    await login($('loginEmail').value.trim(), $('loginPassword').value);
    $('loginPassword').value = '';
  } catch {
    $('loginMessage').textContent = 'ログインできませんでした。メールアドレスとパスワードを確認してください。';
  } finally { button.disabled = false; }
});
$('logoutButton').onclick = async () => {
  try { await logout(); } catch { message('ログアウトできませんでした。通信を確認してください。', true); }
};
watchLogin(async user => {
  session++; cancelAdminCalls(); master.reset(); schedule.reset(); current = null; showAll = false; busy = false;
  $('requestList').replaceChildren(); $('approvedDeviceList').replaceChildren();
  $('syncPending').textContent = '—'; $('syncEdits').textContent = '—';
  $('syncCheckedAt').textContent = ''; $('syncSummaryMessage').textContent = '最新情報を確認してください。';
  $('status').textContent = '申請一覧を確認してください。'; $('adminStatus').textContent = '';
  $('approveAllButton').style.display = 'none';
  $('bootMessage').hidden = true;
  const authorized = user?.uid === adminUid;
  $('adminScreen').hidden = !authorized; $('loginScreen').hidden = authorized;
  setBusy(false); message('');
  if (user && !authorized) {
    await logout(); $('loginMessage').textContent = 'このアカウントには管理者権限がありません。'; return;
  }
  $('loginMessage').textContent = '';
  if (authorized) await refreshAdmin();
});
