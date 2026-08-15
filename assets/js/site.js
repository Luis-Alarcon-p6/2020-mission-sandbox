(() => {
  const root = document.documentElement;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clock = document.querySelector("[data-clock]");
  const tick = () => {
    if (!clock) return;
    const now = new Date();
    clock.textContent = now.toISOString().slice(11, 19) + " UTC";
  };
  tick();
  setInterval(tick, 1000);

  const veil = document.querySelector(".veil");
  if (veil && !reduced) {
    window.setTimeout(() => veil.classList.add("is-gone"), 900);
  } else if (veil) {
    veil.classList.add("is-gone");
  }

  const cursor = document.querySelector(".cursor");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (cursor && fine) {
    document.body.classList.add("has-cursor");
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    window.addEventListener("pointermove", (event) => {
      tx = event.clientX;
      ty = event.clientY;
    });
    const loop = () => {
      x += (tx - x) * 0.22;
      y += (ty - y) * 0.22;
      cursor.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
    document.querySelectorAll("a, button, input, textarea").forEach((el) => {
      el.addEventListener("pointerenter", () => cursor.classList.add("is-hot"));
      el.addEventListener("pointerleave", () => cursor.classList.remove("is-hot"));
    });
  }

  const canvas = document.querySelector(".stars");
  if (canvas && canvas.getContext && !reduced) {
    const ctx = canvas.getContext("2d");
    let stars = [];
    const resize = () => {
      canvas.width = window.innerWidth * devicePixelRatio;
      canvas.height = window.innerHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      const count = Math.min(140, Math.floor((window.innerWidth * window.innerHeight) / 14000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random(),
        s: Math.random() * 0.012 + 0.003,
      }));
    };
    resize();
    window.addEventListener("resize", resize);
    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      stars.forEach((star) => {
        star.a += star.s;
        ctx.globalAlpha = 0.25 + Math.abs(Math.sin(star.a)) * 0.7;
        ctx.fillStyle = "#f2ead8";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  }

  const links = [...document.querySelectorAll(".nav a[href^='#']")];
  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  if (sections.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((link) => {
            const on = link.getAttribute("href") === `#${entry.target.id}`;
            link.toggleAttribute("aria-current", on);
          });
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    sections.forEach((section) => spy.observe(section));
  }

  const form = document.querySelector("[data-signal]");
  const note = document.querySelector("[data-note]");
  if (form && note) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      form.reset();
      note.hidden = false;
    });
  }

  root.dataset.ready = "true";
})();
