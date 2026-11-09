// 本地直连模式的配置。
// apiKey 填了就直接从小程序请求模型（仅限本地调试，不要发布、不要把这个文件发给别人）。
// apiKey 留空则走云函数 chat。
module.exports = {
  baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
  apiKey: '08df17989eaf4497b836be0c86ed96de.gucpr6yqYSATza5l',
  model: 'glm-5.3-flash',
};
