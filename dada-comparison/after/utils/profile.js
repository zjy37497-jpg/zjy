const CATEGORIES = ['basic', 'goals', 'preferences', 'schedule', 'equipment', 'health_constraints', 'communication'];
const STATUSES = ['active', 'needs_confirmation', 'resolved_by_user'];

function fail(code) { throw new Error(code); }
function emptyProfile() { return { version: 0, enabled: false, records: [], lastOperation: '' }; }
function validateMutation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('validation_error');
  const operation = input.operation;
  const allowed = operation === 'upsert' ? ['operation', 'record_id', 'category', 'statement', 'status', 'evidence'] : operation === 'delete' ? ['operation', 'record_id'] : ['operation'];
  if (Object.keys(input).some(key => !allowed.includes(key))) fail('validation_error');
  if (!['upsert', 'delete', 'clear', 'enable_memory', 'disable_memory'].includes(operation)) fail('validation_error');
  if (operation === 'upsert') {
    if (!CATEGORIES.includes(input.category) || !STATUSES.includes(input.status)) fail('validation_error');
    if (typeof input.statement !== 'string' || !input.statement.trim() || input.statement.length > 400) fail('validation_error');
    if (typeof input.evidence !== 'string' || !input.evidence.trim() || input.evidence.length > 400) fail('validation_error');
  }
  if ((operation === 'delete' || (operation === 'upsert' && input.record_id !== null)) && !/^[a-f0-9]{32}$/.test(input.record_id || '')) fail('validation_error');
  return JSON.parse(JSON.stringify(input));
}
function describe(change) {
  if (change.operation === 'upsert') return '保存到本机个人档案，供今后运动、饮食建议参考：\n' + change.statement + '\n状态：' + ({ active: '用户自述', needs_confirmation: '仍需核实', resolved_by_user: '用户自述已恢复' }[change.status]) + '\n这可能包含健康资料，确认后才保存。可在个人档案更正、删除或关闭记忆。';
  if (change.operation === 'delete') return '删除这条本机资料：\n' + change.statement;
  if (change.operation === 'clear') return '清空本机档案并关闭记忆，不删除当前聊天或本地计划。本机档案将删除。';
  if (change.operation === 'enable_memory') return '开启本机档案，允许助手读取你已确认保存的资料来个性化建议。普通资料自动保存，健康资料需要确认。相关档案会发送给你配置的模型用于回答。';
  return '关闭档案读取与新增、更正。已有资料不自动删除，仍可查看、删除；删除全部请使用“清空并关闭”。';
}

const KEY = 'dada_after_profile_v2';
const pending = new Map();
function read() { return wx.getStorageSync(KEY) || emptyProfile(); }
function get(management) {
 const p = read(); return {ok:true, enabled:p.enabled, version:p.version, records:management || p.enabled ? p.records : []};
}
function propose(input, latest, management) {
 const change = validateMutation(input), p = read();
 if (!management && !['upsert','delete'].includes(change.operation)) fail('use_profile_page');
 if (change.operation === 'upsert') {
  if (!p.enabled) fail('memory_disabled');
  if (!latest || !latest.includes(change.evidence)) fail('evidence_required');
  if (change.record_id && !p.records.some(r=>r.id===change.record_id)) fail('not_found');
  if (p.records.some(r=>r.category===change.category && r.statement===change.statement.trim() && r.status===change.status)) return {ok:true,status:'unchanged'};
  if (!change.record_id && p.records.length>=50) fail('profile_full');
 }
 if(change.operation==='delete') {
  const record=p.records.find(r=>r.id===change.record_id); if(!record) fail('not_found'); change.statement=record.statement;
 }
 const token=Array.from({length:32},()=>Math.floor(Math.random()*16).toString(16)).join('');
 pending.set(token,{change,version:p.version,expires:Date.now()+600000});
 return {ok:true,status:'confirmation_required',token,summary:describe(change)};
}
function confirm(token) {
 const item=pending.get(token), p=read();
 if(!item || item.expires<Date.now()) fail('confirmation_expired');
 if(item.applied) return {ok:true,status:'already_applied'};
 if(item.version!==p.version) fail('version_conflict');
 const c=item.change;
 if(c.operation==='upsert') {
  if(!p.enabled) fail('memory_disabled');
  const record={id:c.record_id||token,category:c.category,statement:c.statement.trim(),status:c.status,updatedAt:new Date().toISOString()};
  if(c.record_id) p.records=p.records.map(r=>r.id===c.record_id?record:r); else p.records.push(record);
 } else if(c.operation==='delete') p.records=p.records.filter(r=>r.id!==c.record_id);
 else if(c.operation==='clear'){p.records=[];p.enabled=false;}
 else p.enabled=c.operation==='enable_memory';
 p.version++; wx.setStorageSync(KEY,p); item.applied=true;
 return {ok:true,status:'applied',version:p.version};
}
async function call(data) {
 if(data.action==='profile_get') return get(true);
 if(data.action==='profile_prepare') return propose(data.change,data.change.statement||'',true);
 if(data.action==='profile_confirm') return confirm(data.token);
 fail('validation_error');
}
function modal(options){return new Promise((resolve,reject)=>wx.showModal(Object.assign({},options,{success:resolve,fail:reject})));}
async function confirmProposal(proposal){const d=await modal({title:'确认档案变更',content:proposal.summary,confirmText:'确认',cancelText:'取消'});return d.confirm?confirm(proposal.token):{ok:true,cancelled:true};}
function explain(e){return ({memory_disabled:'请先在个人档案开启记忆。',version_conflict:'档案已变化，请刷新后重试。',confirmation_expired:'确认已过期，请重试。',evidence_required:'没有当前消息的原文依据，未保存。',profile_full:'档案已满，请先删除旧资料。'})[e.message]||'操作失败，请检查后重试。';}
module.exports={CATEGORIES,get,propose,confirm,call,modal,confirmProposal,explain};
