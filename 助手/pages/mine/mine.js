const ui = require('../../utils/ui');

function today() {
  const d = new Date();
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');
}

Page({
  data: Object.assign({}, ui.getNavMetrics(), {
    goals: ['养成运动习惯', '提升力量', '改善体能', '合理减脂'],
    goal: '养成运动习惯',
    goalIndex: 0,
    done: false,
    hasPlan: false,
    plan: null,
    weight: '--'
  }),

  onShow() {
    this.loadData();
  },

  loadData() {
    const goal = wx.getStorageSync('dalian_goal') || '养成运动习惯';
    const profile = wx.getStorageSync('dalian_plan_profile') || null;
    const plan = profile && profile.plan ? profile.plan : null;
    const goalIndex = Math.max(0, this.data.goals.indexOf(goal));
    this.setData({
      goal,
      goalIndex,
      done: wx.getStorageSync('dalian_checkin') === today(),
      hasPlan: Boolean(plan),
      plan,
      weight: profile && profile.weight ? profile.weight : '--'
    });
  },

  goBack() {
    ui.goBack('/pages/index/index');
  },

  changeGoal(e) {
    const goalIndex = Number(e.detail.value);
    const goal = this.data.goals[goalIndex];
    try {
      wx.setStorageSync('dalian_goal', goal);
      this.setData({ goal, goalIndex });
    } catch (err) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  openPlan() {
    wx.navigateTo({ url: '/pages/plan/plan' });
  },

  clearData() {
    wx.showModal({
      title: '清除搭子本地数据',
      content: '将清除目标、训练计划和今日打卡记录。',
      success: res => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync('dalian_goal');
          wx.removeStorageSync('dalian_checkin');
          wx.removeStorageSync('dalian_plan_profile');
          this.setData({
            goal: '养成运动习惯',
            goalIndex: 0,
            done: false,
            hasPlan: false,
            plan: null,
            weight: '--'
          });
          wx.showToast({ title: '已清除' });
        } catch (e) {
          wx.showToast({ title: '清除失败，请重试', icon: 'none' });
        }
      }
    });
  }
});
