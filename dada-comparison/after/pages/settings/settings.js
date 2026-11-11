const config = require('../../utils/config');
Page({
  data: { enhanced: true, form: {}, saving: false, status: '' },
  onLoad() { this.setData({ form: config.get() }); },
  change(e) { this.setData({ ['form.' + e.currentTarget.dataset.key]: e.detail.value, status: '' }); },
  save(e) {
    if (this.data.saving) return;
    const values = e && e.detail && e.detail.value;
    const f = Object.assign({}, this.data.form, values && typeof values === 'object' ? values : {});
    ['baseUrl', 'model', 'apiKey'].forEach(k => { f[k] = String(f[k] || '').trim(); });
    if (!/^https:\/\/[^\s?#]+$/.test(f.baseUrl) || !f.model || !f.apiKey) {
      this.setData({ status: '请填写完整：HTTPS 接口地址、模型名称和 API Key。' });
      return;
    }
    this.setData({ saving: true, status: '' });
    try { config.save(f); }
    catch (error) {
      this.setData({ saving: false, status: '保存失败，请检查开发者工具的本地缓存后重试。' });
      return;
    }
    this.setData({ saving: false, status: '已保存，正在返回聊天页。' });
    const fallback = () => wx.reLaunch({
      url: '/pages/index/index',
      fail: () => this.setData({ status: '配置已保存。返回聊天页失败，请点击下方“进入聊天页”重试。' })
    });
    if (getCurrentPages().length > 1) wx.navigateBack({ delta: 1, fail: fallback });
    else fallback();
  },
  openChat() { wx.reLaunch({ url: '/pages/index/index' }); }
});
