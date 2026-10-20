export function setupMaster({call, authorized, setBusy, isBusy, message}) {
  const $=id=>document.getElementById(id);
  let data=null, base=null, mode='add', epoch=0;
  const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
  function years(select, selected) {
    select.replaceChildren();
    for(const year of [...new Set(data.sites.map(s=>s.year))].sort((a,b)=>b-a)) {
      const option=node('option','令和'+year+'年度'); option.value=String(year); select.append(option);
    }
    if([...select.options].some(o=>o.value===String(selected))) select.value=String(selected);
  }
  function render() {
    if(!data)return;
    const pending=new Set(data.changes.filter(c=>c.state==='待機中' && c.command.base).map(c=>c.command.base.code));
    $('masterList').replaceChildren();
    const visible=data.sites.filter(s=>s.year===Number($('masterYear').value) && (!$('masterCompany').value || s.company===$('masterCompany').value) && (s.name+' '+s.code).includes($('masterSearch').value.trim()));
    for(const site of visible) {
      const row=node('div','','master-row');
      row.append(node('strong',site.name),node('p',`${site.code} ／ ${site.company} ／ ${site.type}${site.type==='公共'?'・'+site.category:''} ／ ${site.status || '空欄'}`,'status'));
      const b=node('button',pending.has(site.code)?'Excelへの反映待ち':'編集');b.type='button';b.disabled=pending.has(site.code);b.dataset.masterPending=String(pending.has(site.code));
      b.onclick=()=>open('edit',site);row.append(b);$('masterList').append(row);
    }
    if(!visible.length)$('masterList').append(node('p','該当する現場はありません。','status'));
    $('masterChanges').replaceChildren();
    for(const c of data.changes) {
      const row=node('p',`${c.state==='待機中'?'Excelへの反映待ち':c.state}：${c.command.site.name}${c.code?'（'+c.code+'）':''} — ${c.message}`,'status');
      if(c.state==='要確認')row.style.color='#b91c1c';$('masterChanges').append(row);
    }
  }
  function open(nextMode,site=null) {
    if(isBusy() || !data)return;
    mode=nextMode;base=site?{...site}:null;
    $('masterEditorTitle').textContent=mode==='edit'?'現場を編集':'現場を追加';
    years($('editYear'),site?.year || $('masterYear').value);
    for(const [id,key,fallback] of [['editCompany','company','菊永建設'],['editType','type','公共'],['editCategory','category','通常'],['editName','name',''],['editStatus','status','○']]) $(id).value=site?.[key] ?? fallback;
    for(const id of ['editYear','editCompany','editType','editCategory']) $(id).disabled=mode==='edit';
    $('editCategory').closest('label').hidden=$('editType').value==='民間';
    $('editCode').textContent=site?'工事番号：'+site.code+'（年度・会社・種別・区分は固定）':'工事番号はExcelで自動採番します。各欄の末尾に追加します。';
    $('masterEditor').hidden=false;$('editName').focus();
  }
  async function load() {
    if(isBusy() || !authorized())return;
    const own=epoch;setBusy(true);$('masterMessage').textContent='現場を確認しています…';
    try {
      const result=await call('getMaster');if(own!==epoch)return;
      data=result;years($('masterYear'),$('masterYear').value);$('masterEditor').hidden=true;render();
      $('masterMessage').textContent=`全年度 ${data.sites.length}件。反映待ち ${data.changes.filter(c=>c.state==='待機中').length}件。`;
    } catch(e){if(own===epoch)$('masterMessage').textContent=e.message+(data?' 表示は前回取得した内容です。':'');}
    finally{if(own===epoch){setBusy(false);restoreDisabled();}}
  }
  function restoreDisabled(){document.querySelectorAll('[data-master-pending="true"]').forEach(b=>b.disabled=true);}
  $('masterRefresh').onclick=load;
  $('masterPanel').addEventListener('toggle',()=>{if($('masterPanel').open && !data)load();});
  $('masterAdd').onclick=()=>data?open('add'):load();
  $('masterCancel').onclick=()=>$('masterEditor').hidden=true;
  $('editType').onchange=()=>$('editCategory').closest('label').hidden=$('editType').value==='民間';
  for(const id of ['masterYear','masterCompany','masterSearch'])$(id).addEventListener(id==='masterSearch'?'input':'change',render);
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
  return {reset(){epoch++;data=null;base=null;$('masterEditor').hidden=true;$('masterList').replaceChildren();$('masterChanges').replaceChildren();$('masterYear').replaceChildren();$('masterSearch').value='';$('masterMessage').textContent='一覧を更新してください。';$('masterPanel').open=false;},restoreDisabled};
}
