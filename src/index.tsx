// https://create-react-app.dev/docs/adding-a-router/
// https://github.com/remix-run/react-router/blob/main/docs/getting-started/tutorial.md#add-some-routes

import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

import { store } from "./app/store";
import App from "./Components/App/App";
import DaMaAdmin from "./Components/DaMaAdmin/DaMaAdmin";

import "./index.css";

const container = document.getElementById("root")!;
const root = createRoot(container);

const darkTheme = createTheme({
  palette: {
    mode: "dark",
  },
});

export default App;

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<DaMaAdmin />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
