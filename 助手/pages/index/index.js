const { reply, emergency, fixedReply } = require('../../utils/reply');
const { parse } = require('../../utils/sticker');
const config = require('../../utils/config');
const llm = require('../../utils/llm');
const ui = require('../../utils/ui');
const cloudConfig = require('../../utils/cloudConfig');
const profileApi = require('../../utils/profile');

const FAIL_TEXT = '这会儿没连上搭子，请稍后再试一次。';
const SHOW_REASON = false;

const RECORD_TYPES = {
  diet: {
    title: '饮食记录',
    icon: '/images/figma/icon-diet.png',
    photoHint: '添加食物和饮食照片',
    placeholder: '例：我今天中午吃了一个汉堡',
    prefix: '饮食记录：'
  },
  exercise: {
    title: '运动记录',
    icon: '/images/figma/icon-exercise.png',
    photoHint: '添加器械屏幕图片或运动记录截屏',
    placeholder: '例：我今天跑了20分钟，3公里',
    prefix: '运动记录：'
  },
  weight: {
    title: '体重记录',
    icon: '/images/figma/icon-weight.png',
    photoHint: '添加体重测量结果图片，比如体脂秤照片',
    placeholder: '例：我今天的体重是60kg',
    prefix: '体重记录：'
  }
};

function makeVoiceDots() {
  return Array.from({ length: 23 }, (_, index) => ({
    id: index,
    active: index >= 8 && index <= 14,
    peak: index === 11
  }));
}

function explain(code) {
  const c = String(code || '');
  if (/domain list|合法域名/i.test(c)) return '域名未校验：开发者工具 → 详情 → 本地设置 → 勾选“不校验合法域名”';
  if (c === 'no_key') return '云函数还没配置环境变量 LLM_API_KEY';
  if (/llm_http_40[13]/.test(c)) return '模型密钥无效或没有权限（' + c + '）';
  if (/llm_http_429/.test(c)) return '请求过于频繁或额度用完（' + c + '）';
  if (/llm_timeout|timeout|TIME_LIMIT/i.test(c)) return '响应超时，请把云函数超时时间改成 30 秒';
  if (/-501000|FunctionName|not found|not exist/i.test(c)) return '没找到云函数 chat，请先上传并部署';
  if (/cloud init|wx\.cloud|undefined/i.test(c)) return '云开发未初始化或当前 AppID 没有云开发权限';
  return c || '未知错误';
}

Page({
  data: Object.assign({}, ui.getNavMetrics(), {
    ripple: { id: '', x: 0, y: 0 },
    heroEntrance: false,
    input: '',
    chatKeyboardHeight: 0,
    messages: [],
    anchor: '',
    loading: false,
    thinkingSeconds: 0,
    useAI: true,
    questions: [
      '今天吃了什么？热量超标了吗？',
      '今天运动了多久？消耗了多少卡？',
      '帮我制定一个减脂饮食计划'
    ],
    recordSheet: false,
    activeRecord: RECORD_TYPES.diet,
    recordInput: '',
    recordImage: '',
    recordFocus: false,
    recordKeyboardHeight: 0,
    photoMenu: false,
    voiceOpen: false,
    voiceRecording: false,
    voiceCancelArmed: false,
    voiceDots: makeVoiceDots()
  }),


  startTouchRipple(e) {
    const id = e.currentTarget.dataset.rippleid;
    const touch = e.touches && e.touches[0];
    if (!id || !touch) return;
    wx.createSelectorQuery().in(this).select('#ripple-' + id).boundingClientRect(rect => {
      if (!rect) return;
      // Client coordinates are relative to the viewport, just like the element rect.
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      this.setData({ ripple: { id: '', x, y } }, () => {
        this.setData({ ripple: { id, x, y } });
      });
      clearTimeout(this._rippleTimer);
      this._rippleTimer = setTimeout(() => {
        if (this.data.ripple.id === id) this.setData({ ripple: { id: '', x: 0, y: 0 } });
      }, 480);
    }).exec();
  },

  onLoad(options) {
    this.seq = 0;
    const saved = wx.getStorageSync('dalian_mode');
    this.setData({ useAI: saved !== 'local' });
    this.setupRecorder();
    if (options && options.action && RECORD_TYPES[options.action]) {
      setTimeout(() => this.openRecord(options.action), 260);
    }
    const pending = wx.getStorageSync('dalian_pending_message');
    if (pending) {
      try {
        wx.removeStorageSync('dalian_pending_message');
      } catch (e) {}
      setTimeout(() => this.send(pending), 320);
    }
  },

  // Replay on entering home, without image-src frame switching (which flickers on phones).
  onShow() {
    // Restart only the character-by-character slogan, not the mascot's eyes.
    if (this._heroEntranceTimer) clearTimeout(this._heroEntranceTimer);
    this.setData({ heroEntrance: false }, () => {
      this._heroEntranceTimer = setTimeout(() => {
        this.setData({ heroEntrance: true });
      }, 40);
    });
  },

  onHide() {
    if (this._chatKeyboardBlurTimer) clearTimeout(this._chatKeyboardBlurTimer);
    if (this.data.chatKeyboardHeight) this.setData({ chatKeyboardHeight: 0 });
    if (this._heroEntranceTimer) clearTimeout(this._heroEntranceTimer);
    if (this._voiceHeld) this.finishVoiceHold(true);
  },

  onUnload() {
    if (this._chatKeyboardBlurTimer) clearTimeout(this._chatKeyboardBlurTimer);
    if (this._heroEntranceTimer) clearTimeout(this._heroEntranceTimer);
    if (this._voiceHeld) this.finishVoiceHold(true);
    this.stopThinkingTimer();
    this.finishTyping();
    if (this._rippleTimer) clearTimeout(this._rippleTimer);
  },

  startThinkingTimer() {
    this.stopThinkingTimer();
    const startedAt = Date.now();
    this.setData({ thinkingSeconds: 0 });
    this.thinkingTimer = setInterval(() => {
      this.setData({
        thinkingSeconds: Math.floor((Date.now() - startedAt) / 1000)
      });
    }, 500);
  },

  stopThinkingTimer() {
    if (this.thinkingTimer) {
      clearInterval(this.thinkingTimer);
      this.thinkingTimer = null;
    }
  },

  setupRecorder() {
    if (!wx.getRecorderManager) return;
    this.recorder = wx.getRecorderManager();
    this.recorder.onStop(() => {
      this._recordingStarted = false;
      this.setData({ voiceOpen: false, voiceRecording: false, voiceCancelArmed: false });
    });
    this.recorder.onError(() => {
      this._recordingStarted = false;
      this._voiceHeld = false;
      this.setData({ voiceOpen: false, voiceRecording: false, voiceCancelArmed: false });
      wx.showToast({ title: '录音没有成功，请再试一次', icon: 'none' });
    });
  },

  handleBack() {
    ui.goBack('/pages/index/index');
  },

  // Keep the composer immediately above the native keyboard. Native input
  // adjust-position is disabled so WeChat does not move the page twice.
  onChatKeyboardHeightChange(e) {
    const height = Math.max(0, Number(e.detail && e.detail.height) || 0);
    if (this.data.chatKeyboardHeight !== height) {
      this.setData({ chatKeyboardHeight: height });
    }
  },

  onChatInputBlur() {
    // Keyboard-height-change supplies the actual value while the keyboard
    // animates; a blur fallback prevents a dock left floating after dismissal.
    if (this._chatKeyboardBlurTimer) clearTimeout(this._chatKeyboardBlurTimer);
    this._chatKeyboardBlurTimer = setTimeout(() => {
      if (this.data.chatKeyboardHeight) this.setData({ chatKeyboardHeight: 0 });
    }, 180);
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  ask(e) {
    this.send(e.currentTarget.dataset.question);
  },

  onSend() {
    this.send(this.data.input);
  },

  makeAssistant(id, raw, source) {
    const msgs = this.data.messages || [];
    const recentIds = msgs.filter(m => m.role === 'assistant').slice(-2).reverse().map(m => m.stickerId || '');
    const userTexts = msgs.filter(m => m.role === 'user').map(m => m.text || '');
    const r = parse(raw, { recentIds, userTexts });
    return {
      id: 'a' + id,
      role: 'assistant',
      text: r.text,
      displayText: '',
      revealStable: '',
      revealFocus: '',
      revealHaze: '',
      isTyping: true,
      sticker: r.sticker,
      stickerId: r.id,
      source: source || 'cloud'
    };
  },

  // Text emerges in three optical layers like the supplied reference:
  // settled text, a subtly enlarged sharp leading edge, and a hazy preview.
  // The complete reply stays in .text for copying and future history.
  finishTyping() {
    if (this._typeTimer) {
      clearTimeout(this._typeTimer);
      this._typeTimer = null;
    }
    const index = this._typingIndex;
    const items = this.data.messages;
    if (typeof index === 'number' && items[index] && items[index].isTyping) {
      const key = 'messages[' + index + ']';
      this.setData({
        [key + '.displayText']: items[index].text,
        [key + '.revealStable']: items[index].text,
        [key + '.revealFocus']: '',
        [key + '.revealHaze']: '',
        [key + '.isTyping']: false
      });
    }
    this._typingIndex = null;
  },

  animateAssistant(assistant, loading) {
    this.finishTyping();
    const items = this.data.messages.concat([assistant]).slice(-40);
    const index = items.length - 1;
    this._typingIndex = index;
    this.setData({ messages: items, loading: !!loading, anchor: assistant.id }, () => {
      const chars = Array.from(assistant.text || '');
      if (!chars.length) { this.finishTyping(); return; }
      // Approximate the reference's quick-but-soft reveal, with micro-pauses
      // after punctuation. Bound long answers to avoid very slow UI updates.
      const chunk = Math.max(1, Math.ceil(chars.length / 95));
      const baseBeat = chars.length > 190 ? 38 : 55;
      let n = 0;
      let beat = 0;
      const tick = () => {
        if (!this.data.messages[index] || this.data.messages[index].id !== assistant.id) {
          this._typeTimer = null;
          return;
        }
        n = Math.min(chars.length, n + chunk);
        const key = 'messages[' + index + ']';
        const focusStart = Math.max(0, n - 2);
        // The upcoming 1-2 glyphs are visible but misty; unlike a cursor-only
        // effect this creates the depth-of-field rhythm in the reference.
        const previewEnd = Math.min(chars.length, n + 2);
        this.setData({
          [key + '.displayText']: chars.slice(0, n).join(''),
          [key + '.revealStable']: chars.slice(0, focusStart).join(''),
          [key + '.revealFocus']: chars.slice(focusStart, n).join(''),
          [key + '.revealHaze']: chars.slice(n, previewEnd).join(''),
          anchor: assistant.id
        });
        if (n >= chars.length) {
          // Brief hold: the leading letters settle before the full clean reply.
          this._typeTimer = setTimeout(() => this.finishTyping(), 145);
          return;
        }
        const prev = chars[n - 1] || '';
        const punctuationPause = /[。！？!?\n]/.test(prev) ? 155 : /[，,；;：:]/.test(prev) ? 70 : 0;
        const cadence = [0, 7, -5, 13, -8, 4][beat++ % 6];
        this._typeTimer = setTimeout(tick, baseBeat + cadence + punctuationPause);
      };
      this._typeTimer = setTimeout(tick, 90);
    });
  },

  async send(value, image) {
    const text = String(value || '').trim();
    if (!text || this.data.loading) return;
    this.finishTyping();
    const id = ++this.seq;
    const userMsg = { id: 'u' + id, role: 'user', text, image: image || '' };
    let messages = this.data.messages.concat([userMsg]).slice(-40);

    const specialReply = fixedReply(text);
    if (specialReply) {
      this.setData({ messages, input: '' }, () => {
        this.animateAssistant(this.makeAssistant(id, specialReply, 'fixed'), false);
      });
      return;
    }

    const urgent = emergency(text);
    if (!this.data.useAI || urgent) {
      this.setData({ messages, input: '' }, () => {
        this.animateAssistant(this.makeAssistant(id, urgent || reply(text), 'local'), false);
      });
      return;
    }

    this.setData({ messages, input: '', loading: true, anchor: 'loading' });
    this.startThinkingTimer();
    let answer = FAIL_TEXT;
    let failed = false;
    let proposal = null;
    try {
      const history = messages.map(m => ({
        role: m.role,
        text: m.text,
        stickerId: m.stickerId || ''
      }));
      let result;
      if (cloudConfig.directDebug && config.apiKey) {
        result = await llm.chat(history);
      } else {
        const res = await wx.cloud.callFunction({ name: 'chat', data: { messages: history }, config: { timeout: 70000 } });
        result = res && res.result;
      }
      if (result && result.ok && result.text) {
        answer = result.text;
        proposal = result.proposal || null;
      } else {
        failed = true;
        console.error('chat failure:', result && result.error);
        answer += '\n' + profileApi.explain(new Error(result && result.error || 'temporarily_unavailable'));
      }
    } catch (e) {
      failed = true;
      console.error('callFunction error:', e);
      answer += SHOW_REASON
        ? '\n（原因：' + explain((e && (e.errMsg || e.message)) || e) + '）'
        : '';
    }

    const assistant = failed
      ? this.makeAssistant(
        id,
        answer,
        'local'
      )
      : this.makeAssistant(id, answer, 'cloud');
    this.stopThinkingTimer();
    this.animateAssistant(assistant, Boolean(proposal));
    if (proposal) {
      let status;
      try {
        const result = await profileApi.confirmProposal(proposal);
        status = result.cancelled ? '没有保存这次档案变更。' : '档案已更新。可在右上角更多→个人档案查看、更正或删除。';
      } catch (error) {
        status = '档案变更未确认成功。' + profileApi.explain(error);
      }
      const confirmationId = ++this.seq;
      this.animateAssistant(this.makeAssistant(confirmationId, status, 'cloud'), false);
    }
  },

  openQuick(e) {
    const action = e.currentTarget.dataset.action;
    if (action === 'plan') {
      wx.navigateTo({ url: '/pages/plan/plan' });
      return;
    }
    this.openRecord(action);
  },

  openAttach() {
    wx.showActionSheet({
      itemList: ['饮食记录', '运动记录', '体重记录', '添加照片'],
      success: res => {
        const keys = ['diet', 'exercise', 'weight'];
        if (res.tapIndex === 3) {
          this.openRecord('diet');
          setTimeout(() => this.showPhotoMenu(), 240);
          return;
        }
        this.openRecord(keys[res.tapIndex] || 'diet');
      }
    });
  },

  openMore() {
    if (this.data.loading) return;
    const modeText = this.data.useAI ? '切换到本地回复' : '切换到云端AI回复';
    wx.showActionSheet({
      itemList: ['查看训练计划', modeText, '清空本次对话', '个人档案与长期记忆'],
      success: res => {
        if (res.tapIndex === 0) {
          wx.navigateTo({ url: '/pages/plan/plan' });
        } else if (res.tapIndex === 1) {
          this.toggleMode();
        } else if (res.tapIndex === 2) {
          this.clear();
        } else if (res.tapIndex === 3) {
          wx.navigateTo({ url: '/pages/profile/profile?manage=1' });
        }
      }
    });
  },

  toggleMode() {
    if (this.data.loading) return;
    const useAI = !this.data.useAI;
    try {
      wx.setStorageSync('dalian_mode', useAI ? 'ai' : 'local');
    } catch (e) {}
    this.setData({ useAI });
    wx.showToast({ title: useAI ? '已切换到云端AI' : '已切换到本地回复', icon: 'none' });
  },

  openRecord(type) {
    this.setData({
      recordSheet: true,
      activeRecord: RECORD_TYPES[type] || RECORD_TYPES.diet,
      recordInput: '',
      recordImage: '',
      photoMenu: false,
      recordFocus: false,
      recordKeyboardHeight: 0
    }, () => {
      setTimeout(() => this.setData({ recordFocus: true }), 120);
    });
  },

  closeRecord() {
    this.setData({ recordSheet: false, recordFocus: false, photoMenu: false, recordKeyboardHeight: 0 });
  },

  onRecordKeyboardHeightChange(event) {
    if (!this.data.recordSheet) return;
    const height = Math.max(0, Number(event.detail && event.detail.height) || 0);
    if (height !== this.data.recordKeyboardHeight) this.setData({ recordKeyboardHeight: height });
  },

  noop() {},

  onRecordInput(e) {
    this.setData({ recordInput: e.detail.value, photoMenu: false });
  },

  hidePhotoMenu() {
    if (this.data.photoMenu) this.setData({ photoMenu: false });
  },

  showPhotoMenu() {
    if (!this.data.recordSheet || this.data.photoMenu) return;
    // Keep the focused input and on-screen keyboard stable while menu floats above.
    this.setData({ photoMenu: true });
  },

  chooseFromAlbum() {
    this.setData({ photoMenu: false });
    this.chooseImage('album');
  },

  takePhoto() {
    this.setData({ photoMenu: false });
    this.chooseImage('camera');
  },

  chooseImage(sourceType) {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [sourceType],
      success: res => {
        const file = res.tempFiles && res.tempFiles[0];
        if (file && file.tempFilePath) {
          this.setData({ recordImage: file.tempFilePath, recordFocus: true });
        }
      }
    });
  },

  sendRecord() {
    const detail = String(this.data.recordInput || '').trim();
    if (!detail) {
      wx.showToast({ title: '先写一句记录吧', icon: 'none' });
      return;
    }
    const text = this.data.activeRecord.prefix + detail;
    const image = this.data.recordImage;
    this.setData({ recordSheet: false, recordFocus: false, photoMenu: false });
    this.send(text, image);
  },

  // Recording is a press-and-hold gesture: never open the semicircle on a tap.
  onVoiceHoldStart(e) {
    if (this._voiceHeld || this.data.voiceRecording) return;
    this._voiceHeld = true;
    this._voiceGestureId = (this._voiceGestureId || 0) + 1;
    const touch = e.touches && e.touches[0];
    this._voiceStartY = touch ? touch.clientY : 0;
    this.setData({ voiceOpen: true, voiceCancelArmed: false, voiceRecording: false });
    const gestureId = this._voiceGestureId;
    const start = () => {
      // Permission requests can finish after the user has released the button.
      if (!this._voiceHeld || gestureId !== this._voiceGestureId) return;
      if (!this.recorder) {
        this._voiceHeld = false;
        this.setData({ voiceOpen: false });
        wx.showToast({ title: '当前设备不支持录音', icon: 'none' });
        return;
      }
      try {
        this.recorder.start({ duration: 60000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1 });
        this._recordingStarted = true;
        this.setData({ voiceRecording: true });
      } catch (err) {
        this._voiceHeld = false;
        this._recordingStarted = false;
        this.setData({ voiceOpen: false, voiceRecording: false });
        wx.showToast({ title: '无法启动麦克风', icon: 'none' });
      }
    };
    if (wx.authorize) {
      wx.authorize({
        scope: 'scope.record',
        success: start,
        fail: () => {
          if (gestureId !== this._voiceGestureId) return;
          this._voiceHeld = false;
          this.setData({ voiceOpen: false, voiceRecording: false });
          wx.showToast({ title: '需要麦克风权限才能录音', icon: 'none' });
        }
      });
    } else start();
  },

  onVoiceHoldMove(e) {
    if (!this._voiceHeld) return;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) return;
    const cancel = this._voiceStartY - touch.clientY > 80;
    if (cancel !== this.data.voiceCancelArmed) this.setData({ voiceCancelArmed: cancel });
  },

  onVoiceHoldEnd(e) {
    if (!this._voiceHeld) return;
    const touch = e.changedTouches && e.changedTouches[0];
    const cancel = this.data.voiceCancelArmed || Boolean(touch && this._voiceStartY - touch.clientY > 80);
    this.finishVoiceHold(cancel);
  },

  onVoiceHoldCancel() {
    this.finishVoiceHold(true);
  },

  finishVoiceHold(cancel) {
    if (!this._voiceHeld && !this._recordingStarted) return;
    this._voiceHeld = false;
    this._voiceGestureId = (this._voiceGestureId || 0) + 1;
    if (this._recordingStarted && this.recorder) {
      this._recordingStarted = false;
      this.recorder.stop();
    }
    this.setData({ voiceOpen: false, voiceRecording: false, voiceCancelArmed: false });
    if (cancel) return;
    // The existing project captures audio but has no speech-to-text integration yet.
    // Do not claim a voice message was delivered.
  },

  showVoice() {
    // Legacy navigation used to open a static overlay. Press-and-hold is now required.
  },

  startVoice() {
    // Legacy tap handler intentionally disabled; recording starts on touchstart.
  },

  stopVoice() {
    this.finishVoiceHold(false);
  },

  cancelVoice() {
    this.finishVoiceHold(true);
  },

  copyMessage(e) {
    wx.setClipboardData({ data: e.currentTarget.dataset.text || '' });
  },

  retryMessage() {
    const messages = this.data.messages;
    const lastUser = messages.slice().reverse().find(item => item.role === 'user');
    if (!lastUser || this.data.loading) {
      wx.showToast({ title: '还没有可以重问的问题', icon: 'none' });
      return;
    }
    this.send(lastUser.text, lastUser.image);
  },

  readMessage() {
    wx.showToast({ title: '朗读功能暂未接入', icon: 'none' });
  },

  showMessageMore() {
    wx.showActionSheet({
      itemList: ['复制回复', '清空本次对话'],
      success: res => {
        if (res.tapIndex === 0) {
          const last = this.data.messages.slice().reverse().find(item => item.role === 'assistant');
          if (last) wx.setClipboardData({ data: last.text });
        } else if (res.tapIndex === 1) {
          this.clear();
        }
      }
    });
  },

  clear() {
    if (this.data.loading) return;
    this.finishTyping();
    this.setData({ messages: [], input: '', anchor: '' });
  }
});
