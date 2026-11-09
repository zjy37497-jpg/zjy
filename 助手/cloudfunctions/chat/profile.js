const crypto = require('crypto');
const CATEGORIES = ['goals', 'preferences', 'schedule', 'equipment', 'health_constraints', 'communication'];
const STATUSES = ['active', 'needs_confirmation', 'resolved_by_user'];
const COLLECTION = 'dada_profiles';
function fail(code) { throw new Error(code); }
function ownerId(openid, appid) {
  if (!openid || !appid) fail('unauthenticated');
  return crypto.createHash('sha256').update(appid + ':' + openid).digest('hex');
}
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
  if (change.operation === 'upsert') return '保存到云端个人档案，供今后运动、饮食建议参考：\n' + change.statement + '\n状态：' + ({ active: '用户自述', needs_confirmation: '仍需核实', resolved_by_user: '用户自述已恢复' }[change.status]) + '\n这可能包含健康资料，确认后才保存。可在个人档案更正、删除或关闭记忆。';
  if (change.operation === 'delete') return '删除这条云端资料：\n' + change.statement;
  if (change.operation === 'clear') return '清空云端档案并关闭记忆，不删除当前聊天或本地计划。在线档案将删除，备份按云服务保留策略清理。';
  if (change.operation === 'enable_memory') return '开启云端档案，允许助手读取你已确认保存的资料来个性化建议。每次新增或更正仍需确认，健康资料不会自动保存。';
  return '关闭档案读取与新增、更正。已有资料不自动删除，仍可查看、删除；删除全部请使用“清空并关闭”。';
}
function sign(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return encoded + '.' + crypto.createHmac('sha256', secret).update(encoded).digest('hex');
}
function verify(token, secret, owner, now) {
  if (typeof token !== 'string' || token.length > 12000) fail('invalid_confirmation');
  const parts = token.split('.');
  if (parts.length !== 2 || !/^[a-f0-9]{64}$/.test(parts[1])) fail('invalid_confirmation');
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(parts[1], 'hex'))) fail('invalid_confirmation');
  let payload;
  try { payload = JSON.parse(Buffer.from(parts[0], 'base64').toString('utf8')); } catch (error) { fail('invalid_confirmation'); }
  if (payload.owner !== owner) fail('forbidden');
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < now) fail('confirmation_expired');
  return payload;
}
async function readDocument(database, owner) {
  try {
    const result = await database.collection(COLLECTION).doc(owner).get();
    const document = Array.isArray(result.data) ? result.data[0] : result.data;
    return document || emptyProfile();
  } catch (error) {
    const message = String(error.errMsg || error.message || '');
    if (/document.*(?:does not exist|not found|not exist)/i.test(message) && !/collection.*(?:not exist|not found)/i.test(message)) return emptyProfile();
    throw error;
  }
}
function createProfileService(database, owner, secret) {
  if (!secret || secret.length < 32) fail('profile_not_configured');
  return {
    async get(management) {
      const profile = await readDocument(database, owner);
      return { ok: true, status: profile.version ? 'found' : 'not_found', version: profile.version, enabled: profile.enabled, records: management || profile.enabled ? profile.records : [] };
    },
    async propose(input, latestUserText, management) {
      const change = validateMutation(input);
      if (!management && !['upsert', 'delete'].includes(change.operation)) fail('use_profile_page');
      const profile = await readDocument(database, owner);
      if (change.operation === 'upsert') {
        if (!profile.enabled) fail('memory_disabled');
        if (!latestUserText || !latestUserText.includes(change.evidence)) fail('evidence_required');
        if (change.record_id && !profile.records.some(record => record.id === change.record_id)) fail('not_found');
        if (profile.records.some(record => record.category === change.category && record.statement === change.statement.trim() && record.status === change.status)) return { ok: true, status: 'unchanged' };
        if (!change.record_id && profile.records.length >= 50) fail('profile_full');
      }
      if (change.operation === 'delete') {
        const record = profile.records.find(item => item.id === change.record_id);
        if (!record) fail('not_found');
        change.statement = record.statement;
      }
      const payload = { owner, version: profile.version, change, nonce: crypto.randomBytes(16).toString('hex'), expiresAt: Date.now() + 600000 };
      return { ok: true, status: 'confirmation_required', token: sign(payload, secret), summary: describe(change) };
    },
    async confirm(token) {
      const payload = verify(token, secret, owner, Date.now());
      return database.runTransaction(async transaction => {
        const profile = await readDocument(transaction, owner);
        if (profile.lastOperation === payload.nonce) return { ok: true, status: 'already_applied', version: profile.version };
        if (profile.version !== payload.version) fail('version_conflict');
        const change = payload.change;
        let records = profile.records.slice();
        let enabled = profile.enabled;
        if (change.operation === 'upsert') {
          if (!enabled) fail('memory_disabled');
          const record = { id: change.record_id || payload.nonce, category: change.category, statement: change.statement.trim(), status: change.status, source: 'user_report', updatedAt: new Date().toISOString(), consentAt: new Date().toISOString(), consentVersion: 'per-record-v1' };
          if (change.record_id) {
            if (!records.some(item => item.id === change.record_id)) fail('not_found');
            records = records.map(item => item.id === change.record_id ? record : item);
          } else {
            if (records.length >= 50) fail('profile_full');
            records.push(record);
          }
        } else if (change.operation === 'delete') records = records.filter(item => item.id !== change.record_id);
        else if (change.operation === 'clear') { records = []; enabled = false; }
        else if (change.operation === 'enable_memory') enabled = true;
        else if (change.operation === 'disable_memory') enabled = false;
        else fail('validation_error');
        const next = { version: profile.version + 1, enabled, records, lastOperation: payload.nonce };
        await transaction.collection(COLLECTION).doc(owner).set({ data: next });
        return { ok: true, status: 'applied', version: next.version };
      });
    }
  };
}
module.exports = { createProfileService, ownerId, validateMutation, verify, sign, emptyProfile, CATEGORIES };
