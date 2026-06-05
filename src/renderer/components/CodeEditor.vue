<template>
  <div ref="editorHost" class="code-mirror-host"></div>
</template>

<script setup>
import { javascript } from '@codemirror/lang-javascript';
import { basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({
  value: { type: String, default: '' }
});

const emit = defineEmits(['update:value']);

const editorHost = ref(null);
let editorView;

onMounted(() => {
  editorView = new EditorView({
    parent: editorHost.value,
    state: EditorState.create({
      doc: props.value,
      extensions: [
        basicSetup,
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
