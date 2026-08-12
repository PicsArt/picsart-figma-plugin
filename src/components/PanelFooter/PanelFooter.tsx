import React, { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

/** The id `ui.tsx` gives the footer host. Shared so neither side can drift. */
export const PANEL_FOOTER_ID = "panel-footer";

interface Props {
  children: ReactNode;
}

/**
 * Pins a tab's primary action outside the scroller, above the credits strip.
 *
 * The problem: the action button lived inside `.scrollable-content`, so on a short
 * screen — where Figma clamps the window it was asked for — the one control the panel
 * exists for scrolled out of sight, with macOS hiding the scrollbar until you scroll.
 * Marking it `flex-shrink: 0` pins nothing; a child of an `overflow-y: auto` box scrolls
 * with everything else in it.
 *
 * Of the three mechanisms available — a portal, a footer slot through context, or
 * hoisting the button's state into `App` — this is the portal. It is the only one that
 * leaves `btnType` and `cb` where they are: both derive from per-tab state (which
 * layer is selected, what the prompt says, which mode the tab is in), and moving them
 * up would mean `App` knowing about every tab's preconditions. Context would need the
 * tab to publish a React element into state on every render, which is a re-render loop
 * unless the dependency list is maintained by hand, forever.
 *
 * Renders inline when the host element is absent, so a component test that mounts a
 * tab on its own still finds the button.
 */
const PanelFooter: React.FC<Props> = ({ children }) => {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Read after mount, not during render: on the first pass the host may not be in
    // the document yet, and reading the DOM during render is not safe to repeat.
    setHost(document.getElementById(PANEL_FOOTER_ID));
  }, []);

  if (!host) return <>{children}</>;
  return createPortal(children, host);
};

export default PanelFooter;
