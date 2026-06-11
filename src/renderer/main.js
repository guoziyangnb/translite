import { createApp } from 'vue';
import {
  NConfigProvider,
  NButton,
  NInput,
  NModal,
  NProgress,
  NRadio,
  NRadioGroup,
  NSelect,
  NSpace,
  NSwitch,
  NTabs,
  NTabPane,
  NTag
} from 'naive-ui';
import App from './App.vue';
import './styles.css';

const app = createApp(App);

app.component('NConfigProvider', NConfigProvider);
app.component('NButton', NButton);
app.component('NInput', NInput);
app.component('NModal', NModal);
app.component('NProgress', NProgress);
app.component('NRadio', NRadio);
app.component('NRadioGroup', NRadioGroup);
app.component('NSelect', NSelect);
app.component('NSpace', NSpace);
app.component('NSwitch', NSwitch);
app.component('NTabs', NTabs);
app.component('NTabPane', NTabPane);
app.component('NTag', NTag);

app.mount('#app');
