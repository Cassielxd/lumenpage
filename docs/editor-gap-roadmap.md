# LumenPage 瀹屾暣缂栬緫鍣ㄥ樊璺濅笌琛ラ綈璺嚎鍥?
## 鐩爣

鎶婂綋鍓?Canvas 缂栬緫鍣ㄤ粠鈥滃彲鐢ㄢ€濇彁鍗囧埌鈥滅ǔ瀹氬彲浜や粯鈥濓紝浼樺厛淇濊瘉浜や簰涓€鑷存€т笌鍥炲綊鍙帶銆?
## 褰撳墠闃舵锛?026-02锛?
- 宸插畬鎴愪竴鎵规牳蹇冮噸鏋勶細`EditorView` 鎷嗗垎銆佹椿鍔ㄥ潡閫変腑鎻掍欢鍖栥€佹嫋鎷藉彞鏌勬彃浠跺寲銆丄4 鐢诲竷鏍峰紡钀藉湴銆?- 褰撳墠閲嶇偣杞叆鈥滆ˉ榻愯涓?+ 寤虹珛鍥炲綊鍩虹嚎鈥濄€?
## P0 娓呭崟锛堝繀椤伙級

1. 杈撳叆娉曚笌閫夊尯绋冲畾鎬?- 楠屾敹鏍囧噯锛?  - 涓枃 IME 杈撳叆鏃跺厜鏍囦笉涓㈠け銆佷笉璺冲潡銆?  - 璺ㄦ钀?璺ㄨ妭鐐归€夊尯鍚庯紝缁х画杈撳叆涓庡垹闄よ涓虹ǔ瀹氥€?  - NodeSelection 涓?TextSelection 鍒囨崲鏃犻棯鐑併€佹棤閿欎綅銆?
2. 鎷栨嫿涓庨€夋嫨涓€鑷存€?- 楠屾敹鏍囧噯锛?  - 鏂囨湰鎷栨嫿鍙Щ鍔紝drop 浣嶇疆鍑嗙‘銆?  - 鍧楁嫋鎷斤紙鍚浘鐗?瑙嗛锛夊彲绉诲姩涓斾笉浼氳Е鍙戦敊璇€夊尯璺宠浆銆?  - 鎷栨嫿鍙ユ焺鍙湪 hover 鏃舵樉绀猴紝浣嶇疆宸﹀榻愪竴鑷淬€?
3. 琛ㄦ牸琛屼负琛ラ綈
- 楠屾敹鏍囧噯锛?  - Enter/Backspace/Delete 涓庨鏈熶竴鑷达紝涓嶅嚭鐜板紓甯稿悎骞躲€?  - 琛屽垪澧炲垹銆佸悎骞舵媶鍒嗐€佽寖鍥撮€夊尯鍙繛缁墽琛屻€?  - 宸ュ叿鏍忕姸鎬佷笌褰撳墠琛ㄦ牸閫夊尯鐘舵€佷竴鑷淬€?
4. 鍒楄〃琛屼负琛ラ綈
- 楠屾敹鏍囧噯锛?  - Enter 鍒涘缓涓嬩竴椤癸紝绌洪」 Enter 閫€鍑哄垪琛ㄣ€?  - Backspace 鍦ㄧ┖椤逛笂鍥為€€灞傜骇锛屽啀娆″洖閫€杞钀姐€?  - 鍚屼竴娈佃惤鍙湪鏈夊簭/鏃犲簭鍒楄〃涔嬮棿姝ｇ‘鍒囨崲銆?
5. 鑷姩鍖栧洖褰掑熀绾?- 楠屾敹鏍囧噯锛?  - 鑷冲皯鍖呭惈琛ㄦ牸銆佸垪琛ㄣ€佸潡瀹瑰櫒鍑犱綍 3 绫?smoke銆?  - 姣忔鏀瑰姩鍙揩閫熸墽琛屽苟浜у嚭 PASS/FAIL 鏄庣‘缁撹銆?  - `allSmoke` 姹囨€诲凡鏀逛负涓茶绛夊緟寮傛 smoke锛堝惈 markdown I/O锛夛紝閬垮厤缁熻鎻愬墠缁撴潫銆?
## P1 娓呭崟锛堜骇鍝佸寲锛?
1. 绮樿创/瀵煎叆/瀵煎嚭淇濈湡銆?2. 鍘嗗彶涓庡崗浣滃啿绐佺瓥鐣ャ€?3. 鍙/鏉冮檺/璇勮鎬併€?4. 閾炬帴涓庤鍐呰涔変氦浜掔粺涓€銆?5. 绉诲姩绔Е鎺т綋楠屻€?
## P2 娓呭崟锛堣妯″寲锛?
1. 澶ф枃妗ｅ帇娴嬩笌鎬ц兘棰勭畻銆?2. 鏃犻殰纰嶄笌鍥介檯鍖栥€?3. 瀹夊叏娌荤悊绛栫暐銆?4. 鎻掍欢鐢熸€佽鑼冧笌绀轰緥銆?
## 宸插紑濮嬬殑绗竴鎵瑰畬鍠?
- 鏂板 Playground 鍥炲綊寮€鍏筹細
  - `p0Smoke=1`锛堜粎鎵ц P0 蹇呴渶瀛愰泦锛屽揩閫熷洖褰掞級
  - `allSmoke=1`锛堜竴閿墽琛屽叏濂楋級
  - `tableSmoke=1`
  - `tableBehaviorSmoke=1`
  - `listSmoke=1`
  - `listBehaviorSmoke=1`
  - `blockOutlineSmoke=1`
  - `dragSmoke=1`
  - `dragActionSmoke=1`
  - `selectionImeSmoke=1`
  - `imeActionSmoke=1`
  - `selectionBoundarySmoke=1`
  - `toolSmoke=1`
  - `pasteSmoke=1`
  - `historySmoke=1`
  - `mappingSmoke=1`
  - `coordsSmoke=1`
  - `scrollSmoke=1`
  - `readonlySmoke=1`
  - `docRoundtripSmoke=1`
  - `htmlIoSmoke=1`
  - `markdownIoSmoke=1`
  - `linkSmoke=1`
  - `perfBudgetSmoke=1`
- 鏂板 `blockOutlineSmoke`锛岀敤浜庢鏌?`code_block` 鍜?`blockquote` 鐨勫潡瀹瑰櫒鍑犱綍涓€鑷存€э紝鎻愬墠鍙戠幇鈥滈€変腑妗嗕笌鍙鍧楅敊浣嶁€濋棶棰樸€?- 鏍稿績瑙嗗浘鏂板鍩虹鏂囨。 I/O API锛歚getJSON / setJSON / getTextContent`锛屼负瀵煎叆瀵煎嚭涓庢ā鏉胯兘鍔涙彁渚涚粺涓€鍏ュ彛銆?- 鏉冮檺鎺у埗閲囩敤鎻掍欢 `filterTransaction`锛屾牳蹇冭鍥惧眰涓嶅紩鍏ヤ笟鍔℃潈闄愯€﹀悎銆?
## 浣跨敤鏂瑰紡

```txt
http://localhost:5173/?devTools=1&tableSmoke=1&tableBehaviorSmoke=1&listSmoke=1&listBehaviorSmoke=1&blockOutlineSmoke=1&dragSmoke=1&dragActionSmoke=1&selectionImeSmoke=1&imeActionSmoke=1&selectionBoundarySmoke=1&toolSmoke=1&pasteSmoke=1&historySmoke=1&mappingSmoke=1&coordsSmoke=1&scrollSmoke=1&readonlySmoke=1&docRoundtripSmoke=1&markdownIoSmoke=1

鎴栵細

http://localhost:5173/?devTools=1&allSmoke=1

鎴栵紙P0 蹇€熷洖褰掞級锛?
http://localhost:5173/?devTools=1&p0Smoke=1

或（P2 性能预算）：
http://localhost:5173/?devTools=1&perfBudgetSmoke=1
```

鍦ㄨ皟璇曢潰鏉挎垨鎺у埗鍙版煡鐪嬶細

- `[table-smoke] PASS|FAIL`
- `[table-behavior-smoke] PASS|FAIL`
- `[list-smoke] PASS|FAIL`
- `[list-behavior-smoke] PASS|FAIL`
- `[block-outline-smoke] PASS|FAIL`
- `[drag-smoke] PASS|FAIL`
- `[drag-action-smoke] PASS|FAIL`锛堟枃鏈笌濯掍綋鑺傜偣鎷栨嫿锛?- `[selection-ime-smoke] PASS|FAIL`
- `[ime-action-smoke] PASS|FAIL`
- `[selection-boundary-smoke] PASS|FAIL`
- `[tool-smoke] PASS|FAIL`
- `[paste-smoke] PASS|FAIL`
- `[history-smoke] PASS|FAIL`
- `[mapping-smoke] PASS|FAIL`
- `[coords-smoke] PASS|FAIL`
- `[scroll-smoke] PASS|FAIL`
- `[readonly-smoke] PASS|FAIL`
- `[doc-roundtrip-smoke] PASS|FAIL`
- `[html-io-smoke] PASS|FAIL`
- `[markdown-io-smoke] PASS|FAIL`
- `[link-smoke] PASS|FAIL`
- `[perf-budget-smoke] PASS|FAIL`
- `[all-smoke-summary] total=... pass=... fail=...`
- `[p0-smoke-summary] total=... pass=... fail=...`
  - `p0Smoke` 浼氭牎楠?P0 蹇呴渶椤规槸鍚︽紡璺戯紝婕忚窇浼氬湪 summary 鐨?`missing=[...]` 涓粰鍑恒€?

