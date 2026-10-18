export function updateThemeMode(value: "light" | "dark") {
  const doc = document.documentElement;
  doc.classList.add("disable-transitions");
  doc.classList.toggle("dark", value === "dark");
  requestAnimationFrame(() => {
    doc.classList.remove("disable-transitions");
  });
}

// 테마 쿠키 클라이언트 기록 — 공개 Server Action(setValueToCookie) 제거 대체(보안: 공개 액션 엔드포인트 0개화).
// 값은 light|dark 고정, 서버는 layout의 getPreference가 allowlist로 다시 검증한다.
export function persistThemeModeCookie(value: "light" | "dark") {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `theme_mode=${value}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax${secure}`;
}

export function updateThemePreset(value: string) {
  document.documentElement.setAttribute("data-theme-preset", value);
}
