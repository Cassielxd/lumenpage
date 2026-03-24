# lumenpage-render-engine

> Ŀ¼��`packages/engine/render-engine`

## ����λ
Canvas ��Ⱦ����㣬��������ĵ����� mark ��ͨ����Ⱦ������

## ��ǰְ��
- �ṩ�������Ĭ�Ͻڵ���Ⱦ�������䡢���⡢���á�����顢�ָ��ߡ��б���ͼƬ��������Ƶ��
- �ṩĬ�� mark ����������Ƹ����߼���
- �ṩ text run��line break����ע���»��ߡ�ɾ���ߵ���Ⱦ������ʩ��
- ������չ���ǻ��ƹ�Ĭ�� node/mark ��Ⱦʵ�֡�

## �����������
- ҵ����Ĭ����Ⱦ������ `callout`��`columns`��`embedPanel`��`math`��`signature`��`template` �ȡ�
- ҵ��ڵ�� overlay / node view��
- Ӧ�ò㹤�ߡ�������ҵ�����̡�

��Щ��������Ӧ�����ڸ��� `extension-*` ���С�

## �����ṹ
- ������`lumenpage-render-engine`
- ��Ҫ��ڣ�`src/index.ts`
- ������ʽ���� workspace ����ʽ����������Ӧ������

## ���⵼��
- ���� node renderer
- mark render adapter
- `breakLines`
- `docToRuns` / `textToRuns` / `textblockToRuns`

## ������ϵ
### Workspace ����
- �� workspace ����ʱ������

### ����������
- �޵���������ʱ������

## �����÷�
```ts
import {
  getDefaultMarkRenderAdapter,
  defaultParagraphRenderer,
} from "lumenpage-render-engine";
```

## ��ע
- ���������ֻ���ء�ͨ��Ĭ����Ⱦ�������ٳ���ҵ����չ��Ĭ�� renderer��
