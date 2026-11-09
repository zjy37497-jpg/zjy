const { CATEGORIES } = require('./profile');
const tool = (name, description, properties, required) => ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required, additionalProperties: false } } });
const profileTools = [
  tool('get_user_profile', '只读已授权的当前用户档案，不创建或修改任何数据；停用时不返回记录。普通闲聊不调用。', {}, []),
  tool('update_user_profile', '仅提出一条需要用户在小程序弹窗确认的档案变更，不直接写入。只记录当前用户本人的稳定事实或健康限制；不记录闲聊、他人或假设。开启记忆、清空、停用请引导个人档案页面。', {
    operation: { type: 'string', enum: ['upsert', 'delete'] },
    record_id: { type: ['string', 'null'], description: '新记录用 null；更正或删除用读取到的 id' },
    category: { type: 'string', enum: CATEGORIES },
    statement: { type: 'string', description: '最小必要的本人自述事实，最多400字，不推断疾病' },
    status: { type: 'string', enum: ['active', 'needs_confirmation', 'resolved_by_user'] },
    evidence: { type: 'string', description: '当前最后一条用户消息中的原文依据，最多400字；不是模型推断' }
  }, ['operation', 'record_id'])
];
const knowledgeTool = tool('search_knowledge', '只读服务端知识库，用不含姓名和用户标识的通用主题检索，最多每轮两次。', { query: { type: 'string', maxLength: 500 } }, ['query']);
module.exports = { profileTools, knowledgeTool };
