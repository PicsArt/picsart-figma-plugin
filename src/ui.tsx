import React, { useEffect, useState } from "react";
import Navbar from "@components/navbar";
import { createRoot } from "react-dom/client";
import {
  Account,
  BalanceBanner,
  ChangeAPIkey,
  IntroPage,
  RemoveBackground,
  Support,
  TextToImage,
  Upscale,
} from "@components/index";
import { TabType } from "./types/enums";
import {
  TYPE_ACCOUNT,
  TYPE_ACTION,
  TYPE_IMAGEBYTES,
  TYPE_KEY,
  TYPE_TAB,
} from "@constants/types";
import "@styles/global.scss";
import { sendMessageToSandBox } from "./api";

const App = () => {
  const [tab, setTab] = useState<TabType>(TabType.REMOVE_BACKGROUND);

  const [page, setPage] = useState<JSX.Element | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [action, setAction] = useState();
  const [imageBytes, setImageBytes] = useState<Uint8Array>(new Uint8Array());

  /// !!!IMPORTANT
  if (navigator.onLine === false) {
    parent.postMessage({ pluginMessage: "NO_INTERNET_ERR" }, "*");
    return <></>;
  }

  const handleTabChange = (selectedTab: TabType) => {
    if (selectedTab === TabType.ACCOUNT) {
      sendMessageToSandBox(
        true,
        "change height for account page",
        TYPE_ACCOUNT
      );
    }
    setTab(selectedTab);
  };

  const setPageLogic = () => {
    switch (tab) {
      case TabType.REMOVE_BACKGROUND:
        setPage(
          <RemoveBackground
            setImageBytes={setImageBytes}
            gottenKey={apiKey}
            imageBytes={imageBytes}
          />
        );
        break;
      case TabType.UPSCALE:
        setPage(
          <Upscale
            setImageBytes={setImageBytes}
            gottenKey={apiKey}
            imageBytes={imageBytes}
          />
        );
        break;
      case TabType.ACCOUNT:
        setPage(<Account gottenKey={apiKey} changeTab={handleTabChange} />);
        break;
      case TabType.SUPPORT:
        setPage(<Support />);
        break;
      case TabType.SET_API_KEY:
        setPage(<ChangeAPIkey changeKey={setApiKey} />);
        break;
      default:
        setPage(null);
    }
  };

  useEffect(() => {
    const messageHandler = ({ data: { pluginMessage } }: MessageEvent) => {
      if (!pluginMessage) return;
      const { type, payload } = pluginMessage;

      if (type === TYPE_KEY) setApiKey(payload);
      else if (type === TYPE_IMAGEBYTES) setImageBytes(payload);
      else if (type === TYPE_ACTION) setAction(payload);
      else if (type === TYPE_TAB) setTab(payload);
    };

    window.addEventListener("message", messageHandler);
    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  useEffect(() => {
    setPageLogic();
  }, [tab, action, apiKey, imageBytes]);

  return (
    <>
      <div>
        <Navbar gottenKey={apiKey} tab={tab} changeTab={handleTabChange} />
        {page}
        {!apiKey && <IntroPage />}
      </div>
      {apiKey && (
        <div>
          {(tab === TabType.REMOVE_BACKGROUND || tab === TabType.UPSCALE) && (
            <BalanceBanner gottenKey={apiKey} />
          )}
          <TextToImage />
        </div>
      )}
    </>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
