const ui = require('../../utils/ui');

const AGES = Array.from({ length: 55 }, (_, i) => String(i + 16));

function today() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
}

Page({
  data: Object.assign({}, ui.getNavMetrics(), {
    gender: 'female',
    genderSwitchAnimated: false,
    ages: AGES,
    age: 28,
    ageIndex: 12,
    height: 165,
    weight: 60,
    activity: '1-2',
    activities: [
      { value: 'rare', label: '几乎不动' },
      { value: '1-2', label: '每周1~2天' },
      { value: '3-4', label: '每周3~4天' }
    ],
    goals: ['养成运动习惯', '提升力量', '改善体能', '合理减脂'],
    goal: '养成运动习惯',
    places: ['居家训练', '健身房', '户外'],
    place: '居家训练',
    equipmentOptions: [
      { label: '弹力带', selected: true },
      { label: '哑铃', selected: false },
      { label: '无器械', selected: false }
    ],
    painOptions: [
      { label: '肩部', selected: true },
      { label: '背部', selected: false },
      { label: '手肘', selected: false },
      { label: '腰部', selected: false },
      { label: '膝部', selected: false },
      { label: '无', selected: false }
    ],
    diseaseOptions: [
      { label: '高血压', selected: true },
      { label: '脑卒中', selected: false },
      { label: '冠心病', selected: false },
      { label: '糖尿病', selected: false },
      { label: '脂肪肝', selected: false },
      { label: '慢性肺病', selected: false },
      { label: '哮喘', selected: false },
      { label: '骨质疏松', selected: false },
      { label: '血脂异常', selected: false },
      { label: '恶性肿瘤', selected: false },
      { label: '尿酸升高', selected: false },
      { label: '无', selected: false }
    ],
    expanded: true,
    generating: false,
    planGenerated: false,
    plan: null,
    done: false,
    anchor: '',
    planInput: '',
    agePickerOpen: false,
    agePickerValue: [12],
    ageDraft: 28,
    navElevated: false
  }),

  onLoad() {
    this.loadProfile();
  },

  onShow() {
    this.setData({ done: wx.getStorageSync('dalian_checkin') === today() });
  },

  onPageScroll(e) {
    const navElevated = e.scrollTop > 10;
    if (navElevated !== this.data.navElevated) {
      this.setData({ navElevated });
    }
  },

  onUnload() {
    if (this._genderGlintTimer) clearTimeout(this._genderGlintTimer);
    if (this.timer) clearTimeout(this.timer);
  },

  loadProfile() {
    const saved = wx.getStorageSync('dalian_plan_profile');
    if (!saved || !saved.gender) return;
    const ageIndex = Math.max(0, AGES.indexOf(String(saved.age)));
    const patch = {
      gender: saved.gender || 'female',
      age: saved.age || 28,
      ageIndex: ageIndex >= 0 ? ageIndex : 12,
      height: saved.height || 165,
      weight: saved.weight || 60,
      activity: saved.activity || '1-2',
      goal: saved.goal || '养成运动习惯',
      place: saved.place || '居家训练',
      plan: saved.plan || null,
      planGenerated: Boolean(saved.plan)
    };
    if (Array.isArray(saved.equipment)) {
      patch.equipmentOptions = this.data.equipmentOptions.map(item => ({
        label: item.label,
        selected: saved.equipment.indexOf(item.label) > -1
      }));
    }
    if (Array.isArray(saved.painAreas)) {
      patch.painOptions = this.data.painOptions.map(item => ({
        label: item.label,
        selected: saved.painAreas.indexOf(item.label) > -1
      }));
    }
    if (Array.isArray(saved.diseaseHistory)) {
      patch.diseaseOptions = this.data.diseaseOptions.map(item => ({
        label: item.label,
        selected: saved.diseaseHistory.indexOf(item.label) > -1
      }));
    }
    this.setData(patch);
  },

  goBack() {
    ui.goBack('/pages/index/index');
  },

  goChat() {
    wx.reLaunch({ url: '/pages/index/index' });
  },

  onPlanInput(e) {
    this.setData({ planInput: e.detail.value });
  },

  sendPlanMessage() {
    const text = String(this.data.planInput || '').trim();
    if (!text) return;
    try {
      wx.setStorageSync('dalian_pending_message', text);
    } catch (e) {
      wx.showToast({ title: '输入内容保存失败', icon: 'none' });
      return;
    }
    wx.reLaunch({ url: '/pages/index/index' });
  },

  showPlanVoice() {
    wx.reLaunch({ url: '/pages/index/index?voice=1' });
  },

  stayOnPlan() {
    wx.pageScrollTo({ scrollTop: 0, duration: 200 });
  },

  openQuick(e) {
    const action = e.currentTarget.dataset.action;
    if (!action) return;
    wx.reLaunch({ url: '/pages/index/index?action=' + action });
  },

  showPlanMore() {
    wx.showActionSheet({
      itemList: ['返回聊天', '重新填写计划'],
      success: res => {
        if (res.tapIndex === 0) this.goChat();
        if (res.tapIndex === 1) {
          this.setData({ planGenerated: false, anchor: '', expanded: false });
        }
      }
    });
  },

  // Crossfade card color without changing its geometry.
  selectGender(e) {
    const next = e.currentTarget.dataset.value;
    if (next === this.data.gender) return;
    if (this._genderGlintTimer) clearTimeout(this._genderGlintTimer);
    this.setData({ gender: next, genderSwitchAnimated: false }, () => {
      this._genderGlintTimer = setTimeout(() => {
        this._genderGlintTimer = null;
        this.setData({ genderSwitchAnimated: true });
      }, 16);
    });
    this.tickHaptic('selection', true);
  },

  changeAge(e) {
    const ageIndex = Number(e.detail.value);
    this.setData({ ageIndex, age: Number(AGES[ageIndex]) });
  },

  openAgePicker() {
    this.setData({
      agePickerOpen: true,
      agePickerValue: [this.data.ageIndex],
      ageDraft: this.data.age
    });
  },

  closeAgePicker() {
    this.setData({ agePickerOpen: false });
  },

  noopAge() {},

  onAgeWheelChange(e) {
    const ageIndex = Number(e.detail.value[0]);
    if (!Number.isInteger(ageIndex) || ageIndex < 0 || ageIndex >= AGES.length) return;
    if (ageIndex !== this.data.ageIndex) this.tickHaptic('age');
    this.setData({
      ageIndex,
      ageDraft: Number(AGES[ageIndex])
    });
  },

  confirmAge() {
    this.setData({
      age: this.data.ageDraft,
      agePickerOpen: false
    });
  },

  // Short tactile ticks on real devices; throttled so fast drags remain gentle.
  tickHaptic(channel, immediate) {
    if (typeof wx === 'undefined' || typeof wx.vibrateShort !== 'function') return;
    const now = Date.now();
    if (!immediate && now - (this._lastHapticAt || 0) < 85) return;
    this._lastHapticAt = now;
    try { wx.vibrateShort({ type: 'light', fail: () => {} }); } catch (_) {}
  },

  // P1 custom slider: keep its touch hitbox identical to the visible track.
  // A brief tap must still update the value even if the first rect query is delayed.
  onMetricTouchStart(e) {
    const metric = e.currentTarget.dataset.metric;
    if (metric !== 'height' && metric !== 'weight') return;
    this._metricTouchType = metric;
    this._metricTapEnded = false;
    this._metricRect = null;
    this._metricLastTouch = e.touches && e.touches[0];
    const index = metric === 'height' ? 0 : 1;
    wx.createSelectorQuery().in(this).selectAll('.metric-slider').boundingClientRect(rects => {
      if (!Array.isArray(rects)) return;
      if (this._metricTouchType !== metric) return;
      this._metricRect = rects[index] || null;
      this.applyMetricTouch(metric, this._metricLastTouch);
      if (this._metricTapEnded) {
        this._metricTouchType = '';
        this._metricRect = null;
        this._metricTapEnded = false;
      }
    }).exec();
  },

  applyMetricTouch(metric, touch) {
    const rect = this._metricRect;
    if (!rect || !touch || !rect.width) return;
    const progress = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    const min = metric === 'height' ? 140 : 35;
    const max = metric === 'height' ? 210 : 150;
    const next = Math.round(min + progress * (max - min));
    if (this.data[metric] === next) return;
    this.tickHaptic(metric);
    this.setData({ [metric]: next });
  },

  onMetricTouchMove(e) {
    const metric = this._metricTouchType;
    if (!metric) return;
    const touch = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
    if (!touch) return;
    this._metricLastTouch = touch;
    this.applyMetricTouch(metric, touch);
  },

  onMetricTouchEnd(e) {
    const metric = this._metricTouchType;
    if (!metric) return;
    const touch = (e.changedTouches && e.changedTouches[0]) || this._metricLastTouch;
    this._metricLastTouch = touch;
    if (this._metricRect) {
      this.applyMetricTouch(metric, touch);
      this._metricTouchType = '';
      this._metricRect = null;
    } else {
      // Allow the pending layout measurement to resolve a quick tap.
      this._metricTapEnded = true;
    }
  },

  changeHeight(e) {
    const next = Number(e.detail.value);
    if (!Number.isFinite(next) || next === this.data.height) return;
    this.tickHaptic('height');
    this.setData({ height: next });
  },

  changeWeight(e) {
    const next = Number(e.detail.value);
    if (!Number.isFinite(next) || next === this.data.weight) return;
    this.tickHaptic('weight');
    this.setData({ weight: next });
  },

  selectActivity(e) {
    this.setData({ activity: e.currentTarget.dataset.value });
  },

  selectGoal(e) {
    this.setData({ goal: e.currentTarget.dataset.value });
  },

  selectPlace(e) {
    this.setData({ place: e.currentTarget.dataset.value });
  },

  toggleMore() {
    this.setData({ expanded: !this.data.expanded });
  },

  toggleOption(field, index) {
    const options = this.data[field].map(item => Object.assign({}, item));
    const target = options[Number(index)];
    if (!target) return;

    if (!target.selected && target.label === '无') {
      options.forEach(item => {
        item.selected = item.label === '无';
      });
    } else {
      if (target.label !== '无') {
        options.forEach(item => {
          if (item.label === '无') item.selected = false;
        });
      }
      target.selected = !target.selected;
    }
    this.setData({ [field]: options });
  },

  toggleEquipment(e) {
    this.toggleOption('equipmentOptions', e.currentTarget.dataset.index);
  },

  togglePain(e) {
    this.toggleOption('painOptions', e.currentTarget.dataset.index);
  },

  toggleDisease(e) {
    this.toggleOption('diseaseOptions', e.currentTarget.dataset.index);
  },

  buildPlan() {
    const data = this.data;
    const selectedEquipment = data.equipmentOptions.filter(item => item.selected).map(item => item.label);
    const selectedPain = data.painOptions
      .filter(item => item.selected && item.label !== '无')
      .map(item => item.label);
    const selectedDisease = data.diseaseOptions
      .filter(item => item.selected && item.label !== '无')
      .map(item => item.label);
    const dayMap = {
      rare: '2天',
      '1-2': '2天',
      '3-4': '3天'
    };
    const levelMap = {
      rare: '轻松',
      '1-2': '入门',
      '3-4': '适中'
    };
    const goalTitle = {
      '养成运动习惯': '稳稳起步',
      '提升力量': '力量进阶',
      '改善体能': '体能焕新',
      '合理减脂': '轻盈塑形'
    };
    const placeCopy = data.place === '健身房'
      ? '结合自由重量和固定器械'
      : data.place === '户外'
        ? '以快走、慢跑和自重训练为主'
        : '以自重、弹力带和小空间动作为主';

    const caution = selectedPain.length
      ? '你标记了' + selectedPain.join('、') + '不适，训练时请避开引起疼痛的动作。'
      : '训练中出现疼痛时立即停止，不必为了完成计划硬撑。';

    return {
      title: goalTitle[data.goal] + ' · 4周训练计划',
      summary: placeCopy + '，围绕你的目标安排循序渐进的全身训练。',
      days: dayMap[data.activity],
      duration: data.activity === 'rare' ? '20分钟' : '30分钟',
      level: levelMap[data.activity],
      sessions: [
        { day: '周一', title: '全身基础力量', desc: '深蹲、推、拉与核心交替完成', duration: '25分钟' },
        { day: '周三', title: '心肺与灵活性', desc: '低强度有氧配合关节活动', duration: '20分钟' },
        { day: '周六', title: '下肢与体态', desc: '臀腿训练、拉伸与恢复', duration: '25分钟' }
      ],
      advice: '先用可稳定完成的次数起步，再逐步增加训练量。' + caution,
      equipment: selectedEquipment,
      painAreas: selectedPain,
      diseaseHistory: selectedDisease
    };
  },

  generatePlan() {
    if (this.data.generating) return;
    this.setData({ generating: true });
    this.timer = setTimeout(() => {
      const plan = this.buildPlan();
      const profile = {
        gender: this.data.gender,
        age: this.data.age,
        height: this.data.height,
        weight: this.data.weight,
        activity: this.data.activity,
        goal: this.data.goal,
        place: this.data.place,
        equipment: this.data.equipmentOptions.filter(item => item.selected).map(item => item.label),
        painAreas: this.data.painOptions.filter(item => item.selected).map(item => item.label),
        diseaseHistory: this.data.diseaseOptions.filter(item => item.selected).map(item => item.label),
        plan
      };
      try {
        wx.setStorageSync('dalian_plan_profile', profile);
      } catch (e) {}
      this.setData({
        generating: false,
        planGenerated: true,
        plan,
        anchor: 'generated-plan'
      });
    }, 720);
  },

  checkin() {
    if (this.data.done) return;
    try {
      wx.setStorageSync('dalian_checkin', today());
      this.setData({ done: true });
      wx.showToast({ title: '今天也迈出了一步', icon: 'none' });
    } catch (e) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  }
});
