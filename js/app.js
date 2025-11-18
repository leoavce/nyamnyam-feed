import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// -------------------- Firebase 초기화 --------------------

const firebaseConfig = {
  apiKey: "AIzaSyBO9tShfmq6MM6V0igKmIuUkg-U_9sW13g",
  authDomain: "matjip-jido-a6020.firebaseapp.com",
  projectId: "matjip-jido-a6020",
  storageBucket: "matjip-jido-a6020.firebasestorage.app",
  messagingSenderId: "794785619474",
  appId: "1:794785619474:web:06b7e2d25088742fea42cb",
  measurementId: "G-YZBYZX7G7B"
};

const app = initializeApp(firebaseConfig);
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  // GitHub Pages 환경 등에서는 analytics가 동작 안 해도 괜찮으니 무시
}

const auth = getAuth(app);
const db = getFirestore(app);

// -------------------- DOM 요소 --------------------

const feedEl = document.getElementById("feed");
const nicknameLabelEl = document.getElementById("nicknameLabel");
const searchInputEl = document.getElementById("searchInput");
const tagFilterButtons = document.querySelectorAll(".tag-filter-btn");

const addRestaurantBtn = document.getElementById("addRestaurantBtn");
const addRestaurantModal = document.getElementById("addRestaurantModal");
const closeAddRestaurantModalBtn = document.getElementById("closeAddRestaurantModal");
const cancelAddRestaurantBtn = document.getElementById("cancelAddRestaurant");
const addRestaurantForm = document.getElementById("addRestaurantForm");

const logoutBtn = document.getElementById("logoutBtn");

const toastEl = document.getElementById("toast");

// -------------------- 전역 상태 --------------------

let currentUser = null;
let currentNickname = null;
let restaurantsCache = []; // { restaurant, reviews }
let currentCategoryFilter = "all";
let currentSearchQuery = "";

// -------------------- 유틸 --------------------

function showToast(message, duration = 2000) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  setTimeout(() => {
    toastEl.classList.add("hidden");
  }, duration);
}

function parseHashtags(input) {
  if (!input) return [];
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

function formatCategoryLabel(category) {
  switch (category) {
    case "korean":
      return "한식";
    case "chinese":
      return "중식";
    case "japanese":
      return "일식";
    case "western":
      return "양식";
    case "seasia":
      return "동남아";
    case "cafe":
      return "카페";
    case "bar":
      return "술집";
    default:
      return category || "기타";
  }
}

function calculateRatingStats(reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      avg: null,
      count: 0,
      distribution: {}
    };
  }
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  reviews.forEach((r) => {
    const rating = Number(r.rating || 0);
    if (rating >= 1 && rating <= 5) {
      sum += rating;
      distribution[rating] += 1;
    }
  });
  const count = reviews.length;
  const avg = sum / count;
  return { avg, count, distribution };
}

// -------------------- 인증 --------------------

// users/{uid} 문서에서 닉네임 읽기 (없으면 이메일 앞부분 사용)
async function loadUserProfile(user) {
  let nickname = null;
  try {
    const userDocRef = doc(db, "users", user.uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      nickname = data.nickname || null;
    }
  } catch (e) {
    console.warn("loadUserProfile error", e);
  }

  if (!nickname) {
    nickname = user.email
      ? user.email.split("@")[0]
      : `user-${user.uid.slice(0, 6)}`;
  }

  currentNickname = nickname;
  if (nicknameLabelEl) {
    nicknameLabelEl.textContent = nickname;
  }
}

function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // 로그인 안 되어 있으면 로그인 페이지로 이동
      window.location.href = "login.html";
      return;
    }
    currentUser = user;
    await loadUserProfile(user);
    loadRestaurants();
  });
}

// -------------------- 데이터 로딩 --------------------

async function loadRestaurants() {
  try {
    const q = query(
      collection(db, "restaurants"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    const results = [];
    for (const docSnap of snap.docs) {
      const restaurant = { id: docSnap.id, ...docSnap.data() };

      const reviewQ = query(
        collection(db, "reviews"),
        where("restaurantId", "==", restaurant.id),
        orderBy("createdAt", "desc")
      );
      const reviewSnap = await getDocs(reviewQ);
      const reviews = reviewSnap.docs.map((r) => ({
        id: r.id,
        ...r.data()
      }));
      results.push({ restaurant, reviews });
    }
    restaurantsCache = results;
    renderFeed();
  } catch (e) {
    console.error(e);
    showToast("맛집 목록을 불러오는 중 오류가 발생했어요.");
  }
}

// -------------------- 렌더링 --------------------

function renderFeed() {
  feedEl.innerHTML = "";

  const filtered = restaurantsCache.filter(({ restaurant, reviews }) => {
    if (
      currentCategoryFilter !== "all" &&
      restaurant.category !== currentCategoryFilter
    ) {
      return false;
    }

    if (!currentSearchQuery) return true;

    const q = currentSearchQuery.toLowerCase();

    if (q.startsWith("#")) {
      const tag = q;
      const mainTags = (restaurant.mainHashtags || []).map((t) =>
        t.toLowerCase()
      );
      const reviewTags = reviews.flatMap((r) =>
        (r.hashtags || []).map((t) => t.toLowerCase())
      );
      return (
        mainTags.some((t) => t.includes(tag)) ||
        reviewTags.some((t) => t.includes(tag))
      );
    }

    const targetText = [
      restaurant.name,
      restaurant.positionDescription,
      restaurant.mainMenu
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return targetText.includes(q);
  });

  if (filtered.length === 0) {
    const emptyEl = document.createElement("div");
    emptyEl.className = "empty-state";
    emptyEl.textContent =
      "조건에 맞는 맛집이 아직 없어요. 첫 번째 맛집을 추가해볼까요?";
    feedEl.appendChild(emptyEl);
    return;
  }

  filtered.forEach(({ restaurant, reviews }) => {
    const card = createRestaurantCard(restaurant, reviews);
    feedEl.appendChild(card);
  });
}

function createRestaurantCard(restaurant, reviews) {
  const { avg, count, distribution } = calculateRatingStats(reviews);
  const categoryLabel = formatCategoryLabel(restaurant.category);
  const mainHashtags = restaurant.mainHashtags || [];

  const card = document.createElement("article");
  card.className = "restaurant-card";
  card.dataset.id = restaurant.id;

  const infoHTML = `
    <div class="tab-pane active">
      <div class="info-grid">
        <div>
          <div class="info-label">대표 메뉴</div>
          <div class="info-value">${restaurant.mainMenu || "-"}</div>
        </div>
        <div>
          <div class="info-label">분위기</div>
          <div class="info-value">${restaurant.mood || "-"}</div>
        </div>
        <div>
          <div class="info-label">웨이팅</div>
          <div class="info-value">${
            restaurant.waitingLevel
              ? restaurant.waitingLevel === "low"
                ? "적음"
                : restaurant.waitingLevel === "medium"
                  ? "보통"
                  : "많음"
              : "-"
          }</div>
        </div>
        <div>
          <div class="info-label">냄새</div>
          <div class="info-value">${
            restaurant.smellLevel
              ? restaurant.smellLevel === "none"
                ? "거의 안 밈"
                : restaurant.smellLevel === "normal"
                  ? "보통"
                  : "잘 밈"
              : "-"
          }</div>
        </div>
        <div>
          <div class="info-label">가격대</div>
          <div class="info-value">${restaurant.priceLevel || "-"}</div>
        </div>
        <div>
          <div class="info-label">대표 해시태그</div>
          <div class="info-value">
            ${
              mainHashtags.length
                ? mainHashtags
                    .map((t) => `<span class="tag-badge">${t}</span>`)
                    .join(" ")
                : "-"
            }
          </div>
        </div>
      </div>
      ${
        restaurant.imageUrl
          ? `
      <div class="info-image-preview">
        <div class="info-label">이미지 미리보기</div>
        <a href="${restaurant.imageUrl}" target="_blank" rel="noopener noreferrer">
          <img src="${restaurant.imageUrl}" alt="${restaurant.name} 이미지" />
        </a>
      </div>
      `
          : ""
      }
    </div>
  `;

  const reviewsHTML =
    reviews.length === 0
      ? `<p class="empty-reviews" style="font-size:12px;color:#888;">아직 후기가 없어요. 첫 후기를 남겨볼까요?</p>`
      : `
      <div class="review-list">
        ${reviews
          .map((r) => {
            const tags = r.hashtags || [];
            return `
            <article class="review-item">
              <div class="review-header">
                <span class="review-nickname">${r.nickname || "익명"}</span>
                <span class="review-rating">⭐ ${r.rating}</span>
              </div>
              <div class="review-comment">${(r.comment || "").replace(
                /\n/g,
                "<br />"
              )}</div>
              ${
                tags.length
                  ? `<div class="review-tags">
                      ${tags
                        .map((t) => `<span class="review-tag">${t}</span>`)
                        .join(" ")}
                    </div>`
                  : ""
              }
              ${
                r.imageUrl
                  ? `<div class="review-image">
                      <a href="${r.imageUrl}" target="_blank" rel="noopener noreferrer">
                        <img src="${r.imageUrl}" alt="리뷰 이미지" />
                      </a>
                    </div>`
                  : ""
              }
            </article>
          `;
          })
          .join("")}
      </div>
  `;

  const feedTabHTML = `
    <div class="tab-pane">
      ${reviewsHTML}
      <form class="add-review-form" data-restaurant-id="${restaurant.id}">
        <div class="add-review-form-row">
          <select name="rating" required>
            <option value="">별점</option>
            <option value="5">⭐⭐⭐⭐⭐ (5)</option>
            <option value="4">⭐⭐⭐⭐ (4)</option>
            <option value="3">⭐⭐⭐ (3)</option>
            <option value="2">⭐⭐ (2)</option>
            <option value="1">⭐ (1)</option>
          </select>
          <input type="url" name="imageUrl" placeholder="이미지 URL (선택)" />
        </div>
        <textarea name="comment" placeholder="후기를 남겨주세요" required></textarea>
        <input
          type="text"
          name="hashtags"
          placeholder="#점심맛집, #회식굿 (쉼표로 구분)"
        />
        <div class="add-review-footer">
          <button type="submit" class="primary-btn" style="font-size:11px;padding:5px 10px;">
            후기 등록
          </button>
        </div>
      </form>
    </div>
  `;

  const statsTabHTML = `
    <div class="tab-pane">
      <div class="stats-grid">
        <div class="stats-card">
          <div class="stats-card-title">평균 별점</div>
          <div class="info-value">
            ${
              avg
                ? `⭐ ${avg.toFixed(1)} <span style="font-size:11px;color:#999;">(${count}개)</span>`
                : "아직 없음"
            }
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">별점 분포</div>
          <div class="info-value">
            ${[5, 4, 3, 2, 1]
              .map((score) => `${score}★: ${distribution[score] || 0}`)
              .join("<br />")}
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">카테고리</div>
          <div class="info-value">${categoryLabel}</div>
        </div>
      </div>
    </div>
  `;

  const mapTabHTML = `
    <div class="tab-pane">
      <div class="map-section">
        <div>
          <div class="info-label">주소</div>
          <div class="info-value">${restaurant.address || "-"}</div>
        </div>
        <div>
          <div class="info-label">친절한 위치 설명</div>
          <div class="info-value">${
            restaurant.positionDescription || "-"
          }</div>
        </div>
        <div class="map-link-row">
          ${
            restaurant.address
              ? `
          <a
            class="secondary-btn"
            href="https://map.naver.com/v5/search/${encodeURIComponent(
              restaurant.address
            )}"
            target="_blank" rel="noopener noreferrer"
          >
            네이버 지도
          </a>
          <a
            class="secondary-btn"
            href="https://map.kakao.com/?q=${encodeURIComponent(
              restaurant.address
            )}"
            target="_blank" rel="noopener noreferrer"
          >
            카카오맵
          </a>
          <a
            class="secondary-btn"
            href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              restaurant.address
            )}"
            target="_blank" rel="noopener noreferrer"
          >
            구글 지도
          </a>
          `
              : "<span style='font-size:12px;color:#888;'>주소 정보가 없어요.</span>"
          }
        </div>
      </div>
    </div>
  `;

  card.innerHTML = `
    <header class="restaurant-header">
      <div class="restaurant-header-top">
        <div class="restaurant-title">
          <h2>${restaurant.name}</h2>
          <div class="restaurant-subline">
            ${restaurant.positionDescription || restaurant.address || ""}
          </div>
        </div>
        <div class="restaurant-meta">
          <div class="rating-pill">
            <i class="fa fa-star"></i>
            <span>${avg ? `${avg.toFixed(1)} (${count})` : "별점 없음"}</span>
          </div>
          <div class="tag-badges">
            ${
              categoryLabel
                ? `<span class="tag-badge">#${categoryLabel}</span>`
                : ""
            }
          </div>
        </div>
      </div>
    </header>
    <div class="tabs">
      <div class="tab-header">
        <div class="active">
          <i class="fa fa-info-circle"></i> Info
        </div>
        <div>
          <i class="fa fa-comments"></i> Feed
        </div>
        <div>
          <i class="fa fa-bar-chart"></i> Stats
        </div>
        <div>
          <i class="fa fa-map-marker-alt"></i> Map
        </div>
      </div>
      <div class="tab-indicator"></div>
      <div class="tab-body">
        ${infoHTML}
        ${feedTabHTML}
        ${statsTabHTML}
        ${mapTabHTML}
      </div>
    </div>
  `;

  initTabsForCard(card);

  const reviewForm = card.querySelector(".add-review-form");
  reviewForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showToast("로그인 상태를 확인 중입니다. 다시 시도해주세요.");
      return;
    }
    const formData = new FormData(reviewForm);
    const rating = formData.get("rating");
    const comment = formData.get("comment").trim();
    const imageUrl = formData.get("imageUrl").trim();
    const hashtagsInput = formData.get("hashtags");

    if (!rating || !comment) {
      showToast("별점과 후기를 모두 입력해주세요.");
      return;
    }

    const hashtags = parseHashtags(hashtagsInput);

    try {
      await addDoc(collection(db, "reviews"), {
        restaurantId: restaurant.id,
        userUID: currentUser.uid,
        nickname: currentNickname || "",
        rating: Number(rating),
        comment,
        imageUrl: imageUrl || null,
        hashtags,
        createdAt: serverTimestamp()
      });
      showToast("후기가 등록됐어요!");
      reviewForm.reset();
      await loadRestaurants();
    } catch (error) {
      console.error(error);
      showToast("후기를 저장하는 중 오류가 발생했어요.");
    }
  });

  return card;
}

function initTabsForCard(cardEl) {
  const tabHeader = cardEl.getElementsByClassName("tab-header")[0];
  const tabIndicator = cardEl.getElementsByClassName("tab-indicator")[0];
  const tabBody = cardEl.getElementsByClassName("tab-body")[0];

  const tabsPane = tabHeader.getElementsByTagName("div");
  const tabPanes = tabBody.getElementsByClassName("tab-pane");

  Array.from(tabsPane).forEach((pane, index) => {
    pane.addEventListener("click", () => {
      const activeHeader = tabHeader.getElementsByClassName("active")[0];
      if (activeHeader) activeHeader.classList.remove("active");
      pane.classList.add("active");

      const activeBody = tabBody.getElementsByClassName("active")[0];
      if (activeBody) activeBody.classList.remove("active");
      tabPanes[index].classList.add("active");

      tabIndicator.style.left = `calc(calc(100% / 4) * ${index})`;
    });
  });
}

// -------------------- 이벤트 바인딩 --------------------

// 검색
if (searchInputEl) {
  searchInputEl.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.trim();
    renderFeed();
  });
}

// 태그 필터
tagFilterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tagFilterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentCategoryFilter = btn.dataset.category || "all";
    renderFeed();
  });
});

// 맛집 추가 모달 open/close
function openAddRestaurantModal() {
  if (!currentUser) {
    showToast("로그인 상태를 확인 중입니다. 잠시 후 다시 시도해주세요.");
    return;
  }
  addRestaurantModal.classList.remove("hidden");
}

function closeAddRestaurantModal() {
  addRestaurantModal.classList.add("hidden");
  addRestaurantForm.reset();
}

if (addRestaurantBtn) {
  addRestaurantBtn.addEventListener("click", openAddRestaurantModal);
}
if (closeAddRestaurantModalBtn) {
  closeAddRestaurantModalBtn.addEventListener("click", closeAddRestaurantModal);
}
if (cancelAddRestaurantBtn) {
  cancelAddRestaurantBtn.addEventListener("click", closeAddRestaurantModal);
}

if (addRestaurantModal) {
  addRestaurantModal.addEventListener("click", (e) => {
    if (e.target === addRestaurantModal.querySelector(".modal-backdrop")) {
      closeAddRestaurantModal();
    }
  });
}

// 맛집 추가 폼 제출
if (addRestaurantForm) {
  addRestaurantForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showToast("로그인 상태를 확인 중입니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const formData = new FormData(addRestaurantForm);
    const name = formData.get("name").trim();
    const address = formData.get("address").trim();
    const positionDescription = formData.get("positionDescription").trim();
    const mainMenu = formData.get("mainMenu").trim();
    const mood = formData.get("mood").trim();
    const waitingLevel = formData.get("waitingLevel") || "";
    const smellLevel = formData.get("smellLevel") || "";
    const priceLevel = formData.get("priceLevel") || "";
    const category = formData.get("category") || "";
    const mainHashtagsInput = formData.get("mainHashtags");
    const imageUrl = formData.get("imageUrl").trim();

    if (!name || !address) {
      showToast("가게 이름과 주소는 필수입니다.");
      return;
    }

    const mainHashtags = parseHashtags(mainHashtagsInput);

    try {
      await addDoc(collection(db, "restaurants"), {
        name,
        address,
        positionDescription: positionDescription || null,
        mainMenu: mainMenu || null,
        mood: mood || null,
        waitingLevel: waitingLevel || null,
        smellLevel: smellLevel || null,
        priceLevel: priceLevel || null,
        category: category || null,
        mainHashtags,
        imageUrl: imageUrl || null,
        creatorUID: currentUser.uid,
        createdAt: serverTimestamp()
      });
      showToast("맛집이 추가됐어요!");
      closeAddRestaurantModal();
      await loadRestaurants();
    } catch (error) {
      console.error(error);
      showToast("맛집을 저장하는 중 오류가 발생했어요.");
    }
  });
}

// 로그아웃
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (e) {
      console.error(e);
      showToast("로그아웃 중 오류가 발생했어요.");
    }
  });
}

// -------------------- 초기화 --------------------

initAuth();
