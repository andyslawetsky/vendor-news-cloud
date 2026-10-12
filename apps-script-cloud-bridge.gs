/* v14.1: read public browser releases collected in GitHub; test only. */
var vendorCloudCache141;
function vendorReadCloud141_(){
  vendorAssertTest_();
  if(vendorCloudCache141)return vendorCloudCache141;
  var url='https://raw.githubusercontent.com/andyslawetsky/vendor-news-cloud/main/browser-news.json';
  var response=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true});
  if(response.getResponseCode()!==200)throw new Error('Cloud feed HTTP '+response.getResponseCode());
  var data=JSON.parse(response.getContentText());
  var age=Date.now()-new Date(data.collectedAt).getTime();
  if(!isFinite(age)||age<0||age>86400000)throw new Error('Cloud browser collection is older than 24 hours');
  if(!Array.isArray(data.sources)||data.sources.length!==2)throw new Error('Cloud feed must contain both sources');
  ['Fujifilm USA','ConnectWise'].forEach(function(name){
    var matches=data.sources.filter(function(s){return s.name===name;});
    if(matches.length!==1||!Array.isArray(matches[0].articles)||!matches[0].articles.length)throw new Error(name+' missing from cloud feed');
    matches[0].articles.forEach(function(a){
      var host=vendorHost_(a.url),expected=name==='Fujifilm USA'?'newsroom-us.fujifilm.com':'globenewswire.com';
      if(host!==expected||!a.title||!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(a.date))throw new Error('Invalid '+name+' cloud record');
    });
  });
  vendorCloudCache141=data;
  return data;
}
vendorBrowserSource140_=function(index){
  if(index!==4&&index!==21)throw new Error('Unexpected browser source index');
  var data=vendorReadCloud141_();
  vendorBrowserData139=data;
  var name=index===4?'Fujifilm USA':'ConnectWise';
  return data.sources.filter(function(s){return s.name===name;})[0];
};
function refreshCloudBrowserNews141(){
  vendorAssertTest_();
  vendorBrowserSource140_(4);
  Logger.log('CLOUD FEED '+vendorBrowserData139.collectedAt);
  importBrowserNews139();
  Logger.log('Cloud feed imported. Mac and Terminal are not used for collection.');
  Logger.log('No emails, Apps Script triggers, or baseline changes.');
}
