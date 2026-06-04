import { createApp } from 'vue';
import {
  NButton,
  NConfigProvider,
  NInput,
  NProgress,
  NSelect,
  NSpace,
  NSwitch,
  NTag
} from 'naive-ui';
import App from './App.vue';
import './styles.css';

const app = createApp(App);

app.component('NConfigProvider', NConfigProvider);
app.component('NButton', NButton);
app.component('NInput', NInput);
app.component('NProgress', NProgress);
app.component('NSelect', NSelect);
app.component('NSpace', NSpace);
app.component('NSwitch', NSwitch);
app.component('NTag', NTag);

app.mount('#app');
