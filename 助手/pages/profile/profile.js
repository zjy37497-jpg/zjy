const profile = require('../../utils/profile');
const categoryNames = { basic: '本人基础信息', goals: '目标', preferences: '运动饮食偏好', schedule: '时间安排', equipment: '器械条件', health_constraints: '健康情况（本人自述）', communication: '表达偏好' };
const statusNames = { active: '本人自述', needs_confirmation: '仍需确认', resolved_by_user: '本人自述已恢复' };
Page({
  data: { loading: false, ready: false, enabled: false, records: [], error: '' },
  onShow() { this.refresh(); },
  async refresh() {
    if (this.data.loading) return;
    this.setData({ loading: true, error: '', records: [], ready: false });
    try {
      const result = await profile.call({ action: 'profile_get' });
      this.setData({ ready: true, enabled: result.enabled, records: result.records.map(record => Object.assign({}, record, { categoryName: categoryNames[record.category], statusName: statusNames[record.status] })) });
    } catch (error) { this.setData({ error: profile.explain(error) }); }
    finally { this.setData({ loading: false }); }
  },
  async mutate(change) {
    if (this.data.loading || !this.data.ready) return;
    this.setData({ loading: true });
    try {
      const proposal = await profile.call({ action: 'profile_prepare', change });
      const result = proposal.status === 'unchanged' ? { cancelled: true } : await profile.confirmProposal(proposal);
      if (!result.cancelled) wx.showToast({ title: '已更新', icon: 'success' });
    } catch (error) { await profile.modal({ title: '未确认成功', content: profile.explain(error), showCancel: false }); }
    finally { this.setData({ loading: false }); await this.refresh(); }
  },
  toggleMemory() { return this.mutate({ operation: this.data.enabled ? 'disable_memory' : 'enable_memory' }); },
  removeRecord(event) { return this.mutate({ operation: 'delete', record_id: event.currentTarget.dataset.id }); },
  clearAll() { return this.mutate({ operation: 'clear' }); },
  async editRecord(event) {
    if (this.data.loading) return;
    const record = this.data.records.find(item => item.id === event.currentTarget.dataset.id);
    if (!record) return;
    const result = await profile.modal({ title: '更正这条资料', editable: true, content: record.statement, placeholderText: '只填写你本人的真实情况' });
    if (!result.confirm || !result.content || !result.content.trim()) return;
    return this.mutate({ operation: 'upsert', record_id: record.id, category: record.category, statement: result.content.trim(), evidence: result.content.trim(), status: record.category === 'health_constraints' ? 'needs_confirmation' : 'active' });
  }
});
