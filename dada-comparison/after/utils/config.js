const KEY='dada_after_settings_v2';
let apiKey='';
function get(){return Object.assign({baseUrl:'https://open.bigmodel.cn/api/paas/v4',model:'glm-4-flash',skill:true,rag:true,profile:true},wx.getStorageSync(KEY)||{},{apiKey});}
function save(data){apiKey=data.apiKey.trim();const copy=Object.assign({},data);delete copy.apiKey;wx.setStorageSync(KEY,copy);}
module.exports={get,save};
