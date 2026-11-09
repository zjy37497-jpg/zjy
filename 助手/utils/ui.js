function getNavMetrics() {
  let windowInfo = {};
  try {
    windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
  } catch (e) {}

  let menu = null;
  try {
    menu = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
  } catch (e) {}

  const statusBarHeight = windowInfo.statusBarHeight || 20;
  const navBarHeight = menu && menu.height
    ? Math.max(44, (menu.top - statusBarHeight) * 2 + menu.height)
    : 44;

  return {
    statusBarHeight,
    navBarHeight,
    navTotalHeight: statusBarHeight + navBarHeight
  };
}

function goBack(fallbackUrl) {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    wx.navigateBack();
    return;
  }
  if (fallbackUrl) {
    wx.reLaunch({ url: fallbackUrl });
  }
}

module.exports = {
  getNavMetrics,
  goBack
};
