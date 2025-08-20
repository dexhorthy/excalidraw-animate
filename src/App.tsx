import React from "react";

import "./App.css";
import Toolbar from "./Toolbar";
import Viewer from "./Viewer";
import { useLoadSvg } from "./useLoadSvg";

const App: React.FC = () => {
  const { loading, loadedSvgList, loadDataList } = useLoadSvg();
  
  // Check if we're in headless mode
  const hash = window.location.hash.slice(1);
  const searchParams = new URLSearchParams(hash);
  const isHeadless = searchParams.get("headless") === "true";
  
  if (loading) {
    return <div>Loading...</div>;
  }
  return (
    <div className="App">
      {!isHeadless && <Toolbar svgList={loadedSvgList} loadDataList={loadDataList} />}
      {!!loadedSvgList.length && <Viewer svgList={loadedSvgList} />}
    </div>
  );
};

export default App;
