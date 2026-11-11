const {chat}=require('../../utils/chat');
const config=require('../../utils/config');
const { reply, emergency } = require('../../utils/reply');

const GREETING = '嗨，我是搭练 💪 告诉我你今天有多少时间、在家还是健身房，我们一起找到适合你的运动节奏。如果有伤病或运动限制，也请告诉我。';
const SAMPLE = [
  '适用于无伤病及运动禁忌的健康成年人。',
  '',
  '热身 3 分钟：原地踏步、肩部和髋部绕环。',
  '主体约 12 分钟：椅子辅助深蹲、跪姿俯卧撑、臀桥、站姿侧抬腿。每个动作做 30 秒、休息 30 秒，循环 3 轮。',
  '放松 3—5 分钟：慢走和轻柔拉伸。',
  '',
  '任何动作出现疼痛请立即停止。难度可以通过增减次数、放慢节奏、缩短休息来调整。'
].join('\n');
const FAIL = '模型暂时没有回应，请稍后再试。';
const ERRORS = {
  no_key: '请在接口设置填写模型密钥。',
  llm_timeout: '模型响应超时。',
  llm_bad_response: '模型调用失败，请检查服务配置。',
  validation_error: '请求内容不正确。'
};
const MODE_KEY = 'dada_before_mode_v2';
const MODE_LINE = {
  ai: '直连 AI · 未装载 Skill 和知识库',
  local: '本地示例回复 · 尚未连接真实 AI'
};
const GREETING_MSG = { id: 'g0', role: 'assistant', text: GREETING, card: true, greeting: true };

// 本地固定回复里可能带有旧的表情包标记，这个版本没有表情包渲染，直接去掉。
function clean(text) {
  return String(text || '').replace(/\[\[sticker:[^\]]*\]\]/g, '').trim();
}

Page({
  data: {
    messages: [GREETING_MSG],
    input: '',
    loading: false,
    useAI: true,
    modeLine: MODE_LINE.ai,
    endSeq: 0,
    anchor: ''
  },

  onLoad() {
    this.seq = 0;
    let mode = 'ai';
    try { mode = wx.getStorageSync(MODE_KEY) || 'ai'; } catch (e) {}
    const useAI = mode !== 'local';
    this.setData({ useAI, modeLine: MODE_LINE[useAI ? 'ai' : 'local'] });
  },

  openSettings() { if (!this.data.loading) wx.navigateTo({url:'/pages/settings/settings'}); },
  onShow() { const c=config.get(); const signature=JSON.stringify(c); if(this.lastConfig && this.lastConfig!==signature) this.show([GREETING_MSG], {input:''}); this.lastConfig=signature;  },
  onInput(e) { this.setData({ input: e.detail.value }); },
  onSend() { this.send(this.data.input); },

  // 更新消息并滚到底部：end 标记的 id 每次都变，scroll-into-view 才会再次触发。
  show(messages, extra) {
    const endSeq = this.data.endSeq + 1;
    this.setData(Object.assign({ messages, endSeq }, extra || {}), () => {
      this.setData({ anchor: 'end-' + endSeq });
    });
  },

  async send(value) {
    const text = String(value || '').trim();
    if (!text || this.data.loading) return;
    const id = ++this.seq;
    const withUser = this.data.messages.concat([{ id: 'u' + id, role: 'user', text }]).slice(-40);

    // 保留原有的固定回复和高风险关键词拦截：命中时不请求模型。
    const local = emergency(text);
    if (local || !this.data.useAI) {
      const answer = clean(local || reply(text));
      this.show(withUser.concat([{ id: 'a' + id, role: 'assistant', text: answer }]), { input: '' });
      return;
    }

    this.show(withUser, { input: '', loading: true });
    let answer = '';
    let trace = [];
    let failed = false;
    try {
      const history = withUser
        .filter(m => !m.greeting && !m.failed)
        .map(m => ({ role: m.role, text: m.text }));
      const result = await chat(history, config.get());
      if (result && result.ok && result.text) {
        answer = clean(result.text);
        trace = result.trace || [];
      } else {
        failed = true;
        console.error('chat failure:', result && result.error);
        answer = FAIL + '\n' + (ERRORS[result && result.error] || '服务暂时不可用，请检查接口设置。');
      }
    } catch (e) {
      failed = true;
      console.error('chat request failed:', e);
      answer = FAIL + '\n' + (e.message || '请检查接口设置。');
    }
    this.show(this.data.messages.concat([{ id: 'a' + id, role: 'assistant', text: answer, failed, trace: trace.join('；') }]), { loading: false });

  },

  openSample() {
    wx.showModal({ title: '20分钟 · 居家入门', content: SAMPLE, showCancel: false, confirmText: '知道了' });
  },

  toggleMode() {
    if (this.data.loading) return;
    const useAI = !this.data.useAI;
    try { wx.setStorageSync(MODE_KEY, useAI ? 'ai' : 'local'); } catch (e) {}
    this.setData({ useAI, modeLine: MODE_LINE[useAI ? 'ai' : 'local'] });
    this.show([GREETING_MSG], {input:''});
    this.onShow();
    wx.showToast({ title: useAI ? '已切换到直连 AI' : '已切换到本地示例回复', icon: 'none' });
  },

  clear() {
    if (this.data.loading) return;
    wx.showModal({
      title: '清空本次对话',
      content: '只清空当前聊天记录。',
      confirmText: '清空',
      success: res => { if (res.confirm) this.show([GREETING_MSG], { input: '' }); }
    });
  }
});
