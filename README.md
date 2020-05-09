> 原文：https://pomb.us/build-your-own-react/
> 从 Fibers 这一节开始记录。

## Step IV: Fibers

我们需要一种被称为 `fiber` 树的数据结构来组织工作单元[unit of work]。

我们为每一个元素分配一个 `fiber` 节点，每一个 `fiber` 节点就是一个工作单元。

看个例子。

假如我们想渲染如下 element：

```jsx
Didact.render(
  <div>
    <h1>
      <p />
      <a />
    </h1>
    <h2 />
  </div>,
  container
);
```

在`render`方法中，我们将创建根 fiber 节点并且将其赋值给`nextUnitOfWork`。剩下的工作内容交由`performUnitOfWork`函数处理，针对每一个 fiber 节点，我们需要处理三件事：

1. 将 element 添加至 DOM
2. 为 element 的 children 创建 fiber 节点
3. 选择下一个工作单元

![fiber1.png](https://tva1.sinaimg.cn/large/007S8ZIlgy1gejzn2tau4j307m08ujr7.jpg)

对于第 3 点，为了能够容易地找到下一个工作单元，每一个 fiber 节点与其第一个孩子节点[first child]，下一个兄弟节点[next sibling]以及其父节点[parent]维护了一个链接（这也是我们使用这种数据结构的目的之一）。

当我们完成了一个 fiber 节点上的处理，如果该 fiber 节点拥有一个孩子节点，那么这个孩子节点将是下一个工作单元。

在例子中，完成了`div` fiber 的相关操作后，下一个工作单元就是 `h1` fiber，见下图：

![fiber2.png](https://tva1.sinaimg.cn/large/007S8ZIlgy1gejxjg13tjj307m08umwz.jpg)

若 fiber 节点没有孩子节点，则使用其兄弟节点作为下一个工作单元。

在例子中，`p` fiber 没有孩子节点，故完成对`p` fiber 的处理后，移动至`a` fiber，见下图：

![fiber3.png](https://tva1.sinaimg.cn/large/007S8ZIlgy1gejxjfuzpej307m08ujr7.jpg)

如果某 fiber 节点既不存在孩子节点也不存在兄弟节点，就移动至其父节点的兄弟节点（叔叔[uncle]节点），就像例子中的 a fiber 和 h2 fiber，见下图：

![fiber4.png](https://tva1.sinaimg.cn/large/007S8ZIlgy1gejxjfmhh6j307m08umwz.jpg)

同样的，如果其父节点也没有兄弟节点，沿着父节点向上移动，直到找到一个有兄弟节点的父节点，或者直到达到根节点。若到达了根节点，意味着我们已经完成了此次渲染中的所有操作。

```ts
interface ReactElement {
  type: string;
  props: {
    [key: string]: any;
  };
}
```

则可以定义 fiber 结构如下：

```ts
interface Fiber {
  type?: string;
  dom?: HTMLElement;
  props?: {
    [key: string]: any;
  };
  parent?: Fiber;
  child?: Fiber;
  sibling?: Fiber;
}
```

将`render`方法进行改造，定义好根节点对应的 fiber。

```js
function render(element, container) {
  nextUnitOfWork =  {
    dom: container
    props:{
      children:[element]
    }
  };
}
```

最终完成每一个工作单元的处理函数：

```js
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
```

## Step V: Render and Commit Phases

现在还有另一个问题。

每一个工作单元处理流程中，都创建了新的 DOM 节点并将其添加至页面上。但不要忘了，在完成整棵树的渲染之前，浏览器可能会打断处理流程，在这种情况下，用户将会看到不完整的 UI。

所以我们需要删除更改 DOM 的部分。

```diff
function performUnitOfWork(fiber) {
  // 1. 创建DOM
  if (!fiber.dom) {
    fiber.dom = createDom(fiber);
  }
- if (fiber.parent) {
-   fiber.parent.dom.appendChild(fiber.dom);
- }

 // ...
}
```

同时，使用一个变量`wipRoot`[the work in progress root]保存 fiber tree 的 root 节点的引用。

```js
let wipRoot = null;

function render(element, container) {
  wipRoot =  {
    dom: container
    props:{
      children:[element]
    }
  };
  nextUnitOfWork = wipRoot;
}
```

一旦完成所有处理流程（没有下一个工作单元），便将所有的 DOM 变更提交[commit]。

```diff
function workLoop(deadline) {
  let shouldYield = false;
  while (nextUnitOfWork && !shouldYield) {
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    shouldYield = deadline.timeRemaining() < 1;
  }

+ // 没有下一个工作单元了 将变更提交至DOM
+ if (!nextUnitOfWork && wipRoot) {
+   commitRoot();
+ }

  requestIdleCallback(workLoop);
}
```

定义`commitRoot`函数，用于将所有的节点递归的添加至 DOM 上。

```js
function commitRoot() {
  // add nodes to dom
  commitWork(wipRoot);
  wipRoot = null;
}

function commitWork(fiber) {
  const { parent, child, sibling } = fiber;

  if (parent) parent.dom.appendChild(fiber.dom);
  if (child) commitWork(child);
  if (sibling) commitWork(sibling);
}
```

## Step VI: Reconciliation

目前为止，仅仅是将内容渲染到了页面上，但是更新和删除节点又该如何处理呢？

这就是接下来需要考虑的：我们需要比较`render`函数接收的元素[elements]与上一次被 committed DOM 的 fiber 树[last fiber tree we committed to the DOM]。

所以在完成 commit 后，需要保存“上一次 commit DOM 的 fiber 树”的索引，就叫它`currentRoot`。

```diff
+ let currentRoot = null;

function commitRoot() {
  // add nodes to dom
  commitWork(wipRoot);
+ currentRoot = wipRoot;
  wipRoot = null;
}
```

并且为每个 fiber 节点增加`alternate`属性，这个属性用于指向上一个 commit phase 中被 committed DOM 的 fiber 节点。

```diff
function render(element, container) {
  wipRoot =  {
    dom: container
    props:{
      children:[element]
    },
+   alternate: currentRoot,
  };
  nextUnitOfWork = wipRoot;
}
```

现在让我们抽离出`performUnitOfWork`中创建新的 fibers 的相关代码至一个名为`reconcileChildren`的函数。

```diff
function performUnitOfWork(fiber) {
  // ...

  // 2. 为 element 的 children 创建 fiber 节点
  const elements = fiber.props.children;
+ reconcileChildren(fiber,elements)

- let index = 0;
- let prevSibling = null;

- while (index < elements.length) {
-   const element = elements[index];

-   const newFiber = {
-     type: element.type,
-     props: element.props,
-     parent: fiber, // 孩子节点的父节点
-     dom: null,
-   };

-   if (index === 0) {
-     // 当前fiber的孩子节点
-     fiber.child = newFiber;
-   } else {
-     // 孩子节点的兄弟节点
-     prevSibling.sibling = newFiber;
-   }
-   // 注意是指针移动
-   prevSibling = newFiber;
-   i++;
- }

  // ...
}
```

在`reconcileChildren`函数中，我们将旧的 fibers 与新的 elements 进行 reconcile。
