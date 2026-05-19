import { onBeforeUnmount } from 'vue';
import { CURRENT_PAGE_PORT_NAME, type ExtensionMessage } from '../../shared/messages';

/**
 * 创建弹窗与当前页面的实时通信端口。
 *
 * @returns 无返回值。
 */
export function useCurrentPagePort(): void {
  let port: chrome.runtime.Port | undefined;
  const connectedMessage: ExtensionMessage = {
    kind: 'popup-connected',
  };

  void chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
    if (typeof tab?.id !== 'number') {
      return;
    }

    port = chrome.tabs.connect(tab.id, { name: CURRENT_PAGE_PORT_NAME });
    port.postMessage(connectedMessage);
  });

  onBeforeUnmount(() => {
    port?.disconnect();
  });
}
