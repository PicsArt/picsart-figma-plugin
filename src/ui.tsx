/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BalanceProvider, useBalance } from "./context/BalanceContext";
import {
  Navbar,
  Account,
  BalanceBanner,
  ChangeAPIkey,
  IntroPage,
  RemoveBackground,
  RemoveBackgroundHidden,
  Support,
  Upscale,
  GenerateImage,
} from "@components/index";
import { TabType } from "./types/enums";
import {
  TYPE_ACCOUNT,
  TYPE_ACTION,
  TYPE_GET_BALANCE,
  TYPE_IMAGEBYTES,
  TYPE_KEY,
  TYPE_TAB,
  TYPE_VALIDATE_KEY,
} from "@constants/types";
import "@styles/global.scss";
import { getBalance, sendMessageToSandBox } from "./api";

const App = () => {
  const [tab, setTab] = useState<TabType>(TabType.REMOVE_BACKGROUND);
  const { balance, setBalance } = useBalance();
  const [page, setPage] = useState<JSX.Element | null>(null);
  const [apiKey, setApiKey] = useState<string>("");
  const [action, setAction] = useState();
  const [imageBytes, setImageBytes] = useState<Uint8Array>(new Uint8Array());
  const [isCreditsInsufficient, setIsCreditsInsufficient] =
    useState<boolean>(false);

  /// !!!IMPORTANT
  if (navigator.onLine === false) {
    // eslint-disable-next-line no-restricted-globals
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
      case TabType.TAB_REMOVE_BACKGROUND_INSTANTLY:
        setPage(
          <RemoveBackgroundHidden gottenKey={apiKey} imageBytes={imageBytes} />
        );
        break;
      case TabType.REMOVE_BACKGROUND:
        setPage(
          <RemoveBackground
            setImageBytes={setImageBytes}
            gottenKey={apiKey}
            imageBytes={imageBytes}
            isCreditsInsufficient={isCreditsInsufficient}
          />
        );
        break;
      case TabType.UPSCALE:
        setPage(
          <Upscale
            setImageBytes={setImageBytes}
            gottenKey={apiKey}
            imageBytes={imageBytes}
            isCreditsInsufficient={isCreditsInsufficient}
          />
        );
        break;
      case TabType.TEXT_TO_IMAGE:
        setPage(<GenerateImage
            gottenKey={apiKey}
            isCreditsInsufficient={isCreditsInsufficient}
          />);
        break;
      case TabType.ACCOUNT:
        setPage(<Account setIsCreditsInsufficient={setIsCreditsInsufficient} gottenKey={apiKey} changeTab={handleTabChange} />);
        break;
      case TabType.SUPPORT:
        setPage(<Support />);
        break;
      case TabType.SET_API_KEY:
        setPage(
          <ChangeAPIkey
            changeKey={setApiKey}
          />
        );
        break;
      default:
        setPage(null);
    }
  };

  useEffect(() => {
    const messageHandler = async ({
      data: { pluginMessage },
    }: MessageEvent) => {
      if (!pluginMessage) return;
      const { type, payload } = pluginMessage;

      if (type === TYPE_KEY) {
        setApiKey(payload);
        sendMessageToSandBox(true, "", TYPE_GET_BALANCE);
      } else if (type === TYPE_VALIDATE_KEY) {
        const res = await getBalance(payload);
        if (res.success && res.msg !== 0) {
          sendMessageToSandBox(true, "", TYPE_VALIDATE_KEY);
        } else {
          sendMessageToSandBox(false, "", TYPE_VALIDATE_KEY);
        }
      } else if (type === TYPE_IMAGEBYTES) {
        setImageBytes(payload);
      } else if (type === TYPE_ACTION) {
        setAction(payload);
      } else if (type === TYPE_TAB) {
        setTab(payload);
      } else if (type === TYPE_GET_BALANCE) {
        setBalance(payload);
        payload <= 0 ? setIsCreditsInsufficient(true) : setIsCreditsInsufficient(false);
      }
    };

    window.addEventListener("message", messageHandler);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  useEffect(() => {
    setPageLogic();
  }, [tab, action, apiKey, imageBytes, isCreditsInsufficient, balance]);

  return (
    <div className="main-content">
      <div className="scrollable-content">
        {apiKey && <Navbar gottenKey={apiKey} tab={tab} />}
        {apiKey && page}
        {!apiKey && <IntroPage />}
      </div>
      {apiKey && (
        <div className="bottom-banner">
          {(tab === TabType.REMOVE_BACKGROUND || tab === TabType.UPSCALE || tab === TabType.TEXT_TO_IMAGE) && (
            <BalanceBanner
              gottenKey={apiKey}
              isCreditsInsufficient={isCreditsInsufficient}
              setIsCreditsInsufficient={setIsCreditsInsufficient}
            />
          )}
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <BalanceProvider>
      <App />
    </BalanceProvider>
  );
}
