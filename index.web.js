import { AppRegistry } from 'react-native';
import App from './Example.App';

AppRegistry.registerComponent('App', () => App);

AppRegistry.runApplication('App', {
  rootTag: document.getElementById('root'),
});
