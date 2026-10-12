/* Live vendor delivery: existing collectors remain intact. */
var VENDOR_LIVE_STATE_KEY='VENDOR_LIVE_142_STATE';
function vendorLiveRead142_(){
  var p=PropertiesService.getScriptProperties(),raw=p.getProperty(VENDOR_LIVE_STATE_KEY);
  if(!raw)return null;
  var manifest=JSON.parse(raw),encoded=manifest.parts.map(function(k){
    var v=p.getProperty(k);if(v===null)throw new Error('Live state part missing');return v;
  }).join('');
  return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(encoded),'application/gzip')).getDataAsString());
}
function vendorLiveWrite142_(state){
  var p=PropertiesService.getScriptProperties(),previous=p.getProperty(VENDOR_LIVE_STATE_KEY);
  var old=previous?JSON.parse(previous).parts:[],parts=[],token=Utilities.getUuid();
  var encoded=Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(state),'application/json')).getBytes());
  try{
    for(var i=0;i<encoded.length;i+=8000){
      var key=VENDOR_LIVE_STATE_KEY+'_'+token+'_'+parts.length;
      parts.push(key);p.setProperty(key,encoded.slice(i,i+8000));
    }
    p.setProperty(VENDOR_LIVE_STATE_KEY,JSON.stringify({parts:parts}));
  }catch(e){parts.forEach(function(k){try{p.deleteProperty(k);}catch(ignore){}});throw e;}
  old.forEach(function(k){try{p.deleteProperty(k);}catch(ignore){}});
}
function vendorLiveClock142_(){
  var now=new Date();
  return {day:Utilities.formatDate(now,'America/New_York','yyyy-MM-dd'),
    time:Utilities.formatDate(now,'America/New_York','HH:mm')};
}
function vendorLiveHtml142_(articles,errors){
  var html=vendorDigestHtml_(articles).replace('Daily Digest Preview','Daily Digest')
    .replace('TEST PREVIEW — NOT SENT','NEW VENDOR ARTICLES');
  if(errors.length){
    var esc=function(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');};
    html+='<p><strong>Sources requiring attention:</strong> '+errors.map(esc).join('; ')+'</p>';
  }
  return html;
}
function vendorLiveDeliver142_(state,articles,day,errors){
  if(state.pendingDelivery)throw new Error('A prior delivery needs review; automatic resend stopped.');
  if(MailApp.getRemainingDailyQuota()<1)throw new Error('Email quota unavailable; no delivery attempted');
  articles=vendorDedupe_(articles).sort(vendorSort_);
  state.pendingDelivery={day:day,articles:articles.map(vendorKey_),startedAt:new Date().toISOString()};
  vendorLiveWrite142_(state);
  var subject='Vendor News Monitor — '+day+' — '+articles.length+' new articles';
  var body=articles.length?articles.map(function(a){return a.company+' | '+(a.date||a.firstDetectedDate||day)+' | '+a.title+'\n'+a.url;}).join('\n\n'):'No new qualifying vendor articles.';
  if(errors.length)body+='\n\nSources requiring attention: '+errors.join('; ');
  MailApp.sendEmail({to:VENDOR_CONFIG.email,subject:subject,body:body,htmlBody:vendorLiveHtml142_(articles,errors)});
  articles.forEach(function(a){state.seen[vendorKey_(a)]=1;});
  state.lastSentDay=day;state.lastSentAt=new Date().toISOString();state.pendingDelivery=null;
  state.cycle=null;state.firstDelivery=null;vendorLiveWrite142_(state);
  Logger.log('EMAIL SENT to '+VENDOR_CONFIG.email+' | '+articles.length+' articles | '+day);
}
function goLiveVendor142(){
  var lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    vendorAssertTest_();
    var existing=vendorLiveRead142_();
    if(existing&&existing.enabled){Logger.log('Already live; first email will not be repeated.');return;}
    vendorBrowserSource140_(4);
    var props=vendorProps_(),all=[],missing=[];
    VENDOR_CONFIG.sources.forEach(function(src,i){
      var r=JSON.parse(props.getProperty('VENDOR_V52_FRESH_'+i)||'{}');
      if(r.status!==200||!(r.articles||[]).length)missing.push(src.name);
      all=all.concat(r.articles||[]);
    });
    if(missing.length)throw new Error('Live setup blocked by missing saved results: '+missing.join(', '));
    var clock=vendorLiveClock142_(),seen={};
    all.forEach(function(a){seen[vendorKey_(a)]=1;});
    var first=vendorDedupe_(all).filter(function(a){
      return /^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(a.date||'')&&a.date>='2026-10-09'&&a.date<=clock.day;
    });
    first.forEach(function(a){a.category=vendorCategory55_(a.title,a.url);});
    if(clock.day!=='2026-10-12'||clock.time>='17:00')throw new Error('5 PM setup deadline passed; no email schedule created.');
    if(MailApp.getRemainingDailyQuota()<1)throw new Error('Email quota unavailable');
    var state={enabled:true,seen:seen,lastSentDay:'',pendingDelivery:null,cycle:null,
      firstDelivery:{day:clock.day,due:'17:00',articles:first}};
    vendorLiveWrite142_(state);
    var triggers=ScriptApp.getProjectTriggers().filter(function(t){return t.getHandlerFunction()==='runLiveVendor142';});
    if(!triggers.length){
      ScriptApp.newTrigger('runLiveVendor142').timeBased().everyMinutes(5).create();
      ScriptApp.newTrigger('runLiveVendor142').timeBased().at(new Date('2026-10-12T17:00:00-04:00')).create();
    }
    Logger.log('LIVE SCHEDULE CREATED: first email October 12 at 5 PM Eastern to '+VENDOR_CONFIG.email+'; '+first.length+' articles queued.');
    Logger.log('Daily scan starts 8:30 AM Eastern; delivery after 9:15 AM. Mac not required.');
  }finally{lock.releaseLock();}
}
function runLiveVendor142(){
  var lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
  try{
    var state=vendorLiveRead142_();if(!state||!state.enabled)return;
    if(state.pendingDelivery){Logger.log('Delivery needs review; no automatic duplicate sent.');return;}
    var clock=vendorLiveClock142_();
    if(state.firstDelivery){
      if(clock.day>=state.firstDelivery.day&&clock.time>=state.firstDelivery.due)
        vendorLiveDeliver142_(state,state.firstDelivery.articles,clock.day,[]);
      return;
    }
    if(state.lastSentDay===clock.day||clock.time<'08:30')return;
    if(!state.cycle||state.cycle.day!==clock.day){
      state.cycle={day:clock.day,index:0,cursor:0,candidates:null,sourceArticles:[],articles:[],errors:[]};
      vendorLiveWrite142_(state);
    }
    var cycle=state.cycle,started=Date.now();
    while(cycle.index<VENDOR_CONFIG.sources.length&&Date.now()-started<200000){
      var i=cycle.index,src=VENDOR_CONFIG.sources[i];
      try{
        if(cycle.candidates===null){
          if(i===4||i===21){
            var cloud=vendorReadCloud141_();
            var collectedDay=Utilities.formatDate(new Date(cloud.collectedAt),'America/New_York','yyyy-MM-dd');
            if(collectedDay!==clock.day)throw new Error('Today\'s cloud collection is not ready');
          }
          var r=vendorFetch_(i===37?'https://press.hp.com/us/en/press-releases.html':src.url);
          if(r.code!==200)throw new Error('Listing HTTP '+r.code);
          cycle.candidates=vendorExtract_(r.html,src,i).slice(0,50);
          if(!cycle.candidates.length)throw new Error('No article candidates');
        }
        while(cycle.cursor<cycle.candidates.length&&Date.now()-started<200000){
          var a=vendorVerify_(cycle.candidates[cycle.cursor]);cycle.cursor++;
          if(a){a.category=vendorCategory55_(a.title,a.url);cycle.sourceArticles.push(a);}
        }
        if(cycle.cursor<cycle.candidates.length){vendorLiveWrite142_(state);return;}
        if(!cycle.sourceArticles.length)throw new Error('No verified articles');
        cycle.sourceArticles.forEach(function(a){
          var key=vendorKey_(a);
          if(!state.seen[key]){
            if(!a.date){a.firstDetectedDate=clock.day;a.date=clock.day;}
            if(a.date>='2026-10-09'&&a.date<=clock.day)cycle.articles.push(a);
            else if(a.date<=clock.day)state.seen[key]=1;
          }
        });
      }catch(e){
        cycle.errors.push(src.name+': '+e.message);
        if(i===4||i===21){
          cycle.candidates=null;cycle.cursor=0;cycle.sourceArticles=[];
          vendorLiveWrite142_(state);Logger.log('Waiting for today\'s cloud feed: '+e.message);return;
        }
      }
      cycle.index++;cycle.cursor=0;cycle.candidates=null;cycle.sourceArticles=[];
      vendorLiveWrite142_(state);
    }
    if(cycle.index>=VENDOR_CONFIG.sources.length&&clock.time>='09:15')
      vendorLiveDeliver142_(state,cycle.articles,clock.day,cycle.errors);
  }finally{lock.releaseLock();}
}
