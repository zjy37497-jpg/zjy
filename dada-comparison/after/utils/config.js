// Credentials stay in this mini program's local cache, never in source files.
const KEY = 'dada_after_settings_v2';
const BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const MODEL = 'glm-4-flash-250414';
function get() {
  return Object.assign({skill:true,rag:true,profile:true,apiKey:''},
    wx.getStorageSync(KEY) || {}, {baseUrl:BASE_URL,model:MODEL});
}
function save(data) {
  const next = {baseUrl:BASE_URL,model:MODEL,apiKey:String(data.apiKey || '').trim(),
    skill:!!data.skill,rag:!!data.rag,profile:!!data.profile};
  wx.setStorageSync(KEY, next);
}
function clearKey() {
  const next = get();
  delete next.apiKey;
  wx.setStorageSync(KEY, next);
}
module.exports = {get,save,clearKey};
