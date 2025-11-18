import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBO9tShfmq6MM6V0igKmIuUkg-U_9sW13g",
  authDomain: "matjip-jido-a6020.firebaseapp.com",
  projectId: "matjip-jido-a6020",
  storageBucket: "matjip-jido-a6020.firebasestorage.app",
  messagingSenderId: "794785619474",
  appId: "1:794785619474:web:06b7e2d25088742fea42cb",
  measurementId: "G-YZBYZX7G7B",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ---- 상태 ----
let currentUser = null;
let currentUserProfile = null;

let restaurants = [];
let filteredRestaurants = [];
let selectedRestaurantId = null;
let currentReviews = [];
let selectedRating = 0;
let editingReviewId = null;

// ---- DOM ----
const toastEl = document.getElementById("toast");

const searchInput = document.getElementById("searchInput");
const restaurantListEl = document.getElementById("restaurantList");
const emptyStateEl = document.getElementById("emptyState");

const addRestaurantBtn = document.getElementById("addRestaurantBtn");
const userProfileBtn = document.getElementById("userProfileBtn");
const userNicknameLabel = document.getElementById("userNicknameLabel");
const logoutBtn = document.getElementById("logoutBtn");

// 모달들
const restaurantModal = document.getElementById("restaurantModal");
const restaurantModalTitle = document.getElementById("restaurantModalTitle");
const restaurantForm = document.getElementById("restaurantForm");
const restaurantIdField = document.getElementById("restaurantIdField");

const closeRestaurantModalBtn = document.getElementById(
  "closeRestaurantModalBtn"
);
const cancelRestaurantBtn = document.getElementById("cancelRestaurantBtn");

// 상세 모달
const detailModal = document.getElementById("detailModal");
const closeDetailModalBtn = document.getElementById("closeDetailModalBtn");

const detailNameEl = document.getElementById("detailName");
const detailAvgRatingEl = document.getElementById("detailAvgRating");
const detailReviewCountEl = document.getElementById("detailReviewCount");
const editRestaurantBtn = document.getElementById("editRestaurantBtn");
const deleteRestaurantBtn = document.getElementById("deleteRestaurantBtn");

const detailLocationEl = document.getElementById("detailLocation");
const detailFriendlyLocationEl = document.getElementById(
  "detailFriendlyLocation"
);
const detailMainMenuEl = document.getElementById("detailMainMenu");
const detailVibeEl = document.getElementById("detailVibe");
const detailWaitingEl = document.getElementById("detailWaiting");
const detailSmellEl = document.getElementById("detailSmell");
const detailPriceRangeEl = document.getElementById("detailPriceRange");
const detailTagsEl = document.getElementById("detailTags");
const detailHashtagsEl = document.getElementById("detailHashtags");
const detailLinkAreaEl = document.getElementById("detailLinkArea");

const feedListEl = document.getElementById("feedList");
const ratingSelectorEl = document.getElementById("ratingSelector");
const reviewTextInput = document.getElementById("reviewTextInput");
const submitReviewBtn = document.getElementById("submitReviewBtn");
const cancelEditReviewBtn = document.getElementById("cancelEditReviewBtn");

const statsAvgRatingEl = document.getElementById("statsAvgRating");
const statsReviewCountEl = document.getElementById("statsReviewCount");
const statsSummaryTextEl = document.getElementById("statsSummaryText");

const mapFrame = document.getElementById("mapFrame");
const openMapExternalBtn = document.getElementById("openMapExternalBtn");

const detailTabButtons = document.querySelectorAll(".detail-tab-button");
const detailTabPanels = document.querySelectorAll(".detail-tab-panel");

// ---- 유틸 ----
function showToast(message, duration = 2000) {
  toastEl.textContent = message;
  toastEl.classList.remove("hidden");
  setTimeout(() => toastEl.classList.add("hidden"), duration);
}

function splitToArray(str, { removeHash = false } = {}) {
  if (!str) return [];
  return str
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      if (removeHash && s.startsWith("#")) return s.slice(1);
      return s;
    });
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : ts;
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRating(value) {
  if (value == null || isNaN(value)) return "-";
  return Number(value).toFixed(1);
}

// ---- 인증 처리 ----
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  currentUser = user;

  // 프로필 불러오기
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (userDoc.exists()) {
    currentUserProfile = userDoc.data();
  } else {
    currentUserProfile = { email: user.email, nickname: user.email };
    await setDoc(doc(db, "users", user.uid), {
      nickname: currentUserProfile.nickname,
      email: user.email,
      createdAt: serverTimestamp(),
    });
  }
  userNicknameLabel.textContent =
    currentUserProfile.nickname || currentUser.email;

  await loadRestaurants();
});

// ---- 데이터 로딩 ----
async function loadRestaurants() {
  const q = query(
    collection(db, "restaurants"),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  restaurants = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  filteredRestaurants = restaurants;
  renderRestaurantList();
}

// ---- 렌더링 ----
function renderRestaurantList() {
  restaurantListEl.innerHTML = "";

  if (!filteredRestaurants || filteredRestaurants.length === 0) {
    emptyStateEl.classList.remove("hidden");
    return;
  }
  emptyStateEl.classList.add("hidden");

  filteredRestaurants.forEach((r) => {
    const card = document.createElement("article");
    card.className = "restaurant-card";
    card.dataset.id = r.id;

    const avg = r.avgRating ?? null;
    const reviewCount = r.reviewCount ?? 0;

    const tags = r.tags || [];
    const hashtags = r.hashtags || [];

    card.innerHTML = `
      <div class="card-header-row">
        <h3 class="card-title">${r.name || "이름 없음"}</h3>
        <div class="card-rating">
          <span class="card-stars">★ ${avg ? formatRating(avg) : "-"}</span>
          <span class="card-reviews">(${reviewCount || 0} 리뷰)</span>
        </div>
      </div>
      <div class="card-sub">
        <i class="fa fa-location-dot"></i>
        <span class="card-location">
          ${r.friendlyLocation || r.location || "-"}
        </span>
      </div>
      <div class="card-tags-row">
        ${tags
          .map(
            (t) =>
              `<span class="chip chip-tag">${t.trim()}</span>`
          )
          .join("")}
        ${hashtags
          .slice(0, 3)
          .map(
            (h) =>
              `<span class="chip chip-hash">#${h.replace(
                /^#/,
                ""
              )}</span>`
          )
          .join("")}
      </div>
      <button class="card-open-btn" type="button">
        상세 보기
      </button>
    `;

    card
      .querySelector(".card-open-btn")
      .addEventListener("click", () => openDetailModal(r.id));

    restaurantListEl.appendChild(card);
  });
}

// ---- 검색 ----
function handleSearch() {
  const keyword = searchInput.value.trim().toLowerCase();
  if (!keyword) {
    filteredRestaurants = restaurants;
    renderRestaurantList();
    return;
  }

  filteredRestaurants = restaurants.filter((r) => {
    const name = (r.name || "").toLowerCase();
    const tags = (r.tags || []).join(" ").toLowerCase();
    const hashes = (r.hashtags || [])
      .map((h) => (h || "").toLowerCase())
      .join(" ");
    return (
      name.includes(keyword) ||
      tags.includes(keyword) ||
      hashes.includes(keyword.replace(/^#/, ""))
    );
  });

  renderRestaurantList();
}

// ---- 모달 공통 ----
function openRestaurantModalForCreate() {
  restaurantModalTitle.textContent = "맛집 추가하기";
  restaurantIdField.value = "";

  restaurantForm.reset();
  restaurantModal.classList.remove("hidden");
}

function openRestaurantModalForEdit(restaurant) {
  restaurantModalTitle.textContent = "맛집 정보 편집";
  restaurantIdField.value = restaurant.id;

  document.getElementById("nameInput").value = restaurant.name || "";
  document.getElementById("locationInput").value =
    restaurant.location || "";
  document.getElementById("friendlyLocationInput").value =
    restaurant.friendlyLocation || "";
  document.getElementById("mainMenuInput").value =
    restaurant.mainMenu || "";
  document.getElementById("vibeInput").value = restaurant.vibe || "";
  document.getElementById("waitingInput").value =
    restaurant.waiting || "";
  document.getElementById("smellInput").value = restaurant.smell || "";
  document.getElementById("priceRangeInput").value =
    restaurant.priceRange || "";
  document.getElementById("tagsInput").value = (restaurant.tags || []).join(
    ", "
  );
  document.getElementById("hashtagsInput").value = (restaurant.hashtags || [])
    .map((h) => `#${h}`)
    .join(" ");
  document.getElementById("imageUrlInput").value =
    restaurant.imageUrl || "";

  restaurantModal.classList.remove("hidden");
}

function closeRestaurantModal() {
  restaurantModal.classList.add("hidden");
}

// 상세 모달
function openDetailModal(id) {
  const restaurant = restaurants.find((r) => r.id === id);
  if (!restaurant) return;

  selectedRestaurantId = id;
  detailNameEl.textContent = restaurant.name || "이름 없음";

  const avg = restaurant.avgRating ?? null;
  const reviewCount = restaurant.reviewCount ?? 0;

  detailAvgRatingEl.textContent = `★ ${
    avg ? formatRating(avg) : "-"
  }`;
  detailReviewCountEl.textContent = `(리뷰 ${reviewCount || 0}개)`;

  detailLocationEl.textContent = restaurant.location || "-";
  detailFriendlyLocationEl.textContent =
    restaurant.friendlyLocation || "";

  detailMainMenuEl.textContent = restaurant.mainMenu || "-";
  detailVibeEl.textContent = restaurant.vibe || "-";
  detailWaitingEl.textContent = restaurant.waiting || "-";
  detailSmellEl.textContent = restaurant.smell || "-";
  detailPriceRangeEl.textContent = restaurant.priceRange || "-";

  // 태그/해시태그
  detailTagsEl.innerHTML = "";
  (restaurant.tags || []).forEach((t) => {
    const span = document.createElement("span");
    span.className = "chip chip-tag";
    span.textContent = t;
    detailTagsEl.appendChild(span);
  });

  detailHashtagsEl.innerHTML = "";
  (restaurant.hashtags || []).forEach((h) => {
    const span = document.createElement("span");
    span.className = "chip chip-hash";
    span.textContent = `#${h.replace(/^#/, "")}`;
    detailHashtagsEl.appendChild(span);
  });

  // 링크
  detailLinkAreaEl.innerHTML = "";
  if (restaurant.imageUrl) {
    const a = document.createElement("a");
    a.href = restaurant.imageUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "링크 열기";
    detailLinkAreaEl.appendChild(a);
  } else {
    detailLinkAreaEl.textContent = "등록된 링크가 없어요.";
  }

  // Map
  const locationForMap =
    restaurant.location || restaurant.friendlyLocation || "";
  if (locationForMap) {
    const encoded = encodeURIComponent(locationForMap);
    mapFrame.src = `https://www.google.com/maps?q=${encoded}&output=embed`;
    openMapExternalBtn.onclick = () => {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        "_blank"
      );
    };
  } else {
    mapFrame.src = "";
    openMapExternalBtn.onclick = null;
  }

  // 편집/삭제 버튼 노출 여부
  if (currentUser && restaurant.creatorUID === currentUser.uid) {
    editRestaurantBtn.classList.remove("hidden");
    deleteRestaurantBtn.classList.remove("hidden");
  } else {
    editRestaurantBtn.classList.add("hidden");
    deleteRestaurantBtn.classList.add("hidden");
  }

  // 탭 초기화
  setActiveTab("info");

  // 리뷰/통계 로딩
  loadReviews(id);

  detailModal.classList.remove("hidden");
}

function closeDetailModal() {
  detailModal.classList.add("hidden");
  selectedRestaurantId = null;
  currentReviews = [];
  editingReviewId = null;
  selectedRating = 0;
  updateRatingSelector();
  reviewTextInput.value = "";
  cancelEditReviewBtn.classList.add("hidden");
}

// ---- 탭 ----
function setActiveTab(tabName) {
  detailTabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });
  detailTabPanels.forEach((panel) => {
    panel.classList.toggle(
      "active",
      panel.dataset.tabPanel === tabName
    );
  });
}

// ---- 맛집 저장/삭제 ----
restaurantForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) {
    showToast("다시 로그인 해주세요.");
    return;
  }

  const id = restaurantIdField.value || null;

  const name = document.getElementById("nameInput").value.trim();
  const location = document
    .getElementById("locationInput")
    .value.trim();
  const friendlyLocation = document
    .getElementById("friendlyLocationInput")
    .value.trim();
  const mainMenu = document.getElementById("mainMenuInput").value.trim();
  const vibe = document.getElementById("vibeInput").value.trim();
  const waiting = document.getElementById("waitingInput").value.trim();
  const smell = document.getElementById("smellInput").value.trim();
  const priceRange = document
    .getElementById("priceRangeInput")
    .value.trim();
  const tags = splitToArray(
    document.getElementById("tagsInput").value
  );
  const hashtags = splitToArray(
    document.getElementById("hashtagsInput").value,
    { removeHash: true }
  );
  const imageUrl = document
    .getElementById("imageUrlInput")
    .value.trim();

  if (!name || !location) {
    showToast("가게 이름과 위치는 필수입니다.");
    return;
  }

  const payload = {
    name,
    location,
    friendlyLocation,
    mainMenu,
    vibe,
    waiting,
    smell,
    priceRange,
    tags,
    hashtags,
    imageUrl,
  };

  try {
    if (id) {
      // update
      const ref = doc(db, "restaurants", id);
      await updateDoc(ref, payload);
      showToast("맛집 정보가 수정되었습니다.");
    } else {
      // create
      const ref = collection(db, "restaurants");
      await addDoc(ref, {
        ...payload,
        creatorUID: currentUser.uid,
        creatorNickname:
          currentUserProfile?.nickname || currentUser.email,
        createdAt: serverTimestamp(),
        avgRating: null,
        reviewCount: 0,
      });
      showToast("맛집이 추가되었습니다.");
    }
    closeRestaurantModal();
    await loadRestaurants();
  } catch (err) {
    console.error(err);
    showToast("저장 중 오류가 발생했습니다.");
  }
});

deleteRestaurantBtn.addEventListener("click", async () => {
  if (!selectedRestaurantId) return;
  const restaurant = restaurants.find(
    (r) => r.id === selectedRestaurantId
  );
  if (!restaurant) return;

  if (
    !confirm(
      `"${restaurant.name}" 맛집 정보를 삭제할까요?\n연결된 리뷰도 함께 지우는 것이 좋습니다.`
    )
  ) {
    return;
  }

  try {
    // 리뷰 함께 삭제
    const reviewsRef = collection(db, "reviews");
    const q = query(
      reviewsRef,
      where("restaurantId", "==", selectedRestaurantId)
    );
    const snap = await getDocs(q);
    const batchDeletes = snap.docs.map((d) =>
      deleteDoc(doc(db, "reviews", d.id))
    );
    await Promise.all(batchDeletes);

    await deleteDoc(doc(db, "restaurants", selectedRestaurantId));

    showToast("맛집이 삭제되었습니다.");
    closeDetailModal();
    await loadRestaurants();
  } catch (err) {
    console.error(err);
    showToast("삭제 중 오류가 발생했습니다.");
  }
});

editRestaurantBtn.addEventListener("click", () => {
  if (!selectedRestaurantId) return;
  const restaurant = restaurants.find(
    (r) => r.id === selectedRestaurantId
  );
  if (!restaurant) return;
  openRestaurantModalForEdit(restaurant);
});

// ---- 리뷰 ----
async function loadReviews(restaurantId) {
  const ref = collection(db, "reviews");
  const q = query(
    ref,
    where("restaurantId", "==", restaurantId),
    orderBy("createdAt", "desc")
  );

  const snap = await getDocs(q);
  currentReviews = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
  renderReviews();
  updateStatsFromReviews();
}

function renderReviews() {
  feedListEl.innerHTML = "";

  if (!currentReviews || currentReviews.length === 0) {
    const empty = document.createElement("div");
    empty.className = "feed-empty";
    empty.textContent =
      "아직 리뷰가 없어요. 첫 번째 리뷰를 남겨볼까요?";
    feedListEl.appendChild(empty);
    return;
  }

  currentReviews.forEach((r) => {
    const item = document.createElement("article");
    item.className = "feed-item";

    const isMine =
      currentUser && r.userUID === currentUser.uid;

    const stars = "★".repeat(r.rating || 0).padEnd(5, "☆");

    item.innerHTML = `
      <div class="feed-item-header">
        <div class="feed-item-meta">
          <span class="feed-item-nick">${r.userNickname || "익명"}</span>
          <span class="feed-item-rating">${stars} (${r.rating || "-"})</span>
          <span class="feed-item-date">${formatDate(r.createdAt)}</span>
        </div>
        <div class="feed-item-actions">
          ${
            isMine
              ? `
              <button class="text-button small edit-review-btn" data-id="${r.id}">
                수정
              </button>
              <button class="text-button small danger delete-review-btn" data-id="${r.id}">
                삭제
              </button>
            `
              : ""
          }
        </div>
      </div>
      <div class="feed-item-body">
        ${r.text ? r.text.replace(/\n/g, "<br>") : ""}
      </div>
    `;

    if (isMine) {
      item
        .querySelector(".edit-review-btn")
        .addEventListener("click", () => startEditReview(r.id));
      item
        .querySelector(".delete-review-btn")
        .addEventListener("click", () => deleteReview(r.id));
    }

    feedListEl.appendChild(item);
  });
}

function updateStatsFromReviews() {
  if (!currentReviews || currentReviews.length === 0) {
    statsAvgRatingEl.textContent = "-";
    statsReviewCountEl.textContent = "0개";
    statsSummaryTextEl.textContent =
      "리뷰가 쌓이면 전체 분위기를 요약해서 보여줄게요.";
    return;
  }

  const total = currentReviews.reduce(
    (sum, r) => sum + (Number(r.rating) || 0),
    0
  );
  const count = currentReviews.length;
  const avg = total / count;

  statsAvgRatingEl.textContent = formatRating(avg);
  statsReviewCountEl.textContent = `${count}개`;

  let summary = "";
  if (avg >= 4.5) summary = "상폄동 최상급 맛집 포스… 재방문 의사 강추!";
  else if (avg >= 4.0)
    summary = "대체로 만족도가 높은 편이에요. 점심·저녁 모두 무난한 선택.";
  else if (avg >= 3.0)
    summary =
      "호불호가 조금 있는 편. 특정 메뉴/시간대만 골라서 가는 걸 추천.";
  else summary = "평가가 좋지 않은 편이에요. 리뷰 내용을 잘 읽어보고 선택하세요.";

  statsSummaryTextEl.textContent = summary;

  // restaurant 문서에 집계값 저장
  if (selectedRestaurantId) {
    updateRestaurantStats(selectedRestaurantId, avg, count);
  }
}

async function updateRestaurantStats(restaurantId, avg, count) {
  try {
    await updateDoc(doc(db, "restaurants", restaurantId), {
      avgRating: avg,
      reviewCount: count,
    });

    // 로컬 캐시에도 반영
    restaurants = restaurants.map((r) =>
      r.id === restaurantId ? { ...r, avgRating: avg, reviewCount: count } : r
    );
    filteredRestaurants = restaurants;
    renderRestaurantList();
  } catch (err) {
    console.error("update stats error", err);
  }
}

// ---- 리뷰 작성/수정/삭제 ----
function updateRatingSelector() {
  const buttons = ratingSelectorEl.querySelectorAll("button");
  buttons.forEach((btn) => {
    const r = Number(btn.dataset.rating);
    btn.classList.toggle("active", r <= selectedRating);
  });
}

ratingSelectorEl.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedRating = Number(btn.dataset.rating);
    updateRatingSelector();
  });
});

async function submitReview() {
  if (!currentUser) {
    showToast("다시 로그인 해주세요.");
    return;
  }
  if (!selectedRestaurantId) {
    showToast("먼저 맛집을 선택해주세요.");
    return;
  }
  if (!selectedRating) {
    showToast("별점을 선택해주세요.");
    return;
  }
  const text = reviewTextInput.value.trim();
  if (!text) {
    showToast("리뷰 내용을 입력해주세요.");
    return;
  }

  try {
    if (editingReviewId) {
      // update
      await updateDoc(doc(db, "reviews", editingReviewId), {
        rating: selectedRating,
        text,
      });
      showToast("리뷰가 수정되었어요.");
    } else {
      // create
      await addDoc(collection(db, "reviews"), {
        restaurantId: selectedRestaurantId,
        rating: selectedRating,
        text,
        userUID: currentUser.uid,
        userNickname:
          currentUserProfile?.nickname || currentUser.email,
        createdAt: serverTimestamp(),
      });
      showToast("리뷰가 등록되었어요.");
    }

    selectedRating = 0;
    updateRatingSelector();
    reviewTextInput.value = "";
    editingReviewId = null;
    cancelEditReviewBtn.classList.add("hidden");

    await loadReviews(selectedRestaurantId);
  } catch (err) {
    console.error(err);
    showToast("리뷰 저장 중 오류가 발생했습니다.");
  }
}

function startEditReview(id) {
  const r = currentReviews.find((rv) => rv.id === id);
  if (!r) return;

  editingReviewId = id;
  selectedRating = r.rating || 0;
  updateRatingSelector();
  reviewTextInput.value = r.text || "";
  cancelEditReviewBtn.classList.remove("hidden");
}

function cancelEditReview() {
  editingReviewId = null;
  selectedRating = 0;
  updateRatingSelector();
  reviewTextInput.value = "";
  cancelEditReviewBtn.classList.add("hidden");
}

async function deleteReview(id) {
  const r = currentReviews.find((rv) => rv.id === id);
  if (!r) return;

  if (!confirm("이 리뷰를 삭제할까요?")) return;

  try {
    await deleteDoc(doc(db, "reviews", id));
    showToast("리뷰가 삭제되었습니다.");
    await loadReviews(selectedRestaurantId);
  } catch (err) {
    console.error(err);
    showToast("리뷰 삭제 중 오류가 발생했습니다.");
  }
}

// ---- 이벤트 바인딩 ----
addRestaurantBtn.addEventListener("click", openRestaurantModalForCreate);
closeRestaurantModalBtn.addEventListener("click", closeRestaurantModal);
cancelRestaurantBtn.addEventListener("click", closeRestaurantModal);

closeDetailModalBtn.addEventListener("click", closeDetailModal);

searchInput.addEventListener("input", handleSearch);

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (err) {
    console.error(err);
    showToast("로그아웃 중 오류가 발생했습니다.");
  }
});

detailTabButtons.forEach((btn) => {
  btn.addEventListener("click", () =>
    setActiveTab(btn.dataset.tab)
  );
});

submitReviewBtn.addEventListener("click", submitReview);
cancelEditReviewBtn.addEventListener("click", cancelEditReview);

// 프로필 버튼은 일단 토스트 정도만
userProfileBtn.addEventListener("click", () => {
  if (!currentUserProfile) return;
  showToast(
    `${currentUserProfile.nickname || currentUser.email} 님으로 로그인 중`
  );
});
