const config=require('../../utils/config');
Page({data:{enhanced:false,form:{}},onLoad(){this.setData({form:config.get()});},change(e){this.setData({['form.'+e.currentTarget.dataset.key]:e.detail.value});},save(){const f=this.data.form;if(!/^https:\/\//.test(f.baseUrl)||!f.model.trim()){wx.showToast({title:'请填写 HTTPS 地址和模型名',icon:'none'});return;}config.save(f);wx.navigateBack();}});
