const aliases = Object.freeze({'西原伸一':'西原','永井智久':'永井','山田悠渡':'悠渡','岡田俊治':'岡田','添田敦哉':'添田','亀岡和広':'亀岡','山田滉王':'滉王','山田大知':'大知','菊永秀樹':'社長','菊永雅':'雅','菊永亮':'亮'});
export const shortName = value => aliases[String(value).replace(/[\s　]/g,'')] || value;
export const shortPeople = text => Object.entries(aliases).reduce((out,[full,short])=>out.split(full).join(short),String(text||''));
export function reiwaDate(value, time=false) {
 if(!value)return ''; const date=new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)?value+'T00:00:00+09:00':value);
 if(Number.isNaN(+date))return value;
 const parts=Object.fromEntries(new Intl.DateTimeFormat('ja-JP-u-ca-japanese',{timeZone:'Asia/Tokyo',era:'long',year:'numeric',month:'numeric',day:'numeric',...(time?{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}:{})}).formatToParts(date).map(p=>[p.type,p.value]));
 return `${parts.era}${parts.year}年${parts.month}月${parts.day}日`+(time?`　${parts.hour}：${parts.minute}`:'');
}
export const weekLabel = week => reiwaDate(week.start)+'～'+reiwaDate(week.end);
export function personChoices(week, extra=[]) {
 return [...new Set([...Object.values(aliases),...extra.map(shortName),...week.days.flatMap(d=>d.rows.flatMap(r=>shortPeople(r.data.people).split(/[・、,\n]/).map(v=>v.trim()).filter(Boolean)))])];
}
export const matchesPerson = (text, person) => !person || shortPeople(text).split(/[・、,\n]/).some(v=>v.trim()===person || v.trim().startsWith(person+'（') || v.trim().startsWith(person+'('));
