const overlay = document.getElementById("lightbox-overlay");
const lightboxImg = overlay.querySelector("img");
const closeBtn = document.getElementById("lightbox-close");

document.querySelectorAll(".lightbox-img").forEach(img => {
  img.addEventListener("click", () => {
    lightboxImg.src = img.src;
    overlay.style.display = "flex";

    // 强制触发 reflow 让动画生效
    void overlay.offsetWidth;

    overlay.classList.add("show");
  });
});

function closeLightbox() {
  overlay.classList.remove("show");
  // 等待动画完成后再隐藏
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