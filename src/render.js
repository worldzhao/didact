import { TEXT_ELEMENT } from "./constants";

const isProperty = (key) => key !== "children";

function createDom(fiber) {
  const dom =
    fiber.type === TEXT_ELEMENT
      ? document.createTextNode("")
      : document.createElement(element.type);

  Object.keys(fiber.props)
    .filter(isProperty)
    .forEach((name) => {
      dom[name] = fiber.props[name];
    });

  return dom;
}

function render(element, container) {
  nextUnitOfWork = {
    dom: container,
    props: {
      children: [element],
    },
  };
}

let nextUnitOfWork = null;

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }
  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  // 1. 将 element 添加至 DOM
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
  if (fiber.parent) {
    fiber.parent.dom.appendChild(fiber.dom);
  }
  // 2. 为 element 的 children 创建 fiber 节点
  const elements = fiber.props.children;

  let index = 0;
  let prevSibling = null;

  while (index < elements.length) {
    const element = elements[index];

    const newFiber = {
      type: element.type,
      props: element.props,
      parent: fiber, // 孩子节点的父节点
      dom: null,
    };

    if (index === 0) {
      // 当前fiber的孩子节点
      fiber.child = newFiber;
    } else {
      // 孩子节点的兄弟节点
      prevSibling.sibling = newFiber;
    }
    // 注意是指针移动
    prevSibling = newFiber;
    i++;
  }

  /**
   * 3. 选择下一个工作单元
   * a) 如果有孩子节点，返回孩子节点
   * b) 如果有兄弟节点，返回兄弟节点
   * c) 如果都没有，返回叔叔节点
   * d) 如果没有叔叔节点，沿着父节点向上走，直到找到某个祖先叔叔节点
   * e) 如果到了根节点还没找到 完事儿了您
   */

  if (fiber.child) {
    return fiber.child;
  }

  let nextFiber = fiber;
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling;
    }
    nextFiber = nextFiber.parent;
  }
}

export default render;
