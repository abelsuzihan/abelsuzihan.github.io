const overlay = document.getElementById("lightbox-overlay");
const lightboxImg = overlay.querySelector("img");
const closeBtn = document.getElementById("lightbox-close");

// body 有页面入场 transform；把灯箱提升到 html 下，确保 fixed 相对视口定位。
if (overlay.parentNode !== document.documentElement) {
  document.documentElement.appendChild(overlay);
}

// 判断是否启用 Lightbox（大于 600px 才启用）
const enableLightbox = window.innerWidth > 600;

if (enableLightbox) {
  const lightboxItems = Array.from(document.querySelectorAll(".lightbox-img"));
  let currentIndex = -1;

  function openLightbox(index) {
    const img = lightboxItems[index];
    if (!img) return;

    if (window.promoteImage) window.promoteImage(img);
    lightboxImg.src = img.dataset.imageFinalSrc || img.currentSrc || img.src || img.dataset.imageOriginal;
    lightboxImg.onerror = () => {
      const fallback = img.dataset.imageFallbackSrc || img.currentSrc || img.src || img.dataset.imageOriginal;
      if (lightboxImg.src !== fallback) lightboxImg.src = fallback;
    };
    currentIndex = index;
  }

  lightboxItems.forEach((img, index) => {
    img.addEventListener("click", () => {
      openLightbox(index);
      overlay.style.display = "flex";

      // 强制触发 reflow 让动画生效
      void overlay.offsetWidth;

      overlay.classList.add("show");
    });
  });

  function changeLightboxImage(step) {
    if (lightboxItems.length < 2) return;

    const nextIndex = (currentIndex + step + lightboxItems.length) % lightboxItems.length;
    openLightbox(nextIndex);
  }

  function closeLightbox() {
    overlay.classList.remove("show");
    currentIndex = -1;
    setTimeout(() => {
      overlay.style.display = "none";
    }, 300);
  }

  closeBtn.addEventListener("click", closeLightbox);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!overlay.classList.contains("show")) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      changeLightboxImage(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      changeLightboxImage(1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeLightbox();
    }
  });
}
