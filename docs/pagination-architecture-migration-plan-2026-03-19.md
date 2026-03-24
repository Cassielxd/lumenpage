# Pagination Architecture Migration Plan (2026-03-19)

## Ŀ��

�ѵ�ǰ���ڵ�ͬʱ�����������ҳ�и��Ⱦ����Э�飬��Ǩ��Ϊ��

- `measure`: ֻ�����������ģ��
- `paginate`: ֻ�������ҳԼ���������α��г���ǰҳ
- `render`: ֻ������Ʒ�ҳ���

Ǩ�Ʊ�����������Լ����

- ��Э��������ã�����һ������д���нڵ�
- `pos` ֻ�����ĵ�ê�㡢����ʧЧ������ӳ��
- �����ķ�ҳ���ű�������ͳһ `cursor`
- `table` �ǵ�һ�����ӽڵ��Ե�
- `cell -> nested table` ������Ϊ�������ճ���֮һ

## ��ǰ����

��ǰ�ڵ�Э�鼯���� [packages/engine/render-engine/src/node.ts](/E:/workespace/2026/nodejs/lumenpage/packages/engine/render-engine/src/node.ts)��

- `layoutBlock`
- `splitBlock`
- `renderLine`
- `renderFragment`

�������ڣ�

1. �����ͷ�ҳ��ϣ����ӽڵ�ֻ���ڽڵ��ڲ�Ӳ������ҳ�߼���
2. `table` �ڲ��ݹ鲼�ֺ�����ҳ��ϣ�`cell` ��ĸ��������ᱻ��ѹ�ɸ߶ȡ�
3. `pos` �� continuation �����ڶ���ֶ��У�������ҳ�� page reuse ��״̬���ﲻͳһ��
4. render �㲻�ò������ҳ�м�̬�����׺� overlay/page cache ���ֲ�ͬ����

## ����Ŀ��ܹ�

### 1. Measure

����ڵ�������� `MeasuredLayoutModel`��

- �ڵ� `startPos/endPos`
- ���α߽�
- �Ӳ���ģ��
- �ɶϵ���Ϣ
- �ڵ�Ԫ����

### 2. Paginate

���� `MeasuredLayoutModel + page constraint + cursor`�������

- ��ǰҳ `PaginatedSlice`
- ��һҳ `nextCursor`

### 3. Render

���� `PaginatedSlice`��ֻ���ƣ�

- page surface fragments
- layout boxes
- overlay anchors

## ��������

�����������������ǰ continuation ���

```ts
type FragmentCursor = {
  nodeId: string | null;
  startPos: number;
  endPos: number;
  path?: Array<string | number>;
  localCursor?: unknown;
};

type MeasuredLayoutModel = {
  kind: string;
  nodeId: string | null;
  startPos: number;
  endPos: number;
  width: number;
  height: number | null;
  children?: MeasuredLayoutModel[];
  breakpoints?: unknown[];
  meta?: Record<string, unknown> | null;
};

type PaginatedSlice = {
  kind: string;
  nodeId: string | null;
  startPos: number;
  endPos: number;
  fromPrev: boolean;
  hasNext: boolean;
  rowSplit?: boolean;
  boxes: unknown[];
  fragments: unknown[];
  nextCursor?: FragmentCursor | null;
  meta?: Record<string, unknown> | null;
};
```

## ִ�н׶�

### �׶� 0������߽�

Ŀ�꣺

- �������սӿڷ���
- ����Ǩ��˳��
- ������ֱ����д `table`

�����

- ���ĵ�

���գ�

- ����ȷÿ�׶θ���Щ�ļ�
- ����ȷ��Щ�ع������ĸ��׶�

### �׶� 1������Э�飬������Ϊ

Ŀ�꣺

- ���� `measure/paginate/render` ���ͺͽӿ�
- ��Э���������
- ���ı��κ����в�����Ϊ

�漰�ļ���

- [packages/engine/render-engine/src/node.ts](/E:/workespace/2026/nodejs/lumenpage/packages/engine/render-engine/src/node.ts)
- [packages/engine/render-engine/src/index.ts](/E:/workespace/2026/nodejs/lumenpage/packages/engine/render-engine/src/index.ts)

�����

- `FragmentCursor`
- `MeasuredLayoutModel`
- `PaginatedSlice`
- `measureBlock`
- `paginateBlock`
- `renderSlice`

���գ�

- ȫ�����͵�������
- �ɽڵ�ʵ����Ķ�Ҳ�ܼ�������

### �׶� 2����Э����ݲ�

Ŀ�꣺

- �� adapter �Ѿ� `layoutBlock/splitBlock` ������Э��

�漰�ļ���

- [packages/engine/render-engine/src/index.ts](/E:/workespace/2026/nodejs/lumenpage/packages/engine/render-engine/src/index.ts)

�����

- continuation -> cursor ��ͳһת�����

���գ�

- paragraph/image/codeBlock ����ʵ��Ҳ�ܹҵ���Э�����

### �׶� 3����ҳ����֧��˫Э��

Ŀ�꣺

- `layout-engine` ��������Э��
- ûǨ�ƵĽڵ��Զ����䵽 legacy adapter

�漰�ļ���

- [packages/engine/layout-engine/src/engine/layoutTraversal.ts](/E:/workespace/2026/nodejs/lumenpage/packages/engine/layout-engine/src/engine/layoutTraversal.ts)
- [packages/engine/layout-engine/src/engine/layoutLeafTraversal.ts](/E:/workespace/2026/nodejs/lumenpage/packages/engine/layout-engine/src/engine/layoutLeafTraversal.ts)

���գ�

- �¾ɽڵ��ܻ���
- ���з�ҳ�ع鲻����

### �׶� 4��Ǩ�Ƽ򵥽ڵ�

Ǩ��˳��

1. paragraph
2. image
3. codeBlock

Ŀ�꣺

- ��֤������ͷ�ҳģʽ

���գ�

- paragraph�����ı���ҳ��ɾ�������ȶ�
- image�������ҳ�ͻ����ȶ�
- codeBlock�����Ӿ��п�ҳ�ȶ�

### �׶� 5��Ǩ�� table ��һ�׶�

Ŀ�꣺

- `table` ���ؽṹ������ģ�ͣ����ٳ���ѹƽ�ɱ�ƽ line ����
- �ȱ�����table ��ͳһ��ҳ��

�漰�ļ���

- [packages/engine/render-engine/src/defaultRenderers/table.ts](/E:/workespace/2026/nodejs/lumenpage/packages/engine/render-engine/src/defaultRenderers/table.ts)

���գ�

- ���з�ҳ�ȶ�
- ���г�ҳ�ȶ�
- cell �ڶ�����ȶ�

### �׶� 6��֧�� nested table ��ʵ�ݹ��ҳ

Ŀ�꣺

- `cell` ��� nested table ����Ϊ child layout model
- ����� row ��ҳʱ���������� cell child model ����

���գ�

- `cell -> nested table` �ɿ�ҳ
- ɾ�������ȶ�
- �ڲ� table continuation ���ᱻ��� table ����

## �ع����

ÿ�׶ζ����벹�ع飬�������һ�𲹡�

### ����

- paragraph ���ı���ҳ
- paragraph ɾ������
- image ������һҳ
- image ������һҳ

### Table

- ���б����ҳ
- ���г�ҳ 1-N ҳ
- �� cell �����س����ɶ����
- ɾ������

### Nested

- `cell -> nested paragraph/list/codeBlock`
- `cell -> nested table`
- nested table ��ҳ���������
- nested table ɾ������

## ��Ҫ������

- ��Ҫֱ����д���� renderer
- ��Ҫֻ�� `pos` �����ҳ�е�
- ��Ҫ�ȸ� render �ٸ� paginate
- ��Ҫ�ڽ׶� 1 �ʹ��� `rowspan/colspan + nested table`

## ��ǰִ��˳��

��ǰ������˳���ƽ���

1. ��ɱ��ĵ�������Ǩ�Ʊ߽�
2. ִ�н׶� 1���׶� 2�������Э���� legacy ���ݲ�
3. ִ�н׶� 3���׶� 4���÷�ҳ����֧��˫Э�鲢Ǩ�� paragraph/image/codeBlock
4. ����׶� 5���ȸ� table ���ӽṹ�� `measureBlock`
5. ��һ������ table �� modern `paginateBlock` �뵥���ڲ�����

## ��ǰ״̬

- [x] �׶� 0������߽�
- [x] �׶� 1������Э�飬������Ϊ
- [x] �׶� 2����Э����ݲ㣨�Ǽܣ�
- [x] �׶� 3����ҳ����֧��˫Э��
- [x] �׶� 4��Ǩ�Ƽ򵥽ڵ�
- [ ] �׶� 5��Ǩ�� table ��һ�׶�
  ��ǰ���ȣ�`table.measureBlock` �� `table.paginateBlock` �ѽ��룻`measure` �ܲ��� `table -> row -> cell` �ṹ��ģ�ͣ�`paginate` ��ͨ�� snapshot cursor �� modern Э�飬���ڲ��Ը��� `splitTableBlock` �� legacy ��ҳ���壻`lumen-pagination-regressions.spec.ts` 16/16 ͨ����
- [x] �׶� 6��֧�� nested table ��ʵ�ݹ��ҳ`r`n  ��ǰ״̬���Ѳ� `cell -> nested table` ���ع飬nested table ��ҳ�������� `lumen-pagination-regressions.spec.ts` ��ͨ����֤��
## ����״̬��2026-03-19��

- [x] Ĭ�� leaf ��ҳ���������е� modern Э�飻`layout-engine` ����������ʱ�������� legacy renderer��
- [x] `paragraph`��`heading`��`image`��`codeBlock`��`table`��`list`��`horizontalRule`��`video` �ѽ��� `measureBlock/paginateBlock`��
- [x] extension ��Ҷ�ӽڵ��ѽ��� modern Э�飺`audio`��`bookmark`��`callout`��`columns`��`embed-panel`��`file`��`math`��`option-box`��`seal`��`signature`��`template`��`text-box`��`web-page`��
- [x] `table` ����ɽṹ�� `measure` �� modern `paginate` ���룻���г�ҳ��1-N ҳ���š�cell �ڶ���䡢`cell -> nested table` ������ع鲢ͨ����
- [x] ȫ�� `pnpm typecheck` ͨ����
- [x] `apps/lumen/e2e/lumen-pagination-regressions.spec.ts` 17/17 ͨ����
- [x] `apps/lumen/e2e/lumen-list-pagination.spec.ts` 1/1 ͨ����

## Ǩ�ƽ���

�µķ�ҳ��Э���Ѿ���ΪĬ������·����legacy `layoutBlock/splitBlock` �Ա��������Ͳ�ͼ��ݹ��߲㣬���ں����ⲿ��չ���ݣ�����ǰ�ֿ���Ĭ�� renderer �� extension renderer �Ѳ������� runtime legacy adapter��
- [x] ����ʱ compat adapter ���Ƴ���leaf renderer ����ֱ��ʵ�� modern Э�顣

