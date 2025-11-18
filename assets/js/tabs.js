// assets/js/tabs.js

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tabs");

  tabs.forEach((tabsRoot) => {
    const tabHeader = tabsRoot.getElementsByClassName("tab-header")[0];
    const tabIndicator = tabsRoot.getElementsByClassName("tab-indicator")[0];
    const tabBody = tabsRoot.getElementsByClassName("tab-body")[0];

    if (!tabHeader || !tabIndicator || !tabBody) return;

    const tabsPane = tabHeader.getElementsByTagName("div");
    const bodyPanes = tabBody.getElementsByTagName("div");

    for (let i = 0; i < tabsPane.length; i++) {
      tabsPane[i].addEventListener("click", function () {
        const currentActiveHeader = tabHeader.getElementsByClassName("active")[0];
        if (currentActiveHeader) {
          currentActiveHeader.classList.remove("active");
        }
        tabsPane[i].classList.add("active");

        const currentActiveBody = tabBody.getElementsByClassName("active")[0];
        if (currentActiveBody) {
          currentActiveBody.classList.remove("active");
        }
        bodyPanes[i].classList.add("active");

        // 3개의 탭 기준으로 indicator 이동
        tabIndicator.style.left = `calc(calc(100% / ${tabsPane.length}) * ${i})`;
        tabIndicator.style.width = `calc(100% / ${tabsPane.length})`;
      });
    }
  });
});
