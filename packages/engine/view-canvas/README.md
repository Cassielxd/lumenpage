# lumenpage-view-canvas

> Ŀ¼��`packages/engine/view-canvas`

## ����λ
Canvas ��༭��ͼʵ�֣��ȼ��� DOM �༭����� EditorView ��ɫ��

## ��ǰְ��
- �н����롢ѡ������ꡢ���������в��ԡ�
- �Ѳ��ֽ��������Ⱦ�㣬������ҳҳ����ơ�
- ά����ͼ����ʱ״̬�����Խ� `layout-engine`��`render-engine`��`view-runtime`��
- �ṩ��������ص�Ĭ�� node view װ������������ͼƬ��������Ƶ��

## �����������
- ҵ����Ĭ�� node view��������Ƶ����ǩ���ļ�����ҳǶ�롢ǩ���ȡ�
- ҵ����չ�ĵ����͹��߽�����

������������Ӧ�����ڸ��� `extension-*` ���С�

## �����ṹ
- ������`lumenpage-view-canvas`
- ��Ҫ��ڣ�`src/index.ts`
- ������ʽ���� workspace ����ʽ����������Ӧ������

## ���⵼��
- `CanvasEditorView` �������ͼ API
- ��ͼ����ʱ�������Ž�����
- ���ַ�ҳ����
- ������Ĭ�� node view

## ������ϵ
### Workspace ����
- `lumenpage-link`
- `lumenpage-layout-engine`
- `lumenpage-render-engine`
- `lumenpage-view-runtime`

### ����������
- �޵���������ʱ������

## �����÷�
```ts
import { CanvasEditorView } from "lumenpage-view-canvas";
```

## ��ע
- ���ǵ�ǰ��Ŀ������ tiptap / ProseMirror DOM ��ͼ�ĺ��İ���
- ������ֻ����������ͼ����������Ĭ��Я��ҵ����չ node view��
