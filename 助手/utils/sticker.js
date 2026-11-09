// 表情包解析：把回复里的 [[sticker:id]] 标记取出，返回纯文字和对应的本地图片路径。
// 规则：一条回复最多显示一张表情包，只取第一个有效标记；其余标记一律从文字中去掉。
// 想换图或换对应关系，只改下面的 STICKERS。值是数组时，每次随机取一张。
const DIR = '/images/stickers/';
const STICKERS = {
  happy: DIR + 'happy.gif',        // 分享开心的事
  celebrate: DIR + 'celebrate.gif',// 练完了、达成目标
  hello: DIR + 'hello.jpg',        // 你好、早上好
  cute: [DIR + 'cute1.jpg', DIR + 'cute2.jpg', DIR + 'cute3.jpg', DIR + 'cute4.jpg'], // 轻松聊天、卖个萌
  cheer: DIR + 'cheer.jpg',        // 准备训练、需要鼓励
  hug: DIR + 'hug.gif',            // 难过、委屈、孤单
  tired: DIR + 'tired.gif',        // 好累、不想动
  goodnight: DIR + 'goodnight.gif' // 准备睡觉、结束聊天
};

function pick(v) {
  return Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;
}

function parse(raw) {
  let sticker = '';
  let id = '';
  const text = String(raw || '')
    .replace(/\[\[sticker:([a-z_]+)\]\]/g, (m, key) => {
      if (!sticker && STICKERS[key]) { sticker = pick(STICKERS[key]); id = key; }
      return '';
    })
    .replace(/\[\[sticker:[^\]]*$/, '') // 去掉末尾未写完的标记
    .trim();
  return { text, sticker, id };
}

module.exports = { parse, STICKERS };
