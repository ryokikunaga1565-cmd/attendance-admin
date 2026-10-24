export function setupMaster({call, authorized, setBusy, isBusy, message}) {
  const $=id=>document.getElementById(id);
  let data=null, base=null, mode='add', epoch=0, company='菊永建設';
  const companies=Array.from(document.querySelectorAll('[data-company]'));
  const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
  function years(select, selected) {
    select.replaceChildren();
    for(const year of [...new Set(data.sites.map(s=>s.year))].sort((a,b)=>b-a)) {
      const option=node('option','令和'+year+'年度');option.value=String(year);select.append(option);
    }
    if([...select.options].some(o=>o.value===String(selected))) select.value=String(selected);
  }
  function currentChanges() { return data.changes.filter(c=>c.command.site.company===company && c.command.site.year===Number($('masterYear').value)); }
  function render() {
    if(!data)return;
    companies.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.company===company)));
    const pending=new Set(data.changes.filter(c=>c.state==='待機中' && c.command.base).map(c=>c.command.base.code));
    const visible=data.sites.filter(s=>s.year===Number($('masterYear').value) && s.company===company && ($('masterFinished').checked || s.status!==''));
    $('masterList').replaceChildren();
    for(const type of ['公共','民間']) {
      const sites=visible.filter(s=>s.type===type);if(!sites.length)continue;
      $('masterList').append(node('h3',type+'工事　'+sites.length+'件','master-group-title'));
      for(const site of sites) {
        const waiting=pending.has(site.code), row=node('div','','master-row'), info=node('div','','master-info');
        info.append(node('strong',site.name),node('p',site.code+(site.type==='公共'?' ・ '+site.category:'')));
        const badge=node('span',waiting?'反映待ち':({'○':'○ 使用中','△':'△ 過去','×':'× 非表示','':'終了'}[site.status] || site.status),'master-badge');
        if(waiting)badge.classList.add('pending');else if(site.status==='○')badge.classList.add('active');else if(site.status==='△')badge.classList.add('past');
        const b=node('button','編集','master-edit');b.type='button';b.disabled=waiting;b.dataset.masterPending=String(waiting);
        b.setAttribute('aria-label',site.name+'を編集');b.onclick=()=>open('edit',site);
        row.append(info,badge,b);$('masterList').append(row);
      }
    }
    if(!visible.length)$('masterList').append(node('p','該当する現場はありません。','status'));
    const changes=currentChanges(), waiting=changes.filter(c=>c.state==='待機中'), conflicts=changes.filter(c=>c.state==='要確認');
    $('masterPending').textContent=[waiting.length?'Excelへの反映待ち：'+waiting.map(c=>c.command.site.name).join('、'):'',conflicts.length?'要確認：'+conflicts.map(c=>c.command.site.name).join('、')+'（変更履歴を確認してください）':''].filter(Boolean).join(' ／ ');
    $('masterChanges').replaceChildren();$('masterChangeCount').textContent=changes.length?changes.length+'件':'';
    $('masterHistory').hidden=!changes.length;
    for(const c of changes) {
      const row=node('p',`${c.state==='待機中'?'Excelへの反映待ち':c.state}：${c.command.site.name}${c.code?'（'+c.code+'）':''} — ${c.message}`,'status');
      if(c.state==='要確認')row.style.color='#b91c1c';$('masterChanges').append(row);
    }
    $('masterMessage').textContent=company+' ／ 表示中 '+visible.length+'件';
  }
  function open(nextMode,site=null) {
    if(isBusy() || !data)return;
    mode=nextMode;base=site?{...site}:null;
    $('masterEditorTitle').textContent=mode==='edit'?'現場を編集':'現場を追加';
    years($('editYear'),site?.year || $('masterYear').value);
    for(const [id,key,fallback] of [['editCompany','company',company],['editType','type','公共'],['editCategory','category','通常'],['editName','name',''],['editStatus','status','○']]) $(id).value=site?.[key] ?? fallback;
    for(const id of ['editYear','editCompany','editType','editCategory']) {$(id).disabled=mode==='edit';$(id).closest('label').hidden=mode==='edit';}
    $('editCategory').closest('label').hidden=mode==='edit' || $('editType').value==='民間';
    $('editCode').textContent=site?`${site.code} ／ ${site.company} ／ ${site.type}${site.type==='公共'?'・'+site.category:''}`:'工事番号はExcelで自動採番します。';
    $('editName').readOnly=mode==='edit';$('masterRename').hidden=mode!=='edit';$('masterEditor').hidden=false;(mode==='edit'?$('editStatus'):$('editName')).focus();$('masterEditor').scrollIntoView({block:'start',behavior:'smooth'});
  }
  async function load() {
    if(isBusy() || !authorized())return;
    const own=epoch;setBusy(true);$('masterMessage').textContent='現場を確認しています…';
    try {
      const result=await call('getMaster');if(own!==epoch)return;
      data=result;years($('masterYear'),$('masterYear').value);$('masterEditor').hidden=true;render();
    } catch(e){if(own===epoch)$('masterMessage').textContent=e.message+(data?' 表示は前回取得した内容です。':'');}
    finally{if(own===epoch){setBusy(false);restoreDisabled();}}
  }
  function restoreDisabled(){document.querySelectorAll('[data-master-pending="true"]').forEach(b=>b.disabled=true);$('masterAdd').disabled=isBusy() || !data;}
  $('masterRefresh').onclick=load;
  companies.forEach(b=>b.onclick=()=>{if(isBusy())return;company=b.dataset.company;$('masterEditor').hidden=true;render();});
  $('masterAdd').onclick=()=>open('add');
  $('masterCancel').onclick=()=>$('masterEditor').hidden=true;
  $('editType').onchange=()=>$('editCategory').closest('label').hidden=$('editType').value==='民間';
  $('masterRename').onclick=()=>{$('editName').readOnly=false;$('editName').focus();};
  for(const id of ['masterYear','masterFinished'])$(id).addEventListener('change',()=>{if(id==='masterYear')$('masterEditor').hidden=true;render();});
  $('masterEditor').onsubmit=async e=>{
    e.preventDefault();if(isBusy() || !authorized())return;
    const site={name:$('editName').value.trim(),year:Number($('editYear').value),company:$('editCompany').value,type:$('editType').value,category:$('editType').value==='民間'?'民間':$('editCategory').value,status:$('editStatus').value};
    if(!confirm(site.name+' の変更を依頼しますか？Excelでの反映後に出勤簿へ反映されます。'))return;
    const own=epoch;setBusy(true);let accepted=false;
    try {
      const result=await call('requestMasterChange',{mode,base,site});if(own!==epoch)return;
      accepted=true;$('masterEditor').hidden=true;message(result.message);
      const updated=await call('getMaster');if(own!==epoch)return;data=updated;render();
      $('masterMessage').textContent='Excelへの反映待ちです。同期PCが稼働し、現場マスターを閉じると順次反映されます。';
    }catch(error){if(own===epoch)message((accepted?'依頼は受け付けましたが、一覧を更新できませんでした。':'')+error.message,true);}
    finally{if(own===epoch){setBusy(false);restoreDisabled();}}
  };
  return {load,reset(){epoch++;data=null;base=null;company='菊永建設';companies.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.company===company)));$('masterEditor').hidden=true;$('masterList').replaceChildren();$('masterChanges').replaceChildren();$('masterPending').textContent='';$('masterHistory').hidden=true;$('masterHistory').open=false;$('masterYear').replaceChildren();$('masterFinished').checked=false;$('masterMessage').textContent='現場を読み込みます…';},restoreDisabled};
}
