<template>
  <div ref="editorHost" class="code-mirror-host"></div>
</template>

<script setup>
import { javascript } from '@codemirror/lang-javascript';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  value: { type: String, default: '' }
});

const emit = defineEmits(['update:value']);

const editorHost = ref(null);
let editorView;

const lightEditorTheme = EditorView.baseTheme({
  '&': {
    minHeight: '390px',
    color: '#000000',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    borderRadius: '4px'
  },
  '.cm-scroller': {
    minHeight: '390px',
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    lineHeight: '1.5'
  },
  '.cm-content': {
    padding: '4px 0',
    caretColor: '#111827'
  },
  '.cm-line': {
    padding: '0 20px 0 16px'
  },
  '.cm-gutters': {
    color: '#5f6975',
    backgroundColor: '#fbfdff',
    borderRight: '1px solid #edf1f5',
    cursor: 'default'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '26px',
    padding: '0 6px 0 4px',
    fontVariantNumeric: 'tabular-nums'
  },
  '.cm-activeLine': {
    backgroundColor: 'rgba(204, 238, 255, 0.22)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#fbfdff',
    color: '#364b63'
  },
  '.cm-cursor': {
    borderLeftColor: '#111827',
    borderLeftWidth: '1.5px'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#add6ff'
  },
  '.cm-content ::selection': {
    backgroundColor: '#add6ff'
  },
  '.cm-selectionMatch': {
    backgroundColor: '#dbeafe'
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: '#d7f5ec',
    outline: '1px solid #9dd8c7'
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 2px',
    color: '#7d8793'
  }
});

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

onBeforeUnmount(() => {
  editorView?.destroy();
});
</script>
