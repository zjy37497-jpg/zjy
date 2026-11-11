function callLLM(config,messages,tools){
 if(!config.apiKey) return Promise.reject(new Error('请先在“接口设置”填写 API Key。'));
 if(!/^https:\/\/[^\s?#]+$/.test(config.baseUrl)) return Promise.reject(new Error('接口地址必须以 https:// 开头，不带查询参数。'));
 return new Promise((resolve,reject)=>{
  const data={model:config.model,messages,temperature:0.5,max_tokens:1400};
  if(tools.length){data.tools=tools;data.tool_choice='auto';}
  wx.request({url:config.baseUrl.replace(/\/$/,'')+'/chat/completions',method:'POST',timeout:60000,header:{'Content-Type':'application/json',Authorization:'Bearer '+config.apiKey},data,
   success(res){const m=res.data&&res.data.choices&&res.data.choices[0]&&res.data.choices[0].message;
    if(res.statusCode<200||res.statusCode>=300||!m)return reject(new Error('模型请求失败（'+res.statusCode+'），请检查密钥、余额、模型名称及工具调用支持。'));
    if(m.tool_calls&&(!Array.isArray(m.tool_calls)||m.tool_calls.length>4))return reject(new Error('模型工具调用格式错误'));
    resolve(m);},
   fail(){reject(new Error('网络请求失败，请检查接口域名、网络和开发者工具的域名校验设置。'));}
  });
 });
}
module.exports={callLLM};
