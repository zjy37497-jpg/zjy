const {callLLM}=require('./request');
async function chat(history,config){const messages=[{role:'system',content:'你是搭练 AI 健身助手。'}].concat(history.slice(-16).map(m=>({role:m.role,content:m.text.slice(0,2000)})));const result=await callLLM(config,messages,[]);if(!result.content)throw new Error('模型没有返回文字');return {ok:true,text:result.content,trace:[]};}
module.exports={chat};
