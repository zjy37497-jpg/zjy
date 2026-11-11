const KEY='dada_before_settings_v2';
let apiKey='';
function get(){return Object.assign({baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-4-flash',skill:false,rag:false,profile:false},wx.getStorageSync(KEY)||{},{apiKey});}
function save(data){apiKey=data.apiKey.trim();const copy=Object.assign({},data);delete copy.apiKey;wx.setStorageSync(KEY,copy);}
module.exports={get,save};
