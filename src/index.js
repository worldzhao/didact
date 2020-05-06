import Didact from "./didact";

const element = (
  <div id="foo">
    <h1>hello</h1> <h2>world</h2>
  </div>
);

const root = document.querySelector("#root");

Didact.render(element, root);
