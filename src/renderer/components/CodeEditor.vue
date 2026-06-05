<template>
  <div ref="editorHost" class="code-mirror-host"></div>
</template>

<script setup>
import { javascript } from '@codemirror/lang-javascript';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  value: { type: String, default: '' }
});

const emit = defineEmits(['update:value']);

const editorHost = ref(null);
let editorView;

const lightEditorTheme = EditorView.theme({
  '&': {
    minHeight: '390px',
    color: '#111827',
    backgroundColor: '#ffffff',
    fontSize: '13px',
    borderRadius: '4px'
  },
  '.cm-scroller': {
    minHeight: '390px',
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, monospace',
    lineHeight: '1.52'
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: '#2563eb'
  },
  '.cm-line': {
    padding: '0 14px'
  },
  '.cm-gutters': {
    color: '#5f6f86',
    backgroundColor: '#eef6ff',
    borderRight: '1px solid #d7e4f2'
  },
  '.cm-lineNumbers .cm-gutterElement': {
    minWidth: '38px',
    padding: '0 10px 0 8px',
    fontVariantNumeric: 'tabular-nums'
  },
  '.cm-activeLine': {
    backgroundColor: '#f8fbff'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#dbeeff',
    color: '#1f4b7a'
  },
  '.cm-cursor': {
    borderLeftColor: '#2563eb',
    borderLeftWidth: '2px'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: '#c7ddff'
  },
  '.cm-matchingBracket, .cm-nonmatchingBracket': {
    backgroundColor: '#fff4bf',
    outline: '1px solid #f4d35e'
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
    color: '#7a8da6'
  }
});

const lightSyntax = HighlightStyle.define([
  { tag: tags.keyword, color: '#0000ff' },
  { tag: [tags.string, tags.special(tags.string)], color: '#a31515' },
  { tag: [tags.number, tags.bool, tags.null], color: '#098658' },
  { tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: '#795e26' },
  { tag: tags.variableName, color: '#001080' },
  { tag: tags.propertyName, color: '#0070c1' },
  { tag: tags.operator, color: '#000000' },
  { tag: tags.punctuation, color: '#111827' },
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
