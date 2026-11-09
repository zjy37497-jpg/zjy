const labels = {
  profile_not_configured: '档案服务尚未配置，请先部署云函数并开启档案功能。',
  unauthenticated: '未取得微信身份，请从本小程序重新进入。',
  confirmation_expired: '确认已过期，请重新发起操作。',
  version_conflict: '档案已发生变化，请刷新后重新操作。',
  memory_disabled: '请先在个人档案页开启记忆。',
  profile_full: '档案已满，请先删除不再需要的资料。',
  no_key: '云函数尚未配置模型密钥。',
  llm_bad_response: '模型调用失败，请检查服务配置和工具调用支持。',
  temporarily_unavailable: '服务暂时不可用，请检查云函数和数据库配置。'
};
function explain(error) {
  const code = error && (error.code || error.message);
  return labels[code] || '操作未确认成功，请刷新查看实际状态后再试。';
}
async function call(data) {
  if (!wx.cloud) throw new Error('profile_not_configured');
  const response = await wx.cloud.callFunction({ name: 'chat', data, config: { timeout: 70000 } });
  const result = response && response.result;
  if (!result || !result.ok) {
    const error = new Error(result && result.error || 'temporarily_unavailable');
    error.code = result && result.error;
    throw error;
  }
  return result;
}
function modal(options) {
  return new Promise((resolve, reject) => wx.showModal(Object.assign({}, options, { success: resolve, fail: reject })));
}
async function confirmProposal(proposal) {
  const decision = await modal({ title: '确认档案变更', content: proposal.summary, confirmText: '确认', cancelText: '不保存' });
  if (!decision.confirm) return { ok: true, cancelled: true };
  try { return await call({ action: 'profile_confirm', token: proposal.token }); }
  catch (error) {
    if (error.code) throw error;
    const retry = await modal({ title: '结果暂未确认', content: '网络中断，操作可能已完成。是否使用同一个确认请求重试？不会重复新增资料。', confirmText: '重试', cancelText: '稍后查看' });
    if (!retry.confirm) throw error;
    return call({ action: 'profile_confirm', token: proposal.token });
  }
}
module.exports = { call, modal, confirmProposal, explain };
