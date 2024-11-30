
# 🚀 Figma Plugin - Figma-Plugin-RemoveBg-Upscale 🎨

## How to Run the Plugin 🛠️

1. **Clone the Project**  
   Clone the repository to your local machine:

   ```bash
   git clone [your-repo-url]
   cd [your-repo-directory]
   ```

2. **Install Dependencies**  
   Run the following command to install all required dependencies:

   ```bash
   npm install
   ```

3. **Run the Plugin**  
   Use the following commands to start or build the plugin:
   - To start development mode with hot reloading: 🔄
     ```bash
     npm run watch
     ```
   - To serve the plugin with a local development server: 💻
     ```bash
     npm start
     ```
   - To create a production build: 🏗️
     ```bash
     npm run build
     ```

   Here are the scripts defined in `package.json`:
   ```json
   "scripts": {
     "build": "webpack",
     "watch": "webpack --watch",
     "start": "webpack serve"
   }
   ```

## How to Add the Plugin to Figma 🖼️

1. **Open Figma**  
   Open Figma and navigate to your working page.

2. **Add the Plugin**  
   Right-click on the page and go to **Plugins** > **Manage Plugins**.

3. **Add this Project Manifest**  
   In the **Manage Plugins** section, add the plugin by selecting this project's `manifest.json`.

4. **Watch Mode**  
   If running in watch mode, changes to the sandbox code z(`code.ts`) will automatically update. However, changes to iframe (UI) code (`ui.tsx`) will require reloading the plugin.

## 📂 Updated Project Structure

The project is organized as follows:
- **assets/**  
  Contains application assets including constants and configuration files.
  - **constants/**  
    - `commands.ts`
    - `env.ts`
    - `errorMessages.ts`
    - `index.ts`
    - `messages.ts`
    - `routes.ts`
    - `types.ts`
    - `url.ts`
- **controllers/**  
  Contains the business logic and controllers for commands.
    - `AccountController.ts`
    - `ChangeApiKeyController.ts`
    - `IntroController.ts`
    - `RemoveBackgroundController.ts`
    - `SupportController.ts`
    - `EnhanceController.ts`
    - `index.ts`
- **dist/**  
  Contains bundled and built files for the plugin.
- **node_modules/**  
  Dependencies installed via `npm install`.
- **public/**  
  Static assets for the plugin, e.g., HTML templates.
- **routes/**  
  Routing logic for commands.
  - `CommandRouter.ts`
- **services/**  
  Service files for specific utilities or APIs.
  - `ImageProcessor.ts`
- **src/**  
  Contains the source code for the plugin's frontend (UI).
  - **components/**  
    Contains React components for the UI.
    - `Account/`
    - `ChangeAPIkey/`
    - `IntroPage/`
    - `LoadingSpinner/`
    - `RemoveBackground/`
    - `Selector/`
    - `Support/`
    - `Upscale/`
  - **styles/**  
    Contains global and component-specific SCSS files.
    - `_colors.scss`
    - `_variables.scss`
    - `global.scss`
  - **utils/**  
    Utility functions and helpers.
    - `imageProcessor.ts`
    - `code.ts`
  - `ui.tsx`  
    Main UI logic for the plugin.
- **manifest.json**  
  Configuration file for the Figma plugin.
- **package.json**  
  Project metadata and dependencies.
- **package-lock.json**  
  Dependency tree lock file.
- **README.md**  
  Documentation for the project.
- **tsconfig.json**  
  TypeScript configuration file.

## ➕ Adding a New Command

Commands are registered in `manifest.json` and linked in `routes.ts`. Follow these steps to add a new command:

1. Register your command in `manifest.json`.
2. Add the controller in the `controllers/` directory.
3. Update the `index.ts` in the `controllers/` folder to include the new controller.
4. Add the route in `routes.ts`.
5. Create a UI component for the command in `src/components/`.

**Example of `routes.ts`:**
```typescript
import commands from "./commands";
import controllersIndex from "@controllers/index";

const ROUTES = {
    [commands.COMMAND_REMOVEBACKGROUND]: controllersIndex.RemoveBackgroundController,
    [commands.COMMAND_UPSCALE]: controllersIndex.EnhanceController,
    [commands.COMMAND_ACCOUNT]: controllersIndex.AccountController,
    [commands.COMMAND_SUPPORT]: controllersIndex.SupportController,
};

export default ROUTES;
```

---

## 🖥️ UI Code Example (`ui.tsx`)

Below is an example of the UI logic:

```typescript
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { IntroPage, Account, ChangeAPIkey, Support, RemoveBackground, Upscale, LoadingSpinner } from '@components/index';
import { NO_INTERNET_ERR, TYPE_COMMAND, TYPE_IMAGEBYTES, TYPE_KEY, COMMAND_REMOVEBACKGROUND, COMMAND_ACCOUNT, COMMAND_SUPPORT, COMMAND_UPSCALE, COMMAND_INTRO, COMMAND_CHANGE_API_KEY } from "@constants/index";
import '@styles/global.scss';

const App = () => {
  if (navigator.onLine === false) {
    parent.postMessage({ pluginMessage: NO_INTERNET_ERR }, "*");
  }

  const [page, setPage] = useState<JSX.Element | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [command, setCommand] = useState<string>('');
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
        setPage(<ChangeAPIkey handleClose={() => {}} />);
        break;
      default:
        setPage(null);
    }
  };

  useEffect(() => {
    const messageHandler = (event: MessageEvent) => {
      const { pluginMessage } = event.data;

      if (pluginMessage) {
        if (pluginMessage.type === TYPE_KEY) setApiKey(pluginMessage.api_key);
        if (pluginMessage.type === TYPE_IMAGEBYTES) setImageBytes(pluginMessage.buffer);
        if (pluginMessage.type === TYPE_COMMAND) setCommand(pluginMessage.command);
      }
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
      {page ? page : <LoadingSpinner />}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
```
