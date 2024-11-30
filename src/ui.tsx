import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IntroPage, Account, ChangeAPIkey, Support, RemoveBackground, Upscale, LoadingSpinner } from '@components/index';
import { NO_INTERNET_ERR, TYPE_COMMAND, TYPE_IMAGEBYTES, TYPE_KEY, COMMAND_REMOVEBACKGROUND, COMMAND_ACCOUNT, COMMAND_SUPPORT, COMMAND_UPSCALE, COMMAND_INTRO, COMMAND_CHANGE_API_KEY } from "@constants/index";
import '@styles/global.scss';

type Command = typeof COMMAND_REMOVEBACKGROUND | typeof COMMAND_UPSCALE | typeof COMMAND_ACCOUNT | typeof COMMAND_SUPPORT | typeof COMMAND_INTRO | typeof COMMAND_CHANGE_API_KEY | undefined;


const App = () => { 
  /// !!!IMPORTANT
  if (navigator.onLine === false) {
    parent.postMessage({ pluginMessage: NO_INTERNET_ERR }, "*");
    return <></>;
  }

  const [page, setPage] = useState<JSX.Element | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [command, setCommand] = useState<Command>();
  const [imageBytes, setImageBytes] = useState<Uint8Array>(new Uint8Array());

  const setPageLogic = () => {
    switch (command) {
      case COMMAND_REMOVEBACKGROUND:
        setPage(<RemoveBackground imageBytes={imageBytes} gottenKey={apiKey} />);
        break;
      case COMMAND_UPSCALE:
        setPage(<Upscale imageBytes={imageBytes} gottenKey={apiKey} />);
        break;
      case COMMAND_ACCOUNT:
        setPage(<Account gottenKey={apiKey} />);
        break;
      case COMMAND_SUPPORT:
        setPage(<Support />);
        break;
      case COMMAND_INTRO:
        setPage(<IntroPage />);
        break;
      case COMMAND_CHANGE_API_KEY:
        setPage(<ChangeAPIkey />);
        break;
      default:
        setPage(null);
    }
  };

  useEffect(() => {
    const messageHandler = ({ data: { pluginMessage } }: MessageEvent) => {
      console.log(pluginMessage);
      
      if (!pluginMessage) return;
      const { type, api_key, buffer, command } = pluginMessage;
      if (type === TYPE_KEY) setApiKey(api_key);
      if (type === TYPE_IMAGEBYTES) setImageBytes(buffer);
      if (type === TYPE_COMMAND) setCommand(command);
    };

    window.addEventListener('message', messageHandler);
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  useEffect(() => {
    setPageLogic();
  }, [command, apiKey]);

  return (
    <div className="root">
      { page || <LoadingSpinner />}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
