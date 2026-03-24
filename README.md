# LumenPage

LumenPage ��һ�������ĵ������� Canvas ��ҳ���ı��༭�� monorepo��

���ĺ���˼·���ǡ����� DOM �༭������ٵ�����ҳ�������Ǵӱ༭�׶ξͽ�����ʵ��ҳģ�ͣ�ͬʱ���� ProseMirror ��������ģ�͡�״̬����������ϵͳ�Ͳ���߽磬�����ϲ㿪�������Ͼ����� tiptap ���롣

## ��Ŀ����
- �༭�׶μ���ҳ��ҳ����ҳ�߾ࡢ��ҳ���ڱ༭ʱ�Ϳɼ���
- ����������ĵ�ģ��������ϵͳ������ֻ�л���û��ģ�͵ķ�����
- �ϲ� API ����չ��֯��ʽ�������� tiptap��Ǩ�Ƴɱ����͡�
- ͨ�� `layout-engine`��`render-engine`��`view-runtime`��`view-canvas` �ֲ㣬�ѷ�ҳ����Ⱦ����ͼ�����𿪡�
- ҵ����չ���ٻ��������Ⱦ�㣬������ҵ��߽��������

## ��ǰ�ܹ��߽�
```txt
apps/lumen, apps/playground
        |
        v
packages/core/core + packages/core/starter-kit + packages/extensions/extension-*
        |
        v
packages/engine/view-canvas
        |
        +--> packages/engine/layout-engine
        +--> packages/engine/render-engine
        +--> packages/engine/view-runtime
        +--> packages/lp/*
```

### ���Ĳ�
- `packages/lp/*`��ģ�͡�״̬����������ȵײ�������
- `packages/engine/layout-engine`�����֡����С���ҳ����ҳ���š��������á�
- `packages/engine/render-engine`�������ĵ����� mark ��ͨ��Ĭ����Ⱦ��
- `packages/engine/view-runtime`�����ꡢλ��������ѡ���ƶ������⻯����ͼ����������
- `packages/engine/view-canvas`��Canvas EditorView�������Žӡ����Ƶ��ȡ�

### ��չ��
- `packages/core/starter-kit`��ֻ��������չ�ۺϣ�������ҵ��顣
- `packages/extensions/extension-*`���ڵ㡢mark�������͹�����չ��

### ҵ��߽�
������������Ĭ�ϱ����ڸ�����չ���������Ƿ��ں�����Ⱦ�㣺
- `audio`
- `bookmark`
- `file`
- `webPage`
- `callout`
- `columns`
- `embedPanel`
- `math`
- `optionBox`
- `signature`
- `template`
- `textBox`
- `seal`

����ζ�ţ�
- `render-engine` ֻ����ͨ�û�����Ⱦ��
- ҵ����Լ���Ĭ�� renderer / node view ����չ��ά����
- Ӧ�ÿ��Ը������滻��ü�ҵ��������������Ҫ�����Ĳ㡣

## ������˼·
- ��ͨ�����ߣ��� `Editor + StarterKit + ������չ` ���ܽ��롣
- tiptap �û�����չ�������֯��ʽ���ӽ���֪���ǡ�
- �߼����ƣ�����ֱ�Ӹ�д renderer��node view��popup��toolbar����������

## �Ƽ����
- ���İ���
  - [packages/core/core](packages/core/README.md)
  - [packages/core/starter-kit](packages/core/starter-kit/README.md)
  - [packages/engine/layout-engine](packages/engine/layout-engine/README.md)
  - [packages/engine/render-engine](packages/engine/render-engine/README.md)
  - [packages/engine/view-canvas](packages/engine/view-canvas/README.md)
- Ӧ��ʾ����
  - `apps/lumen`
  - `apps/playground`
