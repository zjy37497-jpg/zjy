const cloudConfig = require('./utils/cloudConfig');
App({
  globalData: { version: '1.1.0' },
  onLaunch() {
    if (wx.cloud) {
      const options = { traceUser: false };
      if (cloudConfig.env) options.env = cloudConfig.env;
      wx.cloud.init(options);
    }
  }
});
