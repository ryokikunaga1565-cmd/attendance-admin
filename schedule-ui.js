import {shortName,shortPeople,reiwaDate,weekLabel,personChoices,matchesPerson} from './schedule-format.js';
export function setupSchedule({call,authorized,setBusy,isBusy,message}) {
 const $=id=>document.getElementById(id), el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
 let catalog=[],state=null,epoch=0,editor=null,filter='';
 $('schedulePanel').innerHTML=`<div class="schedule-heading"><div><h2>工程表マスター</h2><p class="status">共有Excelと連携</p></div><button id="scheduleRefresh" type="button">↻ 更新</button></div>
 <div class="schedule-controls"><button id="schedulePrev" type="button" aria-label="前の週">‹</button><select id="scheduleWeek" aria-label="表示する週"></select><button id="scheduleNext" type="button" aria-label="次の週">›</button></div>
 <div class="schedule-controls"><label>人員で絞り込み<select id="schedulePerson"><option value="">全員</option></select></label><button id="schedulePrint" type="button">印刷・PDF</button><button id="schedulePublish" type="button" class="master-primary">社員へ公開</button></div>
 <p id="scheduleMessage" class="status" role="status" aria-live="polite">工程表を読み込みます。</p><p id="schedulePublished" class="status"></p>
 <form id="scheduleEditor" class="schedule-editor" hidden><strong id="scheduleEditorTitle"></strong>
 <div id="scheduleSiteFields"><label>現場マスターから選ぶ<select id="scheduleSite"><option value="">予定名を直接入力／変更しない</option></select></label></div>
 <label>現場名・予定名<input id="scheduleName" maxlength="300" required autocomplete="off"></label>
 <label>工事番号<input id="scheduleCode" readonly></label><button id="scheduleRename" type="button">現場名・工事番号を変更する</button><label>昼・夜／時間<input id="scheduleTime" maxlength="300" placeholder="昼、夜、午前 など"></label>
 <label>住所<input id="scheduleAddress" maxlength="300"></label><label>人員・協力会社<input id="schedulePeople" maxlength="1000" placeholder="氏名を「・」で区切って入力"></label><div id="schedulePeopleOptions" class="schedule-chips"></div>
 <fieldset><legend>使用車両・機械（押して選択）</legend><div id="scheduleVehicles" class="schedule-vehicles"></div></fieldset>
 <div class="schedule-controls"><button id="scheduleSave" type="submit" class="master-primary">Excelへ反映を依頼</button><button id="scheduleCancel" type="button">閉じる</button><button id="scheduleRemove" type="button" class="schedule-remove">この予定を削除</button></div></form>
 <div id="scheduleDays"></div><details id="scheduleHistory"><summary>反映状況・変更履歴</summary><div id="scheduleChanges"></div></details>`;
 function switchView(view){
  if(isBusy())return;
  $('masterPanel').hidden=view!=='master';$('schedulePanel').hidden=view!=='schedule';
  document.querySelectorAll('[data-work-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workView===view)));
  if(view==='schedule' && !state)load();
 }
 document.querySelectorAll('[data-work-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.workView));
 const pending=()=>state?.changes.some(c=>c.state==='待機中');
 function restoreDisabled(){
  for(const id of ['schedulePrint','schedulePublish'])$(id).disabled=isBusy()||!state||(id==='schedulePublish'&&pending());
  document.querySelectorAll('[data-schedule-write]').forEach(b=>b.disabled=isBusy()||!state||pending());
  $('schedulePrev').disabled=isBusy()||!state||catalog.findIndex(w=>w.key===state.week.key)>=catalog.length-1;
  $('scheduleNext').disabled=isBusy()||!state||catalog.findIndex(w=>w.key===state.week.key)<=0;
 }
 function fillWeekSelect(){const selected=$('scheduleWeek').value;$('scheduleWeek').replaceChildren();for(const w of catalog){const o=el('option',weekLabel(w));o.value=w.key;$('scheduleWeek').append(o);}if(catalog.some(w=>w.key===selected))$('scheduleWeek').value=selected;}
 function personOptions(){return personChoices(state.week,state.people||[]);}
 function render(){
  const w=state.week;const select=$('schedulePerson');select.replaceChildren();for(const name of ['',...personOptions()]){const o=el('option',name||'全員');o.value=name;select.append(o);}if(![...select.options].some(o=>o.value===filter))filter='';select.value=filter;$('scheduleWeek').value=w.key;$('scheduleEditor').hidden=true;$('scheduleDays').replaceChildren();
  for(const [i,day] of w.days.entries()){
   const section=el('section','','schedule-day'),head=el('div','','schedule-day-heading');
   head.append(el('h3',day.date.slice(5).replace('-','/')+'（'+'月火水木金土日'[i]+'）'));
   const tools=el('div','','schedule-controls');const add=el('button','＋ 予定');add.type='button';add.dataset.scheduleWrite='true';add.onclick=()=>openEditor(day,null);tools.append(add);
   if(i>0){const copy=el('button','前日をコピー');copy.type='button';copy.dataset.scheduleWrite='true';copy.onclick=()=>{if(confirm(day.date+' の予定を前日の内容で置き換えます。よろしいですか？'))mutate({kind:'copyDay',date:day.date,sourceDate:w.days[i-1].date});};tools.append(copy);}head.append(tools);section.append(head);
   const rows=day.rows.filter(r=>matchesPerson(r.data.people,filter));
   if(!rows.length)section.append(el('p',filter?'該当する予定はありません。':'予定なし','status'));
   for(const row of rows){
    const d=row.data, card=el('article','','schedule-card'),title=el('div','','schedule-card-heading');title.append(el('strong',d.name||'予定名未入力'),el('span',d.time||'時間未入力','master-badge'));if(/夜/.test(d.time))title.lastChild.classList.add('schedule-night');card.append(title);
    if(d.code)card.append(el('p',d.code,'schedule-code'));
    card.append(el('p','人員：'+(shortPeople(d.people)||'未入力')));
    const vehicles=d.vehicles.map((value,j)=>value?w.vehicles[j]+(value==='1'?'':'（'+value+'）'):'').filter(Boolean);
    card.append(el('p','車両・機械：'+(vehicles.join('・')||'なし'),'status'));
    const actions=el('div','','schedule-card-actions');
    if(d.address){const address=el('a','⌖ '+d.address);let query=d.address;if(/^(南区|中央区|緑区)/.test(query))query='相模原市'+query;address.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);address.target='_blank';address.rel='noopener noreferrer';actions.append(address);}
    const edit=el('button','編集');edit.type='button';edit.dataset.scheduleWrite='true';edit.onclick=()=>openEditor(day,row);actions.append(edit);card.append(actions);section.append(card);
   }
   $('scheduleDays').append(section);
  }
  if(w.notes?.length){const notes=el('section','','schedule-day');notes.append(el('h3','日程未確定・メモ（Excelで編集）'));w.notes.forEach(text=>notes.append(el('p',text,'status')));$('scheduleDays').append(notes);}
  const waiting=state.changes.filter(c=>c.state==='待機中').length;
  $('scheduleMessage').textContent=waiting?'Excelへの反映待ちです。同期PCでExcelを閉じると順次反映します。':'Excel同期版を表示しています。変更後は「更新」で反映を確認できます。';
  $('schedulePublished').textContent=state.publishedAt?'社員向け公開：'+reiwaDate(state.publishedAt,true)+(state.publishedRevision!==w.revision?'（Excelに未公開の変更があります）':'（表示中の版と同じ）'):'この週は社員へ未公開です。';
  $('scheduleChanges').replaceChildren();for(const c of state.changes){const p=el('p',(c.state==='待機中'?'反映待ち':c.state)+'：'+c.message,'status');if(c.state==='要確認')p.style.color='#b91c1c';$('scheduleChanges').append(p);}
  if(state.changes.some(c=>c.state==='要確認')){$('scheduleMessage').textContent='要確認の変更があります。Excel側の変更と重複していないか、変更履歴を確認してください。';$('scheduleHistory').open=true;}
  restoreDisabled();
 }
 async function load(key){
  if(isBusy()||!authorized())return;const own=epoch;setBusy(true);$('scheduleMessage').textContent='工程表を読み込んでいます…';
  try{
   const result=await call('getScheduleCatalog');if(own!==epoch)return;catalog=result.weeks;fillWeekSelect();
   if(!catalog.length){state=null;$('scheduleDays').replaceChildren();$('scheduleMessage').textContent='まだExcelと同期されていません。同期PCの工程表同期を起動してください。';return;}
   const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Tokyo'});
   const chosen=catalog.find(w=>w.key===(key||state?.week.key))||catalog.find(w=>w.start<=today&&w.end>=today)||catalog.find(w=>w.start<=today)||catalog[catalog.length-1];
   const updated=await call('getScheduleWeek',{key:chosen.key});if(own!==epoch)return;state=updated;render();
  }catch(e){if(own===epoch){if(state)$('scheduleWeek').value=state.week.key;$('scheduleMessage').textContent=e.message+(state?' 表示は前回の内容です。':'');}}
  finally{if(own===epoch){setBusy(false);restoreDisabled();}}
 }
 function openEditor(day,row){
  if(isBusy()||pending())return;editor={date:day.date,row:row?.row};
  const data=row?.data||{name:'',code:'',time:'昼',address:'',people:'',vehicles:Array(8).fill('')};
  $('scheduleEditorTitle').textContent=reiwaDate(day.date)+'　'+(row?'予定を編集':'予定を追加');
  for(const [id,key] of [['scheduleName','name'],['scheduleCode','code'],['scheduleTime','time'],['scheduleAddress','address'],['schedulePeople','people']])$(id).value=data[key];
  $('scheduleSite').replaceChildren(el('option','予定名を直接入力／変更しない'));$('scheduleSite').firstChild.value='';const none=el('option','工事番号なし（休み・内業など）');none.value='__none__';$('scheduleSite').append(none);
  for(const site of state.sites){const o=el('option',site.name+' ／ '+site.code+' ／ '+site.company);o.value=site.code;$('scheduleSite').append(o);}
  $('scheduleSite').value='';$('scheduleVehicles').replaceChildren();state.week.vehicles.forEach((name,i)=>{const label=el('label',name),input=el('input');input.id='scheduleVehicle'+i;input.type='checkbox';input.checked=Boolean(data.vehicles[i]);input.dataset.original=data.vehicles[i]||'';label.prepend(input);$('scheduleVehicles').append(label);});
  $('schedulePeopleOptions').replaceChildren();for(const person of personOptions()){const b=el('button',person);b.type='button';b.setAttribute('aria-pressed',String(matchesPerson($('schedulePeople').value,person)));b.onclick=()=>{const tokens=$('schedulePeople').value.split(/[・、,]/).map(s=>s.trim()).filter(Boolean);const has=tokens.some(t=>shortName(t)===person);$('schedulePeople').value=(has?tokens.filter(t=>shortName(t)!==person):tokens.concat(person)).join('・');b.setAttribute('aria-pressed',String(!has));};$('schedulePeopleOptions').append(b);}
  $('scheduleName').readOnly=Boolean(row);$('scheduleSiteFields').hidden=Boolean(row);$('scheduleRename').hidden=!row;$('schedulePeople').value=shortPeople(data.people);$('scheduleRemove').hidden=!row;$('scheduleEditor').hidden=false;$('scheduleEditor').scrollIntoView({block:'start',behavior:'smooth'});(row?$('scheduleTime'):$('scheduleName')).focus();
 }
 async function mutate(payload){
  if(isBusy()||!state||pending()||!authorized())return;const own=epoch,key=state.week.key;setBusy(true);let accepted=false;
  try{const result=await call('requestScheduleChange',{...payload,key,revision:state.week.revision});if(own!==epoch)return;accepted=true;$('scheduleEditor').hidden=true;message(result.message);const updated=await call('getScheduleWeek',{key});if(own!==epoch)return;state=updated;render();}
  catch(e){if(own===epoch)message((accepted?'依頼は受け付けましたが、一覧を更新できませんでした。':'')+e.message,true);}
  finally{if(own===epoch){setBusy(false);restoreDisabled();}}
 }
 $('scheduleRename').onclick=()=>{$('scheduleSiteFields').hidden=false;$('scheduleName').readOnly=false;$('scheduleName').focus();};
 $('scheduleSite').onchange=()=>{if($('scheduleSite').value==='__none__'){$('scheduleCode').value='';$('scheduleAddress').value='';return;}const site=state?.sites.find(s=>s.code===$('scheduleSite').value);if(!site)return;$('scheduleName').value=site.name;$('scheduleCode').value=site.code;const known=state.week.days.flatMap(d=>d.rows).find(r=>r.data.code===site.code && r.data.address);$('scheduleAddress').value=known?.data.address||'';};
 $('scheduleEditor').onsubmit=e=>{e.preventDefault();if(!editor)return;const data={name:$('scheduleName').value.trim(),code:$('scheduleCode').value,time:$('scheduleTime').value.trim(),address:$('scheduleAddress').value.trim(),people:$('schedulePeople').value.trim(),vehicles:Array.from({length:8},(_,i)=>($('scheduleVehicle'+i).checked?($('scheduleVehicle'+i).dataset.original||'1'):''))};if(confirm('この予定をExcelへ反映する依頼を送りますか？'))mutate({...editor,kind:editor.row?'edit':'add',data});};
 $('scheduleCancel').onclick=()=>$('scheduleEditor').hidden=true;
 $('scheduleRemove').onclick=()=>{if(editor?.row&&confirm('この予定をExcelから削除する依頼を送りますか？'))mutate({...editor,kind:'remove'});};
 $('schedulePublish').onclick=()=>{if(confirm('この週を社員へ公開し、ExcelのレイアウトでPDFを共有フォルダに保存しますか？'))mutate({kind:'publish'});};
 $('scheduleRefresh').onclick=()=>load();$('scheduleWeek').onchange=()=>load($('scheduleWeek').value);
 $('schedulePrev').onclick=()=>{const i=catalog.findIndex(w=>w.key===state?.week.key);if(i>=0&&i+1<catalog.length)load(catalog[i+1].key);};
 $('scheduleNext').onclick=()=>{const i=catalog.findIndex(w=>w.key===state?.week.key);if(i>0)load(catalog[i-1].key);};
 $('schedulePerson').onchange=()=>{filter=$('schedulePerson').value.trim();if(state)render();};
 $('schedulePrint').onclick=()=>{if(!state)return;document.body.classList.add('printing-schedule');window.print();};window.addEventListener('afterprint',()=>document.body.classList.remove('printing-schedule'));
 return {load,isVisible:()=>!$('schedulePanel').hidden,restoreDisabled,reset(){epoch++;catalog=[];state=null;editor=null;filter='';$('schedulePanel').hidden=true;$('masterPanel').hidden=false;document.querySelectorAll('[data-work-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workView==='master')));$('scheduleDays').replaceChildren();$('scheduleChanges').replaceChildren();$('scheduleWeek').replaceChildren();$('schedulePerson').value='';$('scheduleEditor').hidden=true;$('schedulePublished').textContent='';$('scheduleMessage').textContent='工程表を読み込みます。';}};
}
