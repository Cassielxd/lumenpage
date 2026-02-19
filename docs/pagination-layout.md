# 閸掑棝銆夌敮鍐ㄧ湰闁槒绶拠瀛樻

閺堫剚鏋冨锝堫嚛閺?`view-canvas` 閻ㄥ嫬鍨庢い闈涚鐏炩偓濞翠胶鈻奸妴浣稿彠闁款喗鏆熼幑顔剧波閺嬪嫨鈧礁顤冮柌蹇擃槻閻劎鐡ラ悾銉ょ瑢閸掑棝銆夐幏鍡楀瀻鐟欏嫬鍨妴?
## 1. 閸忋儱褰涙稉搴ｆ窗閺?
閸掑棝銆夌敮鍐ㄧ湰閻ㄥ嫭鐗宠箛鍐ㄥ弳閸欙絽婀?`LayoutPipeline.layoutFromDoc`閿涘瞼娲伴弽鍥ㄦЦ閹?ProseMirror 閺傚洦銆傛潪顒佸床娑撳搫鍨庢い闈涙倵閻?`pages/lines` 缂佹挻鐎敍灞肩返濞撳弶鐓嬬仦鍌涘瘻妞ょ數绮崚韬测偓?
- 閸忋儱褰涢敍姝歱ackages/view-canvas/src/layout-pagination/engine.ts`
  - `layoutFromDoc(doc, options)`閿涙矮瀵岄崗銉ュ經閿涘本鏁幐浣割杻闁插繐顦查悽銊ｂ偓?  - `layoutFromRuns(runs, totalLength)`閿涙氨娲块幒銉ょ矤 runs 閺傤叀顢戦崚鍡涖€夐妴?  - `layoutFromText(text)`閿涙氨鍑介弬鍥ㄦ拱閸忋儱褰涢敍鍫濆敶闁劏铔?runs閿涘鈧?
## 2. 鏉堟挸鍙嗘稉搴濈贩鐠?
### 2.1 settings閿涘牆鍨庢い闈涘棘閺佸府绱?閻?`CanvasConfig` 閹存牕顦婚柈銊︽暈閸忋儻绱濋崗鎶芥暛鐎涙顔岄敍?
- `pageWidth / pageHeight`閿涙岸銆夌€?妞ょ敻鐝妴?- `pageGap`閿涙岸銆夐梻纾嬬獩閵?- `margin`閿涙岸銆夋潏纭呯獩閿涘潤eft/right/top/bottom閿涘鈧?- `lineHeight / font`閿涙岸绮拋銈堫攽妤?鐎涙ぞ缍嬮妴?- `measureTextWidth`閿涙碍鏋冮張顒佺ゴ闁插繐鍤遍弫甯礄閺傤叀顢戣箛鍛存付閿涘鈧?- `wrapTolerance / minLineWidth`閿涙碍鏌囩悰灞筋啇闁挎瑥寮弫鑸偓?- `segmentText`閿涙艾褰查柅澶婂瀻鐠囧秴鍤遍弫甯礄娑擃厽鏋冮幋鏍ь槻閺夊倹鏌囩拠宥嗘娴ｈ法鏁ら敍澶堚偓?
### 2.2 registry閿涘牐濡悙瑙勮閺屾挸娅掑▔銊ュ斀鐞涱煉绱?濞撳弶鐓嬮崳銊ュ帒鐠佹瓕濡悙纭呭殰鐎规矮绠?runs/鐢啫鐪?閸掑棝銆夐幏鍡楀瀻闁槒绶敍?
- `toRuns(node, settings)`閿涙俺绶崙?runs閵?- `layoutBlock({ node, settings, availableHeight, ... })`閿涙俺绶崙鍝勬健缁狙冪鐏炩偓缂佹挻鐏夐妴?- `allowSplit / splitBlock`閿涙碍甯堕崚鎯版硶妞ゅ灚濯堕崚鍡愨偓?- `getContainerStyle`閿涙艾顔愰崳銊ㄥΝ閻愬湱娈戠紓鈺勭箻/閺嶅嘲绱￠妴?
## 3. 閺嶇绺鹃弫鐗堝祦缂佹挻鐎?
### 3.1 Run閿涘牊鏋冮張顒冪箥鐞涘矉绱?娴ｅ秳绨?`packages/view-canvas/src/layout-pagination/textRuns.ts`閿?
- `text`閿涙碍鏋冮張顒€鍞寸€瑰箍鈧?- `start / end`閿涙艾婀弫缈犵秼閺傚洦婀版稉顓犳畱閸嬪繒些閼煎啫娲块妴?- `style`閿涙艾鐡ф担鎾扁偓渚€顤侀懝灞傗偓浣风瑓閸掓帞鍤庣粵澶堚偓?- `blockType / blockId / blockAttrs / blockStart`閿涙碍澧嶇仦鐐叉健娣団剝浼呴妴?- `break` 缁鐎烽敍姘炽€冪粈鍝勬健娑斿妫块惃鍕▔瀵繑鏌囩悰灞烩偓?
### 3.2 Line閿涘牐顢戦敍?閻㈣鲸鏌囩悰灞芥珤閻㈢喐鍨氶敍?
- `text / width / runs`閿涙俺顢戦弬鍥ㄦ拱娑撳骸顔旀惔锔衡偓?- `start / end`閿涙俺顢戦崷銊ュ弿鐏炩偓閺傚洦婀伴惃鍕焊缁夋槒瀵栭崶娣偓?- `x / y`閿涙俺顢戦崷銊┿€夐棃銏犲敶閻ㄥ嫬娼楅弽鍥モ偓?- `blockType / blockId / blockAttrs`閿涙艾娼℃穱鈩冧紖閵?- `containers`閿涙艾顔愰崳銊︾垽閿涘牏鏁ゆ禍搴＄サ婵傛缂夋潻?濞撳弶鐓嬮敍澶堚偓?
### 3.3 Page / LayoutResult

- `pages`: `[{ index, lines }]`
- `totalHeight`: 閹碘偓閺堝銆夐惃鍕彯鎼达讣绱欓崥顐︺€夐梻纾嬬獩閿?- 閸忔湹缍戠€涙顔岄弶銉ㄥ殰 `settings`閿涘潷ageWidth/pageHeight/margin 缁涘绱氶妴?
## 4. 娑撶粯绁︾粙瀣剁礄layoutFromDoc閿?
### 4.1 婢х偤鍣虹敮鍐ㄧ湰娑撳骸顦查悽?瑜版挷绱堕崗?`previousLayout` 閸?`changeSummary` 閺冭绱濇导姘毦鐠囨洖顦查悽銊︽弓閸欐ê瀵查惃鍕€夐棃顫窗

1. 閺嶈宓?`changeSummary.blocks.before/after` 鐎规矮缍呴崣妯绘纯閸栨亽鈧?2. 闁俺绻?`docPosToTextOffset` + `findBlockAnchor` 閹垫儳鍩岄弮褍绔风仦鈧柨姘卞仯閵?3. 娴犲酣鏁嬮悙鐟邦槱瀵偓婵鍣搁弬鏉跨鐏炩偓閿涘本妫敮鍐ㄧ湰閻ㄥ嫬澧犻崡濠囧劥閸掑棛娲块幒銉ヮ槻閻劊鈧?4. 瑜版捇銆夌痪褏顒烽崥宥勭閼峰瓨妞傞敍灞戒粻濮濄垹绔风仦鈧獮璺侯槻閻劌鎮楃紒顓€夐棃顫偓?
閸忔娊鏁悙鐧哥窗

- 閸欘亝婀?`settings` 鐎瑰苯鍙忔稉鈧懛瀛樺閸忎浇顔忔径宥囨暏閵?- 婢跺秶鏁ら崚銈嗘焽閸╄桨绨?閳ユ粓銆夌粵鎯ф倳 + 鐞涘本鏆熼垾婵勨偓?
鐎电懓绨叉禒锝囩垳閿涙瓪packages/view-canvas/src/layout-pagination/engine.ts`閵?
### 4.2 閺嬪嫬缂?runs
閺傚洦銆傜悮顐ユ祮閹诡澀璐?runs閿?
- `docToRuns` 闁秴宸婚弽鍦獓閸ф绱濈紒瀛樺Б閸忋劌鐪?offset閵?- 閺傚洦婀伴崸妤勮泲 `textblockToRuns`閿涘矂娼弬鍥ㄦ拱閸ф褰茬挧?`renderer.toRuns`閵?- 閸фぞ绠ｉ梻瀛樺絻閸?`break` run 娴ｆ粈璐熷▓浣冩儰闂傛挳娈ч妴?
鐎电懓绨叉禒锝囩垳閿涙瓪packages/view-canvas/src/layout-pagination/textRuns.ts`閵?
### 4.3 閺傤叀顢戦敍鍧唕eakLines閿?閺傤叀顢戦崳銊︾壌閹诡喗绁撮柌蹇撳毐閺佹澘鐨?runs 閹峰棙鍨氱悰宀嬬窗

- 閺€顖涘瘮 `segmentText` 閼奉亜鐣炬稊澶婂瀻鐠囧秲鈧?- 鐎甸€涚艾鐡掑懘鏆?token閿涘奔绱伴柅鎰摟閹峰棗鍨庨妴?- 濮ｅ繗顢戞穱婵堟殌 `start/end/runs` 娴犮儰绌堕崥搴ｇ敾閺勭姴鐨犻妴?
鐎电懓绨叉禒锝囩垳閿涙瓪packages/view-canvas/src/layout-pagination/lineBreaker.ts`閵?
### 4.4 閸欒泛鐡欓崸妤€绔风仦鈧敍鍧檃youtLeafBlock閿?濮ｅ繋閲滈崣顖氱鐏炩偓閻ㄥ嫬娼￠敍鍫濆骄鐎涙劖鍨ㄩ懛顏勭暰娑斿娼￠敍澶夌窗鐞氼偉娴嗛幑顫礋鐞涘矉绱?
1. 娴兼ê鍘涙担璺ㄦ暏 `renderer.layoutBlock`閵?2. 閸氾箑鍨挧?`renderer.toRuns` 閹存牠绮拋?runs 閳?`breakLines`閵?3. 鐠侊紕鐣婚崸妤冩畱 `height/length/lineHeight`閵?4. 缂傛挸鐡ㄩ敍姝歜lockCache` 閹?`blockId + indent` 婢跺秶鏁ら妴?
### 4.5 閸掑棝銆夋稉搴㈠閸?閸掑棝銆夐弽绋跨妇瀵邦亞骞嗛崷?`layoutLeafBlock` 閸愬拑绱?
- 鐠侊紕鐣?`availableHeight`閵?- 閼汇儱娼￠崜鈺€缍戞妯哄鐡掑懓绻冭ぐ鎾冲妞ら潧澧挎担娆撶彯鎼达讣绱?  - 閼汇儱鍘戠拋鍛婂閸掑棴绱版导妯哄帥鐠嬪啰鏁?`splitBlock`閵?  - 閸氾箑鍨幐澶庮攽閺佺増濯堕崚鍡礄`maxLines`閿涘鈧?  - 閸掑洨澧栭弮鍓佹暏瑜版挸澧犻崚鍥╁閻?`start/end` 鐠侊紕鐣?`visibleLength`閵?- 鐏忓棗褰茬憴浣筋攽閸愭瑥鍙嗚ぐ鎾冲妞ょ绱濋悞璺烘倵 `finalizePage()` 閸掓稑缂撻弬浼淬€夐妴?- 閼汇儴绻曢張澶婂⒖娴ｆ瑨顢戦敍宀€鎴风紒顓炴躬閺備即銆夐弨鍓х枂閵?
閸忔娊鏁穱顔碱槻閻愮櫢绱?
- 娑撳秴鍟€鐟曚焦鐪?閳ユ粓銆夐崘鍛嚒閺堝鍞寸€瑰厜鈧?閹靛秷鍏橀幏鍡楀瀻閿涘瞼鈹栭惂浠嬨€夋稊鐔峰帒鐠佸憡濯堕崚鍡愨偓?- `visibleLength` 閻劌缍嬮崜宥呭瀼閻楀洨娈?`start/end` 鐠侊紕鐣婚敍宀勪缉閸忓秷娉曟径姘躲€夐幏鍡楀瀻閺冭泛浜哥粔濠氭晩鐠囶垬鈧?
鐎电懓绨叉禒锝囩垳閿涙瓪packages/view-canvas/src/layout-pagination/engine.ts`閵?
### 4.6 鐎圭懓娅掓稉搴＄サ婵傛缂夋潻?閺€顖涘瘮鐎圭懓娅掗懞鍌滃仯閿涘牆顩?blockquote閿涘绱?
- `walkBlocks` 闁帒缍婇柆宥呭坊鐎涙劘濡悙骞库偓?- `getContainerStyle` 閻㈢喐鍨氱紓鈺勭箻娑撳骸顔愰崳銊︾壉瀵繈鈧?- `containerStack` 閸愭瑥鍙嗛崚鐗堢槨鐞涘矉绱濆〒鍙夌厠闂冭埖顔岄崣顖滄暰鐎圭懓娅掗懗灞炬珯閹存牞绔熷鍡愨偓?
鐎电懓绨叉禒锝囩垳閿涙瓪packages/view-canvas/src/layout-pagination/engine.ts`閵?
### 4.7 閸掓銆冪敮鍐ㄧ湰閿涘牊婀佹惔?閺冪姴绨敍?閸掓銆冮懞鍌滃仯娴ｈ法鏁ら崡鏇犲閻ㄥ嫬绔风仦鈧柅鏄忕帆閿?
- 閺嶈宓?marker 閺傚洦婀扮€硅棄瀹崇拋锛勭暬閸欘垳鏁ら崘鍛啇鐎硅棄瀹抽妴?- 濮ｅ繋閲?`list_item` 閸忓牆浠?runs閿涘苯鍟€閺傤叀顢戦妴?- 鐞涘矂顩婚崘娆忓弳 `listMarker`閿涘本瑕嗛弻鎾绘▉濞堢數绮崚鍓佺椽閸?閸﹀棛鍋ｉ妴?
鐎电懓绨叉禒锝囩垳閿涙瓪packages/node-list/src/index.ts`閵?
## 5. 閸忔娊鏁潏鍦櫕娑撳氦顢戞稉楦款嚛閺?
- 缁屽搫娼￠敍姘冲閺傤叀顢戠紒鎾寸亯娑撹櫣鈹栭敍灞肩窗濞夈劌鍙嗘稉鈧稉顏嗏敄鐞涘矉绱濇穱婵婄槈妞ょ敻娼版禒宥嗘箒閸欘垰绔风仦鈧崘鍛啇閵?- 閺堚偓閸氬簼绔存い纰夌窗閼汇儱绔风仦鈧紒鎾存将閺?`page.lines` 闂堢偟鈹栭敍灞肩窗鏉╄棄濮為崚?`pages`閵?- 婢跺秶鏁ゆ稉顓熸焽閿涙俺瀚㈡い鐢殿劮閸氬秳绗夋稉鈧懛杈剧礉閸掓瑧鎴风紒顓燁劀鐢绔风仦鈧惄鏉戝煂閺傚洦銆傞張顐㈢啲閵?- 婢堆冩健鐠恒劌顦挎い纰夌窗閸︺劎鈹栭惂鑺ユ煀妞ゅ吀绡冮崗浣筋啅閹峰棗鍨庨敍灞肩箽鐠囦礁褰叉潻鐐电敾閸掑棝銆夐妴?
## 6. 閻╃鍙ч弬鍥︽濞撳懎宕?
- `packages/view-canvas/src/layout-pagination/engine.ts`
- `packages/view-canvas/src/layout-pagination/lineBreaker.ts`
- `packages/view-canvas/src/layout-pagination/textRuns.ts`
- `packages/node-list/src/index.ts`

婵″倿娓剁悰銉ュ帠閺囨潙顦垮〒鍙夌厠娓氀呯矎閼哄偊绱欐笟瀣洤妞ら潧鐪?Canvas 缂佸嫮绮愰妴渚€鈧灏弰鐘茬殸娑撳氦绶崗銉ョ湴鐎规矮缍呴敍澶涚礉閸涘﹨鐦旈幋鎴濆晙鐞涖儰绔存禒鑺ヨ閺屾捁顕╅弰搴㈡瀮濡楋絻鈧?

## 7. Web Worker 鍒嗛〉锛堝彲閫夛級

涓洪伩鍏嶉灞忔垨澶ф枃妗ｉ樆濉炰富绾跨▼锛屽彲灏嗘柇琛?鍒嗛〉鏀惧叆 Web Worker銆備富绾跨▼鍙礋璐ｆ覆鏌撲笌杈撳叆鍝嶅簲銆?
- Worker 绔細鍒涘缓鑷繁鐨?`LayoutPipeline`锛屽苟缂撳瓨 `previousLayout` 浠ュ鐢ㄥ閲忓竷灞€銆?- 闇€瑕佸彲鐢ㄧ殑 `OffscreenCanvas`锛屽惁鍒欎細鍥為€€鍒颁富绾跨▼甯冨眬銆?- 涓轰簡鍦?Worker 涓鐢ㄨ妭鐐瑰竷灞€閫昏緫锛岄渶瑕佹彁渚涘彲瀵煎叆鐨勬ā鍧楋紙渚嬪 `lumenpage-kit-basic`锛夈€?
### 7.1 CanvasConfig 閰嶇疆绀轰緥

```ts
canvasConfig: {
  layoutWorker: {
    enabled: true,
    modules: ["lumenpage-kit-basic"],
  },
}
```

### 7.2 Worker 渚濊禆绾﹀畾

Worker 浼氫粠 `modules` 涓鎵句互涓嬪鍑猴細

- `schema`: ProseMirror Schema锛堢敤浜?`nodeFromJSON`锛夈€?- `registerNodeRenderers(registry)` 鎴?`createDefaultNodeRendererRegistry()`锛氭敞鍐岃妭鐐瑰竷灞€娓叉煋鍣ㄣ€?
濡傛灉妯″潡鏈彁渚?schema 鎴栨敞鍐屽櫒锛學orker 灏嗘棤娉曞垵濮嬪寲鎴栦細鍥為€€鍒颁富绾跨▼甯冨眬銆?### 7.3 Worker 澧為噺姝ラ妯″紡

褰撳紑鍚?Worker 涓旀枃妗ｈ妯¤緝澶ф椂锛屼富绾跨▼浼氫紭鍏堝彂閫?steps锛堝彉鏇存楠わ級锛岃€屼笉鏄瘡娆″彂閫佹暣浠?doc JSON銆?
- Worker 棣栨鏀跺埌 doc 鏃跺缓绔嬪唴閮?currentDoc銆?- 鍚庣画鍙彂閫?steps锛學orker 鐢?Step.apply 鐢熸垚鏂?doc銆?- 鑻?steps 澶辫触鎴栦涪澶憋紝鍥為€€涓哄彂閫佸畬鏁?doc銆?