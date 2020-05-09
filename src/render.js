import { TEXT_ELEMENT, EFFECT_TAG } from "./constants";

const { UPDATE, PLACEMENT, DELETION } = EFFECT_TAG;

const isEvent = (key) => key.startsWith("on");
const isProperty = (key) => key !== "children" && !isEvent(key);
const isNew = (prev, next) => (key) => prev[key] !== next[key];
const isGone = (prev, next) => (key) => !(key in next);

function createDom(fiber) {
  const dom =
    fiber.type === TEXT_ELEMENT
      ? document.createTextNode("")
      : document.createElement(fiber.type);

  updateDom(dom, {}, fiber.props);

  return dom;
}

function updateDom(dom, prevProps, nextProps) {
  // 移除旧的或更改过的事件监听函数
  Object.keys(prevProps)
    .filter(isEvent)
    .filter((key) => !(key in nextProps) || isNew(prevProps, nextProps)(key))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.removeEventListener(eventType, prevProps[name]);
    });

  // 移除旧属性
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => (dom[name] = ""));

  // 更新（新增）事件监听函数
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLowerCase().substring(2);
      dom.addEventListener(eventType, nextProps[name]);
    });

  // 更新（新增）属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => (dom[name] = nextProps[name]));
}

function commitRoot() {
  // remove nodes
  deletions.forEach(commitWork);
  // add nodes to dom
  commitWork(wipRoot.child);
  currentRoot = wipRoot;
  wipRoot = null;
}

function commitWork(fiber) {
  if (!fiber) return;
  const domParent = fiber.parent.dom;
  if (fiber.effectTag === PLACEMENT && fiber.dom != null) {
    // 新增节点
    domParent.appendChild(fiber.dom);
  } else if (fiber.effectTag === UPDATE && fiber.dom != null) {
    // 更新节点
    updateDom(fiber.dom, fiber.alternate.props, fiber.props);
  } else if (fiber.effectTag === DELETION) {
    // 删除节点
    domParent.removeChild(fiber.dom);
  }
  commitWork(fiber.child);
  commitWork(fiber.sibling);
}

function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  };
  deletions = [];
  nextUnitOfWork = wipRoot;
}

// 下一个工作单元 fiber
let nextUnitOfWork = null;
// 正在处理的fiber根节点 work in progress
let wipRoot = null;
// last fiber tree we committed to the DOM
let currentRoot = null;
// 需要删除的节点
let deletions = null;

function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

  // 没有下一个工作单元了 将变更提交至DOM
  if (!nextUnitOfWork && wipRoot) {
    commitRoot();
  }

  requestIdleCallback(workLoop);
}

requestIdleCallback(workLoop);

function performUnitOfWork(fiber) {
  // // 1. 将 element 添加至 DOM
  // 1. 创建dom
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }

  // 避免用户看到不完整的UI，不在每一个节点处理过程中就添加至DOM
  // 而是待所有工作单元处理完毕，再提交变更至DOM
  // if (fiber.parent) {
  //   fiber.parent.dom.appendChild(fiber.dom);
  // }

  // 2. 为 element 的 children 创建 fiber 节点
  const elements = fiber.props.children;
  reconcileChildren(fiber, elements);

  /**
   * 3. 选择下一个工作单元
   * a) 如果有孩子节点，返回孩子节点
   * b) 如果有兄弟节点，返回兄弟节点
   * c) 如果都没有，返回叔叔节点
   * d) 如果没有叔叔节点，沿着父节点向上走，直到找到某个祖先叔叔节点
   * e) 如果到了根节点还未找到 结束流程
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

function reconcileChildren(wipFiber, elements) {
  let index = 0;
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
  let prevSibling = null;

  while (index < elements.length || oldFiber != null) {
    const element = elements[index];
    let newFiber = null;

    // compare oldFiber to element

    const sameType = oldFiber && element && element.type === oldFiber.type;

    if (sameType) {
      // update the node
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: UPDATE,
      };
    }

    if (element && !sameType) {
      // add this node
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: PLACEMENT,
      };
    }

    if (oldFiber && !sameType) {
      // delete the oldFiber's node
      oldFiber.effectTag = DELETION;
      deletions.push(oldFiber);
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    if (index === 0) {
      // 当前fiber的孩子节点
      wipFiber.child = newFiber;
    } else {
      // 孩子节点的兄弟节点
      prevSibling.sibling = newFiber;
    }
    // 注意是指针移动
    prevSibling = newFiber;
    index++;
  }
}

export default render;
