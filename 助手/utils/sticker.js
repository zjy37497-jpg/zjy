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


// Remove emoji pictographs, but keep textual kaomoji.
const EMOJI_RE = /[\uD83C-\uD83E][\uDC00-\uDFFF]|[\u2728\u2764\u2B50\u2705\u274C\u2757\u26A1\u2615\u263A\uFE0F\u200D]/g;
function stripEmoji(t) {
  return String(t || '').replace(EMOJI_RE, '').replace(/[ \t]{2,}/g,' ');
}
const KAOMOJI_RE = /[ヾヽ╰╭٩ෆ୧]*[(（][^\u4e00-\u9fffA-Za-z0-9\n()（）]{3,18}[)）][ﾉノﾞゞ╯╮ෆو૭ง♡♥☆★✧ﾟ]*/g;
function limitKaomoji(t) {
  let count=0;
  return String(t || '').replace(KAOMOJI_RE, m => (++count === 1 ? m : '')).replace(/[ \t]{2,}/g, ' ');
}
function hasKaomoji(t) {
  KAOMOJI_RE.lastIndex=0;
  const found=KAOMOJI_RE.test(String(t || ''));
  KAOMOJI_RE.lastIndex=0;
  return found;
}
const SAFETY_RE = /疼|痛|伤|肿|晕|胸闷|呼吸|不适|就医|医生|医院|急救|120|发烧|抽筋|拉伤|扭|严重/;
const NO_STICKER_RE = /(不要|别|不用|不想要|取消|关掉|关闭|停止|别再)[^，。！？\n]{0,4}(发)?表情/;
const DAILY_POOL = ['cute','cute','happy'];
function sceneId(user, reply) {
  const both = user + '\n' + reply;
  if (/累|疲惫|不想动|没力气|没精神/.test(user)) return 'tired';
  if (/难过|委屈|孤单|孤独|想哭|心情不好|失落|崩溃/.test(user)) return 'hug';
  if (/晚安|去睡|要睡|睡觉/.test(both)) return 'goodnight';
  if (/你好|您好|早上好|早安|下午好|晚上好|在吗|好久不见/.test(user)) return 'hello';
  if (/练完|完成了|打卡|收工|达成|做到了|进步/.test(both)) return 'celebrate';
  if (/加油|开练|开始练|准备|热身|动起来|鼓励/.test(both)) return 'cheer';
  if (/开心|太好了|好消息|恭喜|高兴|太棒|哈哈/.test(both)) return 'happy';
  return '';
}
function autoStickerId(reply, opts) {
  const recent=(opts && opts.recentIds) || [];
  const users=(opts && opts.userTexts) || [];
  const last=users.length ? users[users.length-1] : '';
  if (!hasKaomoji(reply) || SAFETY_RE.test(reply) || SAFETY_RE.test(last)) return '';
  if (users.some(t=>NO_STICKER_RE.test(t))) return '';
  if (recent[0] && Math.random()>=.35) return '';
  const scene=sceneId(last,reply);
  if (scene==='tired' || scene==='hug') return scene===recent[0] ? '' : scene;
  if (scene && !recent.includes(scene)) return scene;
  const pool=DAILY_POOL.filter(id=>!recent.includes(id));
  const alternatives=pool.length ? pool : DAILY_POOL.filter(id=>id!==recent[0]);
  return alternatives[Math.floor(Math.random()*alternatives.length)] || '';
}

function parse(raw, opts) {
  let sticker = '';
  let id = '';
  const text = limitKaomoji(stripEmoji(raw))
    .replace(/\[\[sticker:([a-z_]+)\]\]/g, (m, key) => {
      if (!sticker && STICKERS[key]) { sticker = pick(STICKERS[key]); id = key; }
      return '';
    })
    .replace(/\[\[sticker:[^\]]*$/, '') // 去掉末尾未写完的标记
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  if (!sticker && text) {
    const auto=autoStickerId(text,opts);
    if (auto && STICKERS[auto]) { sticker=pick(STICKERS[auto]); id=auto; }
  }
  return { text, sticker, id };
}

module.exports = { parse, stripEmoji, limitKaomoji, STICKERS };
