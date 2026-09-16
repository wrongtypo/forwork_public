import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const { chromium } = await import(process.env.VT_PLAYWRIGHT_MODULE ?? 'playwright');
const project=resolve(import.meta.dirname, '..');
const { default: worker }=await import(`${project}/dist/server/index.js`);
const doc={summary:'隱藏摘要',purpose:'測試工作目的',managementUnit:'測試單位',responsibilities:[{code:'R01',text:'測試管理職責'}],authority:'可自行決定：測試範圍。需協商／會簽：跨單位協調。需向上核定：預算。',performance:['測試績效'],competencies:['M01'],requirements:['測試條件'],languages:{mandarin:'能閱讀中文',vietnamese:'待確認',english:'待確認'},successors:[],interviewQuestions:['隱藏訪談'],sources:['隱藏來源'],annotations:[]};
const base={id:'test-jd',code:'TEST-001',title:'測試職務',site:'測試廠',department:'測試部門',grade:'測試職等',reportsTo:'測試主管',reviewer:'測試審核者',status:'主管確認中',version:'2.0',effectiveDate:'2026-09-14',updatedAt:'2026-09-15',confidentiality:'測試',confirmationStatus:'待確認',confirmedBy:'',confirmedAt:'',confirmationNote:'',document:doc,usageCount:1,revisionId:'test-v2',revisionToken:'token-v2',currentEffectiveVersion:'1',currentEffectiveRevisionId:'test-v1'};
const old={...base,version:'1',status:'正式生效',revisionId:'test-v1',revisionToken:'token-v1'};
const position={...old,id:'test-position',name:'測試職位',unit:'測試單位',headcount:1,jobDescriptionId:base.id,jobDescriptionUsageCount:1,incumbents:[],successors:[]};
const data={jobDescriptions:[{...base,versions:[base,old].map((record,index)=>({id:record.revisionId,revision:2-index,version:record.version,status:record.status,effectiveDate:record.effectiveDate,expiredDate:'',updatedAt:record.updatedAt,record}))}],positions:[position],people:[],assessments:[],competencies:[{id:'M01',name:'測試能力',category:'管理職能',description:'測試描述',sortOrder:1,updatedAt:'2026-09-15'}],orgNodes:[{id:'test-unit',parentId:null,name:'測試單位',type:'unit',positionId:null,sortOrder:0,duties:'測試執掌',purpose:'測試目的',organizationStatus:'已確認'},{id:'test-node',parentId:'test-unit',name:'測試職位',type:'position',positionId:'test-position',sortOrder:0,duties:'',purpose:'',organizationStatus:'已確認'}]};
const origin='https://vt-test.invalid';
doc.competencies.push('P01', 'L01');
const assetsRoot=resolve(project,'dist/client');
const mime={'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
const problems=[];const blocked=[];const requests=[];
const browser=await chromium.launch({headless:true,...(process.env.VT_CHROME_EXECUTABLE ? { executablePath: process.env.VT_CHROME_EXECUTABLE } : {})});
console.log('isolated browser launched');
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
 // Every request is fulfilled from compiled code or fabricated data. No request
 // reaches localhost, a real HR API, a database, or the external network.
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());requests.push(url.pathname);
  if(url.origin!==origin || request.method()!=='GET'){blocked.push(request.url());return route.abort();}
  if(url.pathname==='/api/data') return route.fulfill({json:data});
  if(url.pathname==='/') {
   const response=await worker.fetch(new Request(request.url(),{headers:{accept:'text/html'}}),{ASSETS:{fetch:async()=>new Response('Not found',{status:404})}},{waitUntil(){},passThroughOnException(){}});
   return route.fulfill({status:response.status,contentType:'text/html',body:await response.text()});
  }
  const file=resolve(assetsRoot,`.${decodeURIComponent(url.pathname)}`);
  if(file.startsWith(assetsRoot+'/')) {try {if((await stat(file)).isFile()) return route.fulfill({contentType:mime[extname(file)]??'application/octet-stream',body:await readFile(file)});}catch{ /* Missing files are recorded below and fail the final assertion. */ }}
  blocked.push(url.pathname);return route.abort();
 });
 const page=await context.newPage();
 page.setDefaultTimeout(15000);
 page.on('console',message=>{if(['error','warning'].includes(message.type())) problems.push(`${message.type()}: ${message.text()}`);});
 page.on('pageerror',error=>problems.push(`pageerror: ${error.message}`));
 await page.addInitScript(()=>{window.print=()=>{window.__testPrintCount=(window.__testPrintCount??0)+1;};});
 await page.goto(origin);
 console.log('synthetic page loaded');
 await page.getByRole('navigation').getByRole('button',{name:'工作說明書'}).click();
 console.log('overview opened');
 assert.equal(await page.getByRole('table',{name:'工作說明書總覽'}).locator('thead th').count(),8);
 await page.getByRole('button',{name:'TEST-001',exact:true}).click();
 await page.getByText('審核者：測試審核者',{exact:true}).waitFor();
 const tagColors = () => page.locator('#section-requirements .competency-tag').evaluateAll(tags => tags.map(tag => getComputedStyle(tag).backgroundColor));
 assert.deepEqual(await tagColors(), ['rgb(230, 241, 252)', 'rgb(255, 242, 214)', 'rgb(230, 244, 236)']);
 await page.emulateMedia({media:'print'});
 assert.deepEqual(await tagColors(), ['rgb(230, 241, 252)', 'rgb(255, 242, 214)', 'rgb(230, 244, 236)']);
 await page.emulateMedia({media:'screen'});
 await page.getByRole('button',{name:/歷史版本（/}).click();
 await page.getByRole('heading',{name:'版本歷程'}).waitFor();
 await page.getByRole('button',{name:'列印／另存 PDF',exact:true}).click();
 await page.waitForFunction(()=>window.__testPrintCount===1);
 await page.getByRole('button',{name:'編輯草稿',exact:true}).click();
 await page.getByLabel('審核者',{exact:true}).fill('僅測試不儲存');
 await page.getByRole('button',{name:'← 取消編輯',exact:true}).click();
 await page.getByRole('button',{name:'← 返回工作說明書',exact:true}).click();
 await page.getByRole('button',{name:'測試職務：已關聯 1 職位',exact:true}).click();
 await page.getByRole('button',{name:'查看職位',exact:true}).click();
 await page.getByRole('heading',{name:'測試職位',exact:true}).first().waitFor();
 await page.getByRole('button',{name:'← 返回組織圖',exact:true}).click();
 for(const name of ['人員盤點','職能盤點','工作說明書']) await page.getByRole('navigation').getByRole('button',{name}).click();
 await page.locator('.locale-switcher select').selectOption('zh-Hans');
 await page.getByRole('table',{name:'工作说明书总览'}).waitFor();
 await page.getByPlaceholder('代码、职务名称或部门').fill('测试');
 await page.getByRole('button',{name:'TEST-001',exact:true}).click();
 await page.getByText('审核者：测试审核者',{exact:true}).waitFor();
 await page.getByRole('button',{name:'← 返回工作说明书',exact:true}).click();
 await page.locator('.locale-switcher select').selectOption('zh-Hant');
 await page.getByRole('table',{name:'工作說明書總覽'}).waitFor();
 if (process.env.VT_BROWSER_SCREENSHOT) await page.screenshot({path:process.env.VT_BROWSER_SCREENSHOT,fullPage:true});
 assert.deepEqual(blocked,[],'unexpected network or file requests');
 assert.deepEqual(problems,[],'browser errors or warnings');
 assert.ok(requests.some(path=>path.includes('chinese-dictionary')),'data dictionary loaded');
 console.log(JSON.stringify({passed:true,consoleErrorsAndWarnings:problems,blockedNetworkRequests:blocked,checks:['dashboard','eight-column overview','document','history','print trigger','edit/cancel','relations','organization','people','competencies','Simplified Chinese search and navigation','Traditional Chinese restoration'],data:'fabricated only; no HR database or localhost accessed'}));
} catch(error) {console.log(JSON.stringify({problems,blocked,requests}));for(const context of browser.contexts()) for(const page of context.pages()) console.log((await page.locator('body').innerText()).slice(0,2800));throw error;} finally {await browser.close();}
