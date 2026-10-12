const {chromium}=require('playwright');
const fs=require('fs');

(async()=>{
  const browser=await chromium.launch({headless:false});
  const results={collectedAt:new Date().toISOString(),sources:[]};
  try{
    const sources=[
      {name:'Fujifilm USA',
       url:'https://newsroom-us.fujifilm.com/press-releases/default.aspx',
       selector:'.module-news-widget .module_headline-link',
       kind:'fuji'},
      {name:'ConnectWise',
       url:'https://www.globenewswire.com/search/organization/connectwise%CE%B4%2520inc%C2%A7',
       selector:'a[href*="/news-release/"]',
       kind:'cw'}
    ];
    for(const source of sources){
      const page=await browser.newPage();
      try{
        await page.goto(source.url,{waitUntil:'domcontentloaded',timeout:45000});
        await page.locator(source.selector).first().waitFor({timeout:30000});
        const articles=await page.evaluate(kind=>{
          if(kind==='fuji'){
            return Array.from(document.querySelectorAll('.module-news-widget .module_item')).map(el=>{
              const a=el.querySelector('.module_headline-link');
              return {
                title:a?.textContent.trim(),
                url:a?.href,
                dateText:el.querySelector('.module_date-text')?.textContent.trim()
              };
            });
          }
          return Array.from(document.querySelectorAll('a[href*="/news-release/"]'))
            .filter(a=>a.textContent.trim().length>15)
            .map(a=>({
              title:a.textContent.trim(),url:a.href,
              date:(a.href.match(/\/news-release\/(\d{4})\/(\d{2})\/(\d{2})\//)||[])
                .slice(1).join('-')
            }));
        },source.kind);
        for(const a of articles){
          if(a.dateText){
            const d=new Date(a.dateText+' 12:00:00 GMT');
            a.date=Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
          }
        }
        const seen=new Set();
        const valid=articles.filter(a=>{
          if(!a.title||!a.url||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||seen.has(a.url))
            return false;
          seen.add(a.url);return true;
        });
        if(!valid.length)throw new Error('No valid dated releases');
        results.sources.push({name:source.name,url:source.url,articles:valid});
        console.log('PASS '+source.name+' | '+valid.length+' dated releases');
        valid.slice(0,3).forEach(a=>console.log(a.date+' | '+a.title));
      }catch(e){
        console.log('FAILED '+source.name+' | '+e.message);
      }finally{
        await page.close();
      }
    }
    if(results.sources.length===2){
      fs.writeFileSync('browser-news.json',JSON.stringify(results,null,2));
      console.log('SUCCESS: both sources collected. Saved browser-news.json.');
    }else{
      console.log('Incomplete test. No data file replaced.');
      process.exitCode=1;
    }
  }finally{
    await browser.close();
  }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
