// 直连模式：在小程序里直接请求模型。仅用于本地调试。
// 密钥会存在小程序代码包里，发布或分享前必须清空 utils/config.js 的 apiKey，改用云函数。
const { SKILL } = require('./skillText');
const config = require('./config');

const MAX_HISTORY = 12;
const MAX_CHARS = 500;

const APP_RULES = [
  '## 应用补充规则',
  '- 你正在「搭练」微信小程序的聊天窗口里回复，输出纯文本：不使用 Markdown 标题、加粗、表格。',
  '- 表情包标记 [[sticker:id]] 会由小程序渲染成图片，只按第 8 节的规则使用。',
  '- 当前没有保存、提醒、修改计划等功能，用户提出这类请求时如实说明做不到，并给出可行的替代做法。'
].join('\n');

function sanitize(messages) {
  return (messages || [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .map(m => {
      let content = m.text.trim().slice(0, MAX_CHARS);
      if (m.role === 'assistant' && m.stickerId) content += ' [[sticker:' + m.stickerId + ']]';
      return { role: m.role, content };
    })
    .filter(m => m.content)
    .slice(-MAX_HISTORY);
}

function buildSystem(history, knowledge) {
  const parts = [SKILL, APP_RULES];
  if (knowledge) parts.push('## 参考资料\n以下内容来自知识库检索。回答运动与饮食问题时优先依据它；资料没有覆盖时明确说明，不编造来源。\n' + knowledge);
  const recent = history.filter(m => m.role === 'assistant').slice(-2).map(m => m.content);
  if (recent.length) {
    parts.push('## 最近两条搭搭的回复\n本次回复避免重复其中的动作、颜文字和表情包：\n' + recent.map((t, i) => (i + 1) + '. ' + t).join('\n'));
  }
  return parts.join('\n\n');
}

// 返回 { ok, text } 或 { ok:false, error }，与云函数的返回格式一致
function chat(messages, knowledge) {
  const history = sanitize(messages);
  if (!history.length || history[history.length - 1].role !== 'user') {
    return Promise.resolve({ ok: false, error: 'bad_request' });
  }
  const system = buildSystem(history, knowledge);
  return new Promise(resolve => {
    wx.request({
      url: config.baseUrl.replace(/\/$/, '') + '/chat/completions',
      method: 'POST',
      timeout: 30000,
      header: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
      data: {
        model: config.model,
        messages: [
          { role: 'system', content: system }
        ].concat(history),
        temperature: 0.8,
        max_tokens: 2000,
        reasoning_effort: 'low'
      },
      success(res) {
        const text = res.data && res.data.choices && res.data.choices[0] && res.data.choices[0].message && res.data.choices[0].message.content;
        if (res.statusCode >= 200 && res.statusCode < 300 && text) resolve({ ok: true, text: String(text).trim() });
        else resolve({ ok: false, error: 'llm_http_' + res.statusCode });
      },
      fail(err) { resolve({ ok: false, error: (err && err.errMsg) || 'request_fail' }); }
    });
  });
}

module.exports = { chat, buildSystem, sanitize };
