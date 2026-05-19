import { CURRENT_PAGE_PORT_NAME, type ExtensionMessage } from '../shared/messages';
import { createTextParseController } from './textParseController';

createTextParseController().start();

/**
 * 处理来自插件弹窗的页面实时连接。
 *
 * @param port 当前页面端口。
 * @returns 无返回值。
 */
function handleCurrentPageConnection(port: chrome.runtime.Port): void {
  if (port.name !== CURRENT_PAGE_PORT_NAME) {
    return;
  }

  const readyMessage: ExtensionMessage = {
    kind: 'page-ready',
  };

  port.postMessage(readyMessage);
}

chrome.runtime.onConnect.addListener(handleCurrentPageConnection);
