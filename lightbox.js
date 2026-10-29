const overlay = document.getElementById("lightbox-overlay");
const lightboxImg = overlay.querySelector("img");
const closeBtn = document.getElementById("lightbox-close");

// 判断是否启用 Lightbox（大于 600px 才启用）
const enableLightbox = window.innerWidth > 600;

if (enableLightbox) {
  document.querySelectorAll(".lightbox-img").forEach(img => {
    img.addEventListener("click", () => {
      if (window.promoteImage) window.promoteImage(img);
      lightboxImg.src = img.dataset.imageFinalSrc || img.currentSrc || img.src || img.dataset.imageOriginal;
      lightboxImg.onerror = () => {
        const fallback = img.dataset.imageFallbackSrc || img.currentSrc || img.src || img.dataset.imageOriginal;
        if (lightboxImg.src !== fallback) lightboxImg.src = fallback;
      };
      overlay.style.display = "flex";

      // 强制触发 reflow 让动画生效
      void overlay.offsetWidth;

      overlay.classList.add("show");
    });
  });

  function closeLightbox() {
    overlay.classList.remove("show");
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
}
