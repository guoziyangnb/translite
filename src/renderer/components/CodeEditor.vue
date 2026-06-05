<template>
  <div ref="editorHost" class="code-mirror-host"></div>
</template>

<script setup>
// 组件作用：封装用量查询脚本的 JavaScript 代码编辑器，统一 CodeMirror 初始化、主题和双向绑定。
// 适用场景：设置页中需要编辑可执行脚本、模板代码或长文本代码片段的表单区域。
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  // 编辑器内容，默认空字符串；父组件通过 v-model:value 同步脚本源码。
  value: { type: String, default: '' }
});

const emit = defineEmits(['update:value']);

const editorHost = ref(null);
let editorView;

// CodeMirror 浅色主题：仅做视觉定制，避免覆盖选择层、光标层等内部交互样式。
const lightEditorTheme = EditorView.baseTheme({
  // 编辑器根节点：控制整体高度、字体大小和白色编辑器底色。
  '&': {
    minHeight: '390px',
    color: '#000000',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    borderRadius: '4px'
  },
  // 滚动区域：控制编辑器高度、滚动行为、等宽字体和代码行高。
  '.cm-scroller': {
    minHeight: '390px',
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '1.5'
  },
  // 可编辑内容区：控制内容上下留白和文本光标颜色。
  '.cm-content': {
    padding: '4px 0',
    caretColor: '#111827'
  },
  // 单行代码：控制每行左右内边距，保持代码与行号栏距离。
  '.cm-line': {
    padding: '0 20px 0 16px'
  },
  // 行号/折叠栏容器：控制 gutter 的颜色、背景和分隔线。
  '.cm-gutters': {
    color: '#5f6975',
    backgroundColor: '#fbfdff',
    borderRight: '1px solid #edf1f5',
    cursor: 'default'
  },
  // 行号单元格：控制行号宽度、内边距和数字等宽显示。
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '26px',
    padding: '0 6px 0 4px',
    fontVariantNumeric: 'tabular-nums'
  },
  // 当前代码行：用低透明度背景提示当前行，避免遮挡选区和双击词高亮。
  '.cm-activeLine': {
    backgroundColor: 'rgba(204, 238, 255, 0.22)'
  },
  // 当前行 gutter：保持行号栏底色稳定，只加深当前行号颜色。
  '.cm-activeLineGutter': {
    backgroundColor: '#fbfdff',
    color: '#364b63'
  },
  // 文本光标：控制插入光标颜色和粗细。
  '.cm-cursor': {
    borderLeftColor: '#111827',
    borderLeftWidth: '1.5px'
  },
  // 聚焦状态：移除浏览器默认 outline，外层容器负责焦点边框。
  '&.cm-focused': {
    outline: 'none'
  },
  // CodeMirror 绘制选区：控制拖选、多光标选择时的选区背景。
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#add6ff'
  },
  // 浏览器原生选区兜底：用于未启用自绘选区或特殊浏览器场景。
  '.cm-content ::selection': {
    backgroundColor: '#add6ff'
  },
  // 选中词匹配高亮：双击选词后，高亮文档中其他相同匹配项。
  '.cm-selectionMatch': {
    backgroundColor: '#dbeafe'
  },
  // 括号匹配提示：光标靠近括号时标记匹配或不匹配括号。
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: '#d7f5ec',
    outline: '1px solid #9dd8c7'
  },
  // 折叠栏图标：压缩折叠按钮间距并弱化颜色。
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 2px',
    color: '#7d8793'
  }
});

// JavaScript 语法高亮：模拟轻量 IDE 风格，保证脚本结构可快速扫描。
const lightSyntax = HighlightStyle.define([
  { tag: tags.keyword, color: '#0000ff', fontWeight: '400' },
  { tag: [tags.string, tags.special(tags.string)], color: '#a31515' },
  { tag: [tags.number, tags.bool, tags.null], color: '#098658' },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: '#795e26' },
  { tag: tags.variableName, color: '#0000ff' },
  { tag: tags.propertyName, color: '#001080' },
  { tag: tags.operator, color: '#000000' },
  { tag: tags.punctuation, color: '#000000' },
  { tag: tags.comment, color: '#008000', fontStyle: 'italic' }
]);

// 初始化 CodeMirror 实例，并把编辑器内容变化同步给父组件。
onMounted(() => {
  editorView = new EditorView({
    parent: editorHost.value,
    state: EditorState.create({
      doc: props.value,
      extensions: [
        basicSetup,
        lightEditorTheme,
        syntaxHighlighting(lightSyntax),
        javascript(),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update:value', update.state.doc.toString());
        })
      ]
    })
  });
});

// 响应父组件传入内容变化，避免外部模板切换或格式化后编辑器内容不同步。
watch(
  () => props.value,
  (nextValue) => {
    if (!editorView) return;
    const currentValue = editorView.state.doc.toString();
    if (nextValue === currentValue) return;
    editorView.dispatch({
      changes: { from: 0, to: currentValue.length, insert: nextValue || '' }
    });
  }
);

// 组件卸载时销毁 CodeMirror 实例，释放 DOM 监听和编辑器状态。
onBeforeUnmount(() => {
  editorView?.destroy();
});
</script>
