import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BalanceProvider, useBalance } from "./context/BalanceContext";
import { ActiveProvider, useActive } from "./context/ActiveContext";
import { SelectionProvider } from "./context/SelectionContext";
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
  OfflineBanner,
  PANEL_FOOTER_ID,
} from "@components/index";
import useOffline from "@hooks/useOffline";
import { TabType } from "@app-types/enums";
import {
  TYPE_ACCOUNT,
  TYPE_ACTION,
  TYPE_GET_BALANCE,
  TYPE_KEY,
  TYPE_TAB,
  TYPE_UI_READY,
  TYPE_VALIDATE_KEY,
} from "@constants/types";
import "@styles/global.scss";
import { getBalance, sendMessageToSandBox } from "./api";

// Exported for the layout-structure test. jsdom has no layout engine, so nothing
// here can assert a height — but which side of `.scrollable-content` an element
// sits on is plain DOM, and that is the half that regressed.
export const App = () => {
  const { setIsActive } = useActive()
  // Generate Image is the first tab across all four surfaces now: the manifest
  // menu, the navbar order, IntroController's landing tab for a keyless user, and
  // this initial state. A partial promotion reads as a bug rather than a decision.
  const [tab, setTab] = useState<TabType>(TabType.GENERATE_IMAGE);
  const { setBalance } = useBalance();
  const [apiKey, setApiKey] = useState<string>("");
  const [isCreditsInsufficient, setIsCreditsInsufficient] =
    useState<boolean>(false);
  const isOffline = useOffline();

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

  // Renders the current tab. This used to be a `page` state variable holding a
  // JSX element, rebuilt by a useEffect with seven dependencies — so every
  // selection change rebuilt the whole tree through state, and forgetting a
  // dependency meant a panel rendering with stale props. A plain function called
  // during render cannot go stale.
  const renderPage = () => {
    switch (tab) {
      case TabType.TAB_REMOVE_BACKGROUND_INSTANTLY:
        return <RemoveBackgroundHidden gottenKey={apiKey} />;
      case TabType.REMOVE_BACKGROUND:
        return (
          <RemoveBackground
            gottenKey={apiKey}
            isCreditsInsufficient={isCreditsInsufficient}
            isOffline={isOffline}
          />
        );
      case TabType.UPSCALE:
        return (
          <Upscale
            gottenKey={apiKey}
            isCreditsInsufficient={isCreditsInsufficient}
            isOffline={isOffline}
          />
        );
      case TabType.GENERATE_IMAGE:
        return (
          <GenerateImage
            gottenKey={apiKey}
            isCreditsInsufficient={isCreditsInsufficient}
            isOffline={isOffline}
          />
        );
      case TabType.ACCOUNT:
        return (
          <Account
            setIsCreditsInsufficient={setIsCreditsInsufficient}
            gottenKey={apiKey}
            changeTab={handleTabChange}
          />
        );
      case TabType.SUPPORT:
        return <Support />;
      case TabType.SET_API_KEY:
        return <ChangeAPIkey changeKey={setApiKey} />;
      default:
        return null;
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
        setIsActive(() => true);
        sendMessageToSandBox(true, "", TYPE_GET_BALANCE);
      } 
      else if (type === TYPE_VALIDATE_KEY) {
        const res = await getBalance(payload);
        if (res.success && res.msg !== 0) {
          setIsActive(() => true);
          sendMessageToSandBox(true, "", TYPE_VALIDATE_KEY);
        } else {
          sendMessageToSandBox(false, "", TYPE_VALIDATE_KEY);
        }
      } 
      else if (type === TYPE_ACTION) {
        // TYPE_ACTION was previously stored in an `action` state variable whose
        // only consumer was the page-rebuilding effect's dependency array. Nothing
        // read the value. Kept as an activity ping.
        setIsActive(() => true);
      } else if (type === TYPE_TAB) {
        setIsActive(() => true);
        setTab(payload);
      } else if (type === TYPE_GET_BALANCE) {
        setIsActive(() => true);
        setBalance(payload);
        setIsCreditsInsufficient(payload <= 0);
      }
    };

    window.addEventListener("message", messageHandler);

    // Announced only after the listener is attached, which is the whole point: the
    // sandbox holds its messages until this arrives, so nothing can be posted into a
    // window that is not listening yet. Replaces the sandbox guessing 400ms.
    sendMessageToSandBox(true, "", TYPE_UI_READY);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);

  return (
    <div className="main-content">
      {/* OUTSIDE the scroller, like `.panel-footer` below and for the same reason.
          Inside it the tab row was a flex item with the default `flex-shrink: 1`,
          so it did two bad things in sequence: squashed from 32px to 14px,
          silently swallowing the first 18px of any overflow before anything
          looked wrong, and then scrolled away entirely once the user scrolled to
          reach a control — leaving a panel with no visible way back to a tab. */}
      {apiKey && <Navbar gottenKey={apiKey} tab={tab} />}
      <div className="scrollable-content">
        {apiKey && renderPage()}
        {!apiKey && <IntroPage />}
      </div>
      {/* The primary action's home, OUTSIDE the scroller and above the credits strip.
          Each tab portals its own button in here through PanelFooter, so the button
          keeps the per-tab state that decides its label and whether it is enabled,
          while its position stops depending on how tall the panel's content is. A
          `flex-shrink: 0` inside `.scrollable-content` pinned nothing. */}
      {apiKey && <div id={PANEL_FOOTER_ID} className="panel-footer" />}
      {isOffline && (
        <div className="bottom-banner">
          <OfflineBanner />
        </div>
      )}
      {apiKey && (
        <div className="bottom-banner">
          {(tab === TabType.REMOVE_BACKGROUND || tab === TabType.UPSCALE || tab === TabType.GENERATE_IMAGE) && (
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
    <ActiveProvider>
      <BalanceProvider>
        <SelectionProvider>
          <App />
        </SelectionProvider>
      </BalanceProvider>
    </ActiveProvider>
  );
}
